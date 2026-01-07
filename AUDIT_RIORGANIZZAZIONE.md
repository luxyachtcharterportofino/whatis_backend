# 📋 AUDIT COMPLETO - Riorganizzazione Workspace

**Data Audit:** 2025-12-27  
**Root Directory:** `/Users/andreastagnaro/Desktop/Whatis/whatis_backend/`

---

## 🎯 OBIETTIVO

Normalizzare la struttura del workspace separando:
- **Production Backend** (Node.js + Python semantic engine)
- **Production iOS App** (WhatisExplorer - unica app in produzione)
- **Android** (placeholder per futuro sviluppo)
- **Legacy** (tutto il materiale obsoleto preservato ma isolato)

---

## 📊 CLASSIFICAZIONE ATTUALE

### ✅ PRODUCTION BACKEND

**Core Backend (Node.js/Express):**
```
├── server.js                    ✅ Entry point principale
├── package.json                 ✅ Dipendenze Node.js
├── package-lock.json            ✅ Lock file dipendenze
├── Procfile                     ✅ Configurazione deploy (Railway/Render)
├── railway.json                 ✅ Config Railway
├── render.yaml                  ✅ Config Render
├── .env                         ⚠️  (non visibile, ma dovrebbe esistere)
├── models/                      ✅ Mongoose models (GeographicArea, Poi, ProposedPOI, Zone)
├── routes/                      ✅ Express routes
│   ├── admin/                   ✅ Admin routes
│   ├── mobile.js                ✅ API mobile app
│   ├── pois.js                  ✅ POI routes
│   ├── translations.js          ✅ Translation routes
│   └── zones.js                 ✅ Zone routes
├── services/                    ✅ Business logic services
│   └── providers/               ✅ POI providers (OSM, Wiki, AI)
├── utils/                       ✅ Utility functions
├── middleware/                  ✅ Express middleware
├── views/                       ✅ EJS templates (admin web interface)
├── public/                      ✅ Static assets (CSS, JS, images, icons)
├── cache/                       ✅ Runtime cache (municipalities, pois, semantic, wiki, wrecks)
├── logs/                        ✅ Application logs
└── config/                      ✅ Config files (api_keys.json)
```

**Semantic Engine (Python):**
```
└── semantic_engine/             ✅ Python semantic enrichment service
    ├── app.py                   ✅ Flask/FastAPI app
    ├── index.js                 ✅ Bridge Node.js
    ├── requirements.txt         ✅ Python dependencies
    ├── start_semantic_engine.py ✅ Entry point
    ├── core/                    ✅ Core semantic logic
    └── static/                  ✅ Static assets
```

**Deploy Scripts (Production):**
```
├── deploy_railway_cli.sh        ✅ Deploy script Railway
├── deploy_to_cloud.sh           ✅ Generic deploy script
├── setup_railway_vars.sh        ✅ Setup Railway vars
└── rename_to_whatis_explorer.sh ⚠️  (potrebbe essere legacy)
```

**Documentation (Production):**
```
├── docs/                        ✅ Technical documentation
│   ├── clean_structure_tree.md
│   ├── DEBUG_GPT_POI_GENERATION.md
│   ├── geographic-areas-system.md
│   ├── perplexity-module.md
│   ├── PHOTO_LICENSE_CHECKER.md
│   ├── POI_GENERATION_FLOW.md
│   ├── refactor_plan.md
│   ├── zone-cache-invalidation.md
│   └── zone-editing-improvements.md
├── CLEANUP_REPORT.md            ✅ Report cleanup
├── GLOBAL_REVISION_SUMMARY.md   ✅ Revision summary
└── MULTI_SOURCE_POI_SYSTEM.md   ✅ System architecture doc
```

---

### ✅ PRODUCTION iOS APP

**WhatisExplorer - App iOS Production:**

