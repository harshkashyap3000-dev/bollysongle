const fs = require('fs');

// 👉 PASTE YOUR REAL TMDB API KEY HERE
const TMDB_API_KEY = '290f5cb197e18b0dffc40d0b618bf245'; 

function cleanMusicDirectorName(mdString) {
  if (!mdString || mdString === "Bollywood Composer") return "Various Artists";
  const md = mdString.toLowerCase();
  
  if (md.includes('loy mendonsa') || md.includes('shankar mahadevan') || md.includes('ehsaan noorani')) return "Shankar-Ehsaan-Loy";
  if (md.includes('jatin') || md.includes('lalit')) return "Jatin-Lalit";
  if (md.includes('vishal dadlani') || md.includes('shekhar ravjiani') || md.includes('vishal-shekhar')) return "Vishal-Shekhar";
  if (md.includes('salim merchant') || md.includes('sulaiman merchant')) return "Salim-Sulaiman";
  if (md.includes('laxmikant') || md.includes('pyarelal')) return "Laxmikant-Pyarelal";
  if (md.includes('nadeem') || md.includes('shravan')) return "Nadeem-Shravan";
  if (md.includes('ajay gogavale') || md.includes('atul gogavale') || (md.includes('ajay') && md.includes('atul'))) return "Ajay-Atul";
  if (md.includes('anand chitragupt') || md.includes('milind chitragupt')) return "Anand-Milind";
  if (md.includes('sajid') || md.includes('wajid')) return "Sajid-Wajid";
  
  return mdString;
}

// Cleans up the artist string to isolate actual singers and standardize formatting
function cleanSingers(artistString) {
  if (!artistString) return "Various Artists";
  let artists = artistString.split(/,|&|feat\.|ft\./i).map(s => s.trim()).filter(Boolean);
  return artists.join(', ');
}

