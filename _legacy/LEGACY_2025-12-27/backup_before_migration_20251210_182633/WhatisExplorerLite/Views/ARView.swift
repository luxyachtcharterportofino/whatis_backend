//
//  ARView.swift
//  Whatis Explorer
//
//  Vista AR per visualizzare POI in realtà aumentata
//  Mostra POI sovrapposti alla telecamera con frecce direzionali
//

import SwiftUI
import ARKit
import SceneKit
import CoreLocation
import AVFoundation

struct ARView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var locationManager = LocationManager.shared
    @StateObject private var arViewModel = ARViewModel()
    @State private var selectedPOI: POI? = nil
    @State private var showPOIDetail = false
    
    var body: some View {
        ZStack {
            // Vista AR
            ARViewContainer(viewModel: arViewModel)
                .edgesIgnoringSafeArea(.all)
            
            // Overlay UI
            VStack {
                // Header con informazioni
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        if let currentZone = appState.currentZone {
                            Text(currentZone.name)
                                .font(.headline)
                                .foregroundColor(.white)
                        }
                        if let location = locationManager.currentLocation {
                            Text("📍 \(String(format: "%.1f", location.coordinate.latitude)), \(String(format: "%.1f", location.coordinate.longitude))")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.8))
                        }
                    }
                    Spacer()
                }
                .padding()
                .background(Color.black.opacity(0.5))
                
                Spacer()
                
                // POI Cards in basso (se selezionato)
                if showPOIDetail, let poi = selectedPOI {
                    POIDetailCard(poi: poi, onClose: {
                        selectedPOI = nil
                        showPOIDetail = false
                    })
                    .transition(.move(edge: .bottom))
                }
            }
        }
        .navigationTitle("AR Explorer")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            arViewModel.setupAR()
            arViewModel.onPOISelected = { poi in
                selectedPOI = poi
                showPOIDetail = true
            }
        }
        .onDisappear {
            arViewModel.pauseAR()
        }
        .onChange(of: appState.currentZone) { zone in
            if let zone = zone {
                loadPOIsForZone(zoneId: zone.id)
            }
        }
        .onChange(of: locationManager.currentLocation) { location in
            if let location = location {
                arViewModel.updateUserLocation(location)
            }
        }
    }
    
    private func loadPOIsForZone(zoneId: String) {
        Task {
            do {
                let pois = try await APIService.shared.fetchPOIs(zoneId: zoneId)
                await MainActor.run {
                    arViewModel.updatePOIs(pois)
                }
            } catch {
                print("❌ Errore caricamento POI per AR: \(error)")
            }
        }
    }
}

// MARK: - AR View Container (UIKit wrapper)
struct ARViewContainer: UIViewRepresentable {
    let viewModel: ARViewModel
    
    func makeUIView(context: Context) -> ARSCNView {
        let arView = ARSCNView()
        arView.session = viewModel.arSession
        arView.delegate = context.coordinator
        arView.scene = SCNScene()
        arView.autoenablesDefaultLighting = true
        arView.showsStatistics = false
        
        // Aggiungi tap gesture
        let tapGesture = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        arView.addGestureRecognizer(tapGesture)
        
        // Configurazione AR
        let configuration = ARWorldTrackingConfiguration()
        configuration.worldAlignment = .gravityAndHeading
        configuration.planeDetection = []
        
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            configuration.sceneReconstruction = .mesh
        }
        
        arView.session.run(configuration)
        viewModel.arView = arView
        
        return arView
    }
    
    func updateUIView(_ uiView: ARSCNView, context: Context) {
        // Aggiornamenti se necessari
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }
    
    class Coordinator: NSObject, ARSCNViewDelegate {
        let viewModel: ARViewModel
        
        init(viewModel: ARViewModel) {
            self.viewModel = viewModel
        }
        
        func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
            viewModel.updateARFrame()
        }
        
        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let arView = gesture.view as? ARSCNView else { return }
            
            let location = gesture.location(in: arView)
            let hitResults = arView.hitTest(location, options: nil)
            
            if let hit = hitResults.first {
                if let nodeName = hit.node.name {
                    viewModel.handlePOITap(nodeName: nodeName)
                }
            }
        }
    }
}

// MARK: - AR View Model
class ARViewModel: ObservableObject {
    var arSession = ARSession()
    var arView: ARSCNView?
    var onPOISelected: ((POI) -> Void)?
    
    private var pois: [POI] = []
    private var poiNodes: [String: SCNNode] = [:]
    private var userLocation: CLLocation?
    private var userHeading: Double = 0
    private var imageCache: [String: UIImage] = [:]
    private let imageCacheQueue = DispatchQueue(label: "com.whatis.imageCache")
    
    func setupAR() {
        // Setup iniziale
    }
    
    func updatePOIs(_ newPOIs: [POI]) {
        pois = newPOIs
        updatePOINodes()
    }
    
