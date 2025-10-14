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
  source: { 
    type: String, 
    enum: ["manual", "AI", "ai", "internet", "osm", "wikipedia"],
    default: "manual"
  },
  imageUrl: { type: String, default: "" },
  
  // AI and external data enrichment
  extraInfo: {
    aiSummary: { type: String, default: "" },
    historicalFacts: { type: String, default: "" },
    curiosities: { type: String, default: "" },
    wikipediaUrl: { type: String, default: "" },
    osmId: { type: String, default: "" },
    tags: [{ type: String }],
    rating: { type: Number, min: 0, max: 5, default: 0 },
    accessibility: { type: String, enum: ["public", "private", "restricted", "guided tours", "limited", "no", "yes"], default: "public" }
  },
  
  // Icon management
  customIcon: { type: String, default: "" }, // Custom icon set by admin (overrides category icon)
  
  // Multilingual system - 5 languages support
  multilingual: {
    en: { // English
      name: { type: String, default: "" },
      description: { type: String, default: "" },
      aiSummary: { type: String, default: "" },
      curiosities: { type: String, default: "" },
      historicalFacts: { type: String, default: "" }
    },
    fr: { // French
      name: { type: String, default: "" },
      description: { type: String, default: "" },
      aiSummary: { type: String, default: "" },
      curiosities: { type: String, default: "" },
      historicalFacts: { type: String, default: "" }
    },
    es: { // Spanish
      name: { type: String, default: "" },
      description: { type: String, default: "" },
      aiSummary: { type: String, default: "" },
      curiosities: { type: String, default: "" },
      historicalFacts: { type: String, default: "" }
    },
    de: { // German
      name: { type: String, default: "" },
      description: { type: String, default: "" },
      aiSummary: { type: String, default: "" },
      curiosities: { type: String, default: "" },
      historicalFacts: { type: String, default: "" }
    },
    ru: { // Russian
      name: { type: String, default: "" },
      description: { type: String, default: "" },
      aiSummary: { type: String, default: "" },
      curiosities: { type: String, default: "" },
      historicalFacts: { type: String, default: "" }
    }
  },
  
  // AR-ready fields
  arIcon: { type: String, default: "" }, // Icon reference for AR display (auto-synced with customIcon or category)
  arPriority: { type: Number, default: 1 }, // Display priority in AR
  arVisible: { type: Boolean, default: true }, // Whether to show in AR
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
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
  
  // Other languages from multilingual field
  const langContent = this.multilingual?.[lang];
  if (!langContent) {
    // Fallback to Italian if language not available
    return this.getLocalizedContent('it');
  }
  
  return {
    name: langContent.name || this.name, // Fallback to Italian name
    description: langContent.description || this.description,
    aiSummary: langContent.aiSummary || this.extraInfo?.aiSummary || '',
    curiosities: langContent.curiosities || this.extraInfo?.curiosities || '',
    historicalFacts: langContent.historicalFacts || this.extraInfo?.historicalFacts || ''
  };
};

// Helper method to check if translations are complete for a language
poiSchema.methods.isTranslationComplete = function(lang = 'en') {
  if (lang === 'it') return true; // Italian is always complete (base language)
  
  const langContent = this.multilingual?.[lang];
  if (!langContent) return false;
  
  return !!(
    langContent.name && langContent.name.trim() &&
    langContent.description && langContent.description.trim() &&
    langContent.aiSummary && langContent.aiSummary.trim()
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

// Pre-save hook to sync arIcon with customIcon
poiSchema.pre('save', function(next) {
  // Auto-sync arIcon for AR compatibility
  if (this.customIcon && this.customIcon.trim()) {
    this.arIcon = this.customIcon;
  } else if (!this.arIcon || !this.arIcon.trim()) {
    this.arIcon = this.getEffectiveIcon();
  }
  next();
});

module.exports = mongoose.model("Poi", poiSchema);