```
WhatisExplorer/
├── WhatisExplorer/              ✅ Source code Swift/SwiftUI
│   ├── WhatisExplorerApp.swift  ✅ App entry point
│   ├── Models/                  ✅ POI.swift, Zone.swift
│   ├── Services/                ✅ APIService, LocationManager, OfflineStorage, etc.
│   ├── Views/                   ✅ ContentView, MapView, POIListView, etc.
│   ├── Assets.xcassets/         ✅ App icons, images
│   └── Info.plist               ✅ App configuration
├── WhatisExplorer.xcodeproj/    ✅ Xcode project (PRODUCTION)
│   ├── project.pbxproj          ✅ Project file
│   ├── project.xcworkspace/     ✅ Workspace
│   └── xcshareddata/            ✅ Shared schemes
└── [Documentation essenziale]   ✅ Solo i file .md essenziali
    ├── README.md                ✅ Documentazione principale
    ├── PROJECT_STRUCTURE.md     ✅ Struttura progetto
    └── SETUP_INSTRUCTIONS.md    ✅ Istruzioni setup
```

---

### 🗑️ LEGACY (Da spostare in _legacy/)

**1. App iOS Legacy:**
```
WhatisExplorer_Lite/             ❌ App iOS legacy (non più usata)
└── WhatisExplorer.xcodeproj/    ❌ Progetto Xcode legacy
```

**2. Backup e file temporanei iOS:**
```
WhatisExplorer/
├── backup_before_migration_20251210_182633/  ❌ Backup completo di migrazione
│   └── WhatisExplorerLite/                   ❌ Backup app Lite
├── WhatisExplorerLite.xcodeproj/             ❌ Progetto legacy rimasto
├── project.pbxproj.backup_20251210_191100    ❌ Backup project file
└── build/                                     ❌ Build artifacts (generati)
```

**3. Script di fix/migrazione temporanei (iOS):**
```
WhatisExplorer/
├── Apri_Xcode.command                        ❌ Script utility
├── check_device_trust.sh                     ❌ Script diagnostico
├── clean_and_deploy.sh                       ❌ Script deploy
├── cleanup_old_versions.sh                   ❌ Script cleanup
├── create_xcode_project_complete.sh          ❌ Script setup
├── create_xcode_project.sh                   ❌ Script setup
├── diagnose_deploy_issue.sh                  ❌ Script diagnostico
├── fix_build_and_deploy.sh                   ❌ Script fix
├── fix_deploy_final.sh                       ❌ Script fix
├── fix_deploy_issue.sh                       ❌ Script fix
├── fix_install_issue.sh                      ❌ Script fix
├── fix_no_install.sh                         ❌ Script fix
├── fix_run_button.sh                         ❌ Script fix
├── fix_signing_team.sh                       ❌ Script fix
├── fix_warnings_and_run.sh                   ❌ Script fix
├── fix_xcode_project_references.sh           ❌ Script fix
├── fix_xcode_workspace.sh                    ❌ Script fix
├── force_install.sh                          ❌ Script fix
├── force_provisioning_regeneration.sh        ❌ Script fix
├── generate_app_icon.py                      ❌ Script utility
├── generate_xcode_project.py                 ❌ Script utility
├── migrate_to_unified_app.sh                 ❌ Script migrazione
├── prepare_for_testflight.sh                 ❌ Script deploy
├── remove_all_lite_references.sh             ❌ Script migrazione
├── setup_xcode_project.sh                    ❌ Script setup
└── test_backend_connection.sh                ❌ Script test
```

