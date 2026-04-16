import json
import time
import random
import requests
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding="utf-8")

# =========================
# MUSICBRAINZ CONFIG
# =========================

BASE_URL = "https://musicbrainz.org/ws/2"

HEADERS = {
    # REQUIRED: identify your app + contact
    "User-Agent": "SpotifyAnalysisProject/1.0 (your_email@example.com)"
}

RATE_LIMIT_DELAY = 1.1  # MUST be >= 1 sec (MusicBrainz rule)

# =========================
# SAFE REQUEST WRAPPER
# =========================

def safe_get(url, params):
    for attempt in range(5):
        try:
            time.sleep(RATE_LIMIT_DELAY)

            r = requests.get(
                url,
                headers=HEADERS,
                params=params,
                timeout=10
            )

            if r.status_code == 200:
                return r

            # retry server-side issues only
            if r.status_code in [500, 502, 503, 504]:
                time.sleep(2 ** attempt)
                continue

            return None

        except requests.exceptions.RequestException:
            time.sleep(2 ** attempt)

    return None

# =========================
# SEARCH RECORDING
# =========================

def search_recording(track, artist):
    url = f"{BASE_URL}/recording"

    params = {
        "query": f'recording:"{track}" AND artist:"{artist}"',
        "fmt": "json",
        "limit": 1
    }

    r = safe_get(url, params)
    if not r:
        return None

    data = r.json()
    recs = data.get("recordings", [])

    return recs[0]["id"] if recs else None

# =========================
# LOOKUP FULL METADATA
# =========================

def lookup_recording(mbid):
    url = f"{BASE_URL}/recording/{mbid}"

    params = {
        "fmt": "json",
        "inc": "artists+releases+tags+genres+isrcs+rating"
    }

    r = safe_get(url, params)
    if not r:
        return None

    return r.json()

# =========================
# LOAD YOUR SPOTIFY DATA
# =========================

files = list(Path("public/j").glob("StreamingHistory_music_*.json")) + \
        list(Path("public/s").glob("StreamingHistory_music_*.json"))

data = []
for file in files:
    with open(file, "r", encoding="utf-8") as f:
        data.extend(json.load(f))

tracks = list({
    (r["trackName"].strip(), r["artistName"].strip())
    for r in data
    if "trackName" in r and "artistName" in r
})

print("unique tracks:", len(tracks))

# =========================
# RANDOM SAMPLE (5 SONGS)
# =========================

sample_tracks = random.sample(tracks, min(5, len(tracks)))

print("\nSelected tracks:\n")
for t in sample_tracks:
    print(t)

# =========================
# RUN PIPELINE
# =========================

results = []

for i, (track, artist) in enumerate(sample_tracks, 1):
    print(f"\n[{i}/5] {track} - {artist}")

    mbid = search_recording(track, artist)

    if not mbid:
        print("  -> No match found")
        continue

    print("  -> MBID:", mbid)

    data = lookup_recording(mbid)

    if not data:
        print("  -> Lookup failed")
        continue

    results.append(data)

    print("  -> Title:", data.get("title"))
    print("  -> Artists:", [
        a.get("name") for a in data.get("artist-credit", []) if isinstance(a, dict)
    ])
    print("  -> Genres:", [g.get("name") for g in data.get("genres", [])])
    print("  -> Tags:", [t.get("name") for t in data.get("tags", [])])
    print("  -> ISRCs:", data.get("isrcs", []))

# =========================
# SAVE OUTPUT
# =========================

with open("musicbrainz_sample_output.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print("\nDone.")