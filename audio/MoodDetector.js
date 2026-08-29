// MoodDetector.js
// Détecte le niveau d'agitation musicale : "calme", "moyen" ou "enerve".
// Basé sur une moyenne glissante de l'énergie (buffer circulaire persistant),
// ce qui évite les sauts instantanés et donne une valeur stable dans le temps.

export default class MoodDetector {

  /**
   * @param {object} options
   * @param {number} options.size    Nombre d'échantillons pour la moyenne glissante (def. 200 ≈ 4s à 50fps)
   * @param {number} options.calmMax   Seuil haut du mode "calme"  (def. 0.4)
   * @param {number} options.hotMin    Seuil bas du mode "enerve"  (def. 0.6)
   * @param {function} options.onMood  Callback (mood, energyLiss) appelé quand le mood change
   */
  constructor(options = {}) {
    this.size    = options.size    ?? 200;
    this.calmMax = options.calmMax ?? 0.4;
    this.hotMin  = options.hotMin  ?? 0.6;
    this.onMood  = options.onMood  ?? null;

    this.buf  = new Float32Array(this.size);
    this.i    = 0;      // index d'écriture (circulaire)
    this.count = 0;     // nombre d'échantillons remplis (jusqu'à size)
    this.sum  = 0;      // somme entretenue pour éviter de tout recalculer

    this.energyLiss = 0;
    this.mood = "calme";
  }

  reset() {
    this.buf.fill(0);
    this.i = 0;
    this.count = 0;
    this.sum = 0;
    this.energyLiss = 0;
    this.mood = "calme";
  }

  /**
   * À appeler à chaque frame avec l'énergie instantanée (idéalement normalisée 0..1).
   * @param {number} energy  énergie instantanée du frame courant
   * @returns {{ mood:string, energyLiss:number, changed:boolean }}
   */
  update(energy) {
    const v = Number(energy) || 0;

    if (this.count < this.size) {
      // phase de remplissage
      this.buf[this.i] = v;
      this.sum += v;
      this.count++;
    } else {
      // buffer plein : on remplace le plus ancien
      this.sum -= this.buf[this.i];
      this.buf[this.i] = v;
      this.sum += v;
    }
    this.i = (this.i + 1) % this.size;

    this.energyLiss = this.sum / this.count;
    // classification avec hystérésis simple via les deux seuils
    let mood;
    if (this.energyLiss >= this.hotMin)      mood = "enerve";
    else if (this.energyLiss >= this.calmMax) mood = "moyen";
    else                                      mood = "calme";

    const changed = mood !== this.mood;
    this.mood = mood;

    if (changed && this.onMood) this.onMood(this.mood, this.energyLiss);

    return { mood: this.mood, energyLiss: this.energyLiss, changed };
  }
}