    func updateUserLocation(_ location: CLLocation) {
        userLocation = location
        updatePOINodes()
    }
    
    func updateARFrame() {
        guard let frame = arSession.currentFrame else { return }
        
        // Aggiorna heading basato sulla camera
        let cameraTransform = frame.camera.transform
        let cameraEuler = frame.camera.eulerAngles
        userHeading = Double(cameraEuler.y) * 180 / .pi
        
        // Aggiorna posizioni POI
        updatePOINodes()
    }
    
    private func updatePOINodes() {
        guard let arView = arView,
              let userLocation = userLocation else { return }
        
        // Rimuovi nodi vecchi
        poiNodes.values.forEach { $0.removeFromParentNode() }
        poiNodes.removeAll()
        
        // Crea nodi per ogni POI
        for poi in pois {
            let poiLocation = CLLocation(latitude: poi.lat, longitude: poi.lng)
            let distance = userLocation.distance(from: poiLocation)
            
            // Mostra solo POI entro 2km
            guard distance <= 2000 else { continue }
            
            let bearing = userLocation.bearing(to: poiLocation)
            let relativeBearing = bearing - userHeading
            
            // Crea nodo POI
            let poiNode = createPOINode(poi: poi, distance: distance, bearing: relativeBearing)
            arView.scene.rootNode.addChildNode(poiNode)
            poiNodes[poi.id] = poiNode
        }
    }
    
    private func createPOINode(poi: POI, distance: Double, bearing: Double) -> SCNNode {
        let node = SCNNode()
        
        // Calcola posizione 3D basata su bearing e distance
        let distance3D = min(distance / 10, 50) // Scala per visualizzazione
        let x = Float(sin(bearing * .pi / 180) * distance3D)
        let z = Float(-cos(bearing * .pi / 180) * distance3D)
        let y: Float = 0
        
        node.position = SCNVector3(x, y, z)
        
        // Crea billboard (sempre rivolto verso la camera)
        let billboard = SCNBillboardConstraint()
        billboard.freeAxes = .Y
        node.constraints = [billboard]
        
        // Crea geometria per l'icona POI (più grande per mostrare nome e distanza)
        let plane = SCNPlane(width: 1.5, height: 2.0)
        
        // Usa placeholder iniziale
        plane.firstMaterial?.diffuse.contents = createPOIIcon(poi: poi, distance: distance, image: nil)
        plane.firstMaterial?.isDoubleSided = true
        
        let planeNode = SCNNode(geometry: plane)
        planeNode.position = SCNVector3(0, 0, 0)
        node.addChildNode(planeNode)
        
        // Carica immagine in modo asincrono e aggiorna quando pronta
        loadPOIImage(poi: poi) { [weak self] image in
            guard let self = self, let material = planeNode.geometry?.firstMaterial else { return }
            DispatchQueue.main.async {
                let iconImage = self.createPOIIcon(poi: poi, distance: distance, image: image)
                material.diffuse.contents = iconImage
            }
        }
        
        // Aggiungi freccia direzionale (sempre visibile se non è direttamente davanti)
        if abs(bearing) > 5 {
            let arrow = createArrowNode(direction: bearing > 0 ? 1 : -1, bearing: bearing)
            arrow.position = SCNVector3(0, -1.0, 0)
            node.addChildNode(arrow)
        }
        
        // Aggiungi tap gesture
        node.name = poi.id
        
        return node
    }
    
    private func loadPOIImage(poi: POI, completion: @escaping (UIImage?) -> Void) {
        guard let imageUrlString = poi.imageUrl, !imageUrlString.isEmpty else {
            completion(nil)
            return
        }
        
        // Controlla cache
        imageCacheQueue.async { [weak self] in
            if let cachedImage = self?.imageCache[imageUrlString] {
                completion(cachedImage)
                return
            }
            
            // Costruisci URL (gestisce sia URL assoluti che relativi)
            var urlString = imageUrlString
            if !urlString.hasPrefix("http://") && !urlString.hasPrefix("https://") {
                // Se è un URL relativo, costruisci URL assoluto
                // Assumiamo che le immagini siano servite dal backend
                if let baseURL = UserDefaults.standard.string(forKey: "apiBaseURL") {
                    var base = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
                    if !base.hasPrefix("http") {
                        base = "https://\(base)"
                    }
                    urlString = "\(base)\(imageUrlString.hasPrefix("/") ? "" : "/")\(imageUrlString)"
                } else {
                    completion(nil)
                    return
                }
            }
            
            guard let url = URL(string: urlString) else {
                completion(nil)
                return
            }
            
            // Carica immagine in modo asincrono
            URLSession.shared.dataTask(with: url) { data, response, error in
                guard let data = data, error == nil, let image = UIImage(data: data) else {
                    completion(nil)
                    return
                }
                
                // Salva in cache
                self?.imageCacheQueue.async {
                    self?.imageCache[imageUrlString] = image
                }
                
                completion(image)
            }.resume()
        }
    }
    
