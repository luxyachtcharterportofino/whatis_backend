# ⚡ Quick Start - Whatis Explorer Lite

## 🎯 Setup Rapido (5 minuti)

### 1. Crea Progetto Xcode (2 min)
```
1. Apri Xcode
2. File → New → Project
3. iOS → App
4. Nome: WhatisExplorerLite
5. Interface: SwiftUI
6. Language: Swift
7. iOS 14.0+
```

### 2. Importa File (1 min)
```
1. Trascina la cartella WhatisExplorerLite/ nel progetto Xcode
2. ✅ Copy items if needed
3. ✅ Create groups
4. ✅ Target: WhatisExplorerLite
```

### 3. Configura (1 min)
```
1. Target → Signing & Capabilities
2. + Capability → Location Services
3. Services/APIService.swift → Cambia baseURL
```

### 4. Icona (1 min)
```
1. Assets.xcassets → AppIcon
2. Trascina iOS_AppIcon_1024.png nello slot 1024pt
3. Xcode genera automaticamente tutto
```

### 5. Run! 🚀
```
⌘R per avviare
```

## 📍 Dove Sono i File?

```
WhatisExplorer_Lite/
├── WhatisExplorerLite/          ← Importa questa cartella in Xcode
│   ├── Models/                  ← Modelli dati
│   ├── Services/                ← Servizi (API, Storage, Location)
│   ├── Views/                   ← Tutte le view SwiftUI
│   └── WhatisExplorerLiteApp.swift
├── Info.plist                   ← Aggiungi al progetto
├── README.md                    ← Documentazione completa
├── SETUP_INSTRUCTIONS.md        ← Istruzioni dettagliate
└── ICON_SETUP.md                ← Setup icona
```

## ⚙️ Configurazioni Minime

### URL Backend
```swift
// Services/APIService.swift
private let baseURL = "https://tuo-backend.com"
```

### Bundle ID
```
Xcode → Target → General → Bundle Identifier
com.andaly.WhatisExplorerLite
```

## ✅ Checklist Veloce

- [ ] Progetto Xcode creato
- [ ] File importati
- [ ] Location capability aggiunta
- [ ] URL backend configurato
- [ ] Icona aggiunta (opzionale per test)
- [ ] Run su simulatore

## 🐛 Problemi?

1. **Errore "Cannot find 'POI'"**
   → Pulisci build: ⇧⌘K, poi ⌘B

2. **Localizzazione non funziona**
   → Verifica Info.plist ha NSLocationWhenInUseUsageDescription

3. **Dati non caricano**
   → Controlla URL backend e connessione

## 📚 Documentazione Completa

- `SETUP_INSTRUCTIONS.md` - Setup dettagliato passo-passo
- `README.md` - Documentazione completa
- `ICON_SETUP.md` - Setup icona app
- `PROJECT_SUMMARY.md` - Riepilogo progetto

## 🎉 Pronto!

L'app è completa e funzionante. Segui i passi sopra e sarai operativo in 5 minuti!

