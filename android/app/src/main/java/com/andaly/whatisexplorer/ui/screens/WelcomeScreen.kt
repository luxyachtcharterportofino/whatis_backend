package com.andaly.whatisexplorer.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.andaly.whatisexplorer.ui.viewmodels.AppViewModel
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts

/**
 * Welcome Screen - Elegant introduction to the app
 * Based on iOS WelcomeView.swift
 */
@Composable
fun WelcomeScreen(
    onDismiss: () -> Unit,
    onShowTourGuides: () -> Unit,
    onStartExploration: () -> Unit = {},
    appViewModel: AppViewModel = viewModel()
) {
    val context = LocalContext.current
    
    // ✅ Launcher per richiedere permessi runtime
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Gestisci il risultato delle richieste permessi
        permissions.entries.forEach {
            val permission = it.key
            val isGranted = it.value
            if (isGranted) {
                android.util.Log.d("WelcomeScreen", "✅ Permesso $permission concesso")
            } else {
                android.util.Log.w("WelcomeScreen", "⚠️ Permesso $permission negato")
            }
        }
    }
    
    // ✅ Richiedi automaticamente i permessi all'avvio (solo se non già concessi)
    LaunchedEffect(Unit) {
        val permissionsToRequest = mutableListOf<String>()
        
        // Controlla permesso location
        val hasLocationPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        if (!hasLocationPermission) {
            permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
            android.util.Log.d("WelcomeScreen", "📍 Richiesta automatica autorizzazione location...")
        }
        
        // Controlla permesso camera
        val hasCameraPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        
        if (!hasCameraPermission) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
            android.util.Log.d("WelcomeScreen", "📷 Richiesta automatica autorizzazione camera...")
        }
        
        // Richiedi i permessi se necessario
        if (permissionsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }
    val currentZone = appViewModel.currentZone.collectAsState().value
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
            
            // Title con bordo dorato
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color.Transparent
                ),
                border = BorderStroke(
                    width = 3.dp,
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color(0xFFFFD700),  // Oro
                            Color(0xFFDAA520)   // Oro scuro
                        )
                    )
                )
            ) {
                Text(
                    text = "Whatis Explorer",
                    fontSize = 42.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFFFD700),  // Testo dorato
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    textAlign = TextAlign.Center
                )
            }
            
            Text(
                text = "Scopri i luoghi come non li hai mai visti.",
                fontSize = 20.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White.copy(alpha = 0.9f),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 30.dp)
                    .padding(top = 8.dp),
                textAlign = TextAlign.Center
            )
            
            // Contenuto in un'unica cornice
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color.White.copy(alpha = 0.1f)
                ),
                border = BorderStroke(
                    width = 2.dp,
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color(0xFFFFD700),  // Oro
                            Color(0xFFDAA520)   // Oro scuro
                        )
                    )
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    WelcomeContentSection(
                        title = "Guida Intelligente",
                        content = "Whatis Explorer è una guida intelligente che ti accompagna nel territorio mentre lo vivi. Grazie all'intelligenza artificiale e alla geolocalizzazione, ti mostra storie, luoghi e curiosità intorno a te, in tempo reale."
                    )
                    
                    WelcomeContentSection(
                        title = "Non è una semplice mappa",
                        content = "È un modo nuovo di capire ciò che stai guardando."
                    )
                    
                    WelcomeContentSection(
                        title = "La tecnologia ti guida",
                        content = "La tecnologia ti guida, ma il cuore dell'esperienza resta umano: le guide turistiche professionali, con la loro passione e conoscenza, rendono ogni viaggio unico."
                    )
                    
                    WelcomeContentSection(
                        title = "Whatis Explorer nasce per affiancarle",
                        content = "Whatis Explorer nasce per affiancarle, e per rendere ogni scoperta più profonda, più vera, più memorabile."
                    )
                    
                    WelcomeContentSection(
                        title = "Guide Turistiche Locali",
                        content = "Se desideri vivere il territorio con l'aiuto di professionisti locali, puoi anche accedere a una selezione delle migliori organizzazioni di guide turistiche autorizzate della zona."
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(30.dp))
            
            // Footer con effetto dorato
            Text(
                text = "Esplora. Comprendi. Vivi.",
                fontSize = 24.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFFFFD700),  // Oro
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 20.dp),
                textAlign = TextAlign.Center
            )
            
            // Start Button con bordo dorato (PRIMA)
            Button(
                onClick = onStartExploration,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .shadow(8.dp, RoundedCornerShape(12.dp)),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White.copy(alpha = 0.15f)
                ),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(
                    width = 2.dp,
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color(0xFFFFD700),  // Oro
                            Color(0xFFDAA520)   // Oro scuro
                        )
                    )
                )
            ) {
                Text(
                    "Inizia l'Esplorazione",
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Tour Guides Button (DOPO) - Sempre visibile
            Button(
                onClick = onShowTourGuides,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .shadow(10.dp, RoundedCornerShape(12.dp)),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Transparent
                ),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(
                    width = 1.5.dp,
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.3f),
                            Color.White.copy(alpha = 0.1f)
                        )
                    )
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(
                                    Color(0xFFFFD700),  // Oro
                                    Color(0xFFDAA520)   // Oro scuro
                                )
                            )
                        )
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Group,
                        contentDescription = null,
                        tint = Color(0xFF0D2449)  // Testo blu marino scuro
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "Scopri le Guide Turistiche",
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF0D2449)  // Testo blu marino scuro
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(40.dp))
        }
    }
}

@Composable
fun WelcomeContentSection(
    title: String,
    content: String
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = title,
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFFFFD700),  // Oro
            modifier = Modifier.padding(top = 4.dp)
        )
        
        Text(
            text = content,
            fontSize = 16.sp,
            fontWeight = FontWeight.Normal,
            color = Color.White.copy(alpha = 0.9f),
            lineHeight = 24.sp
        )
    }
}

