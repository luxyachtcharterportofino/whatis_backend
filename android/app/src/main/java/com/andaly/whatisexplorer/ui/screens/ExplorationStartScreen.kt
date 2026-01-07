package com.andaly.whatisexplorer.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.andaly.whatisexplorer.models.Zone
import com.andaly.whatisexplorer.ui.viewmodels.AppViewModel
import com.andaly.whatisexplorer.ui.viewmodels.ZonesViewModel

/**
 * Exploration Start Screen - Choose how to start exploring
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExplorationStartScreen(
    appViewModel: AppViewModel = viewModel(),
    zonesViewModel: ZonesViewModel = viewModel(),
    onDismiss: () -> Unit
) {
    var showingZoneSelection by remember { mutableStateOf(false) }
    var showingDownloadedZones by remember { mutableStateOf(false) }
    var isDetectingCurrentZone by remember { mutableStateOf(false) }
    var detectedZone by remember { mutableStateOf<Zone?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    
    val currentLocation = appViewModel.currentLocation.collectAsState().value
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF051A33),  // Blu marino molto molto scuro
                        Color(0xFF0D1F3D),  // Blu marino molto scuro
                        Color(0xFF122547)   // Blu marino scuro
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
        ) {
            Spacer(modifier = Modifier.height(40.dp))
            
            // Title
            Text(
                text = "Inizia l'Esplorazione",
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFFFD700),  // Oro
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 30.dp)
            )
            
            // Option 1: Browse available zones
            ExplorationOptionCard(
                icon = Icons.Default.Map,
                title = "Sfoglia Zone Disponibili",
                description = "Visualizza tutte le zone disponibili e scegli quella che vuoi esplorare",
                onClick = { showingZoneSelection = true }
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Option 2: Download current zone
            if (currentLocation != null) {
                ExplorationOptionCard(
                    icon = Icons.Default.LocationOn,
                    title = "Scarica Zona Corrente",
                    description = "Scarica la zona dove ti trovi in questo momento",
                    isLoading = isDetectingCurrentZone,
                    onClick = {
                        // TODO: Implement zone detection
                        errorMessage = "Rilevamento zona in arrivo"
                    }
                )
            } else {
                ExplorationOptionCard(
                    icon = Icons.Default.LocationOff,
                    title = "Zona Corrente",
                    description = "Abilita la geolocalizzazione per scaricare automaticamente la zona dove ti trovi",
                    isDisabled = true,
                    onClick = {
                        // Request location permission
                    }
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Option 3: Use downloaded zones
            LaunchedEffect(Unit) {
                // Check for downloaded zones
                // TODO: Implement check
            }
            
            ExplorationOptionCard(
                icon = Icons.Default.Download,
                title = "Usa Zona Scaricata",
                description = "Scegli tra le zone che hai già scaricato",
                onClick = { showingDownloadedZones = true }
            )
            
            // Error message
            if (errorMessage != null) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = errorMessage ?: "",
                    color = Color.Red,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding()
                        .background(Color.Red.copy(alpha = 0.1f))
                        .padding(.horizontal)
                )
            }
            
            Spacer(modifier = Modifier.height(40.dp))
        }
    }
    
    // Show zone selection dialog
    if (showingZoneSelection) {
        ZoneSelectionDialog(
            zonesViewModel = zonesViewModel,
            onZoneSelected = { zoneId ->
                appViewModel.loadZone(zoneId)
                showingZoneSelection = false
                onDismiss()
            }
        )
    }
}

@Composable
fun ExplorationOptionCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    description: String,
    isLoading: Boolean = false,
    isDisabled: Boolean = false,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.1f)
        ),
        border = androidx.compose.foundation.BorderStroke(
            width = 2.dp,
            brush = Brush.linearGradient(
                colors = listOf(
                    Color(0xFFFFD700).copy(alpha = if (isDisabled) 0.3f else 0.6f),
                    Color(0xFFDAA520).copy(alpha = if (isDisabled) 0.2f else 0.4f)
                )
            )
        ),
        onClick = onClick,
        enabled = !isLoading && !isDisabled
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (isDisabled) Color.Gray else Color(0xFFFFD700),
                modifier = Modifier.size(32.dp)
            )
            
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
                
                Text(
                    text = description,
                    fontSize = 14.sp,
                    color = Color.White.copy(alpha = 0.8f)
                )
            }
            
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = Color.White
                )
            } else {
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.6f)
                )
            }
        }
    }
}

