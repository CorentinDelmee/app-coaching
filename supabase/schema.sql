-- Corentin Delmée Coaching — schéma Supabase + règles RLS.
-- À exécuter UNE fois, en entier, dans l'éditeur SQL de Supabase (région UE).
-- Ordre : tables -> fonctions is_coach()/est_actif() -> RLS activée -> policies -> storage.
-- Principe : un client ne lit / n'écrit que les lignes où client_id = auth.uid() ;
-- le coach lit / écrit tout ; le client ne peut modifier ni son rôle, ni son tarif, ni ses modules.

-- ============================================================ TABLES

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('coach', 'client')),
  identifiant text not null unique,
  nom text not null,
  tarif numeric,
  lieu_defaut text check (lieu_defaut in ('domicile', 'salle')),
  modules jsonb,
  archive boolean not null default false,
  preferences jsonb,
  consentement_le bigint,
  cree_le bigint not null
);

-- Bibliothèque d'exercices (commune).
create table exercices (
  id text primary key,
  client_id uuid,
  data jsonb not null
);

-- Les autres tables stockent l'objet complet dans `data` ; client_id sert aux règles d'accès.
create table workouts (
  id text primary key,
  client_id uuid references profiles (id) on delete cascade, -- null = modèle du coach
  data jsonb not null
);
create table programmes (
  id text primary key,
  client_id uuid not null references profiles (id) on delete cascade,
  data jsonb not null
);
create table realisations (
  id text primary key,
  client_id uuid not null references profiles (id) on delete cascade,
  data jsonb not null
);
create table templates_client (
  id text primary key,
  client_id uuid not null references profiles (id) on delete cascade, -- id = client_id (un template par client)
  data jsonb not null
);
create table seances_coaching (
  id text primary key,
  client_id uuid not null references profiles (id) on delete cascade,
  data jsonb not null
);
create table mots_du_coach (
  id text primary key,
  client_id uuid not null references profiles (id) on delete cascade,
  data jsonb not null
);
create table questionnaires (
  id text primary key,
  client_id uuid references profiles (id) on delete cascade, -- null = questionnaire par défaut pour tous
  data jsonb not null
);
create table reponses (
  id text primary key,
  client_id uuid not null references profiles (id) on delete cascade,
  data jsonb not null
);
create table mesures (
  id text primary key,
  client_id uuid not null references profiles (id) on delete cascade,
  data jsonb not null
);
create table douleurs (
  id text primary key,
  client_id uuid not null references profiles (id) on delete cascade,
  data jsonb not null
);
create table entrees_nutrition (
  id text primary key,
  client_id uuid not null references profiles (id) on delete cascade,
  data jsonb not null
);
create table alertes_vues (
  id text primary key,
  client_id uuid not null references profiles (id) on delete cascade,
  data jsonb not null
);

create index on realisations (client_id);
create index on reponses (client_id);
create index on seances_coaching (client_id);

-- ============================================================ FONCTION D'AIDE

-- security definer : lit profiles sans repasser par la RLS (évite une récursion infinie).
-- search_path fixé (public, pg_temp) pour qu'aucun objet d'un autre schéma ne se fasse passer pour une table.
create function is_coach() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'coach' and not archive);
$$;

-- Compte actif = profil existant et non archivé. Un client archivé perd tout accès par l'API (audit I1) :
-- son compte Auth reste valide, mais les policies ci-dessous ne lui renvoient plus rien.
create function est_actif() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from profiles where id = auth.uid() and not archive);
$$;

-- Ces fonctions ne servent qu'aux utilisateurs connectés (audit M1) : retirées de anon/public.
revoke execute on function is_coach() from public, anon;
revoke execute on function est_actif() from public, anon;
grant execute on function is_coach() to authenticated;
grant execute on function est_actif() to authenticated;

-- Un client ne peut changer ni son rôle, ni son identifiant, ni son tarif, ni son lieu, ni ses modules, ni l'archivage.
create function proteger_profil() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Seul un utilisateur connecté (auth.uid() non nul) est bridé : l'éditeur SQL et la clé service (uid nul) peuvent tout modifier.
  if auth.uid() is not null and not is_coach() then
    new.role := old.role;
    new.identifiant := old.identifiant;
    new.tarif := old.tarif;
    new.lieu_defaut := old.lieu_defaut;
    new.modules := old.modules;
    new.archive := old.archive;
    new.cree_le := old.cree_le;
  end if;
  return new;
end;
$$;

create trigger profiles_protection before update on profiles
  for each row execute function proteger_profil();

-- ============================================================ RLS ACTIVÉE PARTOUT

