# Whatis Explorer - Android App

App Android per Whatis Explorer, basata sull'app iOS e compatibile con il backend Node.js.

## 📋 Requisiti

- Android Studio Hedgehog (2023.1.1) o superiore
- JDK 17
- Android SDK 24+ (target: 34)
- Google Maps API Key

## 🚀 Setup

1. **Clona e configura il progetto:**
   ```bash
   cd android
   ```

2. **Configura Google Maps API Key:**
   - Ottieni una chiave API da [Google Cloud Console](https://console.cloud.google.com/)
   - Apri `app/src/main/AndroidManifest.xml`
   - Sostituisci `YOUR_GOOGLE_MAPS_API_KEY` con la tua chiave API

3. **Configura URL Backend:**
   - L'URL di default è `http://192.168.1.4:3000` (sviluppo locale)
   - Puoi configurarlo nelle Settings dell'app
   - Per produzione, usa l'URL del tuo backend cloud

4. **Apri in Android Studio:**
   - File → Open → Seleziona la cartella `android`
   - Gradle sincronizzerà le dipendenze automaticamente

## 🏗️ Struttura

```
android/
├── app/
│   └── src/main/java/com/andaly/whatisexplorer/
│       ├── models/          # Modelli dati (POI, Zone)
│       ├── services/        # Servizi (API, Location, Storage, Cache)
│       └── ui/
│           ├── screens/     # Schermate Compose
│           ├── viewmodels/  # ViewModels MVVM
│           └── theme/       # Tema Material 3
```

## 🔌 API Backend

L'app si connette al backend tramite le API:

- `GET /api/zones?format=json` - Lista zone
- `GET /mobile/zones/:zoneId/pois` - POI di una zona

Vedi `backend/routes/mobile.js` per la documentazione completa delle API.

## 📱 Funzionalità

- ✅ Selezione zona
- ✅ Visualizzazione POI sulla mappa
- ✅ Lista POI
- ✅ Modalità offline (cache locale)
- ✅ Cache immagini
- ✅ Impostazioni (URL backend configurabile)

## 🔄 Sviluppo

### Build
```bash
./gradlew assembleDebug
```

### Run
```bash
./gradlew installDebug
```

### Test
```bash
./gradlew test
```

## 📚 Tecnologie

- **Kotlin** - Linguaggio principale
- **Jetpack Compose** - UI declarativa
- **Material 3** - Design system
- **Retrofit** - Networking
- **Kotlinx Serialization** - JSON parsing
- **Room** - Database locale (per offline)
- **DataStore** - Storage preferences
- **Google Maps Compose** - Mappe
- **Coil** - Image loading
- **Coroutines** - Async programming

## 🔗 Collegamenti

- **Backend:** `../backend/`
- **iOS Reference:** `../ios/WhatisExplorer/`
- **Shared Assets:** `../shared_assets/`
