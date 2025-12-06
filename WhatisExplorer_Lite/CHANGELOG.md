# Changelog - Whatis Explorer Lite

## Versione 1.0.0 (Iniziale)

### ✨ Funzionalità Aggiunte

- **Mappa 2D MapKit**
  - Visualizzazione zone e POI su mappa
  - Marker colorati per categoria
  - Interazione tap per dettagli
  - Centratura su posizione utente

- **Lista POI**
  - Ricerca testuale
  - Filtro per categoria
  - Ordinamento (distanza, nome, categoria)
  - Visualizzazione distanza in tempo reale

- **Dettagli POI**
  - Informazioni complete
  - Immagine (se disponibile)
  - Coordinate e stato coordinate
  - Mini mappa
  - Navigazione verso POI

- **Download Offline**
  - Download zone complete
  - Salvataggio locale in JSON
  - Funzionamento offline automatico
  - Gestione dati offline

- **Navigazione**
  - Freccia direzionale verso POI
  - Apertura in app Mappe
  - Calcolo distanza real-time

- **Impostazioni**
  - Selezione zona
  - Configurazione URL backend
  - Gestione dati offline
  - Informazioni app

### 🏗️ Architettura

- SwiftUI per tutte le view
- MVVM pattern con ViewModels
- Servizi modulari (API, Storage, Location)
- Modelli dati compatibili con backend

### 📱 Compatibilità

- iOS 14.0+
- iPhone 11 e modelli più vecchi
- iPad supportato
- Nessun ARKit o LIDAR richiesto

### 🔧 Configurazione

- Bundle ID: `com.andaly.WhatisExplorerLite`
- Permessi: Localizzazione (When In Use)
- Backend URL configurabile

### 📚 Documentazione

- README.md completo
- Istruzioni setup dettagliate
- Guida configurazione icona
- Riepilogo progetto

