//
//  WelcomeView.swift
//  Whatis Explorer
//
//  Welcome screen with app introduction
//

import SwiftUI
import AVFoundation

struct WelcomeView: View {
    @Binding var isPresented: Bool
    @EnvironmentObject var appState: AppState
    @State private var showTourGuides = false
    @State private var showZoneSelectionForTourGuides = false
    @State private var showExplorationStart = false
    
    var body: some View {
        ZStack {
            // Background blu marino molto molto scuro
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.03, green: 0.10, blue: 0.20),  // Blu marino molto molto scuro
                    Color(red: 0.05, green: 0.12, blue: 0.25),  // Blu marino molto scuro
                    Color(red: 0.07, green: 0.15, blue: 0.30)   // Blu marino scuro
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 30) {
                    Spacer()
                        .frame(height: 40)
                    
                    // Logo/Title con bordo dorato
                    VStack(spacing: 8) {
                        Text("Whatis Explorer")
                            .font(.system(size: 42, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0))  // Oro
                            .shadow(color: Color.black.opacity(0.5), radius: 2, x: 0, y: 2)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .background(
                                RoundedRectangle(cornerRadius: 16)
                                    .fill(Color.white.opacity(0.1))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 16)
                                            .stroke(
                                                LinearGradient(
                                                    gradient: Gradient(colors: [
                                                        Color(red: 1.0, green: 0.84, blue: 0.0),
                                                        Color(red: 0.85, green: 0.65, blue: 0.13)
                                                    ]),
                                                    startPoint: .topLeading,
                                                    endPoint: .bottomTrailing
                                                ),
                                                lineWidth: 3
                                            )
                                    )
                            )
                        
