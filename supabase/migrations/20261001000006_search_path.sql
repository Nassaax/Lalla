-- LALLA — 006 : search_path figé sur toutes les fonctions (recommandation de l'audit Supabase)
-- Ne change pas le rôle d'exécution : est_serveur() reste « security invoker ».
alter function public.maj_updated_at() set search_path = public, extensions;
alter function public.profils_proteger() set search_path = public, extensions;
alter function public.profils_prives_proteger() set search_path = public, extensions;
alter function public.avis_limiter() set search_path = public, extensions;
alter function public.partenaires_controler() set search_path = public, extensions;
alter function public.tenues_controler() set search_path = public, extensions;
alter function public.tenue_photos_controler() set search_path = public, extensions;
alter function public.ensembles_controler() set search_path = public, extensions;
alter function public.blocages_controler() set search_path = public, extensions;
alter function public.edl_controler() set search_path = public, extensions;
alter function public.leads_controler() set search_path = public, extensions;
alter function public.showroom_inscriptions_controler() set search_path = public, extensions;
alter function public.est_serveur() set search_path = public, extensions;
alter function public.param_int(text, integer) set search_path = public, extensions;
alter function public.exiger_frequence(text, integer, integer) set search_path = public, extensions;
