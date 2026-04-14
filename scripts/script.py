import os
import json
import time
from pathlib import Path
from dotenv import load_dotenv
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import spotipy.exceptions

load_dotenv()

client = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
    client_id=os.getenv("SPOTIFYCLIENTID"),
    client_secret=os.getenv("SPOTIFYCLIENTSECRET")
))

files = list(Path("public/j").glob("StreamingHistory_music_*.json")) + list(Path("public/s").glob("StreamingHistory_music_*.json"))

data = []

for file in files:
    with open(file, "r", encoding="utf-8") as f:
        data.extend(json.load(f))

artists = set()
tracks = set()

for row in data:
    if "artistName" in row:
        artists.add(row["artistName"].strip())
    if "trackName" in row:
        tracks.add((row["trackName"].strip(), row["artistName"].strip()))

artists = list(artists)
tracks = list(tracks)

print(len(artists), len(tracks))


artist_cache_path = Path("public/artist_cache.json")
track_cache_path = Path("public/track_cache.json")

if artist_cache_path.exists():
    with open(artist_cache_path, "r", encoding="utf-8") as f:
        artist_cache = json.load(f)
else:
    artist_cache = {}

if track_cache_path.exists():
    with open(track_cache_path, "r", encoding="utf-8") as f:
        track_cache = json.load(f)
else:
    track_cache = {}


artistout = []
trackout = []

seenartists = set()

i = 0
while i < len(artists):
    batch = artists[i:i+50]

    for a in batch:

        if a in artist_cache:
            art = artist_cache[a]

            if art and art["id"] not in seenartists:
                seenartists.add(art["id"])
                artistout.append(art)

            continue

        retry = 0

        while retry < 3:
            try:
                time.sleep(0.25)

                r = client.search(q=f'artist:"{a}"', type="artist", limit=1)
                items = r["artists"]["items"]

                if items:
                    art = items[0]
                    artist_cache[a] = art

                    if art["id"] not in seenartists:
                        seenartists.add(art["id"])
                        artistout.append(art)
                else:
                    artist_cache[a] = None

                break

            except spotipy.exceptions.SpotifyException as e:
                if e.http_status == 429:
                    wait = int(e.headers.get("Retry-After", 1))
                    time.sleep(wait + 1)
                else:
                    time.sleep(2)

            except Exception as e:
                print("artist error:", e)
                time.sleep(2)

            retry += 1

    with open(artist_cache_path, "w", encoding="utf-8") as f:
        json.dump(artist_cache, f)

    i += 50


trackids = {}
seentracks = set()

j = 0
while j < len(tracks):
    n, a = tracks[j]
    key = n + "||" + a
    if key in track_cache:
        tid = track_cache[key]

        if tid and tid not in seentracks:
            seentracks.add(tid)
            trackids[(n, a)] = tid
        j += 1
        continue
    retry = 0
    while retry < 3:
        try:
            time.sleep(0.25)
            q = f'track:"{n}" artist:"{a}"'
            r = client.search(q=q, type="track", limit=1)
            items = r["tracks"]["items"]
            if items:
                tid = items[0]["id"]
                track_cache[key] = tid

                if tid not in seentracks:
                    seentracks.add(tid)
                    trackids[(n, a)] = tid
            else:
                track_cache[key] = None
            break

        except spotipy.exceptions.SpotifyException as e:
            if e.http_status == 429:
                wait = int(e.headers.get("Retry-After", 1))
                time.sleep(wait + 1)
            else:
                time.sleep(2)
        except Exception as e:
            print("track error:", e)
            time.sleep(2)
        retry += 1
    if j % 100 == 0:
        with open(track_cache_path, "w", encoding="utf-8") as f:
            json.dump(track_cache, f)
    j += 1
ids = list(trackids.values())
i = 0
while i < len(ids):
    batch = ids[i:i+50]
    retry = 0
    while retry < 3:
        try:
            time.sleep(0.25)
            r = client.tracks(batch)
            trackout.extend(r["tracks"])
            break
        except spotipy.exceptions.SpotifyException as e:
            if e.http_status == 429:
                wait = int(e.headers.get("Retry-After", 1))
                time.sleep(wait + 1)
            else:
                time.sleep(2)
        except Exception as e:
            print("batch error:", e)
            time.sleep(2)
        retry += 1
    i += 50

with open(artist_cache_path, "w", encoding="utf-8") as f:
    json.dump(artist_cache, f)

with open(track_cache_path, "w", encoding="utf-8") as f:
    json.dump(track_cache, f)

with open(Path("public/artists.json"), "w", encoding="utf-8") as f:
    json.dump(artistout, f)

with open(Path("public/tracks.json"), "w", encoding="utf-8") as f:
    json.dump(trackout, f)

print("done")