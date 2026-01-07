//
//  ExplorationStartView.swift
//  Whatis Explorer
//
//  View for choosing exploration start option
//

import SwiftUI
import MapKit

struct ExplorationStartView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    @StateObject private var locationManager = LocationManager.shared
    @State private var showingZoneSelection = false
    @State private var showingDownloadedZones = false
    @State private var isDetectingCurrentZone = false
    @State private var currentZoneDetected: Zone?
    @State private var errorMessage: String?
    
    var body: some View {
        ZStack(alignment: .topTrailing) {
            // Background blu marino molto scuro
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.03, green: 0.10, blue: 0.20),  // Blu marino molto scuro
                    Color(red: 0.05, green: 0.12, blue: 0.25),  // Blu marino scuro
                    Color(red: 0.07, green: 0.15, blue: 0.30)   // Blu marino
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 24) {
                    Spacer()
                        .frame(height: 40)
                    
                    // Title
                    Text(NSLocalizedString("exploration.start_title", comment: ""))
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0))
                        .shadow(color: Color.black.opacity(0.5), radius: 2, x: 0, y: 2)
                        .padding(.bottom, 30)
                    
                    // Option 1: Visualizza zone disponibili
                    ExplorationOptionCard(
                        icon: "map.fill",
                        title: NSLocalizedString("exploration.browse_zones_title", comment: ""),
                        description: NSLocalizedString("exploration.browse_zones_desc", comment: ""),
                        action: {
                            showingZoneSelection = true
                        }
                    )
                    
                    // Option 2: Scarica zona corrente (se disponibile location)
                    if locationManager.currentLocation != nil {
                        ExplorationOptionCard(
                            icon: "location.fill",
                            title: NSLocalizedString("exploration.download_current_title", comment: ""),
                            description: NSLocalizedString("exploration.download_current_desc", comment: ""),
                            isLoading: isDetectingCurrentZone,
                            action: {
                                detectCurrentZone()
                            }
                        )
                    } else {
                        ExplorationOptionCard(
                            icon: "location.slash",
                            title: NSLocalizedString("exploration.current_zone_title", comment: ""),
                            description: NSLocalizedString("exploration.current_zone_desc", comment: ""),
                            isDisabled: true,
                            action: {
                                locationManager.requestAuthorization()
                                locationManager.startUpdatingLocation()
                            }
                        )
                    }
                    
                    // Option 3: Usa zona già scaricata (se disponibile)
                    if hasDownloadedZones() {
                        ExplorationOptionCard(
                            icon: "tray.and.arrow.down.fill",
                            title: NSLocalizedString("exploration.use_downloaded_title", comment: ""),
                            description: NSLocalizedString("exploration.use_downloaded_desc", comment: ""),
                            action: {
                                showingDownloadedZones = true
                            }
                        )
                    }
                    
                    // Error message
                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .padding()
                            .background(Color.red.opacity(0.1))
                            .cornerRadius(8)
                            .padding(.horizontal)
                    }
                    
                    Spacer()
                        .frame(height: 40)
                }
                .padding(.horizontal, 24)
                .padding(.top, 50) // Spazio per il bottone di chiusura
            }
            
            // Bottone di chiusura grande e visibile in alto a destra
            Button(action: {
                dismiss()
            }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundColor(.white)
                    .background(
                        Circle()
                            .fill(Color.black.opacity(0.6))
                            .frame(width: 44, height: 44)
                    )
            }
            .padding(16)
        }
        .sheet(isPresented: $showingZoneSelection) {
            ZoneSelectionView()
        }
            .sheet(isPresented: $showingDownloadedZones) {
                DownloadedZonesView()
                    .onDisappear {
                        // Quando DownloadedZonesView si chiude, verifica se una zona è stata caricata
                        // Se sì, chiudi anche ExplorationStartView per tornare alla vista principale
                        if appState.currentZone != nil {
                            dismiss()
                        }
                    }
            }
        .alert(NSLocalizedString("exploration.zone_detected", comment: ""), isPresented: Binding(
            get: { currentZoneDetected != nil },
            set: { if !$0 { currentZoneDetected = nil } }
        )) {
            Button(NSLocalizedString("exploration.cancel", comment: ""), role: .cancel) {
                currentZoneDetected = nil
            }
            Button(NSLocalizedString("exploration.download", comment: "")) {
                if let zone = currentZoneDetected {
                    downloadZone(zone)
                }
            }
        } message: {
            if let zone = currentZoneDetected {
                Text(String(format: NSLocalizedString("exploration.zone_detected_message", comment: ""), zone.name))
            } else {
                Text(NSLocalizedString("exploration.zone_detected", comment: ""))
            }
        }
            .onAppear {
                locationManager.startUpdatingLocation()
            }
            .onChange(of: appState.currentZone) { newZone in
                // Aggiorna la lista zone scaricate quando una nuova zona viene caricata
                // Questo assicura che "Usa Zona Scaricata" appaia se necessario
                
                // Se una zona viene selezionata, chiudi ExplorationStartView
                if newZone != nil {
                    dismiss()
                }
            }
    }
    
    private func hasDownloadedZones() -> Bool {
        return OfflineStorageService.shared.getAllDownloadedZones().count > 0
    }
    
    private func detectCurrentZone() {
        guard let location = locationManager.currentLocation else {
            errorMessage = NSLocalizedString("exploration.location_unavailable", comment: "")
            return
        }
        
        isDetectingCurrentZone = true
        errorMessage = nil
        
        Task {
            do {
                // Fetch all zones
                let zones = try await APIService.shared.fetchAllZones()
                
                // Find zone containing current location
                let coordinate = location.coordinate
                let point = MKMapPoint(coordinate)
                
                for zone in zones {
                    // Check if point is inside zone bounding box first (fast check)
                    if zone.boundingBox.contains(point) {
                        // Detailed check: point-in-polygon algorithm
                        if isPointInPolygon(coordinate: coordinate, polygonCoordinates: zone.coordinates) {
                            await MainActor.run {
                                currentZoneDetected = zone
                                isDetectingCurrentZone = false
                            }
                            return
                        }
                    }
                }
                
                await MainActor.run {
                    errorMessage = "Nessuna zona trovata nella tua posizione corrente"
                    isDetectingCurrentZone = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Errore nel rilevamento zona: \(error.localizedDescription)"
                    isDetectingCurrentZone = false
                }
            }
        }
    }
    
    private func downloadZone(_ zone: Zone) {
        // Download the zone directly
        currentZoneDetected = nil
        
        Task {
            do {
                let downloadedZone = try await APIService.shared.fetchZone(zoneId: zone.id)
                let pois = try await APIService.shared.fetchPOIs(zoneId: zone.id)
                
                // Save offline
                OfflineStorageService.shared.saveZone(downloadedZone)
                OfflineStorageService.shared.savePOIs(pois, for: zone.id)
                
                // Update app state
                await MainActor.run {
                    appState.currentZone = downloadedZone
                    appState.pois = pois
                    appState.isOfflineMode = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Errore nel download: \(error.localizedDescription)"
                }
            }
        }
    }
    
    // Point-in-polygon algorithm (ray casting)
    private func isPointInPolygon(coordinate: CLLocationCoordinate2D, polygonCoordinates: [[Double]]) -> Bool {
        let x = coordinate.longitude
        let y = coordinate.latitude
        
        var inside = false
        var j = polygonCoordinates.count - 1
        
        for i in 0..<polygonCoordinates.count {
            let xi = polygonCoordinates[i][1]
            let yi = polygonCoordinates[i][0]
            let xj = polygonCoordinates[j][1]
            let yj = polygonCoordinates[j][0]
            
            let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
            if intersect {
                inside = !inside
            }
            j = i
        }
        
        return inside
    }
}

