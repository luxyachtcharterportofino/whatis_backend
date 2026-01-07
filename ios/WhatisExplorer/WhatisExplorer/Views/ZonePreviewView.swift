//
//  ZonePreviewView.swift
//  Whatis Explorer
//
//  Zone Preview View - Shows zone on map and purchase confirmation
//

import SwiftUI
import MapKit

struct ZonePreviewView: View {
    @EnvironmentObject var appState: AppState
    @Binding var isPresented: Bool
    let zone: Zone
    @State private var isDownloading = false
    @State private var downloadProgress: Double = 0
    @State private var downloadStatus: String = NSLocalizedString("zone_preview.preparing", comment: "")
    
    // Map region centered on zone
    private var mapRegion: MKCoordinateRegion {
        let rect = zone.boundingBox
        let center = rect.origin.coordinate
        let span = MKCoordinateSpan(
            latitudeDelta: max(rect.height / 111000 * 1.5, 0.01), // Aggiungi margine
            longitudeDelta: max(rect.width / 111000 * 1.5, 0.01)
        )
        return MKCoordinateRegion(center: center, span: span)
    }
    
    var body: some View {
        ZStack(alignment: .topTrailing) {
            // Background blu marino molto scuro
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.02, green: 0.08, blue: 0.18),  // Blu marino molto scuro
                    Color(red: 0.04, green: 0.12, blue: 0.25),  // Blu marino scuro
                    Color(red: 0.06, green: 0.15, blue: 0.30)   // Blu marino
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 24) {
                    // Header con nome zona
                    VStack(spacing: 8) {
                        Text(zone.name)
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0)) // Oro
                            .multilineTextAlignment(.center)
                        
