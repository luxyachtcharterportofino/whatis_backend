//
//  MapView.swift
//  Whatis Explorer
//
//  MapKit 2D Map View with POI markers - Compatible with iOS 15+
//

import SwiftUI
import MapKit
import QuartzCore

struct MapView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var locationManager = LocationManager.shared
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 44.3, longitude: 9.2),
        span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
    )
    @State private var selectedPOI: POI?
    @State private var showingPOIDetail = false
    @State private var navigationTarget: POI?
    @State private var hasPerformedInitialZoom = false // Per tracciare se abbiamo già fatto lo zoom iniziale
    @State private var pendingZoomRegion: MKCoordinateRegion? // Regione finale per lo zoom animato
    
    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Map using UIViewRepresentable for iOS 15+ compatibility
            MapKitMapView(
                region: $region,
                pois: appState.pois,
                selectedPOI: $selectedPOI,
                currentZone: appState.currentZone,
                showsUserLocation: true,
                pendingZoomRegion: $pendingZoomRegion
            )
            .onAppear {
                // Reset del flag quando la view appare (per permettere nuovo zoom se cambia zona)
                if appState.currentZone != nil {
                    hasPerformedInitialZoom = false
                    updateRegion()
                }
            }
            .onChange(of: appState.currentZone) { newZone in
                // Quando cambia la zona, reset del flag per permettere nuovo zoom animato
                if newZone != nil {
                    hasPerformedInitialZoom = false
                    updateRegion()
                }
            }
            
            // Header con nome zona e bottone per uscire
            if let zone = appState.currentZone {
                VStack {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(zone.name)
                                .font(.headline)
                                .foregroundColor(.white)
                            Text("\(appState.pois.count) POI")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.8))
                        }
                        
                        Spacer()
                        
                        Button(action: {
                            // Deseleziona la zona corrente
                            appState.currentZone = nil
                            appState.pois = []
                            appState.isOfflineMode = false
                            print("📍 [MapView] Zona deselezionata: \(zone.name)")
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "xmark.circle.fill")
                                Text("Esci")
                            }
                            .font(.subheadline)
                            .foregroundColor(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.red.opacity(0.8))
                            .cornerRadius(8)
                        }
                    }
                    .padding()
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.black.opacity(0.7),
                                Color.black.opacity(0.5)
                            ]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .cornerRadius(12, corners: [.bottomLeft, .bottomRight])
                    
                    Spacer()
                }
            }
            
            // Controls
            VStack(spacing: 12) {
                // Center on user location
                Button(action: centerOnUserLocation) {
                    Image(systemName: "location.fill")
                        .font(.title2)
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(Color.blue)
                        .clipShape(Circle())
                        .shadow(radius: 4)
                }
                
                // Navigation button
                if let target = navigationTarget {
                    NavigationButton(target: target)
                }
            }
            .padding()
        }
        .sheet(isPresented: $showingPOIDetail, onDismiss: {
            // ✅ FIX: Reset selectedPOI quando la sheet si chiude
            // Questo permette di selezionare lo stesso POI di nuovo
            selectedPOI = nil
            print("📍 [MapView] Sheet chiusa, selectedPOI resettato")
            
            // ✅ RIPRISTINA SEMPRE la vista della zona quando si chiude il POI
            // Usa DispatchQueue per evitare conflitti con l'animazione in corso
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                // Verifica che non ci sia più un POI selezionato (doppio check)
                guard self.selectedPOI == nil else {
                    print("⚠️ [MapView] POI ancora selezionato, skip ripristino regione")
                    return
                }
                
                // Sempre ripristina la vista della zona
                if self.appState.currentZone != nil {
                    print("📍 [MapView] Ripristino vista zona dopo chiusura POI")
                    // Usa updateRegion che calcola correttamente la regione dalla zona
                    self.updateRegion()
                }
            }
        }) {
            if let poi = selectedPOI {
                POIDetailView(poi: poi, navigationTarget: $navigationTarget)
            }
        }
        .onChange(of: selectedPOI) { poi in
            if poi != nil {
                // Apri il POI detail view
                print("📍 [MapView] POI selezionato: \(poi?.name ?? "nil")")
                showingPOIDetail = true
            }
        }
    }
    
    private func updateRegion(forceInitialZoom: Bool = false) {
        guard let zone = appState.currentZone else { return }
        
        // ✅ CALCOLA IL CENTRO CORRETTO della zona dalle coordinate
        var sumLat: Double = 0
        var sumLng: Double = 0
        var minLat: Double = Double.infinity
        var maxLat: Double = -Double.infinity
        var minLng: Double = Double.infinity
        var maxLng: Double = -Double.infinity
        var count: Int = 0
        
        for coord in zone.coordinates {
            if coord.count >= 2 {
                let lat = coord[0] // latitudine
                let lng = coord[1] // longitudine
                sumLat += lat
                sumLng += lng
                minLat = min(minLat, lat)
                maxLat = max(maxLat, lat)
                minLng = min(minLng, lng)
                maxLng = max(maxLng, lng)
                count += 1
            }
        }
        
        guard count > 0 else { return }
        
        let center = CLLocationCoordinate2D(
            latitude: sumLat / Double(count),
            longitude: sumLng / Double(count)
        )
        
        // Calcola lo span della zona dalle coordinate min/max
        // Aggiungi padding (30%) per vedere meglio i bordi e far occupare la zona quasi tutto lo spazio
        let latDelta = (maxLat - minLat) * 1.3
        let lngDelta = (maxLng - minLng) * 1.3
        
        // Usa il max tra latDelta e lngDelta per una vista quadrata che contiene la zona
        // Questo fa sì che la zona occupi quasi tutto lo spazio disponibile
        let maxDelta = max(latDelta, lngDelta)
        
        // Assicurati che lo span sia almeno 0.01 (circa 1 km)
        let latitudeDelta = max(maxDelta, 0.01)
        let longitudeDelta = max(maxDelta, 0.01)
        
        let finalSpan = MKCoordinateSpan(
            latitudeDelta: latitudeDelta,
            longitudeDelta: longitudeDelta
        )
        
        // ✅ ANIMAZIONE ZOOM: Se è la prima volta O se forzato, parte da una vista molto ampia
        let shouldDoInitialZoom = forceInitialZoom || !hasPerformedInitialZoom
        
        if shouldDoInitialZoom {
            hasPerformedInitialZoom = true
            
            print("🎬 [MapView] Avvio animazione zoom iniziale per zona: \(zone.name)")
            print("🎬 [MapView] Centro zona: lat=\(center.latitude), lng=\(center.longitude)")
            print("🎬 [MapView] Span finale: latDelta=\(finalSpan.latitudeDelta), lngDelta=\(finalSpan.longitudeDelta)")
            
            // Fase 1: Imposta una vista molto ampia (circa 5000 km = 45 gradi)
            // Usa il max tra latDelta e lngDelta per garantire una vista quadrata ampia
            // IMPORTANTE: latitudeDelta non può superare 180 gradi, longitudeDelta non può superare 360 gradi
            let maxDelta = max(finalSpan.latitudeDelta, finalSpan.longitudeDelta)
            let calculatedLatDelta = max(45.0, maxDelta * 500) // Almeno 5000 km o 500x lo span finale
            let calculatedLngDelta = max(45.0, maxDelta * 500)
            
            // Limita ai valori massimi validi per MKCoordinateSpan
            let wideSpan = MKCoordinateSpan(
                latitudeDelta: min(calculatedLatDelta, 180.0), // Massimo 180 gradi
                longitudeDelta: min(calculatedLngDelta, 360.0) // Massimo 360 gradi
            )
            
            print("🎬 [MapView] Span iniziale ampio: latDelta=\(wideSpan.latitudeDelta), lngDelta=\(wideSpan.longitudeDelta)")
            
            // Imposta subito la vista ampia (senza animazione per velocità)
            region = MKCoordinateRegion(center: center, span: wideSpan)
            
            // Fase 2: Dopo un breve delay per permettere alla mappa di caricare la vista ampia,
            // zoom sulla zona con animazione elegante
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                print("🎬 [MapView] Avvio zoom animato sulla zona")
                // Imposta la regione finale che verrà applicata con animazione dalla MapKitMapView
                let finalRegion = MKCoordinateRegion(center: center, span: finalSpan)
                // Imposta pendingZoomRegion PRIMA di aggiornare region, così updateUIView lo rileva
                self.pendingZoomRegion = finalRegion
                // Aggiorna region per triggerare updateUIView (usa un cambio significativo del centro)
                self.region = MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: center.latitude + 0.001, longitude: center.longitude + 0.001),
                    span: wideSpan
                )
            }
        } else {
            // Aggiornamenti successivi: animazione normale senza zoom iniziale
            // Usa una durata più breve per ripristino rapido dopo chiusura POI
            print("📍 [MapView] Aggiornamento regione senza zoom iniziale")
            withAnimation(.easeInOut(duration: 0.4)) {
                region = MKCoordinateRegion(center: center, span: finalSpan)
            }
        }
    }
    
    private func centerOnUserLocation() {
        guard let location = locationManager.currentLocation else { return }
        
        withAnimation {
            region = MKCoordinateRegion(
                center: location.coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            )
        }
    }
}

