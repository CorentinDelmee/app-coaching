<script setup>
// « Aujourd'hui » : accueil du coach (Studio d3). La journée sur une frise (moment fort : le curseur « maintenant »
// glisse jusqu'à l'heure actuelle et les rendez-vous se posent), les alertes, les clients à relancer,
// les check-ins du jour, les prochaines réservations du site et les accès rapides. Données : uniquement src/data.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import data from '../../../../data/index.js'
import { jourLocal } from '../../../../domain/dates.js'
import { etat, maintenant, messageErreur, rafraichir } from '../../../store.js'
import IconeSt from '../../IconeSt.vue'
import Puce from '../../Puce.vue'
import ListeAlertes from './ListeAlertes.vue'
import { initiales, teinteDe } from './avatar.js'
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

async function charger() {
  statut.value = 'chargement'; erreur.value = ''; avertissements.value = []; curseurPose.value = false
  horloge.value = maintenant()
  try {
    const [, seances, agenda, reservations, questionnaires, reponses, coach, aValider] = await Promise.allSettled([
      rafraichir(),
      data.seancesCoaching.lister(),
      data.agenda.etat(),
      data.reservations ? data.reservations.liste('a_venir') : Promise.resolve([]),
      data.questionnaires.lister(),
      data.reponses.lister(),
      data.utilisateurCourant(),
      // Vidéos proposées par Claude (lot exercices enrichis) : seulement si la fonction existe déjà.
      data.exercices.recherche ? data.exercices.recherche({ video: 'propose', limite: 1 }).then((r) => r.total || 0) : Promise.resolve(0)
    ]).then((rs) => {
      if (rs[0].status === 'rejected') throw rs[0].reason
      return rs
    })
    const ok = (r, defaut) => (r.status === 'fulfilled' ? r.value : defaut)
    if (agenda.status === 'rejected') avertissements.value.push('L’agenda Google ne répond pas : ses séances n’apparaissent pas.')
    if (reservations.status === 'rejected') avertissements.value.push('Le service de réservation ne répond pas : les réservations du site n’apparaissent pas.')
    brut.value = {
      seances: ok(seances, []), evenements: ok(agenda, { evenements: [] }).evenements || [], reservations: ok(reservations, []),
      questionnaires: ok(questionnaires, []), reponses: ok(reponses, []), coach: ok(coach, null), aValider: ok(aValider, 0)
    }
    statut.value = 'pret'
    requestAnimationFrame(() => requestAnimationFrame(() => { curseurPose.value = true }))
  } catch (e) {
    erreur.value = messageErreur(e)
    statut.value = 'erreur'
  }
}

let minuteur = null
onMounted(() => {
  charger()
  minuteur = setInterval(() => { horloge.value = maintenant() }, 60000)
})
onBeforeUnmount(() => clearInterval(minuteur))

const messageRelance = (r) => `Relancer ${r.nom} sur WhatsApp (${r.raison === 'questionnaire' ? 'questionnaire à remplir' : 'aucune séance prévue'})`
</script>