                        Text(NSLocalizedString("welcome.discover_places", comment: ""))
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(.white.opacity(0.9))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                            .padding(.top, 8)
                    }
                    .padding(.bottom, 20)
                    
                    // Contenuto in un'unica cornice
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 16) {
                            SectionTitle(title: NSLocalizedString("welcome.smart_guide_title", comment: ""))
                            Text(NSLocalizedString("welcome.smart_guide_desc", comment: ""))
                                .font(.system(size: 16, weight: .regular))
                                .foregroundColor(.white.opacity(0.9))
                                .fixedSize(horizontal: false, vertical: true)
                                .lineSpacing(4)
                            
                            SectionTitle(title: NSLocalizedString("welcome.not_simple_map_title", comment: ""))
                            Text(NSLocalizedString("welcome.not_simple_map_desc", comment: ""))
                                .font(.system(size: 16, weight: .regular))
                                .foregroundColor(.white.opacity(0.9))
                                .fixedSize(horizontal: false, vertical: true)
                                .lineSpacing(4)
                            
                            SectionTitle(title: NSLocalizedString("welcome.technology_guides_title", comment: ""))
                            Text(NSLocalizedString("welcome.technology_guides_desc", comment: ""))
                                .font(.system(size: 16, weight: .regular))
                                .foregroundColor(.white.opacity(0.9))
                                .fixedSize(horizontal: false, vertical: true)
                                .lineSpacing(4)
                            
                            SectionTitle(title: NSLocalizedString("welcome.born_to_support_title", comment: ""))
                            Text(NSLocalizedString("welcome.born_to_support_desc", comment: ""))
                                .font(.system(size: 16, weight: .regular))
                                .foregroundColor(.white.opacity(0.9))
                                .fixedSize(horizontal: false, vertical: true)
                                .lineSpacing(4)
                            
                            SectionTitle(title: NSLocalizedString("welcome.local_guides_title", comment: ""))
                            Text(NSLocalizedString("welcome.local_guides_desc", comment: ""))
                                .font(.system(size: 16, weight: .regular))
                                .foregroundColor(.white.opacity(0.9))
                                .fixedSize(horizontal: false, vertical: true)
                                .lineSpacing(4)
                        }
                    }
                    .padding(20)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.white.opacity(0.1))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color(red: 1.0, green: 0.84, blue: 0.0),
                                                Color(red: 0.85, green: 0.65, blue: 0.13)
                                            ]),
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        ),
                                        lineWidth: 2
                                    )
                            )
                    )
                    .padding(.horizontal, 24)
                    
                    // Footer con effetto dorato
                    Text(NSLocalizedString("welcome.footer", comment: ""))
                        .font(.system(size: 24, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0))
                        .shadow(color: Color.black.opacity(0.3), radius: 2)
                        .padding(.top, 30)
                        .padding(.bottom, 20)
                    
                    // Start Button con bordo dorato (PRIMA)
                    Button(action: {
                        showExplorationStart = true
                    }) {
                        Text(NSLocalizedString("welcome.start_exploration", comment: ""))
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.white.opacity(0.15))
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(
                                        LinearGradient(
                                            gradient: Gradient(colors: [
                                                Color(red: 1.0, green: 0.84, blue: 0.0),
                                                Color(red: 0.85, green: 0.65, blue: 0.13)
                                            ]),
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        ),
                                        lineWidth: 2
                                    )
                            )
                            .shadow(color: Color.black.opacity(0.3), radius: 8, x: 0, y: 4)
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 16)
                    
                    // CTA Button Guide Turistiche (DOPO) - Sempre visibile
                    Button(action: {
                        showZoneSelectionForTourGuides = true
                    }) {
                        HStack {
                            Image(systemName: "person.3.fill")
                            Text(NSLocalizedString("welcome.discover_tour_guides", comment: ""))
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
                        .foregroundColor(Color(red: 0.05, green: 0.15, blue: 0.30))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(
                                    LinearGradient(
                                        gradient: Gradient(colors: [
                                            Color.white.opacity(0.3),
                                            Color.white.opacity(0.1)
                                        ]),
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 1.5
                                )
                        )
                        .shadow(color: Color(red: 1.0, green: 0.84, blue: 0.0).opacity(0.4), radius: 10, x: 0, y: 5)
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 40)
                }
            }
        }
        .sheet(isPresented: $showZoneSelectionForTourGuides) {
            ZoneSelectionForTourGuidesView()
                .environmentObject(appState)
        }
        .fullScreenCover(isPresented: $showExplorationStart) {
            ExplorationStartView()
                .onDisappear {
                    // If a zone was loaded, close welcome too
                    if appState.currentZone != nil {
                        isPresented = false
                    }
                }
        }
        .onAppear {
            // ✅ Richiedi automaticamente le autorizzazioni all'avvio
            requestPermissionsAutomatically()
        }
    }
    
    // MARK: - Automatic Permission Requests
    private func requestPermissionsAutomatically() {
        // Richiedi autorizzazione location se non determinata
        let locationManager = LocationManager.shared
        if locationManager.authorizationStatus == .notDetermined {
            print("📍 [WelcomeView] Richiesta automatica autorizzazione location...")
            locationManager.requestAuthorization()
        }
        
        // Richiedi autorizzazione camera se non determinata
        let cameraStatus = AVCaptureDevice.authorizationStatus(for: .video)
        if cameraStatus == .notDetermined {
            print("📷 [WelcomeView] Richiesta automatica autorizzazione camera...")
            AVCaptureDevice.requestAccess(for: .video) { granted in
                if granted {
                    print("✅ [WelcomeView] Autorizzazione camera concessa")
                } else {
                    print("⚠️ [WelcomeView] Autorizzazione camera negata")
                }
            }
        }
    }
}

struct SectionTitle: View {
    let title: String
    
    var body: some View {
        Text(title)
            .font(.system(size: 18, weight: .semibold))
            .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0))
            .shadow(color: Color.black.opacity(0.3), radius: 1)
            .padding(.top, 4)
    }
}

#Preview {
    WelcomeView(isPresented: .constant(true))
}