// MARK: - MapKit Map View (iOS 15+ Compatible)
struct MapKitMapView: UIViewRepresentable {
    @Binding var region: MKCoordinateRegion
    let pois: [POI]
    @Binding var selectedPOI: POI?
    let currentZone: Zone?
    let showsUserLocation: Bool
    @Binding var pendingZoomRegion: MKCoordinateRegion? // Regione finale per lo zoom animato
    
    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator
        mapView.showsUserLocation = showsUserLocation
        mapView.userTrackingMode = .none
        
        // Store reference in coordinator
        context.coordinator.setMapView(mapView)
        
        // Inizializza lastZoneId se presente
        if let zone = currentZone {
            context.coordinator.lastZoneId = zone.id
            // Add zone overlay if available
            let polygon = zone.polygon
            let overlay = ZonePolygonOverlay(polygon: polygon)
            mapView.addOverlay(overlay)
            print("✅ [MapKitMapView] Overlay zona iniziale aggiunto: \(zone.name) (ID: \(zone.id))")
        } else {
            context.coordinator.lastZoneId = nil
        }
        
        return mapView
    }
    
    func updateUIView(_ mapView: MKMapView, context: Context) {
        let coordinator = context.coordinator
        
        // ✅ PRIORITÀ: Gestisci lo zoom animato pendente (per animazione zoom iniziale)
        if let pendingRegion = pendingZoomRegion {
            print("🎬 [MapKitMapView] Applicazione zoom animato sulla regione pendente")
            coordinator.isUpdatingRegion = true
            coordinator.lastRegion = pendingRegion
            
            DispatchQueue.main.async {
                guard mapView.window != nil else {
                    coordinator.isUpdatingRegion = false
                    return
                }
                // Applica lo zoom animato direttamente sulla mappa con durata personalizzata di 5 secondi
                CATransaction.begin()
                CATransaction.setValue(5.0, forKey: kCATransactionAnimationDuration)
                mapView.setRegion(pendingRegion, animated: true)
                CATransaction.commit()
                
                // Aggiorna anche region alla regione finale per sincronizzazione
                self.region = pendingRegion
                
                // Reset della regione pendente dopo l'applicazione (circa 5 secondi per l'animazione)
                DispatchQueue.main.asyncAfter(deadline: .now() + 5.2) {
                    // Reset del binding (triggererà un nuovo updateUIView ma pendingZoomRegion sarà nil)
                    self.pendingZoomRegion = nil
                    coordinator.isUpdatingRegion = false
                }
            }
            return
        }
        
        // ✅ EVITA LOOP: Aggiorna la regione solo se è cambiata significativamente e non siamo già in update
        guard !coordinator.isUpdatingRegion else {
            // Se siamo già in un update, skippa
            return
        }
        
        // Verifica che la regione sia valida
        guard region.span.latitudeDelta > 0 && region.span.longitudeDelta > 0 else {
            print("⚠️ [MapKitMapView] Regione non valida, skip update")
            return
        }
        
        if let lastRegion = coordinator.lastRegion {
            if coordinator.isRegionSignificantlyDifferent(region, lastRegion) {
                coordinator.isUpdatingRegion = true
                coordinator.lastRegion = region
                
                // Aggiorna la regione sulla mappa con protezione errori
                DispatchQueue.main.async {
                    // Verifica che la mappa sia ancora valida
                    guard mapView.window != nil else {
                        coordinator.isUpdatingRegion = false
                        return
                    }
                    
                    mapView.setRegion(region, animated: true)
                    
                    // Reset del flag dopo un delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                        coordinator.isUpdatingRegion = false
                    }
                }
            }
        } else {
            // Prima volta: imposta la regione senza animazione
            coordinator.lastRegion = region
            DispatchQueue.main.async {
                guard mapView.window != nil else { return }
                mapView.setRegion(region, animated: false)
            }
        }
        
        // Update annotations solo se necessario
        let currentPOIIds = Set(pois.map { $0.id })
        let existingPOIIds = Set(mapView.annotations
            .compactMap { $0 as? POIAnnotation }
            .map { $0.poi.id })
        
        if currentPOIIds != existingPOIIds {
            // Rimuovi solo le annotazioni che non sono più presenti
            let toRemove = mapView.annotations.filter { annotation in
                guard let poiAnnotation = annotation as? POIAnnotation else { return false }
                return !currentPOIIds.contains(poiAnnotation.poi.id)
            }
            mapView.removeAnnotations(toRemove)
            
            // Aggiungi solo le nuove annotazioni
            let toAdd = pois.filter { !existingPOIIds.contains($0.id) }
                .map { POIAnnotation(poi: $0) }
            mapView.addAnnotations(toAdd)
        }
        
        // Update zone polygon overlay quando la zona cambia
        // ✅ Controlla se la zona è cambiata confrontando l'ID
        let currentZoneId = currentZone?.id
        if coordinator.lastZoneId != currentZoneId {
            coordinator.lastZoneId = currentZoneId
            
            // Rimuovi tutti gli overlay di zona esistenti
            let existingOverlays = mapView.overlays.filter { $0 is ZonePolygonOverlay }
            if !existingOverlays.isEmpty {
                mapView.removeOverlays(existingOverlays)
            }
            
            // Aggiungi l'overlay della zona corrente se presente
            if let zone = currentZone {
                let polygon = zone.polygon
                let overlay = ZonePolygonOverlay(polygon: polygon)
                mapView.addOverlay(overlay)
                print("✅ [MapKitMapView] Overlay zona aggiunto: \(zone.name) (ID: \(zone.id))")
            } else {
                print("ℹ️ [MapKitMapView] Nessuna zona corrente, overlay rimosso")
            }
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, MKMapViewDelegate {
        var parent: MapKitMapView
        weak var mapView: MKMapView?
        var lastRegion: MKCoordinateRegion? // Accessibile da updateUIView
        var isUpdatingRegion = false // Evita loop infiniti, accessibile da updateUIView
        var lastZoneId: String? // Track della zona per rilevare cambiamenti
        
        init(_ parent: MapKitMapView) {
            self.parent = parent
        }
        
        func setMapView(_ mapView: MKMapView) {
            self.mapView = mapView
        }
        
        // Verifica se due regioni sono sostanzialmente diverse
        func isRegionSignificantlyDifferent(_ region1: MKCoordinateRegion, _ region2: MKCoordinateRegion) -> Bool {
            let latDiff = abs(region1.center.latitude - region2.center.latitude)
            let lngDiff = abs(region1.center.longitude - region2.center.longitude)
            let spanLatDiff = abs(region1.span.latitudeDelta - region2.span.latitudeDelta)
            let spanLngDiff = abs(region1.span.longitudeDelta - region2.span.longitudeDelta)
            
            // Considera diverse se il centro è a più di 0.001 gradi o lo span è diverso di più del 10%
            return latDiff > 0.001 || lngDiff > 0.001 || 
                   spanLatDiff > region1.span.latitudeDelta * 0.1 || 
                   spanLngDiff > region1.span.longitudeDelta * 0.1
        }
        
        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let poiAnnotation = annotation as? POIAnnotation else {
                return nil
            }
            
            let identifier = "POIMarker"
            var annotationView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier)
            
            if annotationView == nil {
                annotationView = MKAnnotationView(annotation: annotation, reuseIdentifier: identifier)
                annotationView?.canShowCallout = false
            } else {
                annotationView?.annotation = annotation
            }
            
            // Create custom marker view
            let poi = poiAnnotation.poi
            let isSelected = parent.selectedPOI?.id == poi.id
            
            let markerView = POIMarkerView(poi: poi, isSelected: isSelected)
            let hostingView = UIHostingController(rootView: markerView)
            hostingView.view.backgroundColor = .clear
            
            annotationView?.frame = CGRect(x: 0, y: 0, width: 40, height: 40)
            annotationView?.addSubview(hostingView.view)
            hostingView.view.frame = annotationView!.bounds
            
            return annotationView
        }
        
        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            if let poiAnnotation = view.annotation as? POIAnnotation {
                parent.selectedPOI = poiAnnotation.poi
            }
        }
        
        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let zoneOverlay = overlay as? ZonePolygonOverlay {
                let renderer = MKPolygonRenderer(polygon: zoneOverlay.polygon)
                renderer.fillColor = UIColor(red: 1.0, green: 0.84, blue: 0.0, alpha: 0.2) // Oro trasparente
                renderer.strokeColor = UIColor(red: 1.0, green: 0.84, blue: 0.0, alpha: 0.8) // Oro opaco
                renderer.lineWidth = 3.0
                renderer.lineDashPattern = [5, 5] // Linea tratteggiata elegante
                return renderer
            }
            return MKOverlayRenderer(overlay: overlay)
        }
    }
}

