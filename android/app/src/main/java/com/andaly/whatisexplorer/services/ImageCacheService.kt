package com.andaly.whatisexplorer.services

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.URL

/**
 * Image Cache Service for caching POI images
 * Based on iOS ImageCacheService.swift
 */
class ImageCacheService private constructor(private val context: Context) {
    
    companion object {
        private const val CACHE_SIZE = 50 * 1024 * 1024 // 50MB
        private const val DISK_CACHE_SUBDIR = "poi_images"
        
        @Volatile
        private var INSTANCE: ImageCacheService? = null
        
        fun getInstance(context: Context): ImageCacheService {
            return INSTANCE ?: synchronized(this) {
                val instance = ImageCacheService(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }
    }
    
    private val memoryCache: LruCache<String, Bitmap> = LruCache<String, Bitmap>(
        (CACHE_SIZE / 1024).toInt()
    ) { _, bitmap ->
        bitmap.byteCount / 1024
    }
    
    private val diskCacheDir: File = File(context.cacheDir, DISK_CACHE_SUBDIR).apply {
        if (!exists()) {
            mkdirs()
        }
    }
    
    private fun getDiskCacheFile(url: String): File {
        val filename = url.hashCode().toString()
        return File(diskCacheDir, filename)
    }
    
    suspend fun getImage(url: String): Bitmap? = withContext(Dispatchers.IO) {
        // Check memory cache first
        memoryCache.get(url)?.let { return@withContext it }
        
        // Check disk cache
        val diskFile = getDiskCacheFile(url)
        if (diskFile.exists()) {
            val bitmap = BitmapFactory.decodeFile(diskFile.absolutePath)
            bitmap?.let {
                memoryCache.put(url, it)
                return@withContext it
            }
        }
        
        // Download and cache
        try {
            val bitmap = BitmapFactory.decodeStream(URL(url).openStream())
            bitmap?.let {
                // Save to memory cache
                memoryCache.put(url, it)
                
                // Save to disk cache
                FileOutputStream(diskFile).use { out ->
                    it.compress(Bitmap.CompressFormat.JPEG, 90, out)
                }
                
                return@withContext it
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        
        null
    }
    
    fun clearCache() {
        memoryCache.evictAll()
        diskCacheDir.listFiles()?.forEach { it.delete() }
    }
}

