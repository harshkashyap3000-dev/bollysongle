import json
import time
import ollama
from tmdbv3api import TMDb, Discover, Movie
from json_repair import repair_json

# --- PASTE YOUR TMDB API KEY HERE ---
TMDB_API_KEY = '290f5cb197e18b0dffc40d0b618bf245'

tmdb = TMDb()
tmdb.api_key = TMDB_API_KEY
discover = Discover()
movie_api = Movie()

all_songs = []
current_id = 1
years = list(range(2000, 2024))

print("Starting verified TMDB + Ollama extraction with network safety...")

for yr in years:
    print(f"\nFetching top movies for {yr} from TMDB...")
    
    # Safety net for the initial TMDB connection
    try:
        movies = discover.discover_movies({
            'with_original_language': 'hi',
            'primary_release_year': yr,
            'sort_by': 'popularity.desc',
            'page': 1
        })
    except Exception as e:
        print(f"  Network hiccup while fetching movies for {yr}. Skipping to next year...")
        time.sleep(2)
        continue

    for movie in list(movies)[:15]:
        movie_name = movie.title
        print(f"  Generating songs for: {movie_name} ({yr})")
        
        try:
            details = movie_api.details(movie.id)
            casts = getattr(details, 'casts', {}).get('cast', [])
            actors = [c.name for c in casts[:2]] if casts else ["Unknown"]
        except Exception:
            actors = ["Unknown"]

        prompt = f"""
        List exactly 3 famous tracks from the Bollywood movie "{movie_name}" released in {yr}.
        Output ONLY a valid JSON array starting with '[' and ending with ']'. No markdown.
        
        Schema for each object:
        {{
          "title": "Song Name",
          "singers": ["Singer 1", "Singer 2"],
          "composer": "Music Director",
          "movie": "{movie_name}",
          "actors": {json.dumps(actors)},
          "year": {yr}
        }}
        """
        
        try:
            response = ollama.chat(model='mistral', messages=[
                {'role': 'user', 'content': prompt}
            ])
            
            repaired_string = repair_json(response['message']['content'].strip(), return_objects=False)
            batch_data = json.loads(repaired_string)
            
            if isinstance(batch_data, list):
                for song in batch_data:
                    song['id'] = current_id
                    song['year'] = yr 
                    song['movie'] = movie_name
                    song['actors'] = actors
                    all_songs.append(song)
                    current_id += 1
                    
        except Exception as e:
            print(f"    Failed parsing for {movie_name}: {e}")
        
        # Brief pause to keep the connection stable and avoid rate limits
        time.sleep(0.5)
            
    print(f"Total verified songs so far: {len(all_songs)}")

with open('data/songs.json', 'w', encoding='utf-8') as f:
    json.dump(all_songs, f, indent=2, ensure_ascii=False)

print(f"\nComplete! Generated {len(all_songs)} highly accurate songs and saved to data/songs.json")