**4. Documentazione temporanea/diagnostica (iOS):**
```
WhatisExplorer/
├── AUTO_SETUP.md                             ❌ Doc temporanea
├── BUILD_INSTRUCTIONS.md                     ❌ Doc setup
├── CHANGELOG.md                              ⚠️  (potrebbe essere utile)
├── CHANGES_SUMMARY.md                        ❌ Doc temporanea
├── CONFIGURAZIONE_BACKEND.md                 ⚠️  (potrebbe essere utile)
├── DEPLOY_BACKEND_CLOUD.md                   ⚠️  (potrebbe essere utile)
├── DIAGNOSTICA_APP.md                        ❌ Doc diagnostica
├── FINAL_CHECKLIST.md                        ❌ Doc temporanea
├── FIX_DEPLOY_ISSUE.md                       ❌ Doc fix
├── FIX_LOCALHOST.md                          ❌ Doc fix
├── FIX_TEAM_SIGNING.md                       ❌ Doc fix
├── FIXES_APPLIED.md                          ❌ Doc fix
├── GUIDA_DEPLOY_PASSO_PASSO.md               ⚠️  (potrebbe essere utile)
├── ICON_SETUP.md                             ⚠️  (potrebbe essere utile)
├── IOS_APP_STABILITY.md                      ❌ Doc diagnostica
├── MIGRATION_COMPLETE.md                     ❌ Doc migrazione
├── MIGRATION_PLAN.md                         ❌ Doc migrazione
├── MIGRATION_SUMMARY.md                      ❌ Doc migrazione
├── PROJECT_SUMMARY.md                        ❌ Doc temporanea
├── QUICK_FIX_APP_EXPIRED.md                  ❌ Doc fix
├── QUICK_START.md                            ⚠️  (potrebbe essere utile)
├── SOLUZIONE_DEPLOY.md                       ❌ Doc fix
├── SOLUZIONE_FINALE_RUN_GRIGIO.md            ❌ Doc fix
├── SOLUZIONE_IMMEDIATA.md                    ❌ Doc fix
├── SOLUZIONE_NO_INSTALL.md                   ❌ Doc fix
├── SOLUZIONE_RUN_GRIGIO.md                   ❌ Doc fix
├── START_HERE.md                             ⚠️  (potrebbe essere utile)
├── TESTFLIGHT_SETUP.md                       ⚠️  (potrebbe essere utile)
├── UNIFIED_APP_STRATEGY.md                   ❌ Doc strategia
├── VERIFICA_COMMAND.md                       ❌ Doc diagnostica
└── VERIFICA_INSTALLAZIONE.md                 ❌ Doc diagnostica
```

**5. Documentazione backend alternativa:**
```
├── DEPLOY_ALTERNATIVO.md                     ❌ Doc deploy alternativo
└── DEPLOY_RENDER.md                          ⚠️  (potrebbe essere utile per riferimento)
```

**6. Script backup:**
```
├── Backup_Automatico.command                 ❌ Script backup
└── Ripristina_Backup.command                 ❌ Script restore
```

**7. File di configurazione legacy:**
```
├── project.yml                                ❌ (dentro WhatisExplorer/, sembra non usato)
```

---

### 🤖 ANDROID (Placeholder per futuro)

```
WhatisExplorerAndroid/                        ⚠️  Appena creato, incompleto
├── app/                                      ⚠️  Struttura base creata
├── build.gradle.kts                          ⚠️  Config Gradle
├── settings.gradle.kts                       ⚠️  Settings Gradle
└── gradle.properties                         ⚠️  Properties
```

**Decisione:** Rimuovere per ora, verrà ricreato quando si riprenderà lo sviluppo Android.

---

### 📦 SHARED ASSETS (Da preservare separatamente)

```
public/
├── images/                                   ✅ Loghi Whatis
│   ├── whatis-logo-dark.svg
│   ├── whatis-logo-horizontal.svg
│   ├── whatis-logo-outline.svg
│   └── whatis-logo-white.svg
└── icons/                                    ✅ Icon library
```

---

## 🏗️ STRUTTURA TARGET PROPOSTA

