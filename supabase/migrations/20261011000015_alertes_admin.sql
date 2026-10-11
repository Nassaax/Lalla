-- Alertes à l'équipe : à chaque inscription, annonce envoyée en validation ou fiche d'annuaire créée,
-- la base appelle /api/v1/alerte-base (pg_net, asynchrone : l'inscription n'attend jamais l'appel).
-- L'adresse et le secret sont lus dans le coffre Supabase (vault) : noms « alertes_url » et « alertes_secret ».
-- Sans ces deux secrets, rien n'est envoyé.

create extension if not exists pg_net with schema extensions;

create or replace function public.alerter_equipe() returns trigger
language plpgsql security definer set search_path = public, extensions, vault as $$
declare
  url text;
  secret text;
begin
  if tg_table_name = 'tenues' then
    if new.statut::text <> 'en_attente' or (tg_op = 'UPDATE' and old.statut::text = 'en_attente') then
      return new;
    end if;
  end if;
  select decrypted_secret into url from vault.decrypted_secrets where name = 'alertes_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'alertes_secret';
  if url is null or secret is null then
    return new;
  end if;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('table', tg_table_name, 'id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-alerte-secret', secret),
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  -- Une alerte ne doit jamais empêcher une inscription ou une publication.
  return new;
end $$;

revoke all on function public.alerter_equipe() from public, anon, authenticated;

drop trigger if exists alerte_inscription on profils;
create trigger alerte_inscription after insert on profils
  for each row execute function public.alerter_equipe();

drop trigger if exists alerte_annonce on tenues;
create trigger alerte_annonce after insert or update of statut on tenues
  for each row execute function public.alerter_equipe();

drop trigger if exists alerte_annuaire on partenaires;
create trigger alerte_annuaire after insert on partenaires
  for each row execute function public.alerter_equipe();
