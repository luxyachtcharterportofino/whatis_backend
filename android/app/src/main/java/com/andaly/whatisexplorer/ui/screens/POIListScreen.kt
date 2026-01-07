package com.andaly.whatisexplorer.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.andaly.whatisexplorer.R
import com.andaly.whatisexplorer.ui.viewmodels.AppViewModel

/**
 * POI List Screen - Shows list of POIs
 * Based on iOS POIListView.swift
 */
@Composable
fun POIListScreen(
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
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(16.dp)
            )
        } else {
            // TODO: Implement LazyColumn with POI items
            Text(
                text = "POI List - ${pois.size} POIs",
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(16.dp)
            )
        }
    }
}

