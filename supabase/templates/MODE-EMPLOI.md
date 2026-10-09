# Emails de connexion LALLAT (Supabase)

Deux modèles aux couleurs de LALLAT. Chaque email part en français ou en néerlandais selon la langue choisie sur le site au moment de l'inscription (métadonnée `langue`).

- `confirmation.html` : modèle « Confirm sign up », l'email envoyé à l'inscription
- `lien-connexion.html` : modèle « Magic link », l'email du bouton « Recevoir un lien de connexion »

Le site n'utilise pas les autres modèles (invitation, changement d'adresse, mot de passe, réauthentification) : ne pas y toucher.

## Où les coller
Supabase, projet LALLAT : Authentication, Emails, onglet Templates
https://supabase.com/dashboard/project/pueejmddxhofwbxtmxdg/auth/templates

Pour chaque modèle : remplacer le sujet, coller tout le fichier dans le corps (onglet Source), puis Save.
L'aperçu de Supabase affiche les deux langues et des accolades `{{ }}` : c'est normal, l'email réel n'affiche qu'une langue.

### Confirm sign up
Sujet :

```text
{{ if eq (index .Data "langue") "nl" }}Bevestig uw inschrijving bij LALLAT{{ else }}Confirmez votre inscription à LALLAT{{ end }}
```

Corps : tout le contenu de `confirmation.html`.

### Magic link
Sujet :

```text
{{ if eq (index .Data "langue") "nl" }}Uw inloglink voor LALLAT{{ else }}Votre lien de connexion LALLAT{{ end }}
```

Corps : tout le contenu de `lien-connexion.html`.

## Tester
1. Sur https://lallat.be, créer un compte avec `lallat.info+fr@gmail.com` : l'email « Confirmez votre inscription à LALLAT » arrive dans Gmail. Cliquer sur le bouton.
2. Connexion, même adresse, « Recevoir un lien de connexion » : l'email « Votre lien de connexion LALLAT » arrive. L'ouvrir sur le même appareil.
3. Sur https://lallat.be/?lang=nl, créer un compte avec `lallat.info+nl@gmail.com` : l'email arrive en néerlandais.
4. Supprimer les comptes de test : Authentication, Users, menu de la ligne, Delete user.

Si un email arrive avec l'ancien modèle en anglais, Supabase a rejeté le modèle : regarder Logs, Auth.

## Vérifié
Modèles et sujets exécutés avec le moteur de modèles Go (celui de Supabase Auth), en mode normal et en mode strict : langue fr, nl, absente et métadonnées vides, sans erreur.
