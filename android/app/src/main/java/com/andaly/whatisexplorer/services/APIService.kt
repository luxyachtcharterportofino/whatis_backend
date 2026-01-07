package com.andaly.whatisexplorer.services

import com.andaly.whatisexplorer.models.MobilePOIsResponse
import com.andaly.whatisexplorer.models.POI
import com.andaly.whatisexplorer.models.Zone
import com.andaly.whatisexplorer.models.ZoneResponse
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * API Service for fetching data from Whatis backend
 * Based on iOS APIService.swift
 */
object APIService {
    
    private const val DEFAULT_BASE_URL = "http://192.168.1.6:3000" // ✅ Allineato con iOS
    
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }
    
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }
    
    // ✅ Interceptor per disabilitare cache (allineato con iOS cachePolicy = .reloadIgnoringLocalCacheData)
    private val noCacheInterceptor = okhttp3.Interceptor { chain ->
        val request = chain.request().newBuilder()
            .header("Cache-Control", "no-cache, no-store, must-revalidate")
            .header("Pragma", "no-cache")
            .header("Expires", "0")
            .build()
        chain.proceed(request)
    }
    
    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .addInterceptor(noCacheInterceptor) // ✅ Evita cache stale per ottenere sempre i dati più recenti
        .connectTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .cache(null) // ✅ Disabilita cache completamente
        .build()
    
    private fun createRetrofit(baseUrl: String): Retrofit {
        val contentType = "application/json".toMediaType()
        return Retrofit.Builder()
            .baseUrl(baseUrl.ensureTrailingSlash())
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
    }
    
    private val api: WhatisAPI by lazy {
        val baseUrl = getBaseURL()
        createRetrofit(baseUrl).create(WhatisAPI::class.java)
    }
    
    fun getBaseURL(): String {
        // TODO: Get from DataStore/SharedPreferences
        // For now, return default (matches iOS default)
        return DEFAULT_BASE_URL
    }
    
    val baseURL: String
        get() = getBaseURL()
    
    fun setBaseURL(url: String) {
        // TODO: Save to DataStore/SharedPreferences
    }
    
    interface WhatisAPI {
        @GET("mobile/zones")
        suspend fun getAllZones(): List<ZoneResponse>
        
        @GET("mobile/zones/{zoneId}/pois")
        suspend fun getPOIs(
            @Path("zoneId") zoneId: String
        ): MobilePOIsResponse
    }
    
    suspend fun fetchAllZones(): Result<List<Zone>> {
        return try {
            // ✅ USA ENDPOINT MOBILE DEDICATO (allineato con iOS)
            val response = api.getAllZones()
            val zones = response.map { it.toZone() }
            Result.success(zones)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun fetchZone(zoneId: String): Result<Zone> {
        return try {
            val zones = fetchAllZones().getOrThrow()
            val zone = zones.firstOrNull { it.id == zoneId }
                ?: return Result.failure(Exception("Zone not found"))
            Result.success(zone)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun fetchPOIs(zoneId: String): Result<List<POI>> {
        return try {
            // Validate ObjectId MongoDB (24 hex characters)
            if (zoneId.length != 24 || !zoneId.all { it.isDigit() || it in 'a'..'f' || it in 'A'..'F' }) {
                return Result.failure(Exception("Invalid zone ID: must be 24 hex characters"))
            }
            
            val response = api.getPOIs(zoneId)
            val pois = response.pois.map { it.toPOI(zoneId) }
            Result.success(pois)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private fun String.ensureTrailingSlash(): String {
        return if (this.endsWith("/")) this else "$this/"
    }
}

