package com.andaly.whatisexplorer.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.andaly.whatisexplorer.models.TourGuide
import com.andaly.whatisexplorer.ui.viewmodels.AppViewModel
import com.andaly.whatisexplorer.ui.viewmodels.TourGuidesViewModel

/**
 * Tour Guides Screen - Shows list of tour guides for current zone
 * Based on iOS TourGuidesView.swift
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TourGuidesScreen(
    zoneId: String? = null,
    zoneName: String? = null,
    appViewModel: AppViewModel = viewModel(),
    tourGuidesViewModel: TourGuidesViewModel = viewModel(),
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val currentZone = appViewModel.currentZone.value
    
    // Usa zoneId passato come parametro, altrimenti fallback su currentZone
    val targetZoneId = zoneId ?: currentZone?.id
    
    LaunchedEffect(targetZoneId) {
        targetZoneId?.let { zId ->
            tourGuidesViewModel.loadTourGuides(zId)
        }
    }
    
    val tourGuides = tourGuidesViewModel.tourGuides.value
    val isLoading = tourGuidesViewModel.isLoading.value
    val errorMessage = tourGuidesViewModel.error.value
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(zoneName ?: "Guide Turistiche") },
                navigationIcon = {
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Chiudi")
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                isLoading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                
                errorMessage != null -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = errorMessage ?: "Errore",
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
                
                tourGuides.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            Icons.Default.Group,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Nessuna guida turistica disponibile per questa zona",
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                }
                
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(
                            items = tourGuides,
                            key = { guide -> guide.id }
                        ) { guide ->
                            TourGuideCard(
                                guide = guide,
                                onWebsiteClick = { website ->
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(website))
                                    context.startActivity(intent)
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TourGuideCard(
    guide: TourGuide,
    onWebsiteClick: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = guide.name,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            
            if (!guide.description.isNullOrEmpty()) {
                Text(
                    text = guide.description ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
            }
            
            if (!guide.phone.isNullOrEmpty()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Default.Phone,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        text = guide.phone ?: "",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
            
            if (!guide.email.isNullOrEmpty()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Default.Email,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        text = guide.email ?: "",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
            
            OutlinedButton(
                onClick = { onWebsiteClick(guide.website) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(
                    Icons.Default.Language,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Visita il sito web")
            }
        }
    }
}