```
Desktop/Whatis/whatis_backend/
├── backend/                                  🆕 Root backend (Node.js + Python)
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   ├── Procfile
│   ├── railway.json
│   ├── render.yaml
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── middleware/
│   ├── views/
│   ├── public/
│   ├── cache/
│   ├── logs/
│   ├── config/
│   ├── semantic_engine/
│   ├── docs/
│   ├── scripts/                              🆕 Script deploy/utility production
│   │   ├── deploy_railway_cli.sh
│   │   ├── deploy_to_cloud.sh
│   │   └── setup_railway_vars.sh
│   └── README.md
│
├── ios/                                      🆕 Root iOS app
│   └── WhatisExplorer/
│       ├── WhatisExplorer/                   ✅ Source code
│       ├── WhatisExplorer.xcodeproj/         ✅ Xcode project
│       └── README.md                         ✅ Solo doc essenziale
│
├── android/                                  🆕 Placeholder vuoto per futuro
│   └── README.md                             🆕 "Android app coming soon"
│
├── shared_assets/                            🆕 Assets condivisi tra progetti
│   └── logos/
│       ├── whatis-logo-dark.svg
│       ├── whatis-logo-horizontal.svg
│       ├── whatis-logo-outline.svg
│       └── whatis-logo-white.svg
│
└── _legacy/                                  🆕 Tutto il materiale legacy preservato
    └── LEGACY_2025-12-27/
        ├── WhatisExplorer_Lite/              ❌ App iOS legacy
        ├── WhatisExplorer/                   ❌ Backup, script fix, doc temporanee
        │   ├── backup_before_migration_20251210_182633/
        │   ├── WhatisExplorerLite.xcodeproj/
        │   ├── project.pbxproj.backup_20251210_191100
        │   ├── build/
        │   ├── [tutti gli script .sh]
        │   └── [tutti i .md diagnostici/fix]
        ├── DEPLOY_ALTERNATIVO.md             ❌ Doc deploy alternativo
        ├── Backup_Automatico.command         ❌ Script backup
        └── Ripristina_Backup.command         ❌ Script restore
```

---

## 📝 MAPPATURA MOVIMENTI DETTAGLIATA

### Movimenti Production Backend → `backend/`

| Path Attuale | Path Target | Note |
|-------------|-------------|------|
| `server.js` | `backend/server.js` | ✅ Entry point |
| `package.json` | `backend/package.json` | ✅ |
| `package-lock.json` | `backend/package-lock.json` | ✅ |
| `Procfile` | `backend/Procfile` | ✅ |
| `railway.json` | `backend/railway.json` | ✅ |
| `render.yaml` | `backend/render.yaml` | ✅ |
| `models/` | `backend/models/` | ✅ |
| `routes/` | `backend/routes/` | ✅ |
| `services/` | `backend/services/` | ✅ |
| `utils/` | `backend/utils/` | ✅ |
| `middleware/` | `backend/middleware/` | ✅ |
| `views/` | `backend/views/` | ✅ |
| `public/` | `backend/public/` | ⚠️  (ma loghi → shared_assets) |
| `cache/` | `backend/cache/` | ✅ |
| `logs/` | `backend/logs/` | ✅ |
| `config/` | `backend/config/` | ✅ |
| `semantic_engine/` | `backend/semantic_engine/` | ✅ |
| `docs/` | `backend/docs/` | ✅ |
| `node_modules/` | `backend/node_modules/` | ✅ |
| `deploy_railway_cli.sh` | `backend/scripts/deploy_railway_cli.sh` | ✅ |
| `deploy_to_cloud.sh` | `backend/scripts/deploy_to_cloud.sh` | ✅ |
| `setup_railway_vars.sh` | `backend/scripts/setup_railway_vars.sh` | ✅ |

**Nuovi file da creare:**
- `backend/README.md` (spostare/sintetizzare da root)

---

### Movimenti Production iOS → `ios/WhatisExplorer/`

| Path Attuale | Path Target | Note |
|-------------|-------------|------|
| `WhatisExplorer/WhatisExplorer/` | `ios/WhatisExplorer/WhatisExplorer/` | ✅ Source code |
| `WhatisExplorer/WhatisExplorer.xcodeproj/` | `ios/WhatisExplorer/WhatisExplorer.xcodeproj/` | ✅ Xcode project |
| `WhatisExplorer/README.md` | `ios/WhatisExplorer/README.md` | ✅ Solo se essenziale |
| `WhatisExplorer/PROJECT_STRUCTURE.md` | `ios/WhatisExplorer/PROJECT_STRUCTURE.md` | ✅ Se utile |
| `WhatisExplorer/SETUP_INSTRUCTIONS.md` | `ios/WhatisExplorer/SETUP_INSTRUCTIONS.md` | ✅ Se utile |

---

### Movimenti Legacy → `_legacy/LEGACY_2025-12-27/`

