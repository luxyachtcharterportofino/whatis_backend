//
//  APIService.swift
//  Whatis Explorer – Lite
//
//  API Service for fetching data from Whatis backend
//

import Foundation

class APIService {
    static let shared = APIService()
    
    // ✅ FUNZIONE DI PULIZIA CENTRALIZZATA
    private static func aggressiveCleanup() {
        let allKeys = UserDefaults.standard.dictionaryRepresentation().keys
        var removedCount = 0
        for key in allKeys {
            if let value = UserDefaults.standard.object(forKey: key) {
                let valueString = String(describing: value)
                if valueString.contains("localhost") || valueString.contains("127.0.0.1") {
                    print("⚠️ [APIService.aggressiveCleanup] RIMOZIONE: '\(key)' = '\(valueString)'")
                    UserDefaults.standard.removeObject(forKey: key)
                    removedCount += 1
                }
            }
        }
        if removedCount > 0 {
            UserDefaults.standard.synchronize()
            print("✅ [APIService.aggressiveCleanup] Rimossi \(removedCount) valori problematici")
        }
    }
    
    // 🔍 TRACCIAMENTO: Inizializzazione
    private init() {
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔍 [APIService.init] APIService inizializzato")
        
        // ✅ PULIZIA AGGRESSIVA: Verifica TUTTE le chiavi UserDefaults
        let allKeys = UserDefaults.standard.dictionaryRepresentation().keys
        for key in allKeys {
            if let value = UserDefaults.standard.object(forKey: key) {
                let valueString = String(describing: value)
                if valueString.contains("localhost") || valueString.contains("127.0.0.1") {
                    print("⚠️ [APIService.init] TROVATO VALORE PROBLEMATICO in UserDefaults!")
                    print("⚠️ [APIService.init] Chiave: '\(key)' = '\(valueString)'")
                    print("⚠️ [APIService.init] RIMOZIONE IMMEDIATA...")
                    UserDefaults.standard.removeObject(forKey: key)
                    print("✅ [APIService.init] RIMOSSO: '\(key)'")
                }
            }
        }
        
        let initialValue = UserDefaults.standard.string(forKey: "apiBaseURL")
        print("🔍 [APIService.init] UserDefaults['apiBaseURL'] dopo pulizia: \(initialValue ?? "nil")")
        
        // ✅ PULIZIA AUTOMATICA: Se contiene localhost/127.0.0.1, pulisci UserDefaults
        if let savedURL = initialValue, (savedURL.contains("localhost") || savedURL.contains("127.0.0.1")) {
            print("⚠️ [APIService.init] TROVATO URL PROBLEMATICO in UserDefaults: '\(savedURL)'")
            print("⚠️ [APIService.init] Rimozione valore problematico da UserDefaults")
            UserDefaults.standard.removeObject(forKey: "apiBaseURL")
            UserDefaults.standard.synchronize() // ✅ FORZA SINCRONIZZAZIONE
            print("✅ [APIService.init] UserDefaults pulito. Verrà usato il default: 'http://192.168.1.4:3000'")
        }
        
        // ✅ VERIFICA FINALE
        let finalValue = UserDefaults.standard.string(forKey: "apiBaseURL")
        print("🔍 [APIService.init] Valore FINALE apiBaseURL: \(finalValue ?? "nil")")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    }
    
    // Backend URL - configurabile con fallback cloud → locale
    private var baseURL: String {
        // ✅ PULIZIA PREVENTIVA: Prima di leggere, pulisci UserDefaults
        APIService.aggressiveCleanup()
        
        // 🔍 TRACCIAMENTO: Leggi UserDefaults
        let rawUserDefaultsValue = UserDefaults.standard.string(forKey: "apiBaseURL")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🔍 [APIService.baseURL] TRACCIAMENTO URL")
        print("🔍 [APIService.baseURL] UserDefaults.standard.string(forKey: 'apiBaseURL')")
        print("🔍 [APIService.baseURL] Valore letto da UserDefaults: \(rawUserDefaultsValue ?? "nil")")
        
        // URL cloud di default (da configurare dopo il deploy)
        // TODO: Dopo aver deployato il backend su Railway/Render/Heroku, sostituisci questo URL
        // Esempi:
        // - Railway: https://whatis-backend-production.up.railway.app
        // - Render: https://whatis-backend.onrender.com
        // - Heroku: https://whatis-backend.herokuapp.com
        let cloudURL = "https://whatis-backend.onrender.com" // ⚠️ DA CONFIGURARE dopo deploy
        let localURL = "http://192.168.1.4:3000"
        
        // Se c'è un URL salvato, usalo
        if let savedURL = rawUserDefaultsValue, !savedURL.isEmpty {
            let url = savedURL
            print("🔍 [APIService.baseURL] URL salvato trovato: '\(url)'")
            
            // ✅ PULIZIA URL: Rimuovi /api/ se presente e trailing slash
            var cleanedURL = url
                .replacingOccurrences(of: "/api", with: "", options: .caseInsensitive)
                .replacingOccurrences(of: "/api/", with: "", options: .caseInsensitive)
            cleanedURL = cleanedURL.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
            
            // ✅ VERIFICA: Se contiene localhost/127.0.0.1, usa cloud
            if cleanedURL.contains("localhost") || cleanedURL.contains("127.0.0.1") {
                print("⚠️ [APIService.baseURL] URL locale rilevato, uso cloud: '\(cloudURL)'")
                print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                return cloudURL
            }
            
            print("✅ [APIService.baseURL] URL finale valido: '\(cleanedURL)'")
            print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            return cleanedURL
        }
        
        // Default: usa cloud URL
        print("🔍 [APIService.baseURL] Nessun URL salvato, uso cloud: '\(cloudURL)'")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        return cloudURL
    }
    
