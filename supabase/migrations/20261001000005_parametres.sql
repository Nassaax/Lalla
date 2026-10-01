-- LALLA — 005 : paramètres métier par défaut (modifiables depuis admin.html)
insert into parametres (cle, valeur, description) values
  ('commission_taux', '0.15', 'Commission plateforme prélevée sur le prix de location (0.15 = 15 %)'),
  ('frais_service_taux', '0.05', 'Frais de service ajoutés au panier de la cliente (0.05 = 5 %)'),
  ('frais_pressing_cents', '1500', 'Frais de pressing fixes par tenue, reversés à la fournisseuse (centimes)'),
  ('frais_essayage_cents', '1500', 'Frais d''essayage, déduits de la location si la cliente réserve (centimes)'),
  ('essayage_validite_jours', '30', 'Délai pendant lequel les frais d''essayage sont déductibles'),
  ('caution_taux', '0.5', 'Caution = valeur déclarée × taux'),
  ('pressing_jours', '2', 'Jours bloqués avant et après chaque location pour le pressing'),
  ('delai_reponse_heures', '24', 'Délai de réponse de la fournisseuse avant annulation automatique'),
  ('delai_litige_heures', '48', 'Fenêtre d''ouverture d''un litige après le retour'),
  ('delai_versement_heures', '24', 'Délai entre le retour confirmé et le versement'),
  ('seuil_identity_cents', '50000', 'Caution totale au-delà de laquelle la vérification d''identité est exigée (centimes)'),
  ('empreinte_jours_avant', '2', 'Création de l''empreinte de caution X jours avant la remise'),
  ('seuil_setup_jours', '5', 'Au-delà de ce délai, la carte est enregistrée et l''empreinte créée plus tard'),
  ('politique_annulation', '[{"jours_min":30,"pct":100},{"jours_min":14,"pct":50},{"jours_min":0,"pct":0}]',
     'Remboursement de la location selon le nombre de jours avant l''événement'),
  ('penalite_fournisseuse_cents', '2500', 'Pénalité si une fournisseuse annule après acceptation (centimes)'),
  ('penalite_visibilite_points', '15', 'Baisse du score de visibilité après une annulation fournisseuse')
on conflict (cle) do nothing;