// MARK: - Zone Polygon Overlay
class ZonePolygonOverlay: NSObject, MKOverlay {
    let polygon: MKPolygon
    var coordinate: CLLocationCoordinate2D {
        polygon.coordinate
    }
    var boundingMapRect: MKMapRect {
        polygon.boundingMapRect
    }
    
    init(polygon: MKPolygon) {
        self.polygon = polygon
        super.init()
    }
}

// MARK: - POI Annotation
class POIAnnotation: NSObject, MKAnnotation {
    let poi: POI
    var coordinate: CLLocationCoordinate2D {
        poi.coordinate
    }
    var title: String? {
        poi.name
    }
    
    init(poi: POI) {
        self.poi = poi
        super.init()
    }
}

// MARK: - POI Marker View
struct POIMarkerView: View {
    let poi: POI
    let isSelected: Bool
    
    @State private var cachedImage: UIImage?
    @State private var isLoadingImage = true
    
    var body: some View {
        VStack(spacing: 0) {
            // ✅ FIX: Usa immagini dalla cache offline
            ZStack {
                if let image = cachedImage {
                    // Immagine dalla cache (funziona offline!)
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 36, height: 36)
                        .clipShape(Circle())
                } else if isLoadingImage {
                    // Loading placeholder
                    ProgressView()
                        .scaleEffect(0.6)
                        .frame(width: 36, height: 36)
                } else {
                    // Fallback: icona di categoria
                    defaultIconView
                }
            }
            .frame(width: 40, height: 40)
            .background(isSelected ? Color.red : Color.blue)
            .clipShape(Circle())
            .overlay(
                Circle()
                    .stroke(isSelected ? Color.yellow : Color.white, lineWidth: isSelected ? 3 : 2)
            )
            .shadow(color: isSelected ? .red.opacity(0.5) : .black.opacity(0.3), radius: isSelected ? 8 : 4)
            
            if isSelected {
                Text(poi.name)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(6)
                    .background(Color.white)
                    .cornerRadius(6)
                    .shadow(radius: 2)
                    .offset(y: 4)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 120)
            }
        }
        .onAppear {
            loadCachedImage()
        }
    }
    
    /// Vista icona di default quando non c'è foto
    private var defaultIconView: some View {
        Image(systemName: poi.iconName)
            .font(.system(size: 18, weight: .bold))
            .foregroundColor(.white)
            .frame(width: 36, height: 36)
    }
    
    /// Carica immagine dalla cache offline
    private func loadCachedImage() {
        // Prima prova cache sincrona (memoria + disco)
        if let image = ImageCacheService.shared.getImageSync(for: poi) {
            cachedImage = image
            isLoadingImage = false
            return
        }
        
        // Se non in cache e non c'è imageUrl, mostra icona
        guard poi.imageUrl != nil, !poi.imageUrl!.isEmpty else {
            isLoadingImage = false
            return
        }
        
        // Prova caricamento async (potrebbe scaricare da network se online)
        Task {
            let image = await ImageCacheService.shared.getImage(for: poi)
            await MainActor.run {
                cachedImage = image
                isLoadingImage = false
            }
        }
    }
}

