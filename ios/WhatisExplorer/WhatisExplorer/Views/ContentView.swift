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
    @State private var showWelcome = true // Sempre mostrata all'avvio
    @State private var showExplorationStart = false // Mostra ExplorationStartView quando si esce da una zona
    
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
        .fullScreenCover(isPresented: $showWelcome) {
            WelcomeView(isPresented: $showWelcome)
        }
        .fullScreenCover(isPresented: $showExplorationStart) {
            ExplorationStartView()
        }
        .onAppear {
            // Log capabilities per debug
            DeviceCapabilities.logCapabilities()
            
            locationManager.requestAuthorization()
            
            // Welcome screen is always shown on app launch (showWelcome = true by default)
            // After dismissing welcome, show zone selection if needed
        }
        .onChange(of: showWelcome) { newValue in
            // When welcome is dismissed, show zone selection if no zone is selected
            if !newValue && appState.currentZone == nil {
                showingZoneSelection = true
            }
        }
        .onChange(of: appState.currentZone) { newZone in
            // Quando una zona viene deselezionata (diventa nil), mostra ExplorationStartView
            // Ma solo se non stiamo mostrando il welcome (per evitare conflitti all'avvio)
            if newZone == nil && !showWelcome {
                // Mostra ExplorationStartView per permettere di selezionare una nuova zona
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    // Piccolo delay per assicurarsi che la deselezione sia completata
                    showExplorationStart = true
                }
            } else if newZone != nil {
                // Quando una zona viene selezionata, nascondi ExplorationStartView
                showExplorationStart = false
            }
        }
    }
}