    private func createPOIIcon(poi: POI, distance: Double, image: UIImage?) -> UIImage {
        // Dimensioni più grandi per includere nome e distanza
        let size = CGSize(width: 300, height: 400)
        let renderer = UIGraphicsImageRenderer(size: size)
        
        return renderer.image { context in
            // Sfondo trasparente
            context.cgContext.clear(CGRect(origin: .zero, size: size))
            
            // Immagine circolare con bordo dorato (come nel mockup)
            let imageSize: CGFloat = 200
            let imageRect = CGRect(
                x: (size.width - imageSize) / 2,
                y: 20,
                width: imageSize,
                height: imageSize
            )
            
            // Disegna immagine POI o icona di default
            if let image = image {
                // Crea maschera circolare
                context.cgContext.saveGState()
                context.cgContext.addEllipse(in: imageRect)
                context.cgContext.clip()
                
                // Disegna immagine scalata e centrata
                image.draw(in: imageRect)
                context.cgContext.restoreGState()
            } else {
                // Icona di default con sfondo
                context.cgContext.setFillColor(UIColor.systemGray5.cgColor)
                context.cgContext.fillEllipse(in: imageRect)
                
                let iconSize: CGFloat = 100
                let iconRect = CGRect(
                    x: (size.width - iconSize) / 2,
                    y: 20 + (imageSize - iconSize) / 2,
                    width: iconSize,
                    height: iconSize
                )
                UIImage(systemName: poi.iconName)?
                    .withTintColor(.systemBlue)
                    .draw(in: iconRect)
            }
            
            // Bordo dorato (come nel mockup)
            let goldenColor = UIColor(red: 1.0, green: 0.84, blue: 0.0, alpha: 1.0) // #FFD700
            context.cgContext.setStrokeColor(goldenColor.cgColor)
            context.cgContext.setLineWidth(6)
            context.cgContext.strokeEllipse(in: imageRect.insetBy(dx: 3, dy: 3))
            
            // Nome del POI (sotto l'immagine)
            let nameText = poi.name
            let nameAttributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 20),
                .foregroundColor: UIColor.white,
                .strokeColor: UIColor.black,
                .strokeWidth: -2.0
            ]
            let nameSize = nameText.size(withAttributes: nameAttributes)
            let nameRect = CGRect(
                x: (size.width - nameSize.width) / 2,
                y: imageRect.maxY + 15,
                width: min(nameSize.width, size.width - 20),
                height: nameSize.height
            )
            
            // Sfondo semi-trasparente per il nome (per leggibilità)
            let nameBgRect = nameRect.insetBy(dx: -10, dy: -5)
            let nameBgPath = UIBezierPath(roundedRect: nameBgRect, cornerRadius: 8)
            context.cgContext.setFillColor(UIColor.black.withAlphaComponent(0.6).cgColor)
            nameBgPath.fill()
            
            nameText.draw(in: nameRect, withAttributes: nameAttributes)
            
            // Distanza (sotto il nome) - formato italiano con virgola
            let distanceText: String
            if distance < 1000 {
                distanceText = String(format: "%.0f m", distance)
            } else {
                let km = distance / 1000
                distanceText = String(format: "%.1f km", km).replacingOccurrences(of: ".", with: ",")
            }
            
