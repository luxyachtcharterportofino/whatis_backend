/**
 * Geographic Bounding Box Splitter
 * 
 * Splits large bounding boxes into smaller tiles to avoid Overpass API timeouts.
 * Useful for large zones that cause 504 Gateway Timeout errors.
 * 
 * @module utils/geoSplitter
 */

/**
 * Split a bounding box into smaller tiles
 * @param {Object} bbox - Bounding box with {north, south, east, west}
 * @param {number} rows - Number of rows to split (default: 2)
 * @param {number} cols - Number of columns to split (default: 2)
 * @returns {Array} Array of smaller bounding boxes
 */
function splitBoundingBox(bbox, rows = 2, cols = 2) {
  const { north, south, east, west } = bbox;
  
  // Calculate step sizes
  const latStep = (north - south) / rows;
  const lonStep = (east - west) / cols;
  
  const boxes = [];
  
  // Create grid of smaller boxes
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      boxes.push({
        north: south + latStep * (i + 1),
        south: south + latStep * i,
        east: west + lonStep * (j + 1),
        west: west + lonStep * j
      });
    }
  }
  
  return boxes;
}

/**
 * Convert bounding box object to Overpass API format string
 * @param {Object} bbox - Bounding box with {north, south, east, west}
 * @returns {string} Overpass format: "south,west,north,east"
 */
function bboxToOverpassFormat(bbox) {
  const { north, south, east, west } = bbox;
  return `${south},${west},${north},${east}`;
}

/**
 * Parse Overpass API format string to bounding box object
 * @param {string} bboxString - Overpass format: "south,west,north,east"
 * @returns {Object} Bounding box with {north, south, east, west}
 */
function parseOverpassFormat(bboxString) {
  const [south, west, north, east] = bboxString.split(',').map(parseFloat);
  return { north, south, east, west };
}

module.exports = {
  splitBoundingBox,
  bboxToOverpassFormat,
  parseOverpassFormat
};
