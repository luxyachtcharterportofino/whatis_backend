//
//  ARView.swift
//  Whatis Explorer
//
//  Vista AR per visualizzare POI in realtà aumentata
//  Usa overlay SwiftUI 2D sopra la telecamera (come nel mockup)
//

import SwiftUI
import AVFoundation
import CoreLocation
import CoreMotion

struct ARView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var locationManager = LocationManager.shared
    @StateObject private var cameraManager = CameraManager()
    @StateObject private var motionManager = MotionManager()
    @State private var selectedPOI: POI? = nil
    @State private var showPOIDetail = false
    
    /// Numero massimo di POI da mostrare
    private let maxVisiblePOIs = 5
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Vista Camera
                CameraPreviewView(session: cameraManager.session)
                    .edgesIgnoringSafeArea(.all)
                
                // Overlay POI - posizionati in base al bearing con distribuzione verticale
                ForEach(Array(closestPOIs.enumerated()), id: \.element.poi.id) { index, poiData in
                    let screenPosition = calculateScreenPosition(
                        bearing: poiData.bearing,
                        index: index,
                        totalPOIs: closestPOIs.count,
                        screenWidth: geometry.size.width,
                        screenHeight: geometry.size.height
                    )
                    
                    // Mostra solo se nel campo visivo (bearing relativo < 70°)
                    if abs(poiData.relativeBearing) < 70 {
                        ARPOIMarker(
                            poi: poiData.poi,
                            distance: poiData.distance,
                            direction: poiData.relativeBearing > 0 ? .right : .left,
                            showArrow: abs(poiData.relativeBearing) > 20
                        )
                        .position(x: screenPosition.x, y: screenPosition.y)
                        .onTapGesture {
                            selectedPOI = poiData.poi
                            showPOIDetail = true
                        }
                        .zIndex(Double(maxVisiblePOIs - index)) // POI più vicini sopra
                    }
                }
                
                // Header overlay
                VStack {
                    headerView
                    Spacer()
                    
                    // Card dettagli POI
                    if showPOIDetail, let poi = selectedPOI {
                        POIDetailCard(poi: poi, onClose: {
                            // Ferma la descrizione vocale quando si chiude il POI
                            // Questo viene gestito automaticamente dal SpeechSynthesizer nella card
                            selectedPOI = nil
                            showPOIDetail = false
                        })
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .animation(.spring(), value: showPOIDetail)
                    }
                }
            }
        }
        .onAppear {
            cameraManager.startSession()
            motionManager.startUpdates()
            loadPOIs()
        }
        .onDisappear {
            cameraManager.stopSession()
            motionManager.stopUpdates()
        }
    }
    
    // MARK: - Computed Properties
    
    /// I 5 POI più vicini con i dati di posizione
    private var closestPOIs: [POIPositionData] {
        guard let userLocation = locationManager.currentLocation else { return [] }
        
        let deviceHeading = motionManager.heading
        
        return appState.pois
            .map { poi -> POIPositionData in
                let poiLocation = CLLocation(latitude: poi.lat, longitude: poi.lng)
                let distance = userLocation.distance(from: poiLocation)
                let bearing = userLocation.bearing(to: poiLocation)
                // ✅ FIX: Corretto il calcolo del bearing relativo
                // Il telefono punta nella direzione opposta rispetto al bearing geografico
                let relativeBearing = normalizeAngle(bearing - deviceHeading)
                
                return POIPositionData(
                    poi: poi,
                    distance: distance,
                    bearing: bearing,
                    relativeBearing: relativeBearing
                )
            }
            .sorted { $0.distance < $1.distance }
            .prefix(maxVisiblePOIs)
            .map { $0 }
    }
    
    // MARK: - Views
    
    private var headerView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                if let currentZone = appState.currentZone {
                    Text(currentZone.name)
                        .font(.headline)
                        .foregroundColor(.white)
                }
                
                HStack(spacing: 4) {
                    Image(systemName: "scope")
                        .font(.caption2)
                    Text("\(closestPOIs.count) POI visibili")
                        .font(.caption2)
                }
                .foregroundColor(.yellow)
            }
            
            Spacer()
            
            // Indicatore GPS e bussola
            VStack(spacing: 2) {
                if locationManager.currentLocation != nil {
                    Image(systemName: "location.fill")
                        .foregroundColor(.green)
                }
                Text("\(Int(motionManager.heading))°")
                    .font(.caption2)
                    .foregroundColor(.white)
            }
        }
        .padding()
        .background(Color.black.opacity(0.6))
    }
    
    // MARK: - Helper Methods
    
    private func calculateScreenPosition(bearing: Double, index: Int, totalPOIs: Int, screenWidth: CGFloat, screenHeight: CGFloat) -> CGPoint {
        let deviceHeading = motionManager.heading
        let relativeBearing = normalizeAngle(bearing - deviceHeading)
        
        // Campo visivo orizzontale della camera (circa 70° per lato)
        let fieldOfView: Double = 70
        
        // Calcola posizione X basata sul bearing relativo
        let normalizedX = 0.5 - (relativeBearing / (fieldOfView * 2))
        let x = CGFloat(normalizedX) * screenWidth
        
        // ✅ FIX: Distribuisci i POI su fasce verticali per evitare sovrapposizioni
        // Ogni POI ha una fascia dedicata basata sul suo indice (ordine di distanza)
        let availableHeight = screenHeight * 0.6 // Usa 60% dello schermo (dall'alto)
        let topMargin = screenHeight * 0.12 // Margine superiore (sotto l'header)
        
        // Calcola la fascia verticale per questo POI
        let bandHeight = availableHeight / CGFloat(max(totalPOIs, 1))
        let baseY = topMargin + (bandHeight * CGFloat(index)) + (bandHeight / 2)
        
        // Aggiungi piccolo offset orizzontale alternato per evitare allineamento perfetto
        let horizontalJitter = (index % 2 == 0) ? CGFloat(15) : CGFloat(-15)
        let adjustedX = max(60, min(screenWidth - 60, x + horizontalJitter))
        
        return CGPoint(x: adjustedX, y: baseY)
    }
    
    private func normalizeAngle(_ angle: Double) -> Double {
        var normalized = angle.truncatingRemainder(dividingBy: 360)
        if normalized > 180 { normalized -= 360 }
        if normalized < -180 { normalized += 360 }
        return normalized
    }
    
    private func loadPOIs() {
        if appState.pois.isEmpty, let zone = appState.currentZone {
            let offlinePOIs = OfflineStorageService.shared.loadSavedPOIs(for: zone.id)
            if !offlinePOIs.isEmpty {
                appState.pois = offlinePOIs
            }
        }
    }
}

