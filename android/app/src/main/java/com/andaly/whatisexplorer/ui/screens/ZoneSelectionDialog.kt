package com.andaly.whatisexplorer.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.andaly.whatisexplorer.R
import com.andaly.whatisexplorer.ui.viewmodels.ZonesViewModel

/**
 * Zone Selection Dialog
 * Based on iOS ZoneSelectionView.swift
 */
@Composable
fun ZoneSelectionDialog(
    zonesViewModel: ZonesViewModel,
    onZoneSelected: (String) -> Unit
) {
    LaunchedEffect(Unit) {
        zonesViewModel.loadZones()
    }
    
    val zones = zonesViewModel.zones.value
    val isLoading = zonesViewModel.isLoading.value
    
    Dialog(onDismissRequest = { /* Can't dismiss - zone required */ }) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.select_zone),
                style = androidx.compose.material3.MaterialTheme.typography.headlineSmall
            )
            
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .padding(16.dp)
                )
            } else if (zones.isEmpty()) {
                Text(
                    text = stringResource(R.string.no_zones_available),
                    modifier = Modifier.padding(16.dp)
                )
            } else {
                LazyColumn {
                    items(zones) { zone ->
                        Button(
                            onClick = { onZoneSelected(zone.id) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                        ) {
                            Text(zone.name)
                        }
                    }
                }
            }
        }
    }
}

