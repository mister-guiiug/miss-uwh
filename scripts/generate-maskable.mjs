/**
 * Rend les deux images sans coin transparent : le maskable Android (512) et
 * l'icône d'accueil iOS (180).
 *
 * POURQUOI UN SVG À PART, ET PAS LE MODE MASKABLE D'UN GÉNÉRATEUR. Fabriquer un
 * maskable en RÉDUISANT la tuile sur un aplat laisse voir le raccord : le bord
 * arrondi du dégradé se détache du fond, et le masque d'Android le révèle au
 * lieu de le cacher. C'est ce que faisait l'ancien script — coin `23,88,186`
 * contre intérieur `55,119,213`. Un maskable se DESSINE à fond perdu, et
 * `icon-maskable.svg` dit lui-même ce qui l'écarte de `icon.svg`.
 *
 * POURQUOI L'ICÔNE APPLE EST ICI, ET PLUS DANS `npm run icons`. iOS n'accepte
 * pas la transparence : il comble les coins de la tuile arrondie par une
 * couleur. L'ancien script l'anticipait en aplatissant sur `#1758ba` — mais
 * `#1758ba` est l'arrêt BAS du dégradé, et un aplat unique ne peut pas
 * coïncider avec deux coins de teintes différentes. Mesuré sur le fichier livré
 * jusqu'au 14/09/2026 : coin `23,88,186` quand le bord rendait `41,109,209`.
 *
 * ET POURQUOI DEUX COUCHES, PLUTÔT QUE DE RENDRE LE MASKABLE EN 180.
 * `icon-maskable.svg` ramène le dessin à 88 % pour le disque de 80 % d'Android.
 * Le masque d'iOS est un rectangle arrondi de rayon ~22,4 % : sa frontière la
 * plus proche du centre est à 314,5 px sur 512, quand le dessin à taille pleine
 * n'atteint que 226 (la vague de gauche, épaisseur du trait comprise). Le
 * réduire lui coûterait de la présence sans rien protéger.
 *
 * On pose donc `icon.svg` à sa taille PLEINE sur le fond à fond perdu du
 * maskable. Les deux portent le même dégradé, aux mêmes arrêts, dans le même
 * repère : les deux couches ont la même couleur en tout pixel de la tuile, et
 * le raccord n'existe pas — au lieu d'être rendu discret. Seuls les coins,
 * transparents dans la source, reçoivent enfin leur teinte.
 *
 * Exécuter : npm run icons:maskable
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const icones = join(racine, 'public', 'icons');

// `density` : sans elle, sharp pixellise le SVG à 72 ppp AVANT de
// redimensionner, et le dégradé en ressort bandé.
const rend = (nom, taille) =>
  sharp(join(icones, nom), { density: 384 })
    .resize(taille, taille)
    .png()
    .toBuffer();

await sharp(await rend('icon-maskable.svg', 512)).toFile(
  join(icones, 'icon-512-maskable.png')
);

const APPLE = 180;
await sharp(await rend('icon-maskable.svg', APPLE))
  .composite([{ input: await rend('icon.svg', APPLE) }])
  .png()
  .toFile(join(icones, 'apple-touch-icon.png'));

console.log(
  'public/icons/icon-512-maskable.png (512×512) et public/icons/apple-touch-icon.png (180×180) écrits, sans coin transparent.'
);
