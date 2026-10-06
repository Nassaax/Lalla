-- Conditions générales : version acceptée par chaque membre (nouvelle acceptation à chaque nouvelle version),
-- et nouveaux profils de fournisseuse à l'inscription (prestataire, loueur de matériel).
alter table profils_prives add column if not exists cgu_version text check (cgu_version is null or char_length(cgu_version) <= 20);
grant update (cgu_version) on profils_prives to authenticated;

create or replace function creer_profil_utilisateur() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type type_fournisseuse;
begin
  if m ->> 'type_fournisseuse' in ('particuliere', 'negafa', 'creatrice', 'prestataire', 'loueur') then
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
