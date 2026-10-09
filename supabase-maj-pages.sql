-- À exécuter UNE FOIS dans Supabase (SQL Editor > New query > Run)
-- Autorise les vidéos YouTube ET les textes modifiables des pages (accueil, historique)
alter table public.items drop constraint if exists items_type_check;
alter table public.items add constraint items_type_check
  check (type in ('pdf','photo','audio','event','video','page'));
