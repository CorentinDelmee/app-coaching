<script setup>
// « Aujourd'hui » : accueil du coach (Studio d3). La journée sur une frise (moment fort : le curseur « maintenant »
// glisse jusqu'à l'heure actuelle et les rendez-vous se posent), les alertes, les clients à relancer,
// les check-ins du jour, les prochaines réservations du site et les accès rapides. Données : uniquement src/data.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import data, { lectureRapide } from '../../../../data/index.js'
import { jourLocal } from '../../../../domain/dates.js'
import { etat, maintenant, messageErreur, rafraichir } from '../../../store.js'
import IconeSt from '../../IconeSt.vue'
import Puce from '../../Puce.vue'
import ListeAlertes from './ListeAlertes.vue'
import { memoireForme, tranche } from './forme.js'
import { avatarClient } from '../../avatar.js'
import {
  aRelancer, checkinsDuJour, dateDuJour, frise, heureCourte, libelleJour, prenomDe, prochainsJours, programmeDuJour, rendezVous, resumeJour, salutation
} from './journee.js'
import '../../tokens.css'
import './aujourdhui.css'

const statut = ref('chargement') // chargement | pret | erreur
const erreur = ref('')
const avertissements = ref([]) // sources injoignables (agenda, réservations) : le reste s'affiche quand même
const brut = ref({ seances: [], evenements: [], reservations: [], questionnaires: [], reponses: [], coach: null, aValider: 0 })
const horloge = ref(maintenant())
const jour = computed(() => jourLocal(horloge.value))
const minutes = computed(() => { const d = new Date(horloge.value); return d.getHours() * 60 + d.getMinutes() })

const tous = computed(() => rendezVous({ ...brut.value, clients: etat.clients }))
const items = computed(() => programmeDuJour(tous.value, jour.value, minutes.value))
const ensuite = computed(() => prochainsJours(tous.value, jour.value, { max: items.value.length ? 3 : 5 }))
const laFrise = computed(() => frise(items.value, minutes.value))
const relances = computed(() => aRelancer({ clients: etat.clients, questionnaires: brut.value.questionnaires, reponses: brut.value.reponses, tous: tous.value, seances: brut.value.seances, jour: jour.value }))
const checkins = computed(() => checkinsDuJour({ reponses: brut.value.reponses, clients: etat.clients, jour: jour.value }))
const resas = computed(() => tous.value.filter((r) => r.source === 'site' && r.date >= jour.value).slice(0, 3))
const prenomCoach = computed(() => prenomDe(brut.value.coach?.nom) || 'coach')
const LIB_ETAT = { passe: 'passé', 'en-cours': 'en cours', prochain: 'prochain' }

// Curseur « maintenant » : part de la gauche puis glisse (transform seul) ; rendez-vous posés en cascade.
const curseurPose = ref(false)

// Forme de la dernière visite : dimensionne le squelette (hauteurs des zones, nombre de lignes) pour qu'il n'y ait aucun saut.
const forme = memoireForme.lire(tranche(window.innerWidth))
const zoneH = (k) => (statut.value === 'pret' || !forme.h[k] ? undefined : { minHeight: forme.h[k] + 'px' })
const zJour = ref(null); const zAlertes = ref(null); const zRelances = ref(null); const zCheckins = ref(null); const zResas = ref(null)
const elTitre = ref(null); const elResume = ref(null)
const plusDe5 = computed(() => (statut.value === 'pret' ? etat.alertes.length : forme.n.alertes) > 5)

function noterForme() {
  if (statut.value !== 'pret') return
  const h = (r) => r.value?.offsetHeight
  memoireForme.noter(tranche(window.innerWidth), {
    n: { items: items.value.length, alertes: etat.alertes.length, relances: Math.min(relances.value.length, 5), checkins: checkins.value.length, resas: resas.value.length },
    h: { titre: h(elTitre), resume: h(elResume), jour: h(zJour), alertes: h(zAlertes), relances: h(zRelances), checkins: h(zCheckins), resas: h(zResas) }
  })
}

