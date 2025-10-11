// ==========================================
// MAP POI MANAGER — Andaly Whatis v1.1
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Map POI Manager (v1.1)");

  const map = L.map("map").setView([44.35, 9.18], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  let selectedZone = null;
  let addingPOI = false;
  const poiMarkers = [];
  const statusBox = document.getElementById("zoneStatus");
  const btnInsertPOI = document.getElementById("btnInserisciPOI");

  const setStatus = (msg, color = "#b0cfff") => {
    if (statusBox) {
      statusBox.innerHTML = msg;
      statusBox.style.color = color;
    }
    console.log(msg);
  };

  const clearPoiMarkers = () => {
    poiMarkers.forEach((m) => map.removeLayer(m));
    poiMarkers.length = 0;
  };

  const addPoiMarker = (poi) => {
    const marker = L.marker([poi.lat, poi.lng], { draggable: true }).addTo(map);
    marker.bindPopup(`
      <b>${poi.name}</b><br>
      <button class="btn-edit" data-id="${poi._id}">✏️ Modifica</button>
      <button class="btn-delete" data-id="${poi._id}">🗑️ Elimina</button>
    `);
    marker.poiId = poi._id;
    marker.on("popupopen", handlePopupButtons);
    marker.on("dragend", handleMarkerDrag);
    poiMarkers.push(marker);
  };

  const handlePopupButtons = (e) => {
    const container = e.popup._contentNode;
    const btnEdit = container.querySelector(".btn-edit");
    const btnDelete = container.querySelector(".btn-delete");
    if (btnEdit)
      btnEdit.addEventListener("click", async () => {
        const id = btnEdit.dataset.id;
        const newName = prompt("Nuovo nome del POI:");
        if (!newName) return;
        await fetch(`/admin/pois/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });
        setStatus(`✏️ POI aggiornato: ${newName}`, "#00ffcc");
        loadPOIsByZone(selectedZone.zoneId);
      });
    if (btnDelete)
      btnDelete.addEventListener("click", async () => {
        const id = btnDelete.dataset.id;
        if (!confirm("Eliminare questo POI?")) return;
        await fetch(`/admin/pois/${id}`, { method: "DELETE" });
        setStatus("🗑️ POI eliminato", "red");
        loadPOIsByZone(selectedZone.zoneId);
      });
  };

  const handleMarkerDrag = async (e) => {
    const marker = e.target;
    const pos = marker.getLatLng();
    await fetch(`/admin/pois/${marker.poiId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: pos.lat, lng: pos.lng }),
    });
    setStatus("📍 Posizione aggiornata", "#00ffcc");
  };

  const fetchPOIs = async (zoneId = null) => {
    const url = zoneId
      ? `/admin/pois?zone=${encodeURIComponent(zoneId)}&format=json`
      : `/admin/pois?format=json`;
    const res = await fetch(url);
    return res.json();
  };

  const loadPOIsByZone = async (zoneId) => {
    try {
      const pois = await fetchPOIs(zoneId);
      clearPoiMarkers();
      pois.forEach(addPoiMarker);
      setStatus(`📍 POI caricati: ${pois.length}`);
    } catch (e) {
      console.error(e);
      setStatus("❌ Errore caricamento POI", "red");
    }
  };

  // Carica zone
  fetch("/admin/zones?format=json")
    .then((r) => r.json())
    .then((zones) => {
      zones.forEach((z) => {
        const layer = L.polygon(z.coordinates, {
          color: "blue",
          weight: 2,
          fillOpacity: 0.15,
        })
          .addTo(map)
          .bindPopup(`<b>${z.name}</b><br>${z.description || ""}`);
        layer.zoneId = z._id;
        layer.zoneName = z.name;

        layer.on("click", () => {
          if (selectedZone) selectedZone.setStyle({ color: "blue" });
          selectedZone = layer;
          layer.setStyle({ color: "yellow" });
          loadPOIsByZone(layer.zoneId);
          setStatus(`🗺️ Zona selezionata: ${layer.zoneName}`);
        });
      });
    });

  // Inserimento POI manuale
  if (btnInsertPOI) {
    btnInsertPOI.addEventListener("click", () => {
      addingPOI = !addingPOI;
      btnInsertPOI.classList.toggle("active", addingPOI);
      setStatus(
        addingPOI
          ? "🟢 Modalità inserimento attiva — clicca dentro la zona selezionata"
          : "⚫ Modalità disattivata",
        addingPOI ? "#00ffcc" : "#b0cfff"
      );
    });
  }

  map.on("click", async (e) => {
    if (!addingPOI || !selectedZone) return;

    const poiName = prompt("Nome del nuovo POI:");
    if (!poiName) return;

    const newPoi = {
      name: poiName,
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      zone: selectedZone.zoneId,
    };

    const res = await fetch("/admin/pois", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPoi),
    });
    const result = await res.json();

    if (result.success) {
      addPoiMarker(result.poi);
      setStatus(`✅ POI "${poiName}" inserito`, "#00ffcc");
    } else {
      setStatus("❌ Errore salvataggio POI", "red");
    }

    addingPOI = false;
    btnInsertPOI.classList.remove("active");
  });
});