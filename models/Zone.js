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
    }
  },
  {
    timestamps: true // Aggiunge campi createdAt / updatedAt
  }
);

// Esporta il modello
module.exports = mongoose.model("Zone", zoneSchema);