-- =====================================================
-- Dahira Miftahoul Khayri — à coller dans Supabase :
-- SQL Editor > New query > Run
-- =====================================================

-- Contenus du site (PDF, photos, audios, événements)
create table if not exists public.items (
  id          text primary key,
  type        text not null check (type in ('pdf','photo','audio','event','video','page')),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Messages du formulaire de contact
create table if not exists public.messages (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  lu          boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Sécurité : personne ne peut lire/écrire depuis l'extérieur.
-- Seul le serveur (clé service_role) a accès.
alter table public.items    enable row level security;
alter table public.messages enable row level security;

-- Bucket public pour les fichiers (PDF, photos, audios)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Les 3 documents Xam sa diné (sans fichier pour l'instant)
insert into public.items (id, type, data) values
  ('pdf-1','pdf','{"title":"Tazawoudou Sikhar","filename":null}'),
  ('pdf-2','pdf','{"title":"Massalikoul Jinane","filename":null}'),
  ('pdf-3','pdf','{"title":"Tazawoudou Choubane","filename":null}')
on conflict (id) do nothing;
