#!/usr/bin/env node
// Pile Supabase locale pour le développement et les tests de bout en bout :
//   Postgres 16 (local) + GoTrue (auth) + PostgREST (API REST).
// Le stockage est émulé par scripts/dev-server.mjs.
// Usage : node scripts/stack-local.mjs [--reset]
// Prérequis : binaires `auth` (supabase/auth) et `postgrest` dans $LALLA_STACK_BIN (défaut /opt/lalla-stack).
import { spawn, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = process.env.LALLA_STACK_BIN || '/opt/lalla-stack';
const DB = process.env.LALLA_DB || 'lalla_e2e';
const PG_URL = process.env.LALLA_PG_URL || `postgres://postgres:postgres@127.0.0.1:5432/${process.env.LALLA_DB || 'lalla_e2e'}`;
const JWT_SECRET = 'lalla-secret-local-de-test-au-moins-32-caracteres';
export const PORTS = { postgrest: 3001, gotrue: 9999, smtp: 2525 };

function b64url(b) { return Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
export function jwt(payload) {
  const tete = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corps = b64url(JSON.stringify({ iss: 'supabase-local', iat: 1700000000, exp: 2100000000, ...payload }));
  const sig = b64url(createHmac('sha256', JWT_SECRET).update(`${tete}.${corps}`).digest());
  return `${tete}.${corps}.${sig}`;
}
export const CLES = { anon: jwt({ role: 'anon' }), service: jwt({ role: 'service_role' }), secret: JWT_SECRET };

function psql(base, sql) {
  execFileSync('su', ['postgres', '-c', `psql -v ON_ERROR_STOP=1 -q -d ${base}`], { input: sql, stdio: ['pipe', 'inherit', 'inherit'] });
}
function psqlFichier(base, fichier) {
  execFileSync('su', ['postgres', '-c', `psql -v ON_ERROR_STOP=1 -q -d ${base} -f ${fichier}`], { stdio: ['ignore', 'ignore', 'inherit'] });
}

async function attendre(url, essais = 60) {
  for (let i = 0; i < essais; i++) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Service indisponible : ${url}`);
}

export async function demarrerPile({ reset = true, journal = false } = {}) {
  if (reset) {
    execFileSync('su', ['postgres', '-c', `dropdb --if-exists --force ${DB}`], { stdio: 'ignore' });
    execFileSync('su', ['postgres', '-c', `createdb ${DB}`]);
    // Rôles et schéma auth tels que Supabase les prépare
    psql(DB, `
      do $$ begin
        if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
        if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
        if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
        if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit password 'authenticator'; end if;
        if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin login noinherit createrole password 'auth'; end if;
      end $$;
      grant anon, authenticated, service_role to authenticator;
      create schema if not exists auth authorization supabase_auth_admin;
      grant create on database ${DB} to supabase_auth_admin;
      alter role supabase_auth_admin set search_path = auth;
      grant usage on schema auth to anon, authenticated, service_role;
      create schema if not exists storage;
      create schema if not exists extensions;
      grant usage on schema public, storage, extensions to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    `);
  }
  const enfants = [];
  const env = {
    ...process.env,
    GOTRUE_DB_DRIVER: 'postgres',
    DATABASE_URL: `postgres://supabase_auth_admin:auth@localhost:5432/${DB}?sslmode=disable&search_path=auth`,
    GOTRUE_DB_NAMESPACE: 'auth',
    GOTRUE_API_HOST: '127.0.0.1',
    PORT: String(PORTS.gotrue),
    API_EXTERNAL_URL: process.env.SITE_URL ? process.env.SITE_URL + '/auth/v1' : 'http://localhost:8787/auth/v1',
    GOTRUE_SITE_URL: process.env.SITE_URL || 'http://localhost:8787',
    GOTRUE_URI_ALLOW_LIST: '**',
    GOTRUE_JWT_SECRET: JWT_SECRET,
    GOTRUE_JWT_EXP: '3600',
    GOTRUE_JWT_AUD: 'authenticated',
    GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
    GOTRUE_JWT_ADMIN_ROLES: 'service_role',
    GOTRUE_DISABLE_SIGNUP: 'false',
    GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
    GOTRUE_MAILER_AUTOCONFIRM: 'true',
    GOTRUE_SMTP_HOST: '127.0.0.1',
    GOTRUE_SMTP_PORT: String(PORTS.smtp),
    GOTRUE_SMTP_ADMIN_EMAIL: 'bonjour@lallat.local',
    GOTRUE_SMTP_USER: 'x',
    GOTRUE_SMTP_PASS: 'x',
    GOTRUE_RATE_LIMIT_EMAIL_SENT: '1000',
    GOTRUE_RATE_LIMIT_TOKEN_REFRESH: '10000',
    GOTRUE_RATE_LIMIT_VERIFY: '10000',
    GOTRUE_LOG_LEVEL: 'warn'
  };
  const sortie = journal ? 'inherit' : 'ignore';
  const gotrue = spawn(path.join(BIN, 'auth'), [], { env, stdio: ['ignore', sortie, sortie], cwd: BIN });
  enfants.push(gotrue);
  await attendre(`http://127.0.0.1:${PORTS.gotrue}/health`);

  if (reset) {
    // Émulation storage (le schéma auth vient de GoTrue), puis migrations LALLAT
    const stub = readFileSync(path.join(racine, 'supabase/tests/00_supabase_stub.sql'), 'utf8');
    const storageSeul = stub.slice(stub.indexOf('create table if not exists storage.buckets'));
    psql(DB, storageSeul);
    for (const f of readdirSync(path.join(racine, 'supabase/migrations')).sort()) {
      psqlFichier(DB, path.join(racine, 'supabase/migrations', f));
    }
    psql(DB, `notify pgrst, 'reload schema';`);
  }

  mkdirSync(path.join(racine, '.tmp'), { recursive: true });
  const conf = path.join(racine, '.tmp/postgrest.conf');
  writeFileSync(conf, [
    `db-uri = "postgres://authenticator:authenticator@localhost:5432/${DB}"`,
    'db-schemas = "public"',
    'db-anon-role = "anon"',
    `jwt-secret = "${JWT_SECRET}"`,
    `server-port = ${PORTS.postgrest}`,
    'server-host = "127.0.0.1"',
    'db-pool = 20',
    'log-level = "crit"'
  ].join('\n'));
  const postgrest = spawn(path.join(BIN, 'postgrest'), [conf], { stdio: ['ignore', sortie, sortie] });
  enfants.push(postgrest);
  await attendre(`http://127.0.0.1:${PORTS.postgrest}/`);

  const pool = new pg.Pool({ connectionString: PG_URL, max: 5 });
  return {
    pool,
    cles: CLES,
    arreter: async () => { await pool.end(); for (const e of enfants) e.kill('SIGTERM'); }
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const pile = await demarrerPile({ reset: process.argv.includes('--reset') || true, journal: true });
  console.log('Pile locale prête.');
  console.log(`SUPABASE_ANON_KEY=${pile.cles.anon}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${pile.cles.service}`);
  process.on('SIGINT', async () => { await pile.arreter(); process.exit(0); });
}
