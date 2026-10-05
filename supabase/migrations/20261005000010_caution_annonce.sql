-- Caution choisie par la fournisseuse sur chaque annonce :
--   'pourcentage' : valeur déclarée × caution_taux (taux de la plateforme si null)
--   'montant'     : montant fixe en centimes (0 = sans caution), plafonné à la valeur déclarée
alter table tenues
  add column if not exists caution_mode text not null default 'pourcentage',
  add column if not exists caution_taux numeric(4,3),
  add column if not exists caution_montant_cents integer;

alter table tenues drop constraint if exists tenues_caution_mode_check;
alter table tenues add constraint tenues_caution_mode_check check (caution_mode in ('pourcentage', 'montant'));
alter table tenues drop constraint if exists tenues_caution_taux_check;
alter table tenues add constraint tenues_caution_taux_check check (caution_taux is null or caution_taux between 0 and 1);
alter table tenues drop constraint if exists tenues_caution_montant_check;
alter table tenues add constraint tenues_caution_montant_check check (caution_montant_cents is null or caution_montant_cents between 0 and 5000000);

-- La vérification d'identité n'est plus exigée au paiement (elle reste proposée pour le badge du profil).
update parametres set description = 'Non utilisé : la vérification d''identité n''est plus exigée au paiement'
  where cle = 'seuil_identity_cents';
update parametres set description = 'Taux de caution par défaut (annonces en pourcentage sans taux choisi)'
  where cle = 'caution_taux';
