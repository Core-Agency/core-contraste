/* =====================================================================
   CORE — CONTRASTE : harnais de vérification

       node tests/verifier.js

   Les conversions de couleur sont le genre de code qui se trompe en
   silence : une matrice mal recopiée donne des couleurs plausibles, mais
   fausses. Trois familles de contrôles, dont deux ne dépendent d'aucune
   valeur recopiée.

   1. ALLER-RETOUR — sRGB → OKLab → sRGB doit rendre la couleur de départ,
      sur des centaines de teintes. Une seule erreur de signe dans l'une
      des six matrices casserait la boucle.

   2. VALEURS DE RÉFÉRENCE — les rapports WCAG et les Lc APCA publiés.

   3. INVARIANTS — les propriétés que ces mesures doivent respecter quelles
      que soient les couleurs : symétrie, bornes, monotonie.
   ===================================================================== */

"use strict";

const C = require("../js/couleur.js");

let reussis = 0, echecs = 0;
const details = [];

function verifie(nom, obtenu, attendu) {
  const a = JSON.stringify(attendu), o = JSON.stringify(obtenu);
  if (a === o) { reussis++; return true; }
  echecs++;
  details.push(`  ✗ ${nom}\n      attendu ${a}\n      obtenu  ${o}`);
  return false;
}

function verifieQue(nom, condition, note) {
  if (condition) { reussis++; return true; }
  echecs++;
  details.push(`  ✗ ${nom}${note ? "  (" + note + ")" : ""}`);
  return false;
}

function proche(nom, obtenu, attendu, tolerance) {
  const ok = Math.abs(obtenu - attendu) <= tolerance;
  if (ok) { reussis++; return true; }
  echecs++;
  details.push(`  ✗ ${nom}\n      attendu ${attendu} ± ${tolerance}\n      obtenu  ${obtenu}`);
  return false;
}

/* ==================================================================== */

console.log("1. Lecture et écriture");
verifie("six chiffres", C.lit("#6355E0"), [0x63, 0x55, 0xE0]);
verifie("sans dièse", C.lit("6355e0"), [0x63, 0x55, 0xE0]);
verifie("forme courte", C.lit("#FFF"), [255, 255, 255]);
verifie("forme courte dépliée", C.lit("#1a2"), [0x11, 0xaa, 0x22]);
verifie("avec alpha, alpha ignoré", C.lit("#6355E080"), [0x63, 0x55, 0xE0]);
verifie("écriture", C.ecrit([99, 85, 224]), "#6355E0");
verifie("écriture bornée", C.ecrit([-10, 300, 128]), "#00FF80");
verifie("saisie invalide", C.lit("bleu"), null);
verifie("saisie tronquée", C.lit("#12345"), null);

console.log("2. Aller-retour sRGB → OKLab → sRGB");
// Un balayage large : si une matrice était fausse, la boucle ne
// retomberait pas sur ses pieds.
// Les matrices sont publiées à dix décimales et ne sont donc pas des
// inverses exactes l'une de l'autre : la boucle dérive de quelques
// dix-millièmes de niveau. Ce qui compte est que la couleur ARRONDIE
// revienne identique — c'est elle qui sera écrite en hexadécimal. La
// dérive brute est mesurée à part, et doit rester très en deçà d'un
// niveau 8 bits.
let pireEcart = 0, testees = 0, arrondisJustes = 0;
for (let r = 0; r <= 255; r += 17) {
  for (let v = 0; v <= 255; v += 17) {
    for (let b = 0; b <= 255; b += 51) {
      const depart = [r, v, b];
      const retour = C.depuisOklab(C.versOklab(depart));
      retour.forEach((c, i) => { pireEcart = Math.max(pireEcart, Math.abs(c - depart[i])); });
      if (retour.every((c, i) => Math.round(c) === depart[i])) arrondisJustes++;
      testees++;
    }
  }
}
verifie(`aller-retour OKLab exact après arrondi sur ${testees} couleurs`, arrondisJustes, testees);
verifieQue(`dérive bien sous un niveau 8 bits (${pireEcart.toExponential(2)})`,
  pireEcart < 0.01, "pire écart " + pireEcart);

console.log("3. Aller-retour OKLCH");
let pireLch = 0, lchJustes = 0, lchTestees = 0;
for (let r = 0; r <= 255; r += 25) {
  for (let v = 0; v <= 255; v += 25) {
    for (let b = 0; b <= 255; b += 25) {
      const depart = [r, v, b];
      const retour = C.depuisOklch(C.versOklch(depart));
      retour.forEach((c, i) => { pireLch = Math.max(pireLch, Math.abs(c - depart[i])); });
      if (retour.every((c, i) => Math.round(c) === depart[i])) lchJustes++;
      lchTestees++;
    }
  }
}
verifie(`aller-retour OKLCH exact après arrondi sur ${lchTestees} couleurs`, lchJustes, lchTestees);
verifieQue(`dérive OKLCH sous un niveau 8 bits (${pireLch.toExponential(2)})`, pireLch < 0.01);
// Le passage par les coordonnées polaires ne doit rien ajouter à la
// dérive : si l'atan2/cos/sin était fautif, l'écart exploserait ici.
verifieQue("le passage en polaire n'aggrave pas la dérive", pireLch < pireEcart * 3);

