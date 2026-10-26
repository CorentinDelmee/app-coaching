-- Migration : synchronisation Google Agenda -> séances de coaching.
-- À exécuter UNE fois (SQL Editor de Supabase) après schema.sql. Voir docs/GOOGLE-AGENDA.md.
-- Le jeton OAuth Google vit uniquement dans google_agenda_secret (lisible par la clé « service » de l'Edge Function,
-- jamais par un utilisateur connecté : RLS activée SANS aucune policy).

-- Séances venues de Google Agenda (une ligne par événement « Coaching … » connu).
create table seances_agenda (
  id text primary key,                          -- identifiant d'événement Google
  client_id uuid references profiles (id) on delete set null,  -- null tant que non attribué (inconnu / ambigu / sans nom)
  statut_attribution text not null check (statut_attribution in ('attribue', 'inconnu', 'ambigu', 'sans-nom')),
  data jsonb not null,                          -- événement lu : titre, date, heure, lieu, etag, updated, debutMs…
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
  refresh_token text,        -- jeton de rafraîchissement OAuth du coach
  sync_token text,           -- syncToken incrémental de l'API Calendar
  canal jsonb                -- notification push (events.watch) : { id, resourceId, expiration }
);
insert into google_agenda_secret (id) values (1);

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
