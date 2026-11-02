-- Corentin Delmée Coaching — schéma SQLite du serveur (VPS). Traduction de supabase/schema.sql
-- (+ tables agenda de supabase/migrations/20261026_agenda_google.sql, + table `comptes`).
-- Mêmes colonnes ; uuid -> TEXT, jsonb -> TEXT (JSON), boolean -> INTEGER 0/1.
-- Les règles d'accès (policies RLS) sont appliquées par le serveur : serveur/src/acces.js.
-- Appliqué par serveur/src/magasin-sqlite.js (migration n° 1, PRAGMA user_version).

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('coach', 'client')),
  identifiant TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  tarif REAL,
  lieu_defaut TEXT CHECK (lieu_defaut IN ('domicile', 'salle')),
  modules TEXT,
  archive INTEGER NOT NULL DEFAULT 0,
  preferences TEXT,
  consentement_le INTEGER,
  cree_le INTEGER NOT NULL
);

-- Comptes de connexion (remplacent auth.users de Supabase). identifiant en minuscules, hash scrypt « sel:hash ».
-- sv = version de session : +1 révoque tous les cookies du compte.
CREATE TABLE IF NOT EXISTS comptes (
  identifiant TEXT PRIMARY KEY CHECK (identifiant = lower(identifiant)),
  hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('coach', 'client')),
  profil_id TEXT NOT NULL UNIQUE REFERENCES profiles (id) ON DELETE CASCADE,
  sv INTEGER NOT NULL DEFAULT 0,
  archive INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exercices (id TEXT PRIMARY KEY, client_id TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workouts (id TEXT PRIMARY KEY, client_id TEXT REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS programmes (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS realisations (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS templates_client (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS seances_coaching (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mots_du_coach (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS questionnaires (id TEXT PRIMARY KEY, client_id TEXT REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reponses (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mesures (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS douleurs (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS entrees_nutrition (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS alertes_vues (id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE, data TEXT NOT NULL);

CREATE INDEX IF NOT EXISTS realisations_client ON realisations (client_id);
CREATE INDEX IF NOT EXISTS reponses_client ON reponses (client_id);
CREATE INDEX IF NOT EXISTS seances_coaching_client ON seances_coaching (client_id);

-- Agenda (rempli par la synchronisation du soir ; l'app le lit seulement).
CREATE TABLE IF NOT EXISTS seances_agenda (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES profiles (id) ON DELETE CASCADE,
  statut_attribution TEXT NOT NULL CHECK (statut_attribution IN ('attribue', 'inconnu', 'ambigu', 'sans-nom')),
  data TEXT NOT NULL,
  maj INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS seances_agenda_client ON seances_agenda (client_id);
CREATE TABLE IF NOT EXISTS agenda_synchro (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  derniere_synchro INTEGER,
  bilan TEXT
);
INSERT OR IGNORE INTO agenda_synchro (id) VALUES (1);