// MARK: - POI Position Data
struct POIPositionData {
    let poi: POI
    let distance: Double
    let bearing: Double
    let relativeBearing: Double
}

// MARK: - AR POI Marker (come nel mockup) - Ottimizzato per visibilità al sole
struct ARPOIMarker: View {
    let poi: POI
    let distance: Double
    let direction: Direction
    let showArrow: Bool
    
    enum Direction {
        case left, right
    }
    
    @State private var cachedImage: UIImage?
    
    // Colori ad alta visibilità
    private let goldColor = Color(red: 1.0, green: 0.84, blue: 0.0)
    private let darkBackground = Color.black.opacity(0.85)
    
    var body: some View {
        VStack(spacing: 6) {
            // Icona circolare con foto e bordo dorato
            ZStack {
                // Ombra esterna per visibilità
                Circle()
                    .fill(Color.black.opacity(0.5))
                    .frame(width: 100, height: 100)
                    .blur(radius: 8)
                
                // Sfondo scuro
                Circle()
                    .fill(darkBackground)
                    .frame(width: 94, height: 94)
                
                // Bordo dorato spesso
                Circle()
                    .stroke(goldColor, lineWidth: 5)
                    .frame(width: 94, height: 94)
                
                // Foto o icona
                if let image = cachedImage {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 82, height: 82)
                        .clipShape(Circle())
                } else {
                    Circle()
                        .fill(Color.gray.opacity(0.9))
                        .frame(width: 82, height: 82)
                        .overlay(
                            Image(systemName: poi.iconName)
                                .font(.system(size: 32, weight: .bold))
                                .foregroundColor(.white)
                        )
                }
                
                // Freccia direzionale (se necessario)
                if showArrow {
                    arrowOverlay
                }
            }
            
            // Nome POI con sfondo scuro per leggibilità
            Text(poi.name)
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(.white)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 130)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(darkBackground)
                        .shadow(color: .black, radius: 4, x: 0, y: 2)
                )
            
            // Distanza con sfondo
            Text(formattedDistance)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(goldColor)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(darkBackground)
                        .shadow(color: .black, radius: 3, x: 0, y: 1)
                )
        }
        .onAppear {
            loadImage()
        }
    }
    
    private var arrowOverlay: some View {
        // Freccia arancione che punta nella direzione - più grande e visibile
        Image(systemName: direction == .right ? "arrowtriangle.right.fill" : "arrowtriangle.left.fill")
            .font(.system(size: 24, weight: .bold))
            .foregroundColor(.orange)
            .padding(8)
            .background(
                Circle()
                    .fill(Color.black.opacity(0.8))
                    .shadow(color: .black, radius: 3)
            )
            .offset(x: direction == .right ? 55 : -55, y: 0)
    }
    
    private var formattedDistance: String {
        if distance < 1000 {
            return String(format: "%.0f m", distance)
        } else {
            let km = distance / 1000
            return String(format: "%.1f km", km).replacingOccurrences(of: ".", with: ",")
        }
    }
    
    private func loadImage() {
        if let image = ImageCacheService.shared.getImageSync(for: poi) {
            cachedImage = image
        } else {
            Task {
                let image = await ImageCacheService.shared.getImage(for: poi)
                await MainActor.run {
                    cachedImage = image
                }
            }
        }
    }
}

