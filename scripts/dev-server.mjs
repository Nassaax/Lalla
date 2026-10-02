#!/usr/bin/env node
// Serveur de développement : fichiers statiques + fonctions /api (comme sur Vercel)
// + passerelle Supabase locale (/rest/v1 → PostgREST, /auth/v1 → GoTrue, /storage/v1 émulé).
// Usage : node scripts/dev-server.mjs  (voir README, section « Développement local »)
import http from 'node:http';
import { readFile, stat, mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.woff2': 'font/woff2'
};

const REWRITES = [
  [/^\/t\/([^/]+)$/, (m) => `/api/share?id=${encodeURIComponent(m[1])}`],
  [/^\/sitemap\.xml$/, () => '/api/sitemap'],
  [/^\/api\/cron\/([a-z-]+)$/, (m) => `/api/cron?task=${m[1]}`]
];

function lireCorps(req) {
  return new Promise((resolve, reject) => {
    const morceaux = [];
    req.on('data', (c) => morceaux.push(c));
    req.on('end', () => resolve(Buffer.concat(morceaux)));
    req.on('error', reject);
  });
}

async function fonctionApi(req, res, url) {
  let fichier, query = Object.fromEntries(url.searchParams);
  const m = url.pathname.match(/^\/api\/v1\/([a-z0-9-]+)$/);
  if (m) { fichier = path.join(racine, 'api/v1/[action].js'); query.action = m[1]; }
  else fichier = path.join(racine, url.pathname.replace(/\/$/, '') + '.js');
  try { await stat(fichier); } catch { res.statusCode = 404; res.end('Not found'); return; }
  const mod = await import(pathToFileURL(fichier).href);
  req.query = query;
  if (!url.pathname.startsWith('/api/webhook') && req.method !== 'GET') {
    const brut = await lireCorps(req);
    const type = req.headers['content-type'] || '';
    req.body = type.includes('application/json') && brut.length ? JSON.parse(brut.toString('utf8')) : brut.toString('utf8');
  }
  await mod.default(req, res);
}

async function statique(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const fichier = path.join(racine, p);
  if (!fichier.startsWith(racine) || /\/(\.|node_modules|lib|supabase|scripts|tests)\b/.test(p)) { res.statusCode = 404; res.end('Not found'); return; }
  try {
    const contenu = await readFile(fichier);
    res.setHeader('Content-Type', TYPES[path.extname(fichier)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(contenu);
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><title>404</title><p>Page introuvable</p>');
  }
}

// --- Passerelle Supabase locale -------------------------------------------
async function relayer(req, res, cible) {
  const corps = ['GET', 'HEAD'].includes(req.method) ? undefined : await lireCorps(req);
  const entetes = { ...req.headers };
  delete entetes.host; delete entetes.connection; delete entetes['content-length'];
  const r = await fetch(cible, { method: req.method, headers: entetes, body: corps, redirect: 'manual' });
  res.statusCode = r.status;
  r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'connection', 'content-length'].includes(k)) res.setHeader(k, v); });
  res.end(Buffer.from(await r.arrayBuffer()));
}

function claimsDe(req) {
  const h = req.headers.authorization || '';
  const jeton = h.startsWith('Bearer ') ? h.slice(7) : req.headers.apikey;
  try { return JSON.parse(Buffer.from(String(jeton).split('.')[1], 'base64url').toString('utf8')); } catch { return { role: 'anon' }; }
}

