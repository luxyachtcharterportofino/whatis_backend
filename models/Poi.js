const mongoose = require("mongoose");

const poiSchema = new mongoose.Schema({
  // Basic information
  name: { type: String, required: true },
  description: { type: String, default: "" },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  zone: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
  
  // Smart POI system fields
  category: { 
    type: String, 
    enum: [
      "monument", "church", "marina", "beach", "biological", 
      "wreck", "viewpoint", "village", "event", "restaurant",
      "hotel", "museum", "park", "harbor", "lighthouse",
      "cave", "mountain", "lake", "river", "villa", "other"
    ],
    default: "other"
  },
  // Nuovo campo per categoria semantica intelligente
  semanticCategory: { type: String, default: "" },
  source: { 
    type: String, 
    enum: ["manual", "AI", "internet", "osm", "wikipedia", "perplexity", "gpt"],
    default: "manual"
  },
  imageUrl: { type: String, default: "" },
  
  // Image license status
  imageLicenseStatus: {
    status: {
      type: String,
      enum: ["free", "needs_attribution", "needs_replacement", "unknown", "not_checked"],
      default: "not_checked"
    },
    source: { type: String, default: "" }, // Source of the image (e.g., "wikipedia", "unsplash", "pexels", "manual")
    author: { type: String, default: "" }, // Author name if attribution needed
    authorUrl: { type: String, default: "" }, // URL to author's profile/page
    license: { type: String, default: "" }, // License type (e.g., "CC BY-SA 4.0", "Public Domain")
    photoUrl: { type: String, default: "" }, // Original photo page URL (for linking)
    attribution: { type: String, default: "" }, // Attribution text (e.g., "Photo by John Doe on Unsplash")
    checkedAt: { type: Date, default: null }, // When the license was last checked
    notes: { type: String, default: "" } // Additional notes about the license
  },
  
  // AI and external data enrichment
  extraInfo: {
    aiSummary: { type: String, default: "" },
    historicalFacts: { type: String, default: "" },
    curiosities: { type: String, default: "" },
    wikipediaUrl: { type: String, default: "" },
    osmId: { type: String, default: "" },
    tags: [{ type: String }],
    rating: { type: Number, min: 0, max: 5, default: 0 },
    accessibility: { type: String, enum: ["public", "private", "restricted", "guided_tours", "limited"], default: "public" }
  },
  
  // Icon management
  customIcon: { type: String, default: "" }, // Custom icon set by admin (overrides category icon)
  
  // Multilingual system (dynamic languages)
  multilingual: { type: mongoose.Schema.Types.Mixed, default: {} },
  
  // AR-ready fields
  arIcon: { type: String, default: "" }, // Icon reference for AR display (auto-synced with customIcon or category)
  arPriority: { type: Number, default: 1 }, // Display priority in AR
  arVisible: { type: Boolean, default: true }, // Whether to show in AR
  
  // Coordinate status
  coordStatus: {
    type: String,
    enum: ["confirmed", "unconfirmed", "missing"],
    default: "unconfirmed"
  },
  
  // Definitive status - POI definitivi sono immodificabili sulla mappa e scaricabili dai turisti
  isDefinitive: {
    type: Boolean,
    default: false
  },
  
  // Timestamps
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for efficient queries
poiSchema.index({ zone: 1, category: 1 });
poiSchema.index({ lat: 1, lng: 1 });
poiSchema.index({ source: 1 });

// Helper method to get effective icon (custom or category default)
poiSchema.methods.getEffectiveIcon = function() {
  // Priority: customIcon > arIcon > category default icon
  if (this.customIcon && this.customIcon.trim()) {
    return this.customIcon;
  }
  if (this.arIcon && this.arIcon.trim()) {
    return this.arIcon;
  }
  
  // Category default icons
  const categoryIcons = {
    'monument': '🏛️',
    'church': '⛪',
    'marina': '⚓',
    'beach': '🏖️',
    'biological': '🌿',
    'wreck': '🚢',
    'viewpoint': '👁️',
    'village': '🏘️',
    'event': '🎉',
    'restaurant': '🍽️',
    'hotel': '🏨',
    'museum': '🖼️',
    'park': '🌳',
    'harbor': '🚢',
    'lighthouse': '🗼',
    'cave': '🕳️',
    'mountain': '⛰️',
    'lake': '🏞️',
    'river': '🌊',
    'other': '📍'
  };
  
  return categoryIcons[this.category] || '📍';
};

// Helper method to get content in specific language
poiSchema.methods.getLocalizedContent = function(lang = 'it') {
  // Italian is the base language (stored in main fields)
  if (lang === 'it') {
    return {
      name: this.name,
      description: this.description,
      aiSummary: this.extraInfo?.aiSummary || '',
      curiosities: this.extraInfo?.curiosities || '',
      historicalFacts: this.extraInfo?.historicalFacts || ''
    };
  }
  
  // Other languages from multilingual field - only name and description are translated
  const langContent = this.multilingual?.[lang];
  if (!langContent) {
    // Fallback to Italian if language not available
    return this.getLocalizedContent('it');
  }
  
  return {
    name: langContent.name || this.name, // Fallback to Italian name
    description: langContent.description || this.description,
    // Extra fields always come from Italian extraInfo (not translated)
    aiSummary: this.extraInfo?.aiSummary || '',
    curiosities: this.extraInfo?.curiosities || '',
    historicalFacts: this.extraInfo?.historicalFacts || ''
  };
};

// Helper method to check if translations are complete for a language
poiSchema.methods.isTranslationComplete = function(lang = 'en') {
  if (lang === 'it') return true; // Italian is always complete (base language)
  
  const langContent = this.multilingual?.[lang];
  if (!langContent) return false;
  
  // Translation is complete if name AND description are present
  // aiSummary, curiosities, and historicalFacts are optional
  return !!(
    langContent.name && langContent.name.trim() &&
    langContent.description && langContent.description.trim()
  );
};

// Helper method to get available languages
poiSchema.methods.getAvailableLanguages = function() {
  const languages = ['it']; // Italian is always available
  
  Object.keys(this.multilingual || {}).forEach(lang => {
    if (this.isTranslationComplete(lang)) {
      languages.push(lang);
    }
  });
  
  return languages;
};

// Pre-save hook to sync arIcon with customIcon and set coordStatus
poiSchema.pre('save', function(next) {
  // Auto-sync arIcon for AR compatibility
  if (this.customIcon && this.customIcon.trim()) {
    this.arIcon = this.customIcon;
  } else if (!this.arIcon || !this.arIcon.trim()) {
    this.arIcon = this.getEffectiveIcon();
  }
  
  // Auto-set coordStatus based on coordinates
  if (!this.lat || !this.lng) {
    this.coordStatus = "missing";
  } else if (this.isNew || this.isModified('lat') || this.isModified('lng')) {
    // Se è nuovo o le coordinate sono state modificate
    // Se coordStatus è già "confirmed" (impostato manualmente o per POI definitivo), mantienilo
    // Altrimenti, se è "missing" o non impostato, usa "unconfirmed"
    if (this.coordStatus === "confirmed") {
      // Mantieni "confirmed" - non sovrascrivere se già confermato
      // Questo è importante per i POI definitivi che vengono modificati
    } else if (!this.coordStatus || this.coordStatus === "missing") {
      this.coordStatus = "unconfirmed";
    }
  }
  
  next();
});

module.exports = mongoose.model("Poi", poiSchema);