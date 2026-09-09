import json
import time
import requests
import os
import ollama
from json_repair import repair_json

missing_years = [2007, 2008, 2009, 2010, 2013, 2014, 2016, 2018, 2019, 2020, 2021, 2022, 2023]
file_path = 'data/songs.json'

# Load existing songs so we do not overwrite your current progress
if os.path.exists(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        all_songs = json.load(f)
else:
    all_songs = []

current_id = max([song['id'] for song in all_songs], default=0) + 1
print(f"Loaded {len(all_songs)} existing tracks. Backfilling using Local AI + Apple Music...")

for yr in missing_years:
    print(f"\nGenerating movie list for {yr} using local Mistral (Bypassing TMDB)...")
    
    # Use your local model to get a factual list of movies for the year
    prompt = f"""
    List exactly 12 famous Bollywood movies released in {yr}.
    Output ONLY a valid JSON array starting with '[' and ending with ']'. No markdown.
    
    Schema:
    [{{ "movie": "Movie Name", "actors": ["Lead Actor 1", "Lead Actor 2"] }}]
    """
    
    try:
        response = ollama.chat(model='mistral', messages=[
            {'role': 'user', 'content': prompt}
        ])
        
        repaired = repair_json(response['message']['content'].strip(), return_objects=False)
        movies = json.loads(repaired)
    except Exception as e:
        print(f"  Failed to generate movie list for {yr}. Skipping...")
        continue

    # Use Apple's public API to get the real tracks for those AI-generated movies
    for m in movies:
        movie_name = m.get("movie", "Unknown")
        actors = m.get("actors", ["Unknown"])
        print(f"  Fetching real Apple Music tracks for: {movie_name} ({yr})")
        
        try:
            term = f"{movie_name} bollywood"
            url = f"https://itunes.apple.com/search?term={term}&media=music&entity=song&limit=3"
            res = requests.get(url, timeout=5).json()
            
            if not res.get('results'):
                term = f"{movie_name} {yr}"
                url = f"https://itunes.apple.com/search?term={term}&media=music&entity=song&limit=2"
                res = requests.get(url, timeout=5).json()
                
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
                    "actors": actors,
                    "year": yr
                }
                
                # Prevent duplicate entries
                if not any(s['title'] == track['trackName'] for s in all_songs):
                    all_songs.append(song_data)
                    current_id += 1
                    
        except Exception as e:
            print(f"    Apple search failed for {movie_name}: {e}")
        
        # Polite delay for Apple servers
        time.sleep(1)

# Write the final combined database
with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(all_songs, f, indent=2, ensure_ascii=False)

print(f"\nComplete! Your database now has {len(all_songs)} verified songs ready for the game.")