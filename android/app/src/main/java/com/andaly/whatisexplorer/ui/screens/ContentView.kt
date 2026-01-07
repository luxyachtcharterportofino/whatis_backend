package com.andaly.whatisexplorer.ui.screens

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import com.andaly.whatisexplorer.R
import com.andaly.whatisexplorer.ui.viewmodels.AppViewModel
import com.andaly.whatisexplorer.ui.viewmodels.ZonesViewModel

/**
 * Main Content View with Bottom Navigation
 * Based on iOS ContentView.swift
 */
@Composable
fun ContentView(
    appViewModel: AppViewModel = viewModel(),
    zonesViewModel: ZonesViewModel = viewModel()
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var showTourGuides by remember { mutableStateOf(false) }
    
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Map, contentDescription = null) },
                    label = { Text(stringResource(R.string.tab_map)) },
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.List, contentDescription = null) },
                    label = { Text(stringResource(R.string.tab_list)) },
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                    label = { Text(stringResource(R.string.tab_settings)) },
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 }
                )
            }
        }
    ) { paddingValues ->
        when (selectedTab) {
            0 -> MapScreen(
                modifier = Modifier.padding(paddingValues),
                appViewModel = appViewModel
            )
            1 -> POIListScreen(
                modifier = Modifier.padding(paddingValues),
                appViewModel = appViewModel
            )
            2 -> SettingsScreen(
                modifier = Modifier.padding(paddingValues),
                appViewModel = appViewModel,
                onShowTourGuides = { showTourGuides = true }
            )
        }
    }
    
    // Show zone selection if no zone is selected
    val currentZone = appViewModel.currentZone.value
    if (currentZone == null && !appViewModel.isLoading.value) {
        ZoneSelectionDialog(
            zonesViewModel = zonesViewModel,
            onZoneSelected = { zoneId ->
                appViewModel.loadZone(zoneId)
            }
        )
    }
    
    // Show tour guides screen (full screen overlay)
    if (showTourGuides && currentZone != null) {
        TourGuidesScreen(
            appViewModel = appViewModel,
            onDismiss = { showTourGuides = false }
        )
    }
}

