package com.andaly.whatisexplorer.models

import kotlinx.serialization.Serializable

/**
 * Tour Guide Model - Based on backend structure
 */
@Serializable
data class TourGuide(
    val name: String,
    val website: String,
    val description: String? = null,
    val phone: String? = null,
    val email: String? = null
) {
    // Generate unique ID for SwiftUI Identifiable compatibility
    val id: String
        get() = "${website.hashCode()}-$name"
}

@Serializable
data class TourGuidesResponse(
    val success: Boolean,
    val zone: ZoneInfo,
    val tourGuides: List<TourGuide>
)

@Serializable
data class ZoneInfo(
    val id: String,
    val name: String
)

