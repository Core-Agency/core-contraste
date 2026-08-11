/* =====================================================================
   CORE — CONTRASTE : le calcul

   Conversions sRGB ↔ OKLab ↔ OKLCH, contraste WCAG 2.2, contraste APCA,
   réparation d'un duo qui échoue, et construction d'une échelle tonale.
   Aucune dépendance.

   CoreCouleur.wcag(a, b)          -> rapport, de 1 à 21
   CoreCouleur.apca(texte, fond)   -> Lc, de -108 à 106
   CoreCouleur.repare(txt, fond)   -> la couleur la plus proche qui passe
   CoreCouleur.echelle(base)       -> onze tons, du plus clair au plus foncé
   ===================================================================== */

(function (racine, fabrique) {
  const api = fabrique();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.CoreCouleur = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const borne = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ------------------------------------------------------------------
     LECTURE ET ÉCRITURE
     ------------------------------------------------------------------ */

  function lit(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(hex).trim());
    if (!m) return null;
    let c = m[1];
    // Les formes courtes se déplient chiffre par chiffre.
    if (c.length === 3 || c.length === 4) c = c.split("").map(x => x + x).join("");
    // Le canal alpha est lu puis ignoré : un contraste ne se calcule
    // qu'entre deux couleurs opaques. Le composer avec le fond
    // supposerait qu'on connaisse ce qu'il y a derrière.
    return [
      parseInt(c.slice(0, 2), 16),
      parseInt(c.slice(2, 4), 16),
      parseInt(c.slice(4, 6), 16),
    ];
  }

  const ecrit = rvb =>
    "#" + rvb.map(n => borne(Math.round(n), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();

  /* ------------------------------------------------------------------
     sRGB ↔ LINÉAIRE
     ------------------------------------------------------------------ */

  const versLineaire = c => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const versSrgb = c => {
    const x = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return x * 255;
  };

  /* ------------------------------------------------------------------
     OKLab — matrices de Björn Ottosson
     ------------------------------------------------------------------ */

  function versOklab(rvb) {
    const r = versLineaire(rvb[0]), v = versLineaire(rvb[1]), b = versLineaire(rvb[2]);

    const l = 0.4122214708 * r + 0.5363325363 * v + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * v + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * v + 0.6299787005 * b;

    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);

    return {
      L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    };
  }

  /** Rend un triplet possiblement hors de l'espace sRGB : à borner ensuite. */
  function depuisOklab(lab) {
    const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
    const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
    const s_ = lab.L - 0.0894841775 * lab.a - 1.2914855480 * lab.b;

    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;

    return [
      versSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      versSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      versSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
    ];
  }

  function versOklch(rvb) {
    const lab = versOklab(rvb);
    return {
      L: lab.L,
      C: Math.sqrt(lab.a * lab.a + lab.b * lab.b),
      h: (Math.atan2(lab.b, lab.a) * 180 / Math.PI + 360) % 360,
    };
  }

  function depuisOklch(lch) {
    const rad = lch.h * Math.PI / 180;
    return depuisOklab({ L: lch.L, a: Math.cos(rad) * lch.C, b: Math.sin(rad) * lch.C });
  }

  const dansGamut = rvb => rvb.every(c => c >= -0.5 && c <= 255.5);

  /**
   * Ramène une couleur OKLCH dans l'espace sRGB en réduisant sa chroma,
   * jamais sa clarté : c'est la clarté qui porte le contraste, et la
   * rabattre déplacerait justement ce qu'on cherche à contrôler.
   */
  function versGamut(lch) {
    let direct = depuisOklch(lch);
    if (dansGamut(direct)) return direct.map(c => borne(c, 0, 255));

    let bas = 0, haut = lch.C;
    for (let i = 0; i < 24; i++) {
      const milieu = (bas + haut) / 2;
      if (dansGamut(depuisOklch({ L: lch.L, C: milieu, h: lch.h }))) bas = milieu;
      else haut = milieu;
    }
    return depuisOklch({ L: lch.L, C: bas, h: lch.h }).map(c => borne(c, 0, 255));
  }

  /* ------------------------------------------------------------------
     CONTRASTE WCAG 2.2

     Le rapport officiel, celui qu'exigent les textes réglementaires.
     ------------------------------------------------------------------ */

  function luminance(rvb) {
    return 0.2126 * versLineaire(rvb[0]) +
           0.7152 * versLineaire(rvb[1]) +
           0.0722 * versLineaire(rvb[2]);
  }

  function wcag(a, b) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /** Ce que le rapport autorise, selon l'usage. */
  function verdictWcag(rapport) {
    return {
      rapport,
      texteNormal: rapport >= 4.5 ? (rapport >= 7 ? "AAA" : "AA") : "échec",
      texteGrand: rapport >= 3 ? (rapport >= 4.5 ? "AAA" : "AA") : "échec",
      interface: rapport >= 3 ? "AA" : "échec",
    };
  }

  /* ------------------------------------------------------------------
     CONTRASTE APCA (APCA-W3, 0.1.9)

     La méthode candidate pour la suite des WCAG. Elle tient compte de ce
     que le rapport de luminance ignore : le sens de la polarité (texte
     sombre sur clair ne se lit pas comme l'inverse), et le fait que les
     couleurs très sombres se distinguent mal entre elles.

     Le résultat, `Lc`, va d'environ -108 à 106. Son signe porte la
     polarité : positif pour du sombre sur du clair.

     ⚠️ APCA n'est pas une norme. C'est un indicateur informatif, plus
     fidèle à la perception, mais aucune obligation légale ne s'y réfère.
     ------------------------------------------------------------------ */

  const APCA = {
    trc: 2.4,
    r: 0.2126729, g: 0.7151522, b: 0.0721750,
    seuilNoir: 0.022, clampNoir: 1.414,
    normFond: 0.56, normTexte: 0.57,
    revTexte: 0.62, revFond: 0.65,
    echelleBoW: 1.14, echelleWoB: 1.14,
    decalage: 0.027,
    clipBas: 0.1,
    deltaMin: 0.0005,
  };

  function ycAPCA(rvb) {
    const y = APCA.r * Math.pow(rvb[0] / 255, APCA.trc) +
              APCA.g * Math.pow(rvb[1] / 255, APCA.trc) +
              APCA.b * Math.pow(rvb[2] / 255, APCA.trc);
    // Les luminances très basses sont relevées : deux noirs voisins ne se
    // distinguent pas autant que le calcul brut le laisserait croire.
    return y < APCA.seuilNoir ? y + Math.pow(APCA.seuilNoir - y, APCA.clampNoir) : y;
  }

  function apca(texte, fond) {
    const yTexte = ycAPCA(texte);
    const yFond = ycAPCA(fond);
    if (Math.abs(yFond - yTexte) < APCA.deltaMin) return 0;

    let sortie;
    if (yFond > yTexte) {
      // Sombre sur clair.
      const s = (Math.pow(yFond, APCA.normFond) - Math.pow(yTexte, APCA.normTexte)) * APCA.echelleBoW;
      sortie = s < APCA.clipBas ? 0 : s - APCA.decalage;
    } else {
      // Clair sur sombre.
      const s = (Math.pow(yFond, APCA.revFond) - Math.pow(yTexte, APCA.revTexte)) * APCA.echelleWoB;
      sortie = s > -APCA.clipBas ? 0 : s + APCA.decalage;
    }
    return sortie * 100;
  }

  /**
   * Ce qu'un Lc autorise, en langage d'atelier. Les seuils viennent des
   * tableaux de niveaux publiés avec APCA.
   */
  function verdictApca(lc) {
    const a = Math.abs(lc);
    if (a >= 90) return { niveau: "Lc 90", quoi: "N'importe quel texte, même fin et petit." };
    if (a >= 75) return { niveau: "Lc 75", quoi: "Texte courant à partir de 16 px en graisse normale." };
    if (a >= 60) return { niveau: "Lc 60", quoi: "Texte de contenu à partir de 18 px, ou 16 px en gras." };
    if (a >= 45) return { niveau: "Lc 45", quoi: "Gros titres et éléments d'interface seulement." };
    if (a >= 30) return { niveau: "Lc 30", quoi: "Texte désactivé, filets. Rien à lire vraiment." };
    if (a >= 15) return { niveau: "Lc 15", quoi: "Décoration. Invisible pour beaucoup de monde." };
    return { niveau: "Lc 0", quoi: "Ces deux couleurs ne se distinguent pas." };
  }

  /* ------------------------------------------------------------------
     RÉPARATION

     Quand un duo échoue, on cherche la couleur la plus proche qui passe.
     On ne touche qu'à la clarté OKLCH : la teinte et la chroma portent
     l'identité de la marque, la clarté porte le contraste.
     ------------------------------------------------------------------ */

  function repare(texte, fond, cible) {
    const seuil = cible || 4.5;
    if (wcag(texte, fond) >= seuil) return null;

    const lch = versOklch(texte);
    const clarteFond = versOklch(fond).L;

    // On s'éloigne du fond : plus sombre si le fond est clair, et
    // l'inverse. Suivre l'autre sens produirait une couleur juste, mais
    // qui inverserait la hiérarchie voulue par le graphiste.
    const versLeBas = clarteFond > 0.5;

    let meilleur = null;
    // Balayage au millième de clarté, puis on garde le premier qui passe :
    // c'est par construction le plus proche de la couleur de départ.
    //
    // ⚠️ Le candidat est ARRONDI AVANT d'être jugé. Le calcul travaille en
    // flottant, mais ce qui sera écrit dans la feuille de style est un
    // hexadécimal sur 8 bits. Juger le flottant puis rendre l'arrondi
    // faisait rendre une couleur annoncée conforme qui ne l'était pas —
    // #777777 à 4,48 pour un seuil de 4,5.
    for (let pas = 1; pas <= 1000; pas++) {
      const L = versLeBas ? lch.L - pas / 1000 : lch.L + pas / 1000;
      if (L < 0 || L > 1) break;
      const candidat = versGamut({ L, C: lch.C, h: lch.h }).map(Math.round);
      if (wcag(candidat, fond) >= seuil) { meilleur = candidat; break; }
    }

    if (!meilleur) return null;
    return {
      hex: ecrit(meilleur),
      rapport: wcag(meilleur, fond),
      ecartClarte: Math.abs(versOklch(meilleur).L - lch.L),
    };
  }

  /* ------------------------------------------------------------------
     ÉCHELLE TONALE

     Onze tons répartis en clarté, teinte conservée. La chroma suit une
     courbe en cloche : les tons très clairs et très sombres en supportent
     moins avant de sortir du gamut, et une chroma constante donnerait des
     extrémités délavées ou boueuses.
     ------------------------------------------------------------------ */

  const CRANS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const CLARTES = [0.97, 0.94, 0.88, 0.80, 0.72, 0.64, 0.55, 0.46, 0.38, 0.30, 0.24];

  function echelle(base) {
    const rvb = lit(base);
    if (!rvb) return null;
    const lch = versOklch(rvb);

    // Le cran dont la clarté est la plus proche de celle de la couleur
    // fournie : c'est là qu'on la reconnaîtra dans l'échelle.
    let cranBase = 0, ecartMin = Infinity;
    CLARTES.forEach((L, i) => {
      const ecart = Math.abs(L - lch.L);
      if (ecart < ecartMin) { ecartMin = ecart; cranBase = i; }
    });

    return CRANS.map((cran, i) => {
      const L = CLARTES[i];
      // Cloche centrée sur le cran 500, normalisée à 1 en son sommet.
      const cloche = 1 - Math.pow((i - 5) / 5, 2) * 0.55;
      const couleur = i === cranBase
        ? rvb                                     // la couleur d'origine, intacte
        : versGamut({ L, C: lch.C * cloche, h: lch.h });

      const surBlanc = wcag(couleur, [255, 255, 255]);
      const surNoir = wcag(couleur, [0, 0, 0]);
      return {
        cran,
        hex: ecrit(couleur),
        estBase: i === cranBase,
        surBlanc, surNoir,
        // Le texte à poser dessus : celui des deux qui contraste le plus.
        texte: surNoir >= surBlanc ? "#000000" : "#FFFFFF",
        texteRapport: Math.max(surBlanc, surNoir),
        lisible: Math.max(surBlanc, surNoir) >= 4.5,
      };
    });
  }

  return {
    lit, ecrit,
    versOklab, depuisOklab, versOklch, depuisOklch, versGamut, dansGamut,
    luminance, wcag, verdictWcag,
    apca, verdictApca,
    repare, echelle,
    CRANS,
  };
});
