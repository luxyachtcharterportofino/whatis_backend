// 🔎 Verifica contenuto Zone nel database remoto
require("dotenv").config();
const mongoose = require("mongoose");
const Zone = require("./models/Zone");

async function verificaZone() {
  try {
    console.log("🌍 Connessione a MongoDB remoto...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const zones = await Zone.find();
    console.log(`📦 Zone trovate: ${zones.length}\n`);

    zones.forEach(z => {
      const punti = z.coordinates ? z.coordinates.length : 0;
      console.log(`📍 Nome: ${z.name || "(senza nome)"}`);
      console.log(`📝 Descrizione: ${z.description || "-"}`);
      console.log(`📏 Coordinate: ${punti} punti`);
      console.log(`🆔 ID: ${z._id}`);
      console.log("-------------------------------");
    });

    await mongoose.connection.close();
    console.log("✅ Verifica completata e connessione chiusa.");
  } catch (err) {
    console.error("❌ Errore durante la verifica:", err);
  }
}

verificaZone();