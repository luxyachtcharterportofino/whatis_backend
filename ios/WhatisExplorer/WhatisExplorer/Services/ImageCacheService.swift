//
//  ImageCacheService.swift
//  Whatis Explorer
//
//  Servizio per il download e caching offline delle immagini POI
//

import Foundation
import UIKit

class ImageCacheService {
    static let shared = ImageCacheService()
    
    private let fileManager = FileManager.default
    private let imagesDirectoryURL: URL
    private let memoryCache = NSCache<NSString, UIImage>()
    private let downloadQueue = DispatchQueue(label: "com.whatis.imagecache", attributes: .concurrent)
    
    private init() {
        let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        imagesDirectoryURL = documentsURL.appendingPathComponent("poi_images")
        
        // Crea directory se non esiste
        try? fileManager.createDirectory(at: imagesDirectoryURL, withIntermediateDirectories: true)
        
        // Configura memory cache - RIDOTTO per evitare memory issues
        memoryCache.countLimit = 30  // Ridotto da 100 a 30
        memoryCache.totalCostLimit = 20 * 1024 * 1024 // Ridotto da 50MB a 20MB
        
        print("📁 [ImageCacheService] Directory immagini: \(imagesDirectoryURL.path)")
    }
    
    // MARK: - Public API
    
    /// Scarica e salva offline tutte le immagini dei POI
    func downloadImages(for pois: [POI], baseURL: String, progress: @escaping (Double) -> Void) async -> Int {
        let poisWithImages = pois.filter { $0.imageUrl != nil && !$0.imageUrl!.isEmpty }
        guard !poisWithImages.isEmpty else {
            print("📷 [ImageCacheService] Nessun POI con immagini da scaricare")
            return 0
        }
        
        print("📷 [ImageCacheService] Inizio download \(poisWithImages.count) immagini...")
        
        var downloadedCount = 0
        let total = Double(poisWithImages.count)
        
        // ✅ OTTIMIZZAZIONE MEMORIA: Limita download simultanei per evitare memory pressure
        let maxConcurrentDownloads = 3
        var currentIndex = 0
        
        while currentIndex < poisWithImages.count {
            let batch = poisWithImages[currentIndex..<min(currentIndex + maxConcurrentDownloads, poisWithImages.count)]
            
            // Scarica batch in parallelo (ma limitato)
            await withTaskGroup(of: Bool.self) { group in
                for poi in batch {
                    guard let imageUrl = poi.imageUrl else { continue }
                    let fullURL = buildFullImageURL(imageUrl, baseURL: baseURL)
                    
                    group.addTask {
                        await self.downloadAndSaveImage(from: fullURL, poiId: poi.id)
                    }
                }
                
                // Conta download completati
                for await success in group {
                    if success {
                        downloadedCount += 1
                    }
                }
            }
            
            currentIndex += maxConcurrentDownloads
            
            // Aggiorna progresso
            let currentProgress = Double(currentIndex) / total
            await MainActor.run {
                progress(min(currentProgress, 1.0))
            }
            
            // ✅ OTTIMIZZAZIONE MEMORIA: Piccola pausa tra batch per permettere al sistema di liberare memoria
            try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 secondi
        }
        
        print("📷 [ImageCacheService] Download completato: \(downloadedCount)/\(poisWithImages.count) immagini salvate")
        return downloadedCount
    }
    
    /// Ottieni immagine per un POI (prima cache memoria, poi disco, poi network)
    func getImage(for poi: POI, baseURL: String? = nil) async -> UIImage? {
        // 1. Controlla memory cache
        if let cached = memoryCache.object(forKey: poi.id as NSString) {
            return cached
        }
        
        // 2. Controlla disk cache
        if let diskImage = loadImageFromDisk(poiId: poi.id) {
            memoryCache.setObject(diskImage, forKey: poi.id as NSString)
            return diskImage
        }
        
        // 3. Scarica da network (se abbiamo un URL)
        guard let imageUrl = poi.imageUrl, !imageUrl.isEmpty else {
            return nil
        }
        
        let base = baseURL ?? getBaseURL()
        let fullURL = buildFullImageURL(imageUrl, baseURL: base)
        
        if await downloadAndSaveImage(from: fullURL, poiId: poi.id) {
            return loadImageFromDisk(poiId: poi.id)
        }
        
        return nil
    }
    
    /// Verifica se l'immagine è già in cache
    func hasImage(for poiId: String) -> Bool {
        if memoryCache.object(forKey: poiId as NSString) != nil {
            return true
        }
        
        let fileURL = imagesDirectoryURL.appendingPathComponent("\(poiId).jpg")
        return fileManager.fileExists(atPath: fileURL.path)
    }
    
