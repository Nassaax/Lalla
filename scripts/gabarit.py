# Outil de génération ponctuelle des pages HTML (head/scripts communs).
# Les pages produites sont du HTML statique versionné : aucun build n'est requis pour déployer.
CDN = """  <script src="assets/config.js"></script>
  <script src="/api/config"></script>
  <script src="assets/i18n.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/Flip.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/lenis@1.3.4/dist/lenis.min.js"></script>
  <script defer src="assets/app.js"></script>
"""

def page(fichier, page, titre_cle, titre, desc_cle, desc, contenu, scripts_extra='', robots='index,follow', ld='', chemin=None):
    chemin = chemin if chemin is not None else fichier
    html = f"""<!doctype html>
<html lang="fr-BE">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title data-i18n="{titre_cle}">{titre}</title>
  <meta name="description" data-i18n-attr="content:{desc_cle}" content="{desc}">
  <meta name="robots" content="{robots}">
  <link rel="canonical" href="https://lallat.be/{chemin}">
  <link rel="alternate" hreflang="fr-BE" href="https://lallat.be/{chemin}">
  <link rel="alternate" hreflang="nl-BE" href="https://lallat.be/{chemin}{'&' if '?' in chemin else '?'}lang=nl">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="LALLAT">
  <meta property="og:locale" content="fr_BE">
  <meta property="og:title" content="{titre}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="https://lallat.be/{chemin}">
  <meta property="og:image" content="https://lallat.be/assets/og-default.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#F4EEE3">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Manrope:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="assets/style.css">
{ld}</head>
<body data-page="{page}">
  <a class="lien-evitement" href="#contenu" data-i18n="nav.aller_contenu">Aller au contenu</a>
  <header id="entete" class="entete"></header>

  <main id="contenu">
{contenu}
  </main>

  <footer id="pied" class="pied"></footer>

{CDN}{scripts_extra}</body>
</html>
"""
    open(fichier, 'w').write(html)
