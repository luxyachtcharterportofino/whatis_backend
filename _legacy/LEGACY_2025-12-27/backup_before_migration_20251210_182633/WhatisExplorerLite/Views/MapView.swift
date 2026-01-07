//
//  MapView.swift
//  Whatis Explorer – Lite
//
//  MapKit 2D Map View with POI markers - Compatible with iOS 15+
//

import SwiftUI
import MapKit

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
    
    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Map using UIViewRepresentable for iOS 15+ compatibility
            MapKitMapView(
                region: $region,
                pois: appState.pois,
                selectedPOI: $selectedPOI,
                showsUserLocation: true
            )
            .onAppear {
                updateRegion()
            }
            .onChange(of: appState.currentZone) { _ in
                updateRegion()
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
        .sheet(isPresented: $showingPOIDetail) {
            if let poi = selectedPOI {
                POIDetailView(poi: poi, navigationTarget: $navigationTarget)
            }
        }
        .onChange(of: selectedPOI) { poi in
            if poi != nil {
                showingPOIDetail = true
            }
        }
    }
    
    private func updateRegion() {
        guard let zone = appState.currentZone else { return }
        
        let rect = zone.boundingBox
        let center = rect.origin.coordinate
        let span = MKCoordinateSpan(
            latitudeDelta: rect.height / 111000, // Approximate conversion
            longitudeDelta: rect.width / 111000
        )
        
        withAnimation {
            region = MKCoordinateRegion(center: center, span: span)
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
    let showsUserLocation: Bool
    
    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator
        mapView.showsUserLocation = showsUserLocation
        mapView.userTrackingMode = .none
        return mapView
    }
    
    func updateUIView(_ mapView: MKMapView, context: Context) {
        mapView.setRegion(region, animated: true)
        
        // Update annotations
        mapView.removeAnnotations(mapView.annotations.filter { !($0 is MKUserLocation) })
        
        let annotations = pois.map { poi in
            let annotation = POIAnnotation(poi: poi)
            return annotation
        }
        mapView.addAnnotations(annotations)
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, MKMapViewDelegate {
        var parent: MapKitMapView
        
        init(_ parent: MapKitMapView) {
            self.parent = parent
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
    
    var body: some View {
        VStack(spacing: 0) {
            Image(systemName: poi.iconName)
                .font(.title2)
                .foregroundColor(.white)
                .frame(width: 32, height: 32)
                .background(isSelected ? Color.red : Color.blue)
                .clipShape(Circle())
                .overlay(
                    Circle()
                        .stroke(Color.white, lineWidth: isSelected ? 3 : 2)
                )
                .shadow(radius: 4)
            
            if isSelected {
                Text(poi.name)
                    .font(.caption)
                    .padding(4)
                    .background(Color.white)
                    .cornerRadius(4)
                    .shadow(radius: 2)
                    .offset(y: 4)
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
