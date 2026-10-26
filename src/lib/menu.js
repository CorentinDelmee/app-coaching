// Lien entre le bouton du menu posé DANS une page (tableau de bord, comme la maquette M5) et le menu global (MenuApp.vue).
// La page émet une demande ; MenuApp l'écoute. L'état ouvert se lit sur <html class="menu-ouvert"> (croix du bouton en CSS).
export const EVT_MENU = 'app:menu-basculer'
export function basculerMenu() {
  window.dispatchEvent(new CustomEvent(EVT_MENU))
}
