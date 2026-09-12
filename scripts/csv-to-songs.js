#!/usr/bin/env node
/**
 * Converts perfect_dataset.csv into data/songs.json with the exact field names
 * app/page.tsx expects.
 *
 *   node scripts/csv-to-songs.js perfect_dataset.csv data/songs.json
 *
 * Handles: UTF-8 BOM, CRLF, quoted fields containing commas ("Kapoor, Shraddha"),
 * escaped double quotes, and header names in any casing or spacing.
 */

const fs = require('fs');
const path = require('path');

const inPath = process.argv[2] || 'perfect_dataset.csv';
const outPath = process.argv[3] || path.join('data', 'songs.json');

// --- RFC4180-ish CSV parser (handles quotes and embedded newlines) ---
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, ''); // strip BOM
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

const normaliseKey = k => k.replace(/^\uFEFF/, '').replace(/[\s_-]/g, '').toLowerCase();

const ALIASES = {
  movie:         ['movie', 'moviename', 'film', 'filmname', 'album'],
  trackName:     ['trackname', 'track', 'song', 'songname', 'title', 'songtitle'],
  musicDirector: ['musicdirector', 'composer', 'music', 'musicby'],
  singers:       ['singers', 'singer', 'vocals', 'artist', 'artists'],
  cast:          ['cast', 'actors', 'starring', 'leadcast'],
  releaseYear:   ['releaseyear', 'year', 'released', 'yearofrelease'],
  isFamous:      ['isfamous', 'famous', 'popular', 'ispopular'],
};

const rows = parseCSV(fs.readFileSync(inPath, 'utf8'));
if (!rows.length) { console.error('Empty CSV:', inPath); process.exit(1); }

const header = rows[0].map(h => h.trim());
const idx = {};
Object.keys(ALIASES).forEach(field => {
  const i = header.findIndex(h => ALIASES[field].includes(normaliseKey(h)));
  if (i !== -1) idx[field] = i;
});

console.log('Headers found: ', JSON.stringify(header));
console.log('Mapped columns:', JSON.stringify(idx));

['movie', 'trackName', 'releaseYear'].forEach(f => {
  if (idx[f] === undefined) {
    console.error(`\nERROR: no column matched "${f}". Add its header to ALIASES.${f}.`);
    process.exit(1);
  }
});
if (idx.isFamous === undefined) {
  console.log('Note: no isFamous column â€” every row written as isFamous: 0.');
}

const get = (row, field) => (idx[field] === undefined ? '' : (row[idx[field]] || '').trim());

const songs = rows.slice(1).map(r => ({
  movie:         get(r, 'movie'),
  trackName:     get(r, 'trackName'),
  musicDirector: get(r, 'musicDirector'),
  singers:       get(r, 'singers'),
  cast:          get(r, 'cast'),
  releaseYear:   get(r, 'releaseYear').replace(/\.0+$/, ''),
  isFamous:      Number(get(r, 'isFamous')) === 1 ? 1 : 0,
})).filter(s => s.movie && s.trackName);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
// No BOM. JSON.stringify never emits one; this file is written as plain UTF-8.
fs.writeFileSync(outPath, JSON.stringify(songs, null, 2), 'utf8');

const movies = new Set(songs.map(s => s.movie));
const years = songs.map(s => Number(s.releaseYear)).filter(Number.isFinite).filter(y => y > 0);
console.log(`\nWrote ${songs.length} songs across ${movies.size} movies -> ${outPath}`);
if (years.length) console.log(`Year range: ${Math.min(...years)}â€“${Math.max(...years)}`);
console.log('Sample:', JSON.stringify(songs[0], null, 2));