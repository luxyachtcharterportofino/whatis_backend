# Sistema di Verifica Licenze Foto

## Panoramica

Il sistema di verifica licenze foto controlla automaticamente lo stato delle licenze delle immagini dei POI per determinare se sono:
- **Libere** (free): possono essere usate senza restrizioni
- **Richiedono attribuzione** (needs_attribution): possono essere usate ma richiedono citazione dell'autore
- **Da sostituire** (needs_replacement): protette da copyright e devono essere sostituite
- **Sconosciute** (unknown): stato della licenza non determinabile automaticamente
- **Non verificate** (not_checked): ancora da verificare

## Funzionalità

### 1. Verifica Automatica

Il sistema verifica automaticamente le licenze attraverso:

1. **Pattern URL**: Riconosce fonti note di immagini libere:
   - Wikipedia Commons (CC BY-SA)
   - Unsplash (richiede attribuzione)
   - Pexels (richiede attribuzione)
   - Pixabay (libera)
   - Flickr Creative Commons (richiede attribuzione)

2. **Metadati EXIF**: Legge i metadati delle immagini locali per:
   - Informazioni copyright
   - Nome autore
   - Tipo di licenza (Public Domain, Creative Commons, etc.)

3. **Pattern URL Protetti**: Riconosce fonti di immagini protette:
   - Getty Images
   - Shutterstock
   - iStock
   - Alamy
   - Dreamstime
   - Depositphotos
   - 123RF

### 2. Interfaccia Utente

#### Lista POI (`/admin/pois`)

- **Nuova colonna "Licenza Foto"**: Mostra lo stato della licenza con badge colorati:
  - 🟢 **Verde** (free): Foto libera
  - 🟡 **Giallo** (needs_attribution): Richiede attribuzione
  - 🔴 **Rosso** (needs_replacement): Da sostituire
  - 🔵 **Blu** (unknown): Sconosciuta
  - ⚪ **Grigio** (not_checked): Non verificata

- **Pulsante "Verifica Licenze Foto"**: Verifica tutte le foto dei POI definitivi in batch
- **Pulsante 🔍 per singola foto**: Verifica la licenza di una singola foto

#### Tooltip Informativi

Passando il mouse sui badge, vengono mostrate informazioni dettagliate:
- Fonte dell'immagine
- Autore (se disponibile)
- Tipo di licenza
- Note aggiuntive
- Data di verifica

## Utilizzo

### Verifica Batch (Tutte le Foto)

1. Vai alla pagina `/admin/pois`
2. Clicca sul pulsante **"📸 Verifica Licenze Foto"**
3. Conferma l'operazione
4. Attendi il completamento (può richiedere alcuni minuti)
5. La pagina si ricarica automaticamente mostrando i risultati

### Verifica Singola Foto

1. Nella lista POI, trova il POI con la foto da verificare
2. Clicca sul pulsante **🔍** nella colonna "Licenza Foto"
3. Il sistema verifica la licenza e aggiorna lo stato

## Struttura Dati

### Campo `imageLicenseStatus` nel Modello Poi

```javascript
{
  status: "free" | "needs_attribution" | "needs_replacement" | "unknown" | "not_checked",
  source: String,        // Fonte dell'immagine (es. "wikipedia", "unsplash", "local")
  author: String,        // Nome autore (se disponibile)
  license: String,       // Tipo di licenza (es. "CC BY-SA 4.0", "Public Domain")
  checkedAt: Date,       // Data/ora verifica
  notes: String          // Note aggiuntive
}
```

## API Endpoints

### POST `/admin/pois/check-photo-licenses`

Verifica tutte le foto dei POI definitivi.

**Risposta:**
```json
{
  "success": true,
  "message": "Verifica completata: X POI verificati",
  "results": {
    "total": 100,
    "checked": 95,
    "free": 30,
    "needsAttribution": 40,
    "needsReplacement": 10,
    "unknown": 15,
    "errors": 0,
    "updated": [...]
  }
}
```

### POST `/admin/pois/:id/check-photo-license`

Verifica la licenza di una singola foto.

**Risposta:**
```json
{
  "success": true,
  "message": "Licenza verificata con successo",
  "licenseInfo": {
    "status": "free",
    "source": "wikipedia",
    "author": "John Doe",
    "license": "CC BY-SA 4.0",
    "notes": "...",
    "checkedAt": "2024-01-15T10:30:00Z"
  },
  "poi": {...}
}
```

## Servizio: `PhotoLicenseChecker`

Il servizio principale si trova in `services/photoLicenseChecker.js`.

### Metodi Principali

- `checkImageLicense(poi, imagePath)`: Verifica la licenza di un'immagine
- `checkAllDefinitivePOIs(pois, progressCallback)`: Verifica batch di POI
- `checkUrlPattern(imageUrl)`: Verifica pattern URL
- `checkLocalImage(imageUrl, imagePath)`: Verifica immagine locale

## Note Importanti

1. **Verifica Manuale**: Le immagini con stato "unknown" o "not_checked" richiedono verifica manuale
2. **Performance**: La verifica batch può richiedere tempo per molti POI (circa 100ms per POI)
3. **Metadati EXIF**: Non tutte le immagini hanno metadati EXIF completi
4. **URL Esterni**: Gli URL esterni non riconosciuti vengono marcati come "unknown"

## Prossimi Miglioramenti Possibili

- Integrazione con Google Reverse Image Search per trovare la fonte originale
- Supporto per più fonti di immagini libere
- Cache dei risultati per evitare verifiche duplicate
- Notifiche automatiche per foto che richiedono sostituzione
- Export report delle licenze in CSV/PDF

