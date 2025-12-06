#!/usr/bin/env python3
"""
Semantic Enricher - Automatic POI enrichment with descriptions and images
Part of the Semantic Engine microservice for whatis_backend

This module automatically enriches POIs that lack descriptions or images by:
1. Searching Wikipedia/Wikidata for information
2. Scraping trusted Ligurian tourism websites
3. Generating AI-style descriptions as fallback
4. Providing placeholder images when needed

Author: Semantic Engine AI
"""

import asyncio
import aiohttp
import json
import re
import logging
from typing import Dict, List, Optional, Tuple, Any
from urllib.parse import quote, urljoin
from dataclasses import dataclass
from bs4 import BeautifulSoup
import wikipedia
from SPARQLWrapper import SPARQLWrapper, JSON
import time
import os

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class EnrichmentResult:
    """Result of POI enrichment process"""
    description: str
    image_url: str
    source: str
    confidence: float
    metadata: Dict[str, Any] = None

class SemanticEnricher:
    """
    Main class for automatic POI enrichment
    Handles multiple data sources and fallback strategies
    """
    
    def __init__(self):
        self.session = None
        self.wiki_session = None
        self.placeholder_image = "/static/images/placeholder_poi.jpg"
        
        # Configure Wikipedia
        wikipedia.set_lang("it")  # Italian Wikipedia
        
        # Trusted Ligurian tourism websites
        self.tourism_sites = {
            "visitliguria": {
                "base_url": "https://www.visitliguria.it",
                "search_path": "/search",
                "selectors": {
                    "title": "h1, .title, .poi-name",
                    "description": ".description, .content, .poi-description",
                    "image": "img.poi-image, .gallery img, .main-image"
                }
            },
            "parks": {
                "base_url": "https://www.parks.it",
                "search_path": "/search",
                "selectors": {
                    "title": "h1, .park-title",
                    "description": ".park-description, .content",
                    "image": "img.park-image, .gallery img"
                }
            },
            "divingmap": {
                "base_url": "https://www.divingmap.it",
                "search_path": "/search",
                "selectors": {
                    "title": "h1, .dive-site-title",
                    "description": ".dive-description, .content",
                    "image": "img.dive-image, .gallery img"
                }
            },
            "openseamap": {
                "base_url": "https://openseamap.org",
                "search_path": "/search",
                "selectors": {
                    "title": "h1, .object-title",
                    "description": ".object-description, .content",
                    "image": "img.object-image, .gallery img"
                }
            },
            "archeomar": {
                "base_url": "https://www.archeomar.beniculturali.it",
                "search_path": "/search",
                "selectors": {
                    "title": "h1, .site-title",
                    "description": ".site-description, .content",
                    "image": "img.site-image, .gallery img"
                }
            }
        }
        
        # AI-generated description templates for Ligurian POIs
        self.ai_templates = {
            "wreck": "Il {name} è un relitto sommerso di grande interesse per immersioni nella Riviera Ligure. Questo sito offre un'esperienza unica per gli appassionati di archeologia subacquea.",
            "lighthouse": "Il faro {name} è un importante punto di riferimento per la navigazione lungo la costa ligure. Offre una vista panoramica mozzafiato sul mare e sulla costa.",
            "diving_site": "Il sito di immersione {name} è una meta imperdibile per i subacquei che visitano la Riviera Ligure. Le acque cristalline e la ricca fauna marina rendono questo luogo unico.",
            "beach": "La spiaggia {name} è una delle perle nascoste della Riviera Ligure, caratterizzata da acque cristalline e un paesaggio costiero incontaminato.",
            "monument": "Il monumento {name} rappresenta un importante pezzo di storia e cultura della Liguria, testimonianza del ricco patrimonio artistico della regione.",
            "park": "Il parco {name} offre un'oasi di pace e natura nella Riviera Ligure, perfetto per escursioni e momenti di relax immersi nella vegetazione mediterranea.",
            "church": "La chiesa {name} è un gioiello architettonico della Liguria, che custodisce opere d'arte e testimonianze storiche di grande valore.",
            "museum": "Il museo {name} custodisce un patrimonio culturale unico della Liguria, offrendo ai visitatori un viaggio attraverso la storia e le tradizioni locali.",
            "viewpoint": "Il punto panoramico {name} offre una vista spettacolare sulla Riviera Ligure, permettendo di ammirare il paesaggio costiero in tutta la sua bellezza.",
            "default": "Il {name} è un luogo di interesse situato nella Riviera Ligure, che merita una visita per la sua bellezza e il suo significato storico e culturale."
        }
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=10),
            headers={
                'User-Agent': 'Mozilla/5.0 (compatible; SemanticEnricher/1.0)'
            }
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    async def enrich_poi(self, poi: Dict[str, Any]) -> EnrichmentResult:
        """
        Enrich a single POI with description and image
        Returns the best available enrichment result
        """
        poi_name = poi.get('name', '')
        poi_type = poi.get('type', 'default')
        
        if not poi_name:
            return self._create_fallback_result(poi_name, poi_type)
        
        logger.info(f"Enriching POI: {poi_name}")
        
        # Try different enrichment strategies in order of preference
        enrichment_strategies = [
            self._enrich_from_wikipedia,
            self._enrich_from_wikidata,
            self._enrich_from_tourism_sites,
            self._enrich_with_ai_generation
        ]
        
        for strategy in enrichment_strategies:
            try:
                result = await strategy(poi_name, poi_type)
                # ✅ FIX ConfidenceConversion: Conversione sicura a float per evitare errori di tipo
                if result:
                    try:
                        result_confidence = float(result.confidence if hasattr(result, 'confidence') else 0)
                    except (ValueError, TypeError):
                        result_confidence = 0.0
                    if result_confidence > 0.5:
                        logger.info(f"Successfully enriched {poi_name} from {result.source}")
                        return result
            except Exception as e:
                logger.warning(f"Strategy {strategy.__name__} failed for {poi_name}: {e}")
                continue
        
        # If all strategies fail, return fallback
        logger.warning(f"All enrichment strategies failed for {poi_name}, using fallback")
        return self._create_fallback_result(poi_name, poi_type)
    
    async def enrich_poi_batch(self, pois: List[Dict[str, Any]], zone_name: str = "") -> List[Dict[str, Any]]:
        """
        Enrich a batch of POIs
        Only enriches POIs that lack description or image
        """
        if not pois:
            return pois

        if any((poi.get('metadata') or {}).get('mode') == 'enhanced' for poi in pois):
            logger.info("[ENRICHER] Enhanced mode attivo — arricchimento Wikipedia disattivato.")
            return pois
        
        logger.info(f"Starting batch enrichment for {len(pois)} POIs in zone: {zone_name}")
        
        # Filter POIs that need enrichment
        pois_to_enrich = []
        for poi in pois:
            needs_enrichment = (
                not poi.get('description') or 
                not poi.get('image_url') or
                len(poi.get('description', '').strip()) < 20
            )
            if needs_enrichment:
                pois_to_enrich.append(poi)
        
        if not pois_to_enrich:
            logger.info("No POIs need enrichment")
            return pois
        
        logger.info(f"Enriching {len(pois_to_enrich)} POIs that need description/image")
        
        # Enrich POIs with rate limiting
        enriched_pois = []
        for i, poi in enumerate(pois):
            if poi in pois_to_enrich:
                try:
                    enrichment_result = await self.enrich_poi(poi)
                    
                    # Update POI with enrichment data
                    enriched_poi = poi.copy()
                    enriched_poi['description'] = enrichment_result.description
                    enriched_poi['image_url'] = enrichment_result.image_url
                    enriched_poi['source'] = enrichment_result.source
                    # ✅ FIX ConfidenceConversion: Conversione sicura a float per evitare errori di tipo
                    try:
                        enrichment_confidence = float(enrichment_result.confidence if hasattr(enrichment_result, 'confidence') else 0)
                    except (ValueError, TypeError):
                        enrichment_confidence = 0.0
                    enriched_poi['enrichment_confidence'] = enrichment_confidence
                    enriched_poi['enrichment_metadata'] = enrichment_result.metadata or {}
                    
                    enriched_pois.append(enriched_poi)
                    
                    # Rate limiting: small delay between requests
                    if i < len(pois) - 1:
                        await asyncio.sleep(0.5)
                        
                except Exception as e:
                    logger.error(f"Failed to enrich POI {poi.get('name', 'Unknown')}: {e}")
                    enriched_pois.append(poi)  # Keep original POI if enrichment fails
            else:
                enriched_pois.append(poi)  # Keep POI as-is if it doesn't need enrichment
        
        logger.info(f"Batch enrichment completed. Enriched {len(pois_to_enrich)} POIs")
        return enriched_pois
    
    async def _enrich_from_wikipedia(self, poi_name: str, poi_type: str) -> Optional[EnrichmentResult]:
        """Enrich POI using Wikipedia API"""
        try:
            # Search for Wikipedia page
            search_results = wikipedia.search(poi_name, results=3)
            if not search_results:
                return None
            
            # Try to get the best match
            for search_term in search_results:
                try:
                    page = wikipedia.page(search_term)
                    
                    # Extract description (first paragraph)
                    description = self._extract_wikipedia_description(page.content)
                    if not description or len(description) < 20:
                        continue
                    
                    # Try to get image
                    image_url = self._extract_wikipedia_image(page)
                    
                    return EnrichmentResult(
                        description=description,
                        image_url=image_url or self.placeholder_image,
                        source="Wikipedia",
                        confidence=0.9 if image_url else 0.7,
                        metadata={
                            "wikipedia_url": page.url,
                            "wikipedia_title": page.title,
                            "content_length": len(page.content)
                        }
                    )
                    
                except wikipedia.exceptions.DisambiguationError:
                    continue
                except wikipedia.exceptions.PageError:
                    continue
            
            return None
            
        except Exception as e:
            logger.warning(f"Wikipedia enrichment failed for {poi_name}: {e}")
            return None
    
    async def _enrich_from_wikidata(self, poi_name: str, poi_type: str) -> Optional[EnrichmentResult]:
        """Enrich POI using Wikidata SPARQL queries"""
        try:
            sparql = SPARQLWrapper("https://query.wikidata.org/sparql")
            
            # Search for entity by name
            query = f"""
            SELECT ?item ?itemLabel ?description ?image WHERE {{
                SERVICE wikibase:mwapi {{
                    bd:serviceParam wikibase:api "EntitySearch" .
                    bd:serviceParam wikibase:endpoint "www.wikidata.org" .
                    bd:serviceParam mwapi:search "{poi_name}" .
                    bd:serviceParam mwapi:language "it" .
                    ?item wikibase:apiOutputItem mwapi:item .
                }}
                OPTIONAL {{ ?item schema:description ?description FILTER(LANG(?description) = "it") }}
                OPTIONAL {{ ?item wdt:P18 ?image }}
                SERVICE wikibase:label {{ bd:serviceParam wikibase:language "it" }}
            }}
            LIMIT 1
            """
            
            sparql.setQuery(query)
            sparql.setReturnFormat(JSON)
            results = sparql.query().convert()
            
            if not results['results']['bindings']:
                return None
            
            result = results['results']['bindings'][0]
            
            description = result.get('description', {}).get('value', '')
            image_url = result.get('image', {}).get('value', '')
            
            if not description:
                return None
            
            return EnrichmentResult(
                description=description,
                image_url=image_url or self.placeholder_image,
                source="Wikidata",
                confidence=0.8 if image_url else 0.6,
                metadata={
                    "wikidata_id": result.get('item', {}).get('value', ''),
                    "wikidata_label": result.get('itemLabel', {}).get('value', '')
                }
            )
            
        except Exception as e:
            logger.warning(f"Wikidata enrichment failed for {poi_name}: {e}")
            return None
    
    async def _enrich_from_tourism_sites(self, poi_name: str, poi_type: str) -> Optional[EnrichmentResult]:
        """Enrich POI by scraping trusted Ligurian tourism websites"""
        if not self.session:
            return None
        
        # Try each tourism site
        for site_name, site_config in self.tourism_sites.items():
            try:
                result = await self._scrape_tourism_site(poi_name, site_name, site_config)
                # ✅ FIX ConfidenceConversion: Conversione sicura a float per evitare errori di tipo
                if result:
                    try:
                        result_confidence = float(result.confidence if hasattr(result, 'confidence') else 0)
                    except (ValueError, TypeError):
                        result_confidence = 0.0
                    if result_confidence > 0.6:
                        return result
            except Exception as e:
                logger.warning(f"Tourism site {site_name} failed for {poi_name}: {e}")
                continue
        
        return None
    
    async def _scrape_tourism_site(self, poi_name: str, site_name: str, site_config: Dict) -> Optional[EnrichmentResult]:
        """Scrape a specific tourism site for POI information"""
        try:
            # Construct search URL
            search_url = urljoin(site_config['base_url'], site_config['search_path'])
            params = {'q': poi_name, 'type': 'poi'}
            
            async with self.session.get(search_url, params=params) as response:
                if response.status != 200:
                    return None
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # Look for POI information
                title_elem = soup.select_one(site_config['selectors']['title'])
                desc_elem = soup.select_one(site_config['selectors']['description'])
                img_elem = soup.select_one(site_config['selectors']['image'])
                
                if not title_elem or not desc_elem:
                    return None
                
                # Extract text content
                title = title_elem.get_text().strip()
                description = desc_elem.get_text().strip()
                
                # Check if this is a good match
                if not self._is_good_match(poi_name, title):
                    return None
                
                # Extract image URL
                image_url = None
                if img_elem:
                    img_src = img_elem.get('src') or img_elem.get('data-src')
                    if img_src:
                        image_url = urljoin(site_config['base_url'], img_src)
                
                return EnrichmentResult(
                    description=description,
                    image_url=image_url or self.placeholder_image,
                    source=f"VisitLiguria" if site_name == "visitliguria" else site_name.title(),
                    confidence=0.7 if image_url else 0.5,
                    metadata={
                        "site_url": site_config['base_url'],
                        "matched_title": title
                    }
                )
                
        except Exception as e:
            logger.warning(f"Scraping {site_name} failed: {e}")
            return None
    
    async def _enrich_with_ai_generation(self, poi_name: str, poi_type: str) -> EnrichmentResult:
        """Generate AI-style description as fallback"""
        template = self.ai_templates.get(poi_type, self.ai_templates['default'])
        description = template.format(name=poi_name)
        
        return EnrichmentResult(
            description=description,
            image_url=self.placeholder_image,
            source="AI-generated",
            confidence=0.3,
            metadata={
                "template_used": poi_type,
                "generated_at": time.time()
            }
        )
    
    def _create_fallback_result(self, poi_name: str, poi_type: str) -> EnrichmentResult:
        """Create a fallback result when all enrichment strategies fail"""
        template = self.ai_templates.get(poi_type, self.ai_templates['default'])
        description = template.format(name=poi_name)
        
        return EnrichmentResult(
            description=description,
            image_url=self.placeholder_image,
            source="Fallback",
            confidence=0.1,
            metadata={
                "fallback_reason": "All enrichment strategies failed",
                "template_used": poi_type
            }
        )
    
    def _extract_wikipedia_description(self, content: str) -> str:
        """Extract a good description from Wikipedia content"""
        # Split into paragraphs
        paragraphs = content.split('\n\n')
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            # Skip very short paragraphs or those that look like metadata
            if len(paragraph) < 50:
                continue
            if paragraph.startswith('==') or paragraph.startswith('{{'):
                continue
            if 'Categoria:' in paragraph or 'File:' in paragraph:
                continue
            
            # Clean up the text
            paragraph = re.sub(r'\[\[([^|\]]+)\|([^\]]+)\]\]', r'\2', paragraph)  # Remove wiki links
            paragraph = re.sub(r'\[\[([^\]]+)\]\]', r'\1', paragraph)  # Remove simple wiki links
            paragraph = re.sub(r'{{[^}]+}}', '', paragraph)  # Remove templates
            paragraph = re.sub(r'\s+', ' ', paragraph)  # Normalize whitespace
            
            if len(paragraph) > 20:
                return paragraph[:300] + "..." if len(paragraph) > 300 else paragraph
        
        return ""
    
    def _extract_wikipedia_image(self, page) -> Optional[str]:
        """Extract image URL from Wikipedia page"""
        try:
            # Try to get images from the page
            if hasattr(page, 'images') and page.images:
                for img_url in page.images:
                    # Prefer images that look like main photos
                    if any(keyword in img_url.lower() for keyword in ['photo', 'image', 'picture']):
                        return img_url
                # If no good images found, return the first one
                return page.images[0]
        except Exception:
            pass
        
        return None
    
    def _is_good_match(self, poi_name: str, found_title: str) -> bool:
        """Check if a found title is a good match for the POI name"""
        poi_words = set(poi_name.lower().split())
        title_words = set(found_title.lower().split())
        
        # Check for significant word overlap
        overlap = len(poi_words.intersection(title_words))
        return overlap >= max(1, len(poi_words) // 2)

# Utility functions for external use

async def enrich_single_poi(poi_name: str, poi_type: str = "default") -> Dict[str, Any]:
    """
    Enrich a single POI by name
    Used by the test endpoint
    """
    async with SemanticEnricher() as enricher:
        poi = {"name": poi_name, "type": poi_type}
        result = await enricher.enrich_poi(poi)
        
        return {
            "name": poi_name,
            "description": result.description,
            "image_url": result.image_url,
            "source": result.source,
            "confidence": result.confidence,
            "metadata": result.metadata
        }

async def enrich_poi_list(pois: List[Dict[str, Any]], zone_name: str = "") -> List[Dict[str, Any]]:
    """
    Enrich a list of POIs
    Used by the main semantic search integration
    """
    async with SemanticEnricher() as enricher:
        return await enricher.enrich_poi_batch(pois, zone_name)
