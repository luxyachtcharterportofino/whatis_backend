// ===============================
// 🎨 Libreria Icone POI
// ===============================

/**
 * Libreria completa di icone organizzate per categoria
 * Ogni categoria ha icone predefinite + icone alternative
 */
const iconLibrary = {
  // Edifici Religiosi
  religious: {
    name: "Edifici Religiosi",
    icons: ["⛪", "⛩️", "🕌", "🛕", "✝️", "☪️", "✡️", "☸️", "🔯", "☦️"]
  },
  
  // Cultura e Musei
  culture: {
    name: "Cultura e Musei",
    icons: ["🏛️", "🖼️", "🎭", "🎨", "📚", "🏺", "🗿", "🎪", "🎬", "📖"]
  },
  
  // Mare e Nautica
  maritime: {
    name: "Mare e Nautica",
    icons: ["⚓", "🚢", "⛵", "🛥️", "🏖️", "🌊", "🐚", "🦈", "🐠", "🏄"]
  },
  
  // Natura e Paesaggi
  nature: {
    name: "Natura e Paesaggi",
    icons: ["🌳", "🌲", "🌴", "🌿", "🍃", "🌺", "🌸", "🦋", "🐦", "🦅"]
  },
  
  // Montagna e Trekking
  mountain: {
    name: "Montagna e Trekking",
    icons: ["⛰️", "🏔️", "🗻", "🏕️", "⛺", "🥾", "🧗", "🎿", "⛷️", "🏂"]
  },
  
  // Grotte e Sotterranei
  caves: {
    name: "Grotte e Sotterranei",
    icons: ["🕳️", "🦇", "💎", "⛏️", "🔦", "🪨", "🏔️", "⚡", "💧", "🌌"]
  },
  
  // Cibo e Ristorazione
  food: {
    name: "Cibo e Ristorazione",
    icons: ["🍽️", "🍕", "🍝", "🍷", "🥘", "🍰", "☕", "🍺", "🥗", "🧆"]
  },
  
  // Alloggi e Strutture
  accommodation: {
    name: "Alloggi e Strutture",
    icons: ["🏨", "🏩", "🏠", "🏡", "🏘️", "🏰", "🏯", "🛏️", "🚪", "🔑"]
  },
  
  // Eventi e Intrattenimento
  events: {
    name: "Eventi e Intrattenimento",
    icons: ["🎉", "🎊", "🎈", "🎆", "🎇", "🎭", "🎪", "🎡", "🎢", "🎠"]
  },
  
  // Punti Panoramici
  viewpoints: {
    name: "Punti Panoramici",
    icons: ["👁️", "📸", "🌅", "🌄", "🌇", "🌆", "🌃", "🔭", "🎑", "🗻"]
  },
  
  // Fari e Segnalazioni
  lighthouses: {
    name: "Fari e Segnalazioni",
    icons: ["🗼", "💡", "🔦", "⚡", "🌟", "✨", "💫", "🌠", "🔆", "☀️"]
  },
  
  // Laghi e Fiumi
  water: {
    name: "Laghi e Fiumi",
    icons: ["🏞️", "🌊", "💧", "💦", "🌈", "🏝️", "🛶", "🚣", "🏊", "🤿"]
  },
  
  // Relitti e Archeologia Subacquea
  underwater: {
    name: "Relitti e Archeologia",
    icons: ["🚢", "⚓", "🏴‍☠️", "💀", "⚔️", "🗡️", "🛡️", "👑", "💰", "🏺"]
  },
  
  // Storia e Monumenti
  historical: {
    name: "Storia e Monumenti",
    icons: ["🏛️", "🏰", "🗿", "🗽", "🕌", "⛩️", "🏯", "🏟️", "🎖️", "⚔️"]
  },
  
  // Sport e Attività
  sports: {
    name: "Sport e Attività",
    icons: ["⚽", "🏀", "🎾", "🏐", "🏈", "⛳", "🎣", "🏄", "🚴", "🤾"]
  },
  
  // Trasporti e Infrastrutture
  transport: {
    name: "Trasporti",
    icons: ["🚂", "🚃", "🚄", "🚅", "🚆", "🚇", "🚈", "🚉", "🚊", "🚝"]
  },
  
  // Shopping e Commercio
  shopping: {
    name: "Shopping e Commercio",
    icons: ["🛍️", "🏪", "🏬", "🛒", "💳", "💰", "💵", "🏦", "📦", "🎁"]
  },
  
  // Generico e Altro
  general: {
    name: "Generico e Altro",
    icons: ["📍", "📌", "🎯", "⭐", "🔷", "🔶", "🔴", "🟢", "🟡", "🟣"]
  }
};

/**
 * Mappa categorie POI → gruppi icone suggeriti
 */
const categoryIconGroups = {
  'church': ['religious', 'historical', 'culture'],
  'monument': ['historical', 'culture', 'general'],
  'marina': ['maritime', 'transport'],
  'beach': ['maritime', 'nature', 'sports'],
  'biological': ['nature', 'water'],
  'wreck': ['underwater', 'maritime', 'historical'],
  'viewpoint': ['viewpoints', 'nature', 'mountain'],
  'village': ['accommodation', 'historical', 'general'],
  'event': ['events', 'culture', 'general'],
  'restaurant': ['food', 'general'],
  'hotel': ['accommodation', 'general'],
  'museum': ['culture', 'historical'],
  'park': ['nature', 'sports'],
  'harbor': ['maritime', 'transport'],
  'lighthouse': ['lighthouses', 'maritime', 'historical'],
  'cave': ['caves', 'nature', 'mountain'],
  'mountain': ['mountain', 'nature', 'sports'],
  'lake': ['water', 'nature', 'sports'],
  'river': ['water', 'nature'],
  'other': ['general']
};

/**
 * Ottiene le icone suggerite per una categoria specifica
 * @param {string} category - Categoria POI
 * @returns {Array} Array di icone suggerite
 */
function getSuggestedIcons(category) {
  const groups = categoryIconGroups[category] || ['general'];
  const icons = [];
  
  groups.forEach(group => {
    if (iconLibrary[group]) {
      icons.push(...iconLibrary[group].icons);
    }
  });
  
  return [...new Set(icons)]; // Rimuove duplicati
}

/**
 * Ottiene tutte le icone disponibili
 * @returns {Array} Array di tutte le icone
 */
function getAllIcons() {
  const allIcons = [];
  Object.values(iconLibrary).forEach(group => {
    allIcons.push(...group.icons);
  });
  return [...new Set(allIcons)];
}

/**
 * Valida se una stringa è un'emoji valida
 * @param {string} icon - Stringa da validare
 * @returns {boolean} True se è un'emoji
 */
function isValidEmoji(icon) {
  if (!icon || typeof icon !== 'string') return false;
  // Regex per rilevare emoji Unicode
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  return emojiRegex.test(icon);
}

// Export per uso in Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    iconLibrary,
    categoryIconGroups,
    getSuggestedIcons,
    getAllIcons,
    isValidEmoji
  };
}