| Path Attuale | Path Target | Note |
|-------------|-------------|------|
| `WhatisExplorer_Lite/` | `_legacy/LEGACY_2025-12-27/WhatisExplorer_Lite/` | ❌ App legacy |
| `WhatisExplorer/backup_before_migration_20251210_182633/` | `_legacy/LEGACY_2025-12-27/backup_before_migration_20251210_182633/` | ❌ Backup |
| `WhatisExplorer/WhatisExplorerLite.xcodeproj/` | `_legacy/LEGACY_2025-12-27/WhatisExplorerLite.xcodeproj/` | ❌ Progetto legacy |
| `WhatisExplorer/project.pbxproj.backup_20251210_191100` | `_legacy/LEGACY_2025-12-27/project.pbxproj.backup_20251210_191100` | ❌ Backup |
| `WhatisExplorer/build/` | `_legacy/LEGACY_2025-12-27/build/` | ❌ Build artifacts |
| `WhatisExplorer/*.sh` (tutti gli script) | `_legacy/LEGACY_2025-12-27/scripts_ios/` | ❌ Script temporanei |
| `WhatisExplorer/*.md` (diagnostici/fix) | `_legacy/LEGACY_2025-12-27/docs_ios_diagnostici/` | ❌ Doc temporanee |
| `DEPLOY_ALTERNATIVO.md` | `_legacy/LEGACY_2025-12-27/DEPLOY_ALTERNATIVO.md` | ❌ Doc alternativo |
| `Backup_Automatico.command` | `_legacy/LEGACY_2025-12-27/Backup_Automatico.command` | ❌ Script backup |
| `Ripristina_Backup.command` | `_legacy/LEGACY_2025-12-27/Ripristina_Backup.command` | ❌ Script restore |

---

### Movimenti Shared Assets → `shared_assets/`

| Path Attuale | Path Target | Note |
|-------------|-------------|------|
| `public/images/whatis-logo-*.svg` | `shared_assets/logos/whatis-logo-*.svg` | ✅ Loghi condivisi |

---

### Rimozione/Rinomina Android

| Path Attuale | Azione | Note |
|-------------|--------|------|
| `WhatisExplorerAndroid/` | 🗑️ **RIMUOVERE** | ⚠️  Incompleto, verrà ricreato |

**Creare:**
- `android/README.md` con testo "Android app coming soon"

---

## ⚠️ SANITY CHECKS POST-MOVIMENTO

### Backend
- ✅ `cd backend && npm start` funziona
- ✅ MongoDB connection OK
- ✅ API routes rispondono (`/api/zones`, `/mobile/zones/:id/pois`)
- ✅ Semantic engine avvia (`semantic_engine/start_semantic_engine.py`)

### iOS
- ✅ Aprire `ios/WhatisExplorer/WhatisExplorer.xcodeproj` in Xcode
- ✅ Progetto compila senza errori
- ✅ App si avvia sul simulatore/dispositivo
- ✅ Connessione backend funziona

---

## 🚀 PIANO DI ESECUZIONE

### Fase 1: Preparazione
1. Creare struttura directory target
2. Verificare che non ci siano processi attivi (server, Xcode)

### Fase 2: Movimenti
1. Spostare tutto il backend → `backend/`
2. Spostare iOS production → `ios/WhatisExplorer/`
3. Spostare shared assets → `shared_assets/`
4. Spostare legacy → `_legacy/LEGACY_2025-12-27/`
5. Rimuovere `WhatisExplorerAndroid/`
6. Creare `android/README.md`

### Fase 3: Cleanup e Fix
1. Aggiornare riferimenti nei file (se necessario)
2. Creare `.gitignore` appropriato per ogni progetto
3. Test sanity checks

### Fase 4: Documentazione
1. Creare `README.md` nella root con overview
2. Aggiornare `backend/README.md`
3. Aggiornare `ios/WhatisExplorer/README.md`

---

## ✅ CHECKLIST APPROVAZIONE

- [ ] Audit completo revisionato
- [ ] Struttura target approvata
- [ ] Mappatura movimenti verificata
- [ ] Backup creato (opzionale ma consigliato)
- [ ] Pronto per esecuzione

---

**⚠️ IMPORTANTE:** Questo documento è solo una proposta. **NON eseguire movimenti** finché non viene dato esplicito consenso.

