/**
 * Universal Progress Manager
 * Manages progress bars for all operations taking more than 0.5 seconds
 */

class ProgressManager {
  constructor() {
    this.activeOperations = new Map();
    this.operationCount = 0;
  }

  /**
   * Start a new progress operation
   * @param {string} operationId - Unique identifier for the operation
   * @param {string} title - Title to display
   * @param {number} totalSteps - Total number of steps
   * @returns {Object} Progress object with update and complete methods
   */
  start(operationId, title, totalSteps = 100) {
    const startTime = Date.now();
    const operation = {
      id: operationId,
      title: title,
      totalSteps: totalSteps,
      currentStep: 0,
      startTime: startTime,
      estimatedTime: null,
      progressElement: null,
      isCompleted: false
    };

    this.activeOperations.set(operationId, operation);
    this.operationCount++;

    // Create progress UI
    this.createProgressUI(operation);

    console.log(`🚀 Started operation: ${title} (ID: ${operationId})`);

    return {
      update: (currentStep, stepDescription = '', additionalInfo = '') => {
        this.updateProgress(operationId, currentStep, stepDescription, additionalInfo);
      },
      complete: (successMessage = 'Operazione completata!') => {
        this.completeProgress(operationId, successMessage);
      },
      error: (errorMessage = 'Errore durante l\'operazione') => {
        this.errorProgress(operationId, errorMessage);
      }
    };
  }

  /**
   * Create progress UI element
   */
  createProgressUI(operation) {
    // Remove existing progress container if any
    const existingContainer = document.getElementById('universalProgressContainer');
    if (existingContainer) {
      existingContainer.remove();
    }

    // Create main progress container
    const container = document.createElement('div');
    container.id = 'universalProgressContainer';
    container.className = 'progress-overlay';
    container.innerHTML = `
      <div class="progress-modal">
        <div class="progress-header">
          <h5 class="progress-title">${operation.title}</h5>
          <button class="btn-close-progress" onclick="progressManager.hideProgress('${operation.id}')">×</button>
        </div>
        <div class="progress-body">
          <div class="progress-info">
            <span class="progress-step-text">Inizializzazione...</span>
            <span class="progress-time" id="timeRemaining_${operation.id}">Calcolo tempo...</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar">
              <div class="progress-bar-fill" id="progressFill_${operation.id}" style="width: 0%"></div>
            </div>
            <div class="progress-percentage" id="progressPercent_${operation.id}">0%</div>
          </div>
          <div class="progress-details" id="progressDetails_${operation.id}"></div>
        </div>
      </div>
    `;

    // Add to page
    document.body.appendChild(container);

    // Store reference to progress elements
    operation.progressElement = {
      container: container,
      stepText: container.querySelector('.progress-step-text'),
      timeRemaining: container.querySelector(`#timeRemaining_${operation.id}`),
      progressFill: container.querySelector(`#progressFill_${operation.id}`),
      progressPercent: container.querySelector(`#progressPercent_${operation.id}`),
      progressDetails: container.querySelector(`#progressDetails_${operation.id}`)
    };

    // Add CSS if not already added
    this.addProgressCSS();
  }

  /**
   * Add CSS for progress UI
   */
  addProgressCSS() {
    if (document.getElementById('progressManagerCSS')) return;

    const css = document.createElement('style');
    css.id = 'progressManagerCSS';
    css.textContent = `
      .progress-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(5px);
      }

      .progress-modal {
        background: #1a1a1a;
        border: 2px solid #28a745;
        border-radius: 15px;
        padding: 25px;
        min-width: 400px;
        max-width: 600px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        animation: slideIn 0.3s ease-out;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-50px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid #333;
        padding-bottom: 10px;
      }

      .progress-title {
        color: #28a745;
        margin: 0;
        font-size: 18px;
        font-weight: bold;
      }

      .btn-close-progress {
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .btn-close-progress:hover {
        background: #c82333;
        transform: scale(1.1);
      }

      .progress-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }

      .progress-step-text {
        color: #fff;
        font-weight: 500;
        flex: 1;
      }

      .progress-time {
        color: #17a2b8;
        font-weight: bold;
        font-size: 14px;
      }

      .progress-bar-container {
        position: relative;
        margin-bottom: 15px;
      }

      .progress-bar {
        width: 100%;
        height: 25px;
        background: #333;
        border-radius: 12px;
        overflow: hidden;
        border: 2px solid #444;
      }

      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #28a745, #20c997);
        border-radius: 10px;
        transition: width 0.3s ease;
        position: relative;
        overflow: hidden;
      }

      .progress-bar-fill::after {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
        animation: shimmer 2s infinite;
      }

      @keyframes shimmer {
        0% { left: -100%; }
        100% { left: 100%; }
      }

      .progress-percentage {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-weight: bold;
        font-size: 14px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
      }

      .progress-details {
        color: #ccc;
        font-size: 12px;
        line-height: 1.4;
        max-height: 60px;
        overflow-y: auto;
      }

      .progress-details::-webkit-scrollbar {
        width: 4px;
      }

      .progress-details::-webkit-scrollbar-track {
        background: #333;
        border-radius: 2px;
      }

      .progress-details::-webkit-scrollbar-thumb {
        background: #666;
        border-radius: 2px;
      }

      .progress-details::-webkit-scrollbar-thumb:hover {
        background: #888;
      }
    `;

    document.head.appendChild(css);
  }

