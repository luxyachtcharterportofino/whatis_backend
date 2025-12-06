//
//  ContentView.swift
//  Whatis Explorer
//
//  Main Content View with Tab Navigation
//  Si adatta automaticamente al dispositivo: mostra AR solo se supportato
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var locationManager = LocationManager.shared
    @State private var selectedTab = 0
    @State private var showingZoneSelection = false
    
    // Rileva se ARKit è supportato
    private var supportsARKit: Bool {
        DeviceCapabilities.supportsARKit
    }
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Map Tab - Sempre disponibile
            MapView()
                .tabItem {
                    Label("Mappa", systemImage: "map")
                }
                .tag(0)
            
            // AR Tab - Solo se ARKit è supportato
            if supportsARKit {
                ARView()
                    .tabItem {
                        Label("AR", systemImage: "arkit")
                    }
                    .tag(1)
            }
            
            // List Tab - Sempre disponibile
            POIListView()
                .tabItem {
                    Label("Lista", systemImage: "list.bullet")
                }
                .tag(supportsARKit ? 2 : 1) // Tag dinamico in base alla presenza di AR
            
            // Settings Tab - Sempre disponibile
            SettingsView()
                .tabItem {
                    Label("Impostazioni", systemImage: "gearshape")
                }
                .tag(supportsARKit ? 3 : 2) // Tag dinamico in base alla presenza di AR
        }
        .sheet(isPresented: $showingZoneSelection) {
            ZoneSelectionView()
        }
        .onAppear {
            // Log capabilities per debug
            DeviceCapabilities.logCapabilities()
            
            locationManager.requestAuthorization()
            if appState.currentZone == nil {
                showingZoneSelection = true
            }
        }
    }
}

