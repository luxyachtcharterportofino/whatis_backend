package com.andaly.whatisexplorer.services

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.andaly.whatisexplorer.models.POI
import com.andaly.whatisexplorer.models.Zone
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Offline Storage Service using DataStore for persistence
 * Based on iOS OfflineStorageService.swift
 */
class OfflineStorageService private constructor(private val context: Context) {
    
    companion object {
        private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "offline_storage")
        
        private val SAVED_ZONE_KEY = stringPreferencesKey("saved_zone")
        private val SAVED_POIS_PREFIX = "saved_pois_"
        
        @Volatile
        private var INSTANCE: OfflineStorageService? = null
        
        fun getInstance(context: Context): OfflineStorageService {
            return INSTANCE ?: synchronized(this) {
                val instance = OfflineStorageService(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }
    }
    
    private val dataStore = context.dataStore
    private val json = Json { ignoreUnknownKeys = true }
    
    suspend fun saveZone(zone: Zone) {
        dataStore.edit { preferences ->
            preferences[SAVED_ZONE_KEY] = json.encodeToString(Zone.serializer(), zone)
        }
    }
    
    suspend fun loadSavedZone(): Zone? {
        return try {
            val zoneJson = dataStore.data.first()[SAVED_ZONE_KEY] ?: return null
            json.decodeFromString(Zone.serializer(), zoneJson)
        } catch (e: Exception) {
            null
        }
    }
    
    suspend fun savePOIs(pois: List<POI>, zoneId: String) {
        val key = stringPreferencesKey("${SAVED_POIS_PREFIX}$zoneId")
        dataStore.edit { preferences ->
            val poisJson = json.encodeToString(
                kotlinx.serialization.builtins.ListSerializer(POI.serializer()),
                pois
            )
            preferences[key] = poisJson
        }
    }
    
    suspend fun loadSavedPOIs(zoneId: String): List<POI> {
        return try {
            val key = stringPreferencesKey("${SAVED_POIS_PREFIX}$zoneId")
            val poisJson = dataStore.data.first()[key] ?: return emptyList()
            json.decodeFromString(
                kotlinx.serialization.builtins.ListSerializer(POI.serializer()),
                poisJson
            )
        } catch (e: Exception) {
            emptyList()
        }
    }
    
    suspend fun clearAllData() {
        dataStore.edit { preferences ->
            preferences.clear()
        }
    }
}

