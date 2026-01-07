package com.andaly.whatisexplorer.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Group
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.andaly.whatisexplorer.R
import com.andaly.whatisexplorer.ui.viewmodels.AppViewModel

/**
 * Settings Screen
 * Based on iOS SettingsView.swift
 */
@Composable
fun SettingsScreen(
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel,
    onShowTourGuides: () -> Unit = {}
) {
    val isOfflineMode = appViewModel.isOfflineMode.value
    val currentZone = appViewModel.currentZone.value
    
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = stringResource(R.string.settings),
            style = androidx.compose.material3.MaterialTheme.typography.headlineMedium
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // Offline mode indicator
        Card(
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    text = if (isOfflineMode) "Modalità Offline Attiva" else "Connesso",
                    style = androidx.compose.material3.MaterialTheme.typography.titleMedium
                )
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Tour Guides Button
        if (currentZone != null) {
            Button(
                onClick = onShowTourGuides,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    Icons.Default.Group,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Guide Turistiche")
            }
        }
    }
}

