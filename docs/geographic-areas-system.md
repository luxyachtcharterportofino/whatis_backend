# 🗺️ Sistema Aree Geografiche - Andaly Whatis

## 📋 Panoramica

Il sistema delle **Aree Geografiche** organizza le zone esistenti in macro-aree logiche per facilitare la navigazione nell'app mobile. I turisti possono scegliere e acquistare aree geografiche ordinate per regioni turistiche.

## 🏗️ Architettura

### Modelli di Dati

#### 1. GeographicArea
```javascript
{
  name: "tirreno_settentrionale",           // ID univoco
  displayName: "Tirreno Settentrionale",   // Nome visualizzato
  description: "Costa ligure e alta Toscana...",
  sortOrder: 1,                            // Ordinamento
  color: "#1e88e5",                        // Colore distintivo
  icon: "🏔️",                             // Icona rappresentativa
  basePrice: 399,                          // Prezzo in centesimi (€3.99)
  isActive: true,                          // Attiva per vendita
  metadata: {
    centerLat: 44.1,                       // Centro mappa
    centerLng: 9.8,
    zoomLevel: 9,                          // Zoom suggerito
    previewImage: "/images/tirreno-nord.jpg",
    tags: ["liguria", "toscana", "costa"],
    primaryLanguage: "it"
  },
  translations: {                          // Traduzioni multilingua
    en: { displayName: "Northern Tyrrhenian", ... },
    fr: { displayName: "Tyrrhénienne du Nord", ... }
  }
}
```

#### 2. Zone (Aggiornata)
```javascript
{
  // Campi esistenti (invariati)
  name: "Golfo dei Poeti",
  description: "...",
  coordinates: [[lat, lng], ...],
  
  // NUOVI campi (opzionali per backward compatibility)
  geographicArea: ObjectId,                // Riferimento all'area geografica
  customPrice: 449,                        // Prezzo personalizzato (override)
  appMetadata: {
    difficulty: "easy",                    // Difficoltà navigazione
    estimatedVisitTime: 2,                 // Ore stimate visita
    bestSeason: "all_year",               // Stagione migliore
    accessibility: "full"                  // Accessibilità
  }
}
```

## 🌊 Aree Geografiche Predefinite

### 1. Tirreno Settentrionale (€3.99)
- **Regioni**: Liguria, Alta Toscana
- **Zone**: Cinque Terre, Golfo dei Poeti, Versilia
- **Caratteristiche**: Costa rocciosa, borghi marinari, parchi naturali

### 2. Tirreno Centrale (€3.49)
- **Regioni**: Toscana Marittima, Lazio
- **Zone**: Arcipelago Toscano, Maremma, Costa Laziale
- **Caratteristiche**: Isole, terme, siti archeologici

### 3. Tirreno Meridionale (€4.49)
- **Regioni**: Campania, Calabria, Sicilia Occidentale
- **Zone**: Costiera Amalfitana, Cilento, Eolie
- **Caratteristiche**: Vulcani, siti UNESCO, tradizioni

### 4. Isole Minori Tirreno (€2.99)
- **Zone**: Elba, Giglio, Capraia, Ponza, Ischia, Capri
- **Caratteristiche**: Arcipelaghi, spiagge esclusive, natura

### 5. Costa Azzurra (€4.99)
- **Regione**: Riviera Francese
- **Zone**: Nizza, Cannes, Saint-Tropez, Monaco
- **Caratteristiche**: Lusso, eventi, cultura francese

### 6. Nord Sardegna (€3.99)
- **Zone**: Costa Smeralda, Arcipelago Maddalena, Alghero
- **Caratteristiche**: Spiagge paradisiache, cultura sarda

## 🔌 API Endpoints

### Mobile App API

#### GET /mobile/areas
Restituisce tutte le aree geografiche attive
```json
{
  "success": true,
  "areas": [
    {
      "id": "...",
      "name": "tirreno_settentrionale",
      "displayName": "Tirreno Settentrionale",
      "description": "...",
      "color": "#1e88e5",
      "icon": "🏔️",
      "price": 399,
      "priceFormatted": "€3.99",
      "metadata": { ... }
    }
  ]
}
```

#### GET /mobile/areas/:areaId/zones
Zone di un'area specifica con conteggio POI
```json
{
  "success": true,
  "area": { ... },
  "zones": [
    {
      "id": "...",
      "name": "Golfo dei Poeti",
      "poiCount": 45,
      "price": 399,
      "appMetadata": { ... }
    }
  ]
}
```

