// État du réseau (réactif) : sert à afficher « Vidéo indisponible hors connexion ».
import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useEnLigne() {
  const enLigne = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
  const maj = () => { enLigne.value = navigator.onLine }
  onMounted(() => { window.addEventListener('online', maj); window.addEventListener('offline', maj) })
  onBeforeUnmount(() => { window.removeEventListener('online', maj); window.removeEventListener('offline', maj) })
  return enLigne
}
