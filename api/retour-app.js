// Fin d'une page Stripe ouverte depuis l'application mobile (paiement, carte de caution, versements).
// Renvoie dans l'app par son adresse « lallat:// » ; l'app ferme alors la fenêtre Stripe et recharge la page.
// Le site n'utilise pas cette adresse.
export default function handler(req, res) {
  const etat = ['ok', 'annule', 'relance'].includes(req.query && req.query.etat) ? req.query.etat : 'ok';
  const lien = `lallat://retour?etat=${etat}`;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>LALLAT</title>
<style>
  html,body{margin:0;height:100%;background:#FAF6F0;color:#1E1412;font-family:-apple-system,system-ui,sans-serif}
  main{min-height:100%;display:grid;place-content:center;gap:18px;padding:32px;text-align:center;box-sizing:border-box}
  .logo{font-family:Georgia,serif;letter-spacing:.4em;font-size:26px;color:#5E1D27;margin:0}
  p{margin:0;line-height:1.5}
  a{justify-self:center;display:inline-block;min-height:48px;line-height:48px;padding:0 28px;border-radius:12px;background:#5E1D27;color:#FAF6F0;text-decoration:none;font-size:16px}
</style></head>
<body><main>
  <p class="logo">LALLAT</p>
  <p id="texte">${etat === 'ok' ? 'C\'est fait !' : 'Opération interrompue.'}</p>
  <a id="lien" href="${lien}">Revenir dans l'application</a>
</main>
<script>
  if ((navigator.language || '').toLowerCase().indexOf('nl') === 0) {
    document.getElementById('texte').textContent = ${JSON.stringify(etat === 'ok' ? 'Gelukt!' : 'Bewerking onderbroken.')};
    document.getElementById('lien').textContent = 'Terug naar de app';
  }
  setTimeout(function () { location.href = ${JSON.stringify(lien)}; }, 300);
</script>
</body></html>`);
}
