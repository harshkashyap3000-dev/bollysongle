import sqlite3
import csv

def build_database_from_csv():
    conn = sqlite3.connect('songs.db')
    cursor = conn.cursor()

    # Recreate the exact table structure your app expects
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            movie TEXT,
            trackName TEXT,
            musicDirector TEXT,
            singers TEXT,
            cast TEXT,
            album TEXT,
            releaseYear TEXT,
            coverArt TEXT
        )
    ''')
    
    # Clear out the old dirty data
    cursor.execute('DELETE FROM songs')

    try:
        with open('perfect_dataset.csv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            count = 0
            for row in reader:
                cursor.execute('''
                    INSERT INTO songs (movie, trackName, musicDirector, singers, cast, album, releaseYear, coverArt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    row.get('movie', '').strip(),
                    row.get('trackname', '').strip(),     # Matches your CSV header exactly
                    row.get('musicDirector', '').strip(),
                    row.get('singers', '').strip(),
                    row.get('cast', '').strip(),
                    row.get('movie', '').strip(),         # Using movie name as a fallback for album
                    str(row.get('releaseYear', '')).strip(),
                    ''                                    # Leaving coverArt blank for now
                ))
                count += 1

        conn.commit()
        print(f"🎉 Successfully loaded {count} perfect tracks directly from CSV into the database!")

    except FileNotFoundError:
        print("❌ Error: 'perfect_dataset.csv' not found. Please save your Excel file as CSV in this folder.")
    except Exception as e:
        print(f"⚠️ An error occurred: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    build_database_from_csv()