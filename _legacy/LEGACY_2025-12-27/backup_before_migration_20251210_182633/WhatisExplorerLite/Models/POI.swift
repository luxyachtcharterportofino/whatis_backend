//
//  POI.swift
//  Whatis Explorer – Lite
//
//  POI Model - Compatible with backend structure
//

import Foundation
import CoreLocation

struct POI: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let description: String
    let lat: Double
    let lng: Double
    let zone: String
    let category: String
    let imageUrl: String?
    let coordStatus: String?
    
    // Computed properties
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
    
    var location: CLLocation {
        CLLocation(latitude: lat, longitude: lng)
    }
    
    // Category icon mapping
    var iconName: String {
        switch category.lowercased() {
        case "monument": return "building.columns"
        case "church": return "building.columns.fill"
        case "marina": return "sailboat"
        case "beach": return "beach.umbrella"
        case "biological": return "leaf"
        case "wreck": return "ship"
        case "viewpoint": return "binoculars"
        case "village": return "house"
        case "event": return "calendar"
        case "restaurant": return "fork.knife"
        case "hotel": return "bed.double"
        case "museum": return "building.2"
        case "park": return "tree"
        case "harbor": return "anchor"
        case "lighthouse": return "light.beacon"
        case "cave": return "mountain.2"
        case "mountain": return "mountain.2.fill"
        case "lake": return "water.waves"
        case "river": return "water.waves.slash"
        case "villa": return "building"
        default: return "mappin.circle"
        }
    }
    
    var categoryDisplayName: String {
        switch category.lowercased() {
        case "monument": return "Monumento"
        case "church": return "Chiesa"
        case "marina": return "Marina"
        case "beach": return "Spiaggia"
        case "biological": return "Biologico"
        case "wreck": return "Relitto"
        case "viewpoint": return "Belvedere"
        case "village": return "Villaggio"
        case "event": return "Evento"
        case "restaurant": return "Ristorante"
        case "hotel": return "Hotel"
        case "museum": return "Museo"
        case "park": return "Parco"
        case "harbor": return "Porto"
        case "lighthouse": return "Faro"
        case "cave": return "Grotta"
        case "mountain": return "Montagna"
        case "lake": return "Lago"
        case "river": return "Fiume"
        case "villa": return "Villa"
        default: return "Altro"
        }
    }
    
    // Calculate distance from current location
    func distance(from location: CLLocation) -> CLLocationDistance {
        self.location.distance(from: location)
    }
    
    func formattedDistance(from location: CLLocation) -> String {
        let distance = self.distance(from: location)
        if distance < 1000 {
            return String(format: "%.0f m", distance)
        } else {
            return String(format: "%.1f km", distance / 1000)
        }
    }
    
    // Coordinate status
    var isCoordinateConfirmed: Bool {
        coordStatus == "confirmed"
    }
    
    var coordinateStatusBadge: String {
        switch coordStatus {
        case "confirmed": return "✓ Confermate"
        case "unconfirmed": return "? Da verificare"
        case "missing": return "✗ Mancanti"
        default: return "? Da verificare"
        }
    }
}

// MARK: - Backend Response Models
struct POIResponse: Codable {
    let _id: String
    let name: String
    let description: String?
    let lat: Double
    let lng: Double
    let zone: String
    let category: String?
    let imageUrl: String?
    let coordStatus: String?
    
    func toPOI() -> POI {
        POI(
            id: _id,
            name: name,
            description: description ?? "",
            lat: lat,
            lng: lng,
            zone: zone,
            category: category ?? "other",
            imageUrl: imageUrl,
            coordStatus: coordStatus
        )
    }
}

