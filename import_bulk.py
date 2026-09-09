import json
import urllib.request

# Publicly hosted open-source Bollywood dataset JSON mirror
DATA_URL = "https://raw.githubusercontent.com/sagarraut/bollywood-dataset/master/songs.json" 
# Alternatively, we can parse a clean local structure. Let's fetch a robust sample endpoint:
try:
    print("Fetching bulk Bollywood dataset...")
    req = urllib.request.Request(
        DATA_URL, 
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
        formatted_db = []
        for index, item in enumerate(data[:1000]): # Cap at 1000+ tracks
            formatted_db.append({
                "id": index + 1,
                "title": item.get("song_name", item.get("title", "Unknown Track")),
                "singers": item.get("singers", ["Unknown Singer"]),
                "composer": item.get("music_director", item.get("composer", "Unknown")),
                "movie": item.get("movie_name", item.get("movie", "Unknown Movie")),
                "actors": item.get("star_cast", item.get("actors", ["Unknown"])),
                "year": int(item.get("year", 2010))
            })
            
        with open("songs_1000.json", "w", encoding="utf-8") as f:
            json.dump(formatted_db, f, indent=2, ensure_ascii=False)
            
        print(f"Successfully generated {len(formatted_db)} tracks into songs_1000.json!")
except Exception as e:
    print(f"Error fetching bulk data: {e}")