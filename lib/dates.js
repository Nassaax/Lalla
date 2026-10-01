// Dates calendaires en heure de Bruxelles (les locations se comptent en jours).
const FUSEAU = 'Europe/Brussels';

export function aujourdhui(maintenant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant);
}

export function ajouterJours(dateIso, n) {
  const d = new Date(dateIso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function joursEntre(a, b) {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
}

export function heuresPlus(h, depuis = new Date()) {
  return new Date(depuis.getTime() + h * 3600_000).toISOString();
}

export function formatDate(dateIso, langue = 'fr') {
  return new Intl.DateTimeFormat(langue === 'nl' ? 'nl-BE' : 'fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(dateIso.slice(0, 10) + 'T12:00:00Z'));
}

export function formatEuros(cents, langue = 'fr') {
  return new Intl.NumberFormat(langue === 'nl' ? 'nl-BE' : 'fr-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
