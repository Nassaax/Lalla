-- Nouveau profil de fournisseuse : « loueur de tenues » (boutique de location de tenues, à côté des negafas).
-- La valeur est ajoutée au type, puis acceptée à l'inscription. Seul changement de creer_profil_utilisateur :
-- la liste des types autorisés.
alter type type_fournisseuse add value if not exists 'loueur_tenues';

create or replace function creer_profil_utilisateur() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type type_fournisseuse;
begin
  if m ->> 'type_fournisseuse' in ('particuliere', 'negafa', 'loueur_tenues', 'creatrice', 'prestataire', 'loueur') then
    v_type := (m ->> 'type_fournisseuse')::type_fournisseuse;
  end if;
  insert into profils (id, nom_affiche, langue, est_fournisseuse, type_fournisseuse, est_partenaire, ville)
  values (
    new.id,
    left(coalesce(nullif(m ->> 'prenom', ''), split_part(new.email, '@', 1)), 80),
    case when m ->> 'langue' = 'nl' then 'nl' else 'fr' end,
    v_type is not null,
    v_type,
    coalesce(m ->> 'partenaire', '') = 'true',
    case when zone_valide(m ->> 'ville') then m ->> 'ville' end
  )
  on conflict (id) do nothing;
  insert into profils_prives (id, prenom, nom, email, consentement_cgu_at, cgu_version)
  values (
    new.id,
    left(m ->> 'prenom', 60),
    left(m ->> 'nom', 80),
    new.email,
    case when (m ->> 'cgu')::boolean then now() end,
    case when (m ->> 'cgu')::boolean then left(m ->> 'cgu_version', 20) end
  )
  on conflict (id) do nothing;
  return new;
end $$;
