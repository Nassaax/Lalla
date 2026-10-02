#!/usr/bin/env node
// Données de démonstration (mode test) :
// 3 negafas, 5 particulières, 2 créatrices, 40 tenues, 4 clientes, 3 partenaires, 1 admin, 2 showrooms.
// Usage : SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-demo.mjs
// Option : STRIPE_SECRET_KEY=sk_test_… SEED_STRIPE=1 crée de vrais comptes Connect Express de test.
// Refuse de s'exécuter avec une clé Stripe live.
import { createClient } from '@supabase/supabase-js';

const URL_SB = process.env.SUPABASE_URL;
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !CLE) { console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.'); process.exit(1); }
if ((process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live')) { console.error('Clé Stripe live détectée : le seed de démo est réservé au mode test.'); process.exit(1); }

const sb = createClient(URL_SB, CLE, { auth: { persistSession: false, autoRefreshToken: false } });
export const MOT_DE_PASSE_DEMO = process.env.SEED_PASSWORD || 'Demo-Lalla-2026';
const DOMAINE = 'demo.lalla.be';

function verifier(r, ctx) { if (r.error) throw new Error(`${ctx} : ${r.error.message}`); return r.data; }

// Générateur pseudo-aléatoire déterministe (démo reproductible)
let graine = 20261001;
const alea = () => ((graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648);
const choisir = (t) => t[Math.floor(alea() * t.length)];

const FOURNISSEUSES = [
  { cle: 'negafa1', prenom: 'Khadija', nom: 'Bennani', type: 'negafa', ville: 'Bruxelles', boutique: 'Dar Khadija', slug: 'dar-khadija', bio: 'Negafa depuis quinze ans à Bruxelles. Takchitas de mariée, couronnes et parures complètes pour les sept tenues de la soirée.' },
  { cle: 'negafa2', prenom: 'Samira', nom: 'El Idrissi', type: 'negafa', ville: 'Liège', boutique: 'Maison Samira', slug: 'maison-samira', bio: 'Habilleuse de mariées entre Liège et Verviers. Chaque pièce est repassée, contrôlée et livrée sur housse.' },
  { cle: 'negafa3', prenom: 'Naima', nom: 'Ouazzani', type: 'negafa', ville: 'Anvers', boutique: 'Atelier Naïma', slug: 'atelier-naima', bio: 'Negafa à Anvers, spécialisée dans les tenues fassies et les caftans de henné.' },
  { cle: 'creatrice1', prenom: 'Yasmina', nom: 'Alaoui', type: 'creatrice', ville: 'Bruxelles', boutique: 'Yasmina Alaoui Studio', slug: 'yasmina-studio', bio: 'Créatrice. Coupes contemporaines, broderies sfifa et aakad réalisées à la main. Pièces uniques en location.' },
  { cle: 'creatrice2', prenom: 'Leila', nom: 'Tazi', type: 'creatrice', ville: 'Anvers', boutique: 'Atelier Tazi', slug: 'atelier-tazi', bio: 'Velours, crêpe et soie sauvage. Une collection courte, renouvelée chaque saison.' },
  { cle: 'part1', prenom: 'Salma', nom: 'Haddou', type: 'particuliere', ville: 'Bruxelles' },
  { cle: 'part2', prenom: 'Imane', nom: 'Berrada', type: 'particuliere', ville: 'Liège' },
  { cle: 'part3', prenom: 'Hajar', nom: 'Mansouri', type: 'particuliere', ville: 'Anvers' },
  { cle: 'part4', prenom: 'Sanaa', nom: 'Kettani', type: 'particuliere', ville: 'Bruxelles' },
  { cle: 'part5', prenom: 'Meryem', nom: 'Fassi', type: 'particuliere', ville: 'Liège' }
];

const CLIENTES = [
  { cle: 'cliente1', prenom: 'Amal', nom: 'Chraibi', ville: 'Bruxelles', mesures: [90, 72, 98, 150, 58, 165] },
  { cle: 'cliente2', prenom: 'Nour', nom: 'Lahlou', ville: 'Liège', mesures: [86, 68, 94, 145, 56, 160] },
  { cle: 'cliente3', prenom: 'Rania', nom: 'Bouzid', ville: 'Anvers', mesures: [96, 80, 104, 152, 59, 168] },
  { cle: 'cliente4', prenom: 'Ines', nom: 'Sefrioui', ville: 'Bruxelles', mesures: [84, 66, 92, 142, 55, 158] }
];

const PARTENAIRES = [
  { cle: 'partenaire1', prenom: 'Zineb', nom: 'Zineb Make-up', metier: 'maquilleuse', ville: 'Bruxelles', bio: 'Maquillage de mariée et de henné, à domicile. Essai inclus pour toute réservation de mariage.', instagram: 'zineb.makeup.demo' },
  { cle: 'partenaire2', prenom: 'Karim', nom: 'Studio Lumière d\'Orient', metier: 'photographe', ville: 'Liège', bio: 'Photo et vidéo de mariage, reportage complet ou demi-journée. Albums imprimés en Belgique.', instagram: 'studio.lumiere.demo' },
  { cle: 'partenaire3', prenom: 'Fatiha', nom: 'Henné Fatiha', metier: 'hennaya', ville: 'Anvers', bio: 'Hennaya pour soirées de henné : motifs fassis, sahraouis et contemporains. Henné naturel uniquement.', instagram: 'henne.fatiha.demo' }
];

const MODELES = {
  caftan: { noms: ['Caftan velours', 'Caftan en crêpe', 'Caftan brodé main', 'Caftan sfifa', 'Caftan fassi', 'Caftan en soie sauvage'], prix: [55, 120], valeur: [500, 1500] },
  takchita: { noms: ['Takchita deux pièces', 'Takchita brodée', 'Takchita en mousseline', 'Takchita de soirée'], prix: [90, 200], valeur: [1200, 3000] },
  mariee: { noms: ['Tenue de mariée fassie', 'Takchita de mariée', 'Tenue de mariée chamali', 'Lebsa de mariée'], prix: [180, 380], valeur: [2500, 6000] },
  homme: { noms: ['Jabador en lin', 'Jabador brodé', 'Gandoura de cérémonie'], prix: [45, 90], valeur: [300, 900] },
  enfant: { noms: ['Caftan fillette', 'Jabador garçon', 'Takchita enfant'], prix: [25, 45], valeur: [150, 400] },
  accessoire: { noms: { mdamma: ['Mdamma dorée', 'Mdamma ciselée', 'Ceinture mdamma argent'], bijoux: ['Parure lebba', 'Collier et boucles', 'Parure de henné'], couronne: ['Couronne de mariée', 'Diadème fassi'] }, prix: [20, 70], valeur: [200, 1200] }
};
const DETAILS = ['émeraude', 'bordeaux', 'ivoire', 'nuit', 'or', 'rose poudré', 'noir', 'terracotta', 'lilas', 'turquoise'];
const COULEUR_DE = { 'émeraude': 'emeraude', bordeaux: 'bordeaux', ivoire: 'ivoire', nuit: 'bleu_nuit', or: 'or', 'rose poudré': 'rose', noir: 'noir', terracotta: 'terracotta', lilas: 'lilas', turquoise: 'turquoise' };
const DESCRIPTIONS = [
  'Broderie au fil doré réalisée à la main, boutonnière aakad sur toute la longueur. Doublure satinée, tombé souple.',
  'Coupe droite et manches évasées. Galon sfifa au col et aux poignets. Portée deux fois, état impeccable.',
  'Pièce de créatrice, tissu lourd qui garde sa tenue toute la soirée. Ceinture non comprise sauf mention.',
  'Mousseline légère sur fond satiné, perlage discret. Idéale pour un henné ou des fiançailles.',
  'Ensemble complet, repassé et contrôlé avant chaque remise. Housse de transport fournie.'
];

function entre([a, b]) { return Math.round((a + alea() * (b - a)) / 5) * 5; }

async function creerUtilisateur(email, meta) {
  const existant = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = (existant.data?.users || []).find((x) => x.email === email);
  if (u) return u.id;
  const r = verifier(await sb.auth.admin.createUser({ email, password: MOT_DE_PASSE_DEMO, email_confirm: true, user_metadata: { ...meta, cgu: true } }), `utilisateur ${email}`);
  return r.user.id;
}

async function compteStripe(email) {
  if (process.env.SEED_STRIPE !== '1' || !process.env.STRIPE_SECRET_KEY) return null;
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const a = await stripe.accounts.create({ type: 'express', country: 'BE', email, capabilities: { transfers: { requested: true } }, business_type: 'individual' });
  return a.id;
}

export async function seed() {
  const ids = {};
  console.log('Admin…');
  ids.admin = await creerUtilisateur(`admin@${DOMAINE}`, { prenom: 'Équipe' });
  verifier(await sb.from('profils').update({ est_admin: true, compte_valide: true, nom_affiche: 'Équipe LALLA' }).eq('id', ids.admin), 'admin');

  console.log('Fournisseuses…');
  for (const f of FOURNISSEUSES) {
    const email = `${f.cle}@${DOMAINE}`;
    const id = await creerUtilisateur(email, { prenom: f.prenom, nom: f.nom, type_fournisseuse: f.type, ville: f.ville });
    ids[f.cle] = id;
    const acct = (await compteStripe(email)) || `acct_demo_${f.cle}`;
    verifier(await sb.from('profils').update({
      nom_affiche: f.prenom, ville: f.ville, est_fournisseuse: true, type_fournisseuse: f.type, compte_valide: true,
      stripe_onboarding_complet: true, boutique_nom: f.boutique || null, boutique_slug: f.slug || null, boutique_bio: f.bio || null
    }).eq('id', id), 'profil fournisseuse');
    verifier(await sb.from('profils_prives').update({ stripe_account_id: acct, telephone: '+32 470 00 00 ' + String(10 + FOURNISSEUSES.indexOf(f)) }).eq('id', id), 'privé fournisseuse');
  }

  console.log('Clientes…');
  for (const c of CLIENTES) {
    const id = await creerUtilisateur(`${c.cle}@${DOMAINE}`, { prenom: c.prenom, nom: c.nom, ville: c.ville });
    ids[c.cle] = id;
    verifier(await sb.from('profils').update({ ville: c.ville }).eq('id', id), 'cliente');
    const [p, t, hn, l, m, ht] = c.mesures;
    verifier(await sb.from('mensurations').upsert({ user_id: id, poitrine_cm: p, taille_cm: t, hanches_cm: hn, longueur_cm: l, manche_cm: m, hauteur_cm: ht }), 'mensurations');
    verifier(await sb.from('profils_prives').update({ telephone: '+32 480 00 00 ' + String(20 + CLIENTES.indexOf(c)) }).eq('id', id), 'privé cliente');
  }

  console.log('Partenaires…');
  for (const p of PARTENAIRES) {
    const id = await creerUtilisateur(`${p.cle}@${DOMAINE}`, { prenom: p.prenom, partenaire: 'true' });
    ids[p.cle] = id;
    verifier(await sb.from('profils').update({ est_partenaire: true, est_cliente: false, compte_valide: true }).eq('id', id), 'profil partenaire');
    const existant = verifier(await sb.from('partenaires').select('id').eq('user_id', id), 'partenaire existant');
    if (!existant.length) {
      verifier(await sb.from('partenaires').insert({
        user_id: id, nom: p.nom, metier: p.metier, ville: p.ville, bio: p.bio, instagram: p.instagram,
        email_contact: `${p.cle}@${DOMAINE}`, valide: true, galerie: [0, 1, 2].map((n) => { const k = (n + PARTENAIRES.indexOf(p)) % 3; return `placeholder:${['couronne', 'bijoux', 'mdamma'][k]}:${['or', 'emeraude', 'bordeaux'][k]}:face:${k * 11}`; })
      }), 'partenaire');
    }
  }

  console.log('Tenues…');
  const deja = verifier(await sb.from('tenues').select('id', { count: 'exact', head: false }).limit(1), 'compte tenues');
  if (deja.length) { console.log('Des tenues existent déjà : étape ignorée.'); return ids; }
  const plan = [];
  const repartition = ['caftan', 'caftan', 'caftan', 'takchita', 'takchita', 'mariee', 'homme', 'enfant'];
  const fournisseusesIds = FOURNISSEUSES.map((f) => f.cle);
  for (let i = 0; i < 40; i++) {
    const f = FOURNISSEUSES[i % FOURNISSEUSES.length];
    const estAccessoire = i % 4 === 3;
    const categorie = estAccessoire ? 'accessoire' : (f.type === 'negafa' && i % 3 === 0 ? 'mariee' : repartition[i % repartition.length]);
    const sous = estAccessoire ? choisir(['mdamma', 'bijoux', 'couronne']) : null;
    const m = MODELES[categorie];
    const detail = choisir(DETAILS);
    const base = estAccessoire ? choisir(m.noms[sous]) : choisir(m.noms);
    const couleur = COULEUR_DE[detail];
    const taille = categorie === 'enfant' ? 'enfant' : estAccessoire ? 'unique' : choisir(['S', 'M', 'M', 'L', 'L', 'XL']);
    const ecart = { S: -6, M: 0, L: 6, XL: 12, enfant: -30, unique: 0 }[taille];
    plan.push({
      fournisseuse: f.cle, categorie, sous_categorie: sous,
      titre: `${base} ${detail}`,
      description: choisir(DESCRIPTIONS),
      couleurs: [couleur, detail === 'or' ? 'ivoire' : 'or'].filter((v, k, a) => a.indexOf(v) === k),
      occasions: categorie === 'mariee' ? ['mariage'] : categorie === 'homme' ? ['mariage', 'aid'] : [choisir(['mariage', 'fiancailles', 'henne']), choisir(['aid', 'soiree', 'henne'])].filter((v, k, a) => a.indexOf(v) === k),
      taille_indicative: taille,
      mesures: estAccessoire ? null : { poitrine_cm: 92 + ecart, taille_cm: 76 + ecart, hanches_cm: 100 + ecart, longueur_cm: categorie === 'enfant' ? 100 : 148 + Math.round(alea() * 8), manche_cm: categorie === 'enfant' ? 40 : 58 + Math.round(alea() * 3) },
      prix: entre(m.prix) * 100, valeur: entre(m.valeur) * 100,
      essayage: f.type !== 'particuliere' || alea() > 0.5,
      envoi: alea() > 0.6, ville: f.ville
    });
  }
  const parFournisseuse = {};
  for (const [n, p] of plan.entries()) {
    const ligne = verifier(await sb.from('tenues').insert({
      fournisseuse_id: ids[p.fournisseuse], categorie: p.categorie, sous_categorie: p.sous_categorie, titre: p.titre,
      description: p.description, couleurs: p.couleurs, occasions: p.occasions, taille_indicative: p.taille_indicative,
      ...(p.mesures || {}), prix_location_cents: p.prix, valeur_declaree_cents: p.valeur,
      duree_min_jours: 2, duree_max_jours: p.categorie === 'mariee' ? 4 : 5,
      remise_main_propre: true, essayage_possible: p.essayage, envoi_assure: p.envoi, frais_envoi_cents: p.envoi ? 1200 : 0,
      ville: p.ville, statut: 'validee'
    }).select('id').single(), `tenue ${p.titre}`);
    const cat = p.categorie === 'accessoire' ? p.sous_categorie : p.categorie;
    const vues = p.categorie === 'accessoire' ? ['face', 'portee'] : ['face', 'dos', 'broderie', 'portee'];
    verifier(await sb.from('tenue_photos').insert(vues.map((v, k) => ({ tenue_id: ligne.id, type: v, ordre: k, chemin: `placeholder:${cat}:${p.couleurs[0]}:${v}:${n}` }))), 'photos');
    (parFournisseuse[p.fournisseuse] = parFournisseuse[p.fournisseuse] || []).push({ id: ligne.id, categorie: p.categorie });
  }
  // Ensembles : chaque tenue reliée aux accessoires de la même fournisseuse
  for (const cle of fournisseusesIds) {
    const liste = parFournisseuse[cle] || [];
    const acc = liste.filter((x) => x.categorie === 'accessoire');
    const tenues = liste.filter((x) => x.categorie !== 'accessoire');
    for (const tn of tenues) for (const a of acc) verifier(await sb.from('ensembles').insert({ tenue_id: tn.id, accessoire_id: a.id }), 'ensemble');
  }

  console.log('Showrooms…');
  const dans = (j, h) => { const d = new Date(); d.setDate(d.getDate() + j); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  verifier(await sb.from('showrooms').insert([
    { titre: 'Showroom d\'automne', ville: 'Bruxelles', lieu: 'Atelier Louise', adresse: 'Avenue Louise 000, 1050 Bruxelles (adresse de démonstration)', debut: dans(21, 11), fin: dans(21, 18), places: 40 },
    { titre: 'Journée essayage Liège', ville: 'Liège', lieu: 'Salon Outremeuse', adresse: 'Rue de démonstration 1, 4020 Liège', debut: dans(35, 10), fin: dans(35, 17), places: 25 }
  ]), 'showrooms');

  console.log('Terminé. Mot de passe de tous les comptes de démo :', MOT_DE_PASSE_DEMO);
  return ids;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
}