    // Funzione per testare la connettività e fare fallback
    private func testConnection(url: String) async -> Bool {
        guard let testURL = URL(string: "\(url)/api/zones?format=json") else { return false }
        
        var request = URLRequest(url: testURL)
        request.timeoutInterval = 5
        request.httpMethod = "GET"
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                return httpResponse.statusCode == 200
            }
        } catch {
            return false
        }
        return false
    }
    
    
    // MARK: - Fetch Zone
    func fetchZone(zoneId: String) async throws -> Zone {
        // Costruisci URL finale
        let urlString = "\(baseURL)/api/zones?format=json"
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🌍 [APIService] fetchZone - zoneId: \(zoneId)")
        print("🌍 [APIService] baseURL: \(baseURL)")
        print("🌍 [APIService] URL FINALE: \(urlString)")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        guard let url = URL(string: urlString) else {
            print("❌ [APIService] URL non valido: \(urlString)")
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.timeoutInterval = 60
        request.httpMethod = "GET"
        
        do {
            print("📡 [APIService] Invio richiesta...")
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [APIService] Risposta non valida (non HTTPURLResponse)")
                throw APIError.invalidResponse
            }
            
            print("📡 [APIService] Status code: \(httpResponse.statusCode)")
            print("📡 [APIService] Dati ricevuti: \(data.count) bytes")
            
            guard httpResponse.statusCode == 200 else {
                let errorString = String(data: data, encoding: .utf8) ?? "N/A"
                print("❌ [APIService] Errore HTTP \(httpResponse.statusCode): \(errorString)")
                throw APIError.invalidResponse
            }
            
            print("✅ [APIService] Decodifica JSON...")
            let zones = try JSONDecoder().decode([ZoneResponse].self, from: data)
            print("✅ [APIService] Zone trovate: \(zones.count)")
            
            // ✅ LOGGING: Mostra tutti gli ID disponibili
            print("📋 [APIService] Zone disponibili:")
            for zone in zones {
                print("   • '\(zone.name)' → _id: '\(zone._id)' (length: \(zone._id.count))")
            }
            print("📋 [APIService] Cercando zoneId: '\(zoneId)' (length: \(zoneId.count))")
            
            guard let zone = zones.first(where: { $0._id == zoneId }) else {
                print("❌ [APIService] Zone non trovata con ID: '\(zoneId)'")
                print("📋 [APIService] Zone disponibili: \(zones.map { "'\($0._id)'" }.joined(separator: ", "))")
                throw APIError.zoneNotFound
            }
            
            let mappedZone = zone.toZone()
            print("✅ [APIService] Zone trovata: '\(mappedZone.name)'")
            print("✅ [APIService] Zone ID mappato: '\(mappedZone.id)' (length: \(mappedZone.id.count))")
            return mappedZone
        } catch let error as DecodingError {
            print("❌ [APIService] Errore decodifica JSON: \(error)")
            if let data = try? await URLSession.shared.data(for: request).0 {
                let errorString = String(data: data, encoding: .utf8) ?? "N/A"
                print("🔥 [APIService] Risposta backend: \(errorString)")
            }
            throw APIError.invalidResponse
        } catch {
            print("❌ [APIService] Errore network: \(error.localizedDescription)")
            throw APIError.networkError(error)
        }
    }
    
    // MARK: - Fetch POIs
    func fetchPOIs(zoneId: String) async throws -> [POI] {
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🌍 [APIService] fetchPOIs() chiamato")
        print("🌍 [APIService] Parametro zoneId ricevuto: '\(zoneId)'")
        print("🌍 [APIService] zoneId type: \(type(of: zoneId))")
        print("🌍 [APIService] zoneId length: \(zoneId.count)")
        print("🌍 [APIService] baseURL: \(baseURL)")
        
        // ✅ Validazione ObjectId MongoDB (24 caratteri hex)
        let hexChars = CharacterSet(charactersIn: "0123456789abcdefABCDEF")
        guard zoneId.count == 24, zoneId.unicodeScalars.allSatisfy({ hexChars.contains($0) }) else {
            print("❌ [APIService] VALIDAZIONE FALLITA")
            print("❌ [APIService] ZoneId non valido: '\(zoneId)'")
            print("❌ [APIService] Lunghezza: \(zoneId.count) (richiesta: 24)")
            print("❌ [APIService] Caratteri validi: \(zoneId.unicodeScalars.allSatisfy({ hexChars.contains($0) }))")
            print("❌ [APIService] L'ID deve essere un ObjectId MongoDB valido (24 caratteri esadecimali)")
            throw APIError.invalidURL
        }
        
        // Costruisci URL finale
        let urlString = "\(baseURL)/mobile/zones/\(zoneId)/pois"
        print("✅ [APIService] ZoneId VALIDATO: \(zoneId)")
        print("🌍 [APIService] URL FINALE costruito: \(urlString)")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        guard let url = URL(string: urlString) else {
            print("❌ [APIService] URL non valido: \(urlString)")
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.timeoutInterval = 60
        request.httpMethod = "GET"
        
        do {
            print("📡 [APIService] Invio richiesta POI...")
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [APIService] Risposta non valida (non HTTPURLResponse)")
                throw APIError.invalidResponse
            }
            
            print("📡 [APIService] Status code: \(httpResponse.statusCode)")
            print("📡 [APIService] Dati ricevuti: \(data.count) bytes")
            
            guard httpResponse.statusCode == 200 else {
                let errorString = String(data: data, encoding: .utf8) ?? "N/A"
                print("❌ [APIService] Errore HTTP \(httpResponse.statusCode): \(errorString)")
                throw APIError.invalidResponse
            }
            
            // Log risposta raw per debug
            if let responseString = String(data: data, encoding: .utf8) {
                print("🔥 [APIService] Risposta backend (primi 500 caratteri): \(String(responseString.prefix(500)))")
            }
            
            print("✅ [APIService] Decodifica JSON...")
            let mobileResponse = try JSONDecoder().decode(MobilePOIsResponse.self, from: data)
            print("✅ [APIService] Success: \(mobileResponse.success)")
            print("✅ [APIService] POI trovati: \(mobileResponse.pois.count)")
            print("✅ [APIService] Total POIs: \(mobileResponse.totalPOIs)")
            
            let pois = mobileResponse.pois.map { $0.toPOI(zoneId: zoneId) }
            print("✅ [APIService] POI mappati: \(pois.count)")
            return pois
        } catch let error as DecodingError {
            print("❌ [APIService] Errore decodifica JSON: \(error)")
            switch error {
            case .keyNotFound(let key, let context):
                print("❌ [APIService] Chiave mancante: \(key.stringValue), Context: \(context)")
            case .typeMismatch(let type, let context):
                print("❌ [APIService] Tipo errato: \(type), Context: \(context)")
            case .valueNotFound(let type, let context):
                print("❌ [APIService] Valore non trovato: \(type), Context: \(context)")
            case .dataCorrupted(let context):
                print("❌ [APIService] Dati corrotti: \(context)")
            @unknown default:
                print("❌ [APIService] Errore decodifica sconosciuto")
            }
            throw APIError.invalidResponse
        } catch {
            print("❌ [APIService] Errore network: \(error.localizedDescription)")
            throw APIError.networkError(error)
        }
    }
    
    // MARK: - Fetch All Zones
    func fetchAllZones() async throws -> [Zone] {
        // Costruisci URL finale
        let urlString = "\(baseURL)/api/zones?format=json"
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("🌍 [APIService] fetchAllZones")
        print("🌍 [APIService] baseURL: \(baseURL)")
        print("🌍 [APIService] URL FINALE: \(urlString)")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        
        guard let url = URL(string: urlString) else {
            print("❌ [APIService] URL non valido: \(urlString)")
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.timeoutInterval = 60
        request.httpMethod = "GET"
        
        do {
            print("📡 [APIService] Invio richiesta zone...")
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [APIService] Risposta non valida (non HTTPURLResponse)")
                throw APIError.invalidResponse
            }
            
            print("📡 [APIService] Status code: \(httpResponse.statusCode)")
            print("📡 [APIService] Dati ricevuti: \(data.count) bytes")
            
            guard httpResponse.statusCode == 200 else {
                let errorString = String(data: data, encoding: .utf8) ?? "N/A"
                print("❌ [APIService] Errore HTTP \(httpResponse.statusCode): \(errorString)")
                throw APIError.invalidResponse
            }
            
            // Log risposta raw per debug
            if let responseString = String(data: data, encoding: .utf8) {
                print("🔥 [APIService] Risposta backend (primi 500 caratteri): \(String(responseString.prefix(500)))")
            }
            
            print("✅ [APIService] Decodifica JSON...")
            let zoneResponses = try JSONDecoder().decode([ZoneResponse].self, from: data)
            print("✅ [APIService] ZoneResponse trovate: \(zoneResponses.count)")
            
            let zones = zoneResponses.map { response in
                let zone = response.toZone()
                print("  📍 Zone mappata: '\(zone.name)' → ID: '\(zone.id)' (length: \(zone.id.count))")
                return zone
            }
            print("✅ [APIService] Zone mappate: \(zones.count)")
            
            // ✅ VERIFICA: Tutte le zone devono avere ID validi
            for zone in zones {
                if zone.id.count != 24 {
                    print("⚠️ [APIService] ATTENZIONE: Zone '\(zone.name)' ha ID non standard: '\(zone.id)' (length: \(zone.id.count))")
                }
            }
            
            return zones
        } catch let error as DecodingError {
            print("❌ [APIService] Errore decodifica JSON: \(error)")
            switch error {
            case .keyNotFound(let key, let context):
                print("❌ [APIService] Chiave mancante: \(key.stringValue), Context: \(context)")
            case .typeMismatch(let type, let context):
                print("❌ [APIService] Tipo errato: \(type), Context: \(context)")
            case .valueNotFound(let type, let context):
                print("❌ [APIService] Valore non trovato: \(type), Context: \(context)")
            case .dataCorrupted(let context):
                print("❌ [APIService] Dati corrotti: \(context)")
            @unknown default:
                print("❌ [APIService] Errore decodifica sconosciuto")
            }
            throw APIError.invalidResponse
        } catch {
            print("❌ [APIService] Errore network: \(error.localizedDescription)")
            throw APIError.networkError(error)
        }
    }
}

