-- Hub des fêtes : nouvelles catégories d'annonces (matériel et prestations).
-- Fichier séparé : une valeur d'énumération ajoutée ne peut être utilisée qu'après validation de la transaction.
alter type categorie_tenue add value if not exists 'sono';
alter type categorie_tenue add value if not exists 'eclairage';
alter type categorie_tenue add value if not exists 'decoration';
alter type categorie_tenue add value if not exists 'mobilier';
alter type categorie_tenue add value if not exists 'vaisselle';
alter type categorie_tenue add value if not exists 'maquillage';
alter type categorie_tenue add value if not exists 'coiffure';
alter type categorie_tenue add value if not exists 'photographie';
alter type categorie_tenue add value if not exists 'videographie';
alter type categorie_tenue add value if not exists 'henne';
alter type categorie_tenue add value if not exists 'negafa';
alter type categorie_tenue add value if not exists 'dj';
alter type categorie_tenue add value if not exists 'traiteur';
alter type categorie_tenue add value if not exists 'patisserie';
alter type type_fournisseuse add value if not exists 'prestataire';
alter type type_fournisseuse add value if not exists 'loueur';
