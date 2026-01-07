package com.andaly.whatisexplorer.models

import android.os.Parcelable
import com.google.android.gms.maps.model.LatLng
import kotlinx.parcelize.Parcelize
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Zone Model - Compatible with backend structure
 * Based on iOS Zone.swift
 */
@Parcelize
@Serializable
data class Zone(
    val id: String,  // Mapped from _id in backend JSON
    val name: String,
    val description: String? = null,
    val coordinates: List<List<Double>>, // [[lat, lng], [lat, lng], ...]
    val poiCount: Int? = null, // ✅ Numero di POI nella zona (opzionale)
    val price: Int? = null, // ✅ Prezzo in centesimi (opzionale)
    val priceFormatted: String? = null // ✅ Prezzo formattato (opzionale)
) : Parcelable {
    
    // Convert coordinates to list of LatLng points
    fun getPolygonPoints(): List<LatLng> {
        return coordinates.map { coord ->
            LatLng(coord[0], coord[1])
        }
    }
    
    // Get bounding box
    fun getBoundingBox(): BoundingBox {
        var minLat = Double.MAX_VALUE
        var maxLat = -Double.MAX_VALUE
        var minLng = Double.MAX_VALUE
        var maxLng = -Double.MAX_VALUE
        
        for (coord in coordinates) {
            minLat = minOf(minLat, coord[0])
            maxLat = maxOf(maxLat, coord[0])
            minLng = minOf(minLng, coord[1])
            maxLng = maxOf(maxLng, coord[1])
        }
        
        return BoundingBox(
            minLat = minLat,
            maxLat = maxLat,
            minLng = minLng,
            maxLng = maxLng
        )
    }
    
    // Center point
    fun getCenter(): LatLng {
        val box = getBoundingBox()
        return LatLng(
            (box.minLat + box.maxLat) / 2,
            (box.minLng + box.maxLng) / 2
        )
    }
}

data class BoundingBox(
    val minLat: Double,
    val maxLat: Double,
    val minLng: Double,
    val maxLng: Double
)

/**
 * Backend Response Models - Based on iOS ZoneResponse
 */
@Serializable
data class ZoneResponse(
    @SerialName("_id")
    val id: String,
    val name: String,
    val description: String? = null,
    val coordinates: List<List<Double>>,
    val poiCount: Int? = null, // ✅ Allineato con iOS
    val price: Int? = null, // ✅ Prezzo in centesimi
    val priceFormatted: String? = null // ✅ Prezzo formattato (es. "€9,99")
) {
    fun toZone(): Zone {
        return Zone(
            id = id,
            name = name,
            description = description,
            coordinates = coordinates,
            poiCount = poiCount,
            price = price,
            priceFormatted = priceFormatted
        )
    }
}

