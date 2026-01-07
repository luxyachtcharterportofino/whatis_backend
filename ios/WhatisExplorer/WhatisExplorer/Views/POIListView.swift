//
//  POIListView.swift
//  Whatis Explorer
//
//  List View with filterable and sortable POIs
//

import SwiftUI

struct POIListView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var locationManager = LocationManager.shared
    @State private var searchText = ""
    @State private var selectedCategory: String? = nil
    @State private var sortOption: SortOption = .distance
    @State private var selectedPOI: POI?
    
    enum SortOption: String, CaseIterable {
        case distance = "Distanza"
        case name = "Nome"
        case category = "Categoria"
    }
    
    var filteredPOIs: [POI] {
        var pois = appState.pois
        
        // Filter by search text
        if !searchText.isEmpty {
            pois = pois.filter { poi in
                poi.name.localizedCaseInsensitiveContains(searchText) ||
                poi.description.localizedCaseInsensitiveContains(searchText)
            }
        }
        
        // Filter by category
        if let category = selectedCategory {
            pois = pois.filter { $0.category == category }
        }
        
        // Sort
        switch sortOption {
        case .distance:
            if let location = locationManager.currentLocation {
                pois = pois.sorted { poi1, poi2 in
                    poi1.distance(from: location) < poi2.distance(from: location)
                }
            }
        case .name:
            pois = pois.sorted { $0.name < $1.name }
        case .category:
            pois = pois.sorted { $0.category < $1.category }
        }
        
        return pois
    }
    
    var categories: [String] {
        Array(Set(appState.pois.map { $0.category })).sorted()
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search and filters
                VStack(spacing: 8) {
                    // Search bar
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.gray)
                        TextField("Cerca POI...", text: $searchText)
                    }
                    .padding(8)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                    .padding(.horizontal)
                    
                    // Category filter
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            CategoryChip(title: "Tutte", isSelected: selectedCategory == nil) {
                                selectedCategory = nil
                            }
                            
                            ForEach(categories, id: \.self) { category in
                                CategoryChip(
                                    title: POI(id: "", name: "", description: "", lat: 0, lng: 0, zone: "", category: category, imageUrl: nil, coordStatus: nil).categoryDisplayName,
                                    isSelected: selectedCategory == category
                                ) {
                                    selectedCategory = category
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                    
                    // Sort options
                    Picker("Ordina per", selection: $sortOption) {
                        ForEach(SortOption.allCases, id: \.self) { option in
                            Text(option.rawValue).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                }
                .padding(.vertical, 8)
                .background(Color(.systemBackground))
                
                // POI List
                if filteredPOIs.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "mappin.slash")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)
                        Text("Nessun POI trovato")
                            .font(.headline)
                            .foregroundColor(.gray)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(filteredPOIs) { poi in
                        POIListRow(poi: poi)
                            .onTapGesture {
                                selectedPOI = poi
                            }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("POI")
            .navigationBarTitleDisplayMode(.large)
            .sheet(item: $selectedPOI) { poi in
                NavigationView {
                    POIDetailView(poi: poi, navigationTarget: .constant(nil))
                        .environmentObject(appState)
                }
            }
        }
    }
}

// MARK: - POI List Row
struct POIListRow: View {
    @StateObject private var locationManager = LocationManager.shared
    let poi: POI
    
    var body: some View {
        HStack(spacing: 12) {
            // Icon
            Image(systemName: poi.iconName)
                .font(.title2)
                .foregroundColor(.blue)
                .frame(width: 40, height: 40)
                .background(Color.blue.opacity(0.1))
                .clipShape(Circle())
            
            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(poi.name)
                    .font(.headline)
                
                Text(poi.categoryDisplayName)
                    .font(.caption)
                    .foregroundColor(.gray)
                
                if let location = locationManager.currentLocation {
                    Text(poi.formattedDistance(from: location))
                        .font(.caption)
                        .foregroundColor(.blue)
                }
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundColor(.gray)
                .font(.caption)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Category Chip
struct CategoryChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.blue : Color(.systemGray5))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(16)
        }
    }
}

