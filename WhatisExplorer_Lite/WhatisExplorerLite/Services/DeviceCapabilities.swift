//
//  DeviceCapabilities.swift
//  Whatis Explorer
//
//  Rileva le capacità del dispositivo per adattare l'app automaticamente
//  Supporta ARKit se disponibile, altrimenti usa solo mappa 2D
//

import Foundation
import ARKit
import UIKit

/// Gestisce il rilevamento delle capacità del dispositivo
class DeviceCapabilities {
    
    /// Verifica se il dispositivo supporta ARKit
    static var supportsARKit: Bool {
        return ARWorldTrackingConfiguration.isSupported
    }
    
    /// Verifica se ARKit è disponibile e configurato correttamente
    static var isARKitAvailable: Bool {
        return ARWorldTrackingConfiguration.isSupported
    }
    
    /// Modello del dispositivo
    static var deviceModel: String {
        return UIDevice.current.model
    }
    
    /// Nome del dispositivo (es. "iPhone 11")
    static var deviceName: String {
        return UIDevice.current.name
    }
    
    /// Versione iOS
    static var iOSVersion: String {
        return UIDevice.current.systemVersion
    }
    
    /// Versione iOS come numero (per confronti)
    static var iOSVersionNumber: Double {
        let versionString = UIDevice.current.systemVersion
        let components = versionString.split(separator: ".")
        if let major = Double(components[0]), let minor = components.count > 1 ? Double(components[1]) : 0 {
            return major + (minor / 10.0)
        }
        return 15.0 // Default minimo
    }
    
    /// Verifica se il dispositivo supporta funzionalità avanzate
    static var supportsAdvancedFeatures: Bool {
        return supportsARKit && iOSVersionNumber >= 15.0
    }
    
    /// Informazioni complete sul dispositivo (per debug)
    static var deviceInfo: String {
        return """
        Device: \(deviceName)
        Model: \(deviceModel)
        iOS: \(iOSVersion)
        ARKit: \(supportsARKit ? "✅ Supportato" : "❌ Non supportato")
        Advanced Features: \(supportsAdvancedFeatures ? "✅ Disponibili" : "❌ Non disponibili")
        """
    }
    
    /// Log delle capacità del dispositivo (utile per debug)
    static func logCapabilities() {
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("📱 Device Capabilities")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(deviceInfo)
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    }
}

