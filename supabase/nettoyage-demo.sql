-- LALLA : suppression des données de démonstration (comptes @demo.lalla.be, leurs tenues,
-- les partenaires et showrooms de démo). À coller dans Supabase → SQL Editor → Run.
-- Sans effet sur les vrais comptes.
begin;
delete from tenue_photos where tenue_id in (
  select t.id from tenues t join auth.users u on u.id = t.fournisseuse_id where u.email like '%@demo.lalla.be');
delete from tenues where fournisseuse_id in (select id from auth.users where email like '%@demo.lalla.be');
-- Les showrooms de démo ont été créés avant le lancement (2 octobre 2026).
delete from showroom_inscriptions where showroom_id in (select id from showrooms where created_at < '2026-10-03');
delete from showrooms where created_at < '2026-10-03';
delete from partenaires where (user_id is null and created_at < '2026-10-03') or user_id in (select id from auth.users where email like '%@demo.lalla.be');
delete from auth.users where email like '%@demo.lalla.be';
commit;
