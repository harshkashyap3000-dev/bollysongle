import csv
import json
import os

def build_json_from_csv():
    # Ensure the 'data' directory exists so we don't get a folder error
    os.makedirs('data', exist_ok=True)
    
    songs_list = []
    try:
        with open('perfect_dataset.csv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                song_obj = {
                    "movie": row.get('movie', '').strip(),
                    "trackName": row.get('trackname', '').strip(),
                    "musicDirector": row.get('musicDirector', '').strip(),
                    "singers": row.get('singers', '').strip(),
                    "cast": row.get('cast', '').strip(),
                    "releaseYear": str(row.get('releaseYear', '')).strip(),
                    "isFamous": 1 # Adding this for your 75/25 logic later
                }
                songs_list.append(song_obj)

        # Save directly to the path your page.tsx is importing from
        with open('data/songs.json', 'w', encoding='utf-8') as jf:
            json.dump(songs_list, jf, indent=2)
            
        print(f"🎉 Successfully saved {len(songs_list)} perfect tracks to data/songs.json!")

    except FileNotFoundError:
        print("❌ Error: 'perfect_dataset.csv' not found. Make sure it is in the same folder.")

if __name__ == '__main__':
    build_json_from_csv()