console.log("4. Repères OKLab connus");
// Le blanc doit avoir une clarté de 1 et aucune chroma.
const blanc = C.versOklch([255, 255, 255]);
proche("clarté du blanc", blanc.L, 1, 1e-5);
proche("chroma du blanc", blanc.C, 0, 1e-5);
const noir = C.versOklch([0, 0, 0]);
proche("clarté du noir", noir.L, 0, 1e-5);
// Un gris reste sans chroma, quelle que soit sa clarté.
[32, 64, 128, 200].forEach(g => {
  proche("gris " + g + " sans chroma", C.versOklch([g, g, g]).C, 0, 1e-6);
});

console.log("5. Contraste WCAG");
proche("noir sur blanc", C.wcag([0, 0, 0], [255, 255, 255]), 21, 0.001);
proche("blanc sur blanc", C.wcag([255, 255, 255], [255, 255, 255]), 1, 1e-9);
// Le rapport est symétrique : il ne connaît pas la polarité.
verifieQue("symétrique",
  Math.abs(C.wcag([0x63, 0x55, 0xE0], [255, 255, 255]) - C.wcag([255, 255, 255], [0x63, 0x55, 0xE0])) < 1e-12);
// Le violet de Core sur blanc : au-dessus de 4,5, donc utilisable en texte.
const violetSurBlanc = C.wcag(C.lit("#6355E0"), [255, 255, 255]);
verifieQue("le violet Core passe en texte sur blanc (" + violetSurBlanc.toFixed(2) + ")",
  violetSurBlanc >= 4.5);
verifie("verdict AAA", C.verdictWcag(21).texteNormal, "AAA");
verifie("verdict AA", C.verdictWcag(5).texteNormal, "AA");
verifie("verdict échec", C.verdictWcag(3).texteNormal, "échec");
verifie("grand texte à 3", C.verdictWcag(3).texteGrand, "AA");
verifie("interface à 3", C.verdictWcag(3).interface, "AA");

console.log("6. Contraste APCA");
// Les deux valeurs de référence publiées avec l'algorithme APCA-W3.
proche("noir sur blanc", C.apca([0, 0, 0], [255, 255, 255]), 106.04, 0.05);
proche("blanc sur noir", C.apca([255, 255, 255], [0, 0, 0]), -107.88, 0.05);
// Deux couleurs identiques ne contrastent pas.
verifie("identiques", C.apca([120, 120, 120], [120, 120, 120]), 0);
// Le signe porte la polarité, et APCA n'est PAS symétrique — c'est tout
// son intérêt par rapport au rapport WCAG.
const bow = C.apca([0, 0, 0], [255, 255, 255]);
const wob = C.apca([255, 255, 255], [0, 0, 0]);
verifieQue("sombre sur clair est positif", bow > 0);
verifieQue("clair sur sombre est négatif", wob < 0);
verifieQue("asymétrique", Math.abs(bow) !== Math.abs(wob));
// Sous le seuil de coupure, le résultat est ramené à zéro plutôt que de
// laisser croire à un contraste résiduel exploitable.
verifie("écart minuscule ramené à zéro", C.apca([128, 128, 128], [129, 129, 129]), 0);
verifie("niveau Lc 90", C.verdictApca(100).niveau, "Lc 90");
verifie("niveau Lc 0", C.verdictApca(5).niveau, "Lc 0");
// Le niveau ne dépend que de la valeur absolue.
verifie("le niveau ignore la polarité", C.verdictApca(-100).niveau, C.verdictApca(100).niveau);

console.log("7. Monotonie");
// À fond blanc, assombrir le texte ne peut qu'augmenter les deux mesures.
let monotoneWcag = true, monotoneApca = true;
for (let g = 0; g < 255; g += 5) {
  const clair = [g + 5, g + 5, g + 5], sombre = [g, g, g];
  if (C.wcag(sombre, [255, 255, 255]) < C.wcag(clair, [255, 255, 255])) monotoneWcag = false;
  if (C.apca(sombre, [255, 255, 255]) < C.apca(clair, [255, 255, 255])) monotoneApca = false;
}
verifieQue("WCAG croît quand le texte fonce", monotoneWcag);
verifieQue("APCA croît quand le texte fonce", monotoneApca);

console.log("8. Gamut");
// Une chroma délirante doit être ramenée dans sRGB, sans toucher la clarté.
const exagere = { L: 0.6, C: 0.5, h: 150 };
const ramene = C.versGamut(exagere);
verifieQue("ramené dans sRGB", ramene.every(c => c >= 0 && c <= 255));
proche("clarté préservée", C.versOklch(ramene).L, exagere.L, 0.02);
// Une couleur déjà dans le gamut ne doit pas être modifiée.
const dedans = C.versOklch(C.lit("#6355E0"));
const inchange = C.versGamut(dedans);
verifieQue("couleur déjà valide inchangée",
  inchange.every((c, i) => Math.abs(c - C.lit("#6355E0")[i]) < 0.5));

