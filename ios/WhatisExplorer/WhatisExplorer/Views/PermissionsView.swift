//
//  PermissionsView.swift
//  Whatis Explorer
//
//  View for requesting and managing app permissions
//

import SwiftUI
import CoreLocation
import AVFoundation

struct PermissionStatus {
    let type: PermissionType
    let status: AuthorizationStatus
    let description: String
    let iconName: String
    
    enum PermissionType {
        case location
        case camera
    }
    
    enum AuthorizationStatus {
        case granted
        case denied
        case notDetermined
        case restricted
    }
}

struct PermissionsView: View {
    @Binding var isPresented: Bool
    @State private var permissionStatuses: [PermissionStatus] = []
    @State private var hasAllPermissions = false
    @State private var permissionsCheckCount = 0 // Per tracciare i cambiamenti
    
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
                    Spacer()
                        .frame(height: 40)
                    
                    // Titolo
                    Text("Autorizzazioni Necessarie")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0)) // Oro
                        .shadow(color: Color.black.opacity(0.5), radius: 2, x: 0, y: 2)
                        .padding(.bottom, 10)
                    
                    // Descrizione
                    Text("Whatis Explorer ha bisogno di alcuni permessi per funzionare correttamente. Attiva le autorizzazioni per godere dell'esperienza completa.")
                        .font(.system(size: 16, weight: .regular))
                        .foregroundColor(.white.opacity(0.9))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                        .padding(.bottom, 20)
                    
                    // Lista permessi
                    VStack(spacing: 16) {
                        ForEach(permissionStatuses, id: \.type) { permission in
                            PermissionCard(permission: permission, onRequest: {
                                requestPermission(permission.type)
                            }, onOpenSettings: {
                                openSettings()
                            })
                        }
                    }
                    .padding(.horizontal, 24)
                    
                    // Bottone Continua (solo se tutti i permessi sono concessi)
                    if hasAllPermissions {
                        Button(action: {
                            isPresented = false
                        }) {
                            Text("Continua")
                                .font(.system(size: 16, weight: .semibold))
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
                        .padding(.horizontal, 24)
                        .padding(.top, 20)
                    } else {
                        // Messaggio informativo
                        Text("Alcuni permessi non sono ancora attivi. Puoi attivarli in seguito dalle Impostazioni.")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                            .padding(.top, 10)
                        
                        Button(action: {
                            isPresented = false
                        }) {
                            Text("Continua Comunque")
                                .font(.system(size: 16, weight: .semibold))
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
                                                    Color(red: 1.0, green: 0.84, blue: 0.0).opacity(0.6),
                                                    Color(red: 0.85, green: 0.65, blue: 0.13).opacity(0.4)
                                                ]),
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            ),
                                            lineWidth: 2
                                        )
                                )
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 20)
                    }
                    
                    Spacer()
                        .frame(height: 40)
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
        .onAppear {
            checkPermissions()
        }
        .onChange(of: permissionsCheckCount) { _ in
            updateHasAllPermissions()
        }
    }
    
    private func checkPermissions() {
        var statuses: [PermissionStatus] = []
        
        // Controlla permesso localizzazione
        let locationStatus = checkLocationPermission()
        statuses.append(PermissionStatus(
            type: .location,
            status: locationStatus,
            description: "Permette all'app di mostrarti i POI vicini alla tua posizione e di guidarti verso di essi.",
            iconName: "location.fill"
        ))
        
        // Controlla permesso telecamera
        let cameraStatus = checkCameraPermission()
        statuses.append(PermissionStatus(
            type: .camera,
            status: cameraStatus,
            description: "Necessario per la funzione di realtà aumentata (AR) che ti permette di vedere i POI sovrapposti alla realtà.",
            iconName: "camera.fill"
        ))
        
        permissionStatuses = statuses
        permissionsCheckCount += 1 // Incrementa per triggerare onChange
        updateHasAllPermissions()
    }
    
    private func checkLocationPermission() -> PermissionStatus.AuthorizationStatus {
        // Usa LocationManager.shared per ottenere lo stato in modo sicuro
        let status = LocationManager.shared.authorizationStatus
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            return .granted
        case .denied:
            return .denied
        case .restricted:
            return .restricted
        case .notDetermined:
            return .notDetermined
        @unknown default:
            return .notDetermined
        }
    }
    
    private func checkCameraPermission() -> PermissionStatus.AuthorizationStatus {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .authorized:
            return .granted
        case .denied:
            return .denied
        case .restricted:
            return .restricted
        case .notDetermined:
            return .notDetermined
        @unknown default:
            return .notDetermined
        }
    }
    
    private func requestPermission(_ type: PermissionStatus.PermissionType) {
        switch type {
        case .location:
            LocationManager.shared.requestAuthorization()
            // Aspetta un attimo e ricontrolla
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                checkPermissions()
            }
        case .camera:
            AVCaptureDevice.requestAccess(for: .video) { _ in
                DispatchQueue.main.async {
                    checkPermissions()
                }
            }
        }
    }
    
    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
    
    private func updateHasAllPermissions() {
        hasAllPermissions = permissionStatuses.allSatisfy { $0.status == .granted }
    }
}

struct PermissionCard: View {
    let permission: PermissionStatus
    let onRequest: () -> Void
    let onOpenSettings: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 16) {
                // Icona
                Image(systemName: permission.iconName)
                    .font(.system(size: 32))
                    .foregroundColor(statusColor)
                    .frame(width: 50, height: 50)
                    .background(Color.white.opacity(0.1))
                    .cornerRadius(12)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(permissionTitle)
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Text(permission.description)
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.8))
                        .fixedSize(horizontal: false, vertical: true)
                }
                
                Spacer()
                
                // Badge stato
                statusBadge
            }
            
            // Bottone azione
            if permission.status != .granted {
                actionButton
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
                                    statusColor.opacity(0.6),
                                    statusColor.opacity(0.3)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 2
                        )
                )
        )
    }
    
    private var permissionTitle: String {
        switch permission.type {
        case .location:
            return "Localizzazione"
        case .camera:
            return "Telecamera"
        }
    }
    
    private var statusColor: Color {
        switch permission.status {
        case .granted:
            return .green
        case .denied:
            return .red
        case .restricted:
            return .orange
        case .notDetermined:
            return Color(red: 1.0, green: 0.84, blue: 0.0) // Oro
        }
    }
    
    private var statusBadge: some View {
        Group {
            switch permission.status {
            case .granted:
                Label("Attivo", systemImage: "checkmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(.green)
            case .denied:
                Label("Negato", systemImage: "xmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(.red)
            case .restricted:
                Label("Limitato", systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundColor(.orange)
            case .notDetermined:
                Label("Non richiesto", systemImage: "questionmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(Color(red: 1.0, green: 0.84, blue: 0.0))
            }
        }
    }
    
    private var actionButton: some View {
        Button(action: {
            if permission.status == .notDetermined {
                onRequest()
            } else {
                // Se negato o limitato, apri Impostazioni
                onOpenSettings()
            }
        }) {
            HStack {
                Image(systemName: permission.status == .notDetermined ? "hand.raised.fill" : "gear")
                Text(buttonText)
            }
            .font(.system(size: 14, weight: .semibold))
            .frame(maxWidth: .infinity)
            .padding()
            .background(statusColor.opacity(0.2))
            .foregroundColor(statusColor)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(statusColor, lineWidth: 1.5)
            )
        }
    }
    
    private var buttonText: String {
        switch permission.status {
        case .notDetermined:
            return "Concedi Autorizzazione"
        case .denied, .restricted:
            return "Apri Impostazioni"
        case .granted:
            return ""
        }
    }
}

