-- Migration : synchronisation Google Agenda -> séances de coaching.
-- À exécuter UNE fois (SQL Editor de Supabase) après schema.sql. Voir docs/GOOGLE-AGENDA.md.
-- Le jeton OAuth Google est CHIFFRÉ dans le Vault Supabase (extension supabase_vault) ; seules deux fonctions SQL réservées à la clé « service »
-- (lire/ecrire_refresh_token_google) y accèdent. Les autres données serveur vivent dans des tables en RLS SANS aucune policy.

-- Séances venues de Google Agenda (une ligne par événement « Coaching … » connu).
create table seances_agenda (
  id text primary key,                          -- identifiant d'événement Google
  client_id uuid references profiles (id) on delete cascade,  -- null tant que non attribué (inconnu / ambigu / sans nom) ; effacer un client efface ses séances (RGPD)
  statut_attribution text not null check (statut_attribution in ('attribue', 'inconnu', 'ambigu', 'sans-nom')),
  data jsonb not null,                          -- champs minimaux seulement (titre, début, fin, lieu, etag, updated) : jamais description ni invités
  maj timestamptz not null default now()
);
create index on seances_agenda (client_id);

-- Identifiants courts pour départager des homonymes : « Coaching Marc Dupont #md2 » -> tag 'md2'.
create table agenda_alias (
  tag text primary key check (tag = lower(tag) and tag ~ '^[a-z0-9_]+$'),
  client_id uuid not null references profiles (id) on delete cascade
);

-- Dernière synchro (lisible par le coach pour le panneau « Agenda Google »).
create table agenda_synchro (
  id int primary key check (id = 1),
  derniere_synchro timestamptz,
  bilan jsonb
);
insert into agenda_synchro (id) values (1);

-- Secrets et jetons de synchro : serveur uniquement.
create table google_agenda_secret (
  id int primary key check (id = 1),
  sync_token text,           -- syncToken incrémental de l'API Calendar
  canal jsonb                -- notification push (events.watch) : { id, resourceId, expiration }
);
insert into google_agenda_secret (id) values (1);

-- Demandes de connexion OAuth en cours (nonce à usage unique + code_verifier PKCE) : serveur uniquement, expirent en 10 minutes.
create table google_agenda_oauth (
  nonce text primary key,
  verifier text not null,
  expire timestamptz not null
);
alter table google_agenda_oauth enable row level security;   -- aucune policy

-- Jeton de rafraîchissement dans le Vault (chiffré au repos). Accès via ces deux fonctions, réservées à la clé « service ».
create extension if not exists supabase_vault cascade;

create function lire_refresh_token_google() returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'google_agenda_refresh_token'
$$;

create function ecrire_refresh_token_google(jeton text) returns void
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  select id into v from vault.secrets where name = 'google_agenda_refresh_token';
  if v is null then perform vault.create_secret(jeton, 'google_agenda_refresh_token', 'Jeton de rafraîchissement Google Agenda (coach)');
  else perform vault.update_secret(v, jeton);
  end if;
end $$;

revoke all on function lire_refresh_token_google() from public, anon, authenticated;
revoke all on function ecrire_refresh_token_google(text) from public, anon, authenticated;
grant execute on function lire_refresh_token_google() to service_role;
grant execute on function ecrire_refresh_token_google(text) to service_role;

alter table seances_agenda enable row level security;
alter table agenda_alias enable row level security;
alter table agenda_synchro enable row level security;
alter table google_agenda_secret enable row level security;   -- aucune policy : personne via l'API publique

-- Un client ne voit que SES séances attribuées ; le coach voit tout (y compris les alertes).
create policy seances_agenda_client on seances_agenda for select to authenticated
  using (client_id = auth.uid() and statut_attribution = 'attribue' and est_actif());
create policy seances_agenda_coach on seances_agenda for select to authenticated using (is_coach());
create policy agenda_alias_coach on agenda_alias for all to authenticated using (is_coach()) with check (is_coach());
create policy agenda_synchro_coach on agenda_synchro for select to authenticated using (is_coach());
-- Aucune policy d'écriture sur seances_agenda / agenda_synchro : seule l'Edge Function (clé service) écrit.
