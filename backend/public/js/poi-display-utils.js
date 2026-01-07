// ===============================
// 🎨 POI Display Utilities
// ===============================

/**
 * Category labels with Italian translations, colors, and icons
 */
const categoryLabels = {
  monument: { text: "Monumento", color: "secondary", icon: "🏛️" },
  church: { text: "Chiesa", color: "primary", icon: "⛪" },
  beach: { text: "Spiaggia", color: "info", icon: "🏖️" },
  museum: { text: "Museo", color: "warning", icon: "🏛️" },
  restaurant: { text: "Ristorante", color: "danger", icon: "🍽️" },
  hotel: { text: "Hotel", color: "success", icon: "🏨" },
  marina: { text: "Marina", color: "primary", icon: "⚓" },
  park: { text: "Parco", color: "success", icon: "🌳" },
  mountain: { text: "Montagna", color: "dark", icon: "⛰️" },
  cave: { text: "Grotta", color: "secondary", icon: "🕳️" },
  lighthouse: { text: "Faro", color: "warning", icon: "🗼" },
  wreck: { text: "Relitto", color: "dark", icon: "🚢" },
  viewpoint: { text: "Punto panoramico", color: "info", icon: "👁️" },
  biological: { text: "Biologico", color: "success", icon: "🌿" },
  other: { text: "Altro", color: "dark", icon: "📍" }
};

/**
 * Source labels with Italian translations, colors, and icons
 */
const sourceLabels = {
  manual: { text: "Manuale", color: "warning", icon: "✋" },
  ai: { text: "AI", color: "purple", icon: "🤖" },
  osm: { text: "Open Data", color: "secondary", icon: "🌐" },
  internet: { text: "Internet", color: "info", icon: "🌐" },
  wikipedia: { text: "Wikipedia", color: "light", icon: "📚" }
};

/**
 * Get category label information
 * @param {string} category - The category key
 * @returns {object} Category label object with text, color, and icon
 */
function getCategoryLabel(category) {
  return categoryLabels[category] || categoryLabels.other;
}

/**
 * Get source label information
 * @param {string} source - The source key
 * @returns {object} Source label object with text, color, and icon
 */
function getSourceLabel(source) {
  return sourceLabels[source] || sourceLabels.manual;
}

/**
 * Generate a Bootstrap badge HTML for category
 * @param {string} category - The category key
 * @returns {string} HTML badge string
 */
function getCategoryBadge(category) {
  const label = getCategoryLabel(category);
  return `<span class="badge bg-${label.color} text-white">
    ${label.icon} ${label.text}
  </span>`;
}

/**
 * Generate a Bootstrap badge HTML for source
 * @param {string} source - The source key
 * @returns {string} HTML badge string
 */
function getSourceBadge(source) {
  const label = getSourceLabel(source);
  return `<span class="badge bg-${label.color} text-white">
    ${label.icon} ${label.text}
  </span>`;
}

/**
 * Get the best available description for a POI
 * @param {object} poi - The POI object
 * @returns {string} The best available description
 */
function getBestDescription(poi) {
  // Priority order: description, aiSummary, default
  if (poi.description && poi.description.trim() && poi.description !== "Nessuna descrizione") {
    return poi.description;
  }
  
  if (poi.extraInfo && poi.extraInfo.aiSummary && poi.extraInfo.aiSummary.trim()) {
    return poi.extraInfo.aiSummary;
  }
  
  return "Nessuna descrizione disponibile";
}

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length (default: 100)
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Generate AI generation indicator badge
 * @param {object} poi - The POI object
 * @returns {string} HTML badge string or empty string
 */
function getAIGenerationBadge(poi) {
  if (poi.extraInfo && poi.extraInfo.aiGenerated) {
    return `<span class="badge bg-success ai-badge" title="Generato con AI">
      🧠 AI
    </span>`;
  }
  return '';
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    categoryLabels,
    sourceLabels,
    getCategoryLabel,
    getSourceLabel,
    getCategoryBadge,
    getSourceBadge,
    getBestDescription,
    truncateText,
    getAIGenerationBadge
  };
}
