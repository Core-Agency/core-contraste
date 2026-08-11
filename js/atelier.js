/* =====================================================================
   CORE — CONTRASTE : l'atelier

   Lit les couleurs, affiche les échantillons, les verdicts et l'échelle.
   Tout le calcul est dans js/couleur.js et ne connaît rien de cette page.
   ===================================================================== */

(function () {
  "use strict";

  const $ = s => document.querySelector(s);

  /* ------------------------------------------------------------------
     LIAISON PIPETTE ↔ CHAMP TEXTE
     ------------------------------------------------------------------ */

  function lieCouleur(pipette, champ, apres) {
    $(pipette).addEventListener("input", () => {
      $(champ).value = $(pipette).value.toUpperCase();
      apres();
    });
    $(champ).addEventListener("input", () => {
      const rvb = CoreCouleur.lit($(champ).value);
      if (rvb) $(pipette).value = CoreCouleur.ecrit(rvb).toLowerCase();
      apres();
    });
  }

  /** La dernière saisie valide, pour ne pas tout casser pendant la frappe. */
  const memoire = { texte: [99, 85, 224], fond: [255, 255, 255], base: [99, 85, 224] };

  function couleurDe(champ, cle) {
    const rvb = CoreCouleur.lit($(champ).value);
    if (rvb) memoire[cle] = rvb;
    return memoire[cle];
  }

  /* ------------------------------------------------------------------
     LE DUO
     ------------------------------------------------------------------ */

  function ligne(libelle, sceau, passe) {
    const div = document.createElement("div");
    div.className = "note-ligne note-ligne--" + (passe ? "vrai" : "faux");
    const nom = document.createElement("span");
    nom.textContent = libelle;
    const val = document.createElement("span");
    val.className = "note-ligne__sceau";
    val.textContent = sceau;
    div.appendChild(nom);
    div.appendChild(val);
    return div;
  }

  function majDuo() {
    const texte = couleurDe("#hexTexte", "texte");
    const fond = couleurDe("#hexFond", "fond");

    // --- échantillon
    const ech = $("#echantillon");
    ech.style.background = CoreCouleur.ecrit(fond);
    ech.style.color = CoreCouleur.ecrit(texte);

    // --- WCAG
    const rapport = CoreCouleur.wcag(texte, fond);
    const v = CoreCouleur.verdictWcag(rapport);
    $("#valeurWcag").textContent = rapport.toFixed(2).replace(".", ",") + ":1";

    const notes = $("#notesWcag");
    notes.innerHTML = "";
    notes.appendChild(ligne("Texte courant (16 px)", v.texteNormal, v.texteNormal !== "échec"));
    notes.appendChild(ligne("Grand texte (24 px, ou 19 px gras)", v.texteGrand, v.texteGrand !== "échec"));
    notes.appendChild(ligne("Bordures, icônes, champs", v.interface, v.interface !== "échec"));

    // --- APCA
    const lc = CoreCouleur.apca(texte, fond);
    const va = CoreCouleur.verdictApca(lc);
    $("#valeurApca").textContent = (lc > 0 ? "+" : "") + lc.toFixed(1).replace(".", ",");
    $("#quoiApca").textContent = va.quoi;
    $("#polarite").textContent = lc === 0
      ? "Aucune polarité : les deux couleurs se valent."
      : (lc > 0 ? "Texte sombre sur fond clair." : "Texte clair sur fond sombre.");

    // --- réparation
    const rep = CoreCouleur.repare(texte, fond, 4.5);
    const bloc = $("#reparation");
    if (!rep) {
      bloc.hidden = true;
    } else {
      bloc.hidden = false;
      $("#reparationPastille").style.background = rep.hex;

      // On reconstruit la phrase par nœuds plutôt qu'en HTML : la couleur
      // vient d'une saisie, et elle n'a rien à faire dans du balisage.
      const phrase = $("#reparationTexte").querySelector("div");
      phrase.textContent = "Le duo échoue pour du texte courant. La couleur la plus proche qui passe, à teinte égale, est ";
      const hex = document.createElement("span");
      hex.className = "reparation__hex";
      hex.id = "reparationHex";
      hex.textContent = rep.hex;
      phrase.appendChild(hex);
      phrase.appendChild(document.createTextNode(" — soit " + rapportTexte(rep.rapport) + "."));
    }
  }

  const rapportTexte = r => r.toFixed(2).replace(".", ",") + ":1";

  $("#reparationAppliquer").addEventListener("click", () => {
    const texte = couleurDe("#hexTexte", "texte");
    const fond = couleurDe("#hexFond", "fond");
    const rep = CoreCouleur.repare(texte, fond, 4.5);
    if (!rep) return;
    $("#hexTexte").value = rep.hex;
    $("#pipetteTexte").value = rep.hex.toLowerCase();
    majDuo();
  });

  $("#permuter").addEventListener("click", () => {
    const t = $("#hexTexte").value, f = $("#hexFond").value;
    $("#hexTexte").value = f; $("#pipetteTexte").value = (CoreCouleur.lit(f) ? f : "#000000").toLowerCase();
    $("#hexFond").value = t; $("#pipetteFond").value = (CoreCouleur.lit(t) ? t : "#ffffff").toLowerCase();
    majDuo();
  });

  /* ------------------------------------------------------------------
     L'ÉCHELLE
     ------------------------------------------------------------------ */

  function majEchelle() {
    const base = couleurDe("#hexBase", "base");
    const tons = CoreCouleur.echelle(CoreCouleur.ecrit(base));
    const grille = $("#echelle");
    grille.innerHTML = "";

    tons.forEach(ton => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ton" + (ton.estBase ? " ton--base" : "");
      b.style.background = ton.hex;
      b.style.color = ton.texte;
      b.title = "Charger " + ton.hex + " dans le duo";

      const haut = document.createElement("span");
      haut.className = "ton__cran";
      haut.textContent = ton.cran;

      const bas = document.createElement("span");
      const hex = document.createElement("span");
      hex.className = "ton__hex";
      hex.textContent = ton.hex;
      const rap = document.createElement("span");
      rap.className = "ton__rapport";
      rap.textContent = ton.texteRapport.toFixed(1).replace(".", ",") + ":1";
      bas.appendChild(hex);
      bas.appendChild(document.createElement("br"));
      bas.appendChild(rap);

      b.appendChild(haut);
      if (ton.estBase) {
        const marque = document.createElement("span");
        marque.className = "ton__marque";
        marque.textContent = "votre couleur";
        b.appendChild(marque);
      }
      b.appendChild(bas);

      b.addEventListener("click", () => {
        // Le ton devient le fond, et son texte annoncé devient le texte :
        // on vérifie ainsi immédiatement la promesse de l'échelle.
        $("#hexFond").value = ton.hex;
        $("#pipetteFond").value = ton.hex.toLowerCase();
        $("#hexTexte").value = ton.texte;
        $("#pipetteTexte").value = ton.texte.toLowerCase();
        majDuo();
        $("#echantillon").scrollIntoView({ behavior: "smooth", block: "center" });
      });

      grille.appendChild(b);
    });

    // --- variables CSS
    const nom = "marque";
    const lignes = tons.map(t =>
      "  --" + nom + "-" + t.cran + ": " + t.hex.toLowerCase() + ";" +
      (t.estBase ? "   /* votre couleur */" : ""));
    $("#sortieCss").textContent = ":root {\n" + lignes.join("\n") + "\n}";
  }

  $("#copierCss").addEventListener("click", async () => {
    const texte = $("#sortieCss").textContent;
    try {
      await navigator.clipboard.writeText(texte);
      const etat = $("#etatCopie");
      etat.hidden = false;
      clearTimeout($("#copierCss").minuteur);
      $("#copierCss").minuteur = setTimeout(() => { etat.hidden = true; }, 2200);
    } catch {
      // Presse-papiers refusé (page ouverte en file://) : on sélectionne,
      // Ctrl+C fait le reste.
      const plage = document.createRange();
      plage.selectNodeContents($("#sortieCss"));
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(plage);
    }
  });

  /* ------------------------------------------------------------------
     LIAISONS
     ------------------------------------------------------------------ */

  lieCouleur("#pipetteTexte", "#hexTexte", majDuo);
  lieCouleur("#pipetteFond", "#hexFond", majDuo);
  lieCouleur("#pipetteBase", "#hexBase", majEchelle);

  majDuo();
  majEchelle();
})();
