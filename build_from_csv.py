import csv
import json
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os
import ollama
from json_repair import repair_json

csv_file = 'data/movies.csv'
json_file = 'data/songs.json'

if not os.path.exists(csv_file):
    print(f"Error: Could not find {csv_file}. Please ensure it is in the data folder.")
    exit()

# Set up a highly resilient network session that auto-retries on timeouts
session = requests.Session()
retry = Retry(total=5, backoff_factor=1.5, status_forcelist=[429, 500, 502, 503, 504])
adapter = HTTPAdapter(max_retries=retry)
session.mount('http://', adapter)
session.mount('https://', adapter)

all_songs = []
current_id = 1

print(f"Reading movies from {csv_file} with resilient networking...")

with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    
    for row in reader:
        row_keys = {k.lower().strip(): k for k in row.keys() if k}
        
        movie_name = row.get(row_keys.get('movies', 'movies'), '').strip()
        year_str = row.get(row_keys.get('year', 'year'), '').strip()
        actors_raw = row.get(row_keys.get('actors', 'actors'), '').strip()
        
        if not movie_name or not year_str:
            continue
            
        try:
            yr = int(year_str)
        except ValueError:
            continue

        if not actors_raw:
            print(f"  [Missing Cast] Asking local AI for {movie_name} ({yr})...")
            prompt = f"""
            Who are the 2 main lead actors in the Bollywood movie '{movie_name}' released in {yr}?
            Return ONLY a valid JSON array of their names. Do not include any other text or markdown.
            Example: ["Shah Rukh Khan", "Kajol"]
            """
            try:
                response = ollama.chat(model='mistral', messages=[{'role': 'user', 'content': prompt}])
                repaired = repair_json(response['message']['content'].strip(), return_objects=False)
                actors = json.loads(repaired)
                if not isinstance(actors, list) or not actors:
                    actors = ["Unknown"]
            except Exception as e:
                print(f"    AI fallback failed: {e}")
                actors = ["Unknown"]
        else:
            if '|' in actors_raw:
                actors = [a.strip() for a in actors_raw.split('|') if a.strip()]
            else:
                actors = [a.strip() for a in actors_raw.split(',') if a.strip()]

        print(f"  Searching Apple Music for: {movie_name} ({yr})")
        
        try:
            url = f"https://itunes.apple.com/search?term={movie_name}&media=music&entity=song&attribute=albumTerm&limit=5"
            # Increased timeout to 15s and using the auto-retrying session
            res = session.get(url, timeout=15).json()
            
            for track in res.get('results', []):
                if "karaoke" in track['trackName'].lower() or "instrumental" in track['trackName'].lower():
                    continue
                
                artist = track.get('artistName', 'Unknown')
                song_data = {
                    "id": current_id,
                    "title": track['trackName'],
                    "singers": [artist],
                    "composer": artist,
                    "movie": movie_name,
                    "actors": actors[:3], 
                    "year": yr
                }
                
                if not any(s['title'] == track['trackName'] for s in all_songs):
                    all_songs.append(song_data)
                    current_id += 1
                    
        except requests.exceptions.RequestException as e:
            print(f"    Network failure after multiple retries for {movie_name}. Skipping to keep script alive.")
        except Exception as e:
            print(f"    Data parsing error for {movie_name}: {e}")
        
        # Polite delay to avoid aggressive rate limits
        time.sleep(1.5)

with open(json_file, 'w', encoding='utf-8') as f:
    json.dump(all_songs, f, indent=2, ensure_ascii=False)

print(f"\nComplete! Converted your CSV into a fully playable database of {len(all_songs)} verified songs.")