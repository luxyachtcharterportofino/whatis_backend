//
//  TourGuidesView.swift
//  Whatis Explorer
//
//  Tour guides list view
//

import SwiftUI

struct TourGuide: Identifiable, Codable {
    let id: String
    let name: String
    let website: String
    let description: String?
    let phone: String?
    let email: String?
}

struct TourGuidesView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var appState: AppState
    let zoneId: String?
    let zoneName: String?
    
    @State private var tourGuides: [TourGuide] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    init(zoneId: String? = nil, zoneName: String? = nil) {
        self.zoneId = zoneId
        self.zoneName = zoneName
        print("🔧 [TourGuidesView] init chiamato con zoneId: \(zoneId ?? "nil"), zoneName: \(zoneName ?? "nil")")
    }
    
    var body: some View {
        ZStack {
            Color(.systemBackground)
                .ignoresSafeArea()
            
            if isLoading {
                ProgressView()
            } else if let error = errorMessage {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 48))
                        .foregroundColor(.orange)
                    Text(error)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding()
                }
            } else if tourGuides.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "person.3")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)
                    Text("Nessuna guida turistica disponibile per questa zona")
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding()
                }
            } else {
                List(tourGuides) { guide in
                    TourGuideRow(guide: guide)
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle(zoneName ?? "Guide Turistiche")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Chiudi") {
                    print("🔧 [TourGuidesView] Bottone Chiudi premuto")
                    dismiss()
                }
            }
        }
        .onAppear {
            print("📍 [TourGuidesView] onAppear chiamato, zoneId: \(zoneId ?? "nil"), zoneName: \(zoneName ?? "nil")")
            loadTourGuides()
        }
    }
    
    private func loadTourGuides() {
        // Usa zoneId passato come parametro, altrimenti fallback su appState.currentZone
        let targetZoneId = zoneId ?? appState.currentZone?.id
        
        guard let targetZoneId = targetZoneId else {
            print("❌ [TourGuidesView] Nessuna zona selezionata")
            errorMessage = "Nessuna zona selezionata"
            isLoading = false
            return
        }
        
        print("📍 [TourGuidesView] Caricamento guide turistiche per zona: \(targetZoneId)")
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let baseURL = APIService.shared.baseURL
                let urlString = "\(baseURL)/mobile/zones/\(targetZoneId)/tour-guides"
                print("🌍 [TourGuidesView] URL: \(urlString)")
                
                guard let url = URL(string: urlString) else {
                    print("❌ [TourGuidesView] URL non valido: \(urlString)")
                    await MainActor.run {
                        errorMessage = "URL non valido"
                        isLoading = false
                    }
                    return
                }
                
                var request = URLRequest(url: url)
                request.httpMethod = "GET"
                request.timeoutInterval = 30
                request.cachePolicy = .reloadIgnoringLocalCacheData
                request.setValue("application/json", forHTTPHeaderField: "Accept")
                
                print("📡 [TourGuidesView] Invio richiesta...")
                let (data, response) = try await URLSession.shared.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    print("❌ [TourGuidesView] Risposta non valida")
                    await MainActor.run {
                        errorMessage = "Errore nel caricamento delle guide"
                        isLoading = false
                    }
                    return
                }
                
                print("📡 [TourGuidesView] Status code: \(httpResponse.statusCode)")
                print("📡 [TourGuidesView] Dati ricevuti: \(data.count) bytes")
                
                guard httpResponse.statusCode == 200 else {
                    let errorString = String(data: data, encoding: .utf8) ?? "N/A"
                    print("❌ [TourGuidesView] Errore HTTP \(httpResponse.statusCode): \(errorString)")
                    await MainActor.run {
                        errorMessage = "Errore nel caricamento delle guide (HTTP \(httpResponse.statusCode))"
                        isLoading = false
                    }
                    return
                }
                
                if let responseString = String(data: data, encoding: .utf8) {
                    print("🔥 [TourGuidesView] Risposta backend completa: \(responseString)")
                }
                
                print("✅ [TourGuidesView] Decodifica JSON...")
                let decoder = JSONDecoder()
                let result = try decoder.decode(TourGuidesResponse.self, from: data)
                print("✅ [TourGuidesView] Decodifica riuscita!")
                print("✅ [TourGuidesView] Zone ID: \(result.zone.id), Name: \(result.zone.name)")
                print("✅ [TourGuidesView] Guide trovate nel JSON: \(result.tourGuides.count)")
                
                for (index, guide) in result.tourGuides.enumerated() {
                    print("   [\(index)] Name: \(guide.name), Website: \(guide.website)")
                }
                
                await MainActor.run {
                    tourGuides = result.tourGuides.enumerated().map { index, guide in
                        TourGuide(
                            id: "\(guide.website.hash)-\(index)", // Generate unique ID from website + index
                            name: guide.name,
                            website: guide.website,
                            description: guide.description,
                            phone: guide.phone,
                            email: guide.email
                        )
                    }
                    isLoading = false
                    print("✅ [TourGuidesView] Guide caricate nell'array: \(tourGuides.count)")
                    if tourGuides.isEmpty {
                        print("⚠️ [TourGuidesView] ATTENZIONE: Array tourGuides è VUOTO dopo il mapping!")
                    }
                }
            } catch {
                print("❌ [TourGuidesView] Errore: \(error)")
                await MainActor.run {
                    errorMessage = "Errore di connessione: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }
}

struct TourGuideRow: View {
    let guide: TourGuide
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(guide.name)
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    if let description = guide.description, !description.isEmpty {
                        Text(description)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }
                
                Spacer()
            }
            
            if let phone = guide.phone, !phone.isEmpty {
                HStack {
                    Image(systemName: "phone.fill")
                        .foregroundColor(.blue)
                    Text(phone)
                        .font(.subheadline)
                }
            }
            
            if let email = guide.email, !email.isEmpty {
                HStack {
                    Image(systemName: "envelope.fill")
                        .foregroundColor(.blue)
                    Text(email)
                        .font(.subheadline)
                }
            }
            
            Button(action: {
                if let url = URL(string: guide.website) {
                    UIApplication.shared.open(url)
                }
            }) {
                HStack {
                    Image(systemName: "safari.fill")
                    Text("Visita il sito web")
                        .fontWeight(.medium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color.blue.opacity(0.1))
                .foregroundColor(.blue)
                .cornerRadius(8)
            }
        }
        .padding(.vertical, 8)
    }
}

struct TourGuidesResponse: Codable {
    let success: Bool
    let zone: ZoneInfo
    let tourGuides: [TourGuideResponse]
}

struct ZoneInfo: Codable {
    let id: String
    let name: String
}

struct TourGuideResponse: Codable {
    let name: String
    let website: String
    let description: String?
    let phone: String?
    let email: String?
}

#Preview {
    TourGuidesView()
        .environmentObject(AppState())
}