#### GET /mobile/zones/:zoneId/pois
POI di una zona (multilingua)
```json
{
  "success": true,
  "zone": { ... },
  "pois": [
    {
      "id": "...",
      "name": "Castello di Lerici",
      "description": "...",
      "lat": 44.0766,
      "lng": 9.9108,
      "category": "monument"
    }
  ]
}
```

#### GET /mobile/search?q=lerici
Ricerca globale in aree, zone e POI

### Admin API

#### GET /admin/geographic-areas
Gestione aree geografiche (interfaccia admin)

#### POST /admin/geographic-areas
Crea nuova area geografica

#### PUT /admin/geographic-areas/:areaId/assign-zone/:zoneId
Assegna zona ad area geografica

## 🚀 Setup e Inizializzazione

### 1. Inizializza le Aree Geografiche
```bash
cd /path/to/whatis_backend
node scripts/init-geographic-areas.js
```

### 2. Assegna Zone alle Aree
Tramite interfaccia admin: `/admin/geographic-areas`

### 3. Test API Mobile
```bash
# Ottieni aree geografiche
curl http://localhost:3000/mobile/areas

# Zone di un'area
curl http://localhost:3000/mobile/areas/AREA_ID/zones

# POI di una zona
curl http://localhost:3000/mobile/zones/ZONE_ID/pois?language=en
```

## 🛡️ Backward Compatibility

### ✅ Funzionalità Esistenti Preservate
- **Tutte le zone esistenti** continuano a funzionare
- **Admin interface** per zone invariata
- **POI management** invariato
- **Ricerca automatica POI** invariata
- **Sistema traduzioni** invariato

### 🆕 Nuove Funzionalità Additive
- **Aree geografiche** come layer organizzativo
- **API mobile** per app turistica
- **Prezzi e metadati** per commercializzazione
- **Ricerca multilingua** per turisti

## 📱 Flusso App Mobile

### 1. Selezione Area Geografica
```
Tirreno Settentrionale  €3.99  🏔️
├─ Costa ligure e alta Toscana
├─ 12 zone disponibili
└─ 340 POI totali
```

### 2. Selezione Zone nell'Area
```
Golfo dei Poeti        45 POI   ⭐ Facile
Cinque Terre          78 POI   ⭐⭐ Medio  
Versilia              67 POI   ⭐ Facile
```

### 3. Visualizzazione POI
```
📍 Castello di Lerici
   Fortezza medievale sul mare
   🏛️ Monumento • ⭐⭐⭐⭐⭐
   📸 Foto disponibile
```

## 🔧 Manutenzione

### Aggiungere Nuova Area Geografica
1. Modifica `scripts/init-geographic-areas.js`
2. Aggiungi definizione area
3. Esegui script inizializzazione
4. Assegna zone tramite admin

### Modificare Prezzi
```javascript
// Via admin API
PUT /admin/geographic-areas/:id
{
  "basePrice": 499  // €4.99
}

// Override per zona specifica
PUT /admin/zones/:id
{
  "customPrice": 599  // €5.99
}
```

### Traduzioni
Le aree geografiche supportano traduzioni in:
- 🇮🇹 Italiano (predefinito)
- 🇬🇧 Inglese
- 🇫🇷 Francese
- 🇪🇸 Spagnolo
- 🇩🇪 Tedesco

## 📊 Metriche e Analytics

### Dati Raccolti
- **Zone per area**: Conteggio automatico
- **POI per zona**: Conteggio in tempo reale
- **Prezzi dinamici**: Base + override personalizzati
- **Lingue supportate**: Rilevamento automatico

### Report Disponibili
- Aree più popolari (per numero zone)
- Zone con più POI
- Copertura traduzioni
- Prezzi medi per area

---

## 🎯 Benefici del Sistema

### Per i Turisti
- ✅ **Navigazione intuitiva** per macro-aree
- ✅ **Prezzi chiari** e differenziati
- ✅ **Informazioni utili** (difficoltà, tempo visita)
- ✅ **Multilingua** per turisti internazionali

### Per l'Admin
- ✅ **Organizzazione logica** delle zone
- ✅ **Gestione prezzi** flessibile
- ✅ **Backward compatibility** totale
- ✅ **Scalabilità** per nuove aree

### Per lo Sviluppo
- ✅ **API dedicate** per mobile
- ✅ **Struttura modulare** e estendibile
- ✅ **Performance ottimizzate** con indici
- ✅ **Documentazione completa**