    /// Ottieni URL locale dell'immagine (per uso diretto)
    func localImageURL(for poiId: String) -> URL? {
        let fileURL = imagesDirectoryURL.appendingPathComponent("\(poiId).jpg")
        if fileManager.fileExists(atPath: fileURL.path) {
            return fileURL
        }
        return nil
    }
    
    /// Carica immagine sincrona (per MapKit annotations)
    func getImageSync(for poi: POI) -> UIImage? {
        // 1. Memory cache
        if let cached = memoryCache.object(forKey: poi.id as NSString) {
            return cached
        }
        
        // 2. Disk cache
        if let diskImage = loadImageFromDisk(poiId: poi.id) {
            memoryCache.setObject(diskImage, forKey: poi.id as NSString)
            return diskImage
        }
        
        return nil
    }
    
    /// Pulisci cache per una zona
    func clearCache(for zoneId: String, pois: [POI]) {
        for poi in pois {
            let fileURL = imagesDirectoryURL.appendingPathComponent("\(poi.id).jpg")
            try? fileManager.removeItem(at: fileURL)
            memoryCache.removeObject(forKey: poi.id as NSString)
        }
        print("🗑️ [ImageCacheService] Cache pulita per zona: \(zoneId)")
    }
    
    /// Pulisci tutta la cache
    func clearAllCache() {
        try? fileManager.removeItem(at: imagesDirectoryURL)
        try? fileManager.createDirectory(at: imagesDirectoryURL, withIntermediateDirectories: true)
        memoryCache.removeAllObjects()
        print("🗑️ [ImageCacheService] Tutta la cache immagini pulita")
    }
    
    /// Calcola dimensione cache in MB
    func cacheSizeInMB() -> Double {
        var totalSize: Int64 = 0
        
        if let files = try? fileManager.contentsOfDirectory(at: imagesDirectoryURL, includingPropertiesForKeys: [.fileSizeKey]) {
            for file in files {
                if let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize {
                    totalSize += Int64(size)
                }
            }
        }
        
        return Double(totalSize) / (1024 * 1024)
    }
    
    // MARK: - Private Methods
    
    private func downloadAndSaveImage(from urlString: String, poiId: String) async -> Bool {
        guard let url = URL(string: urlString) else {
            print("❌ [ImageCacheService] URL non valido: \(urlString)")
            return false
        }
        
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return false
            }
            
            guard let image = UIImage(data: data) else {
                print("❌ [ImageCacheService] Dati non validi per immagine: \(poiId)")
                return false
            }
            
            // ✅ OTTIMIZZAZIONE MEMORIA: Comprimi PRIMA di salvare
            // Riduci dimensione immagine se troppo grande (max 1024px lato maggiore)
            let maxDimension: CGFloat = 1024
            let resizedImage: UIImage
            if image.size.width > maxDimension || image.size.height > maxDimension {
                let scale = min(maxDimension / image.size.width, maxDimension / image.size.height)
                let newSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
                UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
                image.draw(in: CGRect(origin: .zero, size: newSize))
                resizedImage = UIGraphicsGetImageFromCurrentImageContext() ?? image
                UIGraphicsEndImageContext()
            } else {
                resizedImage = image
            }
            
            // Comprimi e salva (qualità ridotta per risparmiare spazio)
            let compressedData = resizedImage.jpegData(compressionQuality: 0.6) // Ridotto da 0.7 a 0.6
            let fileURL = imagesDirectoryURL.appendingPathComponent("\(poiId).jpg")
            
            try compressedData?.write(to: fileURL)
            
            // ✅ OTTIMIZZAZIONE MEMORIA: NON salvare in memory cache durante download batch
            // La memory cache verrà popolata solo quando l'immagine viene richiesta
            // Questo evita di caricare tutte le immagini in memoria contemporaneamente
            
            return true
        } catch {
            print("❌ [ImageCacheService] Errore download \(poiId): \(error.localizedDescription)")
            return false
        }
    }
    
    private func loadImageFromDisk(poiId: String) -> UIImage? {
        let fileURL = imagesDirectoryURL.appendingPathComponent("\(poiId).jpg")
        
        guard fileManager.fileExists(atPath: fileURL.path),
              let data = try? Data(contentsOf: fileURL),
              let image = UIImage(data: data) else {
            return nil
        }
        
        return image
    }
    
    private func buildFullImageURL(_ imageUrl: String, baseURL: String) -> String {
        if imageUrl.hasPrefix("http://") || imageUrl.hasPrefix("https://") {
            return imageUrl
        }
        
        var base = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
        if !base.hasPrefix("http") {
            base = "http://\(base)"
        }
        
        return "\(base)\(imageUrl.hasPrefix("/") ? "" : "/")\(imageUrl)"
    }
    
    private func getBaseURL() -> String {
        if let savedURL = UserDefaults.standard.string(forKey: "apiBaseURL"), !savedURL.isEmpty {
            return savedURL
        }
        return "https://whatisbackend-production.up.railway.app"
    }
}
