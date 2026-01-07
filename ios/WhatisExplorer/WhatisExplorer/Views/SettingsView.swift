//
//  SettingsView.swift
//  Whatis Explorer
//
//  Settings View with zone selection and offline management
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showingZoneSelection = false
    @State private var showingClearDataAlert = false
    @State private var showingTourGuides = false
    @State private var apiURL: String = {
        // 🔍 TRACCIAMENTO: Leggi UserDefaults all'inizializzazione
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔍 [SettingsView.init] TRACCIAMENTO URL")
        
        // ✅ PERMETTI localhost/127.0.0.1 per sviluppo locale
        // Non rimuovere più - necessario per sviluppo locale
        
        let rawUserDefaultsValue = UserDefaults.standard.string(forKey: "apiBaseURL")
        print("🔍 [SettingsView.init] UserDefaults.standard.string(forKey: 'apiBaseURL')")
        print("🔍 [SettingsView.init] Valore letto da UserDefaults: \(rawUserDefaultsValue ?? "nil")")
        
        // ✅ PERMETTI localhost/127.0.0.1 per sviluppo locale
        // Non rimuovere, usa direttamente l'URL salvato
        
        let savedURL = rawUserDefaultsValue ?? "https://whatisbackend-production.up.railway.app"
        print("🔍 [SettingsView.init] URL dopo fallback: '\(savedURL)'")
        
        // ✅ PULIZIA: Rimuovi /api/ se presente e trailing slash
        var cleaned = savedURL
            .replacingOccurrences(of: "/api", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: "/api/", with: "", options: .caseInsensitive)
        cleaned = cleaned.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
        print("🔍 [SettingsView.init] URL dopo pulizia /api/: '\(cleaned)'")
        
        // ✅ PERMETTI localhost/127.0.0.1 per sviluppo locale
        // Non sostituire, usa direttamente l'URL
        
        print("✅ [SettingsView.init] URL finale valido: '\(cleaned)'")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        return cleaned
    }()
    
    var body: some View {
        NavigationView {
            Form {
                // Current Zone
                Section(header: Text("Zona Corrente")) {
                    if let zone = appState.currentZone {
                        HStack {
                            Text("Nome")
                            Spacer()
                            Text(zone.name)
                                .foregroundColor(.secondary)
                        }
                        
                        if let description = zone.description {
                            HStack {
                                Text("Descrizione")
                                Spacer()
                                Text(description)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                        
                        HStack {
                            Text("POI disponibili")
                            Spacer()
                            Text("\(appState.pois.count)")
                                .foregroundColor(.secondary)
                        }
                        
                        if appState.isOfflineMode {
                            HStack {
                                Image(systemName: "icloud.slash")
                                    .foregroundColor(.orange)
                                Text("Modalità Offline")
                                    .foregroundColor(.orange)
                            }
                        }
                    } else {
                        Text("Nessuna zona caricata")
                            .foregroundColor(.secondary)
                    }
                    
                    Button("Cambia Zona") {
                        showingZoneSelection = true
                    }
                }
                
                // API Settings
                Section(header: Text("Impostazioni API")) {
                    HStack {
                        Text("URL Backend")
                        Spacer()
                        TextField("URL", text: $apiURL)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 200)
                            .onSubmit {
                                // 🔍 TRACCIAMENTO: Salvataggio URL
                                print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                                print("🔍 [SettingsView.onSubmit] TRACCIAMENTO SALVATAGGIO URL")
                                print("🔍 [SettingsView.onSubmit] apiURL corrente: '\(apiURL)'")
                                
                                // ✅ PULIZIA URL: Rimuovi /api/ e localhost/127.0.0.1
                                var cleanedURL = apiURL
                                    .replacingOccurrences(of: "/api", with: "", options: .caseInsensitive)
                                    .replacingOccurrences(of: "/api/", with: "", options: .caseInsensitive)
                                cleanedURL = cleanedURL.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
                                print("🔍 [SettingsView.onSubmit] URL dopo pulizia /api/: '\(cleanedURL)'")
                                
                                // ✅ PERMETTI localhost/127.0.0.1 per sviluppo locale
                                // Non sostituire, usa direttamente l'URL salvato
                                
                                print("🔍 [SettingsView.onSubmit] UserDefaults.standard.set('\(cleanedURL)', forKey: 'apiBaseURL')")
                                UserDefaults.standard.set(cleanedURL, forKey: "apiBaseURL")
                                UserDefaults.standard.synchronize() // ✅ FORZA SINCRONIZZAZIONE
                                
                                // 🔍 VERIFICA: Leggi subito dopo per confermare
                                let verifyValue = UserDefaults.standard.string(forKey: "apiBaseURL")
                                print("🔍 [SettingsView.onSubmit] Verifica dopo salvataggio: '\(verifyValue ?? "nil")'")
                                
                                // ✅ PERMETTI localhost/127.0.0.1 per sviluppo locale
                                // Non rimuovere più - necessario per sviluppo locale
                                print("✅ [SettingsView.onSubmit] API URL salvato (pulito): \(cleanedURL)")
                                print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                            }
                            .onChange(of: apiURL) { newValue in
                                // ✅ Rimuovi /api/ e trailing slash durante la digitazione
                                var cleaned = newValue
                                    .replacingOccurrences(of: "/api", with: "", options: .caseInsensitive)
                                    .replacingOccurrences(of: "/api/", with: "", options: .caseInsensitive)
                                cleaned = cleaned.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
                                
                                // ✅ PERMETTI localhost/127.0.0.1 per sviluppo locale
                                // Non sostituire, usa direttamente l'URL
                                
                                if cleaned != newValue {
                                    apiURL = cleaned
                                }
                            }
                    }
                }
                
                // Offline Data
                Section(header: Text("Dati Offline")) {
                    if appState.isOfflineMode {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                            Text("Dati offline disponibili")
                        }
                    }
                    
                    Button(role: .destructive, action: {
                        showingClearDataAlert = true
                    }) {
                        HStack {
                            Image(systemName: "trash")
                            Text("Elimina Dati Offline")
                        }
                    }
                }
                
                // Tour Guides
                if appState.currentZone != nil {
                    Section(header: Text("Guide Turistiche")) {
                        Button(action: {
                            showingTourGuides = true
                        }) {
                            HStack {
                                Image(systemName: "person.3.fill")
                                Text("Guide Turistiche Locali")
                            }
                        }
                    }
                }
                
                // App Info
                Section(header: Text("Informazioni")) {
                    HStack {
                        Text("Versione")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Build")
                        Spacer()
                        if let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String {
                            Text(buildNumber)
                                .foregroundColor(.secondary)
                        } else {
                            Text("1.0")
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Impostazioni")
            .sheet(isPresented: $showingZoneSelection) {
                ZoneSelectionView()
            }
            .sheet(isPresented: $showingTourGuides) {
                NavigationView {
                    TourGuidesView()
                }
            }
            .alert("Elimina Dati Offline", isPresented: $showingClearDataAlert) {
                Button("Annulla", role: .cancel) { }
                Button("Elimina", role: .destructive) {
                    OfflineStorageService.shared.clearOfflineData()
                    appState.currentZone = nil
                    appState.pois = []
                    appState.isOfflineMode = false
                }
            } message: {
                Text("Tutti i dati scaricati verranno eliminati. Vuoi continuare?")
            }
        }
    }
}

