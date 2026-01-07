//
//  POIDetailView.swift
//  Whatis Explorer
//
//  POI Detail View with full information
//

import SwiftUI
import MapKit

struct POIDetailView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var locationManager = LocationManager.shared
    @Environment(\.dismiss) var dismiss
    
    let poi: POI
    @Binding var navigationTarget: POI?
    
    var body: some View {
        ZStack(alignment: .topTrailing) {
            // Sfondo esplicito per evitare finestra nera
            Color(.systemBackground)
                .ignoresSafeArea()
            
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Image - ✅ Usa cache offline
                    if poi.imageUrl != nil, !poi.imageUrl!.isEmpty {
                        CachedImageView(poi: poi, contentMode: .fill)
                            .frame(height: 200)
                            .clipped()
                            .cornerRadius(12)
                    }
                    
                    // Title and Category
                    VStack(alignment: .leading, spacing: 8) {
                        Text(poi.name)
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        
                        HStack {
                            Label(poi.categoryDisplayName, systemImage: poi.iconName)
                                .font(.subheadline)
                                .foregroundColor(.blue)
                            
                            Spacer()
                            
                            if let location = locationManager.currentLocation {
                                Label(poi.formattedDistance(from: location), systemImage: "location.fill")
                                    .font(.subheadline)
                                    .foregroundColor(.green)
                            }
                        }
                    }
                    
                    Divider()
                    
                    // Description
                    if !poi.description.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Descrizione")
                                .font(.headline)
                            Text(poi.description)
                                .font(.body)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    // Coordinates
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Coordinate")
                            .font(.headline)
                        
                        HStack {
                            VStack(alignment: .leading) {
                                Text("Latitudine")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(String(format: "%.6f", poi.lat))
                                    .font(.body)
                            }
                            
                            Spacer()
                            
                            VStack(alignment: .leading) {
                                Text("Longitudine")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(String(format: "%.6f", poi.lng))
                                    .font(.body)
                            }
                        }
                        
                        // Coordinate status
                        if let status = poi.coordStatus {
                            HStack {
                                Image(systemName: status == "confirmed" ? "checkmark.circle.fill" : 
                                      status == "missing" ? "xmark.circle.fill" : "questionmark.circle.fill")
                                    .foregroundColor(status == "confirmed" ? .green : 
                                                   status == "missing" ? .red : .orange)
                                Text(poi.coordinateStatusBadge)
                                    .font(.caption)
                            }
                            .padding(.top, 4)
                        }
                    }
                    
                    Divider()
                    
                    // Mini Map - Opzionale per evitare problemi in sheet
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Posizione")
                            .font(.headline)
                        
                        // ✅ Usa una versione semplificata della mappa per evitare problemi
                        if let currentZone = appState.currentZone {
                            MapKitMapView(
                                region: .constant(MKCoordinateRegion(
                                    center: poi.coordinate,
                                    span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                                )),
                                pois: [poi],
                                selectedPOI: .constant(nil),
                                currentZone: currentZone,
                                showsUserLocation: false,
                                pendingZoomRegion: .constant(nil)
                            )
                            .frame(height: 200)
                            .cornerRadius(12)
                        } else {
                            // Fallback: mostra solo coordinate se la zona non è disponibile
                            VStack {
                                Text("Lat: \(String(format: "%.6f", poi.lat))")
                                Text("Lng: \(String(format: "%.6f", poi.lng))")
                            }
                            .frame(height: 200)
                            .frame(maxWidth: .infinity)
                            .background(Color(.systemGray6))
                            .cornerRadius(12)
                        }
                    }
                    
                    // Action Buttons
                    VStack(spacing: 12) {
                        Button(action: {
                            navigationTarget = poi
                            dismiss()
                        }) {
                            HStack {
                                Image(systemName: "location.fill")
                                Text("Naviga verso questo POI")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.green)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        
                        Button(action: {
                            openInMaps()
                        }) {
                            HStack {
                                Image(systemName: "map")
                                Text("Apri in Mappe")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                    }
                    .padding(.top, 8)
                }
                .padding()
                .padding(.top, 50) // Spazio per il bottone di chiusura
            }
            
            // Bottone di chiusura grande e visibile in alto a destra
            Button {
                print("📍 [POIDetailView] Chiusura POI: \(poi.name)")
                dismiss()
            } label: {
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
        .background(Color(.systemBackground))
        .navigationTitle("Dettagli POI")
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func openInMaps() {
        let mapItem = MKMapItem(placemark: MKPlacemark(coordinate: poi.coordinate))
        mapItem.name = poi.name
        mapItem.openInMaps()
    }
}

