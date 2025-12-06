// ===============================
// 🗺️ Geographic Validator
// Validazione geografica dei POI
// ===============================

const Logger = require('../utils/logger');

class GeographicValidator {
  constructor() {
    // Distanza massima dalla zona (in km, configurabile)
    this.maxDistanceFromZone = parseFloat(process.env.MAX_POI_DISTANCE_KM || '10');
    
    // Coordinate invalide comuni
    this.invalidCoordinates = [
      { lat: 0, lng: 0 },
      { lat: null, lng: null },
      { lat: undefined, lng: undefined }
    ];
  }

  /**
   * Valida un POI rispetto alla zona
   * @param {Object} poi - POI da validare { lat, lng, category, semanticCategory }
   * @param {Object} zone - Zona { coordinates: [[lat, lng], ...] }
   * @returns {Object} - { valid: boolean, reason: string, distance: number }
   */
  validatePOI(poi, zone) {
    // 1. Validazione coordinate base
    if (!this.isValidCoordinate(poi.lat, poi.lng)) {
      return {
        valid: false,
        reason: 'Coordinate invalide o mancanti',
        distance: null
      };
    }

    // 2. Verifica coordinate non assurde
    if (this.isInvalidCoordinate(poi.lat, poi.lng)) {
      return {
        valid: false,
        reason: 'Coordinate non valide (0,0 o null)',
        distance: null
      };
    }

    // 3. Verifica bounding box della zona
    if (!this.isInsideBoundingBox(poi.lat, poi.lng, zone.coordinates)) {
      const distance = this.calculateDistanceFromZone(poi.lat, poi.lng, zone.coordinates);
      
      if (distance > this.maxDistanceFromZone) {
        return {
          valid: false,
          reason: `POI troppo lontano dalla zona (${distance.toFixed(2)} km)`,
          distance: distance
        };
      }
    }

    // 4. Verifica tipo POI (marino vs terrestre)
    const typeCheck = this.validatePOIType(poi, zone);
    if (!typeCheck.valid) {
      return typeCheck;
    }

    // 5. Verifica che il POI sia all'interno del poligono della zona (se possibile)
    const insidePolygon = this.isInsidePolygon(poi.lat, poi.lng, zone.coordinates);
    if (!insidePolygon) {
      const distance = this.calculateDistanceFromZone(poi.lat, poi.lng, zone.coordinates);
      
      // Se è molto vicino, accettalo comunque
      if (distance <= this.maxDistanceFromZone) {
        return {
          valid: true,
          reason: 'POI vicino alla zona (non dentro il poligono)',
          distance: distance,
          warning: true
        };
      }
    }

    return {
      valid: true,
      reason: 'POI valido',
      distance: this.calculateDistanceFromZone(poi.lat, poi.lng, zone.coordinates),
      warning: false
    };
  }

  /**
   * Verifica se le coordinate sono valide
   */
  isValidCoordinate(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return false;
    }

    if (isNaN(lat) || isNaN(lng)) {
      return false;
    }

    // Range valido per latitudine e longitudine
    if (lat < -90 || lat > 90) {
      return false;
    }

    if (lng < -180 || lng > 180) {
      return false;
    }

    return true;
  }

  /**
   * Verifica se le coordinate sono invalide (0,0, null, etc)
   */
  isInvalidCoordinate(lat, lng) {
    return this.invalidCoordinates.some(invalid => 
      (invalid.lat === lat && invalid.lng === lng) ||
      (invalid.lat === null && lat === null) ||
      (invalid.lat === undefined && lat === undefined)
    );
  }

  /**
   * Verifica se il punto è dentro la bounding box della zona
   */
  isInsideBoundingBox(lat, lng, zoneCoordinates) {
    if (!zoneCoordinates || zoneCoordinates.length === 0) {
      return false;
    }

    const lats = zoneCoordinates.map(coord => coord[0] || coord[1]);
    const lngs = zoneCoordinates.map(coord => coord[1] || coord[0]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  }

  /**
   * Verifica se il punto è dentro il poligono della zona (ray casting algorithm)
   */
  isInsidePolygon(lat, lng, polygon) {
    if (!polygon || polygon.length < 3) {
      return false;
    }

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0] || polygon[i][1];
      const yi = polygon[i][1] || polygon[i][0];
      const xj = polygon[j][0] || polygon[j][1];
      const yj = polygon[j][1] || polygon[j][0];

      const intersect = ((yi > lng) !== (yj > lng)) &&
        (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
      
      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Calcola distanza minima dal bordo della zona (in km)
   */
  calculateDistanceFromZone(lat, lng, zoneCoordinates) {
    if (!zoneCoordinates || zoneCoordinates.length === 0) {
      return Infinity;
    }

    let minDistance = Infinity;

    for (const coord of zoneCoordinates) {
      const zoneLat = coord[0] || coord[1];
      const zoneLng = coord[1] || coord[0];
      const distance = this.haversineDistance(lat, lng, zoneLat, zoneLng);
      
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    return minDistance;
  }

  /**
   * Calcola distanza tra due punti (Haversine formula, in km)
   */
  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raggio Terra in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Converte gradi in radianti
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Valida il tipo di POI (marino vs terrestre)
   * Nota: questa è una validazione semplificata
   * Per una validazione reale servirebbe un servizio che verifica se le coordinate sono in mare
   */
  validatePOIType(poi, zone) {
    const isMarine = poi.semanticCategory === 'marine' || 
                     poi.category === 'wreck' || 
                     poi.category === 'biological' ||
                     poi.category === 'cave';

    // Per ora accettiamo tutti i POI
    // In futuro si potrebbe integrare un servizio che verifica se le coordinate sono in mare
    // usando un servizio come OpenSeaMap o simili

    return {
      valid: true,
      reason: 'Tipo POI valido',
      distance: null
    };
  }
}

module.exports = GeographicValidator;

