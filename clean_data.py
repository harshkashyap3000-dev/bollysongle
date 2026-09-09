import json
import ollama

with open('raw_songs.json', 'r', encoding='utf-8') as f:
    songs = json.load(f)

cleaned_songs = []

for song in songs:
    prompt = f"""
    Analyze these Bollywood artists: {song['raw_artists']} for the movie {song['movie']}.
    Output ONLY a valid JSON object separating the main music director/composer from the playback singers. 
    Schema: {{"composer": "Name", "singers": ["Name1", "Name2"]}}
    """
    
    try:
        response = ollama.chat(model='mistral', messages=[
            {'role': 'user', 'content': prompt}
        ])
        
        ai_content = response['message']['content'].strip()
        # Clean up markdown blocks if the model wrapped the JSON in them
        if ai_content.startswith("```json"):
            ai_content = ai_content[7:]
        if ai_content.endswith("```"):
            ai_content = ai_content[:-3]
            
        ai_data = json.loads(ai_content.strip())
        song['composer'] = ai_data.get('composer', 'Unknown')
        song['singers'] = ai_data.get('singers', [])
        del song['raw_artists']
        cleaned_songs.append(song)
        print(f"Cleaned: {song['title']}")
    except Exception as e:
        print(f"Failed to process {song['title']}: {e}")

with open('final_songs.json', 'w', encoding='utf-8') as f:
    json.dump(cleaned_songs, f, indent=2, ensure_ascii=False)
print("Data cleaning complete! Saved to final_songs.json")  