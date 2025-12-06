// ===============================
// 📋 Proposed POI Model
// Modello per POI proposti in attesa di revisione
// ===============================

const mongoose = require("mongoose");

const proposedPoiSchema = new mongoose.Schema({
  // Informazioni base
  name: { 
    type: String, 
    required: true,
    trim: true
  },
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
  description: { 
    type: String, 
    default: "" 
  },
  municipality: { 
    type: String, 
    default: "",
    trim: true
  },
  
  // Coordinate
  lat: { 
    type: Number, 
    required: false  // Può mancare per POI marini
  },
  lon: { 
    type: Number, 
    required: false  // Può mancare per POI marini
  },
  
  // Campi specifici marini
  depth: { 
    type: Number, 
    required: false  // Solo per POI marini (relitti)
  },
  marine_type: { 
    type: String, 
    enum: [null, "relitto"],
    default: null
  },
  
  // Metadati
  source_url: { 
    type: String, 
    default: "" 
  },
  missing_coords: { 
    type: Boolean, 
    default: false 
  },
  needs_review: { 
    type: Boolean, 
    default: true  // Di default richiede revisione
  },
  duplicate_of: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Poi",
    default: null  // Se trovato duplicato automatico
  },
  quality_score: { 
    type: Number, 
    min: 0, 
    max: 100, 
    default: 50 
  },
  
  // Relazioni
  zone_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Zone", 
    required: true 
  },
  
  // Timestamps
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  },
  
  // Stato
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "merged"],
    default: "pending"
  },
  
  // Note per admin
  admin_notes: {
    type: String,
    default: ""
  },
  
  // Coordinate status
  coordStatus: {
    type: String,
    enum: ["confirmed", "unconfirmed", "missing"],
    default: "unconfirmed"
  }
});

// Indici per performance
proposedPoiSchema.index({ zone_id: 1, status: 1 });
proposedPoiSchema.index({ duplicate_of: 1 });
proposedPoiSchema.index({ missing_coords: 1, needs_review: 1 });
proposedPoiSchema.index({ created_at: -1 });

// Pre-save hook per aggiornare updated_at e coordStatus
proposedPoiSchema.pre('save', function(next) {
  this.updated_at = new Date();
  
  // Auto-set coordStatus based on coordinates
  if (!this.lat || !this.lng) {
    this.coordStatus = "missing";
  } else {
    // Se le coordinate esistono, usa "unconfirmed" (sarà "confirmed" solo se modificato manualmente)
    this.coordStatus = "unconfirmed";
  }
  
  next();
});

const ProposedPOI = mongoose.model("ProposedPOI", proposedPoiSchema);

module.exports = ProposedPOI;

