//
//  ZoneSelectionView.swift
//  Whatis Explorer – Lite
//
//  Zone Selection View for downloading zones
//

import SwiftUI

struct ZoneSelectionView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    @State private var zones: [Zone] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedZone: Zone?
    @State private var isDownloading = false
    @State private var downloadProgress: Double = 0
    
    var body: some View {
        NavigationView {
            ZStack {
                if isLoading {
                    ProgressView("Caricamento zone...")
                } else if let error = errorMessage {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 48))
                            .foregroundColor(.orange)
                        Text("Errore")
                            .font(.headline)
                        Text(error)
                            .font(.body)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding()
                        
                        Button("Riprova") {
                            loadZones()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding()
                } else {
                    List(zones) { zone in
                        ZoneRow(zone: zone, isSelected: selectedZone?.id == zone.id)
                            .onTapGesture {
                                selectedZone = zone
                            }
                    }
                }
            }
            .navigationTitle("Seleziona Zona")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Annulla") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Scarica") {
                        downloadZone()
                    }
                    .disabled(selectedZone == nil || isDownloading)
                }
            }
            .onAppear {
                loadZones()
            }
            .overlay {
                if isDownloading {
                    VStack(spacing: 16) {
                        ProgressView(value: downloadProgress, total: 1.0)
                            .progressViewStyle(.linear)
                        Text("Download in corso...")
                            .font(.headline)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(radius: 8)
                }
            }
        }
    }
    
    private func loadZones() {
        print("🔄 [ZoneSelectionView] Caricamento zone...")
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                print("📡 [ZoneSelectionView] Chiamata fetchAllZones...")
                let fetchedZones = try await APIService.shared.fetchAllZones()
                print("✅ [ZoneSelectionView] Zone ricevute: \(fetchedZones.count)")
                
                await MainActor.run {
                    zones = fetchedZones
                    isLoading = false
                    print("✅ [ZoneSelectionView] Zone aggiornate nell'UI: \(zones.count)")
                }
            } catch {
                print("❌ [ZoneSelectionView] Errore caricamento zone: \(error)")
                print("❌ [ZoneSelectionView] Errore tipo: \(type(of: error))")
                if let apiError = error as? APIError {
                    print("❌ [ZoneSelectionView] APIError: \(apiError.localizedDescription)")
                }
                
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                    print("❌ [ZoneSelectionView] Messaggio errore mostrato all'utente: \(error.localizedDescription)")
                }
            }
        }
    }
    
    private func downloadZone() {
        guard let zone = selectedZone else {
            print("❌ [ZoneSelectionView] Nessuna zona selezionata")
            return
        }
        
        // ✅ LOGGING DETTAGLIATO: Verifica zone.id PRIMA di usarlo
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔄 [ZoneSelectionView] downloadZone() chiamato")
        print("📋 [ZoneSelectionView] Zone selezionata:")
        print("   • Nome: \(zone.name)")
        print("   • ID: \(zone.id)")
        print("   • ID length: \(zone.id.count)")
        print("   • ID type: \(type(of: zone.id))")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        // ✅ Validazione ObjectId MongoDB (24 caratteri hex)
        let hexChars = CharacterSet(charactersIn: "0123456789abcdefABCDEF")
        guard zone.id.count == 24, zone.id.unicodeScalars.allSatisfy({ hexChars.contains($0) }) else {
            let errorMsg = "ID zona non valido: '\(zone.id)' (lunghezza: \(zone.id.count)). L'ID deve essere un ObjectId MongoDB valido (24 caratteri esadecimali)."
            print("❌ [ZoneSelectionView] VALIDAZIONE FALLITA")
            print("❌ [ZoneSelectionView] \(errorMsg)")
            errorMessage = errorMsg
            return
        }
        
        print("✅ [ZoneSelectionView] ZoneId VALIDATO: \(zone.id)")
        print("🔍 [ZoneSelectionView] Procedo con download usando zone.id: \(zone.id)")
        
        isDownloading = true
        downloadProgress = 0
        
        Task {
            do {
                // Download zone
                print("📥 [ZoneSelectionView] Step 1/3: Download zone con zoneId: \(zone.id)")
                downloadProgress = 0.3
                let downloadedZone = try await APIService.shared.fetchZone(zoneId: zone.id)
                print("✅ [ZoneSelectionView] Zone scaricata: \(downloadedZone.name) (ID: \(downloadedZone.id))")
                
                // Download POIs - ✅ USA ESATTAMENTE zone.id
                print("📥 [ZoneSelectionView] Step 2/3: Download POI con zoneId: \(zone.id)")
                print("📥 [ZoneSelectionView] Chiamata: APIService.shared.fetchPOIs(zoneId: zone.id)")
                print("📥 [ZoneSelectionView] zone.id = '\(zone.id)'")
                downloadProgress = 0.6
                let pois = try await APIService.shared.fetchPOIs(zoneId: zone.id)
                print("✅ [ZoneSelectionView] POI scaricati: \(pois.count)")
                
                // Save offline
                print("💾 [ZoneSelectionView] Step 3/3: Salvataggio offline...")
                downloadProgress = 0.8
                OfflineStorageService.shared.saveZone(downloadedZone)
                OfflineStorageService.shared.savePOIs(pois, for: zone.id)
                print("✅ [ZoneSelectionView] Dati salvati offline")
                
                // Update app state
                await MainActor.run {
                    appState.currentZone = downloadedZone
                    appState.pois = pois
                    appState.isOfflineMode = false
                    downloadProgress = 1.0
                    print("✅ [ZoneSelectionView] App state aggiornato")
                    
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        isDownloading = false
                        print("✅ [ZoneSelectionView] Download completato, chiusura view")
                        dismiss()
                    }
                }
            } catch {
                print("❌ [ZoneSelectionView] Errore download: \(error)")
                print("❌ [ZoneSelectionView] Errore tipo: \(type(of: error))")
                if let apiError = error as? APIError {
                    print("❌ [ZoneSelectionView] APIError: \(apiError.localizedDescription)")
                }
                
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isDownloading = false
                    print("❌ [ZoneSelectionView] Messaggio errore mostrato: \(error.localizedDescription)")
                }
            }
        }
    }
}

// MARK: - Zone Row
struct ZoneRow: View {
    let zone: Zone
    let isSelected: Bool
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(zone.name)
                    .font(.headline)
                
                if let description = zone.description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            }
            
            Spacer()
            
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.blue)
                    .font(.title2)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}

