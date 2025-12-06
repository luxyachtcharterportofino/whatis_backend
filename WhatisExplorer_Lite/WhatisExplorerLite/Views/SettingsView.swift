//
//  SettingsView.swift
//  Whatis Explorer – Lite
//
//  Settings View with zone selection and offline management
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showingZoneSelection = false
    @State private var showingClearDataAlert = false
    @State private var apiURL: String = {
        // 🔍 TRACCIAMENTO: Leggi UserDefaults all'inizializzazione
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔍 [SettingsView.init] TRACCIAMENTO URL")
        
        // ✅ PULIZIA AGGRESSIVA: Verifica TUTTE le chiavi UserDefaults
        let allKeys = UserDefaults.standard.dictionaryRepresentation().keys
        for key in allKeys {
            if let value = UserDefaults.standard.object(forKey: key) {
                let valueString = String(describing: value)
                if valueString.contains("localhost") || valueString.contains("127.0.0.1") {
                    print("⚠️ [SettingsView.init] TROVATO VALORE PROBLEMATICO in UserDefaults!")
                    print("⚠️ [SettingsView.init] Chiave: '\(key)' = '\(valueString)'")
                    print("⚠️ [SettingsView.init] RIMOZIONE IMMEDIATA...")
                    UserDefaults.standard.removeObject(forKey: key)
                    UserDefaults.standard.synchronize() // ✅ FORZA SINCRONIZZAZIONE
                    print("✅ [SettingsView.init] RIMOSSO: '\(key)'")
                }
            }
        }
        
        let rawUserDefaultsValue = UserDefaults.standard.string(forKey: "apiBaseURL")
        print("🔍 [SettingsView.init] UserDefaults.standard.string(forKey: 'apiBaseURL')")
        print("🔍 [SettingsView.init] Valore letto da UserDefaults: \(rawUserDefaultsValue ?? "nil")")
        
        // ✅ PULIZIA AUTOMATICA: Se contiene localhost/127.0.0.1, rimuovi da UserDefaults
        if let rawValue = rawUserDefaultsValue, (rawValue.contains("localhost") || rawValue.contains("127.0.0.1")) {
            print("⚠️ [SettingsView.init] TROVATO URL PROBLEMATICO in UserDefaults: '\(rawValue)'")
            print("⚠️ [SettingsView.init] Rimozione valore problematico da UserDefaults")
            UserDefaults.standard.removeObject(forKey: "apiBaseURL")
            UserDefaults.standard.synchronize() // ✅ FORZA SINCRONIZZAZIONE
            print("✅ [SettingsView.init] UserDefaults pulito. Userò il default: 'http://192.168.1.8:3000'")
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            return "http://192.168.1.8:3000"
        }
        
        let savedURL = rawUserDefaultsValue ?? "http://192.168.1.8:3000"
        print("🔍 [SettingsView.init] URL dopo fallback: '\(savedURL)'")
        
        // ✅ PULIZIA: Rimuovi /api/ se presente e trailing slash
        var cleaned = savedURL
            .replacingOccurrences(of: "/api", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: "/api/", with: "", options: .caseInsensitive)
        cleaned = cleaned.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
        print("🔍 [SettingsView.init] URL dopo pulizia /api/: '\(cleaned)'")
        
        // ✅ Se contiene localhost o 127.0.0.1 dopo pulizia, usa default
        if cleaned.contains("localhost") || cleaned.contains("127.0.0.1") {
            print("⚠️ [SettingsView.init] ATTENZIONE: URL contiene localhost/127.0.0.1 dopo pulizia")
            print("⚠️ [SettingsView.init] URL problematico: '\(cleaned)'")
            print("⚠️ [SettingsView.init] Sostituito con default: 'http://192.168.1.8:3000'")
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            return "http://192.168.1.8:3000"
        }
        
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
                                
                                // ✅ Se contiene localhost o 127.0.0.1, usa default
                                if cleanedURL.contains("localhost") || cleanedURL.contains("127.0.0.1") {
                                    print("⚠️ [SettingsView.onSubmit] ATTENZIONE: URL contiene localhost/127.0.0.1")
                                    print("⚠️ [SettingsView.onSubmit] URL problematico: '\(cleanedURL)'")
                                    cleanedURL = "http://192.168.1.8:3000"
                                    apiURL = cleanedURL
                                    print("⚠️ [SettingsView.onSubmit] Sostituito con default: '\(cleanedURL)'")
                                }
                                
                                print("🔍 [SettingsView.onSubmit] UserDefaults.standard.set('\(cleanedURL)', forKey: 'apiBaseURL')")
                                UserDefaults.standard.set(cleanedURL, forKey: "apiBaseURL")
                                UserDefaults.standard.synchronize() // ✅ FORZA SINCRONIZZAZIONE
                                
                                // 🔍 VERIFICA: Leggi subito dopo per confermare
                                let verifyValue = UserDefaults.standard.string(forKey: "apiBaseURL")
                                print("🔍 [SettingsView.onSubmit] Verifica dopo salvataggio: '\(verifyValue ?? "nil")'")
                                
                                // ✅ VERIFICA FINALE: Assicurati che non ci siano altri valori problematici
                                let allKeys = UserDefaults.standard.dictionaryRepresentation().keys
                                for key in allKeys {
                                    if let value = UserDefaults.standard.object(forKey: key) {
                                        let valueString = String(describing: value)
                                        if valueString.contains("localhost") || valueString.contains("127.0.0.1") {
                                            print("⚠️ [SettingsView.onSubmit] TROVATO VALORE PROBLEMATICO POST-SALVATAGGIO!")
                                            print("⚠️ [SettingsView.onSubmit] Chiave: '\(key)' = '\(valueString)'")
                                            print("⚠️ [SettingsView.onSubmit] RIMOZIONE IMMEDIATA...")
                                            UserDefaults.standard.removeObject(forKey: key)
                                            UserDefaults.standard.synchronize()
                                            print("✅ [SettingsView.onSubmit] RIMOSSO: '\(key)'")
                                        }
                                    }
                                }
                                print("✅ [SettingsView.onSubmit] API URL salvato (pulito): \(cleanedURL)")
                                print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                            }
                            .onChange(of: apiURL) { newValue in
                                // ✅ Rimuovi /api/ e trailing slash durante la digitazione
                                var cleaned = newValue
                                    .replacingOccurrences(of: "/api", with: "", options: .caseInsensitive)
                                    .replacingOccurrences(of: "/api/", with: "", options: .caseInsensitive)
                                cleaned = cleaned.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
                                
                                // ✅ Se contiene localhost o 127.0.0.1, sostituisci con default
                                if cleaned.contains("localhost") || cleaned.contains("127.0.0.1") {
                                    cleaned = "http://192.168.1.8:3000"
                                }
                                
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
                        Text("Lite")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Impostazioni")
            .sheet(isPresented: $showingZoneSelection) {
                ZoneSelectionView()
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

