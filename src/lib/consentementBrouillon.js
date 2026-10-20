// Cases du consentement gardées en mémoire le temps de la visite (aller lire la Confidentialité puis revenir ne les décoche pas).
// Jamais enregistrées : elles repartent décochées au prochain lancement de l'app.
import { ref } from 'vue'

export const coches = ref([false, false])
export const reinitialiserCoches = () => { coches.value = [false, false] }
