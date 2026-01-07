# 🚀 START HERE - Whatis Explorer Lite

## ⚡ Setup in 5 Minuti

### 1️⃣ Apri Xcode
```
Apri Xcode → File → New → Project
```

### 2️⃣ Crea Progetto
- **iOS → App**
- Product Name: `WhatisExplorerLite`
- Bundle ID: `com.andaly.WhatisExplorerLite`
- Interface: **SwiftUI**
- Language: **Swift**
- Minimum: **iOS 15.0**
- Salva in: `~/Desktop/WhatisExplorer_Lite/`

### 3️⃣ Importa File
- Click destro sul progetto → **Add Files to "WhatisExplorerLite"...**
- Seleziona cartella `WhatisExplorerLite/`
- ✅ Copy items if needed
- ✅ Create groups
- ✅ Target: WhatisExplorerLite

### 4️⃣ Sostituisci App File
- Elimina `WhatisExplorerLiteApp.swift` generato
- Il file corretto è già in `WhatisExplorerLite/WhatisExplorerLiteApp.swift`

### 5️⃣ Configura Capabilities
- Target → Signing & Capabilities
- + Capability → **Location Services**
- Seleziona **When In Use**

### 6️⃣ Build & Run
- **Product → Build** (⌘B)
- **Product → Run** (⌘R)

## ✅ Fatto!

L'app è pronta! 🎉

## 📚 Documentazione Completa

- **[AUTO_SETUP.md](AUTO_SETUP.md)** - Setup dettagliato passo-passo
- **[BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)** - Istruzioni build complete
- **[README.md](README.md)** - Documentazione completa
- **[TESTFLIGHT_SETUP.md](TESTFLIGHT_SETUP.md)** - 🚀 Distribuzione con TestFlight (raccomandato)

## 🎯 Distribuzione TestFlight

Per distribuire l'app su TestFlight (durata 90 giorni, più stabile):

```bash
cd WhatisExplorer_Lite
./prepare_for_testflight.sh
```

Poi segui: **[TESTFLIGHT_SETUP.md](TESTFLIGHT_SETUP.md)**

## 🆘 Problemi?

- **App smette di funzionare dopo qualche giorno?** → Vedi [IOS_APP_STABILITY.md](IOS_APP_STABILITY.md)
- **Altri problemi?** → Vedi sezione "Risoluzione Problemi" in [AUTO_SETUP.md](AUTO_SETUP.md)
