package com.andaly.whatisexplorer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.andaly.whatisexplorer.ui.screens.ContentView
import com.andaly.whatisexplorer.ui.screens.ExplorationStartScreen
import com.andaly.whatisexplorer.ui.screens.WelcomeScreen
import com.andaly.whatisexplorer.ui.theme.WhatisExplorerTheme
import com.andaly.whatisexplorer.ui.viewmodels.AppViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            WhatisExplorerTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val appViewModel: AppViewModel = viewModel()
                    var showWelcome by remember { mutableStateOf(true) } // Always show welcome on launch
                    var showExplorationStart by remember { mutableStateOf(false) }
                    var showZoneSelectionForTourGuides by remember { mutableStateOf(false) }
                    var selectedZoneForTourGuides by remember { mutableStateOf<Pair<String, String>?>(null) } // zoneId, zoneName
                    
                    when {
                        // Show TourGuidesScreen when a zone is selected
                        selectedZoneForTourGuides != null -> {
                            val (zoneId, zoneName) = selectedZoneForTourGuides!!
                            com.andaly.whatisexplorer.ui.screens.TourGuidesScreen(
                                zoneId = zoneId,
                                zoneName = zoneName,
                                appViewModel = appViewModel,
                                onDismiss = {
                                    selectedZoneForTourGuides = null
                                    showZoneSelectionForTourGuides = false
                                }
                            )
                        }
                        
                        showZoneSelectionForTourGuides -> {
                            com.andaly.whatisexplorer.ui.screens.ZoneSelectionForTourGuidesScreen(
                                onDismiss = { showZoneSelectionForTourGuides = false },
                                onZoneSelected = { zoneId, zoneName ->
                                    selectedZoneForTourGuides = Pair(zoneId, zoneName)
                                }
                            )
                        }
                        
                        showWelcome -> {
                            WelcomeScreen(
                                onDismiss = { showWelcome = false },
                                onShowTourGuides = {
                                    showZoneSelectionForTourGuides = true
                                },
                                onStartExploration = { showExplorationStart = true },
                                appViewModel = appViewModel
                            )
                        }
                        
                        showExplorationStart -> {
                            ExplorationStartScreen(
                                appViewModel = appViewModel,
                                onDismiss = { 
                                    showExplorationStart = false
                                    if (appViewModel.currentZone.value != null) {
                                        showWelcome = false
                                    }
                                }
                            )
                        }
                        
                        else -> {
                            ContentView(appViewModel = appViewModel)
                        }
                    }
                }
            }
        }
    }
}