// MARK: - Camera Preview View
struct CameraPreviewView: UIViewRepresentable {
    let session: AVCaptureSession
    
    func makeUIView(context: Context) -> CameraPreviewUIView {
        let view = CameraPreviewUIView()
        view.session = session
        return view
    }
    
    func updateUIView(_ uiView: CameraPreviewUIView, context: Context) {
        uiView.updateFrame()
    }
}

// UIView custom per la camera preview
class CameraPreviewUIView: UIView {
    var session: AVCaptureSession? {
        didSet {
            setupPreviewLayer()
        }
    }
    
    private var previewLayer: AVCaptureVideoPreviewLayer?
    
    override class var layerClass: AnyClass {
        AVCaptureVideoPreviewLayer.self
    }
    
    private func setupPreviewLayer() {
        guard let session = session else { return }
        
        // Rimuovi layer esistente
        previewLayer?.removeFromSuperlayer()
        
        // Crea nuovo layer
        let newLayer = AVCaptureVideoPreviewLayer(session: session)
        newLayer.videoGravity = .resizeAspectFill
        newLayer.frame = bounds
        layer.insertSublayer(newLayer, at: 0)
        previewLayer = newLayer
        
        print("✅ [CameraPreviewUIView] Preview layer configurato")
    }
    
    func updateFrame() {
        previewLayer?.frame = bounds
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer?.frame = bounds
    }
}

// MARK: - Camera Manager
class CameraManager: NSObject, ObservableObject {
    let session = AVCaptureSession()
    private var isConfigured = false
    @Published var isRunning = false
    @Published var permissionGranted = false
    
    override init() {
        super.init()
        checkPermission()
    }
    
