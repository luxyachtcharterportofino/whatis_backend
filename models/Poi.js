// =======================================
// MODELLO POI — Andaly Whatis (v1.1)
// =======================================

const mongoose = require("mongoose");

const PoiSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  zone: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },

  description: {
    it: { type: String, default: "" },
    en: { type: String, default: "" },
    de: { type: String, default: "" },
    fr: { type: String, default: "" },
  },

  category: { type: String, default: "generico" },
  images: [{ type: String }],
  audioGuide: [{ type: String }],
  videoUrl: { type: String, default: "" },
  visibilityRange: { type: Number, default: 300 },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Poi", PoiSchema);