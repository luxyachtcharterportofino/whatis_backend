// ===============================
// 🌊 Andaly Whatis - Modello Aree Geografiche
// ===============================

const mongoose = require("mongoose");

/**
 * Schema per le Macro-Aree Geografiche
 * Organizza le zone in gruppi logici per l'app mobile
 */
const geographicAreaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    // Ordinamento per la visualizzazione nell'app
    sortOrder: {
      type: Number,
      default: 0
    },
    // Colore distintivo per l'area geografica
    color: {
      type: String,
      default: "#007bff"
    },
    // Icona rappresentativa dell'area
    icon: {
      type: String,
      default: "🌊"
    },
    // Prezzo base per l'area (in centesimi di euro)
    basePrice: {
      type: Number,
      default: 299 // 2.99€
    },
    // Stato dell'area (attiva/disattiva per vendita)
    isActive: {
      type: Boolean,
      default: true
    },
    // Metadati per l'app mobile
    metadata: {
      // Coordinate del centro dell'area per la mappa
      centerLat: { type: Number, default: 0 },
      centerLng: { type: Number, default: 0 },
      // Livello di zoom suggerito
      zoomLevel: { type: Number, default: 10 },
      // Immagine di anteprima per l'app
      previewImage: { type: String, default: "" },
      // Tags per ricerca e categorizzazione
      tags: [{ type: String }],
      // Lingua principale dell'area
      primaryLanguage: { 
        type: String, 
        enum: ["it", "fr", "en", "es", "de"],
        default: "it"
      }
    },
    // Traduzioni per l'app multilingua
    translations: {
      en: {
        displayName: { type: String, default: "" },
        description: { type: String, default: "" }
      },
      fr: {
        displayName: { type: String, default: "" },
        description: { type: String, default: "" }
      },
      es: {
        displayName: { type: String, default: "" },
        description: { type: String, default: "" }
      },
      de: {
        displayName: { type: String, default: "" },
        description: { type: String, default: "" }
      }
    }
  },
  {
    timestamps: true
  }
);

// Indici per performance
geographicAreaSchema.index({ sortOrder: 1 });
geographicAreaSchema.index({ isActive: 1 });
geographicAreaSchema.index({ name: 1 });

// Virtual per contare le zone associate
geographicAreaSchema.virtual('zoneCount', {
  ref: 'Zone',
  localField: '_id',
  foreignField: 'geographicArea',
  count: true
});

// Metodi di istanza
geographicAreaSchema.methods.getDisplayName = function(language = 'it') {
  if (language !== 'it' && this.translations[language] && this.translations[language].displayName) {
    return this.translations[language].displayName;
  }
  return this.displayName;
};

geographicAreaSchema.methods.getDescription = function(language = 'it') {
  if (language !== 'it' && this.translations[language] && this.translations[language].description) {
    return this.translations[language].description;
  }
  return this.description;
};

// Metodi statici
geographicAreaSchema.statics.getActiveAreas = function() {
  return this.find({ isActive: true }).sort({ sortOrder: 1 });
};

geographicAreaSchema.statics.getAreaWithZones = function(areaId) {
  return this.findById(areaId).populate('zones');
};

module.exports = mongoose.model("GeographicArea", geographicAreaSchema);
