import os
import json
import time
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()

# =========================
# CONFIG
# =========================
API_KEY = os.getenv("RAPIDAPI_KEY")

BASE_URL = "https://track-analysis.p.rapidapi.com/pktx/analysis"

HEADERS = {
    "x-rapidapi-key": API_KEY,
    "x-rapidapi-host": "track-analysis.p.rapidapi.com"
}

# =========================
# LOAD STREAMING DATA
# =========================
files = list(Path("public/j").glob("StreamingHistory_music_*.json")) + \
        list(Path("public/s").glob("StreamingHistory_music_*.json"))

data = []
for file in files:
    with open(file, "r", encoding="utf-8") as f:
        data.extend(json.load(f))

tracks = set()

for row in data:
    if "trackName" in row and "artistName" in row:
        name = row["trackName"].strip()
        artist = row["artistName"].strip()
        tracks.add((name, artist))

tracks = list(tracks)

print("Unique tracks:", len(tracks))

cache_path = Path("public/track_info.json")

if cache_path.exists():
    with open(cache_path, "r", encoding="utf-8") as f:
        cache = json.load(f)
else:
    cache = {}

cached_keys = set(cache.keys())

REQUIRED_FIELDS = {
    "id",
    "key",
    "mode",
    "camelot",
    "tempo",
    "duration",
    "popularity",
    "energy",
    "danceability",
    "happiness",
    "acousticness",
    "instrumentalness",
    "liveness",
    "speechiness",
    "loudness"
}

to_process = [
    (n, a)
    for (n, a) in tracks
    if f"{n} | {a}" not in cached_keys
]

print("Tracks to fetch:", len(to_process))

REQUESTS_BEFORE_PAUSE = 5
PAUSE_TIME = 1.1
request_counter = 0

for i, (name, artist) in enumerate(to_process):
    key = f"{name} | {artist}"

    retry = 0
    success = False

    while retry < 3 and not success:
        try:
            response = requests.get(
                BASE_URL,
                headers=HEADERS,
                params={"song": name, "artist": artist}
            )

            if response.status_code == 200:
                data = response.json()

                if isinstance(data, dict):
                    missing = REQUIRED_FIELDS - set(data.keys())

                    if missing:
                        print(f"Missing fields for {key}: {missing}")
                        cache[key] = None
                    else:
                        cache[key] = data
                else:
                    cache[key] = None

                success = True

            elif response.status_code == 429:
                wait = int(response.headers.get("Retry-After", 1))
                print(f"Rate limited → waiting {wait}s")
                time.sleep(wait + 1)

            else:
                print(f"API error {response.status_code} → {key}")
                cache[key] = None
                success = True

        except Exception as e:
            print(f"Request error for {key}: {e}")
            time.sleep(2)

        retry += 1

    if not success:
        cache[key] = None

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)

    cached_keys.add(key)
    request_counter += 1
    print(f"[{i + 1}/{len(to_process)}] {key}")

    if request_counter % REQUESTS_BEFORE_PAUSE == 0:
        print(f"Pausing after {REQUESTS_BEFORE_PAUSE} requests...")
        time.sleep(PAUSE_TIME)

print("Done. All tracks processed safely.")