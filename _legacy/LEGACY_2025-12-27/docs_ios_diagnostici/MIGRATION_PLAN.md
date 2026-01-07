# 🔄 Piano di Migrazione: WhatisExplorerLite → Whatis Explorer

## 📋 Obiettivo
Unificare tutto in "Whatis Explorer", rimuovendo tutti i riferimenti "Lite" mantenendo tutte le funzionalità (inclusa AR).

## ✅ Funzionalità da Mantenere

### Funzionalità AR (già implementate)
- ✅ ARView.swift completo con:
  - Visualizzazione POI in AR
  - Frecce direzionali arancioni
  - Foto POI con bordo dorato
  - Nome e distanza sotto ogni POI
  - Caricamento asincrono immagini
  - Gestione bearing e direzione

### Funzionalità Base
- ✅ MapView (mappa 2D)
- ✅ POIListView
- ✅ POIDetailView
- ✅ ZoneSelectionView
- ✅ SettingsView
- ✅ ContentView (con rilevamento ARKit automatico)
- ✅ DeviceCapabilities (rilevamento supporto ARKit)
- ✅ APIService
- ✅ LocationManager
- ✅ OfflineStorageService

## 🔄 Modifiche da Eseguire

### 1. Rinominazione Struttura
```
WhatisExplorerLite/              → WhatisExplorer/
WhatisExplorerLite.xcodeproj/    → WhatisExplorer.xcodeproj/
WhatisExplorerLiteApp.swift       → WhatisExplorerApp.swift
```

### 2. Bundle ID
```
com.andaly.WhatisExplorerLite → com.andaly.WhatisExplorer
```

### 3. Nome Prodotto
```
PRODUCT_NAME = "Whatis Explorer" (già corretto)
```

### 4. Riferimenti nel Codice
- `struct WhatisExplorerLiteApp` → `struct WhatisExplorerApp`
- Commenti "Whatis Explorer Lite" → "Whatis Explorer"
- Tutti i riferimenti a "Lite" rimossi

### 5. Script e Documentazione
- Aggiornare tutti gli script
- Aggiornare documentazione
- Rimuovere riferimenti "Lite"

## 📝 Checklist Pre-Migrazione

- [x] Verificare che ARView.swift sia completo
- [x] Verificare che ContentView gestisca AR condizionalmente
- [x] Verificare che DeviceCapabilities funzioni
- [x] Creare backup completo
- [x] Creare script di migrazione

## 📝 Checklist Post-Migrazione

- [ ] Aprire progetto in Xcode
- [ ] Verificare Bundle ID: `com.andaly.WhatisExplorer`
- [ ] Verificare Product Name: `Whatis Explorer`
- [ ] Pulire build: ⇧⌘K
- [ ] Compilare: ⌘R
- [ ] Testare funzionalità AR
- [ ] Testare funzionalità mappa
- [ ] Verificare che non ci siano riferimenti "Lite" residui

## ⚠️ Note Importanti

1. **Backup**: Lo script crea automaticamente un backup
2. **Bundle ID**: Cambiare il Bundle ID significa che sarà una nuova app (non un aggiornamento)
3. **TestFlight/App Store**: Se l'app è già pubblicata, sarà necessario creare una nuova entry
4. **Dispositivi**: Gli utenti dovranno disinstallare la vecchia app "Lite" e installare la nuova

## 🎯 Risultato Finale

Una sola app **"Whatis Explorer"** che:
- ✅ Funziona su tutti i dispositivi iOS 15+
- ✅ Mostra AR su dispositivi compatibili
- ✅ Mostra solo mappa 2D su dispositivi non compatibili
- ✅ Nessun riferimento a "Lite"
- ✅ Bundle ID unificato: `com.andaly.WhatisExplorer`
- ✅ Nome unificato: "Whatis Explorer"

