// Réservations factices en mémoire pour la démo locale (même interface que l'adaptateur api).
// Règles de départ = celles de Projets/coaching-domicile/reservation/regles.json.
import { ErreurData } from './erreurs.js'

export const REGLES_PAR_DEFAUT = {
  fuseau: 'Europe/Paris', dureeMin: 60, pasMin: 30, tamponMin: 30, delaiMinHeures: 24, horizonJours: 21, maxParJour: 3,
  plages: { lun: [['09:00', '19:00']], mar: [['09:00', '19:00']], mer: [['09:00', '19:00']], jeu: [['09:00', '19:00']], ven: [['09:00', '19:00']], sam: [['09:00', '13:00']], dim: [] },
  fermetures: []
}

const JOUR = 86400000
const HEURE = 3600000
const iso = (ms) => new Date(ms).toISOString()

// Jeu d'essai relatif à `now` : 4 à venir, 2 passées, 2 annulées ; 2 blocages.
function jeuDeDonnees(now) {
  const base = Math.floor(now / JOUR) * JOUR + 9 * HEURE // 9 h UTC du jour courant
  const r = (id, jours, h, prenom, nom, commune, adresse, telephone, email, statut) => ({
    id, debut: iso(base + jours * JOUR + (h - 9) * HEURE), fin: iso(base + jours * JOUR + (h - 8) * HEURE),
    prenom, nom, commune, adresse, telephone, email, statut
  })
  return {
    reservations: [
      r('rs-1', 2, 10, 'Camille', 'MARTIN', 'Tours', '12 rue des Lilas', '0612345678', 'camille.martin@exemple.fr', 'a_venir'),
      r('rs-2', 3, 14, 'Julien', 'BERNARD', 'Joué-lès-Tours', '4 allée du Parc', '0623456789', 'julien.bernard@exemple.fr', 'a_venir'),
      r('rs-3', 5, 9, 'Sophie', 'DUPONT', 'Saint-Cyr-sur-Loire', '25 avenue de la Gare', '0634567890', 'sophie.dupont@exemple.fr', 'a_venir'),
      r('rs-4', 8, 17, 'Marc', 'LEROY', 'Tours', '8 place Jean-Jaurès', '0645678901', 'marc.leroy@exemple.fr', 'a_venir'),
      r('rs-5', -3, 11, 'Inès', 'PETIT', 'Tours', '3 rue Colbert', '0656789012', 'ines.petit@exemple.fr', 'passee'),
      r('rs-6', -9, 16, 'Paul', 'ROUX', 'Chambray-lès-Tours', '17 rue du Moulin', '0667890123', 'paul.roux@exemple.fr', 'passee'),
      r('rs-7', 4, 15, 'Emma', 'FABRE', 'Tours', '9 rue Nationale', '0678901234', 'emma.fabre@exemple.fr', 'annulee'),
      r('rs-8', -1, 18, 'Hugo', 'MOREAU', 'Tours', '21 boulevard Béranger', '0689012345', 'hugo.moreau@exemple.fr', 'annulee')
    ],
    blocages: [
      { id: 'bl-1', debut: iso(base + 6 * JOUR), fin: iso(base + 6 * JOUR + 10 * HEURE), motif: 'Journée de formation' },
      { id: 'bl-2', debut: iso(base + 10 * JOUR + 3 * HEURE), fin: iso(base + 10 * JOUR + 5 * HEURE), motif: 'Rendez-vous médical' }
    ]
  }
}

const STATUTS = ['a_venir', 'passees', 'annulees']
const STATUT_DE = { a_venir: 'a_venir', passees: 'passee', annulees: 'annulee' }

export function creerReservationsDemo({ now = () => Date.now(), uuid = () => globalThis.crypto.randomUUID() } = {}) {
  const etat = jeuDeDonnees(now())
  let regles = structuredClone(REGLES_PAR_DEFAUT)
  const copie = (x) => structuredClone(x)
  return {
    async liste(statut = 'a_venir') {
      if (!STATUTS.includes(statut)) throw new ErreurData('VALIDATION', 'Statut inconnu')
      return copie(etat.reservations.filter((r) => r.statut === STATUT_DE[statut]).sort((a, b) => (statut === 'a_venir' ? a.debut.localeCompare(b.debut) : b.debut.localeCompare(a.debut))))
    },
    async annuler(id) {
      const r = etat.reservations.find((x) => x.id === id)
      if (!r) throw new ErreurData('INTROUVABLE', 'Réservation introuvable')
      if (r.statut !== 'a_venir') throw new ErreurData('VALIDATION', 'Seule une réservation à venir peut être annulée')
      r.statut = 'annulee'
    },
    async blocages() {
      return copie([...etat.blocages].sort((a, b) => a.debut.localeCompare(b.debut)))
    },
    async bloquer(debut, fin, motif = '') {
      if (Number.isNaN(Date.parse(debut)) || Number.isNaN(Date.parse(fin)) || Date.parse(fin) <= Date.parse(debut)) throw new ErreurData('VALIDATION', 'Dates de blocage invalides')
      const b = { id: uuid(), debut, fin, motif: String(motif).slice(0, 200) }
      etat.blocages.push(b)
      return copie(b)
    },
    async debloquer(id) {
      if (!etat.blocages.some((b) => b.id === id)) throw new ErreurData('INTROUVABLE', 'Blocage introuvable')
      etat.blocages = etat.blocages.filter((b) => b.id !== id)
    },
    async regles() {
      return copie(regles)
    },
    async ecrireRegles(nouvelles) {
      if (!nouvelles || typeof nouvelles !== 'object' || !nouvelles.plages || !(nouvelles.dureeMin > 0)) throw new ErreurData('VALIDATION', 'Règles invalides')
      regles = copie(nouvelles)
      return copie(regles)
    }
  }
}
