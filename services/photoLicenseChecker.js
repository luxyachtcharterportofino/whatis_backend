/**
 * Photo License Checker Service
 * 
 * Verifica automaticamente lo stato delle licenze delle immagini dei POI.
 * Controlla metadati EXIF, pattern URL, e fonti note per determinare
 * se un'immagine è libera, richiede attribuzione, o deve essere sostituita.
 * 
 * @module services/photoLicenseChecker
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const exifr = require('exifr');
const axios = require('axios');
const cheerio = require('cheerio');
const Logger = require('../utils/logger');

class PhotoLicenseChecker {
  constructor() {
    // Fonti note di immagini libere
    this.freeImageSources = {
      'wikipedia': {
        patterns: ['commons.wikimedia.org', 'upload.wikimedia.org', 'wikipedia.org'],
        license: 'CC BY-SA or compatible',
        status: 'free',
        requiresAttribution: true
      },
      'unsplash': {
        patterns: ['unsplash.com', 'images.unsplash.com'],
        license: 'Unsplash License',
        status: 'needs_attribution',
        requiresAttribution: true
      },
      'pexels': {
        patterns: ['pexels.com', 'images.pexels.com'],
        license: 'Pexels License',
        status: 'needs_attribution',
        requiresAttribution: true
      },
      'pixabay': {
        patterns: ['pixabay.com', 'cdn.pixabay.com'],
        license: 'Pixabay License',
        status: 'free',
        requiresAttribution: false
      },
      'flickr_cc': {
        patterns: ['flickr.com', 'live.staticflickr.com'],
        license: 'Creative Commons',
        status: 'needs_attribution',
        requiresAttribution: true
      }
    };

    // Pattern per immagini che richiedono sostituzione
    this.restrictedPatterns = [
      'gettyimages',
      'shutterstock',
      'istockphoto',
      'alamy',
      'dreamstime',
      '123rf',
      'depositphotos'
    ];
  }

  /**
   * Verifica la licenza di un'immagine POI
   * @param {Object} poi - Il POI con imageUrl
   * @param {string} imagePath - Percorso fisico dell'immagine (opzionale)
   * @returns {Promise<Object>} Risultato della verifica
   */
  async checkImageLicense(poi, imagePath = null) {
    try {
      // Se non c'è immagine, ritorna stato "not_checked"
      if (!poi.imageUrl || !poi.imageUrl.trim()) {
        return {
          status: 'not_checked',
          source: '',
          author: '',
          license: '',
          attribution: '',
          notes: 'Nessuna immagine presente'
        };
      }

      const imageUrl = poi.imageUrl;
      Logger.info(`🔍 Verifica licenza immagine per POI "${poi.name}": ${imageUrl}`);

      // 1. Verifica pattern URL per fonti note
      const urlCheck = this.checkUrlPattern(imageUrl);
      if (urlCheck) {
        Logger.info(`✅ Trovata fonte nota: ${urlCheck.source}`);
        
        // Prova a ottenere informazioni dettagliate tramite API o scraping
        let detailedInfo = null;
        try {
          if (urlCheck.source === 'unsplash') {
            detailedInfo = await this.fetchUnsplashPhotoInfo(imageUrl);
          } else if (urlCheck.source === 'pexels') {
            detailedInfo = await this.fetchPexelsPhotoInfo(imageUrl);
          } else if (urlCheck.source === 'wikipedia') {
            detailedInfo = await this.fetchWikipediaPhotoInfo(imageUrl);
          }
        } catch (error) {
          Logger.warn(`⚠️ Errore recupero info dettagliate per ${urlCheck.source}:`, error.message);
          // Continua con informazioni base se l'API fallisce
        }
        
        // Usa informazioni dettagliate se disponibili, altrimenti usa quelle base
        const author = detailedInfo?.author || urlCheck.author || '';
        const license = detailedInfo?.license || urlCheck.license;
        const photoUrl = detailedInfo?.photoUrl || imageUrl;
        
        // Genera attribuzione automatica se richiesta
        let attribution = '';
        if (urlCheck.requiresAttribution) {
          attribution = this.generateAttribution(urlCheck.source, author, photoUrl, detailedInfo);
        }
        
        return {
          status: urlCheck.status,
          source: urlCheck.source,
          author: author,
          license: license,
          attribution: attribution,
          photoUrl: photoUrl, // URL originale della foto se disponibile
          notes: urlCheck.notes || '',
          checkedAt: new Date()
        };
      }

      // 2. Se è un'immagine locale, verifica metadati EXIF
      if (imageUrl.startsWith('/photos/') || imageUrl.startsWith('/uploads/')) {
        const localCheck = await this.checkLocalImage(imageUrl, imagePath);
        if (localCheck) {
          Logger.info(`✅ Verifica locale completata: ${localCheck.status}`);
          return {
            status: localCheck.status,
            source: localCheck.source || 'local',
            author: localCheck.author || '',
            license: localCheck.license || '',
            notes: localCheck.notes || '',
            checkedAt: new Date()
          };
        }
      }

      // 3. Verifica se l'URL contiene pattern di immagini protette
      const restrictedCheck = this.checkRestrictedPattern(imageUrl);
      if (restrictedCheck) {
        Logger.warn(`⚠️ Immagine da fonte protetta: ${restrictedCheck.source}`);
        return {
          status: 'needs_replacement',
          source: restrictedCheck.source,
          author: '',
          license: 'Copyrighted',
          notes: `Immagine da ${restrictedCheck.source} - richiede licenza commerciale`,
          checkedAt: new Date()
        };
      }

      // 4. Se è un URL esterno non riconosciuto, marca come "unknown"
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        Logger.warn(`⚠️ URL esterno non riconosciuto: ${imageUrl}`);
        return {
          status: 'unknown',
          source: 'external',
          author: '',
          license: 'Unknown',
          attribution: '',
          notes: 'URL esterno non verificato - richiede verifica manuale',
          checkedAt: new Date()
        };
      }

      // 5. Default: immagine locale senza metadati
      Logger.info(`ℹ️ Immagine locale senza metadati rilevanti`);
      return {
        status: 'unknown',
        source: 'local',
        author: '',
        license: 'Unknown',
        attribution: '',
        notes: 'Immagine locale senza informazioni di licenza - richiede verifica manuale',
        checkedAt: new Date()
      };

    } catch (error) {
      Logger.error(`❌ Errore verifica licenza immagine:`, error);
      return {
        status: 'unknown',
        source: '',
        author: '',
        license: '',
        attribution: '',
        notes: `Errore durante la verifica: ${error.message}`,
        checkedAt: new Date()
      };
    }
  }

  /**
   * Verifica pattern URL per fonti note
   * @param {string} imageUrl - URL dell'immagine
   * @returns {Object|null} Informazioni sulla fonte se trovata
   */
  checkUrlPattern(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return null;
    }

    const urlLower = imageUrl.toLowerCase();

    // Verifica fonti libere
    for (const [sourceName, sourceInfo] of Object.entries(this.freeImageSources)) {
      for (const pattern of sourceInfo.patterns) {
        if (urlLower.includes(pattern)) {
          return {
            status: sourceInfo.status,
            source: sourceName,
            license: sourceInfo.license,
            requiresAttribution: sourceInfo.requiresAttribution,
            notes: `Immagine da ${sourceName} - ${sourceInfo.requiresAttribution ? 'richiede attribuzione' : 'libera da usare'}`
          };
        }
      }
    }

    return null;
  }

  /**
   * Estrae ID foto da URL Unsplash
   * @param {string} imageUrl - URL dell'immagine
   * @returns {string|null} ID foto o null
   */
  extractUnsplashPhotoId(imageUrl) {
    // Pattern 1: https://images.unsplash.com/photo-{timestamp}-{hash}?...
    // Pattern 2: https://unsplash.com/photos/{id}
    // Pattern 3: https://unsplash.com/@user/photos/{id}
    const match1 = imageUrl.match(/photo-(\d+)-([a-f0-9]+)/);
    const match2 = imageUrl.match(/photos\/([a-zA-Z0-9_-]+)/);
    
    if (match1) {
      // Per gli URL images.unsplash.com, non possiamo ottenere l'ID diretto
      // ma possiamo provare a fare reverse search
      return match1[2]; // hash
    } else if (match2) {
      return match2[1];
    }
    return null;
  }

  /**
   * Recupera informazioni dettagliate da Unsplash API
   * @param {string} imageUrl - URL dell'immagine
   * @returns {Promise<Object|null>} Informazioni foto o null
   */
  async fetchUnsplashPhotoInfo(imageUrl) {
    try {
      // Per gli URL images.unsplash.com, non possiamo ottenere direttamente l'ID
      // Prova a fare reverse image search o usa Google Custom Search se disponibile
      // Per ora, restituiamo null e usiamo informazioni base
      // In futuro si potrebbe implementare reverse image search
      
      // Se l'URL contiene già informazioni sulla pagina (non solo l'immagine)
      if (imageUrl.includes('unsplash.com/photos/')) {
        const photoIdMatch = imageUrl.match(/photos\/([a-zA-Z0-9_-]+)/);
        if (photoIdMatch) {
          const photoId = photoIdMatch[1];
          const photoPageUrl = `https://unsplash.com/photos/${photoId}`;
          
          try {
            const response = await axios.get(photoPageUrl, {
              timeout: 5000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });

            const $ = cheerio.load(response.data);
            
            // Cerca informazioni autore nella pagina
            const authorName = $('a[href*="/@"]').first().text().trim() || 
                              $('[data-test="user-name"]').text().trim() ||
                              $('a[rel="author"]').text().trim() ||
                              $('.user-name').text().trim();
            
            if (authorName) {
              const authorLink = $('a[href*="/@"]').first();
              const authorPath = authorLink.attr('href');
              const fullAuthorUrl = authorPath ? `https://unsplash.com${authorPath}` : '';
              
              return {
                author: authorName,
                authorUrl: fullAuthorUrl,
                photoUrl: photoPageUrl,
                license: 'Unsplash License'
              };
            }
          } catch (scrapeError) {
            Logger.warn('⚠️ Errore scraping Unsplash:', scrapeError.message);
          }
        }
      }
      
      // Se non riusciamo a ottenere info dettagliate, restituiamo null
      // Il sistema userà informazioni base
      return null;
    } catch (error) {
      Logger.warn('⚠️ Errore fetch Unsplash info:', error.message);
      return null;
    }
  }

  /**
   * Estrae ID foto da URL Pexels
   * @param {string} imageUrl - URL dell'immagine
   * @returns {string|null} ID foto o null
   */
  extractPexelsPhotoId(imageUrl) {
    // Pattern: https://images.pexels.com/photos/{id}/...
    // o https://www.pexels.com/photo/...
    const match = imageUrl.match(/photos\/(\d+)/) || imageUrl.match(/photo\/([^\/]+)/);
    if (match) {
      return match[1];
    }
    return null;
  }

  /**
   * Recupera informazioni dettagliate da Pexels
   * @param {string} imageUrl - URL dell'immagine
   * @returns {Promise<Object|null>} Informazioni foto o null
   */
  async fetchPexelsPhotoInfo(imageUrl) {
    try {
      // Estrai ID o cerca la pagina della foto
      const photoId = this.extractPexelsPhotoId(imageUrl);
      
      // Pexels non ha un'API pubblica facile, proviamo scraping
      // Costruisci URL pagina foto se possibile
      let photoPageUrl = imageUrl;
      if (photoId && !imageUrl.includes('pexels.com/photo')) {
        photoPageUrl = `https://www.pexels.com/photo/${photoId}/`;
      }

      try {
        const response = await axios.get(photoPageUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PhotoLicenseChecker/1.0)'
          }
        });

        const $ = cheerio.load(response.data);
        
        // Cerca autore nella pagina Pexels
        const authorName = $('a[href*="/photographer/"]').text().trim() ||
                          $('[data-test="photographer-name"]').text().trim() ||
                          $('.photographer-name').text().trim();
        
        if (authorName) {
          const authorUrl = $('a[href*="/photographer/"]').attr('href');
          const fullAuthorUrl = authorUrl ? `https://www.pexels.com${authorUrl}` : '';
          
          return {
            author: authorName,
            authorUrl: fullAuthorUrl,
            photoUrl: photoPageUrl,
            license: 'Pexels License'
          };
        }
      } catch (scrapeError) {
        Logger.warn('⚠️ Errore scraping Pexels:', scrapeError.message);
      }

      return null;
    } catch (error) {
      Logger.warn('⚠️ Errore fetch Pexels info:', error.message);
      return null;
    }
  }

  /**
   * Recupera informazioni dettagliate da Wikipedia Commons
   * @param {string} imageUrl - URL dell'immagine
   * @returns {Promise<Object|null>} Informazioni foto o null
   */
  async fetchWikipediaPhotoInfo(imageUrl) {
    try {
      // Estrai nome file da URL Wikipedia
      // Pattern: https://upload.wikimedia.org/wikipedia/commons/.../File:Name.jpg
      const fileNameMatch = imageUrl.match(/File:([^\/]+)/) || imageUrl.match(/\/([^\/]+\.(jpg|jpeg|png|gif|webp))/i);
      if (!fileNameMatch) {
        return null;
      }

      const fileName = fileNameMatch[1];
      
      // Costruisci URL pagina file su Commons
      const filePageUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`;
      
      try {
        const response = await axios.get(filePageUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PhotoLicenseChecker/1.0)'
          }
        });

        const $ = cheerio.load(response.data);
        
        // Cerca autore e licenza nella pagina Commons
        let author = '';
        let license = '';
        
        // Cerca autore (spesso in una sezione specifica)
        const authorText = $('.fileinfotpl-type-author').next().text().trim() ||
                          $('[data-name="author"]').text().trim() ||
                          $('.fileinfotpl-type').filter((i, el) => $(el).text().includes('Author')).next().text().trim();
        
        if (authorText) {
          author = authorText;
        }
        
        // Cerca licenza
        const licenseText = $('.fileinfotpl-type-license').next().text().trim() ||
                           $('[data-name="license"]').text().trim() ||
                           $('a[href*="/wiki/"]').filter((i, el) => {
                             const text = $(el).text();
                             return text.includes('CC') || text.includes('Creative Commons') || text.includes('Public domain');
                           }).first().text().trim();
        
        if (licenseText) {
          license = licenseText;
        } else {
          // Default per Wikipedia Commons
          license = 'CC BY-SA or compatible';
        }
        
        return {
          author: author,
          photoUrl: filePageUrl,
          license: license
        };
      } catch (scrapeError) {
        Logger.warn('⚠️ Errore scraping Wikipedia:', scrapeError.message);
      }

      return null;
    } catch (error) {
      Logger.warn('⚠️ Errore fetch Wikipedia info:', error.message);
      return null;
    }
  }

  /**
   * Genera automaticamente il testo di attribuzione
   * @param {string} source - Fonte dell'immagine
   * @param {string} author - Nome autore (opzionale)
   * @param {string} imageUrl - URL dell'immagine
   * @param {Object} detailedInfo - Informazioni dettagliate (opzionale)
   * @returns {string} Testo di attribuzione
   */
  generateAttribution(source, author, imageUrl, detailedInfo = null) {
    const sourceNames = {
      'unsplash': 'Unsplash',
      'pexels': 'Pexels',
      'wikipedia': 'Wikipedia Commons',
      'flickr_cc': 'Flickr',
      'pixabay': 'Pixabay'
    };

    const sourceName = sourceNames[source] || source;

    // Usa informazioni dettagliate se disponibili
    const finalAuthor = detailedInfo?.author || author;
    const finalPhotoUrl = detailedInfo?.photoUrl || imageUrl;
    const finalLicense = detailedInfo?.license;

    if (finalAuthor && finalAuthor.trim()) {
      // Se c'è l'autore, usa un formato più completo
      if (source === 'unsplash') {
        // Se abbiamo l'URL dell'autore, includilo
        if (detailedInfo?.authorUrl) {
          return `Photo by [${finalAuthor}](${detailedInfo.authorUrl}) on [Unsplash](${finalPhotoUrl})`;
        }
        return `Photo by ${finalAuthor} on [Unsplash](${finalPhotoUrl})`;
      } else if (source === 'pexels') {
        if (detailedInfo?.authorUrl) {
          return `Photo by [${finalAuthor}](${detailedInfo.authorUrl}) from [Pexels](${finalPhotoUrl})`;
        }
        return `Photo by ${finalAuthor} from [Pexels](${finalPhotoUrl})`;
      } else if (source === 'wikipedia') {
        const licenseText = finalLicense || 'CC BY-SA';
        return `Image by ${finalAuthor}, licensed under ${licenseText}, via [Wikimedia Commons](${finalPhotoUrl})`;
      } else if (source === 'flickr_cc') {
        return `Photo by ${finalAuthor} on Flickr (CC License)`;
      } else {
        return `Photo by ${finalAuthor} from ${sourceName}`;
      }
    } else {
      // Se non c'è l'autore, usa solo la fonte
      if (source === 'unsplash') {
        return `Photo from [Unsplash](${finalPhotoUrl})`;
      } else if (source === 'pexels') {
        return `Photo from [Pexels](${finalPhotoUrl})`;
      } else if (source === 'wikipedia') {
        const licenseText = finalLicense || 'CC BY-SA';
        return `Image from [Wikimedia Commons](${finalPhotoUrl}) (${licenseText})`;
      } else {
        return `Photo from ${sourceName}`;
      }
    }
  }

  /**
   * Verifica pattern URL per immagini protette
   * @param {string} imageUrl - URL dell'immagine
   * @returns {Object|null} Informazioni se trovata fonte protetta
   */
  checkRestrictedPattern(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return null;
    }

    const urlLower = imageUrl.toLowerCase();

    for (const pattern of this.restrictedPatterns) {
      if (urlLower.includes(pattern)) {
        return {
          source: pattern,
          status: 'needs_replacement'
        };
      }
    }

    return null;
  }

  /**
   * Verifica immagine locale (metadati EXIF)
   * @param {string} imageUrl - URL relativo dell'immagine
   * @param {string} imagePath - Percorso fisico (opzionale)
   * @returns {Promise<Object|null>} Informazioni dalla verifica locale
   */
  async checkLocalImage(imageUrl, imagePath = null) {
    try {
      // Costruisci il percorso fisico
      let filePath = imagePath;
      if (!filePath) {
        const basename = path.basename(imageUrl);
        const photosDir = path.join(__dirname, '../public/photos');
        const uploadsDir = path.join(__dirname, '../public/uploads');
        
        if (imageUrl.startsWith('/photos/')) {
          filePath = path.join(photosDir, basename);
        } else if (imageUrl.startsWith('/uploads/')) {
          filePath = path.join(uploadsDir, basename);
        } else {
          return null;
        }
      }

      // Verifica che il file esista
      if (!fs.existsSync(filePath)) {
        Logger.warn(`⚠️ File immagine non trovato: ${filePath}`);
        return null;
      }

      // Leggi metadati EXIF con exifr
      const exif = await exifr.parse(filePath, {
        pick: ['Copyright', 'Artist', 'ImageDescription', 'UserComment']
      });

      if (!exif || Object.keys(exif).length === 0) {
        // Nessun metadato EXIF - potrebbe essere un'immagine caricata manualmente
        return {
          status: 'unknown',
          source: 'local',
          notes: 'Immagine locale senza metadati EXIF - verifica manuale consigliata'
        };
      }

      // Estrai informazioni copyright dai metadati EXIF
      const copyright = exif.Copyright || null;
      const artist = exif.Artist || null;

      if (copyright) {
        const copyrightStr = copyright.toString();
        
        // Verifica se contiene "Public Domain" o "CC"
        if (copyrightStr.toLowerCase().includes('public domain')) {
          return {
            status: 'free',
            source: 'local',
            license: 'Public Domain',
            author: artist || '',
            notes: 'Immagine in pubblico dominio'
          };
        }

        if (copyrightStr.toLowerCase().includes('creative commons') || copyrightStr.toLowerCase().includes('cc ')) {
          const attribution = artist ? `Photo by ${artist} (Creative Commons)` : 'Photo (Creative Commons)';
          return {
            status: 'needs_attribution',
            source: 'local',
            license: 'Creative Commons',
            author: artist || '',
            attribution: attribution,
            notes: 'Immagine Creative Commons - richiede attribuzione'
          };
        }

        // Se c'è copyright ma non è CC o Public Domain, potrebbe essere protetta
        return {
          status: 'needs_replacement',
          source: 'local',
          license: 'Copyrighted',
          author: artist || '',
          notes: `Immagine con copyright: ${copyrightStr}`
        };
      }

      // Se c'è solo artista ma non copyright, marca come "unknown"
      if (artist) {
        return {
          status: 'unknown',
          source: 'local',
          author: artist,
          license: 'Unknown',
          attribution: `Photo by ${artist}`,
          notes: 'Autore presente ma licenza non specificata - verifica manuale consigliata'
        };
      }

      return null;

    } catch (error) {
      Logger.error(`❌ Errore verifica immagine locale:`, error);
      return null;
    }
  }

  /**
   * Verifica tutte le immagini dei POI definitivi
   * @param {Array} pois - Array di POI da verificare (opzionale, se null verifica tutti i definitivi)
   * @param {Function} progressCallback - Callback per aggiornamenti progresso
   * @returns {Promise<Object>} Risultato della verifica batch
   */
  async checkAllDefinitivePOIs(pois = null, progressCallback = null) {
    try {
      const Poi = require('../models/Poi');
      
      // Se non forniti, carica tutti i POI definitivi con immagini
      if (!pois) {
        pois = await Poi.find({
          isDefinitive: true,
          imageUrl: { $exists: true, $ne: '' }
        });
      }

      Logger.info(`🔍 Verifica licenze per ${pois.length} POI definitivi`);

      const results = {
        total: pois.length,
        checked: 0,
        free: 0,
        needsAttribution: 0,
        needsReplacement: 0,
        unknown: 0,
        errors: 0,
        updated: []
      };

      for (let i = 0; i < pois.length; i++) {
        const poi = pois[i];
        
        try {
          // Verifica licenza
          const licenseInfo = await this.checkImageLicense(poi);
          
          // Aggiorna il POI
          if (!poi.imageLicenseStatus) {
            poi.imageLicenseStatus = {};
          }
          
          poi.imageLicenseStatus.status = licenseInfo.status;
          poi.imageLicenseStatus.source = licenseInfo.source || '';
          poi.imageLicenseStatus.author = licenseInfo.author || '';
          poi.imageLicenseStatus.authorUrl = licenseInfo.authorUrl || '';
          poi.imageLicenseStatus.license = licenseInfo.license || '';
          poi.imageLicenseStatus.photoUrl = licenseInfo.photoUrl || '';
          poi.imageLicenseStatus.attribution = licenseInfo.attribution || '';
          poi.imageLicenseStatus.checkedAt = licenseInfo.checkedAt || new Date();
          poi.imageLicenseStatus.notes = licenseInfo.notes || '';
          
          await poi.save();
          
          // Aggiorna statistiche
          results.checked++;
          if (licenseInfo.status === 'free') results.free++;
          else if (licenseInfo.status === 'needs_attribution') results.needsAttribution++;
          else if (licenseInfo.status === 'needs_replacement') results.needsReplacement++;
          else if (licenseInfo.status === 'unknown') results.unknown++;
          
          results.updated.push({
            poiId: poi._id,
            poiName: poi.name,
            status: licenseInfo.status
          });

          // Callback progresso
          if (progressCallback) {
            progressCallback({
              current: i + 1,
              total: pois.length,
              poi: poi.name,
              status: licenseInfo.status
            });
          }

          // Piccola pausa per non sovraccaricare il sistema
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          Logger.error(`❌ Errore verifica POI ${poi._id}:`, error);
          results.errors++;
        }
      }

      Logger.info(`✅ Verifica completata: ${results.checked}/${results.total} POI verificati`);
      return results;

    } catch (error) {
      Logger.error(`❌ Errore verifica batch licenze:`, error);
      throw error;
    }
  }
}

module.exports = PhotoLicenseChecker;

