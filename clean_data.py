import json

# Load your raw database
with open('data/songs.json', 'r', encoding='utf-8') as f:
    songs = json.load(f)

cleaned_songs = []
for song in songs:
    # 1. Clean up Composer: reject if it has numbers, weird handles, or is clearly non-Bollywood
    composer = song.get('composer', '')
    if any(char.isdigit() for char in composer) or '.' in composer or len(composer.strip()) < 2:
        composer = "Various / Unknown"
    
    # 2. Clean up Actors: filter out anyone with numbers or weird non-name strings
    valid_actors = []
    for actor in song.get('actors', []):
        if not any(char.isdigit() for char in actor) and '.' not in actor:
            valid_actors.append(actor.strip())

    # Rebuild the clean song object
    song['composer'] = composer
    song['actors'] = valid_actors
    cleaned_songs.append(song)

# Save back to songs.json
with open('data/songs.json', 'w', encoding='utf-8') as f:
    json.dump(cleaned_songs, f, indent=2)

print(f"Cleaned {len(cleaned_songs)} songs successfully!")