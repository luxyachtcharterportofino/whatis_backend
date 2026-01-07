//
//  OfflineStorageService.swift
//  Whatis Explorer
//
//  Offline storage service for zones and POIs
//

import Foundation

class OfflineStorageService {
    static let shared = OfflineStorageService()
    
    private let fileManager = FileManager.default
    private let documentsURL: URL
    
    private init() {
        documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        createDirectoriesIfNeeded()
    }
    
    private func createDirectoriesIfNeeded() {
        let zonesURL = documentsURL.appendingPathComponent("zones")
        let poisURL = documentsURL.appendingPathComponent("pois")
        
        try? fileManager.createDirectory(at: zonesURL, withIntermediateDirectories: true)
        try? fileManager.createDirectory(at: poisURL, withIntermediateDirectories: true)
    }
    
    // MARK: - Zone Storage
    func saveZone(_ zone: Zone) {
        let fileURL = documentsURL
            .appendingPathComponent("zones")
            .appendingPathComponent("\(zone.id).json")
        
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(zone)
            try data.write(to: fileURL)
            print("✅ Zone saved offline: \(zone.name)")
        } catch {
            print("❌ Error saving zone: \(error)")
        }
    }
    
    func loadSavedZone() -> Zone? {
        let zonesURL = documentsURL.appendingPathComponent("zones")
        guard let files = try? fileManager.contentsOfDirectory(at: zonesURL, includingPropertiesForKeys: nil) else {
            return nil
        }
        
        // Load the first zone found (you can modify this to support multiple zones)
        guard let firstFile = files.first else { return nil }
        
        do {
            let data = try Data(contentsOf: firstFile)
            let zone = try JSONDecoder().decode(Zone.self, from: data)
            return zone
        } catch {
            print("❌ Error loading zone: \(error)")
            return nil
        }
    }
    
    func loadSavedZone(zoneId: String) -> Zone? {
        let fileURL = documentsURL
            .appendingPathComponent("zones")
            .appendingPathComponent("\(zoneId).json")
        
        guard fileManager.fileExists(atPath: fileURL.path) else { return nil }
        
        do {
            let data = try Data(contentsOf: fileURL)
            let zone = try JSONDecoder().decode(Zone.self, from: data)
            return zone
        } catch {
            print("❌ Error loading zone: \(error)")
            return nil
        }
    }
    
    // MARK: - POI Storage
    func savePOIs(_ pois: [POI], for zoneId: String) {
        let fileURL = documentsURL
            .appendingPathComponent("pois")
            .appendingPathComponent("\(zoneId).json")
        
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(pois)
            try data.write(to: fileURL)
            print("✅ \(pois.count) POIs saved offline for zone: \(zoneId)")
        } catch {
            print("❌ Error saving POIs: \(error)")
        }
    }
    
    func loadSavedPOIs(for zoneId: String) -> [POI] {
        let fileURL = documentsURL
            .appendingPathComponent("pois")
            .appendingPathComponent("\(zoneId).json")
        
        guard fileManager.fileExists(atPath: fileURL.path) else { return [] }
        
        do {
            let data = try Data(contentsOf: fileURL)
            let pois = try JSONDecoder().decode([POI].self, from: data)
            return pois
        } catch {
            print("❌ Error loading POIs: \(error)")
            return []
        }
    }
    
    // MARK: - Clear Offline Data
    func clearOfflineData() {
        let zonesURL = documentsURL.appendingPathComponent("zones")
        let poisURL = documentsURL.appendingPathComponent("pois")
        
        try? fileManager.removeItem(at: zonesURL)
        try? fileManager.removeItem(at: poisURL)
        createDirectoriesIfNeeded()
    }
    
    // MARK: - Check Offline Data Available
    func hasOfflineData(for zoneId: String) -> Bool {
        let zoneFile = documentsURL
            .appendingPathComponent("zones")
            .appendingPathComponent("\(zoneId).json")
        let poiFile = documentsURL
            .appendingPathComponent("pois")
            .appendingPathComponent("\(zoneId).json")
        
        return fileManager.fileExists(atPath: zoneFile.path) &&
               fileManager.fileExists(atPath: poiFile.path)
    }
    
    // MARK: - Get All Downloaded Zones
    func getAllDownloadedZones() -> [Zone] {
        let zonesURL = documentsURL.appendingPathComponent("zones")
        guard let files = try? fileManager.contentsOfDirectory(at: zonesURL, includingPropertiesForKeys: nil) else {
            return []
        }
        
        var zones: [Zone] = []
        for file in files {
            guard file.pathExtension == "json" else { continue }
            do {
                let data = try Data(contentsOf: file)
                let zone = try JSONDecoder().decode(Zone.self, from: data)
                zones.append(zone)
            } catch {
                print("❌ Error loading zone from \(file.lastPathComponent): \(error)")
            }
        }
        return zones
    }
    
    func getPOIs(for zoneId: String) -> [POI]? {
        let pois = loadSavedPOIs(for: zoneId)
        return pois.isEmpty ? nil : pois
    }
}

