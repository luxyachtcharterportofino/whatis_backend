package com.andaly.whatisexplorer.ui.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.andaly.whatisexplorer.models.POI
import com.andaly.whatisexplorer.models.Zone
import com.andaly.whatisexplorer.services.APIService
import com.andaly.whatisexplorer.services.OfflineStorageService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Main App ViewModel
 * Based on iOS AppState class
 */
class AppViewModel(application: Application) : AndroidViewModel(application) {
    
    private val offlineStorage = OfflineStorageService.getInstance(application)
    
    private val _currentZone = MutableStateFlow<Zone?>(null)
    val currentZone: StateFlow<Zone?> = _currentZone.asStateFlow()
    
    private val _pois = MutableStateFlow<List<POI>>(emptyList())
    val pois: StateFlow<List<POI>> = _pois.asStateFlow()
    
    private val _isOfflineMode = MutableStateFlow(false)
    val isOfflineMode: StateFlow<Boolean> = _isOfflineMode.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    init {
        checkOfflineMode()
    }
    
    private fun checkOfflineMode() {
        viewModelScope.launch {
            val savedZone = offlineStorage.loadSavedZone()
            if (savedZone != null) {
                _currentZone.value = savedZone
                _pois.value = offlineStorage.loadSavedPOIs(savedZone.id)
                _isOfflineMode.value = true
            }
        }
    }
    
    fun loadZone(zoneId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            val zoneResult = APIService.fetchZone(zoneId)
            val poisResult = APIService.fetchPOIs(zoneId)
            
            if (zoneResult.isSuccess && poisResult.isSuccess) {
                val zone = zoneResult.getOrNull()
                val pois = poisResult.getOrNull() ?: emptyList()
                
                _currentZone.value = zone
                _pois.value = pois
                _isOfflineMode.value = false
                
                // Save for offline use
                zone?.let { offlineStorage.saveZone(it) }
                offlineStorage.savePOIs(pois, zoneId)
            } else {
                _error.value = zoneResult.exceptionOrNull()?.message
                    ?: poisResult.exceptionOrNull()?.message
                    ?: "Errore nel caricamento dei dati"
                
                // Try to load from offline storage
                val savedZone = offlineStorage.loadSavedZone()
                if (savedZone?.id == zoneId) {
                    _currentZone.value = savedZone
                    _pois.value = offlineStorage.loadSavedPOIs(zoneId)
                    _isOfflineMode.value = true
                }
            }
            
            _isLoading.value = false
        }
    }
    
    fun clearError() {
        _error.value = null
    }
}

