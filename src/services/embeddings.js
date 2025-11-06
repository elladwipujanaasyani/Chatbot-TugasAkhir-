// src/services/embeddings.js
let encoder;

// load model pakai dynamic import
async function getEncoder() {
  if (!encoder) {
    const { pipeline } = await import('@xenova/transformers');
    encoder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return encoder;
}

async function embed(text) {
  if (!text || !text.trim()) return new Float32Array();
  const enc = await getEncoder();
  const output = await enc(text, { pooling: 'mean', normalize: true });
  return output.data; // Float32Array
}

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

module.exports = { embed, cosineSim };