                        if let description = zone.description, !description.isEmpty {
                            Text(description)
                                .font(.system(size: 16, weight: .regular))
                                .foregroundColor(.white.opacity(0.9))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }
                    }
                    .padding(.top, 20)
                    
                    // Mappa con zona evidenziata
                    VStack(alignment: .leading, spacing: 12) {
                        Text(NSLocalizedString("zone_preview.preview_title", comment: ""))
                            .font(.headline)
                            .foregroundColor(.white)
                            .padding(.horizontal)
                        
                        MapKitZonePreviewMap(
                            region: mapRegion,
                            zone: zone
                        )
                        .frame(height: 300)
                        .cornerRadius(16)
                        .padding(.horizontal)
                    }
                    
                    // Informazioni zona
                    VStack(spacing: 16) {
                        // POI Count
                        HStack {
                            Image(systemName: "mappin.circle.fill")
                                .font(.title2)
                                .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0))
                            VStack(alignment: .leading, spacing: 4) {
                                Text(NSLocalizedString("zone_preview.points_of_interest", comment: ""))
                                    .font(.subheadline)
                                    .foregroundColor(.white.opacity(0.8))
                                Text(String(format: NSLocalizedString("zone_preview.poi_available", comment: ""), zone.poiCount ?? 0))
                                    .font(.title3)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white)
                            }
                            Spacer()
                        }
                        .padding()
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                        
                        // Prezzo
                        HStack {
                            Image(systemName: "eurosign.circle.fill")
                                .font(.title2)
                                .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0))
                            VStack(alignment: .leading, spacing: 4) {
                                Text(NSLocalizedString("zone_preview.price", comment: ""))
                                    .font(.subheadline)
                                    .foregroundColor(.white.opacity(0.8))
                                Text(zone.priceFormatted ?? "€9,99")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0))
                            }
                            Spacer()
                        }
                        .padding()
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(12)
                    }
                    .padding(.horizontal)
                    
                    // Note
                    VStack(alignment: .leading, spacing: 8) {
                        Text(NSLocalizedString("zone_preview.test_note_title", comment: ""))
                            .font(.headline)
                            .foregroundColor(.orange)
                        Text(NSLocalizedString("zone_preview.test_note_desc", comment: ""))
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.8))
                    }
                    .padding()
                    .background(Color.orange.opacity(0.2))
                    .cornerRadius(12)
                    .padding(.horizontal)
                    
                    // Bottone Acquista
                    Button(action: {
                        confirmPurchase()
                    }) {
                        HStack {
                            Image(systemName: "cart.badge.plus")
                            Text(NSLocalizedString("zone_preview.purchase_download", comment: ""))
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color(red: 1.0, green: 0.84, blue: 0.0),  // Oro
                                    Color(red: 0.85, green: 0.65, blue: 0.13)  // Oro scuro
                                ]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .foregroundColor(Color(red: 0.02, green: 0.08, blue: 0.18)) // Testo blu scuro
                        .cornerRadius(12)
                        .shadow(color: Color(red: 1.0, green: 0.84, blue: 0.0).opacity(0.4), radius: 10, x: 0, y: 5)
                    }
                    .disabled(isDownloading)
                    .padding(.horizontal)
                    .padding(.bottom, 20)
                    
                    // Bottone Annulla
                    Button(action: {
                        isPresented = false
                    }) {
                        Text(NSLocalizedString("zone_preview.cancel", comment: ""))
                            .fontWeight(.medium)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.white.opacity(0.15))
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.white.opacity(0.3), lineWidth: 1)
                            )
                    }
                    .disabled(isDownloading)
                    .padding(.horizontal)
                    .padding(.bottom, 40)
                }
                .padding(.top, 50) // Spazio per il bottone di chiusura
            }
            
            // Bottone di chiusura grande e visibile in alto a destra
            Button(action: {
                isPresented = false
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
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if isDownloading {
                VStack(spacing: 16) {
                    ProgressView(value: downloadProgress, total: 1.0)
                        .progressViewStyle(.linear)
                        .frame(width: 250)
                        .tint(Color(red: 1.0, green: 0.84, blue: 0.0))
                    Text(downloadStatus)
                        .font(.headline)
                        .foregroundColor(.white)
                    Text("\(Int(downloadProgress * 100))%")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.8))
                }
                .padding(24)
                .background(Color(red: 0.05, green: 0.12, blue: 0.25))
                .cornerRadius(16)
                .shadow(radius: 10)
            }
        }
    }
    
    private func confirmPurchase() {
        // Simula acquisto (per ora solo test)
        print("🛒 [ZonePreviewView] Acquisto simulato per zona: \(zone.name)")
        print("💰 [ZonePreviewView] Prezzo: \(zone.priceFormatted ?? "€9,99")")
        
        // Scarica la zona
        downloadZone()
    }
    
    private func downloadZone() {
        isDownloading = true
        downloadProgress = 0
        
        Task {
            do {
                // Step 1: Download zone info
                await MainActor.run {
                    downloadStatus = NSLocalizedString("zone_preview.downloading_zone", comment: "")
                    downloadProgress = 0.1
                }
                
                let downloadedZone = try await APIService.shared.fetchZone(zoneId: zone.id)
                
                // Step 2: Download POIs
                await MainActor.run {
                    downloadStatus = NSLocalizedString("zone_preview.downloading_pois", comment: "")
                    downloadProgress = 0.2
                }
                
                let pois = try await APIService.shared.fetchPOIs(zoneId: zone.id)
                
                // Step 3: Download immagini POI
                await MainActor.run {
                    downloadStatus = NSLocalizedString("zone_preview.downloading_images", comment: "")
                    downloadProgress = 0.3
                }
                
                let baseURL = APIService.shared.baseURL
                _ = await ImageCacheService.shared.downloadImages(for: pois, baseURL: baseURL) { imageProgress in
                    Task { @MainActor in
                        downloadProgress = 0.3 + (imageProgress * 0.5)
                        let poisWithImages = pois.filter { $0.imageUrl != nil && !$0.imageUrl!.isEmpty }
                        let currentImage = Int(imageProgress * Double(poisWithImages.count))
                        downloadStatus = String(format: NSLocalizedString("zone_preview.images_progress", comment: ""), currentImage, poisWithImages.count)
                    }
                }
                
                // Step 4: Save offline
                await MainActor.run {
                    downloadStatus = NSLocalizedString("zone_preview.saving", comment: "")
                    downloadProgress = 0.85
                }
                
                // Step 4: Save offline (permanente sul telefono)
                await MainActor.run {
                    downloadStatus = NSLocalizedString("zone_preview.saving_permanent", comment: "")
                    downloadProgress = 0.85
                }
                
                // ✅ SALVATAGGIO PERMANENTE: La zona rimarrà memorizzata sul telefono
                OfflineStorageService.shared.saveZone(downloadedZone)
                OfflineStorageService.shared.savePOIs(pois, for: zone.id)
                
                print("✅ [ZonePreviewView] Zona salvata permanentemente: \(downloadedZone.name)")
                print("✅ [ZonePreviewView] POI salvati: \(pois.count)")
                print("✅ [ZonePreviewView] La zona è ora disponibile in 'Usa Zona Scaricata'")
                
                // Update app state
                await MainActor.run {
                    appState.currentZone = downloadedZone
                    appState.pois = pois
                    appState.isOfflineMode = true // ✅ Modalità offline perché i dati sono salvati localmente
                    downloadProgress = 1.0
                    downloadStatus = NSLocalizedString("zone_preview.completed", comment: "")
                    
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        isDownloading = false
                        isPresented = false // Chiude la preview e torna alla vista principale
                    }
                }
            } catch {
                await MainActor.run {
                    downloadStatus = String(format: NSLocalizedString("zone_preview.error", comment: ""), error.localizedDescription)
                    isDownloading = false
                }
            }
        }
    }
}

// MARK: - Map Preview
struct MapKitZonePreviewMap: UIViewRepresentable {
    let region: MKCoordinateRegion
    let zone: Zone
    
    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator
        mapView.isUserInteractionEnabled = false // Disabilita interazione per preview
        return mapView
    }
    
    func updateUIView(_ mapView: MKMapView, context: Context) {
        mapView.setRegion(region, animated: false)
        
        // Rimuovi overlay esistenti
        mapView.removeOverlays(mapView.overlays)
        
        // Aggiungi poligono della zona
        let polygon = zone.polygon
        let overlay = ZonePolygonOverlay(polygon: polygon)
        mapView.addOverlay(overlay)
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject, MKMapViewDelegate {
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let zoneOverlay = overlay as? ZonePolygonOverlay {
                let renderer = MKPolygonRenderer(polygon: zoneOverlay.polygon)
                renderer.fillColor = UIColor(red: 1.0, green: 0.84, blue: 0.0, alpha: 0.3) // Oro trasparente
                renderer.strokeColor = UIColor(red: 1.0, green: 0.84, blue: 0.0, alpha: 0.9) // Oro opaco
                renderer.lineWidth = 3.0
                renderer.lineDashPattern = [5, 5]
                return renderer
            }
            return MKOverlayRenderer(overlay: overlay)
        }
    }
}

