import json
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from tmdbv3api import TMDb, Movie

# --- CONFIGURATION (PASTE YOUR KEYS HERE) ---
SPOTIPY_CLIENT_ID = '026a801fe3654b628b55781726e624b9'
SPOTIPY_CLIENT_SECRET = '7213a85fedc240e39555beaf7b226f7e'
TMDB_API_KEY = '290f5cb197e18b0dffc40d0b618bf245'

# Example playlist ID: Bollywood Mush (A great playlist for 2000-2023 hits)
PLAYLIST_ID = '37i9dQZF1DX0XUfTFmNBRM' 

# --- INITIALIZE APIS ---
sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(client_id=SPOTIPY_CLIENT_ID, client_secret=SPOTIPY_CLIENT_SECRET))
tmdb = TMDb()
tmdb.api_key = TMDB_API_KEY
movie_api = Movie()

def get_actors(movie_name, year):
    search = movie_api.search(movie_name)
    if not search:
        return []
    
    # Filter for Hindi movies to ensure accurate matches
    for result in search:
        if getattr(result, 'original_language', '') == 'hi':
            details = movie_api.details(result.id)
            casts = getattr(details, 'casts', {}).get('cast', [])
            return [cast.name for cast in casts[:2]] # Top 2 lead actors
    return []

def extract_playlist_data():
    results = sp.playlist_tracks(PLAYLIST_ID)
    tracks = results['items']
    db = []
    
    for i, item in enumerate(tracks):
        track = item['track']
        if not track:
            continue
        title = track['name']
        movie_name = track['album']['name']
        release_date = track['album']['release_date']
        year = int(release_date[:4]) if release_date else 2000
        raw_artists = [artist['name'] for artist in track['artists']]
        
        print(f"Processing: {title} from {movie_name}")
        actors = get_actors(movie_name, year)
        
        db.append({
            "id": i + 1,
            "title": title,
            "raw_artists": raw_artists,
            "movie": movie_name,
            "actors": actors,
            "year": year
        })
        
    return db

raw_database = extract_playlist_data()
with open('raw_songs.json', 'w', encoding='utf-8') as f:
    json.dump(raw_database, f, indent=2, ensure_ascii=False)
print("Raw extraction complete. Saved to raw_songs.json")