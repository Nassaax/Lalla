-- LALLA — 004 : buckets de stockage et policies
-- Photos compressées en WebP côté navigateur avant envoi.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('tenues', 'tenues', true, 3145728, array['image/webp', 'image/jpeg']),
  ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg']),
  ('partenaires', 'partenaires', true, 3145728, array['image/webp', 'image/jpeg']),
  ('etats-des-lieux', 'etats-des-lieux', false, 4194304, array['image/webp', 'image/jpeg']),
  ('litiges', 'litiges', false, 4194304, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- Dossiers personnels : <auth.uid()>/…
create policy "lecture publique tenues avatars partenaires" on storage.objects for select
  using (bucket_id in ('tenues', 'avatars', 'partenaires'));

create policy "ecriture dossier personnel" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('tenues', 'avatars', 'partenaires')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "maj dossier personnel" on storage.objects for update to authenticated
  using (bucket_id in ('tenues', 'avatars', 'partenaires') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('tenues', 'avatars', 'partenaires') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "suppression dossier personnel" on storage.objects for delete to authenticated
  using (bucket_id in ('tenues', 'avatars', 'partenaires') and (storage.foldername(name))[1] = auth.uid()::text);

-- États des lieux et litiges : <reservation_id>/…, réservés aux parties et à l'admin.
create or replace function public.chemin_reservation_autorise(p_nom text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid;
begin
  begin
    v_id := (storage.foldername(p_nom))[1]::uuid;
  exception when others then
    return false;
  end;
  return est_partie_reservation(v_id) or est_admin();
end $$;
grant execute on function public.chemin_reservation_autorise(text) to authenticated;

create policy "lecture photos reservation" on storage.objects for select to authenticated
  using (bucket_id in ('etats-des-lieux', 'litiges') and public.chemin_reservation_autorise(name));
create policy "ecriture photos reservation" on storage.objects for insert to authenticated
  with check (bucket_id in ('etats-des-lieux', 'litiges') and public.chemin_reservation_autorise(name));
