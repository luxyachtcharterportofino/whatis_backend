// resetData.js — ⚠️ Cancella tutti i dati da Zone e POI

import mongoose from "mongoose";
import dotenv from "dotenv";
import Zone from "./models/Zone.js";
import Poi from "./models/Poi.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function resetDatabase() {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI o MONGODB_URI non trovato nel file .env');
    }
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connesso a MongoDB");

    await Zone.deleteMany({});
    await Poi.deleteMany({});

    console.log("🧹 Tutte le Zone e i POI sono stati eliminati!");
  } catch (err) {
    console.error("❌ Errore durante il reset:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnesso da MongoDB");
  }
}

resetDatabase();