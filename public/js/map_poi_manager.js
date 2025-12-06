// =======================================================
// 🌊 Andaly Whatis — POI Manager
// =======================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ POI Manager loaded");

  // =======================================================
  // MAP CONTAINER GUARD
  // =======================================================
  const mapContainer = document.getElementById("map");
  if (!mapContainer) {
    console.log("⚠️ No map container found, skipping POI manager initialization");
    return;
  }

  // =======================================================
  // STATE MANAGEMENT
  // =======================================================
  
  let insertMode = false;
  let mapClickHandler = null;
  let poiLayer = null;

  // Initialize POI layer
  function initializePOILayer() {
    if (window.map && window.map._container) {
      poiLayer = new L.layerGroup();
      window.map.addLayer(poiLayer);
      console.log("POI layer initialized");
    } else {
      console.log("Map not ready, retrying...");
      setTimeout(initializePOILayer, 100);
    }
  }
  
  initializePOILayer();

  // =======================================================
  // UTILITY FUNCTIONS
  // =======================================================
  
  function setStatus(message, type = "info") {
    const statusBox = document.getElementById("zoneStatus");
    if (statusBox) {
      statusBox.textContent = message;
      statusBox.className = `status-box ${type}`;
      statusBox.style.display = "block";
      
      // Auto-hide after 3 seconds for success messages
      if (type === "ok") {
        setTimeout(() => {
          statusBox.style.display = "none";
        }, 3000);
      }
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  function isPointInZone(lat, lng, zoneLayer) {
    if (!zoneLayer || !zoneLayer.getLatLngs) {
      return false;
    }
    
    const point = L.latLng(lat, lng);
    const polygon = L.polygon(zoneLayer.getLatLngs()[0]);
    
    // First check if point is within bounds (quick check)
    if (!polygon.getBounds().contains(point)) {
      return false;
    }
    
    // Then use manual point-in-polygon algorithm
    return isPointInPolygon(point, polygon);
  }

  function isPointInPolygon(latlng, polygon) {
    const x = latlng.lat, y = latlng.lng;
    const vs = polygon.getLatLngs()[0];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i].lat, yi = vs[i].lng;
      const xj = vs[j].lat, yj = vs[j].lng;
      const intersect = ((yi > y) != (yj > y)) &&
                        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // =======================================================
  // POI CREATION AND MANAGEMENT
  // =======================================================
  
  async function createPOI(poiData) {
    try {
      const response = await fetch("/pois", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(poiData)
      });

      if (response.ok) {
        const newPOI = await response.json();
        addPOIMarker(newPOI);
        console.log(`✅ POI creato in zona ${window.selectedZone.name}`);
        setStatus("POI creato con successo!", "ok");
        return newPOI;
      } else {
        throw new Error("Errore server");
      }
    } catch (error) {
      console.error("Errore creazione POI:", error);
      setStatus("Errore durante la creazione del POI", "error");
    }
  }

  function addPOIMarker(poi) {
    const marker = L.marker([poi.lat, poi.lng], { 
      draggable: true,
      icon: L.divIcon({
        className: 'poi-marker',
        html: '<div style="background: #007bff; border: 2px solid #fff; border-radius: 50%; width: 16px; height: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).addTo(poiLayer);
    
    const popup = `
      <div style="min-width: 200px;">
        <h5 style="margin: 0 0 8px 0; color: #333;">${poi.name}</h5>
        <p style="margin: 0 0 12px 0; color: #666;">${poi.description || "Nessuna descrizione"}</p>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm btn-primary edit-poi" data-id="${poi._id}" style="flex: 1;">✏️ Modifica</button>
          <button class="btn btn-sm btn-danger delete-poi" data-id="${poi._id}" style="flex: 1;">🗑️ Elimina</button>
        </div>
      </div>
    `;
    
    marker.bindPopup(popup);
    marker.poiData = poi;
    
    // Drag handler
    marker.on("dragend", async (e) => {
      const newPos = e.target.getLatLng();
      await updatePOI(poi._id, {
        name: poi.name,
        description: poi.description,
        lat: newPos.lat,
        lng: newPos.lng,
        zone: poi.zone
      });
    });
    
    // Popup button handlers
    marker.on("popupopen", (e) => {
      const popup = e.popup.getElement();
      const editBtn = popup.querySelector(".edit-poi");
      const deleteBtn = popup.querySelector(".delete-poi");
      
      if (editBtn) {
        editBtn.onclick = () => editPOI(poi);
      }
      if (deleteBtn) {
        deleteBtn.onclick = () => deletePOI(poi);
      }
    });
  }

  async function updatePOI(id, data) {
    try {
      const response = await fetch(`/pois/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        setStatus("POI aggiornato!", "ok");
        window.map.closePopup();
        // Reload POIs for the current zone
        if (window.selectedZone) {
          loadPOIs(window.selectedZone.id);
        }
      } else {
        throw new Error("Errore server");
      }
    } catch (error) {
      console.error("Errore aggiornamento POI:", error);
      setStatus("Errore aggiornamento POI", "error");
    }
  }

  async function deletePOI(poi) {
    if (!confirm(`Eliminare il POI "${poi.name}"?`)) return;
    
    try {
      const response = await fetch(`/pois/${poi._id}`, { method: "DELETE" });
      
      if (response.ok) {
        setStatus("POI eliminato!", "ok");
        // Reload POIs for the current zone
        if (window.selectedZone) {
          loadPOIs(window.selectedZone.id);
        }
      } else {
        throw new Error("Errore server");
      }
    } catch (error) {
      console.error("Errore eliminazione POI:", error);
      setStatus("Errore eliminazione POI", "error");
    }
  }

  function editPOI(poi) {
    const newName = prompt("Nome del POI:", poi.name);
    if (newName === null) return;
    
    const newDescription = prompt("Descrizione del POI:", poi.description || "");
    if (newDescription === null) return;
    
    updatePOI(poi._id, {
      name: newName,
      description: newDescription,
      lat: poi.lat,
      lng: poi.lng,
      zone: poi.zone
    });
  }

  // =======================================================
  // POI LOADING
  // =======================================================
  
  async function loadPOIs(zoneId) {
    try {
      poiLayer.clearLayers();
      const response = await fetch(`/pois?zone=${zoneId}&format=json`);
      const pois = await response.json();
      
      pois.forEach(poi => addPOIMarker(poi));
      setStatus(`POI caricati: ${pois.length}`, "ok");
    } catch (error) {
      console.error("Errore caricamento POI:", error);
      setStatus("Errore nel caricamento dei POI", "error");
    }
  }

  // =======================================================
  // INSERTION MODE MANAGEMENT
  // =======================================================
  
  function enableInsertMode() {
    if (!window.selectedZone) {
      alert("Seleziona prima una zona");
      return false;
    }
    
    insertMode = true;
    
    // Remove any existing click handler
    if (mapClickHandler) {
      window.map.off('click', mapClickHandler);
    }
    
    // Add new click handler
    mapClickHandler = async (e) => {
      console.log("Map click event:", e);
      console.log("Event latlng:", e.latlng);
      
      // Safely extract coordinates
      const lat = e.latlng ? e.latlng.lat : null;
      const lng = e.latlng ? e.latlng.lng : null;
      
      console.log("Extracted coordinates:", { lat, lng });
      
      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
        console.error("Invalid coordinates:", { lat, lng });
        setStatus("Errore: coordinate non valide", "error");
        return;
      }
      
      // Check if click is inside selected zone
      if (!isPointInZone(lat, lng, window.selectedZone.layer)) {
        alert("Clicca dentro la zona selezionata");
        return;
      }
      
      // Create POI
      await createPOI({
        name: "Nuovo POI",
        description: "",
        lat,
        lng,
        zone: window.selectedZone.id
      });
    };
    
    if (window.map && window.map.on) {
      window.map.on('click', mapClickHandler);
      setStatus("Modalità inserimento POI attiva. Clicca sulla mappa DENTRO la zona selezionata.", "info");
      return true;
    } else {
      console.error("Map not available for click handler");
      setStatus("Errore: mappa non disponibile", "error");
      return false;
    }
  }

  function disableInsertMode() {
    insertMode = false;
    
    // Remove click handler
    if (mapClickHandler && window.map && window.map.off) {
      window.map.off('click', mapClickHandler);
      mapClickHandler = null;
    }
    
    setStatus("Modalità inserimento POI disattivata", "info");
  }

  // =======================================================
  // ZONE SELECTION MODAL
  // =======================================================
  
  function showZoneSelectionModal() {
    // Load zones into the modal
    loadZonesForModal();
    
    // Update modal title based on context
    const modalTitle = document.getElementById('zoneSelectionModalLabel');
    if (window.pendingAutoImport) {
      modalTitle.textContent = '🗺️ Seleziona una Zona per Import Automatico';
    } else {
      modalTitle.textContent = '🗺️ Seleziona una Zona per Inserire POI';
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('zoneSelectionModal'));
    modal.show();
  }
  
  async function loadZonesForModal() {
    try {
      const response = await fetch('/admin/zones?format=json');
      const zones = await response.json();
      
      const zoneSelect = document.getElementById('zoneSelect');
      zoneSelect.innerHTML = '';
      
      if (zones.length === 0) {
        zoneSelect.innerHTML = '<option value="">Nessuna zona disponibile</option>';
        return;
      }
      
      zones.forEach(zone => {
        const option = document.createElement('option');
        option.value = zone._id;
        option.textContent = `${zone.name}${zone.description ? ' - ' + zone.description : ''}`;
        zoneSelect.appendChild(option);
      });
      
    } catch (error) {
      console.error('Errore caricamento zone:', error);
      const zoneSelect = document.getElementById('zoneSelect');
      zoneSelect.innerHTML = '<option value="">Errore nel caricamento delle zone</option>';
    }
  }
  
  function confirmZoneSelection() {
    const zoneSelect = document.getElementById('zoneSelect');
    const selectedZoneId = zoneSelect.value;
    
    if (!selectedZoneId) {
      alert('Seleziona una zona dalla lista');
      return;
    }
    
    // Find the zone in the map layers
    const zoneLayer = findZoneLayerById(selectedZoneId);
    if (!zoneLayer) {
      alert('Zona non trovata nella mappa');
      return;
    }
    
    // Select the zone
    selectZoneFromModal(zoneLayer, selectedZoneId);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('zoneSelectionModal'));
    modal.hide();
    
    // Check if we need to trigger auto import after zone selection
    if (window.pendingAutoImport) {
      window.pendingAutoImport = false;
      // Trigger the auto import function (solo se il pulsante esiste)
      const btnAutoImportPOI = document.getElementById("btnAutoImportPOI");
      if (btnAutoImportPOI) {
        btnAutoImportPOI.click();
      }
    } else {
      // Now enable insert mode
      if (enableInsertMode()) {
        document.getElementById("btnInserisciPOI").classList.add("btn-primary");
        document.getElementById("btnInserisciPOI").textContent = "✏️ Inserisci POI (ATTIVO)";
      }
    }
  }
  
  function findZoneLayerById(zoneId) {
    // This function should find the zone layer by ID
    // We need to check how zones are stored in the map
    if (window.drawnItems) {
      let foundLayer = null;
      window.drawnItems.eachLayer((layer) => {
        if (layer.zoneId === zoneId) {
          foundLayer = layer;
        }
      });
      return foundLayer;
    }
    return null;
  }
  
  function selectZoneFromModal(zoneLayer, zoneId) {
    // Set the selected zone globally
    window.selectedZone = {
      id: zoneId,
      layer: zoneLayer
    };
    
    // Update status
    setStatus(`Zona selezionata: ${zoneLayer.zoneName || 'Zona ' + zoneId}`, "ok");
    
    // Highlight the zone on the map
    if (zoneLayer.setStyle) {
      zoneLayer.setStyle({ color: "#ff6b35", weight: 3, fillOpacity: 0.4 });
    }
    
    // Also call the global selectZone function if it exists
    if (typeof selectZone === 'function') {
      selectZone(zoneLayer);
    }
  }
  
  // Event listeners for zone selection modal
  document.getElementById('confirmZoneSelection').addEventListener('click', confirmZoneSelection);
  
  // Allow double-click on zone options to select quickly
  document.getElementById('zoneSelect').addEventListener('dblclick', confirmZoneSelection);

  // =======================================================
  // BUTTON HANDLERS
  // =======================================================
  
  // Inserisci POI button
  document.getElementById("btnInserisciPOI").addEventListener("click", () => {
    if (!insertMode) {
      // Check if a zone is selected
      if (!window.selectedZone) {
        showZoneSelectionModal();
        return;
      }
      
      if (enableInsertMode()) {
        document.getElementById("btnInserisciPOI").classList.add("btn-primary");
        document.getElementById("btnInserisciPOI").textContent = "✏️ Inserisci POI (ATTIVO)";
      }
    } else {
      disableInsertMode();
      document.getElementById("btnInserisciPOI").classList.remove("btn-primary");
      document.getElementById("btnInserisciPOI").textContent = "+ Inserisci POI";
    }
  });

  // Ricevi POI automatici (solo se il pulsante esiste)
  const btnAutoImportPOI = document.getElementById("btnAutoImportPOI");
  if (btnAutoImportPOI) {
    btnAutoImportPOI.addEventListener("click", async () => {
    if (!window.selectedZone) {
      window.pendingAutoImport = true;
      showZoneSelectionModal();
      return;
    }
    
    setStatus("Generazione POI automatici...", "info");
    
    const zoneBounds = window.selectedZone.layer.getBounds();
    const generateRandomPointInZone = () => {
      let lat, lng;
      let attempts = 0;
      do {
        lat = zoneBounds.getSouth() + Math.random() * (zoneBounds.getNorth() - zoneBounds.getSouth());
        lng = zoneBounds.getWest() + Math.random() * (zoneBounds.getEast() - zoneBounds.getWest());
        attempts++;
      } while (!isPointInZone(lat, lng, window.selectedZone.layer) && attempts < 50);
      
      return { lat, lng };
    };
    
    for (let i = 0; i < 2; i++) {
      const { lat, lng } = generateRandomPointInZone();
      await createPOI({
        name: `POI Automatico ${i + 1}`,
        description: "Generato automaticamente",
        lat,
        lng,
        zone: window.selectedZone.id
      });
    }
    
    setStatus("POI automatici generati con successo!", "ok");
    });
  }

  // Visualizza tabella POI
  document.getElementById("btnVisualizzaTabella").addEventListener("click", () => {
    if (window.selectedZone) {
      // Usa l'ID corretto della zona (stesso formato di map_manager.js)
      const zoneId = window.selectedZone.zoneId || window.selectedZone._id || window.selectedZone.id;
      console.log(`📍 Opening POI table for zone: ${zoneId}`);
      window.open(`/admin/pois?zone=${zoneId}`, '_blank');
    } else {
      console.log('📍 No zone selected, opening all POIs');
      window.open('/admin/pois', '_blank');
    }
  });

  // Salva ed Esci (solo se il pulsante esiste)
  const btnSalvaEsci = document.getElementById("btnSalvaEsci");
  if (btnSalvaEsci) {
    btnSalvaEsci.addEventListener("click", () => {
    setStatus("Salvataggio completato. Reindirizzamento...", "ok");
    setTimeout(() => {
      window.location.href = "/admin/zones";
    }, 1000);
    });
  }

  // =======================================================
  // ZONE SELECTION INTEGRATION
  // =======================================================
  
  // Listen for zone selection changes
  if (window.zoneSelectionCallbacks) {
    window.zoneSelectionCallbacks.push((zone) => {
      if (zone) {
        loadPOIs(zone.id);
      } else {
        poiLayer.clearLayers();
      }
    });
  }

  // =======================================================
  // INITIALIZATION
  // =======================================================
  
  setStatus("POI Manager pronto", "ok");
});