// MARK: - Mobile API Response Structures
// Allineate esattamente al JSON reale del backend
struct MobilePOIsResponse: Codable {
    let success: Bool
    let zone: MobileZoneInfo  // ✅ SEMPRE presente nel JSON (non opzionale)
    let pois: [MobilePOIResponse]
    let totalPOIs: Int  // ✅ SEMPRE presente nel JSON (non opzionale)
}

struct MobileZoneInfo: Codable {
    let id: String
    let name: String
    let description: String?  // ✅ Opzionale (può essere null nel JSON)
    let geographicArea: MobileGeographicArea?  // ✅ Opzionale (può essere null nel JSON)
}

struct MobileGeographicArea: Codable {
    let id: String
    let name: String
    let displayName: String
}

struct MobilePOIResponse: Codable {
    let id: String
    let name: String
    let description: String?  // ✅ Opzionale (può essere null nel JSON)
    let lat: Double
    let lng: Double
    let category: String?  // ✅ Opzionale (può essere null nel JSON, ma nel JSON reale è presente)
    let semanticCategory: String?  // ✅ Opzionale (può essere null nel JSON)
    let imageUrl: String?  // ✅ Opzionale (può essere null nel JSON)
    let customIcon: String?  // ✅ Opzionale (può essere null nel JSON)
    let source: String?  // ✅ Opzionale (può essere null nel JSON, ma nel JSON reale è presente)
    let extraInfo: MobilePOIExtraInfo  // ✅ SEMPRE presente nel JSON (non opzionale)
    
    func toPOI(zoneId: String) -> POI {
        POI(
            id: id,
            name: name,
            description: description ?? "",
            lat: lat,
            lng: lng,
            zone: zoneId,
            category: category ?? semanticCategory ?? "other",
            imageUrl: imageUrl,
            coordStatus: nil
        )
    }
}

struct MobilePOIExtraInfo: Codable {
    let rating: Double  // ✅ SEMPRE presente nel JSON (0 se mancante)
    let accessibility: String  // ✅ SEMPRE presente nel JSON
    let tags: [String]  // ✅ SEMPRE presente nel JSON (array vuoto se mancante)
}

// MARK: - API Errors
enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case zoneNotFound
    case networkError(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "URL non valido"
        case .invalidResponse:
            return "Risposta non valida dal server"
        case .zoneNotFound:
            return "Zona non trovata"
        case .networkError(let error):
            return "Errore di rete: \(error.localizedDescription)"
        }
    }
}

