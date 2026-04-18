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

REQUIRED_FIELDS = {
    "id", "key", "mode", "camelot", "tempo", "duration",
    "popularity", "energy", "danceability", "happiness",
    "acousticness", "instrumentalness", "liveness",
    "speechiness", "loudness"
}

REQUESTS_BEFORE_PAUSE = 5
PAUSE_TIME = 1.1

# =========================
# LOAD STREAMING DATA
# =========================
files = list(Path("public/j").glob("StreamingHistory_music_*.json")) + \
        list(Path("public/s").glob("StreamingHistory_music_*.json"))

raw_data = []
for file in files:
    with open(file, "r", encoding="utf-8") as f:
        raw_data.extend(json.load(f))

tracks = set()
for row in raw_data:
    if "trackName" in row and "artistName" in row:
        tracks.add((row["trackName"].strip(), row["artistName"].strip()))

tracks = list(tracks)
print("Unique tracks:", len(tracks))

# =========================
# LOAD CACHE
# =========================
cache_path = Path("public/track_info.json")

if cache_path.exists():
    with open(cache_path, "r", encoding="utf-8") as f:
        cache = json.load(f)
else:
    cache = {}

# =========================
# FETCH FUNCTION
# =========================
def fetch_track(name, artist):
    """Attempt to fetch a track up to 3 times. Returns data dict or None."""
    key = f"{name} | {artist}"

    for retry in range(3):
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
                        print(f"  Missing fields for {key}: {missing}")
                        return None
                    return data
                return None

            elif response.status_code == 429:
                wait = int(response.headers.get("Retry-After", 1))
                print(f"  Rate limited → waiting {wait}s")
                time.sleep(wait + 1)

            else:
                print(f"  API error {response.status_code} → {key}")
                return None

        except Exception as e:
            print(f"  Request error for {key}: {e}")
            time.sleep(2)

    return None

# =========================
# PASS 1: FETCH NEW TRACKS
# =========================
cached_keys = set(cache.keys())
to_process = [(n, a) for (n, a) in tracks if f"{n} | {a}" not in cached_keys]
print(f"Tracks to fetch (new): {len(to_process)}")

request_counter = 0

for i, (name, artist) in enumerate(to_process):
    key = f"{name} | {artist}"
    result = fetch_track(name, artist)
    cache[key] = result

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)

    request_counter += 1
    status = "✓" if result else "✗ null"
    print(f"[{i + 1}/{len(to_process)}] {status} — {key}")

    if request_counter % REQUESTS_BEFORE_PAUSE == 0:
        print(f"Pausing after {REQUESTS_BEFORE_PAUSE} requests...")
        time.sleep(PAUSE_TIME)

# =========================
# PASS 2: RETRY ALL NULLS
# =========================
null_keys = [k for k, v in cache.items() if v is None]
print(f"\nRetrying {len(null_keys)} null entries...")

request_counter = 0

for i, key in enumerate(null_keys):
    try:
        name, artist = key.split(" | ", 1)
    except ValueError:
        print(f"  Skipping malformed key: {key}")
        continue

    print(f"[{i + 1}/{len(null_keys)}] Retrying: {key}")
    result = fetch_track(name, artist)

    if result:
        cache[key] = result
        print(f"  ✓ Recovered!")
    else:
        print(f"  ✗ Still null")

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)

    request_counter += 1
    if request_counter % REQUESTS_BEFORE_PAUSE == 0:
        print(f"Pausing after {REQUESTS_BEFORE_PAUSE} requests...")
        time.sleep(PAUSE_TIME)

# =========================
# SUMMARY
# =========================
still_null = [k for k, v in cache.items() if v is None]
recovered = len(null_keys) - len(still_null)

print(f"\nDone.")
print(f"  Recovered: {recovered}/{len(null_keys)}")
print(f"  Still null: {len(still_null)}")
if still_null:
    print("  Remaining nulls:")
    for k in still_null:
        print(f"    - {k}")