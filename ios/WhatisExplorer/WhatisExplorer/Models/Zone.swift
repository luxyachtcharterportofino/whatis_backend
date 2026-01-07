//
//  Zone.swift
//  Whatis Explorer
//
//  Zone Model - Compatible with backend structure
//

import Foundation
import CoreLocation
import MapKit

struct Zone: Identifiable, Codable, Equatable {
    let id: String  // Mapped from _id in backend JSON
    let name: String
    let description: String?
    let coordinates: [[Double]] // [[lat, lng], [lat, lng], ...]
    let poiCount: Int? // Numero di POI nella zona (opzionale per retrocompatibilità)
    let price: Int? // Prezzo in centesimi (opzionale per retrocompatibilità)
    let priceFormatted: String? // Prezzo formattato (opzionale per retrocompatibilità)
    
    // CodingKeys per mappare _id dal JSON backend
    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
        case description
        case coordinates
        case poiCount
        case price
        case priceFormatted
    }
    
    // Custom initializer per garantire che id sia sempre popolato
    init(id: String, name: String, description: String?, coordinates: [[Double]], poiCount: Int? = nil, price: Int? = nil, priceFormatted: String? = nil) {
        self.id = id
        self.name = name
        self.description = description
        self.coordinates = coordinates
        self.poiCount = poiCount
        self.price = price
        self.priceFormatted = priceFormatted
    }
    
    // Convert coordinates to MapKit polygon
    var polygon: MKPolygon {
        let points = coordinates.map { coord in
            MKMapPoint(CLLocationCoordinate2D(latitude: coord[0], longitude: coord[1]))
        }
        return MKPolygon(points: points, count: points.count)
    }
    
    // Get bounding box
    var boundingBox: MKMapRect {
        var minLat = Double.infinity
        var maxLat = -Double.infinity
        var minLng = Double.infinity
        var maxLng = -Double.infinity
        
        for coord in coordinates {
            minLat = min(minLat, coord[0])
            maxLat = max(maxLat, coord[0])
            minLng = min(minLng, coord[1])
            maxLng = max(maxLng, coord[1])
        }
        
        let topLeft = MKMapPoint(CLLocationCoordinate2D(latitude: maxLat, longitude: minLng))
        let bottomRight = MKMapPoint(CLLocationCoordinate2D(latitude: minLat, longitude: maxLng))
        
        return MKMapRect(
            origin: MKMapPoint(x: min(topLeft.x, bottomRight.x), y: min(topLeft.y, bottomRight.y)),
            size: MKMapSize(width: abs(bottomRight.x - topLeft.x), height: abs(bottomRight.y - topLeft.y))
        )
    }
    
    // Center point
    var center: CLLocationCoordinate2D {
        let rect = boundingBox
        return rect.origin.coordinate
    }
}

// MARK: - Backend Response Models
struct ZoneResponse: Codable {
    let _id: String
    let name: String
    let description: String?
    let coordinates: [[Double]]
    let poiCount: Int?
    let price: Int?
    let priceFormatted: String?
    
    func toZone() -> Zone {
        Zone(
            id: _id,
            name: name,
            description: description,
            coordinates: coordinates,
            poiCount: poiCount,
            price: price,
            priceFormatted: priceFormatted
        )
    }
}

