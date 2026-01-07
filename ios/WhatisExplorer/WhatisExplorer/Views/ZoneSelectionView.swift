//
//  ZoneSelectionView.swift
//  Whatis Explorer
//
//  Zone Selection View for downloading zones
//

import SwiftUI
import Foundation

struct ZoneSelectionView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    @State private var zones: [Zone] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedZone: Zone?
    @State private var showingZonePreview = false
    
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
                } else if zones.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "map")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)
                        Text("Nessuna zona disponibile")
                            .font(.headline)
                        Text("Verifica la connessione e riprova")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                } else {
                    List(zones) { zone in
                        ZoneRow(zone: zone, isSelected: selectedZone?.id == zone.id)
                            .onTapGesture {
                                selectedZone = zone
                                showingZonePreview = true
                            }
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    }
                    .listStyle(.insetGrouped)
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
            }
            .onAppear {
                loadZones()
            }
            .sheet(isPresented: $showingZonePreview) {
                if let zone = selectedZone {
                    NavigationView {
                        ZonePreviewView(isPresented: $showingZonePreview, zone: zone)
                            .navigationBarTitleDisplayMode(.inline)
                            .toolbar {
                                ToolbarItem(placement: .navigationBarTrailing) {
                                    Button("Chiudi") {
                                        showingZonePreview = false
                                    }
                                }
                            }
                    }
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
                // Timeout più lungo per retry automatico
                let fetchedZones = try await withTimeout(seconds: 30) {
                    try await APIService.shared.fetchAllZones()
                }
                print("✅ [ZoneSelectionView] Zone ricevute: \(fetchedZones.count)")
                
                await MainActor.run {
                    if fetchedZones.isEmpty {
                        errorMessage = "Nessuna zona disponibile sul server. Verifica che il backend sia configurato correttamente."
                    }
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
                    let errorMsg: String
                    if let urlError = error as? URLError {
                        switch urlError.code {
                        case .timedOut:
                            errorMsg = "Timeout nella connessione. Verifica la rete e riprova."
                        case .notConnectedToInternet:
                            errorMsg = "Nessuna connessione Internet. Verifica la rete."
                        case .cannotFindHost, .cannotConnectToHost:
                            errorMsg = "Impossibile connettersi al server. Verifica che il backend sia avviato su \(APIService.shared.baseURL)"
                        default:
                            errorMsg = "Errore di connessione: \(error.localizedDescription)"
                        }
                    } else {
                        errorMsg = error.localizedDescription
                    }
                    errorMessage = errorMsg
                    isLoading = false
                    print("❌ [ZoneSelectionView] Messaggio errore mostrato all'utente: \(errorMsg)")
                }
            }
        }
    }
    
    // Helper per timeout
    private func withTimeout<T>(seconds: TimeInterval, operation: @escaping () async throws -> T) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                try await operation()
            }
            
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw URLError(.timedOut)
            }
            
            let result = try await group.next()!
            group.cancelAll()
            return result
        }
    }
    
}

// MARK: - Zone Row
struct ZoneRow: View {
    let zone: Zone
    let isSelected: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(zone.name)
                    .font(.headline)
                
                if let description = zone.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                HStack(spacing: 16) {
                    if let poiCount = zone.poiCount {
                        Label("\(poiCount) POI", systemImage: "mappin.circle.fill")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    if let price = zone.priceFormatted {
                        Text(price)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.blue)
                    }
                }
                .padding(.top, 2)
            }
            
            Spacer()
            
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.blue)
                    .font(.title2)
            } else {
                Image(systemName: "chevron.right")
                    .foregroundColor(.secondary)
                    .font(.caption)
            }
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
}


