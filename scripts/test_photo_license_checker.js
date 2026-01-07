/**
 * Script di test per il Photo License Checker
 * 
 * Verifica le licenze delle foto di alcuni POI per testare il sistema
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PhotoLicenseChecker = require('../services/photoLicenseChecker');
const Poi = require('../models/Poi');

async function testPhotoLicenseChecker() {
  try {
    // Connessione al database
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI o MONGODB_URI non trovato nel file .env');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connesso al database MongoDB');

    // Prima prova con POI definitivi, poi con qualsiasi POI con foto
    let pois = await Poi.find({
      isDefinitive: true,
      imageUrl: { $exists: true, $ne: '' }
    }).limit(5);

    if (pois.length === 0) {
      console.log('⚠️ Nessun POI definitivo con foto trovato');
      console.log('🔍 Cercando qualsiasi POI con foto...\n');
      
      pois = await Poi.find({
        imageUrl: { $exists: true, $ne: '' }
      }).limit(5);
    }

    if (pois.length === 0) {
      console.log('⚠️ Nessun POI con foto trovato nel database');
      console.log('💡 Prova ad aggiungere foto ai POI per testare il sistema');
      await mongoose.disconnect();
      return;
    }

    console.log(`\n🔍 Trovati ${pois.length} POI con foto da testare\n`);

    const checker = new PhotoLicenseChecker();
    const results = {
      total: pois.length,
      checked: 0,
      free: 0,
      needsAttribution: 0,
      needsReplacement: 0,
      unknown: 0,
      not_checked: 0,
      errors: 0
    };

    // Verifica ogni POI
    for (let i = 0; i < pois.length; i++) {
      const poi = pois[i];
      const isDefinitive = poi.isDefinitive ? '✅ Definitivo' : '⏳ Non definitivo';
      console.log(`\n[${i + 1}/${pois.length}] Verificando POI: "${poi.name}" (${isDefinitive})`);
      console.log(`   📸 Immagine: ${poi.imageUrl || 'Nessuna'}`);

      try {
        const licenseInfo = await checker.checkImageLicense(poi);

        // Mostra icona in base allo stato
        const statusIcons = {
          'free': '🟢',
          'needs_attribution': '🟡',
          'needs_replacement': '🔴',
          'unknown': '🔵',
          'not_checked': '⚪'
        };
        const icon = statusIcons[licenseInfo.status] || '❓';

        console.log(`   ${icon} Stato: ${licenseInfo.status}`);
        if (licenseInfo.source) console.log(`   📍 Fonte: ${licenseInfo.source}`);
        if (licenseInfo.author) console.log(`   👤 Autore: ${licenseInfo.author}`);
        if (licenseInfo.license) console.log(`   📜 Licenza: ${licenseInfo.license}`);
        if (licenseInfo.attribution) console.log(`   📝 Attribuzione: ${licenseInfo.attribution}`);
        if (licenseInfo.notes) console.log(`   💬 Note: ${licenseInfo.notes}`);

        // Aggiorna statistiche
        results.checked++;
        if (licenseInfo.status === 'free') results.free++;
        else if (licenseInfo.status === 'needs_attribution') results.needsAttribution++;
        else if (licenseInfo.status === 'needs_replacement') results.needsReplacement++;
        else if (licenseInfo.status === 'unknown') results.unknown++;
        else if (licenseInfo.status === 'not_checked') results.not_checked++;

        // Aggiorna il POI nel database
        if (!poi.imageLicenseStatus) {
          poi.imageLicenseStatus = {};
        }
        poi.imageLicenseStatus.status = licenseInfo.status;
        poi.imageLicenseStatus.source = licenseInfo.source || '';
        poi.imageLicenseStatus.author = licenseInfo.author || '';
        poi.imageLicenseStatus.license = licenseInfo.license || '';
        poi.imageLicenseStatus.checkedAt = licenseInfo.checkedAt || new Date();
        poi.imageLicenseStatus.notes = licenseInfo.notes || '';
        
        await poi.save();
        console.log(`   💾 POI aggiornato nel database`);

      } catch (error) {
        console.error(`   ❌ Errore: ${error.message}`);
        results.errors++;
      }

      // Piccola pausa
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Riepilogo finale
    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO VERIFICA');
    console.log('='.repeat(60));
    console.log(`Totale POI testati: ${results.total}`);
    console.log(`✅ Verificati con successo: ${results.checked}`);
    console.log(`   🟢 Libere: ${results.free}`);
    console.log(`   🟡 Richiedono attribuzione: ${results.needsAttribution}`);
    console.log(`   🔴 Da sostituire: ${results.needsReplacement}`);
    console.log(`   🔵 Sconosciute: ${results.unknown}`);
    console.log(`   ⚪ Non verificate: ${results.not_checked}`);
    console.log(`   ❌ Errori: ${results.errors}`);
    console.log('='.repeat(60));

    // Mostra alcuni POI aggiornati
    if (results.checked > 0) {
      console.log('\n📋 Esempi di POI aggiornati:');
      const updatedPois = await Poi.find({
        _id: { $in: pois.map(p => p._id) },
        'imageLicenseStatus.status': { $exists: true }
      }).select('name imageUrl imageLicenseStatus isDefinitive').limit(3);

      updatedPois.forEach(poi => {
        const definitive = poi.isDefinitive ? '✅' : '⏳';
        console.log(`\n   ${definitive} ${poi.name}`);
        console.log(`     📸 ${poi.imageUrl}`);
        if (poi.imageLicenseStatus) {
          const statusIcon = {
            'free': '🟢',
            'needs_attribution': '🟡',
            'needs_replacement': '🔴',
            'unknown': '🔵',
            'not_checked': '⚪'
          }[poi.imageLicenseStatus.status] || '❓';
          console.log(`     ${statusIcon} Stato: ${poi.imageLicenseStatus.status}`);
          if (poi.imageLicenseStatus.source) {
            console.log(`     📍 Fonte: ${poi.imageLicenseStatus.source}`);
          }
          if (poi.imageLicenseStatus.attribution) {
            console.log(`     📝 Attribuzione: ${poi.imageLicenseStatus.attribution}`);
          }
        }
      });
    }

    console.log('\n✅ Test completato con successo!');
    console.log('💡 Puoi ora verificare i risultati nella pagina /admin/pois');
    console.log('💡 Per verificare tutte le foto dei POI definitivi, usa il pulsante "Verifica Licenze Foto" nell\'interfaccia\n');

  } catch (error) {
    console.error('❌ Errore durante il test:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnesso dal database');
  }
}

// Esegui il test
testPhotoLicenseChecker()
  .then(() => {
    console.log('\n✨ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Errore fatale:', error);
    process.exit(1);
  });
