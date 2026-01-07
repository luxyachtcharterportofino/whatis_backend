//
//  ZoneSelectionForTourGuidesView.swift
//  Whatis Explorer
//
//  Zone Selection View for Tour Guides
//

import SwiftUI
import Foundation

struct ZoneSelectionForTourGuidesView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var appState: AppState
    @State private var zones: [Zone] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedZoneId: String?
    @State private var showingTourGuides = false
    
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
                        Button(action: {
                            selectedZoneId = zone.id
                            showingTourGuides = true
                        }) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(zone.name)
                                        .font(.headline)
                                        .foregroundColor(.primary)
                                    if let description = zone.description, !description.isEmpty {
                                        Text(description)
                                            .font(.subheadline)
                                            .foregroundColor(.secondary)
                                            .lineLimit(2)
                                    }
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 4)
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
            .sheet(isPresented: $showingTourGuides) {
                if let zoneId = selectedZoneId, let zone = zones.first(where: { $0.id == zoneId }) {
                    NavigationView {
                        TourGuidesView(zoneId: zoneId, zoneName: zone.name)
                            .environmentObject(appState)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .onAppear {
                                print("🔧 [ZoneSelectionForTourGuidesView] TourGuidesView presentata per zona: \(zone.name)")
                            }
                    }
                } else {
                    Text("Errore: zona non trovata")
                        .padding()
                        .onAppear {
                            print("❌ [ZoneSelectionForTourGuidesView] Zona non trovata per selectedZoneId: \(selectedZoneId ?? "nil")")
                        }
                }
            }
            .onChange(of: showingTourGuides) { isPresented in
                if isPresented, let zoneId = selectedZoneId, let zone = zones.first(where: { $0.id == zoneId }) {
                    print("🔧 [ZoneSelectionForTourGuidesView] Sheet aperta per zona: \(zone.name)")
                }
            }
        }
    }
    
    private func loadZones() {
        print("🔄 [ZoneSelectionForTourGuidesView] Caricamento zone...")
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                print("📡 [ZoneSelectionForTourGuidesView] Chiamata fetchAllZones...")
                
                let fetchedZones = try await withTimeout(seconds: 30) {
                    try await APIService.shared.fetchAllZones()
                }
                
                print("✅ [ZoneSelectionForTourGuidesView] Zone ricevute: \(fetchedZones.count)")
                
                await MainActor.run {
                    if fetchedZones.isEmpty {
                        errorMessage = "Nessuna zona disponibile"
                    } else {
                        zones = fetchedZones
                    }
                    isLoading = false
                }
            } catch {
                print("❌ [ZoneSelectionForTourGuidesView] Errore: \(error)")
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
                        errorMsg = "Errore nel caricamento delle zone: \(error.localizedDescription)"
                    }
                    errorMessage = errorMsg
                    isLoading = false
                    print("❌ [ZoneSelectionForTourGuidesView] Messaggio errore mostrato all'utente: \(errorMsg)")
                }
            }
        }
    }
    
    // Helper function per timeout
    private func withTimeout<T>(seconds: TimeInterval, operation: @escaping () async throws -> T) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                try await operation()
            }
            
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw URLError(.timedOut)
            }
            
            guard let result = try await group.next() else {
                throw URLError(.timedOut)
            }
            
            group.cancelAll()
            return result
        }
    }
}

#Preview {
    ZoneSelectionForTourGuidesView()
}

