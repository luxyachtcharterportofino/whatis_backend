// 🧹 Pulisce solo zone vuote (senza coordinate) dal DB remoto
require("dotenv").config();
const mongoose = require("mongoose");
const Zone = require("./models/Zone");

async function pulisciZone() {
  try {
    console.log("🌍 Connessione a MongoDB remoto...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("🔍 Ricerca zone con 0 coordinate...");
    const daEliminare = await Zone.find({
      $or: [
        { coordinates: { $exists: false } },
        { coordinates: { $size: 0 } },
      ],
    });

    if (daEliminare.length === 0) {
      console.log("✅ Nessuna zona vuota trovata.");
    } else {
      console.log(`⚠️ Verranno eliminate ${daEliminare.length} zone:`);
      daEliminare.forEach(z => console.log(` - ${z.name || "(senza nome)"}`));

      const res = await Zone.deleteMany({
        $or: [
          { coordinates: { $exists: false } },
          { coordinates: { $size: 0 } },
        ],
      });

      console.log(`🗑️ Zone eliminate: ${res.deletedCount}`);
    }

    await mongoose.connection.close();
    console.log("🔌 Connessione chiusa. Pulizia completata.");
  } catch (err) {
    console.error("❌ Errore durante la pulizia:", err);
  }
}

pulisciZone();