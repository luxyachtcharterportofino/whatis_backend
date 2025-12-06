// ===============================
// 🌊 Andaly Whatis - Modello Zone
// ===============================

const mongoose = require("mongoose");

// Schema delle Zone
const zoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    coordinates: {
      type: Array, // [[lat, lng], [lat, lng], ...]
      required: true
    },
    // NUOVO: Riferimento all'area geografica (opzionale per backward compatibility)
    geographicArea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeographicArea",
      default: null
    },
    // NUOVO: Prezzo specifico della zona (override del prezzo base dell'area)
    customPrice: {
      type: Number,
      default: null // Se null, usa il prezzo dell'area geografica
    },
    // NUOVO: Metadati per l'app mobile
    appMetadata: {
      // Difficoltà di navigazione (per turisti)
      difficulty: { 
        type: String, 
        enum: ["easy", "medium", "hard"],
        default: "easy"
      },
      // Tempo stimato di visita (in ore)
      estimatedVisitTime: { type: Number, default: 2 },
      // Stagione migliore per la visita
      bestSeason: {
        type: String,
        enum: ["spring", "summer", "autumn", "winter", "all_year"],
        default: "all_year"
      },
      // Accessibilità
      accessibility: {
        type: String,
        enum: ["full", "partial", "limited"],
        default: "full"
      }
    },
    // Estensione Marina: se true, abilita ricerca POI marini nell'area della zona
    includeMarineExtension: {
      type: Boolean,
      default: false // Default false per backward compatibility
    }
  },
  {
    timestamps: true // Aggiunge campi createdAt / updatedAt
  }
);

// Esporta il modello
module.exports = mongoose.model("Zone", zoneSchema);