    private func checkPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            permissionGranted = true
            print("✅ [CameraManager] Permesso camera già autorizzato")
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    self?.permissionGranted = granted
                    if granted {
                        print("✅ [CameraManager] Permesso camera concesso")
                    } else {
                        print("❌ [CameraManager] Permesso camera negato")
                    }
                }
            }
        case .denied, .restricted:
            permissionGranted = false
            print("❌ [CameraManager] Permesso camera negato o ristretto")
        @unknown default:
            break
        }
    }
    
    func startSession() {
        guard permissionGranted else {
            print("❌ [CameraManager] Nessun permesso camera")
            checkPermission()
            return
        }
        
        if !isConfigured {
            configureSession()
        }
        
        guard isConfigured else {
            print("❌ [CameraManager] Sessione non configurata")
            return
        }
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            if !self.session.isRunning {
                self.session.startRunning()
                DispatchQueue.main.async {
                    self.isRunning = true
                    print("✅ [CameraManager] Sessione avviata")
                }
            }
        }
    }
    
    func stopSession() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            if self.session.isRunning {
                self.session.stopRunning()
                DispatchQueue.main.async {
                    self.isRunning = false
                    print("✅ [CameraManager] Sessione fermata")
                }
            }
        }
    }
    
    private func configureSession() {
        session.beginConfiguration()
        session.sessionPreset = .high
        
        // Rimuovi input esistenti
        session.inputs.forEach { session.removeInput($0) }
        
        // Video input
        guard let videoDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            print("❌ [CameraManager] Dispositivo camera non trovato")
            session.commitConfiguration()
            return
        }
        
        do {
            let videoInput = try AVCaptureDeviceInput(device: videoDevice)
            if session.canAddInput(videoInput) {
                session.addInput(videoInput)
                print("✅ [CameraManager] Input video aggiunto")
            } else {
                print("❌ [CameraManager] Impossibile aggiungere input video")
            }
        } catch {
            print("❌ [CameraManager] Errore creazione input: \(error)")
            session.commitConfiguration()
            return
        }
        
        session.commitConfiguration()
        isConfigured = true
        print("✅ [CameraManager] Camera configurata correttamente")
    }
}

// MARK: - Motion Manager (per heading/bussola)
class MotionManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    @Published var heading: Double = 0
    
    override init() {
        super.init()
        locationManager.delegate = self
    }
    
    func startUpdates() {
        // Usa Core Location per l'heading (più preciso)
        locationManager.startUpdatingHeading()
        print("✅ [MotionManager] Heading updates avviati")
    }
    
    func stopUpdates() {
        locationManager.stopUpdatingHeading()
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        DispatchQueue.main.async {
            // Usa true heading se disponibile, altrimenti magnetic
            self.heading = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        }
    }
}

// MARK: - POI Detail Card
struct POIDetailCard: View {
    let poi: POI
    let onClose: () -> Void
    @StateObject private var speechSynthesizer = SpeechSynthesizer()
    @State private var showFullDescription = false
    
    // Colori eleganti come nel mockup
    private let goldColor = Color(red: 0.85, green: 0.75, blue: 0.45)
    private let cardBackground = Color(red: 0.1, green: 0.2, blue: 0.35).opacity(0.85)

