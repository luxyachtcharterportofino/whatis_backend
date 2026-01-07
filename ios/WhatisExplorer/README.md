# 🗺️ Whatis Explorer Lite

App iOS per esplorare POI (Point of Interest) senza ARKit - Compatibile con iPhone 11 e dispositivi più vecchi.

## ✨ Caratteristiche

- ✅ **Compatibile iOS 15+** (iPhone 11 e più vecchi)
- ✅ **Nessun ARKit richiesto** - Solo MapKit 2D
- ✅ **Modalità offline** - Download zone e POI per uso offline
- ✅ **Navigazione integrata** - Apertura in Mappe Apple
- ✅ **Filtri avanzati** - Per zona, categoria, distanza
- ✅ **Backend integrato** - Connessione a `http://localhost:3000/api`

## 📁 Struttura Progetto

```
WhatisExplorerLite/
├── Models/
│   ├── POI.swift          # Modello Point of Interest
│   └── Zone.swift         # Modello Zona geografica
├── Services/
│   ├── APIService.swift   # Servizio API backend
│   ├── LocationManager.swift    # Gestione GPS
│   └── OfflineStorageService.swift  # Storage locale
├── Views/
│   ├── ContentView.swift         # Tab navigation principale
│   ├── MapView.swift              # Mappa con POI
│   ├── POIListView.swift          # Lista POI
│   ├── POIDetailView.swift        # Dettagli POI
│   ├── SettingsView.swift         # Impostazioni
│   └── ZoneSelectionView.swift    # Download zone
├── WhatisExplorerLiteApp.swift    # Entry point app
└── Info.plist                     # Configurazione app
```

## 🚀 Setup Rapido

### Prerequisiti

- macOS con Xcode 15+
- iPhone 11 (o simulatore iOS 15+)
- Backend Whatis in esecuzione su `http://localhost:3000`

### Installazione

1. **Apri Xcode**
2. **File → New → Project**
3. Configura:
   - Product Name: `WhatisExplorerLite`
   - Bundle ID: `com.andaly.WhatisExplorerLite`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Minimum: **iOS 15.0**
4. Salva in: `~/Desktop/WhatisExplorer_Lite/`
5. **Importa file**: Trascina la cartella `WhatisExplorerLite/` nel progetto
6. **Configura Capabilities**: Aggiungi "Location Services"
7. **Build & Run** (⌘R)

📚 **Per istruzioni dettagliate, vedi [AUTO_SETUP.md](AUTO_SETUP.md)**

### 🎯 Distribuzione con TestFlight

Per distribuire l'app su TestFlight (durata 90 giorni, più stabile):

1. **Esegui script preparazione**:
   ```bash
   cd WhatisExplorer_Lite
   ./prepare_for_testflight.sh
   ```

2. **Segui guida completa**: Vedi [TESTFLIGHT_SETUP.md](TESTFLIGHT_SETUP.md)

**Vantaggi TestFlight**:
- ✅ Durata 90 giorni (rinnovabile)
- ✅ Aggiornamenti automatici
- ✅ Non richiede riconnessione ogni 7 giorni
- ✅ Funziona su qualsiasi iPhone

## ⚙️ Configurazione

### URL Backend

L'app è configurata per usare `http://localhost:3000/api` di default.

Per usare da iPhone:
1. Trova l'IP del Mac: `ifconfig | grep "inet "`
2. In app → Impostazioni → URL Backend: `http://192.168.1.XXX:3000/api`

### Permessi

L'app richiede:
- **Location Services (When In Use)** - Per mostrare POI vicini

Configurati automaticamente in `Info.plist`.

## 📱 Funzionalità

### 1. Selezione Zona
- Visualizza tutte le zone disponibili
- Download zone per uso offline
- Salvataggio automatico in JSON locale

### 2. Mappa
- Visualizzazione POI sulla mappa
- Marker colorati per categoria
- Tap per vedere dettagli
- Pulsante "Centra su posizione"

### 3. Lista POI
- Lista completa POI della zona
- Filtri per categoria e distanza
- Ordinamento per distanza
- Indicatore stato coordinate

### 4. Dettagli POI
- Informazioni complete
- Mini mappa
- Navigazione diretta
- Distanza da posizione corrente

### 5. Impostazioni
- Configurazione URL backend
- Statistiche app
- Gestione storage offline

## 🔧 Sviluppo

### Apertura Rapida

**Doppio click su**: `Apri_Xcode.command`  
Oppure da terminale:
```bash
./Apri_Xcode.command
```

### Build Manuale

```bash
# Apri Xcode
open WhatisExplorerLite.xcodeproj

# Build
⌘B

# Run
⌘R
```

### Test Offline

1. Scarica una zona (es. "Tigullio nuova")
2. Disconnetti Wi-Fi
3. L'app continua a funzionare con dati salvati

## 🐛 Risoluzione Problemi

### "Network request failed"
- Verifica che il backend sia in esecuzione
- Controlla URL in Impostazioni app
- Per iPhone: usa IP Mac invece di localhost

### "Cannot find 'POI' in scope"
- Verifica che tutti i file siano nel target
- **Product → Clean Build Folder** (⇧⌘K)
- **Product → Build** (⌘B)

### Map non funziona
- ✅ Già risolto: usa UIViewRepresentable per iOS 15+

### "App non disponibile" dopo qualche giorno
- ⚠️ **Problema comune**: Certificati di sviluppo scaduti
- 📖 **Vedi [IOS_APP_STABILITY.md](IOS_APP_STABILITY.md)** per soluzioni complete
- 🔄 **Soluzione rapida**: Riconnetti iPhone e ricompila da Xcode

Vedi [AUTO_SETUP.md](AUTO_SETUP.md) per altri problemi comuni.

## 📄 Licenza

Progetto privato - Whatis Explorer

## 👤 Autore

Creato per Whatis Explorer Lite - Versione senza ARKit

---

**Versione**: 1.0  
**iOS Minimo**: 15.0  
**Swift**: 5.0+  
**Xcode**: 15.0+
