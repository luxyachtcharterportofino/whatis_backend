// ===============================
// 🔄 Sincronizza Icone POI Esistenti
// ===============================

const mongoose = require('mongoose');
const Poi = require('./models/Poi');

async function syncPOIIcons() {
  console.log('🔄 SINCRONIZZAZIONE ICONE POI ESISTENTI\n');
  
  try {
    require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI o MONGODB_URI non trovato nel file .env');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connesso a MongoDB\n');

    // Carica tutti i POI
    const allPOIs = await Poi.find();
    console.log(`📊 Trovati ${allPOIs.length} POI nel database\n`);

    let updated = 0;
    let alreadySynced = 0;

    for (const poi of allPOIs) {
      const beforeIcon = poi.arIcon;
      const beforeCustom = poi.customIcon;
      
      // Se non ha customIcon ma ha arIcon, mantieni arIcon
      // Se non ha né customIcon né arIcon, il pre-save hook lo imposterà
      if (!poi.customIcon && !poi.arIcon) {
        // Forza il salvataggio per attivare il pre-save hook
        await poi.save();
        updated++;
        console.log(`✅ ${poi.name}`);
        console.log(`   Prima: customIcon="${beforeCustom}" arIcon="${beforeIcon}"`);
        console.log(`   Dopo:  customIcon="${poi.customIcon}" arIcon="${poi.arIcon}"`);
      } else {
        alreadySynced++;
        console.log(`⏭️  ${poi.name} - già sincronizzato (arIcon: ${poi.arIcon})`);
      }
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 RIEPILOGO SINCRONIZZAZIONE:');
    console.log('═══════════════════════════════════════════════');
    console.log(`✅ POI aggiornati: ${updated}`);
    console.log(`⏭️  POI già sincronizzati: ${alreadySynced}`);
    console.log(`📊 Totale POI: ${allPOIs.length}`);
    console.log('\n✅ Sincronizzazione completata!\n');

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnesso da MongoDB');
  }
}

syncPOIIcons();
