# Whatis Backend Workspace

Workspace principale per il progetto Whatis Explorer.

## 📁 Struttura del Progetto

```
whatis_backend/
├── backend/              # Backend Node.js + Python semantic engine (PRODUCTION)
├── ios/                  # App iOS WhatisExplorer (PRODUCTION)
├── android/              # App Android (placeholder - in sviluppo futuro)
├── shared_assets/        # Assets condivisi tra progetti (loghi, icone)
└── _legacy/              # Materiale legacy preservato ma isolato
```

## 🚀 Quick Start

### Backend
```bash
cd backend
npm install
npm start
```

Il server si avvierà su `http://localhost:3000` (configurabile via `.env`).

### iOS App
Aprire il progetto in Xcode:
```bash
cd ios/WhatisExplorer
open WhatisExplorer.xcodeproj
```

### Android App
In sviluppo futuro. Vedi `android/README.md`.

## 📚 Documentazione

- **Backend**: Vedi `backend/docs/` per documentazione tecnica
- **iOS**: Vedi `ios/WhatisExplorer/README.md` per istruzioni setup

## 🔧 Configurazione

### Backend
- File `.env` nella root workspace (non committato)
- Configurazioni MongoDB, API keys, etc.

### iOS
- Bundle ID: `com.andaly.WhatisExplorer`
- Target: iOS 15.0+

## 📝 Note

- Il materiale legacy è stato spostato in `_legacy/LEGACY_2025-12-27/` per mantenere il workspace pulito
- Assets condivisi (loghi, icone) sono in `shared_assets/`
- Ogni progetto ha la propria documentazione nella rispettiva directory

