package com.andaly.whatisexplorer.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.andaly.whatisexplorer.R
import com.andaly.whatisexplorer.ui.viewmodels.AppViewModel

/**
 * Map Screen - Shows POIs on map
 * Based on iOS MapView.swift
 */
@Composable
fun MapScreen(
    modifier: Modifier = Modifier,
    appViewModel: AppViewModel
) {
    val isLoading = appViewModel.isLoading.value
    val pois = appViewModel.pois.value
    
    Box(modifier = modifier.fillMaxSize()) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.align(Alignment.Center)
            )
        } else if (pois.isEmpty()) {
            Text(
                text = stringResource(R.string.no_pois_available),
                modifier = Modifier.align(Alignment.Center)
            )
        } else {
            // TODO: Implement Google Maps Compose integration
            Text(
                text = "Map View - ${pois.size} POIs",
                modifier = Modifier.align(Alignment.Center)
            )
        }
    }
}

