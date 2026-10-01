// Charge assets/config.js (fichier unique partagé avec le navigateur).
import '../assets/config.js';

export const CONFIG = globalThis.LALLA_CONFIG;
export const MARQUE = CONFIG.brand.name;