let pool;
async function avecRole(req, fn) {
  pool = pool || new pg.Pool({ connectionString: process.env.LALLA_PG_URL || 'postgres://postgres:postgres@127.0.0.1:5432/' + (process.env.LALLA_DB || 'lalla_e2e'), max: 5 });
  const c = await pool.connect();
  const claims = claimsDe(req);
  const role = ['anon', 'authenticated', 'service_role'].includes(claims.role) ? claims.role : 'anon';
  try {
    await c.query('begin');
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await c.query(`set local role ${role}`);
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally { c.release(); }
}

// Émulation minimale de Supabase Storage (upload, lecture publique, URL signées, suppression), RLS comprise.
async function stockage(req, res, url) {
  const dossier = path.join(racine, '.tmp/storage');
  const json = (s, o) => { res.statusCode = s; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  const p = url.pathname.replace(/^\/storage\/v1/, '');
  try {
    let m;
    if ((m = p.match(/^\/object\/public\/([^/]+)\/(.+)$/)) && req.method === 'GET') {
      const fichier = path.join(dossier, m[1], decodeURIComponent(m[2]));
      const b = await readFile(fichier);
      res.setHeader('Content-Type', TYPES[path.extname(fichier)] || 'image/webp');
      return res.end(b);
    }
    if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) {
      const bucket = m[1], nom = decodeURIComponent(m[2]);
      if (req.method === 'POST') {
        const vu = await avecRole(req, (c) => c.query('select 1 from storage.objects where bucket_id=$1 and name=$2', [bucket, nom]));
        if (!vu.rowCount) { if (process.env.DEBUG_STOCKAGE) console.error('[stockage] introuvable', bucket, nom); return json(400, { statusCode: '404', error: 'not_found', message: 'Object not found' }); }
        return json(200, { signedURL: `/object/sign/${bucket}/${nom.split('/').map(encodeURIComponent).join('/')}?token=local` });
      }
      const fichier = path.join(dossier, bucket, nom);
      res.setHeader('Content-Type', TYPES[path.extname(fichier)] || 'image/webp');
      return res.end(await readFile(fichier));
    }
    if ((m = p.match(/^\/object\/([^/]+)\/(.+)$/)) && ['POST', 'PUT'].includes(req.method)) {
      const bucket = m[1], nom = decodeURIComponent(m[2]);
      const corps = await lireCorps(req);
      let donnees = corps, type = req.headers['content-type'] || 'application/octet-stream';
      if (type.startsWith('multipart/form-data')) {
        const borne = '--' + type.split('boundary=')[1];
        const brut = corps.toString('latin1');
        const partie = brut.split(borne).find((x) => x.includes('filename=') || x.includes('name=""'));
        const debut = partie.indexOf('\r\n\r\n') + 4;
        const ct = (partie.match(/Content-Type: ([^\r\n]+)/i) || [])[1];
        if (ct) type = ct;
        donnees = Buffer.from(partie.slice(debut, partie.length - 2), 'latin1');
      }
      const claims = claimsDe(req);
      await avecRole(req, (c) => c.query(
        `insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)
         on conflict (bucket_id, name) do update set metadata = excluded.metadata`,
        [bucket, nom, claims.sub || null, JSON.stringify({ mimetype: type, size: donnees.length })]));
      const fichier = path.join(dossier, bucket, nom);
      await mkdir(path.dirname(fichier), { recursive: true });
      await writeFile(fichier, donnees);
      return json(200, { Key: `${bucket}/${nom}`, Id: nom });
    }
    if ((m = p.match(/^\/object\/([^/]+)$/)) && req.method === 'DELETE') {
      const bucket = m[1];
      const { prefixes = [] } = JSON.parse((await lireCorps(req)).toString('utf8') || '{}');
      const r = await avecRole(req, (c) => c.query('delete from storage.objects where bucket_id=$1 and name = any($2) returning name', [bucket, prefixes]));
      for (const row of r.rows) await rm(path.join(dossier, bucket, row.name), { force: true });
      return json(200, r.rows.map((x) => ({ name: x.name })));
    }
    return json(404, { message: 'Route de stockage non émulée' });
  } catch (e) {
    if (process.env.DEBUG_STOCKAGE) console.error('[stockage]', req.method, url.pathname, e.message);
    const rls = /row-level security|permission denied/.test(e.message);
    return json(rls ? 403 : 400, { statusCode: rls ? '403' : '400', error: rls ? 'Unauthorized' : 'Error', message: e.message });
  }
}

export function creerServeur({ port = Number(process.env.PORT) || 8787, passerelle = true } = {}) {
  const serveur = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      for (const [motif, cible] of REWRITES) {
        const m = url.pathname.match(motif);
        if (m) { const n = new URL(cible(m), url); url.pathname = n.pathname; n.searchParams.forEach((v, k) => url.searchParams.set(k, v)); break; }
      }
      if (passerelle && url.pathname.startsWith('/rest/v1')) return await relayer(req, res, `http://127.0.0.1:3001${url.pathname.slice(8)}${url.search}`);
      if (passerelle && url.pathname.startsWith('/auth/v1')) return await relayer(req, res, `http://127.0.0.1:9999${url.pathname.slice(8)}${url.search}`);
      if (passerelle && url.pathname.startsWith('/storage/v1')) return await stockage(req, res, url);
      if (url.pathname.startsWith('/api/')) return await fonctionApi(req, res, url);
      return await statique(req, res, url);
    } catch (e) {
      console.error('[dev]', e);
      if (!res.headersSent) { res.statusCode = 500; res.end('Erreur serveur de développement'); }
    }
  });
  return new Promise((resolve) => serveur.listen(port, () => resolve(serveur)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const s = await creerServeur();
  console.log(`LALLA en local : http://localhost:${s.address().port}`);
}
