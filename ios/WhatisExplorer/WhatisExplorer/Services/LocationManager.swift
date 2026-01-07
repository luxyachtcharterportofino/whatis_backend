//
//  LocationManager.swift
//  Whatis Explorer
//
//  Location Manager for GPS tracking
//

import Foundation
import CoreLocation
import Combine

class LocationManager: NSObject, ObservableObject {
    static let shared = LocationManager()
    
    private let locationManager = CLLocationManager()
    
    @Published var currentLocation: CLLocation?
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var isAuthorized: Bool = false
    
    private override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 10 // Update every 10 meters
        
        // Inizializza lo stato di autorizzazione in modo sicuro
        // Non accediamo direttamente a authorizationStatus per evitare EXC_BAD_ACCESS
        // Il delegato locationManagerDidChangeAuthorization verrà chiamato automaticamente
        // dopo che il CLLocationManager è stato inizializzato
    }
    
    func requestAuthorization() {
        // Usa la proprietà pubblicata che è già sincronizzata tramite il delegato
        // Non accediamo direttamente a locationManager.authorizationStatus per evitare EXC_BAD_ACCESS
        
        switch authorizationStatus {
        case .notDetermined:
            print("📍 [LocationManager] Richiesta autorizzazione...")
            locationManager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            print("⚠️ [LocationManager] Permessi di localizzazione negati o limitati")
            print("   L'utente può abilitare i permessi da Impostazioni > Privacy > Localizzazione > Whatis Explorer")
        case .authorizedWhenInUse, .authorizedAlways:
            print("✅ [LocationManager] Permessi già concessi, avvio aggiornamento posizione")
            startUpdatingLocation()
        @unknown default:
            print("📍 [LocationManager] Stato sconosciuto, richiesta autorizzazione...")
            locationManager.requestWhenInUseAuthorization()
        }
    }
    
    func startUpdatingLocation() {
        guard authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways else {
            requestAuthorization()
            return
        }
        
        locationManager.startUpdatingLocation()
    }
    
    func stopUpdatingLocation() {
        locationManager.stopUpdatingLocation()
    }
    
    // Calculate bearing from current location to POI
    func bearing(to coordinate: CLLocationCoordinate2D) -> Double? {
        guard let current = currentLocation else { return nil }
        
        let lat1 = current.coordinate.latitude * .pi / 180
        let lat2 = coordinate.latitude * .pi / 180
        let deltaLng = (coordinate.longitude - current.coordinate.longitude) * .pi / 180
        
        let x = sin(deltaLng) * cos(lat2)
        let y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(deltaLng)
        
        let bearing = atan2(x, y) * 180 / .pi
        return (bearing + 360).truncatingRemainder(dividingBy: 360)
    }
}

// MARK: - CLLocationManagerDelegate
extension LocationManager: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        currentLocation = location
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let clError = error as? CLError {
            switch clError.code {
            case .denied:
                print("⚠️ [LocationManager] Permessi di localizzazione negati dall'utente")
                print("   L'utente può abilitare i permessi da Impostazioni > Privacy > Localizzazione")
            case .locationUnknown:
                print("⚠️ [LocationManager] Posizione sconosciuta")
            case .network:
                print("⚠️ [LocationManager] Errore di rete per la localizzazione")
            default:
                print("⚠️ [LocationManager] Errore localizzazione: \(error.localizedDescription)")
            }
        } else {
            print("⚠️ [LocationManager] Errore localizzazione: \(error.localizedDescription)")
        }
    }
    
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        isAuthorized = authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways
        
        print("📍 [LocationManager] Stato autorizzazione cambiato: \(authorizationStatus.rawValue)")
        
        switch authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            print("✅ [LocationManager] Permessi concessi, avvio aggiornamento posizione")
            startUpdatingLocation()
        case .denied:
            print("⚠️ [LocationManager] Permessi negati dall'utente")
        case .restricted:
            print("⚠️ [LocationManager] Permessi limitati (parental controls)")
        case .notDetermined:
            print("ℹ️ [LocationManager] Permessi non ancora richiesti")
        @unknown default:
            print("⚠️ [LocationManager] Stato autorizzazione sconosciuto")
        }
    }
}

