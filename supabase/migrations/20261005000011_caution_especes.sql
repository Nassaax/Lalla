-- Caution : option « sans caution » explicite et caution en espèces remise en main propre.
--   tenues.caution_mode  : 'aucune' | 'pourcentage' | 'montant'
--   tenues.caution_moyen : 'carte' (empreinte bancaire gérée par la plateforme) | 'especes' (remise à la fournisseuse)
--   reservations.caution_especes_cents : part de la caution versée en espèces (hors Stripe, rendue au retour)
alter table tenues drop constraint if exists tenues_caution_mode_check;
alter table tenues add constraint tenues_caution_mode_check check (caution_mode in ('aucune', 'pourcentage', 'montant'));
alter table tenues add column if not exists caution_moyen text not null default 'carte';
alter table tenues drop constraint if exists tenues_caution_moyen_check;
alter table tenues add constraint tenues_caution_moyen_check check (caution_moyen in ('carte', 'especes'));

alter table reservations add column if not exists caution_especes_cents integer not null default 0;
alter table reservations drop constraint if exists reservations_caution_especes_check;
alter table reservations add constraint reservations_caution_especes_check check (caution_especes_cents >= 0);
