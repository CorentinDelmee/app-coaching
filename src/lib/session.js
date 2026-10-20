// Session de l'utilisateur. La connexion se fait sur /connexion (en mode local : comptes de démo) ; le routeur (router/garde.js)
// renvoie vers /bienvenue tant qu'il n'y a pas de session, donc les écrans reçoivent toujours un utilisateur.
import { data } from '../data/index.js'

export const utilisateurCourant = () => data.utilisateurCourant()
