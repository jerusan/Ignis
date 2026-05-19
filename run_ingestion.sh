#!/usr/bin/env bash
# Run the full ingestion pipeline in order.
# Run from repo root with the venv active.
#
#   source ../.venv/bin/activate   (or your venv path)
#   bash run_ingestion.sh

set -e

echo "=== Step 1: Extract text + export PNGs + vision pass ==="
python -m ingestion.extract

echo ""
echo "=== Step 2: Build specs.json (Layer 1) ==="
python -m ingestion.build_layer1

echo ""
echo "=== Step 3: Build diagnostic_graph.json (Layer 2) ==="
python -m ingestion.build_layer2

echo ""
echo "=== Step 4: Build visual_registry.json (Layer 3) ==="
python -m ingestion.build_layer3

echo ""
echo "=== Step 5: Build chunks/*.md (Layer 4) ==="
python -m ingestion.build_layer4

echo ""
echo "=== Ingestion complete ==="
ls data/
echo ""
ls assets/ | wc -l
echo "PNG files in assets/"
