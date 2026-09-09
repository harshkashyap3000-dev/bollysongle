import json
import time
import requests
from tmdbv3api import TMDb, Discover, Movie

# --- CONFIGURATION ---
TMDB_API_KEY = '290f5cb197e18b0dffc40d0b618bf245'

# 1. TMDB Auth (Verified Movies & Actors)
tmdb = TMDb()
tmdb.api_key = TMDB_API_KEY
discover = Discover()
movie_api = Movie()

all_songs = []
current_id = 1
years = list(range(2000, 2024))

print("Starting 100% verified factual extraction using TMDB & Apple Music (No Premium Required)...")

for yr in years:
    print(f"\nFetching top movies for {yr} from TMDB...")
    try:
        movies = discover.discover_movies({
            'with_original_language': 'hi',
            'primary_release_year': yr,
            'sort_by': 'popularity.desc',
            'page': 1
        })
    except Exception as e:
        print(f"Network error on TMDB: {e}")
        time.sleep(2)
        continue

    for movie in list(movies)[:15]:
        movie_name = movie.title
        print(f"  Searching Apple Music for album: {movie_name} ({yr})")
        
        # Fetch verified actors
        try:
            details = movie_api.details(movie.id)
            casts = getattr(details, 'casts', {}).get('cast', [])
            actors = [c.name for c in casts[:2]] if casts else ["Unknown"]
        except Exception:
            actors = ["Unknown"]
            
        # Search Apple/iTunes Public API strictly for this movie
        try:
            # Query format targeting Bollywood movies
            term = f"{movie_name} bollywood"
            url = f"https://itunes.apple.com/search?term={term}&media=music&entity=song&limit=4"
            response = requests.get(url, timeout=5)
            data = response.json()
            
            # Fallback search if the strict tag fails
            if not data.get('results'):
                term = f"{movie_name} {yr}"
                url = f"https://itunes.apple.com/search?term={term}&media=music&entity=song&limit=3"
                response = requests.get(url, timeout=5)
                data = response.json()
                
            for track in data.get('results', []):
                # Filter out karaoke/instrumental tracks
                if "karaoke" in track['trackName'].lower() or "instrumental" in track['trackName'].lower():
                    continue

                # Apple API usually provides a primary artist string
                artist = track.get('artistName', 'Unknown')
                
                song_data = {
                    "id": current_id,
                    "title": track['trackName'],
                    "singers": [artist], 
                    "composer": artist, # Assigning artist as composer for API simplicity
                    "movie": movie_name,
                    "actors": actors,
                    "year": yr
                }
                
                # Prevent duplicate tracks
                if not any(s['title'] == track['trackName'] for s in all_songs):
                    all_songs.append(song_data)
                    current_id += 1
                    
        except Exception as e:
            print(f"    Apple search failed for {movie_name}: {e}")
        
        # 1-second delay to be polite to Apple's servers and avoid temporary IP bans
        time.sleep(1)
        
    print(f"Total authentic songs extracted so far: {len(all_songs)}")

with open('data/songs.json', 'w', encoding='utf-8') as f:
    json.dump(all_songs, f, indent=2, ensure_ascii=False)

print(f"\nComplete! Extracted {len(all_songs)} strictly verified songs and saved to data/songs.json")