// Un seul appliquer pour le cache et pour la lecture fraîche : l'écran se met à jour en place, sans rejouer d'animation.
function appliquer(v, { depuisCache }) {
  avertissements.value = v.avertissements
  brut.value = v.brut
  if (depuisCache) statut.value = 'pret'
}

// Lectures du tableau de bord : en parallèle, jamais en série (un aller-retour chacune). Une source injoignable n'est pas fatale.
async function lire() {
  const [seances, agenda, reservations, questionnaires, reponses, coach, aValider] = await Promise.allSettled([
    data.seancesCoaching.lister(),
    data.agenda.etat(),
    data.reservations ? data.reservations.liste('a_venir') : Promise.resolve([]),
    data.questionnaires.lister(),
    data.reponses.lister(),
    data.utilisateurCourant(),
    // Vidéos proposées par Claude (lot exercices enrichis) : seulement si la fonction existe déjà.
    data.exercices.recherche ? data.exercices.recherche({ video: 'propose', limite: 1 }).then((r) => r.total || 0) : Promise.resolve(0)
  ])
  const ok = (r, defaut) => (r.status === 'fulfilled' ? r.value : defaut)
  const avert = []
  if (agenda.status === 'rejected') avert.push('L’agenda Google ne répond pas : ses séances n’apparaissent pas.')
  if (reservations.status === 'rejected') avert.push('Le service de réservation ne répond pas : les réservations du site n’apparaissent pas.')
  return {
    avertissements: avert,
    brut: {
      seances: ok(seances, []), evenements: ok(agenda, { evenements: [] }).evenements || [], reservations: ok(reservations, []),
      questionnaires: ok(questionnaires, []), reponses: ok(reponses, []), coach: ok(coach, null), aValider: ok(aValider, 0)
    }
  }
}

// Mêmes entités que rafraichir() (store) + celles de lire() : une écriture sur l'une d'elles invalide le cache de l'écran.
const ENTITES = ['profils', 'reponses', 'douleurs', 'realisations', 'alertesVues', 'agenda', 'seancesCoaching', 'reservations', 'questionnaires', 'exercices']

async function charger() {
  erreur.value = ''
  horloge.value = maintenant()
  try {
    // rafraichir() d'abord : son cache s'applique dans la même tâche que celui de l'écran (alertes et clients cohérents).
    await Promise.all([rafraichir(), lectureRapide('aujourdhui:dash', ENTITES, lire, appliquer)])
    statut.value = 'pret'
    // Le curseur « maintenant » glisse une seule fois par ouverture ; un rafraîchissement ne le rejoue pas.
    if (!curseurPose.value) requestAnimationFrame(() => requestAnimationFrame(() => { curseurPose.value = true }))
    nextTick(noterForme)
  } catch (e) {
    if (statut.value !== 'pret') { erreur.value = messageErreur(e); statut.value = 'erreur' }
  }
}

function reessayer() { statut.value = 'chargement'; charger() }

let minuteur = null
onMounted(() => {
  charger()
  minuteur = setInterval(() => { horloge.value = maintenant() }, 60000)
})
onBeforeUnmount(() => { clearInterval(minuteur); noterForme() })

const messageRelance = (r) => `Relancer ${r.nom} sur WhatsApp (${r.raison === 'questionnaire' ? 'questionnaire à remplir' : 'aucune séance prévue'})`
</script>

