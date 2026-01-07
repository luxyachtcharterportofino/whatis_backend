import mongoose from "mongoose";
import dotenv from "dotenv";
import Zone from "./models/Zone.js";

dotenv.config();

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGO_URI o MONGODB_URI non trovato nel file .env');
  }
  await mongoose.connect(uri);

  const zones = await Zone.find();
  console.log(`🔍 Zone trovate: ${zones.length}`);

  for (const z of zones) {
    let coords = z.coordinates;

    // Se le coordinate non sono un array valido, prova a ricostruirle
    if (!Array.isArray(coords) || coords.length === 0) {
      console.log(`⚠️ Zona "${z.name}" ha coordinate invalide, la ripulisco.`);
      z.coordinates = [];
      await z.save();
      continue;
    }

    // Correggi formato se necessario
    const normalized = coords.map((p) => {
      if (Array.isArray(p)) return [Number(p[0]), Number(p[1])];
      if (p.lat && p.lng) return [Number(p.lat), Number(p.lng)];
      return null;
    }).filter(Boolean);

    if (normalized.length > 0) {
      z.coordinates = normalized;
      await z.save();
      console.log(`✅ Zona "${z.name}" aggiornata con ${normalized.length} punti.`);
    }
  }

  mongoose.disconnect();
  console.log("🏁 Correzione completata!");
};

run().catch((err) => console.error("❌ Errore:", err));