            let distanceAttributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 18, weight: .medium),
                .foregroundColor: UIColor.white,
                .strokeColor: UIColor.black,
                .strokeWidth: -2.0
            ]
            let distanceSize = distanceText.size(withAttributes: distanceAttributes)
            let distanceRect = CGRect(
                x: (size.width - distanceSize.width) / 2,
                y: nameRect.maxY + 10,
                width: distanceSize.width,
                height: distanceSize.height
            )
            
            // Sfondo semi-trasparente per la distanza
            let distanceBgRect = distanceRect.insetBy(dx: -10, dy: -5)
            let distanceBgPath = UIBezierPath(roundedRect: distanceBgRect, cornerRadius: 8)
            context.cgContext.setFillColor(UIColor.black.withAlphaComponent(0.6).cgColor)
            distanceBgPath.fill()
            
            distanceText.draw(in: distanceRect, withAttributes: distanceAttributes)
        }
    }
    
    private func createArrowNode(direction: Float, bearing: Double) -> SCNNode {
        let arrow = SCNNode()
        
        // Frecce più grandi e visibili (come nel mockup)
        let arrowSize: CGFloat = 100
        let arrowImage = createArrowImage(direction: direction, size: arrowSize)
        
        let arrowGeometry = SCNPlane(width: 0.8, height: 0.8)
        arrowGeometry.firstMaterial?.diffuse.contents = arrowImage
        arrowGeometry.firstMaterial?.isDoubleSided = true
        
        arrow.geometry = arrowGeometry
        
        // Ruota la freccia in base al bearing
        let rotationAngle = Float(bearing * .pi / 180)
        arrow.rotation = SCNVector4(0, 1, 0, rotationAngle)
        
        return arrow
    }
    
    private func createArrowImage(direction: Float, size: CGFloat) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        
        return renderer.image { context in
            context.cgContext.clear(CGRect(origin: .zero, size: CGSize(width: size, height: size)))
            
            // Colore arancione come nel mockup
            let orangeColor = UIColor(red: 1.0, green: 0.65, blue: 0.0, alpha: 1.0) // #FFA500
            
            // Disegna freccia arancione
            let path = UIBezierPath()
            let center = CGPoint(x: size / 2, y: size / 2)
            let arrowLength: CGFloat = size * 0.6
            let arrowWidth: CGFloat = size * 0.3
            
            if direction > 0 {
                // Freccia verso destra
                path.move(to: CGPoint(x: center.x - arrowLength / 2, y: center.y))
                path.addLine(to: CGPoint(x: center.x + arrowLength / 2, y: center.y))
                path.addLine(to: CGPoint(x: center.x + arrowLength / 2 - arrowWidth, y: center.y - arrowWidth / 2))
                path.addLine(to: CGPoint(x: center.x + arrowLength / 2, y: center.y))
                path.addLine(to: CGPoint(x: center.x + arrowLength / 2 - arrowWidth, y: center.y + arrowWidth / 2))
                path.close()
            } else {
                // Freccia verso sinistra
                path.move(to: CGPoint(x: center.x + arrowLength / 2, y: center.y))
                path.addLine(to: CGPoint(x: center.x - arrowLength / 2, y: center.y))
                path.addLine(to: CGPoint(x: center.x - arrowLength / 2 + arrowWidth, y: center.y - arrowWidth / 2))
                path.addLine(to: CGPoint(x: center.x - arrowLength / 2, y: center.y))
                path.addLine(to: CGPoint(x: center.x - arrowLength / 2 + arrowWidth, y: center.y + arrowWidth / 2))
                path.close()
            }
            
            orangeColor.setFill()
            path.fill()
            
            // Bordo nero per visibilità
            UIColor.black.setStroke()
            path.lineWidth = 2
            path.stroke()
        }
    }
    
    func handlePOITap(nodeName: String) {
        if let poi = pois.first(where: { $0.id == nodeName }) {
            onPOISelected?(poi)
        }
    }
    
    func pauseAR() {
        arView?.session.pause()
    }
}

// MARK: - POI Detail Card
struct POIDetailCard: View {
    let poi: POI
    let onClose: () -> Void
    @StateObject private var speechSynthesizer = SpeechSynthesizer()
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(poi.name.uppercased())
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                    
                    if !poi.description.isEmpty {
                        Text(poi.description)
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.9))
                            .lineLimit(2)
                    }
                }
                
                Spacer()
                
                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(.white)
                }
            }
            
            // Immagine POI
            if let imageUrl = poi.imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        Rectangle()
                            .fill(Color.gray.opacity(0.3))
                            .overlay(
                                ProgressView()
                            )
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure:
                        Rectangle()
                            .fill(Color.gray.opacity(0.3))
                            .overlay(
                                Image(systemName: "photo")
                                    .foregroundColor(.white.opacity(0.5))
                            )
                    @unknown default:
                        Rectangle()
                            .fill(Color.gray.opacity(0.3))
                    }
                }
                .frame(height: 200)
                .cornerRadius(12)
            }
            
            // Descrizione completa
            if !poi.description.isEmpty {
                ScrollView {
                    Text(poi.description)
                        .font(.body)
                        .foregroundColor(.white.opacity(0.9))
                }
                .frame(maxHeight: 150)
            }
            
            // Pulsante audio
            Button(action: {
                speechSynthesizer.speak(poi.description.isEmpty ? poi.name : poi.description, language: "it-IT")
            }) {
                HStack {
                    Image(systemName: speechSynthesizer.isSpeaking ? "speaker.wave.2.fill" : "speaker.wave.2")
                        .font(.title3)
                    Text(speechSynthesizer.isSpeaking ? "Ascoltando..." : "Ascolta i dettagli")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.yellow)
                .foregroundColor(.black)
                .cornerRadius(12)
            }
        }
        .padding()
        .background(
            LinearGradient(
                gradient: Gradient(colors: [Color.blue.opacity(0.9), Color.blue.opacity(0.7)]),
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .cornerRadius(20)
        .padding()
        .shadow(radius: 10)
    }
}

// MARK: - Speech Synthesizer
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
    
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        isSpeaking = false
    }
    
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        isSpeaking = false
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
