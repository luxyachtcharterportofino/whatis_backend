// ===============================
// 🔍 Perplexity Search UI Handler
// Gestisce l'interfaccia di ricerca POI con Perplexity
// ===============================

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('perplexitySearchForm');
  const searchBtn = document.getElementById('searchBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const resultsSection = document.getElementById('resultsSection');
  
  // Gestione submit form
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const zoneId = document.getElementById('zoneSelect').value;
    const searchType = document.querySelector('input[name="searchType"]:checked').value;
    const autoSave = document.getElementById('autoSave').checked;
    const showDedup = document.getElementById('showDedup').checked;
    
    if (!zoneId) {
      alert('Seleziona una zona');
      return;
    }
    
    // Mostra loading
    searchBtn.disabled = true;
    loadingSpinner.classList.remove('d-none');
    resultsSection.classList.add('d-none');
    
    try {
      // Determina endpoint
      const endpoint = searchType === 'marine' 
        ? `/admin/perplexity/wrecks/${zoneId}`
        : `/admin/perplexity/pois/${zoneId}`;
      
      // Aggiungi query params
      const url = `${endpoint}?autoSave=${autoSave}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        displayResults(data, showDedup);
      } else {
        displayError(data.message || 'Errore durante la ricerca');
      }
      
    } catch (error) {
      console.error('Errore ricerca:', error);
      displayError('Errore di connessione: ' + error.message);
    } finally {
      searchBtn.disabled = false;
      loadingSpinner.classList.add('d-none');
    }
  });
  
  // Gestione cambio tipo ricerca
  document.querySelectorAll('input[name="searchType"]').forEach(radio => {
    radio.addEventListener('change', function() {
      // Aggiorna URL se necessario
      const newType = this.value;
      const currentUrl = new URL(window.location);
      currentUrl.searchParams.set('type', newType);
      window.history.pushState({}, '', currentUrl);
    });
  });
});

/**
 * Mostra i risultati della ricerca
 */
function displayResults(data, showDedup) {
  const resultsSection = document.getElementById('resultsSection');
  resultsSection.classList.remove('d-none');
  
  // Badge modalità
  const modeBadge = document.getElementById('modeBadge');
  const modeClass = data.mode === 'API' ? 'bg-success' : 'bg-warning';
  const modeText = data.mode === 'API' ? 'API Reale' : 'Modalità MOCK';
  modeBadge.innerHTML = `<span class="badge ${modeClass} fs-6">${modeText}</span>`;
  
  // Statistiche
  const statsSection = document.getElementById('statsSection');
  statsSection.innerHTML = `
    <div class="col-md-3">
      <div class="card bg-primary text-white">
        <div class="card-body text-center">
          <h5>POI Trovati</h5>
          <h3>${data.stats.totalFound}</h3>
        </div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card bg-success text-white">
        <div class="card-body text-center">
          <h5>Nuovi</h5>
          <h3>${data.stats.new}</h3>
        </div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card bg-warning text-dark">
        <div class="card-body text-center">
          <h5>Duplicati</h5>
          <h3>${data.stats.duplicates}</h3>
        </div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card bg-info text-white">
        <div class="card-body text-center">
          <h5>Suggerimenti</h5>
          <h3>${data.stats.suggestions}</h3>
        </div>
      </div>
    </div>
  `;
  
  // POI Nuovi
  const newPOIsSection = document.getElementById('newPOIsSection');
  if (data.newPOIs && data.newPOIs.length > 0) {
    let html = '<h6 class="text-success mb-3">✅ POI Nuovi (Non Duplicati)</h6>';
    html += '<div class="table-responsive"><table class="table table-dark table-striped">';
    html += '<thead><tr><th>Nome</th><th>Categoria</th><th>Coordinate</th><th>Descrizione</th><th>Azioni</th></tr></thead><tbody>';
    
    data.newPOIs.forEach(poi => {
      html += `
        <tr>
          <td><strong>${poi.name}</strong></td>
          <td><span class="badge bg-secondary">${poi.category || 'other'}</span></td>
          <td><small>${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}</small></td>
          <td><small>${(poi.description || '').substring(0, 100)}${poi.description && poi.description.length > 100 ? '...' : ''}</small></td>
          <td>
            <button class="btn btn-sm btn-info" onclick="showPOIDetail(${JSON.stringify(poi).replace(/"/g, '&quot;')})">Dettaglio</button>
            ${data.autoSaved ? '' : `<button class="btn btn-sm btn-success" onclick="approvePOI(${JSON.stringify(poi).replace(/"/g, '&quot;')})">Approva</button>`}
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table></div>';
    newPOIsSection.innerHTML = html;
  } else {
    newPOIsSection.innerHTML = '<p class="text-muted">Nessun POI nuovo trovato.</p>';
  }
  
  // Duplicati (solo se showDedup è true)
  const duplicatesSection = document.getElementById('duplicatesSection');
  if (showDedup && data.duplicates && data.duplicates.length > 0) {
    let html = '<h6 class="text-warning mb-3">⚠️ Duplicati Rilevati</h6>';
    html += '<div class="table-responsive"><table class="table table-dark table-striped">';
    html += '<thead><tr><th>POI Nuovo</th><th>POI Esistente</th><th>Score</th><th>Distanza</th></tr></thead><tbody>';
    
    data.duplicates.forEach(dup => {
      html += `
        <tr>
          <td><strong>${dup.new.name}</strong></td>
          <td><strong>${dup.existing.name}</strong> <small class="text-muted">(ID: ${dup.existing.id})</small></td>
          <td><span class="badge ${dup.score >= 0.8 ? 'bg-danger' : 'bg-warning'}">${(dup.score * 100).toFixed(0)}%</span></td>
          <td><small>${dup.distance ? dup.distance.toFixed(0) + 'm' : 'N/A'}</small></td>
        </tr>
      `;
    });
    
    html += '</tbody></table></div>';
    duplicatesSection.innerHTML = html;
  } else {
    duplicatesSection.innerHTML = '';
  }
  
  // Suggerimenti Merge
  const suggestionsSection = document.getElementById('suggestionsSection');
  if (showDedup && data.suggestions && data.suggestions.length > 0) {
    let html = '<h6 class="text-info mb-3">💡 Suggerimenti di Merge</h6>';
    html += '<div class="accordion" id="suggestionsAccordion">';
    
    data.suggestions.forEach((suggestion, index) => {
      html += `
        <div class="accordion-item bg-dark border-info">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed bg-dark text-light" type="button" data-bs-toggle="collapse" data-bs-target="#suggestion${index}">
              ${suggestion.nuovo.name} ↔ ${suggestion.existing.name} 
              <span class="badge ${suggestion.matchScore >= 0.8 ? 'bg-danger' : 'bg-warning'} ms-2">${(suggestion.matchScore * 100).toFixed(0)}% match</span>
            </button>
          </h2>
          <div id="suggestion${index}" class="accordion-collapse collapse" data-bs-parent="#suggestionsAccordion">
            <div class="accordion-body">
              <p><strong>Raccomandazione:</strong> ${suggestion.raccomandazione}</p>
              <p><strong>Distanza:</strong> ${suggestion.distance ? suggestion.distance.toFixed(0) + 'm' : 'N/A'}</p>
              ${suggestion.possibili_miglioramenti && suggestion.possibili_miglioramenti.length > 0 ? `
                <p><strong>Possibili miglioramenti:</strong></p>
                <ul>
                  ${suggestion.possibili_miglioramenti.map(imp => `<li>${imp}</li>`).join('')}
                </ul>
              ` : ''}
              <div class="mt-3">
                <button class="btn btn-sm btn-primary" onclick="showMergeDetail(${JSON.stringify(suggestion).replace(/"/g, '&quot;')})">Visualizza Dettagli</button>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    suggestionsSection.innerHTML = html;
  } else {
    suggestionsSection.innerHTML = '';
  }
  
  // Errori
  const errorsSection = document.getElementById('errorsSection');
  if (data.warning) {
    errorsSection.innerHTML = `<div class="alert alert-warning">${data.warning}</div>`;
  } else {
    errorsSection.innerHTML = '';
  }
  
  // Auto-saved
  if (data.autoSaved) {
    const autoSavedHtml = `
      <div class="alert alert-success">
        <strong>✅ ${data.autoSaved.count} POI salvati automaticamente:</strong>
        <ul class="mb-0 mt-2">
          ${data.autoSaved.pois.map(p => `<li>${p.name} (ID: ${p.id})</li>`).join('')}
        </ul>
      </div>
    `;
    resultsSection.insertAdjacentHTML('afterbegin', autoSavedHtml);
  }
}

/**
 * Mostra errore
 */
function displayError(message) {
  const errorsSection = document.getElementById('errorsSection');
  errorsSection.innerHTML = `<div class="alert alert-danger">${message}</div>`;
  document.getElementById('resultsSection').classList.remove('d-none');
}

/**
 * Mostra dettaglio POI in modal
 */
function showPOIDetail(poi) {
  const modal = new bootstrap.Modal(document.getElementById('poiDetailModal'));
  const title = document.getElementById('poiDetailTitle');
  const body = document.getElementById('poiDetailBody');
  const approveBtn = document.getElementById('approvePOIBtn');
  
  title.textContent = poi.name;
  approveBtn.setAttribute('data-poi-id', poi.id || '');
  approveBtn.style.display = poi.id ? 'none' : 'inline-block'; // Mostra solo se non già salvato
  
  body.innerHTML = `
    <div class="row">
      <div class="col-md-6">
        <p><strong>Categoria:</strong> <span class="badge bg-secondary">${poi.category || 'other'}</span></p>
        <p><strong>Coordinate:</strong> ${poi.lat.toFixed(6)}, ${poi.lng.toFixed(6)}</p>
        <p><strong>Fonte:</strong> ${poi.source || 'perplexity'}</p>
      </div>
      <div class="col-md-6">
        <p><strong>Descrizione:</strong></p>
        <p>${poi.description || 'Nessuna descrizione disponibile'}</p>
        ${poi.extraInfo && poi.extraInfo.depth ? `<p><strong>Profondità:</strong> ${poi.extraInfo.depth}m</p>` : ''}
      </div>
    </div>
    ${poi.extraInfo && poi.extraInfo.aiSummary ? `
      <div class="mt-3">
        <p><strong>Riassunto AI:</strong></p>
        <p class="text-muted">${poi.extraInfo.aiSummary}</p>
      </div>
    ` : ''}
  `;
  
  modal.show();
}

/**
 * Approva e salva POI
 */
async function approvePOI(poi) {
  if (!confirm(`Vuoi salvare il POI "${poi.name}" nel database?`)) {
    return;
  }
  
  const zoneId = document.getElementById('zoneSelect').value;
  if (!zoneId) {
    alert('Zona non selezionata');
    return;
  }
  
  try {
    // Crea FormData per compatibilità con la route esistente
    const formData = new FormData();
    formData.append('name', poi.name);
    formData.append('description', poi.description || '');
    formData.append('lat', poi.lat);
    formData.append('lng', poi.lng);
    formData.append('category', poi.category || 'other');
    formData.append('zone', zoneId);
    formData.append('source', 'perplexity');
    if (poi.semanticCategory) {
      formData.append('semanticCategory', poi.semanticCategory);
    }
    if (poi.extraInfo) {
      formData.append('extraInfo', JSON.stringify(poi.extraInfo));
    }
    
    const response = await fetch('/admin/pois', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert(`✅ POI "${poi.name}" salvato con successo!`);
      // Ricarica la pagina per aggiornare i risultati
      location.reload();
    } else {
      alert(`❌ Errore: ${data.message || 'Errore durante il salvataggio'}`);
    }
    
  } catch (error) {
    console.error('Errore salvataggio POI:', error);
    alert('Errore di connessione durante il salvataggio');
  }
}

/**
 * Mostra dettagli merge suggestion
 */
function showMergeDetail(suggestion) {
  const modal = new bootstrap.Modal(document.getElementById('poiDetailModal'));
  const title = document.getElementById('poiDetailTitle');
  const body = document.getElementById('poiDetailBody');
  const approveBtn = document.getElementById('approvePOIBtn');
  
  title.textContent = `Merge: ${suggestion.nuovo.name} ↔ ${suggestion.existing.name}`;
  approveBtn.style.display = 'none';
  
  body.innerHTML = `
    <div class="row">
      <div class="col-md-6">
        <h6 class="text-info">POI Esistente</h6>
        <p><strong>Nome:</strong> ${suggestion.existing.name}</p>
        <p><strong>ID:</strong> ${suggestion.existing.id}</p>
        <p><strong>Categoria:</strong> ${suggestion.existing.category}</p>
        <p><strong>Coordinate:</strong> ${suggestion.existing.lat}, ${suggestion.existing.lng}</p>
        <p><strong>Descrizione:</strong> ${suggestion.existing.description || 'N/A'}</p>
      </div>
      <div class="col-md-6">
        <h6 class="text-success">POI Nuovo</h6>
        <p><strong>Nome:</strong> ${suggestion.nuovo.name}</p>
        <p><strong>Categoria:</strong> ${suggestion.nuovo.category}</p>
        <p><strong>Coordinate:</strong> ${suggestion.nuovo.lat}, ${suggestion.nuovo.lng}</p>
        <p><strong>Descrizione:</strong> ${suggestion.nuovo.description || 'N/A'}</p>
      </div>
    </div>
    <hr class="border-info">
    <div class="mt-3">
      <p><strong>Score Match:</strong> <span class="badge ${suggestion.matchScore >= 0.8 ? 'bg-danger' : 'bg-warning'}">${(suggestion.matchScore * 100).toFixed(0)}%</span></p>
      <p><strong>Distanza:</strong> ${suggestion.distance ? suggestion.distance.toFixed(0) + 'm' : 'N/A'}</p>
      <p><strong>Raccomandazione:</strong> ${suggestion.raccomandazione}</p>
      ${suggestion.possibili_miglioramenti && suggestion.possibili_miglioramenti.length > 0 ? `
        <p><strong>Possibili miglioramenti:</strong></p>
        <ul>
          ${suggestion.possibili_miglioramenti.map(imp => `<li>${imp}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;
  
  modal.show();
}

