// =======================================================
// 🌊 Andaly Whatis — Complete Map Management System
// =======================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Andaly Whatis Map Manager loaded");
  console.log("✅ Zone Save Fix implemented — ready to test");
  
  // Prevent accidental page close during zone editing
  window.addEventListener('beforeunload', (e) => {
    if (currentEditingZone && zoneHasChanges) {
      e.preventDefault();
      e.returnValue = 'Hai modifiche non salvate alla zona. Sei sicuro di voler uscire?';
      return e.returnValue;
    }
  });

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
  let currentPOIFilter = 'all'; // 'all', 'definitive', 'provisional'
  let cachedPOIs = []; // Cache dei POI caricati per la zona corrente
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
  
  // Expose functions globally for semantic manager
  window.mapManager = {
    getActiveZone: () => selectedZone,
    getLayerByZoneId: (zoneId) => findZoneById(zoneId),
    isEditing: () => editMode,
    saveZone: saveZone,
    setActiveZone: (zone) => {
      // Normalize incoming zone to a Leaflet layer selection
      try {
        const id = zone && (zone._id || zone.id || zone.zoneId);
        if (id) {
          localStorage.setItem('activeZoneId', id);
        }
        const existingLayer = id ? findZoneById(id) : null;
        if (existingLayer) {
          selectZone(existingLayer);
          return;
        }
        if (zone && zone.coordinates) {
          // Convert plain object to layer and select it
          const latlngs = (Array.isArray(zone.coordinates[0]) && Array.isArray(zone.coordinates[0][0]))
            ? zone.coordinates[0].map(c => [c[0], c[1]])
            : zone.coordinates.map(c => [c[0], c[1]]);
          const polygon = L.polygon(latlngs, {
            color: zone.color || "#007BFF",
            weight: 2,
            fillOpacity: 0.15
          }).addTo(map);
          polygon.zoneId = id || zone._id;
          polygon.zoneName = zone.name || polygon.zoneId;
          selectZone(polygon);
          return;
        }
      } catch (_) {}
      // Fallback: clear selection if nothing valid
      deselectZone();
    },
    zones: [] // Will be populated when zones are loaded
  };

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
  // COUNTRY BANNER HANDLERS
  // =======================================================
  function showCountryBanner(country) {
    try {
      const banner = document.getElementById('countryBanner');
      const textEl = document.getElementById('countryBannerText');
      if (!banner || !textEl) return;
      if (!country || !country.code || country.code === 'IT') {
        banner.style.display = 'none';
        return;
      }
      const countryName = country.name || country.code;
      textEl.textContent = `🌍 Zona estera rilevata: ${countryName} — modalità internazionale attiva.`;
      banner.style.display = 'block';
    } catch (_) {}
  }
  function hideCountryBanner() {
    const banner = document.getElementById('countryBanner');
    if (banner) banner.style.display = 'none';
  }
  // Expose global updater (semantic-manager rimosso - parte della vecchia logica deprecata)
  window.updateCountryBanner = function(country) {
    // Store on selection for persistence
    if (selectedZone) selectedZone.zoneCountry = country || null;
    showCountryBanner(country);
  };

  // =======================================================
  // POI COUNT VISUALIZATION
  // =======================================================
  
  async function loadAllPOIs() {
    try {
      const response = await fetch("/pois?format=json");
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error("❌ Received non-JSON response:", text);
        throw new Error("Server returned non-JSON data");
      }
      
      allPOIs = await response.json();
      console.log("✅ All POIs loaded:", allPOIs.length);
      updateZonePOICounts();
    } catch (error) {
      console.error("❌ Errore caricamento POI globali:", error.message);
      allPOIs = []; // Set empty array on error
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
  
  // ✅ FIX: Debouncing per evitare loop anomalo di richieste /zones
  let loadZonesTimeout = null;
  let lastLoadZonesCall = 0;
  const LOAD_ZONES_DEBOUNCE_MS = 2000; // 2 secondi minimi tra chiamate
  
  async function loadZones() {
    // ✅ FIX: Debounce per evitare chiamate troppo frequenti
    const now = Date.now();
    if (now - lastLoadZonesCall < LOAD_ZONES_DEBOUNCE_MS) {
      if (loadZonesTimeout) clearTimeout(loadZonesTimeout);
      loadZonesTimeout = setTimeout(() => loadZones(), LOAD_ZONES_DEBOUNCE_MS - (now - lastLoadZonesCall));
      return;
    }
    lastLoadZonesCall = now;
    
    try {
      const response = await fetch("/zones");
      const zones = await response.json();
      
      // Clear existing zones
      drawnItems.clearLayers();
      
      // Update global zones array for recovery
      window.mapManager.zones = zones;
      
      let loadedCount = 0;
      let skippedCount = 0;
      
      zones.forEach(zone => {
        try {
          // Validazione coordinate
          if (!zone.coordinates || !Array.isArray(zone.coordinates) || zone.coordinates.length === 0) {
            console.warn(`⚠️ Zona "${zone.name || zone._id}" ha coordinate mancanti o invalide, saltata`);
            skippedCount++;
            return;
          }

          // Normalizza formato coordinate: gestisce diversi formati
          let coords = zone.coordinates;
          
          // Log formato originale per debug
          console.log(`[MAP] 🔍 Zona "${zone.name}": formato coordinate iniziale -`, {
            type: Array.isArray(coords[0]) ? (Array.isArray(coords[0][0]) ? (Array.isArray(coords[0][0][0]) ? 'triplo' : 'doppio') : 'singolo') : 'unknown',
            length: coords.length,
            firstSample: coords[0]
          });
          
          // Se è un array annidato triplo (GeoJSON Polygon format: [[[lng,lat]...]])
          if (Array.isArray(coords[0]) && Array.isArray(coords[0][0]) && Array.isArray(coords[0][0][0])) {
            coords = coords[0]; // Estrai il primo anello esterno
            console.log(`[MAP] 🔧 Estratto primo anello GeoJSON per "${zone.name}": ${coords.length} punti`);
          }
          
          // Verifica che dopo l'estrazione abbiamo ancora un array di array (punti)
          if (!Array.isArray(coords) || coords.length === 0 || !Array.isArray(coords[0])) {
            console.error(`❌ Zona "${zone.name}": formato coordinate non valido dopo normalizzazione`, coords);
            skippedCount++;
            return;
          }

          // Verifica che ci siano almeno 3 punti per un poligono
          if (coords.length < 3) {
            console.error(`❌ Zona "${zone.name}": ha meno di 3 punti (${coords.length}). Dettagli:`, {
              originalLength: zone.coordinates.length,
              normalizedLength: coords.length,
              sample: coords.slice(0, 3)
            });
            skippedCount++;
            return;
          }
          
          // Verifica che ogni punto sia un array di 2 elementi
          const invalidPoints = coords.filter(p => !Array.isArray(p) || p.length < 2);
          if (invalidPoints.length > 0) {
            console.error(`❌ Zona "${zone.name}": ${invalidPoints.length} punti non validi su ${coords.length}`);
            skippedCount++;
            return;
          }
          
          // Swap lng/lat se necessario: verifica il primo punto
          const firstPoint = coords[0];
          if (firstPoint.length >= 2) {
            // Heuristic: se il primo valore è fuori range lat (-90/90), probabilmente è lng/lat
            if (Math.abs(firstPoint[0]) > 90 || Math.abs(firstPoint[1]) > 180) {
              console.log(`[MAP] 🔧 Swap coordinate lng/lat per "${zone.name}" (primo punto: [${firstPoint[0]}, ${firstPoint[1]}])`);
              coords = coords.map(c => {
                if (Array.isArray(c) && c.length >= 2) {
                  return [c[1], c[0]]; // Swap lng/lat
                }
                return c;
              });
            }
          }
          
          // Log finale per conferma
          console.log(`[MAP] ✅ Zona "${zone.name}" normalizzata: ${coords.length} punti validi`);

          const polygon = L.polygon(coords, {
          color: "#007bff",
          weight: 2,
          fillOpacity: 0.1
        });
        
        polygon.zoneId = zone._id;
        polygon.zoneName = zone.name;
        polygon.zoneDescription = zone.description;
        
        // Click handler for zone selection
        polygon.on("click", (e) => {
          // Just select the zone (no popup)
          selectZone(polygon);
          if (insertMode) {
            setStatus(`Zona selezionata per inserimento POI: ${polygon.zoneName}`, "info");
            console.log("[INFO] Modalità POI attiva - zona selezionata per inserimento");
          } else {
            setStatus(`Zona selezionata: ${polygon.zoneName}. Usa la tabella per modificare.`, "info");
          }
        });
        
        drawnItems.addLayer(polygon);
          console.log(`✅ Zona "${zone.name}" caricata sulla mappa`);
          loadedCount++;
        } catch (zoneError) {
          console.error(`❌ Errore caricamento zona "${zone.name || zone._id}":`, zoneError);
          skippedCount++;
          // Continua con le altre zone invece di bloccare tutto
        }
      });
      
      // Mostra risultato caricamento
      if (skippedCount > 0) {
        setStatus(`Zone caricate: ${loadedCount}/${zones.length} (${skippedCount} saltate)`, "warning");
        console.warn(`⚠️ ${skippedCount} zona/e saltata/e durante il caricamento. Controlla la console per dettagli.`);
      } else {
        setStatus(`Zone caricate: ${loadedCount}/${zones.length}`, "ok");
      }
      
      // Update POI counts after zones are loaded
      updateZonePOICounts();
      
      // Auto-select previously active zone if present
      try {
        const rememberedId = localStorage.getItem('activeZoneId');
        if (rememberedId) {
          const rememberedLayer = findZoneById(rememberedId);
          if (rememberedLayer) {
            selectZone(rememberedLayer);
            console.log(`[MAP] 🔁 Zona ripristinata: ${rememberedLayer.zoneName}`);
          }
        }
      } catch (_) {}
      
      // Check if we need to enter edit mode
      const urlParams = new URLSearchParams(window.location.search);
      const editZoneId = urlParams.get('editZone');
      if (editZoneId) {
        // Wait a bit for map to settle
        setTimeout(() => {
          editZone(editZoneId);
          // Center map on the zone being edited
          const zoneLayer = findZoneById(editZoneId);
          if (zoneLayer) {
            map.fitBounds(zoneLayer.getBounds());
          }
        }, 500);
      }
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
    
    // 🧩 Ensure selectedZone is always a Leaflet Polygon instance
    if (!(zoneLayer instanceof L.Polygon) && zoneLayer.coordinates) {
      console.warn("[MAP] Converting plain zone object to Leaflet Polygon...");
      const latlngs = zoneLayer.coordinates.map(c => [c[1], c[0]]); // swap lng/lat if needed
      const polygon = L.polygon(latlngs, {
        color: zoneLayer.color || "#007BFF",
        weight: 2,
        fillOpacity: 0.15
      }).addTo(map);
      polygon._id = zoneLayer._id;
      polygon.name = zoneLayer.name;
      polygon.zoneData = zoneLayer;
      selectedZone = polygon;
    }
    
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

    // Persist selection
    try { localStorage.setItem('activeZoneId', zoneLayer.zoneId); } catch (_) {}

    // If we already know country for this layer, reflect banner immediately
    if (zoneLayer.zoneCountry) {
      showCountryBanner(zoneLayer.zoneCountry);
    } else {
      hideCountryBanner();
    }
    
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
      try { localStorage.removeItem('activeZoneId'); } catch (_) {}
      console.log("[MAP] Zone deselected");
      hideCountryBanner();
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
      console.log(`📍 Loading POIs for zone: ${zoneId}`);
      poiLayer.clearLayers();
      
      const response = await fetch(`/pois?zone=${zoneId}&format=json`);
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error("❌ Received non-JSON response:", text);
        throw new Error("Server returned non-JSON data");
      }
      
      const pois = await response.json();
      console.log(`✅ Found ${pois.length} POIs`);
      
      // Salva i POI in cache per poterli filtrare dinamicamente
      cachedPOIs = pois;
      
      // Filtra i POI in base al filtro selezionato
      const filteredPOIs = filterPOIsByType(pois);
      console.log(`📍 POI filtrati: ${filteredPOIs.length} (filtro: ${currentPOIFilter})`);
      
      filteredPOIs.forEach(poi => createPOIMarker(poi));
      setStatus(`POI caricati: ${filteredPOIs.length} / ${pois.length}`, "ok");
      
      // Update POI counter in sidebar
      updatePOICounter(zoneId, filteredPOIs.length);
      
      // Check for duplicates
      checkForDuplicates(filteredPOIs);
    } catch (error) {
      console.error("❌ Errore caricamento POI:", error.message);
      setStatus("Errore nel caricamento dei POI", "error");
      updatePOICounter(zoneId, 0);
    }
  }

  function checkForDuplicates(pois) {
    const duplicates = [];
    const seen = new Map();
    
    pois.forEach((poi, index) => {
      const key = `${poi.name.toLowerCase()}|${poi.lat}|${poi.lng}`;
      if (seen.has(key)) {
        duplicates.push({ original: seen.get(key), duplicate: poi });
      } else {
        seen.set(key, poi);
      }
    });
    
    if (duplicates.length > 0) {
      console.log(`⚠️ Trovati ${duplicates.length} POI duplicati`);
      showDuplicateWarning(duplicates);
    }
  }

  function showDuplicateWarning(duplicates) {
    let message = `⚠️ Trovati ${duplicates.length} POI duplicati:\n\n`;
    duplicates.forEach((dup, index) => {
      message += `${index + 1}. "${dup.original.name}" (duplicato)\n`;
      message += `   → Coordinate: ${dup.original.lat.toFixed(6)}, ${dup.original.lng.toFixed(6)}\n`;
      message += `   → ID: ${dup.original._id}\n\n`;
    });
    message += "Vuoi cancellare i duplicati?";
    
    if (confirm(message)) {
      // Delete duplicates
      duplicates.forEach(async (dup) => {
        await fetch(`/admin/poi/delete/${dup.duplicate._id}`, { method: 'GET' });
      });
      
      // Reload POIs after a delay
      setTimeout(() => {
        if (window.selectedZone) {
          loadPOIs(window.selectedZone.id);
        }
      }, 2000);
    }
  }

  function createPOIMarker(poi) {
    // Create marker with photo or pin
    let markerHTML = '';
    let markerClass = 'poi-marker-icon';
    const cacheVer = poi.updatedAt ? new Date(poi.updatedAt).getTime() : Date.now();
    const displayImageUrl = poi.imageUrl && poi.imageUrl.trim() !== ''
      ? `${poi.imageUrl}?v=${cacheVer}`
      : '';
    
    if (displayImageUrl) {
      // Use POI photo with circular shape and hover effect
      markerHTML = `
        <div class="poi-photo-marker" style="background-image: url('${displayImageUrl}'); background-size: cover; background-position: center; border: 3px solid #007bff; border-radius: 50%; width: 50px; height: 50px; box-shadow: 0 3px 8px rgba(0,0,0,0.4); transition: all 0.3s ease;">
        </div>
      `;
      markerClass = 'poi-photo-marker';
    } else {
      // Use red pin for missing photos
      markerHTML = `
        <div class="poi-red-pin" style="font-size: 40px; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;" title="Foto mancante - Carica una foto per questo POI">
          📍
        </div>
      `;
    }
    
    // POI definitivi NON sono draggable - sono già approvati e devono restare dove sono
    const marker = L.marker([poi.lat, poi.lng], { 
      draggable: false, // POI definitivi NON spostabili sulla mappa
      icon: L.divIcon({
        className: markerClass,
        html: markerHTML,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
      })
    }).addTo(poiLayer);
    
    // Add hover effect for photo markers - animazione che allarga e rende quadrata
    if (displayImageUrl) {
      // Usa mouseenter/mouseleave invece di mouseover/mouseout per migliore performance
      marker.on('mouseenter', function() {
        const iconElement = this.getElement();
        if (iconElement) {
          const photoDiv = iconElement.querySelector('.poi-photo-marker');
          if (photoDiv) {
            // Allarga e rende più quadrata (border-radius da 50% a 15%)
            photoDiv.style.transform = 'scale(1.3)';
            photoDiv.style.borderRadius = '15px';
            photoDiv.style.borderColor = '#00bfff';
            photoDiv.style.borderWidth = '4px';
            photoDiv.style.zIndex = '1000';
            photoDiv.style.transition = 'all 0.3s ease';
            photoDiv.style.boxShadow = '0 6px 16px rgba(0, 191, 255, 0.5)';
          }
        }
      });
      
      marker.on('mouseleave', function() {
        const iconElement = this.getElement();
        if (iconElement) {
          const photoDiv = iconElement.querySelector('.poi-photo-marker');
          if (photoDiv) {
            // Ritorna alla forma circolare originale
            photoDiv.style.transform = 'scale(1)';
            photoDiv.style.borderRadius = '50%';
            photoDiv.style.borderColor = '#007bff';
            photoDiv.style.borderWidth = '3px';
            photoDiv.style.zIndex = 'auto';
            photoDiv.style.boxShadow = '0 3px 8px rgba(0,0,0,0.4)';
          }
        }
      });
    }
    
    // Get translated labels and colors
    const categoryLabel = getCategoryLabel(poi.category || 'other');
    const sourceLabel = getSourceLabel(poi.source || 'manual');
    const bestDescription = getBestDescription(poi);
    
    const popup = `
      <div style="min-width: 280px; max-width: 350px;">
        ${displayImageUrl ? `
          <div style="width: 100%; height: 150px; background-image: url('${displayImageUrl}'); background-size: cover; background-position: center; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"></div>
        ` : `
          <div style="width: 100%; height: 150px; background: #f0f0f0; border-radius: 8px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <span style="font-size: 50px; opacity: 0.3;">📍</span>
            <div style="font-size: 12px; color: #999; margin-top: 8px;">Foto mancante</div>
          </div>
        `}
        
        <h5 style="margin: 0 0 8px 0; color: #333; font-size: 18px; font-weight: bold;">${poi.name}</h5>
        
        <p style="margin: 0 0 12px 0; color: #666; font-size: 14px; line-height: 1.4;">
          ${bestDescription}
        </p>
        

        
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <button class="btn btn-sm btn-info view-poi" data-id="${poi._id}" style="width: 100%;">🔍 Visualizza Scheda</button>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-primary edit-poi" data-id="${poi._id}" style="flex: 1;">✏️ Modifica</button>
            <button class="btn btn-sm btn-danger delete-poi" data-id="${poi._id}" style="flex: 1;">🗑️ Elimina</button>
          </div>
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
      const viewBtn = popup.querySelector(".view-poi");
      const editBtn = popup.querySelector(".edit-poi");
      const deleteBtn = popup.querySelector(".delete-poi");
      
      if (viewBtn) {
        viewBtn.onclick = () => {
          // Redirect to POI edit page (same as edit button)
          window.location.href = `/admin/poi/edit/${poi._id}`;
        };
      }
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
  
  // Global variables for zone editing
  let currentEditingZone = null;
  let originalZoneCoordinates = null;
  let zoneHasChanges = false;

  // Global functions for zone popup buttons
  window.editZone = async function(zoneId) {
    const zoneLayer = findZoneById(zoneId);
    if (!zoneLayer) {
      setStatus("Zona non trovata", "error");
      return;
    }
    
    // If already editing another zone, ask for confirmation
    if (currentEditingZone && currentEditingZone !== zoneLayer) {
      if (zoneHasChanges) {
        const saveChanges = confirm("Hai modifiche non salvate sulla zona corrente. Vuoi salvarle prima di modificare un'altra zona?");
        if (saveChanges) {
          await saveZoneEdit(currentEditingZone.zoneId, currentEditingZone);
        } else {
          // Restore original coordinates
          restoreZoneCoordinates();
        }
      }
      exitZoneEditMode();
    }
    
    // Enable editing mode
    editMode = true;
    currentEditingZone = zoneLayer;
    originalZoneCoordinates = zoneLayer.getLatLngs()[0].map(p => [p.lat, p.lng]);
    zoneHasChanges = false;
    
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
    
    setStatus("🔧 Modalità modifica attiva - Trascina i vertici. Clicca fuori dalla zona per salvare automaticamente", "info");
    
    // Remove any existing edit listeners to prevent duplicates
    zoneLayer.off('edit');
    zoneLayer.off('editstop');
    
    // Listen for vertex changes (but don't save automatically)
    zoneLayer.on('edit', () => {
      zoneHasChanges = true;
      setStatus("🔧 Zona modificata - Clicca fuori dalla zona per salvare automaticamente", "warning");
      
      // Add visual indicator for unsaved changes
      zoneLayer.setStyle({ 
        color: "#ff6b35", 
        weight: 3,
        dashArray: "10, 5" // Dashed line to indicate unsaved changes
      });
    });
    
    // Add map click listener to detect clicks outside the zone
    map.off('click', handleMapClickDuringEdit);
    map.on('click', handleMapClickDuringEdit);
    
    // Add keyboard listener for ESC key
    document.removeEventListener('keydown', handleEditKeyPress);
    document.addEventListener('keydown', handleEditKeyPress);
  };
  
  window.manageZone = function(zoneId) {
    map.closePopup();
    window.location.href = `/admin/zones?zone=${zoneId}`;
  };
  
  window.invalidateZoneCache = async function(zoneId) {
    const zoneLayer = findZoneById(zoneId);
    if (!zoneLayer) {
      setStatus("Zona non trovata", "error");
      return;
    }
    
    if (!confirm(`🔄 Aggiornare l'elenco dei municipi per la zona "${zoneLayer.zoneName}"?\n\nQuesta operazione eliminerà la cache esistente e rifarà la ricerca dei municipi con i confini attuali della zona.`)) {
      return;
    }
    
    try {
      setStatus("🔄 Invalidazione cache municipi in corso...", "info");
      map.closePopup();
      
      const response = await fetch(`/admin/zones/${zoneId}/cache`, { 
        method: "DELETE" 
      });
      
      if (response.ok) {
        const result = await response.json();
        setStatus("✅ Cache municipi invalidata! La prossima ricerca POI userà i nuovi confini", "ok");
        console.log("✅ Cache invalidated:", result.message);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore server");
      }
    } catch (error) {
      console.error("❌ Errore invalidazione cache:", error);
      setStatus(`❌ Errore durante l'invalidazione: ${error.message}`, "error");
    }
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
  
  // Handle clicks outside the zone during editing
  function handleMapClickDuringEdit(e) {
    if (!currentEditingZone) return;
    
    // Check if click is inside the zone being edited
    const clickPoint = L.latLng(e.latlng.lat, e.latlng.lng);
    const isInsideZone = isPointInPolygon(clickPoint, currentEditingZone);
    
    if (!isInsideZone) {
      // Click is outside the zone
      if (zoneHasChanges) {
        // Auto-save changes without confirmation
        console.log("💾 Auto-saving zone changes...");
        saveZoneEdit(currentEditingZone.zoneId, currentEditingZone);
      } else {
        // No changes, just exit edit mode
        console.log("🔧 Exiting edit mode without changes");
        exitZoneEditMode();
      }
    }
  }
  
  // Handle keyboard shortcuts during editing
  function handleEditKeyPress(e) {
    if (!currentEditingZone) return;
    
    if (e.key === 'Escape') {
      e.preventDefault();
      if (zoneHasChanges) {
        // Auto-save changes before exiting (consistent with click outside behavior)
        console.log("💾 Auto-saving zone changes before exit (ESC pressed)...");
        saveZoneEdit(currentEditingZone.zoneId, currentEditingZone);
      } else {
        console.log("🔧 Exiting edit mode without changes (ESC pressed)");
        exitZoneEditMode();
      }
    } else if (e.key === 'Enter' || (e.ctrlKey && e.key === 's')) {
      e.preventDefault();
      if (zoneHasChanges) {
        console.log("💾 Manual save triggered (Enter/Ctrl+S pressed)...");
        saveZoneEdit(currentEditingZone.zoneId, currentEditingZone);
      } else {
        console.log("🔧 No changes to save (Enter/Ctrl+S pressed)");
        exitZoneEditMode();
      }
    }
  }
  
  // Restore zone to original coordinates
  function restoreZoneCoordinates() {
    if (currentEditingZone && originalZoneCoordinates) {
      const latLngs = originalZoneCoordinates.map(coord => L.latLng(coord[0], coord[1]));
      currentEditingZone.setLatLngs([latLngs]);
      setStatus("🔄 Modifiche annullate", "info");
    }
  }
  
  // Exit zone editing mode
  function exitZoneEditMode() {
    if (currentEditingZone) {
      currentEditingZone.setStyle({ 
        color: "#007bff", 
        weight: 2,
        dashArray: null // Remove dashed line
      });
      currentEditingZone = null;
    }
    
    originalZoneCoordinates = null;
    zoneHasChanges = false;
    editMode = false;
    
    if (editHandler) {
      editHandler.disable();
      editHandler = null;
    }
    
    // Remove event listeners
    map.off('click', handleMapClickDuringEdit);
    document.removeEventListener('keydown', handleEditKeyPress);
    
    setStatus("✅ Modalità modifica disattivata", "ok");
  }
  
  // Check if a point is inside a polygon (ray casting algorithm)
  function isPointInPolygon(point, polygon) {
    try {
      const x = point.lat, y = point.lng;
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
    } catch (error) {
      console.error("Error checking point in polygon:", error);
      return false;
    }
  }

  // ==========================================================
  // 💾 SAVE ZONE — Salvataggio sicuro con validazione coordinate
  // ==========================================================
  async function saveZone(zoneId, layer) {
    try {
      if (!layer) {
        console.warn("⚠️ Nessun layer fornito per il salvataggio.");
        return;
      }

      // 🔹 Estrazione coordinate da Leaflet con validazione robusta
      const rawLatLngs = layer.getLatLngs();
      if (!rawLatLngs || !Array.isArray(rawLatLngs) || rawLatLngs.length === 0) {
        console.error("❌ Errore: layer.getLatLngs() non restituisce dati validi");
        return;
      }
      
      const firstRing = rawLatLngs[0];
      if (!Array.isArray(firstRing) || firstRing.length < 3) {
        console.error(`❌ Errore: zona ha meno di 3 punti (${firstRing.length}) - salvataggio BLOCCATO`);
        setStatus(`❌ Errore: zona ha solo ${firstRing.length} punti. Richiesti almeno 3.`, "error");
        return;
      }
      
      const latlngs = firstRing.map(p => {
        if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') {
          throw new Error(`Punto non valido: ${JSON.stringify(p)}`);
        }
        // IMPORTANTE: Leaflet usa [lat, lng], il database si aspetta [lat, lng]
        // Mantenere lo stesso ordine per tutte le funzioni di salvataggio
        return [p.lat, p.lng];
      });
      
      console.log(`🔍 Validazione coordinate prima salvataggio: ${latlngs.length} punti`);
      
      // 🔒 Validazione finale: almeno 3 punti
      if (latlngs.length < 3) {
        console.error(`❌ ERRORE CRITICO: solo ${latlngs.length} coordinate - salvataggio BLOCCATO per proteggere i dati`);
        setStatus(`❌ Errore critico: solo ${latlngs.length} coordinate. Salvataggio bloccato.`, "error");
        return;
      }

      // 🔁 Chiudi il poligono se necessario
      const first = latlngs[0];
      const last = latlngs[latlngs.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        latlngs.push([first[0], first[1]]);
      }

      console.log(`💾 Auto-saving zone ${zoneId} con ${latlngs.length} coordinate validate...`);

      const res = await fetch(`/admin/zones/${zoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: latlngs, // NOTA: formato [lat, lng] per ogni punto (Leaflet standard)
          lastModified: new Date().toISOString()
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Errore salvataggio zona: ${res.statusText}`);
      }
      
      console.log(`✅ Zona salvata con successo: ${latlngs.length} coordinate`);
      
      // ✅ Ensure zone stays active after save
      if (window.mapManager && window.mapManager.setActiveZone) {
        window.mapManager.setActiveZone({ 
          _id: zoneId, 
          name: layer.zoneName || "Zona sconosciuta",
          coordinates: latlngs
        });
        console.log(`[MAP] 🔄 Zona ${layer.zoneName || zoneId} mantenuta attiva post-salvataggio`);
      }

      // Persist active zone id
      try { localStorage.setItem('activeZoneId', zoneId); } catch (_) {}
    } catch (err) {
      console.error("❌ Errore durante il salvataggio zona:", err);
      setStatus(`❌ Errore salvataggio: ${err.message}`, "error");
    }
  }

  async function saveZoneEdit(zoneId, zoneLayer) {
    try {
      // 🔹 Estrazione coordinate con validazione robusta
      const rawLatLngs = zoneLayer.getLatLngs();
      if (!rawLatLngs || !Array.isArray(rawLatLngs) || rawLatLngs.length === 0) {
        console.error("❌ Errore: zoneLayer.getLatLngs() non restituisce dati validi");
        setStatus("❌ Errore: coordinate non valide dal layer", "error");
        return;
      }
      
      const firstRing = rawLatLngs[0];
      if (!Array.isArray(firstRing) || firstRing.length < 3) {
        console.error(`❌ ERRORE CRITICO: zona ha solo ${firstRing.length} punti - salvataggio BLOCCATO`);
        setStatus(`❌ Errore: zona ha solo ${firstRing.length} punti. Richiesti almeno 3.`, "error");
        return;
      }
      
      const coordinates = firstRing.map(p => {
        if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') {
          throw new Error(`Punto non valido: ${JSON.stringify(p)}`);
        }
        // IMPORTANTE: Leaflet usa [lat, lng], il database si aspetta [lat, lng]
        // Mantenere lo stesso ordine per tutte le funzioni di salvataggio
        return [p.lat, p.lng];
      });
      
      console.log(`🔍 Validazione coordinate prima salvataggio edit: ${coordinates.length} punti`);
      
      // 🔒 Validazione finale: almeno 3 punti
      if (coordinates.length < 3) {
        console.error(`❌ ERRORE CRITICO: solo ${coordinates.length} coordinate - salvataggio BLOCCATO`);
        setStatus(`❌ Errore critico: solo ${coordinates.length} coordinate. Salvataggio bloccato.`, "error");
        return;
      }
      
      console.log(`🔄 Saving zone ${zoneId} with ${coordinates.length} validated coordinates...`);
      
      const response = await fetch(`/admin/zones/${zoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          coordinates: coordinates,
          name: zoneLayer.zoneName, // Preserve zone name if available
          description: zoneLayer.zoneDescription // Preserve description if available
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Zona salvata con successo: ${coordinates.length} coordinate validate`);
        setStatus("✅ Zona aggiornata con successo!", "ok");
        
        // Update the zone data in the layer
        if (result.zone) {
          zoneLayer.zoneName = result.zone.name;
          zoneLayer.zoneDescription = result.zone.description;
        }
        
        exitZoneEditMode();

        // Keep selection and persist active zone id
        try { localStorage.setItem('activeZoneId', zoneId); } catch (_) {}
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || `Errore server: ${response.statusText}`;
        console.error(`❌ Errore salvataggio zona: ${errorMsg}`);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error("❌ Errore aggiornamento zona:", error);
      setStatus(`❌ Errore durante l'aggiornamento: ${error.message}`, "error");
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
            <button class="btn btn-secondary btn-sm" onclick="invalidateZoneCache('${zoneLayer.zoneId}')" title="Forza ricerca nuovi municipi">
              🔄 Aggiorna Municipi
            </button>
          </div>
        </div>
      `)
      .openOn(map);
  }

  // =======================================================
  // ZONE COORDINATES UTILITY (handles Leaflet or plain JSON)
  // =======================================================
  window.extractZoneCoordinates = function(zoneOrLayer) {
    try {
      // Leaflet layer
      if (zoneOrLayer && typeof zoneOrLayer.getLatLngs === 'function') {
        const arr = zoneOrLayer.getLatLngs()[0] || [];
        return arr.map(p => [p.lat, p.lng]);
      }
      // Plain object with nested coordinates [[lng,lat]...] or [[lat,lng]...]
      if (zoneOrLayer && Array.isArray(zoneOrLayer.coordinates)) {
        const coords = zoneOrLayer.coordinates[0] && Array.isArray(zoneOrLayer.coordinates[0][0])
          ? zoneOrLayer.coordinates[0]
          : zoneOrLayer.coordinates;
        // Normalize to [lat,lng]
        return coords.map(pt => {
          const a = Array.isArray(pt) ? pt : [];
          if (a.length >= 2) {
            // Heuristic: if first looks like lat range
            const isLatFirst = a[0] >= -90 && a[0] <= 90;
            return isLatFirst ? [a[0], a[1]] : [a[1], a[0]];
          }
          return null;
        }).filter(Boolean);
      }
    } catch (e) {
      console.warn('⚠️ extractZoneCoordinates failed:', e);
    }
    return [];
  };

  async function saveNewZone(layer) {
    const name = prompt("Nome della zona:");
    if (!name) {
      drawnItems.removeLayer(layer);
      setStatus("Creazione zona annullata", "info");
      return;
    }

    const description = prompt("Descrizione (opzionale):") || "";
    
    // 🔹 Estrazione coordinate con validazione robusta
    const rawLatLngs = layer.getLatLngs();
    if (!rawLatLngs || !Array.isArray(rawLatLngs) || rawLatLngs.length === 0) {
      console.error("❌ Errore: layer.getLatLngs() non restituisce dati validi");
      drawnItems.removeLayer(layer);
      setStatus("❌ Errore: coordinate non valide", "error");
      return;
    }
    
    const firstRing = rawLatLngs[0];
    if (!Array.isArray(firstRing) || firstRing.length < 3) {
      console.error(`❌ ERRORE CRITICO: nuova zona ha solo ${firstRing?.length || 0} punti - salvataggio BLOCCATO`);
      drawnItems.removeLayer(layer);
      setStatus(`❌ Errore: zona deve avere almeno 3 punti (trovati ${firstRing?.length || 0})`, "error");
      return;
    }
    
    const coordinates = firstRing.map(p => {
      if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') {
        throw new Error(`Punto non valido: ${JSON.stringify(p)}`);
      }
      // IMPORTANTE: Leaflet usa [lat, lng], il database si aspetta [lat, lng]
      // NON invertire l'ordine! Questo causerebbe zone salvate in posizioni errate
      return [p.lat, p.lng];
    });
    
    console.log(`🔍 Validazione coordinate nuova zona: ${coordinates.length} punti`);
    
    // 🔒 Validazione finale: almeno 3 punti
    if (coordinates.length < 3) {
      console.error(`❌ ERRORE CRITICO: solo ${coordinates.length} coordinate - salvataggio BLOCCATO`);
      drawnItems.removeLayer(layer);
      setStatus(`❌ Errore critico: solo ${coordinates.length} coordinate. Salvataggio bloccato.`, "error");
      return;
    }

    try {
      setStatus("Salvataggio zona in corso...", "info");
      const response = await fetch("/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, coordinates })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Nuova zona salvata con successo: ${coordinates.length} coordinate validate`);
        setStatus("Zona salvata con successo!", "ok");
        
        // Update the layer with zone data
        layer.zoneId = result._id;
        layer.zoneName = result.name;
        layer.zoneDescription = result.description;
        
        // Reload zones to get the updated list
        await loadZones();
        currentLayer = null;
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Errore server");
      }
    } catch (error) {
      console.error("Errore salvataggio zona:", error);
      setStatus(`❌ Errore durante il salvataggio: ${error.message}`, "error");
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


  // =======================================================
  // BUTTON HANDLERS
  // =======================================================
  
  // Disegna nuova Zona
  const btnDisegnaZona = document.getElementById("btnDisegnaZona");
  if (btnDisegnaZona) {
    btnDisegnaZona.addEventListener("click", () => {
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
  }

  // Note: "Chiudi & Salva Zona" button removed - zones are now auto-saved when created

  // Note: "Gestisci Zone" button removed - functionality moved to zone popup

  // Inserisci POI - gestito principalmente da map_poi_manager.js
  // Questo handler è mantenuto per compatibilità ma potrebbe essere rimosso in futuro
  const btnInserisciPOI = document.getElementById("btnInserisciPOI");
  if (btnInserisciPOI) {
    btnInserisciPOI.addEventListener("click", () => {
      insertMode = !insertMode;
      
      if (insertMode) {
        // Activate POI insertion mode
        const btn = document.getElementById("btnInserisciPOI");
        if (btn) {
          btn.classList.add("btn-primary");
          btn.textContent = "✏️ Inserisci POI (ATTIVO)";
        }
        setStatus("Modalità inserimento POI attiva. Clicca su una zona per selezionarla, poi clicca DENTRO la zona per aggiungere POI.", "info");
        console.log("[INFO] Modalità POI attiva - clicca su una zona per selezionarla");
      } else {
        // Deactivate POI insertion mode
        const btn = document.getElementById("btnInserisciPOI");
        if (btn) {
          btn.classList.remove("btn-primary");
          btn.textContent = "+ Inserisci POI";
        }
        setStatus("Modalità inserimento POI disattivata", "info");
        console.log("[INFO] Modalità POI disattivata - comportamento normale ripristinato");
        
        // Reset zone styling if a zone is selected
        if (selectedZone) {
          selectedZone.setStyle({ color: "#ffd700", weight: 3 });
        }
      }
    });
  }


  // Importa POI automatici (Smart AI System) - solo se il pulsante esiste
  const btnAutoImportPOI = document.getElementById("btnAutoImportPOI");
  if (btnAutoImportPOI) {
    btnAutoImportPOI.addEventListener("click", async () => {
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
        // Parse JSON response (not SSE)
        const result = await response.json();
        console.log("✅ Server response:", result);
        
        if (result.success && result.municipalities) {
          // Show municipality selection modal
          window.currentMunicipalityData = {
            zone: selectedZone,
            municipalities: result.municipalities
          };
          
          // Estrai flag includeMarineExtension dalla risposta (può essere in zone.includeMarineExtension o includeMarineExtension)
          const dbFlag = result.zone?.includeMarineExtension || result.includeMarineExtension || false;
          
          // CONTROLLA TOGGLE GLOBALE: Se "Estensione Marina" è attiva nell'interfaccia, forza a true (funziona per TUTTE le zone)
          const globalToggle = document.getElementById('marineExtensionToggle')?.checked || 
                                localStorage.getItem('marineExtensionEnabled') === 'true';
          
          // Il flag finale è true se: toggle globale ON OPPURE flag nel DB è true
          const includeMarineExtension = globalToggle || dbFlag;
          
          console.log('[MAP] ===== DEBUG INCLUDE MARINE =====');
          console.log('[MAP] Full result object:', result);
          console.log('[MAP] result.zone?.includeMarineExtension:', result.zone?.includeMarineExtension);
          console.log('[MAP] result.includeMarineExtension:', result.includeMarineExtension);
          console.log('[MAP] DB flag:', dbFlag);
          console.log('[MAP] Global toggle checked:', globalToggle);
          console.log('[MAP] Final includeMarineExtension value:', includeMarineExtension, '(type:', typeof includeMarineExtension, ')');
          console.log('[MAP] includeMarineExtension === true:', includeMarineExtension === true);
          console.log('[MAP] ===== END DEBUG =====');
          
          // Show modal for municipality selection with cache flag and marine extension flag
          showMunicipalitySelectionModal(result.municipalities, result.fromCache || false, includeMarineExtension);
          
          progress.complete('Municipi trovati. Seleziona un municipio per continuare.');
          setStatus(`Trovati ${result.municipalities.length} municipi. Seleziona uno per importare i POI.`, "info");
        } else {
          throw new Error(result.message || 'Importazione fallita');
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
  }

  // Visualizza tabella POI
  const btnVisualizzaTabella = document.getElementById("btnVisualizzaTabella");
  if (btnVisualizzaTabella) {
    btnVisualizzaTabella.addEventListener("click", () => {
    if (selectedZone) {
      window.location.href = `/admin/pois?zone=${selectedZone.zoneId}`;
    } else {
      window.location.href = '/admin/pois';
    }
    });
  }

  // Visualizza tabella Zone
  const btnVisualizzaTabellaZone = document.getElementById("btnVisualizzaTabellaZone");
  if (btnVisualizzaTabellaZone) {
    btnVisualizzaTabellaZone.addEventListener("click", () => {
    window.location.href = '/admin/zones';
    });
  }

  // Salva ed Esci (legacy - pulsante rimosso)
  const saveExitBtn = document.getElementById("btnSalvaEsci");
  if (saveExitBtn) {
    saveExitBtn.addEventListener("click", () => {
    setStatus("Salvataggio completato. Reindirizzamento...", "ok");
    setTimeout(() => {
      window.location.href = "/admin/zones";
    }, 1000);
  });
  }


  // =======================================================
  // CATEGORY MANAGEMENT FUNCTIONS
  // =======================================================
  
  function displayCategoryManagement(categories) {
    const container = document.getElementById('categoriesList');
    if (!container) {
      console.warn('categoriesList container not found');
      return;
    }
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
  // GLOBAL FUNCTIONS FOR MOBILE/AR
  // =======================================================
  
  // Generate AR POI markup with photo
  window.generateARPOIMarkup = function(poi) {
    if (poi.imageUrl && poi.imageUrl.trim() !== '') {
      return `
        <div class="ar-poi-container">
          <img src="${poi.imageUrl}" alt="${poi.name}" class="ar-poi-image" />
          <div class="ar-poi-name">${poi.name}</div>
        </div>
      `;
    } else {
      return `
        <div class="ar-poi-container">
          <div class="ar-poi-placeholder">📍</div>
          <div class="ar-poi-name">${poi.name}</div>
        </div>
      `;
    }
  };
  
  // Export POIs for mobile app
  window.exportPOIsForMobile = async function(zoneId) {
    try {
      const response = await fetch(`/pois?zone=${zoneId}&format=json`);
      const pois = await response.json();
      
      return pois.map(poi => ({
        id: poi._id,
        name: poi.name,
        lat: poi.lat,
        lng: poi.lng,
        description: poi.description || '',
        category: poi.category || 'other',
        imageUrl: poi.imageUrl || '',
        customIcon: poi.customIcon || '',
        extraInfo: poi.extraInfo || {}
      }));
    } catch (error) {
      console.error('Error exporting POIs for mobile:', error);
      return [];
    }
  };
  
  // =======================================================
  // MUNICIPALITY SELECTION MODAL
  // =======================================================
  
  function showMunicipalitySelectionModal(municipalities, fromCache = false, includeMarineExtension = false) {
    console.log("🏘️ Showing municipality selection modal with", municipalities.length, "municipalities");
    console.log("🌊 includeMarineExtension flag:", includeMarineExtension, "(type:", typeof includeMarineExtension, ")");
    
    // Show/hide cache info message
    const cacheInfo = document.getElementById('cacheInfo');
    if (cacheInfo) {
      cacheInfo.style.display = fromCache ? 'block' : 'none';
    }
    
    // Populate the list element
    const municipalityList = document.getElementById('municipalityList');
    if (!municipalityList) {
      console.error("❌ Municipality list element not found");
      return;
    }
    
    municipalityList.innerHTML = '';
    municipalities.forEach((municipality, index) => {
      // Ensure municipality has an ID
      if (!municipality.id) {
        municipality.id = municipality.name || `municipality_${index}`;
      }
      
      console.log('Creating municipality item:', municipality.name, 'ID:', municipality.id);
      
      const listItem = document.createElement('div');
      listItem.className = 'list-group-item list-group-item-action';
      listItem.style.cursor = 'pointer';
      listItem.innerHTML = `<strong>${municipality.name}</strong>`;
      listItem.dataset.municipalityId = municipality.id;
      listItem.municipalityData = municipality;
      
      // Left click to select
      listItem.addEventListener('click', (e) => {
        // Ignore if right click
        if (e.button === 2) return;
        
        municipalityList.querySelectorAll('.list-group-item').forEach(item => {
          item.classList.remove('active');
        });
        listItem.classList.add('active');
        
        // Store selected municipality
        window.selectedMunicipality = municipality;
        
        console.log('Municipio selezionato:', municipality.name);
      });
      
      // Right click for context menu
      listItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showMunicipalityContextMenu(e, municipality);
      });
      
      municipalityList.appendChild(listItem);
    });
    
    // Aggiungi voce virtuale "Mare" se includeMarineExtension è attivo
    if (includeMarineExtension === true || includeMarineExtension === 'true' || includeMarineExtension === 1) {
      console.log("🌊 Aggiungendo voce virtuale 'Mare' alla lista municipi");
      
      const marineItem = document.createElement('div');
      marineItem.className = 'list-group-item list-group-item-action';
      marineItem.style.cursor = 'pointer';
      marineItem.style.backgroundColor = 'rgba(0, 123, 255, 0.1)'; // Light blue background
      marineItem.style.borderLeft = '4px solid #007bff'; // Blue border
      marineItem.innerHTML = `
        <div style="display: flex; align-items: center;">
          <span style="font-size: 1.2em; margin-right: 8px;">🌊</span>
          <div>
            <strong style="color: #007bff;">Mare</strong>
            <br>
            <small style="color: #6c757d;">Estensione Marina: Relitti e punti di immersione</small>
          </div>
        </div>
      `;
      marineItem.dataset.municipalityId = 'MARINE_EXTENSION';
      marineItem.dataset.isMarine = 'true';
      
      // Left click to select marine area
      marineItem.addEventListener('click', (e) => {
        if (e.button === 2) return; // Ignore right click
        
        // Deselect all other items
        municipalityList.querySelectorAll('.list-group-item').forEach(item => {
          item.classList.remove('active');
        });
        marineItem.classList.add('active');
        
        // Store selected marine area
        window.selectedMunicipality = {
          name: 'Mare',
          id: 'MARINE_EXTENSION',
          isMarine: true
        };
        
        console.log('🌊 Estensione Marina selezionata');
      });
      
      // Right click disabled for marine area
      marineItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        alert('🌊 Estensione Marina: Ricerca sull\'intera zona marina selezionata');
      });
      
      municipalityList.appendChild(marineItem);
    } else {
      console.log("🌊 includeMarineExtension non attivo, voce 'Mare' non aggiunta");
    }
    
    // Add event listener for the search button if not already added
    const searchButton = document.getElementById('startPOISearch');
    if (searchButton && !searchButton.hasListener) {
      searchButton.addEventListener('click', async () => {
        if (!window.selectedMunicipality) {
          alert('Seleziona un municipio dalla lista');
          return;
        }
        
        // Gestisci ricerca marina se selezionato "Mare"
        if (window.selectedMunicipality.isMarine || window.selectedMunicipality.id === 'MARINE_EXTENSION') {
          console.log('🌊 Avvio ricerca semantica marina per Estensione Marina');
          
          const modal = bootstrap.Modal.getInstance(document.getElementById('municipalitySelectionModal'));
          if (modal) {
            modal.hide();
          }
          
          await searchPOIsForMarineArea();
          return;
        }
        
        // Check if there are provisional POIs in cache
        const zoneId = window.currentMunicipalityData.zone.zoneId;
        const municipalityId = window.selectedMunicipality.id || window.selectedMunicipality.name;
        
        try {
          const checkResponse = await fetch(`/admin/pois/has-provisional/${zoneId}/${municipalityId}`);
          const checkResult = await checkResponse.json();
          
          if (checkResult.hasCache) {
            // Show dialog asking if user wants to use cached POIs or search again
            const useCache = confirm(
              `⚠️ Esistono già POI provvisori in cache per questo municipio.\n\n` +
              `Clicca:\n` +
              `• OK: Per caricare i POI provvisori esistenti\n` +
              `• Annulla: Per fare una nuova ricerca`
            );
            
            if (useCache) {
              // Load cached POIs
              await loadProvisionalPOIs(municipalityId, zoneId);
            } else {
              // Start new search
              const modal = bootstrap.Modal.getInstance(document.getElementById('municipalitySelectionModal'));
              if (modal) {
                modal.hide();
              }
              await searchPOIsForMunicipality(window.selectedMunicipality);
            }
          } else {
            // No cache, start new search
            const modal = bootstrap.Modal.getInstance(document.getElementById('municipalitySelectionModal'));
            if (modal) {
              modal.hide();
            }
            await searchPOIsForMunicipality(window.selectedMunicipality);
          }
        } catch (error) {
          console.error('Error checking cache:', error);
          // Fallback to new search
          const modal = bootstrap.Modal.getInstance(document.getElementById('municipalitySelectionModal'));
          if (modal) {
            modal.hide();
          }
          await searchPOIsForMunicipality(window.selectedMunicipality);
        }
      });
      searchButton.hasListener = true;
    }
    
    // Show the modal
    const modalElement = document.getElementById('municipalitySelectionModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    } else {
      console.error("❌ Municipality modal element not found");
    }
  }
  
  // Function to load provisional POIs from cache
  async function loadProvisionalPOIs(municipalityId, zoneId) {
    console.log(`📂 Loading provisional POIs for municipality ${municipalityId}, zone ${zoneId}`);
    
    try {
      setStatus(`📂 Caricamento POI provvisori...`, "info");
      
      const response = await fetch(`/admin/pois/provisional/${zoneId}/${municipalityId}`);
      const result = await response.json();
      
      if (result.success && result.pois.length > 0) {
        console.log(`✅ Loaded ${result.pois.length} provisional POIs from cache`);
        
        // Store provisional POIs
        window.currentPOIs = result.pois;
        window.currentMunicipality = window.selectedMunicipality;
        
        // Show the POI preview modal
        showPOIPreviewModal(result.pois, window.selectedMunicipality);
        
        // Close the municipality modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('municipalitySelectionModal'));
        if (modal) {
          modal.hide();
        }
        
        setStatus(`✅ Caricati ${result.pois.length} POI provvisori`, "ok");
      } else {
        alert('Nessun POI provvisorio trovato in cache');
      }
    } catch (error) {
      console.error("❌ Error loading provisional POIs:", error);
      setStatus(`❌ Errore caricamento POI provvisori`, "error");
    }
  }

  // Function to search POIs for marine area (entire zone)
  async function searchPOIsForMarineArea() {
    console.log("🌊 Starting marine POI search for entire zone");
    
    try {
      if (!window.currentMunicipalityData || !window.currentMunicipalityData.zone) {
        throw new Error("Dati zona non disponibili");
      }
      
      const zone = window.currentMunicipalityData.zone;
      setStatus(`🌊 Ricerca POI marini per intera zona...`, "info");
      
      // Start progress tracking
      const progress = progressManager.start(
        'poi_search_marine',
        `🌊 Ricerca POI Marini`,
        100
      );
      
      progress.update(10, 'Avvio ricerca marina...');
      
      // Extract zone coordinates
      let zoneCoordinates;
      if (window.extractZoneCoordinates && typeof window.extractZoneCoordinates === 'function') {
        zoneCoordinates = window.extractZoneCoordinates(zone);
      } else if (zone.getLatLngs && typeof zone.getLatLngs === 'function') {
        const latlngs = zone.getLatLngs()[0];
        zoneCoordinates = latlngs.map(point => [point.lat, point.lng]);
      } else if (zone.coordinates && Array.isArray(zone.coordinates)) {
        // Handle different coordinate formats
        let coords = zone.coordinates;
        if (Array.isArray(coords[0]) && Array.isArray(coords[0][0]) && Array.isArray(coords[0][0][0])) {
          coords = coords[0][0];
        } else if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
          coords = coords[0];
        }
        zoneCoordinates = coords;
      } else {
        throw new Error("Impossibile estrarre coordinate zona");
      }
      
      progress.update(30, 'Invio richiesta ricerca semantica...');
      
      const modeSelect = document.getElementById('semanticModeSelect');
      const semanticMode = (modeSelect ? modeSelect.value : 'standard') || 'standard';

      // Call semantic search endpoint with extendMarine=true and marineOnly=true (solo POI marini)
      const response = await fetch("/admin/semantic/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneName: zone.zoneName || zone.name || "Zona Marina",
          polygon: zoneCoordinates,
          extendMarine: true,
          marineOnly: true, // Solo POI marini, no terrestri
          enableAI: true,
          mode: semanticMode.toLowerCase()
        })
      });
      
      if (!response.ok) {
        throw new Error("Errore server durante ricerca marina");
      }
      
      progress.update(60, 'Elaborazione risultati...');
      
      const result = await response.json();
      
      // Extract POIs from result.results.pois (backend structure)
      const pois = result.results?.pois || result.pois || [];
      
      console.log('[MARINE SEARCH] Response structure:', {
        hasSuccess: !!result.success,
        hasResults: !!result.results,
        hasPois: !!result.pois,
        poisInResults: !!result.results?.pois,
        poisCount: pois.length,
        rawResult: result
      });
      
      if (result.success && pois.length > 0) {
        // Mark all POIs as marine
        let marinePOIs = pois.map(poi => ({
          ...poi,
          isMarine: true,
          category: poi.category || poi.marine_type || 'wreck'
        }));
        
        // FILTRO GEOGRAFICO: Filtra i POI marini per assicurarsi che siano dentro la zona
        if (window.selectedZone && window.selectedZone.getLatLngs && window.selectedZone.getLatLngs().length > 0) {
          const zonePolygon = window.selectedZone.getLatLngs()[0].map(p => [p.lat, p.lng]);
          
          // Helper function per verificare se un punto è dentro il poligono
          function isPointInPolygon(point, polygon) {
            const [lat, lng] = point;
            let inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
              const [piLat, piLng] = polygon[i];
              const [pjLat, pjLng] = polygon[j];
              const intersect = ((piLat > lat) !== (pjLat > lat)) &&
                                (lng < (pjLng - piLng) * (lat - piLat) / (pjLat - piLat) + piLng);
              if (intersect) inside = !inside;
            }
            return inside;
          }
          
          const filteredPOIs = marinePOIs.filter(poi => {
            if (!poi.lat || !poi.lng) return false;
            const inside = isPointInPolygon([poi.lat, poi.lng], zonePolygon);
            if (!inside) {
              console.warn(`⚠️ POI marino "${poi.name}" (${poi.lat}, ${poi.lng}) è fuori dalla zona, filtrato`);
            }
            return inside;
          });
          
          console.log(`🌊 Filtro geografico: ${marinePOIs.length} POI totali → ${filteredPOIs.length} POI dentro la zona`);
          marinePOIs = filteredPOIs;
        }
        
        console.log(`🌊 Found ${marinePOIs.length} marine POIs (after geographic filter)`);
        
        // Store provisional POIs
        window.currentMunicipality = {
          name: 'Mare',
          id: 'MARINE_EXTENSION',
          isMarine: true
        };
        window.currentPOIs = marinePOIs;
        
        // Show the POI preview modal
        showPOIPreviewModal(marinePOIs, window.currentMunicipality);
        
        // Aggiungi i POI marini alla mappa (come i POI normali)
        if (marinePOIs.length > 0) {
          poiLayer.clearLayers();
          marinePOIs.forEach(poi => {
            if (poi.lat && poi.lng) {
              createPOIMarker(poi);
            }
          });
        }
        
        progress.complete(`✅ Trovati ${marinePOIs.length} POI marini`);
        setStatus(`✅ Trovati ${marinePOIs.length} POI marini`, "ok");
      } else {
        console.warn('[MARINE SEARCH] No POIs found:', {
          success: result.success,
          poisCount: pois.length,
          hasResults: !!result.results,
          resultKeys: Object.keys(result)
        });
        progress.complete("Nessun POI marino trovato");
        setStatus(`ℹ️ Nessun POI marino trovato per questa zona`, "info");
        alert("Nessun POI marino trovato per questa zona.");
      }
      
    } catch (error) {
      console.error("❌ Error searching marine POIs:", error);
      progressManager.errorProgress('poi_search_marine', error.message);
      setStatus(`❌ Errore ricerca marina: ${error.message}`, "error");
      alert(`Errore durante la ricerca marina: ${error.message}`);
    }
  }

  // Function to search POIs for a municipality
  async function searchPOIsForMunicipality(municipality) {
    console.log("🔍 Starting POI search for municipality:", municipality.name);
    
    try {
      setStatus(`🔍 Ricerca POI per ${municipality.name}...`, "info");
      
      // Start progress tracking
      const progress = progressManager.start(
        'poi_search_municipality',
        `🔍 Ricerca POI - ${municipality.name}`,
        100
      );
      
      progress.update(10, 'Avvio ricerca...');
      
      // Call the server endpoint
      const response = await fetch("/admin/pois/search-municipality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipality: municipality,
          zone: {
            _id: window.currentMunicipalityData.zone.zoneId,
            name: window.currentMunicipalityData.zone.zoneName,
            coordinates: (window.extractZoneCoordinates
              ? window.extractZoneCoordinates(window.currentMunicipalityData.zone)
              : window.currentMunicipalityData.zone.getLatLngs()[0].map(point => [point.lat, point.lng]))
          }
        })
      });
      
      if (!response.ok) {
        throw new Error("Errore server");
      }
      
      progress.update(30, 'Recupero risultati...');
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Found ${result.pois.length} POIs for ${municipality.name}`);
        
        // Store provisional POIs
        window.currentMunicipality = municipality;
        window.currentPOIs = result.pois;
        
        // Show the POI preview modal
        showPOIPreviewModal(result.pois, municipality);
        
        progress.complete(`✅ Trovati ${result.pois.length} POI`);
        setStatus(`✅ Trovati ${result.pois.length} POI per ${municipality.name}`, "ok");
      } else {
        throw new Error(result.message || "Errore nella ricerca");
      }
      
    } catch (error) {
      console.error("❌ Error searching POIs:", error);
      progressManager.errorProgress('poi_search_municipality', error.message);
      setStatus(`❌ Errore: ${error.message}`, "error");
    }
  }
  
  // Function to show POI preview modal with provisional POIs
  function showPOIPreviewModal(pois, municipality) {
    console.log(`📋 Showing POI preview: ${pois.length} POIs for ${municipality.name}`);
    
    const tbody = document.getElementById('poiPreviewTableBody');
    const countBadge = document.getElementById('poiPreviewCount');
    
    if (!tbody) {
      console.error("❌ POI preview table body not found");
      return;
    }
    
    // Clear previous content
    tbody.innerHTML = '';
    
    if (pois.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nessun POI trovato</td></tr>';
      if (countBadge) countBadge.textContent = '0 POI trovati';
    } else {
      // Populate table with columns: Foto, Nome, Descrizione, Lat, Lng, Fonte, Azioni
      pois.forEach((poi, index) => {
        const row = document.createElement('tr');
        
        // Photo cell
        const photoCell = document.createElement('td');
        if (poi.imageUrl && poi.imageUrl.trim() !== '') {
          photoCell.innerHTML = `<img src="${poi.imageUrl}" alt="${poi.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%;">`;
        } else {
          photoCell.innerHTML = '<span style="font-size: 24px;">📍</span>';
        }
        
        // Name cell
        const nameCell = document.createElement('td');
        nameCell.textContent = poi.name;
        nameCell.style.fontWeight = 'bold';
        
        // Se è un POI marino, colora il nome in blu
        if (poi.isMarine || poi.category === 'wreck' || poi.category === 'marina' || poi.category === 'harbor' || poi.category === 'lighthouse') {
          nameCell.style.color = '#007bff';
          nameCell.innerHTML = `<span style="color: #007bff;">🌊 ${poi.name}</span>`;
        }
        
        // Description cell
        const descCell = document.createElement('td');
        const descText = poi.description || 'Nessuna descrizione disponibile';
        descCell.textContent = descText.length > 80 ? descText.substring(0, 80) + '...' : descText;
        descCell.style.fontSize = '0.9rem';
        
        // Lat cell
        const latCell = document.createElement('td');
        latCell.textContent = poi.lat ? poi.lat.toFixed(6) : '-';
        latCell.style.fontSize = '0.85rem';
        
        // Lng cell
        const lngCell = document.createElement('td');
        lngCell.textContent = poi.lng ? poi.lng.toFixed(6) : '-';
        lngCell.style.fontSize = '0.85rem';
        
        // Source cell
        const sourceCell = document.createElement('td');
        sourceCell.textContent = poi.source || 'internet';
        sourceCell.style.fontSize = '0.85rem';
        
        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.innerHTML = `
          <div class="btn-group" role="group">
            <button class="btn btn-sm btn-success" onclick="saveSingleProvisionalPOI(${index})" title="Salva questo POI nel database definitivo">
              💾 Salva
            </button>
            <button class="btn btn-sm btn-primary" onclick="editProvisionalPOI(${index})" title="Modifica questo POI">
              ✏️ Modifica
            </button>
            <button class="btn btn-sm btn-danger" onclick="removeProvisionalPOI(${index})" title="Rimuovi dalla lista">
              🗑️ Rimuovi
            </button>
          </div>
        `;
        
        row.appendChild(photoCell);
        row.appendChild(nameCell);
        row.appendChild(descCell);
        row.appendChild(latCell);
        row.appendChild(lngCell);
        row.appendChild(sourceCell);
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
      });
      
      if (countBadge) countBadge.textContent = `${pois.length} POI trovati`;
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('poiPreviewModal'));
    modal.show();
  }
  
  // Global functions for POI management
  window.editProvisionalPOI = function(index) {
    const poi = window.currentPOIs[index];
    if (!poi) {
      console.error("❌ POI not found at index:", index);
      return;
    }
    
    console.log("✏️ Editing provisional POI:", poi.name);
    
    // Populate manual edit modal
    document.getElementById('poiEditName').value = poi.name || '';
    document.getElementById('poiEditDescription').value = poi.description || '';
    document.getElementById('poiEditLat').value = poi.lat || '';
    document.getElementById('poiEditLng').value = poi.lng || '';
    
    // Store POI index for saving
    window.editingPOIIndex = index;
    window.editingPOI = poi;
    
    // Close preview modal
    const previewModal = bootstrap.Modal.getInstance(document.getElementById('poiPreviewModal'));
    if (previewModal) {
      previewModal.hide();
    }
    
    // Show edit modal
    const editModal = new bootstrap.Modal(document.getElementById('poiManualEditModal'));
    editModal.show();
  };
  
  window.removeProvisionalPOI = function(index) {
    const poi = window.currentPOIs[index];
    if (!poi) return;
    
    if (confirm(`Rimuovere "${poi.name}" dalla lista provvisoria?`)) {
      window.currentPOIs.splice(index, 1);
      showPOIPreviewModal(window.currentPOIs, window.currentMunicipality);
      setStatus(`✅ POI rimosso dalla lista provvisoria`, "info");
    }
  };

  // Helper function to normalize source values
  function normalizeSource(source) {
    if (!source) return 'internet';
    const sourceMap = {
      'Wikipedia': 'wikipedia',
      'Institutional': 'internet',
      'OSM': 'osm',
      'AI': 'AI',
      'Manual': 'manual',
      'wikipedia': 'wikipedia',
      'osm': 'osm',
      'internet': 'internet'
    };
    return sourceMap[source] || 'internet';
  }

  // Function to save a single provisional POI directly without editing
  window.saveSingleProvisionalPOI = async function(index) {
    const poi = window.currentPOIs[index];
    if (!poi) {
      alert('Errore: POI non trovato');
      return;
    }
    
    if (!confirm(`Salvare "${poi.name}" nel database definitivo?`)) {
      return;
    }
    
    try {
      // Create FormData with POI data
      const formData = new FormData();
      formData.append('name', poi.name);
      formData.append('description', poi.description || '');
      formData.append('lat', poi.lat);
      formData.append('lng', poi.lng);
      formData.append('zone', window.currentMunicipalityData?.zone?.zoneId || window.selectedZone?.id);
      formData.append('category', poi.category || 'other');
      formData.append('semanticCategory', poi.semanticCategory || '');
      formData.append('source', normalizeSource(poi.source));
      formData.append('imageUrl', poi.imageUrl || '');
      
      console.log("💾 Saving POI to database:", poi.name, "source:", normalizeSource(poi.source));
      setStatus("💾 Salvataggio POI in corso...", "info");
      
      const response = await fetch("/admin/pois", {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error:", errorText);
        throw new Error("Errore server");
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log("✅ POI saved successfully:", result.poi);
        setStatus(`✅ "${poi.name}" salvato nel database definitivo!`, "ok");
        
        // Remove from provisional list
        window.currentPOIs.splice(index, 1);
        
        // Update preview modal or close if empty
        if (window.currentPOIs.length > 0) {
          showPOIPreviewModal(window.currentPOIs, window.currentMunicipality);
        } else {
          const previewModal = bootstrap.Modal.getInstance(document.getElementById('poiPreviewModal'));
          if (previewModal) {
            previewModal.hide();
          }
          setStatus("✅ Tutti i POI sono stati salvati nel database!", "ok");
        }
        
        // Reload POIs on map
        if (window.selectedZone && window.selectedZone.id) {
          await loadPOIs(window.selectedZone.id);
        }
      } else {
        throw new Error(result.message || "Errore salvataggio");
      }
      
    } catch (error) {
      console.error("❌ Error saving POI:", error);
      setStatus(`❌ Errore: ${error.message}`, "error");
      alert(`Errore salvataggio: ${error.message}`);
    }
  };
  
  // Function to save a single provisional POI to database
  window.saveEditedProvisionalPOI = async function() {
    const poiIndex = window.editingPOIIndex;
    const poi = window.editingPOI;
    
    if (!poi || poiIndex === undefined) {
      alert('Errore: POI non trovato');
      return;
    }
    
    try {
      // Get form data
      const formData = new FormData();
      formData.append('name', document.getElementById('poiEditName').value);
      formData.append('description', document.getElementById('poiEditDescription').value);
      formData.append('lat', document.getElementById('poiEditLat').value);
      formData.append('lng', document.getElementById('poiEditLng').value);
      formData.append('zone', window.currentMunicipalityData?.zone?.zoneId || window.selectedZone?.id);
      formData.append('category', poi.category || 'other');
      formData.append('semanticCategory', poi.semanticCategory || '');
      formData.append('source', normalizeSource(poi.source));
      formData.append('imageUrl', poi.imageUrl || '');
      formData.append('coordStatus', 'confirmed'); // Quando modificato manualmente, le coordinate sono confermate
      
      // Handle photo upload if present
      const photoInput = document.getElementById('poiEditPhoto');
      if (photoInput && photoInput.files && photoInput.files[0]) {
        formData.append('photo', photoInput.files[0]);
      }
      
      console.log("💾 Saving POI to database:", formData.get('name'));
      setStatus("💾 Salvataggio POI in corso...", "info");
      
      const response = await fetch("/admin/pois", {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) {
        throw new Error("Errore server");
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log("✅ POI saved successfully:", result.poi);
        setStatus("✅ POI salvato nel database definitivo!", "ok");
        
        // Close edit modal FIRST
        const editModal = bootstrap.Modal.getInstance(document.getElementById('poiManualEditModal'));
        if (editModal) {
          editModal.hide();
        }
        
        // Remove POI from cache provvisoria
        const poiName = formData.get('name');
        const zoneId = formData.get('zone');
        const municipalityId = window.currentMunicipality?.id || window.currentMunicipality?.name;
        
        if (zoneId && municipalityId) {
          try {
            const deleteUrl = `/admin/pois/provisional/${zoneId}/${municipalityId}/${encodeURIComponent(poiName)}`;
            await fetch(deleteUrl, { method: 'DELETE' });
            console.log("🗑️ POI rimosso dalla cache provvisoria");
          } catch (error) {
            console.warn("⚠️ Errore rimozione da cache:", error);
          }
        }
        
        // Remove from provisional list AFTER closing modal
        window.currentPOIs.splice(poiIndex, 1);
        
        // Clear editing state
        window.editingPOIIndex = undefined;
        window.editingPOI = null;
        
        // Update preview modal or close if empty
        if (window.currentPOIs.length > 0) {
          // Refresh the preview modal with updated list
          showPOIPreviewModal(window.currentPOIs, window.currentMunicipality);
          setStatus(`✅ POI salvato! Rimangono ${window.currentPOIs.length} POI provvisori da gestire`, "ok");
        } else {
          // Close preview modal if no more provisional POIs
          const previewModal = bootstrap.Modal.getInstance(document.getElementById('poiPreviewModal'));
          if (previewModal) {
            previewModal.hide();
          }
          setStatus("✅ Tutti i POI sono stati salvati nel database!", "ok");
        }
        
        // Reload POIs on map to show the new saved POI
        if (window.selectedZone && window.selectedZone.id) {
          await loadPOIs(window.selectedZone.id);
        }
        
      } else {
        throw new Error(result.message || "Errore salvataggio");
      }
      
    } catch (error) {
      console.error("❌ Error saving POI:", error);
      setStatus(`❌ Errore: ${error.message}`, "error");
    }
  };
  
  // Use event delegation for dynamically created buttons
  document.addEventListener('click', async (e) => {
    // Handle savePOI button (provisional POI)
    if (e.target && e.target.id === 'savePOI') {
      if (window.editingPOIIndex !== undefined) {
        // This is a provisional POI being saved
        e.preventDefault();
        await window.saveEditedProvisionalPOI();
      } else {
        // This is a regular POI edit (not provisional)
        console.log("Regular POI edit - not implemented in this context");
      }
    }
    

  });
  
  // =======================================================
  // MUNICIPALITY CONTEXT MENU & EDIT/DELETE
  // =======================================================
  
  let currentMunicipalityBeingEdited = null;
  
  function showMunicipalityContextMenu(event, municipality) {
    event.preventDefault();
    
    // Remove existing context menu if any
    const existingMenu = document.getElementById('municipalityContextMenu');
    if (existingMenu) {
      existingMenu.remove();
    }
    
    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'municipalityContextMenu';
    menu.className = 'list-group';
    menu.style.position = 'fixed';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.style.zIndex = '10000';
    menu.style.minWidth = '200px';
    menu.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    
    menu.innerHTML = `
      <button type="button" class="list-group-item list-group-item-action" id="editMunicipalityBtn">
        ✏️ Modifica Nome
      </button>
      <button type="button" class="list-group-item list-group-item-action text-danger" id="deleteMunicipalityBtnContext">
        🗑️ Elimina
      </button>
    `;
    
    document.body.appendChild(menu);
    
    // Handle edit button
    const editBtn = document.getElementById('editMunicipalityBtn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        menu.remove();
        currentMunicipalityBeingEdited = municipality;
        showMunicipalityEditModal(municipality);
      });
    }
    
    // Handle delete button
    const deleteBtn = document.getElementById('deleteMunicipalityBtnContext');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
      menu.remove();
      currentMunicipalityBeingEdited = municipality;
      showMunicipalityEditModal(municipality, 'delete');
      });
    }
    
    // Close menu when clicking outside
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }, 100);
    }, 100);
  }
  
  function showMunicipalityEditModal(municipality, mode = 'edit') {
    console.log('Opening edit modal for municipality:', municipality);
    console.log('Municipality ID:', municipality.id);
    
    document.getElementById('municipalityNameDisplay').textContent = municipality.name;
    document.getElementById('newMunicipalityName').value = municipality.name;
    currentMunicipalityBeingEdited = municipality;
    
    const modal = new bootstrap.Modal(document.getElementById('municipalityEditModal'));
    modal.show();
  }
  
  async function saveMunicipalityEdit() {
    console.log('💾 Salvataggio modifica municipio...');
    
    const newName = document.getElementById('newMunicipalityName').value.trim();
    
    if (!newName) {
      alert('Inserisci un nome valido');
      return;
    }
    
    if (currentMunicipalityBeingEdited) {
      console.log('Municipio in modifica:', currentMunicipalityBeingEdited);
      
      try {
        // Call server API to update municipality name in cache
        const zoneId = window.currentMunicipalityData?.zone?.zoneId;
        const municipalityId = currentMunicipalityBeingEdited.id;
        
        if (!zoneId || !municipalityId) {
          console.error('Zone ID or Municipality ID missing');
          alert('Errore: dati mancanti per l\'aggiornamento');
          return;
        }
        
        setStatus('💾 Salvataggio nome municipio...', 'info');
        
        // Passa il vecchio nome per facilitare la ricerca nella cache
        const oldName = currentMunicipalityBeingEdited.name;
        
        const response = await fetch('/admin/municipalities/update-name', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            zoneId: zoneId,
            municipalityId: municipalityId,
            newName: newName,
            oldName: oldName // Passa il vecchio nome per la ricerca nella cache
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log('✅ Municipality name updated on server');
          
          // Update the municipality in the list
          const municipalityList = document.getElementById('municipalityList');
          if (!municipalityList) {
            console.error('Municipality list not found');
            return;
          }
          
          const items = municipalityList.querySelectorAll('.list-group-item');
          console.log('Elementi trovati nella lista:', items.length);
          
          for (let item of items) {
            const itemId = item.dataset.municipalityId;
            const currentId = currentMunicipalityBeingEdited.id;
            
            console.log('Confronto ID:', itemId, 'con', currentId, 'Match:', itemId === currentId);
            
            // Try both ID comparison and object reference
            if (itemId === currentId || item.municipalityData === currentMunicipalityBeingEdited) {
              console.log('Elemento trovato, aggiornamento...');
              
              // Update innerHTML
              item.innerHTML = `<strong>${newName}</strong>`;
              
              // Update municipality data
              item.municipalityData.name = newName;
              currentMunicipalityBeingEdited.name = newName;
              
              // Update in window.currentMunicipalityData
              if (window.currentMunicipalityData && window.currentMunicipalityData.municipalities) {
                const index = window.currentMunicipalityData.municipalities.findIndex(
                  m => m.id === currentMunicipalityBeingEdited.id
                );
                if (index !== -1) {
                  window.currentMunicipalityData.municipalities[index].name = newName;
                  console.log('Aggiornato in currentMunicipalityData');
                }
              }
              
              setStatus(`✅ Municipio rinominato in "${newName}" e salvato nella cache`, "ok");
              break;
            }
          }
          
          // Close modal
          const modal = bootstrap.Modal.getInstance(document.getElementById('municipalityEditModal'));
          if (modal) {
            modal.hide();
          }
          
        } else {
          // Se il municipio non è stato trovato nella cache, ricarica la lista dei municipi
          if (result.message && result.message.includes('not found in cache')) {
            console.warn('⚠️ Municipio non trovato nella cache, ricarico la lista dei municipi...');
            
            // Chiudi il modal di modifica
            const modal = bootstrap.Modal.getInstance(document.getElementById('municipalityEditModal'));
            if (modal) {
              modal.hide();
            }
            
            // Ricarica la lista dei municipi per la zona attiva
            if (window.currentMunicipalityData?.zone?.zoneId) {
              setStatus('🔄 Ricarico lista municipi...', 'info');
              
              try {
                // Estrai coordinate zona (gestisce sia layer che oggetto zona)
                const zoneCoordinates = window.extractZoneCoordinates
                  ? window.extractZoneCoordinates(window.currentMunicipalityData.zone)
                  : (window.currentMunicipalityData.zone.getLatLngs 
                    ? window.currentMunicipalityData.zone.getLatLngs()[0].map(point => [point.lat, point.lng])
                    : window.currentMunicipalityData.zone.coordinates || []);
                
                const reloadResponse = await fetch("/admin/pois/auto", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ 
                    zoneId: window.currentMunicipalityData.zone.zoneId,
                    coordinates: zoneCoordinates
                  })
                });
                
                if (reloadResponse.ok) {
                  const reloadResult = await reloadResponse.json();
                  if (reloadResult.success && reloadResult.municipalities) {
                    window.currentMunicipalityData.municipalities = reloadResult.municipalities;
                    showMunicipalitySelectionModal(reloadResult.municipalities, reloadResult.fromCache || false);
                    setStatus(`✅ Lista municipi ricaricata. Il nome "${newName}" è stato aggiornato.`, "ok");
                    return;
                  }
                }
              } catch (reloadError) {
                console.error('❌ Errore ricaricamento municipi:', reloadError);
              }
            }
            
            throw new Error('Municipio non trovato nella cache. Lista municipi ricaricata.');
        } else {
          throw new Error(result.message || 'Errore aggiornamento nome');
          }
        }
        
      } catch (error) {
        console.error('❌ Error updating municipality name:', error);
        setStatus(`❌ Errore: ${error.message}`, 'error');
        alert(`Errore salvataggio: ${error.message}`);
      }
    } else {
      console.error('currentMunicipalityBeingEdited is null');
    }
  }
  
  function deleteMunicipality() {
    if (!currentMunicipalityBeingEdited) return;
    
    if (confirm(`Sei sicuro di voler eliminare "${currentMunicipalityBeingEdited.name}"?`)) {
      // Remove from the list
      const municipalityList = document.getElementById('municipalityList');
      const items = municipalityList.querySelectorAll('.list-group-item');
      
      for (let item of items) {
        if (item.dataset.municipalityId === currentMunicipalityBeingEdited.id) {
          item.remove();
          
          // Remove from window.currentMunicipalityData
          if (window.currentMunicipalityData && window.currentMunicipalityData.municipalities) {
            window.currentMunicipalityData.municipalities = 
              window.currentMunicipalityData.municipalities.filter(
                m => m.id !== currentMunicipalityBeingEdited.id
              );
          }
          
          setStatus(`🗑️ Municipio "${currentMunicipalityBeingEdited.name}" eliminato`, "info");
          break;
        }
      }
      
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('municipalityEditModal'));
      if (modal) {
        modal.hide();
      }
      
      currentMunicipalityBeingEdited = null;
    }
  }
  
  // =======================================================
  // MUNICIPALITY EDIT/DELETE EVENT DELEGATION
  // =======================================================
  
  // Use event delegation for municipality edit/delete buttons
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'saveMunicipalityBtn') {
      console.log('✅ Pulsante Salva cliccato');
      e.preventDefault();
      e.stopPropagation();
      saveMunicipalityEdit();
    }
    
    if (e.target && e.target.id === 'deleteMunicipalityBtn') {
      console.log('🗑️ Pulsante Elimina cliccato');
      e.preventDefault();
      e.stopPropagation();
      deleteMunicipality();
    }
  });
  
  // =======================================================
  // POI FILTERING
  // =======================================================
  
  function filterPOIsByType(pois) {
    if (currentPOIFilter === 'all') {
      return pois;
    } else if (currentPOIFilter === 'definitive') {
      return pois.filter(poi => poi.isDefinitive === true || poi.isDefinitive === 'true');
    } else if (currentPOIFilter === 'provisional') {
      return pois.filter(poi => !poi.isDefinitive || poi.isDefinitive === false || poi.isDefinitive === 'false');
    }
    return pois;
  }
  
  function refreshPOIDisplay() {
    if (cachedPOIs.length === 0) {
      return; // Nessun POI in cache, non fare nulla
    }
    
    // Pulisci i marker attuali
    poiLayer.clearLayers();
    
    // Filtra e mostra i POI in base al filtro selezionato
    const filteredPOIs = filterPOIsByType(cachedPOIs);
    console.log(`🔄 Aggiornamento visualizzazione: ${filteredPOIs.length} POI (filtro: ${currentPOIFilter})`);
    
    filteredPOIs.forEach(poi => createPOIMarker(poi));
    
    // Aggiorna il contatore
    if (window.selectedZone && window.selectedZone.id) {
      updatePOICounter(window.selectedZone.id, filteredPOIs.length);
    }
    
    setStatus(`POI visualizzati: ${filteredPOIs.length} / ${cachedPOIs.length}`, "ok");
  }
  
  // Funzione globale per cambiare il filtro (chiamata dai pulsanti)
  window.setPOIFilter = function(filterType) {
    if (filterType !== 'all' && filterType !== 'definitive' && filterType !== 'provisional') {
      console.error('❌ Tipo filtro non valido:', filterType);
      return;
    }
    
    currentPOIFilter = filterType;
    console.log(`🔍 Cambio filtro POI: ${filterType}`);
    
    // Aggiorna lo stato visivo dei pulsanti
    document.querySelectorAll('.poi-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    if (filterType === 'all') {
      document.getElementById('filterAllPOIs')?.classList.add('active');
    } else if (filterType === 'definitive') {
      document.getElementById('filterDefinitivePOIs')?.classList.add('active');
    } else if (filterType === 'provisional') {
      document.getElementById('filterProvisionalPOIs')?.classList.add('active');
    }
    
    // Aggiorna la visualizzazione dei POI
    refreshPOIDisplay();
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