struct ExplorationOptionCard: View {
    let icon: String
    let title: String
    let description: String
    var isLoading: Bool = false
    var isDisabled: Bool = false
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.system(size: 32))
                    .foregroundColor(isDisabled ? .gray : Color(red: 1.0, green: 0.84, blue: 0.0))
                    .frame(width: 50, height: 50)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.8))
                }
                
                Spacer()
                
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Image(systemName: "chevron.right")
                        .foregroundColor(.white.opacity(0.6))
                }
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color(red: 1.0, green: 0.84, blue: 0.0).opacity(isDisabled ? 0.3 : 0.6),
                                        Color(red: 0.85, green: 0.65, blue: 0.13).opacity(isDisabled ? 0.2 : 0.4)
                                    ]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 2
                            )
                    )
            )
            .opacity(isDisabled ? 0.6 : 1.0)
        }
        .disabled(isLoading || isDisabled)
    }
}

// Downloaded Zones View
struct DownloadedZonesView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    @State private var downloadedZones: [Zone] = []
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background blu marino molto scuro
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color(red: 0.03, green: 0.10, blue: 0.20),
                        Color(red: 0.05, green: 0.12, blue: 0.25)
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                if downloadedZones.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "tray")
                            .font(.system(size: 48))
                            .foregroundColor(.white.opacity(0.6))
                        Text(NSLocalizedString("exploration.no_downloaded_zones", comment: ""))
                            .foregroundColor(.white.opacity(0.8))
                    }
                } else {
                    List {
                        ForEach(downloadedZones) { zone in
                            Button(action: {
                                loadZone(zone)
                            }) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(zone.name)
                                            .font(.headline)
                                            .foregroundColor(.white)
                                        
                                        if let description = zone.description {
                                            Text(description)
                                                .font(.caption)
                                                .foregroundColor(.white.opacity(0.7))
                                                .lineLimit(2)
                                        }
                                    }
                                    
                                    Spacer()
                                    
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0))
                                }
                                .padding(.vertical, 8)
                            }
                            .listRowBackground(Color.white.opacity(0.1))
                        }
                    }
                    .listStyle(PlainListStyle())
                    .background(Color.clear)
                    .onAppear {
                        // Hide list background for compatibility
                        UITableView.appearance().backgroundColor = .clear
                    }
                }
            }
            .navigationTitle(NSLocalizedString("exploration.downloaded_zones_title", comment: ""))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Chiudi") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                refreshDownloadedZones()
            }
            .onChange(of: appState.currentZone) { _ in
                // Aggiorna la lista quando una nuova zona viene scaricata
                refreshDownloadedZones()
            }
        }
    }
    
    private func refreshDownloadedZones() {
        downloadedZones = OfflineStorageService.shared.getAllDownloadedZones()
        print("📦 [DownloadedZonesView] Zone scaricate aggiornate: \(downloadedZones.count)")
    }
    
    private func loadZone(_ zone: Zone) {
        // Load zone from offline storage
        print("📦 [DownloadedZonesView] Caricamento zona scaricata: \(zone.name)")
        
        // Carica i POI (può essere un array vuoto se la zona non ha POI)
        let pois = OfflineStorageService.shared.loadSavedPOIs(for: zone.id)
        
        print("✅ [DownloadedZonesView] Zona caricata: \(zone.name) con \(pois.count) POI")
        appState.currentZone = zone
        appState.pois = pois // Array vuoto se non ci sono POI
        appState.isOfflineMode = true // ✅ Modalità offline perché usa dati salvati localmente
        dismiss() // Chiude DownloadedZonesView
    }
}

#Preview {
    ExplorationStartView()
        .environmentObject(AppState())
}