async function fetchAppleMusicTracks(searchQuery, baseTitle, targetYear) {
  const appleUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&country=IN&media=music&entity=song&limit=50`;
  const res = await fetch(appleUrl);
  const data = await res.json();
  
  if (!data.results || data.results.length === 0) return [];

  const cleanBaseTitle = baseTitle.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const titleRegex = new RegExp(`\\b${cleanBaseTitle}\\b`, 'i');
  const targetYearNum = targetYear ? parseInt(targetYear, 10) : null;

  return data.results.filter(track => {
    const genre = (track.primaryGenreName || "").toLowerCase();
    const lowerTrack = (track.trackName || "").toLowerCase();
    const lowerCollection = (track.collectionName || "").toLowerCase();
    
    if (lowerTrack.includes('jhankar') || lowerCollection.includes('jhankar') ||
        lowerTrack.includes('remix') || lowerCollection.includes('remix') ||
        lowerTrack.includes('lofi') || lowerCollection.includes('lo-fi') ||
        lowerTrack.includes('instrumental') || lowerTrack.includes('karaoke') ||
        lowerTrack.includes('mashup')) {
        return false;
    }

    const isIndian = genre.includes('bollywood') || genre.includes('indian') || genre.includes('soundtrack') || genre.includes('regional');
    if (!isIndian) return false;

    if (targetYearNum && track.releaseDate) {
      const trackYear = parseInt(track.releaseDate.substring(0, 4), 10);
      if (Math.abs(trackYear - targetYearNum) > 1) {
        return false;
      }
    }

    const cleanCollection = lowerCollection.replace(/[^a-z0-9 ]/g, '');
    return titleRegex.test(cleanCollection);
  });
}

async function buildDataset() {
  const dataset = [];
  const fileContent = fs.readFileSync('movies.txt', 'utf-8');
  const rawTitles = fileContent
    .split('\n')
    .map(name => name.trim())
    .filter(name => name.length > 0);

  console.log(`Found ${rawTitles.length} movies. Starting extraction...`);

  for (let i = 0; i < rawTitles.length; i++) {
    const rawTitle = rawTitles[i];
    
    let baseTitle = rawTitle;
    let extractedYear = null;
    const yearMatch = rawTitle.match(/\((\d{4})\)/);
    
    if (yearMatch) {
        extractedYear = yearMatch[1];
        baseTitle = rawTitle.replace(/\s*\(\d{4}\).*$/, '').trim();
    }

    let castList = [];
    let musicDirector = "Bollywood Composer";
    let movieYear = extractedYear || "2000";

    console.log(`\n[${i + 1}/${rawTitles.length}] Processing: "${baseTitle}" (${movieYear})`);

    // --- 1. TMDB: FETCH CINEMATIC DATA ---
    if (TMDB_API_KEY !== 'PASTE_YOUR_API_KEY_HERE' && TMDB_API_KEY !== 'your_actual_api_key_string' && TMDB_API_KEY.length > 10) {
      let retries = 3;
      while (retries > 0) {
        try {
          const yearParam = extractedYear ? `&primary_release_year=${extractedYear}` : '';
          const tmdbSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(baseTitle)}&region=IN${yearParam}`;
          
          const tmdbSearchRes = await fetch(tmdbSearchUrl, { 
            headers: { 'Accept': 'application/json', 'User-Agent': 'BollyGuesserScript/1.0' }
          });
          
          if (tmdbSearchRes.ok) {
              const tmdbSearchData = await tmdbSearchRes.json();
              if (tmdbSearchData.results && tmdbSearchData.results.length > 0) {
                const hindiMatch = tmdbSearchData.results.find(m => m.original_language === 'hi');
                const movieObj = hindiMatch || tmdbSearchData.results[0];
                const movieId = movieObj.id;

                if (!extractedYear && movieObj.release_date) {
                    movieYear = movieObj.release_date.substring(0, 4);
                }

                const tmdbCreditsUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${TMDB_API_KEY}`;
                const tmdbCreditsRes = await fetch(tmdbCreditsUrl, {
                   headers: { 'Accept': 'application/json', 'User-Agent': 'BollyGuesserScript/1.0' }
                });
                
                if (tmdbCreditsRes.ok) {
                    const tmdbCreditsData = await tmdbCreditsRes.json();
                    
                    if (tmdbCreditsData.cast && tmdbCreditsData.cast.length > 0) {
                      castList = tmdbCreditsData.cast.slice(0, 3).map(actor => actor.name);
                    }
                    
                    if (tmdbCreditsData.crew) {
                      const composerObjs = tmdbCreditsData.crew.filter(c => {
                        const job = (c.job || "").toLowerCase();
                        return job === 'original music composer' || job === 'music director' || job === 'music';
                      });
                      
                      if (composerObjs.length > 0) {
                          const uniqueComposers = [...new Set(composerObjs.map(c => c.name))];
                          musicDirector = uniqueComposers.join(' & ');
                      }
                    }
                }
              }
              break; 
          } else {
              break; 
          }
        } catch (err) {
          retries -= 1;
          if (retries === 0) {
            console.error(`⚠️ TMDB Connection Error: ${err.message}`);
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000)); 
          }
        }
      }
    }

    // --- 2. APPLE MUSIC: MULTI-STAGE FALLBACK SEARCH ---
    try {
      let validTracks = await fetchAppleMusicTracks(baseTitle, baseTitle, movieYear);

      if (validTracks.length === 0) {
          validTracks = await fetchAppleMusicTracks(baseTitle + " Bollywood", baseTitle, movieYear);
      }

      if (validTracks.length === 0 && movieYear) {
          validTracks = await fetchAppleMusicTracks(baseTitle + " " + movieYear, baseTitle, movieYear);
      }

      if (validTracks.length > 0) {
        const tracksToProcess = validTracks.slice(0, 4);
        
        for (const track of tracksToProcess) {
          let finalMD = musicDirector;
          if ((!finalMD || finalMD === "Bollywood Composer") && track.collectionArtistName && track.collectionArtistName !== "Various Artists") {
            finalMD = track.collectionArtistName;
          }

          finalMD = cleanMusicDirectorName(finalMD);
          const finalCast = castList.length > 0 ? castList : ["Data Unavailable"];
          const finalYear = track.releaseDate ? track.releaseDate.substring(0, 4) : movieYear;
          const finalSingers = cleanSingers(track.artistName);

          dataset.push({
            movie: baseTitle, 
            trackName: track.trackName,
            musicDirector: finalMD,
            singers: finalSingers,
            cast: finalCast,
            album: track.collectionName || baseTitle,
            releaseYear: finalYear,
            coverArt: track.artworkUrl100
          });

          console.log(`  ✅ Track: "${track.trackName}" | Singers: ${finalSingers} | MD: ${finalMD} | Cast: ${finalCast.join(', ')} | Year: ${finalYear}`);
        }
      } else {
         console.log(`  ❌ Filtered out all tracks or none found for: "${baseTitle}"`);
      }
    } catch (err) {
      console.error(`⚠️ Apple Music Error for ${baseTitle}:`, err.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  fs.writeFileSync('songs-fixed.json', JSON.stringify(dataset, null, 2));
  console.log('\n🎉 Finished! Open songs-fixed.json to view the structured data.');
}

buildDataset();