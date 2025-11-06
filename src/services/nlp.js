const natural = require("natural");
const stopword = require("stopword");
const { Stemmer } = require("sastrawijs");
const stemmer = new Stemmer();
const tokenizer = new natural.WordTokenizer();


// Frasa multi-kata → disederhanakan agar konsisten
const PHRASE_ALIAS = [
["lubuk buaya", "kampus 2"],
["air tawar", "kampus 1"],
["ulu gadut", "kampus 4"],
["gadut", "kampus 3"],
["bukittinggi", "kampus 5"],
["bukit tinggi", "kampus 5"],
["bkt", "kampus 5"],
["unp", "universitas negeri padang"],
["dimana","lokasi"], ["letak","lokasi"], ["alamat","lokasi"],
["berapa buku", "jumlah buku"],
["ada berapakah buku", "jumlah buku"],
["berapa banyak buku", "jumlah buku"],
];

// Sinonim token tunggal
const TOKEN_SYN = new Map([
["ijin","izin"], ["boleh","izin"],
["pakai","gunakan"], ["menggunakan","gunakan"],
["perpus","perpustakaan"], ["pustaka","perpustakaan"],
["mhs","mahasiswa"], ["mhsw","mahasiswa"],
["jumlah","berapa"],
["banyak","berapa"],
]);

function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function normalizePhrases(text=""){
let out = text.toLowerCase();
out = out.replace(/e[\s-]?book/gu, "ebook");
for (const [src, dst] of [...PHRASE_ALIAS].sort((a,b)=>b[0].length-a[0].length)) {
const re = new RegExp(`\\b${escapeRegExp(src)}\\b`, "gu");
out = out.replace(re, dst);
}
return out;
}

function normalizeToken(w){ return TOKEN_SYN.get(w) || w; }

function preprocessToTokens(text=""){
const cleaned = normalizePhrases(text)
.replace(/[^\p{L}\p{N}\s-]/gu, " ")
.replace(/\s+/g, " ")
.trim();
const tokens = tokenizer.tokenize(cleaned)
.map(t => t.trim()).filter(Boolean)
.map(normalizeToken);
const noStop = stopword.removeStopwords(tokens, stopword.id);
const stemmed = noStop.map(t => { try { return stemmer.stem(t) || t; } catch { return t; } });
return stemmed;
}

function preprocessToString(text=""){ return preprocessToTokens(text).join(" "); }

function termFreq(tokens){
const tf = Object.create(null);
tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
const len = tokens.length || 1;
for (const k in tf) tf[k] = tf[k] / len;
return tf;
}

function inverseDocFreq(docsTokens){
const df = Object.create(null);
const N = docsTokens.length || 1;
docsTokens.forEach(toks => { (new Set(toks)).forEach(t => { df[t] = (df[t] || 0) + 1; }); });
const idf = Object.create(null);
for (const term in df) idf[term] = Math.log((N + 1) / (df[term] + 1)) + 1; // smoothed
return idf;
} 

function tfidfVector(tf, idf){
const vec = Object.create(null);
for (const term in tf) if (idf[term]) vec[term] = tf[term] * idf[term];
return vec;
}

function cosineSim(a, b){
let dot = 0, aMag = 0, bMag = 0;
for (const t in a){ aMag += a[t]*a[t]; if (b[t]) dot += a[t]*b[t]; }
for (const t in b){ bMag += b[t]*b[t]; }
if (!aMag || !bMag) return 0;
return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
} 

// Perbaikan typo sederhana berbasis Jaro-Winkler terhadap kosakata korpus
function jaroFixTokens(qTokens, vocab){
const JW = natural.JaroWinklerDistance;
return qTokens.map(tok => {
let best = tok, bestS = 0;
for (const v of vocab){
const s = JW(tok, v);
if (s > bestS){ bestS = s; best = v; }
}
return bestS >= 0.92 ? best : tok; // hanya ganti jika sangat mirip
});
}

module.exports = {
preprocessToTokens, preprocessToString,
termFreq, inverseDocFreq, tfidfVector, cosineSim,
jaroFixTokens
};