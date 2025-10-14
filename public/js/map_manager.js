// =======================================================
// 🌊 Andaly Whatis — Complete Map Management System
// =======================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Andaly Whatis Map Manager loaded");

  // =======================================================
  // MAP CONTAINER GUARD
  // =======================================================
  const mapContainer = document.getElementById("map");
  if (!mapContainer) {
    console.log("⚠️ No map container found, skipping map initialization");
    return;
  }

  // =======================================================
  // GLOBAL STATE & INITIALIZATION
  // =======================================================
  
  let map;
  let selectedZone = null;
  let insertMode = false;
  let editMode = false;
  let drawActive = false;
  let drawControl = null;
  let drawnItems = null;
  let currentLayer = null;
  let poiLayer = null;
  let editHandler = null;
  let poiCountLayer = null;
  let allPOIs = [];

  // Initialize map
  map = L.map("map").setView([44.3, 9.2], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // Initialize layers
  drawnItems = new L.FeatureGroup();
  poiLayer = new L.layerGroup();
  poiCountLayer = new L.layerGroup();
  map.addLayer(drawnItems);
  map.addLayer(poiLayer);
  map.addLayer(poiCountLayer);

  // Global state
  window.map = map;
  window.selectedZone = null;

  // =======================================================
  // STATUS MANAGEMENT
  // =======================================================
  
  // Helper function to get Bootstrap color values
  function getBootstrapColor(colorName) {
    const colors = {
      'primary': '#007bff',
      'secondary': '#6c757d',
      'success': '#28a745',
      'danger': '#dc3545',
      'warning': '#ffc107',
      'info': '#17a2b8',
      'light': '#f8f9fa',
      'dark': '#343a40',
      'purple': '#6f42c1'
    };
    return colors[colorName] || colors['secondary'];
  }
  
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

  // =======================================================
  // POI COUNT VISUALIZATION
  // =======================================================
  
  async function loadAllPOIs() {
    try {
      const response = await fetch("/pois?format=json");
      allPOIs = await response.json();
      console.log("✅ All POIs loaded:", allPOIs.length);
      updateZonePOICounts();
    } catch (error) {
      console.error("Errore caricamento POI globali:", error);
    }
  }
  
  function updateZonePOICounts() {
    // Clear existing count labels
    poiCountLayer.clearLayers();
    
    // Get all zone layers from drawnItems
    drawnItems.eachLayer((zoneLayer) => {
      if (zoneLayer.zoneId) {
        const poiCount = allPOIs.filter(poi => poi.zone === zoneLayer.zoneId).length;
        
        if (poiCount > 0) {
          // Calculate zone centroid
          const bounds = zoneLayer.getBounds();
          const center = bounds.getCenter();
          
          // Create POI count label
          const countIcon = L.divIcon({
            className: 'poi-count-label',
            html: `<div class="poi-count-badge">${poiCount}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          
          const countMarker = L.marker([center.lat, center.lng], {
            icon: countIcon,
            interactive: false
          });
          
          poiCountLayer.addLayer(countMarker);
        }
      }
    });
  }
  
  function refreshPOICounts() {
    loadAllPOIs();
  }

  // =======================================================
  // ZONE MANAGEMENT
  // =======================================================
  
  async function loadZones() {
    try {
      const response = await fetch("/zones");
      const zones = await response.json();
      
      // Clear existing zones
      drawnItems.clearLayers();
      
      zones.forEach(zone => {
        const polygon = L.polygon(zone.coordinates, {
          color: "#007bff",
          weight: 2,
          fillOpacity: 0.1
        });
        
        polygon.zoneId = zone._id;
        polygon.zoneName = zone.name;
        polygon.zoneDescription = zone.description;
        
        // Click handler for zone selection
        polygon.on("click", (e) => {
          e.originalEvent.stopPropagation();
          
          // Check if POI insertion mode is active
          if (insertMode) {
            // In POI mode: just select the zone for POI insertion
            selectZone(polygon);
            setStatus(`Zona selezionata per inserimento POI: ${polygon.zoneName}`, "info");
            console.log("[INFO] Modalità POI attiva - zona selezionata per inserimento");
            return; // Don't show popup
          }
          
          // Normal mode: show zone management popup
          showZonePopup(e, polygon);
        });
        
        drawnItems.addLayer(polygon);
      });
      
      setStatus(`Zone caricate: ${zones.length}`, "ok");
      
      // Update POI counts after zones are loaded
      updateZonePOICounts();
    } catch (error) {
      console.error("Errore caricamento zone:", error);
      setStatus("Errore nel caricamento delle zone", "error");
    }
  }

  function selectZone(zoneLayer) {
    // Deselect previous zone
    if (selectedZone && selectedZone !== zoneLayer) {
      selectedZone.setStyle({ color: "#007bff", weight: 2 });
    }
    
    // Select new zone
    selectedZone = zoneLayer;
    
    // Different styling based on mode
    if (insertMode) {
      // POI insertion mode: green highlight
      zoneLayer.setStyle({ color: "#28a745", weight: 3 });
    } else {
      // Normal mode: yellow highlight
      zoneLayer.setStyle({ color: "#ffd700", weight: 3 });
    }
    
    window.selectedZone = {
      id: zoneLayer.zoneId,
      name: zoneLayer.zoneName,
      layer: zoneLayer
    };
    
    setStatus(`Zona selezionata: ${zoneLayer.zoneName}`, "ok");
    loadPOIs(zoneLayer.zoneId);
  }

  function deselectZone() {
    if (selectedZone) {
      selectedZone.setStyle({ color: "#007bff", weight: 2 });
      selectedZone = null;
      window.selectedZone = null;
      poiLayer.clearLayers();
      setStatus("Zona deselezionata", "info");
      updatePOICounter(null, 0);
    }
  }

  // =======================================================
  // POI COUNTER MANAGEMENT
  // =======================================================
  
  function updatePOICounter(zoneId, count) {
    const counterDiv = document.getElementById('poiCounter');
    const countSpan = document.getElementById('poiCount');
    
    if (!counterDiv || !countSpan) {
      console.log('⚠️ POI counter elements not found');
      return;
    }
    
    if (!zoneId) {
      counterDiv.style.display = 'none';
      return;
    }

    countSpan.textContent = count;
    counterDiv.style.display = 'block';
    
    console.log(`📍 POI Count for zone ${zoneId}: ${count}`);
  }

  // =======================================================
  // PROGRESS BAR MANAGEMENT
  // =======================================================
  
  function showProgress(text, percent = 0) {
    const container = document.getElementById('progressContainer');
    const textEl = document.getElementById('progressText');
    const percentEl = document.getElementById('progressPercent');
    const barEl = document.getElementById('progressBar');
    
    if (!container || !textEl || !percentEl || !barEl) {
      console.log('⚠️ Progress bar elements not found');
      return;
    }
    
    textEl.textContent = text;
    percentEl.textContent = `${percent}%`;
    barEl.style.width = `${percent}%`;
    barEl.setAttribute('aria-valuenow', percent);
    container.style.display = 'block';
  }
  
  function hideProgress() {
    const container = document.getElementById('progressContainer');
    if (container) {
      container.style.display = 'none';
    }
  }

  // =======================================================
  // POI MANAGEMENT
  // =======================================================
  
  async function loadPOIs(zoneId) {
    try {
      poiLayer.clearLayers();
      const response = await fetch(`/pois?zone=${zoneId}&format=json`);
      const pois = await response.json();
      
      pois.forEach(poi => createPOIMarker(poi));
      setStatus(`POI caricati: ${pois.length}`, "ok");
      
      // Update POI counter in sidebar
      updatePOICounter(zoneId, pois.length);
    } catch (error) {
      console.error("Errore caricamento POI:", error);
      setStatus("Errore nel caricamento dei POI", "error");
      updatePOICounter(zoneId, 0);
    }
  }

  function createPOIMarker(poi) {
    // Get effective icon (customIcon > arIcon > category default)
    const effectiveIcon = poi.customIcon || poi.arIcon || getCategoryLabel(poi.category || 'other').icon;
    
    const marker = L.marker([poi.lat, poi.lng], { 
      draggable: true,
      icon: L.divIcon({
        className: 'poi-marker-icon',
        html: `<div style="background: #fff; border: 3px solid #007bff; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.4); font-size: 24px;">${effectiveIcon}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      })
    }).addTo(poiLayer);
    
    // Get translated labels and colors
    const categoryLabel = getCategoryLabel(poi.category || 'other');
    const sourceLabel = getSourceLabel(poi.source || 'manual');
    const bestDescription = getBestDescription(poi);
    
    const popup = `
      <div style="min-width: 280px; max-width: 350px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 32px; margin-right: 10px;">${effectiveIcon}</span>
          <h5 style="margin: 0; color: #333; flex: 1;">${poi.name}</h5>
        </div>
        
        
        <p style="margin: 0 0 12px 0; color: #666; font-size: 14px; line-height: 1.4;">
          ${bestDescription}
        </p>
        
        ${poi.extraInfo && poi.extraInfo.aiSummary && poi.extraInfo.aiSummary !== bestDescription ? `
          <div style="background: #f8f9fa; padding: 8px; border-radius: 4px; margin-bottom: 12px; border-left: 3px solid #007bff;">
            <div style="font-size: 12px; color: #6c757d; font-weight: bold; margin-bottom: 4px;">🧠 AI Summary:</div>
            <div style="font-size: 13px; color: #495057;">${poi.extraInfo.aiSummary}</div>
          </div>
        ` : ''}
        
        ${poi.extraInfo && poi.extraInfo.curiosities ? `
          <div style="background: #fff3cd; padding: 8px; border-radius: 4px; margin-bottom: 12px; border-left: 3px solid #ffc107;">
            <div style="font-size: 12px; color: #856404; font-weight: bold; margin-bottom: 4px;">🔍 Curiosità:</div>
            <div style="font-size: 13px; color: #856404;">${poi.extraInfo.curiosities}</div>
          </div>
        ` : ''}
        
        ${poi.extraInfo && poi.extraInfo.historicalFacts ? `
          <div style="background: #d1ecf1; padding: 8px; border-radius: 4px; margin-bottom: 12px; border-left: 3px solid #17a2b8;">
            <div style="font-size: 12px; color: #0c5460; font-weight: bold; margin-bottom: 4px;">📚 Fatti Storici:</div>
            <div style="font-size: 13px; color: #0c5460;">${poi.extraInfo.historicalFacts}</div>
          </div>
        ` : ''}
        
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

  async function addPOI(data) {
    try {
      console.log("Creating POI with data:", data);
      setStatus("Creazione POI in corso...", "info");
      
      const response = await fetch("/pois", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log("✅ POI creato:", result);
        setStatus("✅ POI creato correttamente!", "ok");
        await loadPOIs(selectedZone.zoneId);
        refreshPOICounts();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ Errore server:", response.status, errorData);
        const errorMessage = errorData.message || `Errore server: ${response.status}`;
        setStatus(`❌ ${errorMessage}`, "error");
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("❌ Errore aggiunta POI:", error);
      setStatus("❌ Errore durante la creazione del POI", "error");
    }
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
        map.closePopup();
        await loadPOIs(selectedZone.zoneId);
        refreshPOICounts();
      } else {
        throw new Error("Errore server");
      }
    } catch (error) {
      console.error("Errore aggiornamento POI:", error);
      setStatus("Errore aggiornamento POI", "error");
    }
  }

  async function deletePOI(poi) {
    if (!confirm(`Sei sicuro di voler eliminare il POI "${poi.name}"?\n\nQuesta azione non può essere annullata.`)) return;
    
    try {
      const response = await fetch(`/admin/poi/delete/${poi._id}`, { method: "GET" });
      
      if (response.ok) {
        setStatus(`✅ POI "${poi.name}" eliminato con successo!`, "ok");
        // Remove marker from map
        poiLayer.eachLayer((layer) => {
          if (layer.poiData && layer.poiData._id === poi._id) {
            poiLayer.removeLayer(layer);
          }
        });
        refreshPOICounts();
        
        // Update POI counter in sidebar
        if (window.selectedZone && window.selectedZone.id) {
          const currentCount = poiLayer.getLayers().length;
          updatePOICounter(window.selectedZone.id, currentCount);
        }
      } else {
        throw new Error("Errore durante l'eliminazione del POI");
      }
    } catch (error) {
      console.error("❌ Errore eliminazione POI:", error);
      setStatus(`❌ Errore durante l'eliminazione del POI: ${error.message}`, "error");
    }
  }

  function editPOI(poi) {
    // Redirect to the proper edit page
    window.location.href = `/admin/poi/edit/${poi._id}`;
  }

  // =======================================================
  // ZONE DRAWING
  // =======================================================
  
  // Global functions for zone popup buttons
  window.editZone = async function(zoneId) {
    const zoneLayer = findZoneById(zoneId);
    if (!zoneLayer) {
      setStatus("Zona non trovata", "error");
      return;
    }
    
    // Enable editing mode
    editMode = true;
    map.closePopup();
    
    // Highlight the zone
    zoneLayer.setStyle({ color: "#ff6b35", weight: 3 });
    
    // Enable vertex editing
    if (editHandler) {
      editHandler.disable();
    }
    
    editHandler = new L.EditToolbar.Edit(map, {
      featureGroup: L.featureGroup([zoneLayer])
    });
    editHandler.enable();
    
    setStatus("Modalità modifica attiva - Trascina i vertici per modificare la zona", "info");
    
    // Remove any existing edit listeners to prevent duplicates
    zoneLayer.off('edit');
    zoneLayer.off('editstop');
    
    // Listen for edit completion
    zoneLayer.on('edit', async () => {
      await saveZoneEdit(zoneId, zoneLayer);
    });
    
    // Also listen for editstop to handle when editing is finished
    zoneLayer.on('editstop', async () => {
      await saveZoneEdit(zoneId, zoneLayer);
    });
  };
  
  window.manageZone = function(zoneId) {
    map.closePopup();
    window.location.href = `/admin/zones?zone=${zoneId}`;
  };
  
  window.deleteZone = async function(zoneId) {
    const zoneLayer = findZoneById(zoneId);
    if (!zoneLayer) {
      setStatus("Zona non trovata", "error");
      return;
    }
    
    if (!confirm(`Eliminare la zona "${zoneLayer.zoneName}"? Questa azione eliminerà anche tutti i POI associati.`)) {
      return;
    }
    
    try {
      setStatus("Eliminazione zona in corso...", "info");
      map.closePopup();
      
      const response = await fetch(`/zones/${zoneId}`, { method: "DELETE" });
      
      if (response.ok) {
        setStatus("Zona eliminata con successo!", "ok");
        drawnItems.removeLayer(zoneLayer);
        
        // If this was the selected zone, deselect it
        if (selectedZone === zoneLayer) {
          deselectZone();
        }
        
        // Reload zones to refresh the list
        await loadZones();
        refreshPOICounts();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore server");
      }
    } catch (error) {
      console.error("Errore eliminazione zona:", error);
      setStatus(`Errore durante l'eliminazione: ${error.message}`, "error");
    }
  };
  
  function findZoneById(zoneId) {
    let foundZone = null;
    drawnItems.eachLayer((layer) => {
      if (layer.zoneId === zoneId) {
        foundZone = layer;
      }
    });
    return foundZone;
  }
  
  async function saveZoneEdit(zoneId, zoneLayer) {
    try {
      const coordinates = zoneLayer.getLatLngs()[0].map(p => [p.lat, p.lng]);
      
      const response = await fetch(`/zones/${zoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates })
      });
      
      if (response.ok) {
        setStatus("Zona aggiornata con successo!", "ok");
        zoneLayer.setStyle({ color: "#007bff", weight: 2 });
        editMode = false;
        
        if (editHandler) {
          editHandler.disable();
          editHandler = null;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore server");
      }
    } catch (error) {
      console.error("Errore aggiornamento zona:", error);
      setStatus(`Errore durante l'aggiornamento: ${error.message}`, "error");
    }
  }
  
  function setupZoneDrawing() {
    drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: {
        polygon: {
          shapeOptions: { color: "#00bfff", weight: 2, fillOpacity: 0.3 },
          allowIntersection: false,
          showArea: true
        },
        rectangle: false,
        circle: false,
        marker: false,
        polyline: false
      }
    });
  }

  // =======================================================
  // EVENT HANDLERS
  // =======================================================
  
  // Map click handler for POI insertion
  map.on("click", async (e) => {
    if (!insertMode) return;
    
    if (!selectedZone) {
      setStatus("Clicca su una zona per selezionarla prima di inserire POI", "error");
      return;
    }
    
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
    if (!isPointInZone(lat, lng, selectedZone)) {
      setStatus("❌ Clicca DENTRO la zona selezionata", "error");
      return;
    }
    
    await addPOI({
      name: "Nuovo POI",
      description: "",
      lat,
      lng,
      zone: selectedZone.zoneId
    });
    
    // Keep insertMode active for multiple POI creation
    // Mode will be disabled only when user clicks the button again
  });

  // Map click handler for zone deselection
  map.on("click", (e) => {
    if (!insertMode && !editMode && selectedZone) {
      // Check if click is on empty space (not on interactive elements)
      const clickedLayer = e.originalEvent.target;
      if (clickedLayer && clickedLayer.classList && clickedLayer.classList.contains('leaflet-interactive')) {
        return;
      }
      deselectZone();
    }
  });

  // Draw events
  map.on(L.Draw.Event.CREATED, async (e) => {
    if (currentLayer) drawnItems.removeLayer(currentLayer);
    currentLayer = e.layer;
    drawnItems.addLayer(currentLayer);
    
    // Automatically save the zone when created
    await saveNewZone(currentLayer);
  });

  // =======================================================
  // UTILITY FUNCTIONS
  // =======================================================
  
  function showZonePopup(e, zoneLayer) {
    // First select the zone for POI operations
    selectZone(zoneLayer);
    
    const popup = L.popup()
      .setLatLng(e.latlng)
      .setContent(`
        <div class="zone-popup">
          <h4>${zoneLayer.zoneName}</h4>
          <p>${zoneLayer.zoneDescription || "Nessuna descrizione"}</p>
          <div class="popup-buttons">
            <button class="btn btn-warning btn-sm" onclick="editZone('${zoneLayer.zoneId}')">
              🟡 Modifica Zona
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteZone('${zoneLayer.zoneId}')">
              🔴 Elimina Zona
            </button>
            <button class="btn btn-info btn-sm" onclick="manageZone('${zoneLayer.zoneId}')">
              🧭 Gestione Zona
            </button>
          </div>
        </div>
      `)
      .openOn(map);
  }

  async function saveNewZone(layer) {
    const name = prompt("Nome della zona:");
    if (!name) {
      drawnItems.removeLayer(layer);
      setStatus("Creazione zona annullata", "info");
      return;
    }

    const description = prompt("Descrizione (opzionale):") || "";
    const coordinates = layer.getLatLngs()[0].map(p => [p.lat, p.lng]);

    try {
      setStatus("Salvataggio zona in corso...", "info");
      const response = await fetch("/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, coordinates })
      });

      if (response.ok) {
        const result = await response.json();
        setStatus("Zona salvata con successo!", "ok");
        
        // Update the layer with zone data
        layer.zoneId = result.zone._id;
        layer.zoneName = result.zone.name;
        layer.zoneDescription = result.zone.description;
        
        // Reload zones to get the updated list
        await loadZones();
        currentLayer = null;
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore server");
      }
    } catch (error) {
      console.error("Errore salvataggio zona:", error);
      setStatus(`Errore durante il salvataggio: ${error.message}`, "error");
      drawnItems.removeLayer(layer);
    }
  }
  
  function isPointInZone(lat, lng, zoneLayer) {
    console.log("🔍 Checking point in zone:", { lat, lng, zoneLayer });
    
    if (!zoneLayer || !zoneLayer.getLatLngs) {
      console.log("❌ Invalid zone layer:", zoneLayer);
      return false;
    }
    
    const point = L.latLng(lat, lng);
    const polygon = L.polygon(zoneLayer.getLatLngs()[0]);
    
    console.log("🔍 Polygon bounds:", polygon.getBounds());
    console.log("🔍 Point:", point);
    
    // First check if point is within bounds (quick check)
    if (!polygon.getBounds().contains(point)) {
      console.log("❌ Point outside polygon bounds");
      return false;
    }
    
    // Then use manual point-in-polygon algorithm
    const isInside = isPointInPolygon(point, polygon);
    console.log("🔍 Point in polygon result:", isInside);
    return isInside;
  }

  function isPointInPolygon(latlng, polygon) {
    const x = latlng.lat, y = latlng.lng;
    const vs = polygon.getLatLngs()[0];
    console.log("🔍 Point-in-polygon check:", { x, y, vertices: vs.length });
    
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i].lat, yi = vs[i].lng;
      const xj = vs[j].lat, yj = vs[j].lng;
      const intersect = ((yi > y) != (yj > y)) &&
                        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    console.log("🔍 Ray casting result:", inside);
    return inside;
  }

  // =======================================================
  // BUTTON HANDLERS
  // =======================================================
  
  // Disegna nuova Zona
  document.getElementById("btnDisegnaZona").addEventListener("click", () => {
    if (!drawActive) {
      map.addControl(drawControl);
      drawActive = true;
      setStatus("Modalità disegno attiva - Usa gli strumenti di disegno sulla mappa", "info");
    } else {
      drawActive = false;
      map.removeControl(drawControl);
      setStatus("Modalità disegno disattivata", "info");
    }
  });

  // Note: "Chiudi & Salva Zona" button removed - zones are now auto-saved when created

  // Note: "Gestisci Zone" button removed - functionality moved to zone popup

  // Inserisci POI
  document.getElementById("btnInserisciPOI").addEventListener("click", () => {
    insertMode = !insertMode;
    
    if (insertMode) {
      // Activate POI insertion mode
      document.getElementById("btnInserisciPOI").classList.add("btn-primary");
      document.getElementById("btnInserisciPOI").textContent = "✏️ Inserisci POI (ATTIVO)";
      setStatus("Modalità inserimento POI attiva. Clicca su una zona per selezionarla, poi clicca DENTRO la zona per aggiungere POI.", "info");
      console.log("[INFO] Modalità POI attiva - clicca su una zona per selezionarla");
    } else {
      // Deactivate POI insertion mode
      document.getElementById("btnInserisciPOI").classList.remove("btn-primary");
      document.getElementById("btnInserisciPOI").textContent = "+ Inserisci POI";
      setStatus("Modalità inserimento POI disattivata", "info");
      console.log("[INFO] Modalità POI disattivata - comportamento normale ripristinato");
      
      // Reset zone styling if a zone is selected
      if (selectedZone) {
        selectedZone.setStyle({ color: "#ffd700", weight: 3 });
      }
    }
  });


  // Importa POI automatici (Smart AI System)
  document.getElementById("btnAutoImportPOI").addEventListener("click", async () => {
    // Check if a zone is selected using the same logic as manual POI insertion
    if (!selectedZone) {
      setStatus("⚠️ Seleziona prima una zona per importare i POI", "error");
      return;
    }
    
    const button = document.getElementById("btnAutoImportPOI");
    const originalText = button.textContent;
    
    // Disable button and show loading state
    button.disabled = true;
    button.textContent = "⏳ Generazione in corso...";
    button.style.opacity = "0.6";
    
    setStatus("🧠 Importazione POI intelligenti in corso...", "info");
    console.log("🧠 Starting smart POI import for zone:", selectedZone.zoneId);
    
    try {
      // Start progress tracking
      const progress = progressManager.start(
        'poi_auto_import',
        '🧠 Importazione POI Automatici',
        100
      );
      
      progress.update(10, 'Preparazione coordinate zona...');
      
      // Get zone coordinates directly from the selected zone layer (selectedZone is the layer itself)
      const zoneCoordinates = selectedZone.getLatLngs()[0].map(point => [point.lat, point.lng]);
      console.log("📍 Zone coordinates:", zoneCoordinates);
      
      progress.update(10, 'Connessione al server...');
      
      const response = await fetch("/admin/pois/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          zoneId: selectedZone.zoneId,
          coordinates: zoneCoordinates
        })
      });
      
      if (response.ok) {
        // Handle streaming response for real-time progress
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  
                  if (data.type === 'progress') {
                    // Update progress bar with real-time data from server
                    progress.update(data.percentage, data.message, data.details);
                  } else if (data.type === 'complete') {
                    // Final result
                    result = data;
                  }
                } catch (e) {
                  console.log('Invalid JSON in stream:', line);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (result && result.success) {
          console.log("✅ Smart POI import successful:", result);
          
          // Refresh POI display and counts
          await loadPOIs(selectedZone.zoneId);
          refreshPOICounts();
          
          progress.complete(`✅ Importati ${result.count} POI intelligenti per la zona "${selectedZone.zoneName}"`);
          
          setStatus(`🧠 Importati ${result.count} POI intelligenti!`, "ok");
          
          // Show detailed results
          setTimeout(() => {
            setStatus(`✅ Sistema intelligente completato: ${result.count} POI arricchiti con dati AI`, "ok");
          }, 2000);
          
          console.log(`[OK] Auto POIs added: ${result.count}`);
        } else {
          throw new Error(result?.message || 'Importazione fallita');
        }
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore server");
      }
    } catch (error) {
      console.error("❌ Errore importazione POI intelligenti:", error);
      if (progressManager.isOperationRunning('poi_auto_import')) {
        progressManager.errorProgress('poi_auto_import', 'Errore durante l\'importazione: ' + error.message);
      }
      setStatus(`❌ Errore importazione: ${error.message}`, "error");
    } finally {
      // Re-enable button and restore original text
      button.disabled = false;
      button.textContent = originalText;
      button.style.opacity = "1";
    }
  });

  // Visualizza tabella POI
  document.getElementById("btnVisualizzaTabella").addEventListener("click", () => {
    if (selectedZone) {
      window.location.href = `/admin/pois?zone=${selectedZone.zoneId}`;
    } else {
      window.location.href = '/admin/pois';
    }
  });

  // Visualizza tabella Zone
  document.getElementById("btnVisualizzaTabellaZone").addEventListener("click", () => {
    window.location.href = '/admin/zones';
  });

  // Salva ed Esci
  document.getElementById("btnSalvaEsci").addEventListener("click", () => {
    setStatus("Salvataggio completato. Reindirizzamento...", "ok");
    setTimeout(() => {
      window.location.href = "/admin/zones";
    }, 1000);
  });

  // Gestione Intelligente POI
  document.getElementById("btnSmartPOIManager").addEventListener("click", async () => {
    if (!selectedZone) {
      setStatus("⚠️ Seleziona prima una zona per gestire i POI", "error");
      return;
    }
    
    const button = document.getElementById("btnSmartPOIManager");
    const originalText = button.textContent;
    
    try {
      button.disabled = true;
      button.textContent = "🔄 Analisi in corso...";
      
      setStatus("🎯 Avvio gestione intelligente POI...", "info");
      
      // Get current POI count and statistics
      const response = await fetch(`/pois?zone=${selectedZone.zoneId}&format=json`);
      const currentPOIs = await response.json();
      
      const stats = {
        total: currentPOIs.length,
        categories: {},
        quality: {
          high: 0,
          medium: 0,
          low: 0
        }
      };
      
      // Analyze current POIs
      currentPOIs.forEach(poi => {
        stats.categories[poi.category] = (stats.categories[poi.category] || 0) + 1;
        
        // Simple quality assessment
        let qualityScore = 0;
        if (poi.description && poi.description.length > 100) qualityScore += 2;
        if (poi.extraInfo && poi.extraInfo.curiosities) qualityScore += 1;
        if (poi.extraInfo && poi.extraInfo.historicalFacts) qualityScore += 1;
        
        if (qualityScore >= 3) stats.quality.high++;
        else if (qualityScore >= 1) stats.quality.medium++;
        else stats.quality.low++;
      });
      
      // Show analysis results
      const message = `🎯 ANALISI POI ZONA "${selectedZone.zoneName}":

📊 STATISTICHE:
• Totale POI: ${stats.total}
• Alta qualità: ${stats.quality.high}
• Media qualità: ${stats.quality.medium}
• Bassa qualità: ${stats.quality.low}

📋 CATEGORIE:
${Object.entries(stats.categories).map(([cat, count]) => `• ${cat}: ${count}`).join('\n')}

💡 SUGGERIMENTI:
${stats.total > 50 ? '⚠️ Troppi POI - considera rimozione di quelli a bassa qualità' : ''}
${stats.total < 10 ? '⚠️ Pochi POI - considera importazione automatica' : ''}
${stats.quality.low > stats.quality.high ? '⚠️ Molti POI di bassa qualità - migliora le descrizioni' : ''}

🎯 AZIONI CONSIGLIATE:
${stats.total > 50 ? '• Rimuovi POI duplicati o di bassa qualità\n' : ''}
${stats.total < 10 ? '• Importa POI automatici con filtro qualità\n' : ''}
• Rivedi e migliora descrizioni POI esistenti
• Organizza POI per categorie più equilibrate`;
      
      alert(message);
      
      setStatus(`🎯 Analisi completata: ${stats.total} POI analizzati`, "ok");
      
    } catch (error) {
      console.error("❌ Errore gestione intelligente POI:", error);
      setStatus("❌ Errore durante l'analisi dei POI", "error");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });

  // Cancella Tutti POI (TEST)
  document.getElementById("btnClearAllPOIs").addEventListener("click", async () => {
    if (!selectedZone) {
      setStatus("⚠️ Seleziona prima una zona per cancellare i POI", "error");
      return;
    }
    
    const confirmMessage = `⚠️ ATTENZIONE! 
    
Sei sicuro di voler cancellare TUTTI i POI della zona "${selectedZone.zoneName}"?

Questa azione è IRREVERSIBILE e cancellerà:
• Tutti i POI esistenti nella zona
• Tutte le descrizioni e informazioni
• Tutti i dati personalizzati

Digita "CANCELLA" per confermare:`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput !== "CANCELLA") {
      setStatus("❌ Operazione annullata", "info");
      return;
    }
    
    const button = document.getElementById("btnClearAllPOIs");
    const originalText = button.textContent;
    
    try {
      button.disabled = true;
      button.textContent = "🔄 Cancellazione...";
      
      setStatus("🗑️ Cancellazione di tutti i POI in corso...", "info");
      
      // Get all POIs for the zone
      const response = await fetch(`/pois?zone=${selectedZone.zoneId}&format=json`);
      const pois = await response.json();
      
      if (pois.length === 0) {
        setStatus("ℹ️ Nessun POI da cancellare nella zona selezionata", "info");
        return;
      }
      
      // Start progress tracking
      const progress = progressManager.start(
        'clear_all_pois',
        `🗑️ Cancellazione Tutti POI - Zona "${selectedZone.zoneName}"`,
        pois.length
      );
      
      // Delete each POI with progress tracking
      let deletedCount = 0;
      let errorCount = 0;
      const totalPOIs = pois.length;
      
      for (let i = 0; i < pois.length; i++) {
        const poi = pois[i];
        
        try {
          console.log(`🗑️ Cancellando POI: ${poi.name} (ID: ${poi._id})`);
          
          // Update progress
          progress.update(i + 1, `Cancellando: ${poi.name}`, `POI ${i + 1}/${totalPOIs}`);
          
          const deleteResponse = await fetch(`/admin/poi/delete/${poi._id}`, { method: "GET" });
          
          console.log(`📊 Risposta cancellazione per ${poi.name}:`, deleteResponse.status, deleteResponse.statusText);
          
          if (deleteResponse.ok) {
            deletedCount++;
            console.log(`✅ POI cancellato: ${poi.name}`);
          } else {
            const errorText = await deleteResponse.text();
            console.error(`❌ Errore cancellazione ${poi.name}:`, deleteResponse.status, errorText);
            errorCount++;
          }
          
          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Errore cancellazione POI ${poi.name}:`, error);
          errorCount++;
        }
      }
      
      // Complete progress
      if (errorCount === 0) {
        progress.complete(`✅ Cancellati ${deletedCount} POI dalla zona "${selectedZone.zoneName}"`);
        setStatus(`✅ Cancellati ${deletedCount} POI dalla zona "${selectedZone.zoneName}"`, "ok");
      } else {
        progress.complete(`⚠️ Cancellati ${deletedCount} POI, ${errorCount} errori`);
        setStatus(`⚠️ Cancellati ${deletedCount} POI, ${errorCount} errori`, "warning");
      }
      
      // Clear POI layer from map
      poiLayer.clearLayers();
      
      // Update counter
      updatePOICounter(selectedZone.zoneId, 0);
      
    } catch (error) {
      console.error("❌ Errore cancellazione POI:", error);
      if (progressManager.isOperationRunning('clear_all_pois')) {
        progressManager.errorProgress('clear_all_pois', 'Errore durante la cancellazione dei POI');
      }
      setStatus("❌ Errore durante la cancellazione dei POI", "error");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });

  // Gestione POI per Categorie
  document.getElementById("btnPOICategoryManager").addEventListener("click", async () => {
    if (!selectedZone) {
      setStatus("⚠️ Seleziona prima una zona per gestire i POI per categoria", "error");
      return;
    }
    
    try {
      // Start progress tracking
      const progress = progressManager.start(
        'category_analysis',
        '📊 Analisi Categorie POI',
        100
      );
      
      progress.update(10, 'Caricamento POI dalla zona...');
      
      // Get all POIs for the zone
      const response = await fetch(`/pois?zone=${selectedZone.zoneId}&format=json`);
      const pois = await response.json();
      
      progress.update(30, 'Analisi categorie POI...');
      
      if (pois.length === 0) {
        progress.complete("ℹ️ Nessun POI trovato nella zona selezionata");
        setStatus("ℹ️ Nessun POI trovato nella zona selezionata", "info");
        return;
      }
      
      progress.update(50, `Analisi di ${pois.length} POI trovati...`);
      
      // Group POIs by category
      const categories = {};
      pois.forEach((poi, index) => {
        const category = poi.category || 'other';
        if (!categories[category]) {
          categories[category] = {
            count: 0,
            pois: [],
            icon: getCategoryLabel(category).icon,
            name: getCategoryLabel(category).text
          };
        }
        categories[category].count++;
        categories[category].pois.push(poi);
        
        // Update progress for each POI
        if (index % 10 === 0) {
          progress.update(50 + Math.round((index / pois.length) * 30), `Categorizzazione POI ${index + 1}/${pois.length}...`);
        }
      });
      
      progress.update(80, 'Preparazione interfaccia...');
      
      // Display categories in modal
      displayCategoryManagement(categories);
      
      progress.update(90, 'Apertura modal categorie...');
      
      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('categoryManagementModal'));
      modal.show();
      
      progress.complete(`✅ Trovate ${Object.keys(categories).length} categorie di POI`);
      setStatus(`📊 Trovate ${Object.keys(categories).length} categorie di POI`, "ok");
      
    } catch (error) {
      console.error("❌ Errore caricamento categorie:", error);
      if (progressManager.isOperationRunning('category_analysis')) {
        progressManager.errorProgress('category_analysis', 'Errore durante il caricamento delle categorie');
      }
      setStatus("❌ Errore durante il caricamento delle categorie", "error");
    }
  });

  // =======================================================
  // CATEGORY MANAGEMENT FUNCTIONS
  // =======================================================
  
  function displayCategoryManagement(categories) {
    const container = document.getElementById('categoriesList');
    container.innerHTML = '';
    
    // Sort categories by count (descending)
    const sortedCategories = Object.entries(categories).sort((a, b) => b[1].count - a[1].count);
    
    sortedCategories.forEach(([categoryKey, categoryData]) => {
      const categoryItem = document.createElement('div');
      categoryItem.className = 'category-item';
      categoryItem.innerHTML = `
        <div class="category-info">
          <div class="category-icon">${categoryData.icon}</div>
          <div class="category-details">
            <h6>${categoryData.name}</h6>
            <small>${categoryData.count} POI trovati</small>
          </div>
        </div>
        <div class="category-count">${categoryData.count}</div>
        <div class="category-actions">
          <button class="btn btn-view-category" onclick="viewCategoryPOIs('${categoryKey}')">
            👁️ Visualizza
          </button>
          <button class="btn btn-confirm-category" onclick="confirmCategoryPOIs('${categoryKey}')">
            ✅ Conferma
          </button>
          <button class="btn btn-delete-category" onclick="deleteCategoryPOIs('${categoryKey}')">
            🗑️ Elimina
          </button>
        </div>
      `;
      container.appendChild(categoryItem);
    });
  }
  
  // Make functions global for onclick handlers
  window.viewCategoryPOIs = function(categoryKey) {
    console.log(`👁️ Visualizzando POI categoria: ${categoryKey}`);
    
    // Hide all POI markers
    poiLayer.clearLayers();
    
    // Get POIs for this category from the current zone
    const response = fetch(`/pois?zone=${selectedZone.zoneId}&format=json`)
      .then(res => res.json())
      .then(pois => {
        const categoryPOIs = pois.filter(poi => (poi.category || 'other') === categoryKey);
        
        // Show only POIs of this category
        categoryPOIs.forEach(poi => createPOIMarker(poi));
        
        setStatus(`👁️ Visualizzati ${categoryPOIs.length} POI della categoria "${getCategoryLabel(categoryKey).text}"`, "ok");
        updatePOICounter(selectedZone.zoneId, categoryPOIs.length);
      });
  };
  
  window.confirmCategoryPOIs = function(categoryKey) {
    console.log(`✅ Confermando POI categoria: ${categoryKey}`);
    setStatus(`✅ POI categoria "${getCategoryLabel(categoryKey).text}" confermati`, "ok");
  };
  
  window.deleteCategoryPOIs = async function(categoryKey) {
    const categoryName = getCategoryLabel(categoryKey).text;
    
    if (!confirm(`⚠️ Sei sicuro di voler eliminare TUTTI i POI della categoria "${categoryName}"?\n\nQuesta azione è IRREVERSIBILE!`)) {
      return;
    }
    
    console.log(`🗑️ Eliminando POI categoria: ${categoryKey}`);
    
    try {
      // Get POIs for this category and delete them
      const response = await fetch(`/pois?zone=${selectedZone.zoneId}&format=json`);
      const pois = await response.json();
        const categoryPOIs = pois.filter(poi => (poi.category || 'other') === categoryKey);
        
        if (categoryPOIs.length === 0) {
          setStatus(`ℹ️ Nessun POI da eliminare per la categoria "${categoryName}"`, "info");
          return;
        }
        
        // Start progress tracking
        const progress = progressManager.start(
          `delete_category_${categoryKey}`,
          `🗑️ Eliminazione POI Categoria "${categoryName}"`,
          categoryPOIs.length
        );
        
        let deletedCount = 0;
        let errorCount = 0;
        
        // Delete each POI sequentially
        for (let i = 0; i < categoryPOIs.length; i++) {
          const poi = categoryPOIs[i];
          
          try {
            progress.update(i + 1, `Eliminando: ${poi.name}`, `POI ${i + 1}/${categoryPOIs.length}`);
            
            console.log(`🗑️ Eliminando POI: ${poi.name} (ID: ${poi._id})`);
            
            const deleteResponse = await fetch(`/admin/poi/delete/${poi._id}`, { method: "GET" });
            
            if (deleteResponse.ok) {
              deletedCount++;
              console.log(`✅ POI eliminato: ${poi.name}`);
            } else {
              errorCount++;
              console.error(`❌ Errore eliminazione POI ${poi.name}:`, deleteResponse.status);
            }
            
            // Small delay
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`❌ Errore eliminazione POI ${poi.name}:`, error);
            errorCount++;
          }
        }
        
        // Complete progress
        if (errorCount === 0) {
          progress.complete(`✅ Eliminati ${deletedCount} POI della categoria "${categoryName}"`);
          setStatus(`✅ Eliminati ${deletedCount} POI della categoria "${categoryName}"`, "ok");
        } else {
          progress.complete(`⚠️ Eliminati ${deletedCount} POI, ${errorCount} errori`);
          setStatus(`⚠️ Eliminati ${deletedCount} POI, ${errorCount} errori`, "warning");
        }
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('categoryManagementModal'));
        if (modal) {
          modal.hide();
        }
        
        // Clear POI layer and reload
        poiLayer.clearLayers();
        updatePOICounter(selectedZone.zoneId, 0);
        
        // Reload all POIs to refresh the view
        await loadPOIs(selectedZone.zoneId);
        
        // Update the counter with remaining POIs
        const remainingResponse = await fetch(`/pois?zone=${selectedZone.zoneId}&format=json`);
        const remainingPOIs = await remainingResponse.json();
        updatePOICounter(selectedZone.zoneId, remainingPOIs.length);
        
      } catch (error) {
        console.error("❌ Errore durante eliminazione categoria:", error);
        if (progressManager.isOperationRunning(`delete_category_${categoryKey}`)) {
          progressManager.errorProgress(`delete_category_${categoryKey}`, 'Errore durante l\'eliminazione dei POI');
        }
        setStatus("❌ Errore durante l'eliminazione dei POI", "error");
        
        // Close the modal even on error
        const modal = bootstrap.Modal.getInstance(document.getElementById('categoryManagementModal'));
        if (modal) {
          modal.hide();
        }
      }
    };

  // =======================================================
  // INITIALIZATION
  // =======================================================
  
  setupZoneDrawing();
  loadZones();
  loadAllPOIs();
  
  // Reload POIs for selected zone if returning from edit page
  setTimeout(() => {
    if (window.selectedZone && window.selectedZone.id) {
      console.log(`🔄 Ricaricamento POI per zona selezionata: ${window.selectedZone.name}`);
      loadPOIs(window.selectedZone.id);
    }
  }, 1000); // Small delay to ensure zones are loaded first
  
  setStatus("Sistema di gestione mappa pronto", "ok");
});
