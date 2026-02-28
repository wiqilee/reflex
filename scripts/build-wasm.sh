#!/bin/bash
# Build REFLEX engine: Rust → WebAssembly
# Prerequisites: cargo, wasm-pack

set -e

echo "🔨 Building REFLEX engine (Rust → WASM)..."

cd "$(dirname "$0")/engine"

# Build WASM with wasm-pack
wasm-pack build --target web --out-dir ../frontend/src/wasm

echo "✅ WASM build complete → frontend/src/wasm/"
echo "   Files:"
ls -la ../frontend/src/wasm/*.{js,wasm} 2>/dev/null || echo "   (check frontend/src/wasm/)"
