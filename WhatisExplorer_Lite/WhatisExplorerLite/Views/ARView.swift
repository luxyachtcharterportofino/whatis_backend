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
        
        // Crea geometria per l'icona POI
        let plane = SCNPlane(width: 1, height: 1)
        plane.firstMaterial?.diffuse.contents = createPOIIcon(poi: poi, distance: distance)
        plane.firstMaterial?.isDoubleSided = true
        
        let planeNode = SCNNode(geometry: plane)
        planeNode.position = SCNVector3(0, 0, 0)
        node.addChildNode(planeNode)
        
        // Aggiungi freccia direzionale
        if abs(bearing) > 10 {
            let arrow = createArrowNode(direction: bearing > 0 ? 1 : -1)
            arrow.position = SCNVector3(0, -0.7, 0)
            node.addChildNode(arrow)
        }
        
        // Aggiungi tap gesture
        node.name = poi.id
        
        return node
    }
    
    private func createPOIIcon(poi: POI, distance: Double) -> UIImage {
        let size = CGSize(width: 200, height: 200)
        let renderer = UIGraphicsImageRenderer(size: size)
        
        return renderer.image { context in
            // Sfondo circolare
            let circleRect = CGRect(origin: .zero, size: size)
            context.cgContext.setFillColor(UIColor.white.cgColor)
            context.cgContext.fillEllipse(in: circleRect)
            
            // Bordo
            context.cgContext.setStrokeColor(UIColor.systemBlue.cgColor)
            context.cgContext.setLineWidth(4)
            context.cgContext.strokeEllipse(in: circleRect.insetBy(dx: 2, dy: 2))
            
            // Immagine POI (se disponibile)
            if let imageUrl = poi.imageUrl,
               let url = URL(string: imageUrl),
               let imageData = try? Data(contentsOf: url),
               let image = UIImage(data: imageData) {
                let imageRect = circleRect.insetBy(dx: 20, dy: 20)
                image.draw(in: imageRect, blendMode: .normal, alpha: 0.9)
            } else {
                // Icona di default
                let iconSize: CGFloat = 80
                let iconRect = CGRect(
                    x: (size.width - iconSize) / 2,
                    y: (size.height - iconSize) / 2 - 20,
                    width: iconSize,
                    height: iconSize
                )
                UIImage(systemName: "mappin.circle.fill")?
                    .withTintColor(.systemBlue)
                    .draw(in: iconRect)
            }
            
            // Distanza
            let distanceText = String(format: "%.1f km", distance / 1000)
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 24),
                .foregroundColor: UIColor.systemBlue
            ]
            let textSize = distanceText.size(withAttributes: attributes)
            let textRect = CGRect(
                x: (size.width - textSize.width) / 2,
                y: size.height - 40,
                width: textSize.width,
                height: textSize.height
            )
            distanceText.draw(in: textRect, withAttributes: attributes)
        }
    }
    
    private func createArrowNode(direction: Float) -> SCNNode {
        let arrow = SCNNode()
        let arrowGeometry = SCNPlane(width: 0.3, height: 0.3)
        arrowGeometry.firstMaterial?.diffuse.contents = UIImage(systemName: direction > 0 ? "arrow.right" : "arrow.left")?
            .withTintColor(.yellow)
        arrow.geometry = arrowGeometry
        return arrow
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
