<div align="center">

<img src="img/core-mark-192.png" width="72" height="72" alt="Marque de Core">

# Core — Contraste

**Un outil [Core](https://core-agency.be), agence digitale à Charleroi**

**Savoir si ça se lit, et quoi changer sinon.**

[![Essayer](https://img.shields.io/badge/Essayer%20maintenant-6355E0?style=for-the-badge&logoColor=white)](https://core-agency.github.io/core-contraste/)

![Licence](https://img.shields.io/badge/licence-MIT-1A1A1A?style=for-the-badge&labelColor=1A1A1A)
![Dépendances](https://img.shields.io/badge/dépendances-aucune-1A1A1A?style=for-the-badge&labelColor=1A1A1A)
![Hors ligne](https://img.shields.io/badge/fonctionne%20hors%20ligne-oui-1A1A1A?style=for-the-badge&labelColor=1A1A1A)
![Contrôles](https://img.shields.io/badge/contrôles%20automatisés-62-1A1A1A?style=for-the-badge&labelColor=1A1A1A)

**[core-agency.github.io/core-contraste](https://core-agency.github.io/core-contraste/)**

</div>

---

## Ce que ça fait

| | |
|---|---|
| **Deux mesures** | Le rapport WCAG 2.2, exigé par les textes, et le Lc d'APCA, plus proche de la perception |
| **Des échantillons réels** | 24 px, 16 px, 13 px et un bouton — le contraste se juge sur du texte courant, pas sur un titre |
| **La réparation** | La couleur la plus proche qui passe, **à teinte égale** |
| **L'échelle** | Onze crans en OKLCH depuis une couleur de marque, chacun annonçant le texte qui se lit dessus |
| **Variables CSS** | L'échelle prête à coller |

Aucune couleur ne sort de la machine.

## Ce qui rend cet outil différent d'un contrôleur de contraste

**La réparation ne déplace que la clarté.** Les contrôleurs habituels
annoncent l'échec et s'arrêtent là ; ceux qui proposent une correction
partent souvent vers une autre teinte. Ici, la teinte et la chroma OKLCH sont
tenues, et seule la clarté bouge — c'est elle qui porte le contraste. La
couleur reste celle de la marque, en plus foncé ou en plus clair.

**La couleur proposée est jugée après arrondi.** Le calcul travaille en
flottant, mais ce qui finit dans la feuille de style tient sur 8 bits par
canal. Juger le flottant puis rendre l'arrondi produit des couleurs annoncées
conformes qui ne le sont pas : `#777777` mesure 4,48:1 sur blanc, pour un
seuil de 4,5. L'arrondi est donc fait **avant** le jugement — et un contrôle
balaie plusieurs milliers de réparations pour vérifier que chacune tient
réellement sa promesse une fois relue depuis son hexadécimal.

**L'échelle garde votre couleur exacte.** Le cran dont la clarté est la plus
proche de la vôtre porte votre couleur, au bit près ; les dix autres en
dérivent. Une échelle qui « améliore » discrètement la couleur de marque
n'est pas utilisable en production.

**La chroma suit une cloche.** À chroma constante, les tons très clairs
sortent délavés et les très sombres tournent boueux, parce qu'ils sortent du
gamut sRGB et se font rabattre. La chroma décroît donc vers les extrémités,
et le retour dans le gamut se fait en réduisant la chroma — jamais la clarté,
qui est justement ce qu'on cherche à contrôler.

## WCAG et APCA ne disent pas la même chose

Le rapport WCAG est **symétrique** : il ne sait pas si le texte est sombre sur
clair ou l'inverse. C'est une simplification connue — l'œil ne perçoit pas ces
deux situations de la même façon.

APCA, lui, est **orienté** : `+106` pour du noir sur blanc, `-108` pour du
blanc sur noir. Il relève aussi les luminances très basses, parce que deux
noirs voisins se distinguent moins bien que le calcul brut ne le suggère.

**Les deux sont affichés, et c'est WCAG qui fait foi.** APCA est un travail en
cours, pas une norme : aucune obligation légale ne s'y réfère aujourd'hui. Il
est donné à titre indicatif, parce qu'il explique souvent pourquoi un duo
conforme reste désagréable à lire.

## Vérifié

```
node tests/verifier.js
```

**62 contrôles.** Les conversions de couleur sont le genre de code qui se
trompe en silence : une matrice mal recopiée donne des couleurs plausibles
mais fausses. Trois familles de contrôles, dont deux ne dépendent d'aucune
valeur recopiée :

| Contrôle | Ce qu'il attrape |
|---|---|
| **Aller-retour** | sRGB → OKLab → sRGB sur plus de quinze cents couleurs doit rendre exactement la couleur de départ après arrondi. Une seule erreur de signe dans l'une des six matrices casserait la boucle. |
| **Repères** | Clarté 1 pour le blanc, 0 pour le noir, chroma nulle pour tous les gris. Pour APCA, les deux valeurs de référence publiées : **106,04** et **−107,88**. |
| **Invariants** | Symétrie du rapport WCAG et asymétrie d'APCA, monotonie des deux mesures, clarté strictement décroissante et teinte stable sur toute l'échelle, réparation qui s'éloigne du fond dans le bon sens. |

## Ce que cet outil ne dit pas

**Un contraste conforme ne fait pas une interface lisible.** L'épaisseur du
trait d'une police, l'interlignage, la taille réelle sur un téléphone en plein
soleil comptent autant. Ces mesures écartent ce qui est illisible ; elles ne
garantissent pas ce qui est confortable.

**Le canal alpha est lu puis ignoré.** Un contraste ne se calcule qu'entre
deux couleurs opaques : composer une couleur translucide supposerait de
connaître ce qu'il y a derrière.

**Les seuils WCAG dépendent de la taille et de la graisse réelles.** « Grand
texte » signifie 24 px, ou 19 px en gras. Un titre en police fine à 20 px
relève du texte courant, pas du grand texte.

**APCA n'est pas opposable.** Si un cahier des charges impose l'accessibilité,
c'est le rapport WCAG qui est vérifié, pas le Lc.

## Utiliser

Téléchargez le dossier et ouvrez `index.html`. Aucune compilation, aucun
gestionnaire de paquets.

Le calcul s'utilise aussi seul :

```js
const C = require('./js/couleur.js');

C.wcag(C.lit('#6355E0'), [255, 255, 255]);   // 5.38
C.apca(C.lit('#000000'), [255, 255, 255]);   // 106.04
C.repare(C.lit('#AAAAAA'), [255, 255, 255], 4.5);
// { hex: '#767676', rapport: 4.54, ecartClarte: 0.148 }

C.echelle('#6355E0');
// [ { cran: 50, hex: '#F3F4FF', texte: '#000000', lisible: true }, … ]
```

## Structure

```
index.html            l'atelier
css/contraste.css     charte Core : violet, lavande, Lexend Deca
js/couleur.js         conversions, WCAG, APCA, réparation, échelle
js/atelier.js         l'interface et les échantillons
tests/verifier.js     le harnais
fonts/                Lexend Deca et JetBrains Mono, sous licence OFL
```

## Licence

MIT — voir [LICENSE](LICENSE).

---

<div align="center">

Construit par [Core](https://core-agency.be), agence digitale à Charleroi.

</div>