alter table profiles enable row level security;
alter table exercices enable row level security;
alter table workouts enable row level security;
alter table programmes enable row level security;
alter table realisations enable row level security;
alter table templates_client enable row level security;
alter table seances_coaching enable row level security;
alter table mots_du_coach enable row level security;
alter table questionnaires enable row level security;
alter table reponses enable row level security;
alter table mesures enable row level security;
alter table douleurs enable row level security;
alter table entrees_nutrition enable row level security;
alter table alertes_vues enable row level security;

-- ============================================================ POLICIES

-- profiles : chacun lit SON profil (un client ne voit jamais les autres) ; le coach lit tout et crée les clients.
create policy profiles_lecture on profiles for select to authenticated
  using ((id = auth.uid()) or is_coach());   -- un archivé lit encore son profil (l'app lui refuse la connexion)
create policy profiles_modif_soi on profiles for update to authenticated
  using (id = auth.uid() and est_actif()) with check (id = auth.uid() and est_actif());              -- colonnes sensibles protégées par le trigger
create policy profiles_coach_ecriture on profiles for all to authenticated
  using (is_coach()) with check (is_coach());

-- exercices : lisibles par tous les connectés, modifiables par le coach seul.
create policy exercices_lecture on exercices for select to authenticated using (est_actif() or is_coach());
create policy exercices_coach on exercices for all to authenticated
  using (is_coach()) with check (is_coach());

-- Lecture seule pour le client, écriture coach : workouts, programmes, séances de coaching, mots du coach.
create policy workouts_client_lecture on workouts for select to authenticated using (client_id = auth.uid() and est_actif());
create policy workouts_coach on workouts for all to authenticated using (is_coach()) with check (is_coach());

create policy programmes_client_lecture on programmes for select to authenticated using (client_id = auth.uid() and est_actif());
create policy programmes_coach on programmes for all to authenticated using (is_coach()) with check (is_coach());

create policy seances_client_lecture on seances_coaching for select to authenticated using (client_id = auth.uid() and est_actif());
create policy seances_coach on seances_coaching for all to authenticated using (is_coach()) with check (is_coach());

create policy mots_client_lecture on mots_du_coach for select to authenticated using (client_id = auth.uid() and est_actif());
create policy mots_coach on mots_du_coach for all to authenticated using (is_coach()) with check (is_coach());

-- questionnaires : modèles par défaut (client_id null) lisibles par tous, ou assignés au client.
create policy questionnaires_lecture on questionnaires for select to authenticated
  using (((client_id is null or client_id = auth.uid()) and est_actif()) or is_coach());
create policy questionnaires_coach on questionnaires for all to authenticated using (is_coach()) with check (is_coach());

-- Lecture + écriture par le client sur SES lignes, et par le coach : séances faites, templates, réponses, mesures, douleurs, nutrition.
create policy realisations_client on realisations for all to authenticated
  using (client_id = auth.uid() and est_actif()) with check (client_id = auth.uid() and est_actif());
create policy realisations_coach on realisations for all to authenticated using (is_coach()) with check (is_coach());

create policy templates_client_rw on templates_client for all to authenticated
  using (client_id = auth.uid() and est_actif()) with check (client_id = auth.uid() and est_actif());
create policy templates_coach on templates_client for all to authenticated using (is_coach()) with check (is_coach());

create policy reponses_client on reponses for all to authenticated
  using (client_id = auth.uid() and est_actif()) with check (client_id = auth.uid() and est_actif());
create policy reponses_coach on reponses for all to authenticated using (is_coach()) with check (is_coach());

create policy mesures_client on mesures for all to authenticated
  using (client_id = auth.uid() and est_actif()) with check (client_id = auth.uid() and est_actif());
create policy mesures_coach on mesures for all to authenticated using (is_coach()) with check (is_coach());

create policy douleurs_client on douleurs for all to authenticated
  using (client_id = auth.uid() and est_actif()) with check (client_id = auth.uid() and est_actif());
create policy douleurs_coach on douleurs for all to authenticated using (is_coach()) with check (is_coach());

create policy nutrition_client on entrees_nutrition for all to authenticated
  using (client_id = auth.uid() and est_actif()) with check (client_id = auth.uid() and est_actif());
create policy nutrition_coach on entrees_nutrition for all to authenticated using (is_coach()) with check (is_coach());

-- alertes_vues : réservé au coach.
create policy alertes_coach on alertes_vues for all to authenticated using (is_coach()) with check (is_coach());

-- ============================================================ STORAGE (photos de repas / bilan)

-- Bucket privé. Chemin attendu : <client_id>/<fichier>. Un client n'accède qu'à son dossier ; le coach à tout.
-- Limite 2 Mo et types d'image seulement (audit M7) ; les photos sont réduites côté client (canvas) avant envoi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;

create policy photos_client_lecture on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and est_actif());
create policy photos_client_ecriture on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and est_actif());
create policy photos_client_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and est_actif());
create policy photos_coach on storage.objects for all to authenticated
  using (bucket_id = 'photos' and is_coach()) with check (bucket_id = 'photos' and is_coach());