<template>
  <div class="st-app st-auj">
    <header class="st-auj-entete">
      <div>
        <p class="st-auj-date">{{ dateDuJour(jour) }}</p>
        <h1 class="st-auj-titre">{{ salutation(minutes) }} {{ statut === 'pret' ? prenomCoach : '' }}.</h1>
        <p v-if="statut === 'pret'" class="st-auj-resume">{{ resumeJour(items, etat.alertes.length) }}</p>
      </div>
      <RouterLink to="/coach/seances/nouveau" class="st-btn st-btn--jaune st-auj-cta"><IconeSt nom="plus" /><span class="st-auj-lbl">Nouvelle séance</span></RouterLink>
    </header>

    <!-- Erreur de chargement : rien n'est affiché à moitié -->
    <section v-if="statut === 'erreur'" class="st-bloc st-auj-erreur" role="alert">
      <h2 class="st-auj-h2">Impossible de charger ta journée</h2>
      <p>{{ erreur }}. Vérifie la connexion, puis réessaie.</p>
      <button type="button" class="st-btn st-btn--encre" @click="charger">Réessayer</button>
    </section>

    <div v-else class="st-auj-dash" :class="{ 'is-charge': statut === 'pret' }" :aria-busy="statut === 'chargement'">
      <p v-for="a in avertissements" :key="a" class="st-auj-avert" role="status">{{ a }}</p>

      <!-- Journée -->
      <section class="st-bloc st-auj-b st-auj-b--jour" style="--i: 0" aria-labelledby="st-auj-t-jour">
        <h2 id="st-auj-t-jour" class="st-auj-h2">Ta journée <RouterLink to="/coach/agenda" class="st-auj-voir">Agenda</RouterLink></h2>

        <template v-if="statut === 'chargement'">
          <div class="st-auj-squelette st-auj-squelette--frise" />
          <div v-for="n in 3" :key="n" class="st-auj-squelette" />
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
            <li v-for="(it, n) in items" :key="it.id" class="st-auj-seance" :class="`is-${it.etat}`" :data-m="it.clientId ? teinteDe(it.clientId) : 'gainage'" :style="{ '--n': n }">
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
      </section>

      <!-- Alertes -->
      <section class="st-bloc st-auj-b st-auj-b--alertes" style="--i: 1" aria-labelledby="st-auj-t-alertes">
        <h2 id="st-auj-t-alertes" class="st-auj-h2">Alertes <span v-if="etat.alertes.length" class="st-auj-compte">{{ etat.alertes.length }}</span>
          <RouterLink v-if="etat.alertes.length > 5" to="/coach/alertes" class="st-auj-voir">Tout voir</RouterLink></h2>
        <template v-if="statut === 'chargement'"><div v-for="n in 3" :key="n" class="st-auj-squelette" /></template>
        <template v-else>
          <ListeAlertes v-if="etat.alertes.length" :max="5" />
          <p v-else class="st-auj-ok"><IconeSt nom="check" /> Tous les clients sont à jour.</p>
          <RouterLink v-if="etat.alertesAgenda" to="/coach/agenda" class="st-auj-agenda">
            <IconeSt nom="cal" />{{ etat.alertesAgenda }} événement{{ etat.alertesAgenda > 1 ? 's' : '' }} de l’agenda à corriger
          </RouterLink>
        </template>
      </section>

      <!-- À relancer -->
      <section class="st-bloc st-auj-b st-auj-b--tiers" style="--i: 2" aria-labelledby="st-auj-t-relance">
        <h2 id="st-auj-t-relance" class="st-auj-h2">À relancer</h2>
        <template v-if="statut === 'chargement'"><div v-for="n in 2" :key="n" class="st-auj-squelette" /></template>
        <ul v-else-if="relances.length" class="st-auj-mini">
          <li v-for="r in relances.slice(0, 5)" :key="r.id">
            <span class="st-auj-av" :data-m="teinteDe(r.clientId)" aria-hidden="true">{{ initiales(r.nom) }}</span>
            <div><RouterLink :to="`/coach/clients/${r.clientId}`" class="st-auj-nom">{{ r.nom }}</RouterLink><small>{{ r.detail }}</small></div>
            <a class="st-btn st-auj-relance" :href="r.lienWhatsApp" target="_blank" rel="noopener" :aria-label="messageRelance(r)">Relancer</a>
          </li>
        </ul>
        <p v-else class="st-auj-ok"><IconeSt nom="check" /> Personne à relancer.</p>
      </section>

      <!-- Check-ins -->
      <section class="st-bloc st-auj-b st-auj-b--tiers" style="--i: 3" aria-labelledby="st-auj-t-checkins">
        <h2 id="st-auj-t-checkins" class="st-auj-h2">Check-ins du jour <RouterLink to="/coach/questionnaires" class="st-auj-voir">Questionnaires</RouterLink></h2>
        <template v-if="statut === 'chargement'"><div v-for="n in 2" :key="n" class="st-auj-squelette" /></template>
        <ul v-else-if="checkins.length" class="st-auj-mini">
          <li v-for="c in checkins" :key="c.id">
            <span class="st-auj-av" :data-m="teinteDe(c.clientId)" aria-hidden="true">{{ initiales(c.nom) }}</span>
            <div><RouterLink :to="`/coach/clients/${c.clientId}`" class="st-auj-nom">{{ c.nom }}</RouterLink><small>{{ c.resume }}</small></div>
            <span v-if="c.humeur" class="st-auj-humeur" role="img" :aria-label="`Énergie ${c.humeur}`">{{ c.humeur }}</span>
          </li>
        </ul>
        <p v-else class="st-auj-doux">Aucun check-in rempli pour l’instant aujourd’hui.</p>
      </section>

      <!-- Réservations du site -->
      <section class="st-bloc st-auj-b st-auj-b--tiers" style="--i: 4" aria-labelledby="st-auj-t-resa">
        <h2 id="st-auj-t-resa" class="st-auj-h2">Réservations <RouterLink to="/coach/reservations" class="st-auj-voir">Tout voir</RouterLink></h2>
        <template v-if="statut === 'chargement'"><div v-for="n in 2" :key="n" class="st-auj-squelette" /></template>
        <ul v-else-if="resas.length" class="st-auj-mini">
          <li v-for="r in resas" :key="r.id">
            <span class="st-auj-av st-auj-av--site" aria-hidden="true">{{ initiales(r.titre) }}</span>
            <div><span class="st-auj-nom">{{ r.titre }}</span><small>{{ libelleJour(r.date, jour) }} · {{ heureCourte(r.heure) }}</small></div>
          </li>
        </ul>
        <p v-else class="st-auj-doux">Aucune réservation à venir sur le site.</p>
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
        <RouterLink class="st-auj-rapide" data-m="bras" to="/coach/clients"><span><IconeSt nom="clients" /></span>Nouveau client</RouterLink>
        <RouterLink class="st-auj-rapide" data-m="epaules" to="/coach/questionnaires"><span><IconeSt nom="msg" /></span>Questionnaires</RouterLink>
      </nav>
    </div>
  </div>
</template>
