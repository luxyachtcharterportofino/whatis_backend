package com.andaly.whatisexplorer.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import kotlinx.serialization.Serializable

/**
 * POI Model - Compatible with backend structure
 * Based on iOS POI.swift
 */
@Parcelize
@Serializable
data class POI(
    val id: String,
    val name: String,
    val description: String,
    val lat: Double,
    val lng: Double,
    val zone: String,
    val category: String,
    val imageUrl: String? = null,
    val coordStatus: String? = null
) : Parcelable {
    
    // Category icon mapping (Material Icons)
    fun getIconName(): String {
        return when (category.lowercase()) {
            "monument" -> "apartment"
            "church" -> "church"
            "marina" -> "sailing"
            "beach" -> "beach_access"
            "biological" -> "eco"
            "wreck" -> "anchor"
            "viewpoint" -> "visibility"
            "village" -> "location_city"
            "event" -> "event"
            "restaurant" -> "restaurant"
            "hotel" -> "hotel"
            "museum" -> "museum"
            "park" -> "park"
            "harbor" -> "local_shipping"
            "lighthouse" -> "lighthouse"
            "cave" -> "landscape"
            "mountain" -> "landscape"
            "lake" -> "water"
            "river" -> "water"
            "villa" -> "villa"
            else -> "place"
        }
    }
    
    fun getCategoryDisplayName(): String {
        return when (category.lowercase()) {
            "monument" -> "Monumento"
            "church" -> "Chiesa"
            "marina" -> "Marina"
            "beach" -> "Spiaggia"
            "biological" -> "Biologico"
            "wreck" -> "Relitto"
            "viewpoint" -> "Belvedere"
            "village" -> "Villaggio"
            "event" -> "Evento"
            "restaurant" -> "Ristorante"
            "hotel" -> "Hotel"
            "museum" -> "Museo"
            "park" -> "Parco"
            "harbor" -> "Porto"
            "lighthouse" -> "Faro"
            "cave" -> "Grotta"
            "mountain" -> "Montagna"
            "lake" -> "Lago"
            "river" -> "Fiume"
            "villa" -> "Villa"
            else -> "Altro"
        }
    }
    
    fun isCoordinateConfirmed(): Boolean {
        return coordStatus == "confirmed"
    }
    
    fun getCoordinateStatusBadge(): String {
        return when (coordStatus) {
            "confirmed" -> "✓ Confermate"
            "unconfirmed" -> "? Da verificare"
            "missing" -> "✗ Mancanti"
            else -> "? Da verificare"
        }
    }
}

/**
 * Backend Response Models - Based on iOS MobilePOIsResponse
 */
@Serializable
data class MobilePOIsResponse(
    val success: Boolean,
    val zone: MobileZoneInfo,
    val pois: List<MobilePOIResponse>,
    val totalPOIs: Int
)

@Serializable
data class MobileZoneInfo(
    val id: String,
    val name: String,
    val description: String? = null,
    val geographicArea: MobileGeographicArea? = null
)

@Serializable
data class MobileGeographicArea(
    val id: String,
    val name: String,
    val displayName: String
)

@Serializable
data class MobilePOIResponse(
    val id: String,
    val name: String,
    val description: String? = null,
    val lat: Double,
    val lng: Double,
    val category: String? = null,
    val semanticCategory: String? = null,
    val imageUrl: String? = null,
    val customIcon: String? = null,
    val source: String? = null,
    val extraInfo: MobilePOIExtraInfo
) {
    fun toPOI(zoneId: String): POI {
        return POI(
            id = id,
            name = name,
            description = description ?: "",
            lat = lat,
            lng = lng,
            zone = zoneId,
            category = category ?: semanticCategory ?: "other",
            imageUrl = imageUrl,
            coordStatus = null
        )
    }
}

@Serializable
data class MobilePOIExtraInfo(
    val rating: Double = 0.0,
    val accessibility: String = "public",
    val tags: List<String> = emptyList()
)

