// Aide commune aux modules d'outils (un fichier par lot : clients, programmes, bibliotheque, questionnaires, reservations, suivi).
// def(description, schemaZodStrict, run, { mutation }) : même forme que les outils historiques de ../outils.js.
export const def = (description, schema, run, { mutation = false } = {}) => ({ description, schema, run, mutation })
