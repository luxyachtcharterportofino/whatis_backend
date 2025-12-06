#!/usr/bin/env node

/**
 * Script di inizializzazione delle Macro-Aree Geografiche
 * Crea le aree geografiche predefinite per l'app mobile
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const GeographicArea = require("../models/GeographicArea");

// Carica configurazione
dotenv.config();

// Definizione delle macro-aree geografiche
const GEOGRAPHIC_AREAS = [
  {
    name: "tirreno_settentrionale",
    displayName: "Tirreno Settentrionale",
    description: "Costa ligure e alta Toscana: Cinque Terre, Golfo dei Poeti, Versilia",
    sortOrder: 1,
    color: "#1e88e5",
    icon: "🏔️",
    basePrice: 399, // 3.99€
    metadata: {
      centerLat: 44.1,
      centerLng: 9.8,
      zoomLevel: 9,
      tags: ["liguria", "toscana", "cinque_terre", "costa"],
      primaryLanguage: "it"
    },
    translations: {
      en: {
        displayName: "Northern Tyrrhenian",
        description: "Ligurian coast and northern Tuscany: Cinque Terre, Gulf of Poets, Versilia"
      },
      fr: {
        displayName: "Tyrrhénienne du Nord",
        description: "Côte ligure et Toscane du nord : Cinque Terre, Golfe des Poètes, Versilia"
      }
    }
  },
  {
    name: "tirreno_centrale",
    displayName: "Tirreno Centrale",
    description: "Toscana marittima e Lazio: Arcipelago Toscano, Maremma, Costa Laziale",
    sortOrder: 2,
    color: "#43a047",
    icon: "🏝️",
    basePrice: 349, // 3.49€
    metadata: {
      centerLat: 42.5,
      centerLng: 11.2,
      zoomLevel: 8,
      tags: ["toscana", "lazio", "arcipelago", "maremma"],
      primaryLanguage: "it"
    },
    translations: {
      en: {
        displayName: "Central Tyrrhenian",
        description: "Maritime Tuscany and Lazio: Tuscan Archipelago, Maremma, Lazio Coast"
      },
      fr: {
        displayName: "Tyrrhénienne Centrale",
        description: "Toscane maritime et Latium : Archipel toscan, Maremme, Côte du Latium"
      }
    }
  },
  {
    name: "tirreno_meridionale",
    displayName: "Tirreno Meridionale",
    description: "Campania, Calabria e Sicilia occidentale: Costiera Amalfitana, Cilento, Eolie",
    sortOrder: 3,
    color: "#e53935",
    icon: "🌋",
    basePrice: 449, // 4.49€
    metadata: {
      centerLat: 40.2,
      centerLng: 14.8,
      zoomLevel: 8,
      tags: ["campania", "calabria", "sicilia", "amalfi", "cilento"],
      primaryLanguage: "it"
    },
    translations: {
      en: {
        displayName: "Southern Tyrrhenian",
        description: "Campania, Calabria and western Sicily: Amalfi Coast, Cilento, Aeolian Islands"
      },
      fr: {
        displayName: "Tyrrhénienne du Sud",
        description: "Campanie, Calabre et Sicile occidentale : Côte amalfitaine, Cilento, Éoliennes"
      }
    }
  },
  {
    name: "isole_minori_tirreno",
    displayName: "Isole Minori Tirreno",
    description: "Arcipelaghi e isole minori: Elba, Giglio, Capraia, Ponza, Ischia, Capri",
    sortOrder: 4,
    color: "#00acc1",
    icon: "🏖️",
    basePrice: 299, // 2.99€
    metadata: {
      centerLat: 42.0,
      centerLng: 12.0,
      zoomLevel: 7,
      tags: ["isole", "arcipelago", "elba", "capri", "ischia"],
      primaryLanguage: "it"
    },
    translations: {
      en: {
        displayName: "Tyrrhenian Minor Islands",
        description: "Archipelagos and minor islands: Elba, Giglio, Capraia, Ponza, Ischia, Capri"
      },
      fr: {
        displayName: "Îles Mineures Tyrrhéniennes",
        description: "Archipels et îles mineures : Elbe, Giglio, Capraia, Ponza, Ischia, Capri"
      }
    }
  },
  {
    name: "costa_azzurra",
    displayName: "Costa Azzurra",
    description: "Riviera francese: Nizza, Cannes, Saint-Tropez, Monaco, Antibes",
    sortOrder: 5,
    color: "#3f51b5",
    icon: "🇫🇷",
    basePrice: 499, // 4.99€
    metadata: {
      centerLat: 43.7,
      centerLng: 7.2,
      zoomLevel: 9,
      tags: ["francia", "riviera", "nizza", "cannes", "monaco"],
      primaryLanguage: "fr"
    },
    translations: {
      en: {
        displayName: "French Riviera",
        description: "French Riviera: Nice, Cannes, Saint-Tropez, Monaco, Antibes"
      },
      fr: {
        displayName: "Côte d'Azur",
        description: "Riviera française : Nice, Cannes, Saint-Tropez, Monaco, Antibes"
      }
    }
  },
  {
    name: "nord_sardegna",
    displayName: "Nord Sardegna",
    description: "Sardegna settentrionale: Costa Smeralda, Arcipelago della Maddalena, Alghero",
    sortOrder: 6,
    color: "#8bc34a",
    icon: "🏝️",
    basePrice: 399, // 3.99€
    metadata: {
      centerLat: 41.0,
      centerLng: 9.0,
      zoomLevel: 9,
      tags: ["sardegna", "costa_smeralda", "maddalena", "alghero"],
      primaryLanguage: "it"
    },
    translations: {
      en: {
        displayName: "Northern Sardinia",
        description: "Northern Sardinia: Costa Smeralda, Maddalena Archipelago, Alghero"
      },
      fr: {
        displayName: "Sardaigne du Nord",
        description: "Sardaigne septentrionale : Costa Smeralda, Archipel de la Maddalena, Alghero"
      }
    }
  }
];

async function initializeGeographicAreas() {
  try {
    console.log("🚀 Inizializzazione Aree Geografiche...");
    
    // Connessione a MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("✅ Connesso a MongoDB");
    
    // Verifica se esistono già aree geografiche
    const existingCount = await GeographicArea.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️ Trovate ${existingCount} aree geografiche esistenti`);
      console.log("💡 Per reinizializzare, elimina prima le aree esistenti");
      process.exit(0);
    }
    
    // Crea le aree geografiche
    console.log("📝 Creazione aree geografiche...");
    const createdAreas = [];
    
    for (const areaData of GEOGRAPHIC_AREAS) {
      const area = new GeographicArea(areaData);
      const saved = await area.save();
      createdAreas.push(saved);
      console.log(`✅ Creata: ${saved.displayName} (${saved._id})`);
    }
    
    console.log(`\n🎉 Inizializzazione completata!`);
    console.log(`📊 Aree geografiche create: ${createdAreas.length}`);
    console.log(`\n📋 Riepilogo aree:`);
    
    createdAreas.forEach((area, index) => {
      console.log(`${index + 1}. ${area.displayName} - €${(area.basePrice / 100).toFixed(2)}`);
    });
    
    console.log(`\n💡 Prossimi passi:`);
    console.log(`1. Assegna le zone esistenti alle aree geografiche`);
    console.log(`2. Configura l'interfaccia admin per gestire le aree`);
    console.log(`3. Crea le API per l'app mobile`);
    
  } catch (error) {
    console.error("❌ Errore durante l'inizializzazione:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnesso da MongoDB");
  }
}

// Esegui inizializzazione
if (require.main === module) {
  initializeGeographicAreas();
}

module.exports = { GEOGRAPHIC_AREAS, initializeGeographicAreas };
