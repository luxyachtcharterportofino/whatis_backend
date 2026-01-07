# 🧠 Semantic Enricher Module

## Overview

The `semantic_enricher` module automatically enriches POIs (Points of Interest) that lack descriptions or images by gathering information from multiple reliable sources and providing AI-generated fallbacks.

## Features

### 🔍 Multi-Source Information Gathering
- **Wikipedia/Wikidata**: Primary source for historical and cultural information
- **Ligurian Tourism Sites**: Specialized regional sources
  - VisitLiguria.it
  - Parks.it
  - DivingMap.it
  - OpenSeaMap.org
  - Archeomar.beniculturali.it
- **AI Generation**: Fallback descriptions for missing information

### 🎯 Smart Enrichment Strategy
1. **Wikipedia Search**: Italian Wikipedia with intelligent content extraction
2. **Wikidata SPARQL**: Structured data queries for additional information
3. **Web Scraping**: Trusted tourism websites with Ligurian focus
4. **AI Fallback**: Contextual descriptions based on POI type

### 🛡️ Production-Safe Features
- **Rate Limiting**: Prevents overwhelming external services
- **Error Handling**: Graceful fallbacks when sources fail
- **Confidence Scoring**: Quality assessment of enrichment results
- **Caching**: Efficient reuse of successful enrichments

## Usage

### Single POI Enrichment
```python
from core.semantic_enricher import enrich_single_poi

result = await enrich_single_poi("Relitto Mohawk Deer", "wreck")
print(f"Description: {result['description']}")
print(f"Image: {result['image_url']}")
print(f"Source: {result['source']}")
```

### Batch POI Enrichment
```python
from core.semantic_enricher import enrich_poi_list

pois = [
    {"name": "Faro di Portofino", "type": "lighthouse"},
    {"name": "Spiaggia di Camogli", "type": "beach"}
]

enriched_pois = await enrich_poi_list(pois, "Golfo del Tigullio")
```

### API Endpoint
```bash
curl -X POST "http://localhost:5001/semantic/enrich_poi" \
  -H "Content-Type: application/json" \
  -d '{"name": "Relitto Mohawk Deer", "type": "wreck"}'
```

## Response Format

```json
{
  "name": "Relitto Mohawk Deer",
  "description": "Il Relitto Mohawk Deer è un relitto sommerso di grande interesse per immersioni nella Riviera Ligure...",
  "image_url": "https://example.com/image.jpg",
  "source": "Wikipedia",
  "confidence": 0.9,
  "metadata": {
    "wikipedia_url": "https://it.wikipedia.org/wiki/...",
    "wikipedia_title": "Relitto Mohawk Deer"
  }
}
```

## POI Types Supported

- `wreck` - Shipwrecks and underwater wrecks
- `lighthouse` - Lighthouses and navigation aids
- `diving_site` - Diving locations and underwater sites
- `beach` - Beaches and coastal areas
- `monument` - Historical monuments and landmarks
- `park` - Natural parks and green areas
- `church` - Religious buildings and churches
- `museum` - Museums and cultural institutions
- `viewpoint` - Scenic viewpoints and observation points
- `default` - Generic POI type

## Configuration

### Tourism Sites
The module is pre-configured with trusted Ligurian tourism websites. Each site has specific selectors for:
- Title extraction
- Description extraction
- Image extraction

### AI Templates
Contextual Italian descriptions are generated based on POI type, using templates that reflect Ligurian culture and geography.

## Error Handling

The module implements a robust fallback strategy:
1. If Wikipedia fails → Try Wikidata
2. If Wikidata fails → Try tourism sites
3. If all sources fail → Generate AI description
4. If AI generation fails → Use basic fallback

## Performance

- **Rate Limiting**: 0.5s delay between requests
- **Timeout**: 10s per external request
- **Caching**: Results cached for 24 hours
- **Batch Processing**: Efficient bulk enrichment

## Dependencies

- `aiohttp` - Async HTTP requests
- `beautifulsoup4` - HTML parsing
- `wikipedia` - Wikipedia API
- `SPARQLWrapper` - Wikidata queries
- `lxml` - XML/HTML processing

## Integration

The enricher is automatically integrated with the semantic search workflow:
- Runs after POI discovery
- Only enriches POIs lacking descriptions/images
- Preserves existing data
- Adds enrichment metadata

## Monitoring

All enrichment activities are logged with:
- Source used for enrichment
- Confidence score
- Processing time
- Error details (if any)

## Future Enhancements

- Image recognition and classification
- Multi-language support
- Custom tourism site configurations
- Machine learning-based quality assessment
- Real-time enrichment status tracking