  /**
   * Update progress for an operation
   */
  updateProgress(operationId, currentStep, stepDescription = '', additionalInfo = '') {
    const operation = this.activeOperations.get(operationId);
    if (!operation || operation.isCompleted) return;

    operation.currentStep = Math.min(currentStep, operation.totalSteps);
    const percentage = Math.round((operation.currentStep / operation.totalSteps) * 100);

    // Update progress bar
    if (operation.progressElement) {
      operation.progressElement.progressFill.style.width = `${percentage}%`;
      operation.progressElement.progressPercent.textContent = `${percentage}%`;
      operation.progressElement.stepText.textContent = stepDescription || `Passo ${operation.currentStep} di ${operation.totalSteps}`;

      // Calculate estimated time remaining
      const elapsedTime = Date.now() - operation.startTime;
      const estimatedTotalTime = (elapsedTime / operation.currentStep) * operation.totalSteps;
      const remainingTime = estimatedTotalTime - elapsedTime;

      if (remainingTime > 0) {
        operation.progressElement.timeRemaining.textContent = this.formatTime(remainingTime);
      } else {
        operation.progressElement.timeRemaining.textContent = 'Quasi finito...';
      }

      // Add additional info if provided
      if (additionalInfo) {
        operation.progressElement.progressDetails.innerHTML += `<div>• ${additionalInfo}</div>`;
        // Keep only last 5 details
        const details = operation.progressElement.progressDetails.children;
        if (details.length > 5) {
          operation.progressElement.progressDetails.removeChild(details[0]);
        }
      }
    }

    console.log(`📊 Progress ${operationId}: ${percentage}% - ${stepDescription}`);
  }

  /**
   * Complete progress for an operation
   */
  completeProgress(operationId, successMessage = 'Operazione completata!') {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    operation.isCompleted = true;

    if (operation.progressElement) {
      // Update to 100%
      operation.progressElement.progressFill.style.width = '100%';
      operation.progressElement.progressPercent.textContent = '100%';
      operation.progressElement.stepText.textContent = successMessage;
      operation.progressElement.timeRemaining.textContent = 'Completato!';

      // Change color to success
      operation.progressElement.progressFill.style.background = 'linear-gradient(90deg, #28a745, #20c997)';

      // Auto-hide after 2 seconds
      setTimeout(() => {
        this.hideProgress(operationId);
      }, 2000);
    }

    console.log(`✅ Completed operation: ${operation.title} (ID: ${operationId})`);
  }

  /**
   * Show error for an operation
   */
  errorProgress(operationId, errorMessage = 'Errore durante l\'operazione') {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    operation.isCompleted = true;

    if (operation.progressElement) {
      operation.progressElement.stepText.textContent = errorMessage;
      operation.progressElement.timeRemaining.textContent = 'Errore!';

      // Change color to error
      operation.progressElement.progressFill.style.background = 'linear-gradient(90deg, #dc3545, #fd7e14)';
      operation.progressElement.progressFill.style.background = '#dc3545';

      // Auto-hide after 3 seconds
      setTimeout(() => {
        this.hideProgress(operationId);
      }, 3000);
    }

    console.error(`❌ Error in operation: ${operation.title} (ID: ${operationId}) - ${errorMessage}`);
  }

  /**
   * Hide progress for an operation
   */
  hideProgress(operationId) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    if (operation.progressElement && operation.progressElement.container) {
      operation.progressElement.container.remove();
    }

    this.activeOperations.delete(operationId);
    this.operationCount--;

    console.log(`🔄 Hidden progress: ${operation.title} (ID: ${operationId})`);
  }

  /**
   * Hide all progress operations
   */
  hideAllProgress() {
    this.activeOperations.forEach((operation, operationId) => {
      this.hideProgress(operationId);
    });
  }

  /**
   * Format time in milliseconds to human readable format
   */
  formatTime(milliseconds) {
    const seconds = Math.ceil(milliseconds / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  /**
   * Get active operations count
   */
  getActiveOperationsCount() {
    return this.activeOperations.size;
  }

  /**
   * Check if an operation is running
   */
  isOperationRunning(operationId) {
    return this.activeOperations.has(operationId);
  }
}

// Create global instance
window.progressManager = new ProgressManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressManager;
}