    var body: some View {
        VStack(spacing: 0) {
            // Header con handle per chiudere e bottone X
            HStack {
                // Handle per chiudere (swipe down indicator)
                VStack(spacing: 4) {
                    Image(systemName: "chevron.up")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white.opacity(0.6))
                    
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.white.opacity(0.4))
                        .frame(width: 40, height: 4)
                }
                .frame(maxWidth: .infinity)
                
                // Bottone X per chiudere (evidente)
                Button {
                    speechSynthesizer.stop() // Ferma la descrizione se in esecuzione
                    onClose()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.white.opacity(0.8))
                        .background(
                            Circle()
                                .fill(Color.black.opacity(0.5))
                                .frame(width: 32, height: 32)
                        )
                }
                .padding(.trailing, 16)
            }
            .padding(.top, 12)
            .padding(.bottom, 8)
            .contentShape(Rectangle())
            
            // Contenuto card
            VStack(alignment: .leading, spacing: 16) {
                // Header con icona location e titolo
                HStack(alignment: .top, spacing: 12) {
                    // Icona location dorata
                    Image(systemName: "mappin.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(goldColor)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        // Titolo in maiuscolo
                        Text(poi.name.uppercased())
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(.white)
                            .lineLimit(2)
                        
                        // Sottotitolo in corsivo (categoria)
                        Text(poi.categoryDisplayName)
                            .font(.system(size: 15, design: .serif))
                            .italic()
                            .foregroundColor(.white.opacity(0.7))
                    }
                    
                    Spacer()
                }
                .padding(.horizontal, 20)
                
                // Immagine con bordo dorato
                if poi.imageUrl != nil, !poi.imageUrl!.isEmpty {
                    CachedImageView(poi: poi, contentMode: .fill)
                        .frame(height: 160)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(goldColor, lineWidth: 2)
                        )
                        .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
                }
                
                // Descrizione
                if !poi.description.isEmpty {
                    Text(poi.description)
                        .font(.system(size: 15))
                        .foregroundColor(.white.opacity(0.9))
                        .lineLimit(showFullDescription ? nil : 4)
                        .lineSpacing(4)
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                showFullDescription.toggle()
                            }
                        }
                }
                
                // Pulsante descrizione vocale - con possibilità di fermare
                Button(action: {
                    if speechSynthesizer.isSpeaking {
                        speechSynthesizer.stop()
                    } else {
                        speechSynthesizer.speak(poi.description.isEmpty ? poi.name : poi.description, language: "it-IT")
                    }
                }) {
                    HStack(spacing: 12) {
                        if speechSynthesizer.isSpeaking {
                            // Bottone stop quando sta parlando
                            Image(systemName: "stop.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(.red.opacity(0.9))
                            Text("Ferma la descrizione")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(.white)
                        } else {
                            // Bottone play quando non sta parlando
                            Image(systemName: "play.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(goldColor)
                            Text("Clicca qui, ti racconterò di più")
                                .font(.system(size: 15, weight: .medium, design: .serif))
                                .italic()
                                .foregroundColor(goldColor)
                        }
                        Spacer()
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 12)
                    .padding(.horizontal, 16)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(speechSynthesizer.isSpeaking ? Color.red.opacity(0.2) : Color.white.opacity(0.1))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(speechSynthesizer.isSpeaking ? Color.red.opacity(0.5) : goldColor.opacity(0.3), lineWidth: 1.5)
                            )
                    )
                    .padding(.top, 4)
                }
                .contentShape(Rectangle())
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .background(
            // Sfondo glassmorphism
            ZStack {
                // Blur effect
                VisualEffectBlur(blurStyle: .systemUltraThinMaterialDark)
                
                // Overlay colore
                cardBackground
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .overlay(
            // Bordo dorato sottile
            RoundedRectangle(cornerRadius: 24)
                .stroke(goldColor.opacity(0.5), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.4), radius: 20, x: 0, y: -5)
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .onDisappear {
            // Ferma la descrizione vocale quando la card scompare
            speechSynthesizer.stop()
        }
    }
}

// MARK: - Visual Effect Blur (Glassmorphism)
struct VisualEffectBlur: UIViewRepresentable {
    var blurStyle: UIBlurEffect.Style
    
    func makeUIView(context: Context) -> UIVisualEffectView {
        let view = UIVisualEffectView(effect: UIBlurEffect(style: blurStyle))
        return view
    }
    
    func updateUIView(_ uiView: UIVisualEffectView, context: Context) {
        uiView.effect = UIBlurEffect(style: blurStyle)
    }
}

// MARK: - Speech Synthesizer
@MainActor
class SpeechSynthesizer: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    @Published var isSpeaking = false
    
    override init() {
        super.init()
        synthesizer.delegate = self
    }
    
    func speak(_ text: String, language: String = "it-IT") {
        stop()
        
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: language)
        utterance.rate = 0.5
        utterance.pitchMultiplier = 1.0
        utterance.volume = 1.0
        
        isSpeaking = true
        synthesizer.speak(utterance)
    }
    
    func stop() {
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        isSpeaking = false
    }
    
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            isSpeaking = false
        }
    }
    
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            isSpeaking = false
        }
    }
}

// MARK: - CLLocation Extension
extension CLLocation {
    func bearing(to location: CLLocation) -> Double {
        let lat1 = self.coordinate.latitude * .pi / 180
        let lat2 = location.coordinate.latitude * .pi / 180
        let deltaLon = (location.coordinate.longitude - self.coordinate.longitude) * .pi / 180
        
        let y = sin(deltaLon) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(deltaLon)
        
        let bearing = atan2(y, x) * 180 / .pi
        return (bearing + 360).truncatingRemainder(dividingBy: 360)
    }
}
