#!/usr/bin/env python3
"""
Test script for the Semantic Enricher module
Run this to verify the enricher is working correctly
"""

import asyncio
import sys
import os

# Add the core module to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'core'))

from core.semantic_enricher import enrich_single_poi, enrich_poi_list

async def test_single_poi():
    """Test single POI enrichment"""
    print("🧠 Testing Single POI Enrichment...")
    print("=" * 50)
    
    test_pois = [
        ("Relitto Mohawk Deer", "wreck"),
        ("Faro di Portofino", "lighthouse"),
        ("Spiaggia di Camogli", "beach"),
        ("Museo del Mare", "museum"),
        ("Parco di Portofino", "park")
    ]
    
    for poi_name, poi_type in test_pois:
        print(f"\n📍 Testing: {poi_name} ({poi_type})")
        try:
            result = await enrich_single_poi(poi_name, poi_type)
            print(f"✅ Success!")
            print(f"   Description: {result['description'][:100]}...")
            print(f"   Image URL: {result['image_url']}")
            print(f"   Source: {result['source']}")
            print(f"   Confidence: {result['confidence']}")
        except Exception as e:
            print(f"❌ Error: {e}")

async def test_batch_enrichment():
    """Test batch POI enrichment"""
    print("\n\n🧠 Testing Batch POI Enrichment...")
    print("=" * 50)
    
    test_pois = [
        {"name": "Relitto Mohawk Deer", "type": "wreck"},
        {"name": "Faro di Portofino", "type": "lighthouse"},
        {"name": "Spiaggia di Camogli", "type": "beach"},
        {"name": "Museo del Mare", "type": "museum"},
        {"name": "Parco di Portofino", "type": "park"}
    ]
    
    try:
        enriched_pois = await enrich_poi_list(test_pois, "Golfo del Tigullio")
        print(f"✅ Batch enrichment completed!")
        print(f"   Enriched {len(enriched_pois)} POIs")
        
        for poi in enriched_pois:
            print(f"\n📍 {poi['name']}:")
            print(f"   Description: {poi.get('description', 'N/A')[:80]}...")
            print(f"   Source: {poi.get('source', 'N/A')}")
            print(f"   Confidence: {poi.get('confidence', 'N/A')}")
            
    except Exception as e:
        print(f"❌ Batch enrichment error: {e}")

async def main():
    """Main test function"""
    print("🚀 Starting Semantic Enricher Tests")
    print("=" * 60)
    
    # Test single POI enrichment
    await test_single_poi()
    
    # Test batch enrichment
    await test_batch_enrichment()
    
    print("\n\n✅ All tests completed!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
