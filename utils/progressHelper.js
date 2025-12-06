/**
 * Progress Helper Utility
 * Centralizes progress callback functionality to avoid duplication
 * 
 * @module utils/progressHelper
 */

const Logger = require('./logger');

/**
 * Update progress by calling the callback if provided
 * This function is duplicated across multiple files - now centralized here
 * 
 * @param {Function|null} progressCallback - Callback function to update progress
 * @param {number} percentage - Progress percentage (0-100)
 * @param {string} message - Progress message
 * @param {string} details - Additional details (optional)
 * 
 * @example
 * ```javascript
 * // Usage in services
 * const progressHelper = require('./utils/progressHelper');
 * 
 * progressHelper.updateProgress(
 *   callback, 
 *   50, 
 *   'Processing...', 
 *   'Halfway done'
 * );
 * ```
 */
function updateProgress(progressCallback, percentage, message, details = '') {
  // Validate callback
  if (!progressCallback || typeof progressCallback !== 'function') {
    // Logger.debug(`No valid progress callback provided for: ${message}`);
    return;
  }

  try {
    // Call the callback with progress data
    progressCallback(percentage, message, details);
    
    // Optionally log progress in debug mode
    if (process.env.NODE_ENV === 'development') {
      Logger.debug(`Progress: ${percentage}% - ${message}`);
    }
  } catch (error) {
    Logger.error(`Error in progress callback:`, error.message);
  }
}

/**
 * Helper to create a progress callback that calls multiple callbacks
 * Useful for cases where you need to update multiple progress indicators
 * 
 * @param {Function[]} callbacks - Array of callback functions
 * @returns {Function} Combined callback function
 */
function createMultiCallback(callbacks) {
  return (percentage, message, details = '') => {
    callbacks.forEach(callback => {
      if (callback && typeof callback === 'function') {
        try {
          callback(percentage, message, details);
        } catch (error) {
          Logger.error(`Error in multi-callback:`, error.message);
        }
      }
    });
  };
}

module.exports = {
  updateProgress,
  createMultiCallback
};
