// ===============================
// 📊 Progress Manager - Server Side
// Gestisce il progresso delle operazioni in tempo reale
// ===============================

class ProgressManager {
  constructor() {
    this.operations = new Map();
  }

  /**
   * Avvia una nuova operazione
   * @param {string} operationId - ID univoco dell'operazione
   * @param {string} operationName - Nome dell'operazione
   * @param {number} totalSteps - Numero totale di passi
   */
  startOperation(operationId, operationName, totalSteps = 100) {
    this.operations.set(operationId, {
      id: operationId,
      name: operationName,
      totalSteps,
      currentStep: 0,
      percentage: 0,
      message: '',
      details: '',
      status: 'running', // running, completed, error
      startTime: new Date(),
      endTime: null,
      error: null
    });

    console.log(`📊 [PROGRESS] Started operation: ${operationName} (ID: ${operationId})`);
  }

  /**
   * Aggiorna il progresso di un'operazione
   * @param {string} operationId - ID dell'operazione
   * @param {number} percentage - Percentuale di completamento
   * @param {string} message - Messaggio di stato
   * @param {string} details - Dettagli aggiuntivi
   */
  updateProgress(operationId, percentage, message, details = '') {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`⚠️ [PROGRESS] Operation ${operationId} not found`);
      return;
    }

    operation.percentage = Math.min(100, Math.max(0, percentage));
    operation.message = message;
    operation.details = details;
    operation.currentStep++;

    console.log(`📊 [PROGRESS] ${operationId}: ${percentage}% - ${message} ${details}`);

    // Se raggiungiamo il 100%, marcia come completata
    if (operation.percentage >= 100) {
      this.completeOperation(operationId, message);
    }
  }

  /**
   * Completa un'operazione
   * @param {string} operationId - ID dell'operazione
   * @param {string} finalMessage - Messaggio finale
   * @param {*} result - Risultato dell'operazione (opzionale)
   */
  completeOperation(operationId, finalMessage = 'Operazione completata', result = null) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`⚠️ [PROGRESS] Operation ${operationId} not found`);
      return;
    }

    operation.status = 'completed';
    operation.percentage = 100;
    operation.message = finalMessage;
    operation.endTime = new Date();
    operation.result = result;

    console.log(`✅ [PROGRESS] Completed operation: ${operationId}`);

    // Rimuovi l'operazione dopo 5 minuti
    setTimeout(() => {
      this.operations.delete(operationId);
    }, 5 * 60 * 1000);
  }

  /**
   * Marca un'operazione come errore
   * @param {string} operationId - ID dell'operazione
   * @param {string} errorMessage - Messaggio di errore
   */
  errorOperation(operationId, errorMessage) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn(`⚠️ [PROGRESS] Operation ${operationId} not found`);
      return;
    }

    operation.status = 'error';
    operation.message = errorMessage;
    operation.error = errorMessage;
    operation.endTime = new Date();

    console.log(`❌ [PROGRESS] Error in operation: ${operationId} - ${errorMessage}`);

    // Rimuovi l'operazione dopo 5 minuti
    setTimeout(() => {
      this.operations.delete(operationId);
    }, 5 * 60 * 1000);
  }

  /**
   * Ottieni lo stato di un'operazione
   * @param {string} operationId - ID dell'operazione
   * @returns {Object|null} Stato dell'operazione
   */
  getOperationStatus(operationId) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return null;
    }

    return {
      id: operation.id,
      name: operation.name,
      percentage: operation.percentage,
      message: operation.message,
      details: operation.details,
      status: operation.status,
      startTime: operation.startTime,
      endTime: operation.endTime,
      error: operation.error,
      result: operation.result
    };
  }

  /**
   * Verifica se un'operazione esiste
   * @param {string} operationId - ID dell'operazione
   * @returns {boolean} True se l'operazione esiste
   */
  hasOperation(operationId) {
    return this.operations.has(operationId);
  }

  /**
   * Ottieni tutte le operazioni attive
   * @returns {Array} Lista delle operazioni attive
   */
  getActiveOperations() {
    return Array.from(this.operations.values()).filter(op => op.status === 'running');
  }

  /**
   * Pulisci le operazioni completate o in errore
   */
  cleanup() {
    const now = new Date();
    for (const [id, operation] of this.operations.entries()) {
      if (operation.endTime && (now - operation.endTime) > 5 * 60 * 1000) {
        this.operations.delete(id);
      }
    }
  }
}

// Singleton instance
const progressManager = new ProgressManager();

// Cleanup automatico ogni 10 minuti
setInterval(() => {
  progressManager.cleanup();
}, 10 * 60 * 1000);

module.exports = progressManager;
