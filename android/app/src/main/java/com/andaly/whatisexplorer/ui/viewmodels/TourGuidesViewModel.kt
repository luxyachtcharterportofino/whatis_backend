package com.andaly.whatisexplorer.ui.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.andaly.whatisexplorer.models.TourGuide
import com.andaly.whatisexplorer.models.TourGuidesResponse
import com.andaly.whatisexplorer.services.APIService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Tour Guides ViewModel
 */
class TourGuidesViewModel(application: Application) : AndroidViewModel(application) {
    
    private val _tourGuides = MutableStateFlow<List<TourGuide>>(emptyList())
    val tourGuides: StateFlow<List<TourGuide>> = _tourGuides.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }
    
    // ✅ Client con cache policy disabilitata (allineato con iOS)
    private val client = OkHttpClient.Builder()
        .cache(null) // Disabilita cache
        .addInterceptor { chain ->
            val request = chain.request().newBuilder()
                .header("Cache-Control", "no-cache, no-store, must-revalidate")
                .header("Pragma", "no-cache")
                .header("Expires", "0")
                .header("Accept", "application/json")
                .build()
            chain.proceed(request)
        }
        .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .build()
    
    fun loadTourGuides(zoneId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            try {
                val baseURL = APIService.getBaseURL()
                val url = "${baseURL}/mobile/zones/${zoneId}/tour-guides"
                
                val request = Request.Builder()
                    .url(url)
                    .get()
                    .header("Accept", "application/json")
                    .build()
                
                val response = withContext(Dispatchers.IO) {
                    client.newCall(request).execute()
                }
                
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: ""
                    val result = json.decodeFromString<TourGuidesResponse>(body)
                    _tourGuides.value = result.tourGuides
                } else {
                    _error.value = "Errore nel caricamento delle guide"
                }
            } catch (e: Exception) {
                _error.value = "Errore di connessione: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    fun clearError() {
        _error.value = null
    }
}

