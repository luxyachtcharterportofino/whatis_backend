//
//  CachedImageView.swift
//  Whatis Explorer
//
//  Vista per mostrare immagini con supporto cache offline
//

import SwiftUI

/// Vista che mostra un'immagine POI usando prima la cache offline, poi il network
struct CachedImageView: View {
    let poi: POI
    let contentMode: ContentMode
    
    @State private var image: UIImage?
    @State private var isLoading = true
    
    init(poi: POI, contentMode: ContentMode = .fill) {
        self.poi = poi
        self.contentMode = contentMode
    }
    
    var body: some View {
        Group {
            if let image = image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
            } else if isLoading {
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .overlay(
                        ProgressView()
                            .scaleEffect(0.8)
                    )
            } else {
                // Fallback: icona categoria
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .overlay(
                        Image(systemName: poi.iconName)
                            .font(.title)
                            .foregroundColor(.gray)
                    )
            }
        }
        .onAppear {
            loadImage()
        }
    }
    
    private func loadImage() {
        // Prima prova cache sincrona
        if let cachedImage = ImageCacheService.shared.getImageSync(for: poi) {
            self.image = cachedImage
            self.isLoading = false
            return
        }
        
        // Poi prova async (network se necessario)
        Task {
            let loadedImage = await ImageCacheService.shared.getImage(for: poi)
            await MainActor.run {
                self.image = loadedImage
                self.isLoading = false
            }
        }
    }
}

/// Versione UIKit per uso in MapKit annotations
class CachedImageUIView: UIView {
    private let imageView = UIImageView()
    private let activityIndicator = UIActivityIndicatorView(style: .medium)
    private let placeholderImageView = UIImageView()
    
    var poi: POI? {
        didSet {
            if let poi = poi {
                loadImage(for: poi)
            }
        }
    }
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupViews()
    }
    
    private func setupViews() {
        // Image view
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(imageView)
        
        // Placeholder
        placeholderImageView.contentMode = .center
        placeholderImageView.tintColor = .white
        placeholderImageView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(placeholderImageView)
        
        // Activity indicator
        activityIndicator.hidesWhenStopped = true
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        addSubview(activityIndicator)
        
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: topAnchor),
            imageView.bottomAnchor.constraint(equalTo: bottomAnchor),
            imageView.leadingAnchor.constraint(equalTo: leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: trailingAnchor),
            
            placeholderImageView.centerXAnchor.constraint(equalTo: centerXAnchor),
            placeholderImageView.centerYAnchor.constraint(equalTo: centerYAnchor),
            
            activityIndicator.centerXAnchor.constraint(equalTo: centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
    }
    
    private func loadImage(for poi: POI) {
        // Mostra placeholder iniziale
        placeholderImageView.image = UIImage(systemName: poi.iconName)
        imageView.image = nil
        
        // Prima prova cache sincrona
        if let cachedImage = ImageCacheService.shared.getImageSync(for: poi) {
            imageView.image = cachedImage
            placeholderImageView.isHidden = true
            return
        }
        
        // Carica async
        activityIndicator.startAnimating()
        
        Task {
            let image = await ImageCacheService.shared.getImage(for: poi)
            
            await MainActor.run {
                self.activityIndicator.stopAnimating()
                if let image = image {
                    self.imageView.image = image
                    self.placeholderImageView.isHidden = true
                }
            }
        }
    }
}
