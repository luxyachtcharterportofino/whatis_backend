//
//  POIDetailView.swift
//  Whatis Explorer – Lite
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
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Image
                    if let imageUrl = poi.imageUrl, !imageUrl.isEmpty {
                        AsyncImage(url: URL(string: imageUrl)) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        } placeholder: {
                            Rectangle()
                                .fill(Color.gray.opacity(0.3))
                                .overlay(
                                    ProgressView()
                                )
                        }
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
                    
                    // Mini Map
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Posizione")
                            .font(.headline)
                        
                        MapKitMapView(
                            region: .constant(MKCoordinateRegion(
                                center: poi.coordinate,
                                span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                            )),
                            pois: [poi],
                            selectedPOI: .constant(nil),
                            showsUserLocation: false
                        )
                        .frame(height: 200)
                        .cornerRadius(12)
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
            }
            .navigationTitle("Dettagli POI")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Chiudi") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func openInMaps() {
        let mapItem = MKMapItem(placemark: MKPlacemark(coordinate: poi.coordinate))
        mapItem.name = poi.name
        mapItem.openInMaps()
    }
}

