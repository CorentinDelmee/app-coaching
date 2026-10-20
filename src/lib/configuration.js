// Garde-fou : un build de production sans Supabase embarquerait les comptes de démo (corentin / COACH2026…).
// Il est donc refusé, sauf démo voulue (VITE_MODE_DEMO=1). Voir audit de sécurité, « Mode local en production ».
export const configManquante = (env, mode) => !!env.PROD && mode === 'local' && env.VITE_MODE_DEMO !== '1'
