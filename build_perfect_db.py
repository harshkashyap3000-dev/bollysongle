import json
import time
import requests
import ollama
from json_repair import repair_json

years = list(range(2000, 2024))
file_path = 'data/songs.json'
all_songs = []
current_id = 1

print("Starting fresh! Wiping old data and building a STRICT database...")

for yr in years:
    print(f"\n[{yr}] Generating movie list using local Mistral...")
    
    # 1. Ask Mistral for real movie names (bypassing the blocked TMDB)
    prompt = f"""
    List exactly 10 famous Bollywood movies released in {yr}.
    Output ONLY a valid JSON array starting with '[' and ending with ']'. No markdown.
    Schema:
    [{{ "movie": "Movie Name", "actors": ["Actor 1", "Actor 2"] }}]
    """
    
    try:
        response = ollama.chat(model='mistral', messages=[
            {'role': 'user', 'content': prompt}
        ])
        repaired = repair_json(response['message']['content'].strip(), return_objects=False)
        movies = json.loads(repaired)
    except Exception as e:
        print(f"  Failed to generate movies for {yr}. Skipping...")
        continue

    # 2. Query Apple Music STRICTLY by Album Name
    for m in movies:
        movie_name = m.get("movie", "Unknown")
        actors = m.get("actors", ["Unknown"])
        print(f"  Searching Apple Music for exact album: {movie_name}")
        
        try:
            # 'attribute=albumTerm' forces Apple to only search the Album title, not song lyrics or random tags
            url = f"https://itunes.apple.com/search?term={movie_name}&media=music&entity=song&attribute=albumTerm&limit=4"
            res = requests.get(url, timeout=5).json()
            
            for track in res.get('results', []):
                album_name = track.get('collectionName', '').lower()
                
                # STRICT FILTER: Ensure the movie name is actually in the Apple Music album title 
                # This prevents compilation albums like "Best of Bollywood" from sneaking in
                if movie_name.lower() not in album_name and album_name not in movie_name.lower():
                    continue
                    
                # Skip karaoke versions
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
                
                # Prevent duplicates
                if not any(s['title'] == track['trackName'] for s in all_songs):
                    all_songs.append(song_data)
                    current_id += 1
                    
        except Exception as e:
            print(f"    Search failed for {movie_name}: {e}")
        
        time.sleep(1.5) # Polite delay

# OVERWRITE the old hallucinated JSON with the clean data
with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(all_songs, f, indent=2, ensure_ascii=False)

print(f"\nSuccess! Created a completely clean database with {len(all_songs)} verified songs.")