console.log("9. Réparation");
// Un gris trop clair sur blanc : la réparation doit le foncer.
const repare = C.repare(C.lit("#AAAAAA"), [255, 255, 255], 4.5);
verifieQue("une réparation est trouvée", !!repare);
verifieQue("le résultat passe le seuil", repare && repare.rapport >= 4.5);
verifieQue("le résultat est plus sombre",
  repare && C.versOklch(C.lit(repare.hex)).L < C.versOklch(C.lit("#AAAAAA")).L);
// La teinte doit survivre : c'est l'identité de la marque.
const violetPale = C.lit("#C9C2F5");
const repareViolet = C.repare(violetPale, [255, 255, 255], 4.5);
verifieQue("la teinte est conservée",
  repareViolet &&
  Math.abs(C.versOklch(C.lit(repareViolet.hex)).h - C.versOklch(violetPale).h) < 3,
  repareViolet ? "écart de teinte " +
    Math.abs(C.versOklch(C.lit(repareViolet.hex)).h - C.versOklch(violetPale).h).toFixed(2) : "aucune");
// Un duo qui passe déjà ne se répare pas.
verifie("rien à réparer", C.repare([0, 0, 0], [255, 255, 255], 4.5), null);

// LE contrôle qui compte : la couleur RENDUE, relue depuis son
// hexadécimal, doit réellement passer le seuil. Le calcul travaille en
// flottant et l'écriture arrondit sur 8 bits ; juger le flottant puis
// rendre l'arrondi produisait des couleurs annoncées conformes qui ne
// l'étaient pas. On balaie largement pour ne pas rater le cas limite.
let reparationsTestees = 0, reparationsTenues = 0, pireRendu = Infinity;
[4.5, 3, 7].forEach(seuil => {
  for (let r = 0; r <= 255; r += 23) {
    for (let v = 0; v <= 255; v += 29) {
      for (let b = 0; b <= 255; b += 31) {
        [[255, 255, 255], [17, 17, 17], [99, 85, 224], [240, 240, 240]].forEach(fond => {
          const res = C.repare([r, v, b], fond, seuil);
          if (!res) return;
          reparationsTestees++;
          const reel = C.wcag(C.lit(res.hex), fond);
          pireRendu = Math.min(pireRendu, reel - seuil);
          if (reel >= seuil) reparationsTenues++;
        });
      }
    }
  }
});
verifie(`toute réparation rendue tient sa promesse (${reparationsTestees} cas)`,
  reparationsTenues, reparationsTestees);
verifieQue("le rapport annoncé n'est jamais optimiste",
  pireRendu >= 0, "pire marge " + pireRendu);
// Sur fond sombre, la réparation doit éclaircir et non assombrir.
const surSombre = C.repare(C.lit("#3A3A3A"), C.lit("#111111"), 4.5);
verifieQue("sur fond sombre, le texte s'éclaircit",
  surSombre && C.versOklch(C.lit(surSombre.hex)).L > C.versOklch(C.lit("#3A3A3A")).L);

console.log("10. Échelle tonale");
const ech = C.echelle("#6355E0");
verifie("onze crans", ech.length, 11);
verifie("crans nommés", ech.map(t => t.cran), [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
verifieQue("un seul cran porte la couleur d'origine",
  ech.filter(t => t.estBase).length === 1);
verifieQue("le cran de base rend la couleur exacte",
  ech.find(t => t.estBase).hex === "#6355E0");
// La clarté doit décroître d'un bout à l'autre, sans accident.
let decroissante = true;
for (let i = 1; i < ech.length; i++) {
  if (C.versOklch(C.lit(ech[i].hex)).L >= C.versOklch(C.lit(ech[i - 1].hex)).L) decroissante = false;
}
verifieQue("clarté strictement décroissante", decroissante);
// La teinte doit tenir sur toute l'échelle.
const teintes = ech.map(t => C.versOklch(C.lit(t.hex)).h);
verifieQue("teinte stable sur toute l'échelle",
  Math.max(...teintes) - Math.min(...teintes) < 12,
  "amplitude " + (Math.max(...teintes) - Math.min(...teintes)).toFixed(1) + "°");
// Chaque ton doit annoncer le texte qui se lit dessus, et avoir raison.
verifieQue("le texte annoncé est bien le plus contrasté",
  ech.every(t => {
    const surTon = C.wcag(C.lit(t.texte), C.lit(t.hex));
    const autre = C.wcag(C.lit(t.texte === "#000000" ? "#FFFFFF" : "#000000"), C.lit(t.hex));
    return surTon >= autre;
  }));
verifieQue("les extrêmes sont lisibles", ech[0].lisible && ech[10].lisible);
verifie("échelle depuis une saisie invalide", C.echelle("pas une couleur"), null);

/* ==================================================================== */

console.log("");
if (echecs) {
  console.log(details.join("\n"));
  console.log(`\n✗ ${echecs} échec(s), ${reussis} contrôle(s) réussi(s).`);
  process.exit(1);
}
console.log(`✓ ${reussis} contrôles réussis.`);