// MARK: - Navigation Button
struct NavigationButton: View {
    @StateObject private var locationManager = LocationManager.shared
    let target: POI
    @State private var bearing: Double?
    
    var body: some View {
        Button(action: {
            openInMaps()
        }) {
            VStack(spacing: 4) {
                if let bearing = bearing {
                    Image(systemName: "arrow.up")
                        .font(.title2)
                        .foregroundColor(.white)
                        .rotationEffect(.degrees(bearing))
                } else {
                    Image(systemName: "location.fill")
                        .font(.title2)
                        .foregroundColor(.white)
                }
                Text("Naviga")
                    .font(.caption)
                    .foregroundColor(.white)
            }
            .frame(width: 60, height: 60)
            .background(Color.green)
            .clipShape(Circle())
            .shadow(radius: 4)
        }
        .onAppear {
            updateBearing()
        }
        .onChange(of: locationManager.currentLocation) { _ in
            updateBearing()
        }
    }
    
    private func updateBearing() {
        bearing = locationManager.bearing(to: target.coordinate)
    }
    
    private func openInMaps() {
        let mapItem = MKMapItem(placemark: MKPlacemark(coordinate: target.coordinate))
        mapItem.name = target.name
        mapItem.openInMaps(launchOptions: [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving
        ])
    }
}

// MARK: - View Extension per corner radius specifici
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}
