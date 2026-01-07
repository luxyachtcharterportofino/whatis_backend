//
//  WhatisExplorerApp.swift
//  Whatis Explorer
//
//  Whatis Explorer - App unificata
//  Supporta ARKit se disponibile, altrimenti usa solo mappa 2D
//  Compatibile con tutti i dispositivi iOS 15+
//

import SwiftUI
import UIKit

@main
struct WhatisExplorerApp: App {
    @StateObject private var appState = AppState()
    
    init() {
        // ✅ Mantieni lo schermo sempre acceso durante l'uso dell'app
        UIApplication.shared.isIdleTimerDisabled = true
        print("✅ [WhatisExplorerApp.init] Schermo sempre attivo: ABILITATO")
        // 🔍 TRACCIAMENTO COMPLETO: Inizializzazione App
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔍 [WhatisExplorerApp.init] ═══════════════════════════")
        print("🔍 [WhatisExplorerApp.init] APP INIZIALIZZATA")
        print("🔍 [WhatisExplorerApp.init] ═══════════════════════════")
        
        // ✅ PULIZIA AGGRESSIVA: Rimuovi QUALSIASI valore con localhost/127.0.0.1
        let allKeys = UserDefaults.standard.dictionaryRepresentation().keys
        print("🔍 [WhatisExplorerApp.init] TUTTE le chiavi UserDefaults (\(allKeys.count)):")
        for key in allKeys.sorted() {
            if let value = UserDefaults.standard.object(forKey: key) {
                let valueString = String(describing: value)
                print("   • '\(key)' = '\(valueString)'")
                
                // ✅ RIMOZIONE AUTOMATICA: Se contiene localhost/127.0.0.1, RIMUOVI
                if valueString.contains("localhost") || valueString.contains("127.0.0.1") {
                    print("   ⚠️ [WhatisExplorerApp.init] TROVATO VALORE PROBLEMATICO!")
                    print("   ⚠️ [WhatisExplorerApp.init] Chiave: '\(key)'")
                    print("   ⚠️ [WhatisExplorerApp.init] Valore: '\(valueString)'")
                    print("   ⚠️ [WhatisExplorerApp.init] RIMOZIONE IMMEDIATA...")
                    UserDefaults.standard.removeObject(forKey: key)
                    print("   ✅ [WhatisExplorerApp.init] RIMOSSO: '\(key)'")
                }
            }
        }
        
        // ✅ VERIFICA SPECIFICA per apiBaseURL
        let apiBaseURLValue = UserDefaults.standard.string(forKey: "apiBaseURL")
        print("🔍 [WhatisExplorerApp.init] ──────────────────────────────")
        print("🔍 [WhatisExplorerApp.init] VERIFICA SPECIFICA apiBaseURL:")
        print("🔍 [WhatisExplorerApp.init] Valore: \(apiBaseURLValue ?? "nil")")
        
        if let urlValue = apiBaseURLValue {
            if urlValue.contains("localhost") || urlValue.contains("127.0.0.1") {
                print("⚠️ [WhatisExplorerApp.init] apiBaseURL contiene localhost/127.0.0.1!")
                print("⚠️ [WhatisExplorerApp.init] RIMOZIONE IMMEDIATA...")
                UserDefaults.standard.removeObject(forKey: "apiBaseURL")
                print("✅ [WhatisExplorerApp.init] apiBaseURL RIMOSSO da UserDefaults")
            }
        }
        
        // ✅ VERIFICA FINALE
        let finalValue = UserDefaults.standard.string(forKey: "apiBaseURL")
        print("🔍 [WhatisExplorerApp.init] Valore FINALE apiBaseURL: \(finalValue ?? "nil")")
        print("🔍 [WhatisExplorerApp.init] ──────────────────────────────")
        
        // ✅ VERIFICA BUNDLE RESOURCES
        if let bundlePath = Bundle.main.resourcePath {
            print("🔍 [WhatisExplorerApp.init] Bundle resources path: \(bundlePath)")
            if let resources = try? FileManager.default.contentsOfDirectory(atPath: bundlePath) {
                print("🔍 [WhatisExplorerApp.init] Bundle resources (\(resources.count)):")
                for resource in resources.sorted() {
                    if resource.contains("Settings") || resource.contains("plist") || resource.contains("bundle") {
                        print("   • \(resource)")
                    }
                }
            }
        }
        
        // ✅ VERIFICA SETTINGS.BUNDLE
        if let settingsBundlePath = Bundle.main.path(forResource: "Settings", ofType: "bundle") {
            print("⚠️ [WhatisExplorerApp.init] TROVATO Settings.bundle: \(settingsBundlePath)")
        } else {
            print("✅ [WhatisExplorerApp.init] Settings.bundle NON trovato (OK)")
        }
        
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
    }
}

// MARK: - App State
class AppState: ObservableObject {
    @Published var currentZone: Zone?
    @Published var pois: [POI] = []
    @Published var isOfflineMode: Bool = false
    @Published var selectedPOI: POI?
    
    private let offlineStorage = OfflineStorageService.shared
    private let apiService = APIService.shared
    
    init() {
        // 🔍 TRACCIAMENTO: Inizializzazione AppState
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔍 [AppState.init] AppState inizializzato")
        let initialValue = UserDefaults.standard.string(forKey: "apiBaseURL")
        print("🔍 [AppState.init] UserDefaults['apiBaseURL'] all'init: \(initialValue ?? "nil")")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        checkOfflineMode()
    }
    
    func checkOfflineMode() {
        // Check if we have offline data available
        if let savedZone = offlineStorage.loadSavedZone() {
            self.currentZone = savedZone
            self.pois = offlineStorage.loadSavedPOIs(for: savedZone.id)
            self.isOfflineMode = true
        } else {
            self.isOfflineMode = false
        }
    }
    
    func loadZone(_ zoneId: String) async {
        do {
            let zone = try await apiService.fetchZone(zoneId: zoneId)
            let pois = try await apiService.fetchPOIs(zoneId: zoneId)
            
            await MainActor.run {
                self.currentZone = zone
                self.pois = pois
                self.isOfflineMode = false
            }
            
            // Save for offline use
            offlineStorage.saveZone(zone)
            offlineStorage.savePOIs(pois, for: zoneId)
        } catch {
            print("Error loading zone: \(error)")
            // Try to load from offline storage
            if let savedZone = offlineStorage.loadSavedZone(), savedZone.id == zoneId {
                await MainActor.run {
                    self.currentZone = savedZone
                    self.pois = offlineStorage.loadSavedPOIs(for: zoneId)
                    self.isOfflineMode = true
                }
            }
        }
    }
}

