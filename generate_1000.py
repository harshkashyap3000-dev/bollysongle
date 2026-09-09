import json
import ollama
from json_repair import repair_json

all_songs = []
current_id = 1

# Spanning years 2000 to 2023 with 45 songs per year yields ~1,080 tracks total
years = list(range(2000, 2024))
songs_per_year = 45 

print("Starting error-proof, high-yield Bollywood database generation...")

for yr in years:
    print(f"Generating {songs_per_year} songs for year {yr}...")
    prompt = f"""
    Generate a JSON array containing exactly {songs_per_year} iconic and diverse Bollywood songs released in the year {yr}.
    Output ONLY a valid JSON array starting with '[' and ending with ']'. No markdown blocks, no conversational text.
    
    Strict schema for each object:
    {{
      "title": "Song Name",
      "singers": ["Singer 1", "Singer 2"],
      "composer": "Music Director",
      "movie": "Movie Name",
      "actors": ["Actor 1", "Actor 2"],
      "year": {yr}
    }}
    """
    
    try:
        response = ollama.chat(model='mistral', messages=[
            {'role': 'user', 'content': prompt}
        ], options={"num_predict": 4096}) # Allow long output token generation
        
        content = response['message']['content'].strip()
        
        # Automatically fix any malformed JSON, missing commas, or trailing errors from the LLM
        repaired_string = repair_json(content, return_objects=False)
        batch_data = json.loads(repaired_string)
        
        if not isinstance(batch_data, list):
            print(f"Skipping {yr}: Output was not a JSON list.")
            continue
            
        for song in batch_data:
            song['id'] = current_id
            song['year'] = yr # Force strict year match
            all_songs.append(song)
            current_id += 1
            
        print(f"Successfully added year {yr}. Total songs so far: {len(all_songs)}")
    except Exception as e:
        print(f"Skipped year {yr} due to unexpected error: {e}")

# Save final output directly into data/songs.json
with open('data/songs.json', 'w', encoding='utf-8') as f:
    json.dump(all_songs, f, indent=2, ensure_ascii=False)

print(f"Complete! Generated {len(all_songs)} songs and saved directly to data/songs.json")