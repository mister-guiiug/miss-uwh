/**
 * Identifiants — RÉEXPORTÉS DU SOCLE (`@mister-guiiug/dev-pwa-config/id`).
 *
 * Le corps vivait ici : même repli `crypto.randomUUID`, même secours
 * `Math.random`. Le socle porte la version éprouvée — son repli v4 pose les
 * bits de version et de variante, ce que la nôtre ne faisait pas — et ce
 * fichier reste comme point d'entrée pour que les imports de l'app ne bougent
 * pas (PARC.md, chantier 3).
 */
export { createId, createUuid } from '@mister-guiiug/dev-pwa-config/id';