<template>
  <div class="st-auj">
    <header class="st-auj-entete">
      <div>
        <p class="st-auj-date">{{ dateDuJour(jour) }}</p>
        <h1 ref="elTitre" class="st-auj-titre" :style="statut === 'pret' || !forme.h.titre ? undefined : { minHeight: forme.h.titre + 'px' }">{{ salutation(minutes) }}{{ statut === 'pret' ? ' ' + prenomCoach : '' }}.</h1>
        <p ref="elResume" class="st-auj-resume" :class="{ 'st-auj-resume--sq': statut !== 'pret' }" :style="statut === 'pret' || !forme.h.resume ? undefined : { minHeight: forme.h.resume + 'px' }">{{ statut === 'pret' ? resumeJour(items, etat.alertes.length) : '\u00a0' }}</p>
      </div>
      <div class="st-auj-ctas">
        <RouterLink to="/coach/clients?rendezvous=1" class="st-btn st-btn--jaune st-auj-cta"><IconeSt nom="plus" /><span class="st-auj-lbl">Ajouter un rendez-vous</span></RouterLink>
        <RouterLink to="/coach/seances/nouveau" class="st-btn st-auj-cta2">Nouvelle séance</RouterLink>
      </div>
    </header>

    <!-- Erreur de chargement : rien n'est affiché à moitié -->
    <section v-if="statut === 'erreur'" class="st-bloc st-auj-erreur" role="alert">
      <h2 class="st-auj-h2">Impossible de charger ta journée</h2>
      <p>{{ erreur }}. Vérifie la connexion, puis réessaie.</p>
      <button type="button" class="st-btn st-btn--encre" @click="reessayer">Réessayer</button>
    </section>

    <div v-else class="st-auj-dash" :aria-busy="statut === 'chargement'">
      <p v-for="a in avertissements" :key="a" class="st-auj-avert" role="status">{{ a }}</p>

      <!-- Journée -->
      <section class="st-bloc st-auj-b st-auj-b--jour" style="--i: 0" aria-labelledby="st-auj-t-jour">
        <h2 id="st-auj-t-jour" class="st-auj-h2">Ta journée <RouterLink to="/coach/agenda" class="st-auj-voir">Agenda</RouterLink></h2>

        <div ref="zJour" :style="zoneH('jour')">
        <template v-if="statut === 'chargement'">
          <!-- Même frise que le contenu (piste grise, graduations vides) : rien ne bouge à l'arrivée -->
          <div class="st-auj-frise" aria-hidden="true"><div class="st-auj-piste" /><div class="st-auj-grad" /></div>
          <div class="st-auj-sq-liste"><div v-for="n in forme.n.items" :key="n" class="st-auj-squelette st-auj-squelette--seance" /></div>
          <p class="st-sr" role="status">Chargement de ta journée…</p>
        </template>

        <template v-else>
          <div class="st-auj-frise" :class="{ 'is-pose': curseurPose }" aria-hidden="true">
            <div class="st-auj-piste">
              <span v-for="(p, n) in laFrise.plots" :key="p.id" class="st-auj-plot" :class="`is-${p.etat}`" :style="{ left: p.x + '%', width: p.l + '%', '--n': n }" />
            </div>
            <div v-if="laFrise.maintenant !== null" class="st-auj-curseur" :style="{ transform: curseurPose ? `translateX(${laFrise.maintenant}%)` : 'translateX(0)' }"><i /></div>
            <div class="st-auj-grad"><span v-for="g in laFrise.graduations" :key="g.h" :style="{ left: g.x + '%' }">{{ g.h }} h</span></div>
          </div>

          <ol v-if="items.length" class="st-auj-timeline">
            <li v-for="(it, n) in items" :key="it.id" class="st-auj-seance" :class="`is-${it.etat}`" :data-m="avatarClient(it.clientId || it.id, it.titre).teinte" :style="{ '--n': n }">
              <time :datetime="`${it.date}T${it.heure || '00:00'}`">{{ it.heure ? heureCourte(it.heure) : 'Journée' }}<small v-if="LIB_ETAT[it.etat]">{{ LIB_ETAT[it.etat] }}</small></time>
              <span class="st-auj-barre" aria-hidden="true" />
              <div>
                <RouterLink :to="it.lien" class="st-auj-nom st-auj-lien-etendu">{{ it.titre }}</RouterLink>
                <small>{{ it.detail }}<template v-if="it.fin"> · jusqu’à {{ heureCourte(it.fin) }}</template></small>
              </div>
              <Puce v-if="it.source === 'site'" variante="propose">Site</Puce>
              <Puce v-else-if="it.source === 'google'" variante="neutre">Google</Puce>
            </li>
          </ol>
          <div v-else class="st-auj-vide">
            <p class="st-auj-vide-t">Rien de prévu aujourd’hui.</p>
            <p>Un bon moment pour préparer les séances de la semaine ou relancer un client.</p>
          </div>

          <div v-if="ensuite.length" class="st-auj-ensuite">
            <h3 class="st-auj-h3">{{ items.length ? 'Ensuite' : 'Prochains rendez-vous' }}</h3>
            <div v-for="g in ensuite" :key="g.date" class="st-auj-jour">
              <p class="st-auj-jour-t">{{ g.libelle }}</p>
              <RouterLink v-for="r in g.items" :key="r.id" :to="r.lien" class="st-auj-proche">
                <b>{{ r.heure ? heureCourte(r.heure) : 'Journée' }}</b><span>{{ r.titre }}</span><small>{{ r.detail }}</small>
              </RouterLink>
            </div>
          </div>
        </template>
        </div>
      </section>

      <!-- Alertes -->
      <section class="st-bloc st-auj-b st-auj-b--alertes" style="--i: 1" aria-labelledby="st-auj-t-alertes">
        <h2 id="st-auj-t-alertes" class="st-auj-h2" :class="{ 'st-auj-h2--lien': plusDe5 }">Alertes <span v-if="etat.alertes.length" class="st-auj-compte">{{ etat.alertes.length }}</span>
          <RouterLink v-if="etat.alertes.length > 5" to="/coach/alertes" class="st-auj-voir">Tout voir</RouterLink></h2>
        <div ref="zAlertes" :style="zoneH('alertes')">
        <div v-if="statut === 'chargement'" class="st-auj-sq-liste"><div v-for="n in Math.min(forme.n.alertes, 5)" :key="n" class="st-auj-squelette" /></div>
        <template v-else>
          <ListeAlertes v-if="etat.alertes.length" :max="5" />
          <p v-else class="st-auj-ok"><IconeSt nom="check" /> Tous les clients sont à jour.</p>
          <RouterLink v-if="etat.alertesAgenda" to="/coach/agenda" class="st-auj-agenda">
            <IconeSt nom="cal" />{{ etat.alertesAgenda }} événement{{ etat.alertesAgenda > 1 ? 's' : '' }} de l’agenda à corriger
          </RouterLink>
        </template>
        </div>
      </section>

      <!-- À relancer -->
      <section class="st-bloc st-auj-b st-auj-b--tiers" style="--i: 2" aria-labelledby="st-auj-t-relance">
        <h2 id="st-auj-t-relance" class="st-auj-h2">À relancer</h2>
        <div :ref="zRelances" :style="zoneH('relances')">
        <div v-if="statut === 'chargement'" class="st-auj-sq-liste"><div v-for="n in forme.n.relances" :key="n" class="st-auj-squelette" /></div>
        <ul v-else-if="relances.length" class="st-auj-mini">
          <li v-for="r in relances.slice(0, 5)" :key="r.id">
            <span class="st-auj-av" :data-m="avatarClient(r.clientId, r.nom).teinte" aria-hidden="true">{{ avatarClient(r.clientId, r.nom).initiales }}</span>
            <div><RouterLink :to="`/coach/clients/${r.clientId}`" class="st-auj-nom">{{ r.nom }}</RouterLink><small>{{ r.detail }}</small></div>
            <a class="st-btn st-auj-relance" :href="r.lienWhatsApp" target="_blank" rel="noopener" :aria-label="messageRelance(r)">Relancer</a>
          </li>
        </ul>
        <p v-else class="st-auj-ok"><IconeSt nom="check" /> Personne à relancer.</p>
        </div>
      </section>

      <!-- Check-ins -->
      <section class="st-bloc st-auj-b st-auj-b--tiers" style="--i: 3" aria-labelledby="st-auj-t-checkins">
        <h2 id="st-auj-t-checkins" class="st-auj-h2">Check-ins du jour <RouterLink to="/coach/questionnaires" class="st-auj-voir">Questionnaires</RouterLink></h2>
        <div :ref="zCheckins" :style="zoneH('checkins')">
        <div v-if="statut === 'chargement'" class="st-auj-sq-liste"><div v-for="n in forme.n.checkins" :key="n" class="st-auj-squelette" /></div>
        <ul v-else-if="checkins.length" class="st-auj-mini">
          <li v-for="c in checkins" :key="c.id">
            <span class="st-auj-av" :data-m="avatarClient(c.clientId, c.nom).teinte" aria-hidden="true">{{ avatarClient(c.clientId, c.nom).initiales }}</span>
            <div><RouterLink :to="`/coach/clients/${c.clientId}?onglet=reponses`" class="st-auj-nom" :aria-label="`Réponses de ${c.nom}`">{{ c.nom }}</RouterLink><small>{{ c.resume }}</small></div>
            <span v-if="c.humeur" class="st-auj-humeur" role="img" :aria-label="`Énergie ${c.humeur}`">{{ c.humeur }}</span>
          </li>
        </ul>
        <p v-else class="st-auj-doux">Aucun check-in rempli pour l’instant aujourd’hui.</p>
        </div>
      </section>

      <!-- Réservations du site -->
      <section class="st-bloc st-auj-b st-auj-b--tiers" style="--i: 4" aria-labelledby="st-auj-t-resa">
        <h2 id="st-auj-t-resa" class="st-auj-h2">Réservations <RouterLink to="/coach/reservations" class="st-auj-voir">Tout voir</RouterLink></h2>
        <div :ref="zResas" :style="zoneH('resas')">
        <div v-if="statut === 'chargement'" class="st-auj-sq-liste"><div v-for="n in forme.n.resas" :key="n" class="st-auj-squelette" /></div>
        <ul v-else-if="resas.length" class="st-auj-mini">
          <li v-for="r in resas" :key="r.id">
            <span class="st-auj-av" :class="{ 'st-auj-av--site': !r.clientId }" :data-m="r.clientId ? avatarClient(r.clientId, r.titre).teinte : undefined" aria-hidden="true">{{ avatarClient(r.clientId || r.id, r.titre).initiales }}</span>
            <div><RouterLink :to="r.lien" class="st-auj-nom">{{ r.titre }}</RouterLink><small>{{ libelleJour(r.date, jour) }} · {{ heureCourte(r.heure) }}</small></div>
          </li>
        </ul>
        <p v-else class="st-auj-doux">Aucune réservation à venir sur le site.</p>
        </div>
      </section>

      <!-- Proposé par Claude (si le lot exercices enrichis est présent) -->
      <RouterLink v-if="brut.aValider" to="/coach/exercices?video=propose" class="st-auj-claude" style="--i: 5">
        <span class="st-auj-claude-i" aria-hidden="true"><IconeSt nom="video" /></span>
        <span><b>{{ brut.aValider }} vidéo{{ brut.aValider > 1 ? 's' : '' }} proposée{{ brut.aValider > 1 ? 's' : '' }} par Claude</b><small>À regarder et valider dans les exercices</small></span>
        <span class="st-btn st-btn--jaune">Valider</span>
      </RouterLink>

      <!-- Accès rapides -->
      <nav class="st-auj-rapides" style="--i: 6" aria-label="Accès rapides">
        <RouterLink class="st-auj-rapide st-auj-rapide--jaune" to="/coach/seances/nouveau"><span><IconeSt nom="plus" /></span>Créer une séance</RouterLink>
        <RouterLink class="st-auj-rapide" data-m="dos" to="/coach/exercices"><span><IconeSt nom="ex" /></span>Exercices</RouterLink>
        <RouterLink class="st-auj-rapide" data-m="bras" to="/coach/clients?inviter=1"><span><IconeSt nom="clients" /></span>Nouveau client</RouterLink>
        <RouterLink class="st-auj-rapide" data-m="epaules" to="/coach/questionnaires"><span><IconeSt nom="msg" /></span>Questionnaires</RouterLink>
      </nav>
    </div>
  </div>
</template>
