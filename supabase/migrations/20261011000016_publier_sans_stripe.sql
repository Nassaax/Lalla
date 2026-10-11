-- Publication sans compte de versement : pendant le prélancement, une fournisseuse peut publier ses annonces
-- avant d'avoir configuré Stripe. Le compte de versement reste exigé avant toute réservation
-- (commande-creer refuse une fournisseuse dont stripe_onboarding_complet est faux), donc avant tout paiement.
-- Seul changement par rapport à 20261006000013 : le contrôle « stripe_requis » est retiré.

-- Contrôle des annonces : photos adaptées à l'univers, relecture si les critères changent
create or replace function tenues_controler() returns trigger
language plpgsql set search_path = public, extensions as $$
declare
  v_types type_photo[];
begin
  new.updated_at := now();
  if est_serveur() or est_admin() then
    if tg_op = 'UPDATE' and new.statut = 'validee' and old.statut is distinct from 'validee' then
      new.validee_at := now();
      new.motif_refus := null;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform exiger_frequence('tenue_creer', 40, 3600);
    if new.fournisseuse_id is distinct from auth.uid() then
      raise exception 'Annonce : propriétaire invalide.' using errcode = '42501';
    end if;
    new.nb_locations := 0;
    new.validee_at := null;
    new.motif_refus := null;
    if new.statut not in ('brouillon') then
      new.statut := 'brouillon';
    end if;
    return new;
  end if;

  -- UPDATE par la propriétaire
  if new.fournisseuse_id is distinct from old.fournisseuse_id
     or new.nb_locations is distinct from old.nb_locations
     or new.validee_at is distinct from old.validee_at
     or new.motif_refus is distinct from old.motif_refus then
    raise exception 'Champ protégé.' using errcode = '42501';
  end if;

  if new.statut is distinct from old.statut then
    if new.statut in ('validee', 'refusee') then
      raise exception 'Seule l''équipe peut valider une annonce.' using errcode = '42501';
    end if;
    if new.statut = 'en_attente' then
      select array_agg(distinct type) into v_types from tenue_photos where tenue_id = new.id;
      if new.univers <> 'tenue' then
        -- Matériel et prestations : une photo principale suffit
        if not (coalesce(v_types, '{}') @> array['face']::type_photo[]) then
          raise exception 'Photo principale manquante.' using errcode = 'P0001', hint = 'photos_requises';
        end if;
      elsif new.categorie = 'accessoire' then
        if not (coalesce(v_types, '{}') @> array['face', 'portee']::type_photo[]) then
          raise exception 'Photos obligatoires manquantes.' using errcode = 'P0001', hint = 'photos_requises';
        end if;
      elsif not (coalesce(v_types, '{}') @> array['face', 'dos', 'broderie', 'portee']::type_photo[]) then
        raise exception 'Photos obligatoires manquantes.' using errcode = 'P0001', hint = 'photos_requises';
      end if;
      new.soumise_at := now();
    end if;
  elsif old.statut = 'validee' and (
      new.titre is distinct from old.titre
      or new.description is distinct from old.description
      or new.categorie is distinct from old.categorie
      or new.attributs is distinct from old.attributs) then
    -- Une modification de fond d'une annonce publiée repasse en relecture.
    new.statut := 'en_attente';
    new.soumise_at := now();
  end if;
  return new;
end $$;
