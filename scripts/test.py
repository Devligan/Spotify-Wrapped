import os
import json
import time
import requests
import sys
from dotenv import load_dotenv

# ✅ FIX: Force UTF-8 (prevents Windows emoji crash)
sys.stdout.reconfigure(encoding='utf-8')

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
# TEST DATA
# =========================
test_tracks = [
    ("blinding lights", "the weeknd"),
    ("shape of you", "ed sheeran"),
    ("bad guy", "billie eilish")
]

# =========================
# EXPECTED FIELDS
# =========================
EXPECTED_FIELDS = {
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

# =========================
# API VALIDATION
# =========================
def test_api_connection():
    print("\n[TEST] API Connection + Schema Validation")

    name, artist = test_tracks[0]

    response = requests.get(
        BASE_URL,
        headers=HEADERS,
        params={"song": name, "artist": artist}
    )

    print("Status Code:", response.status_code)

    if response.status_code != 200:
        print("API FAILED — check key / subscription")
        return False

    try:
        data = response.json()
        print("API returned JSON")

        if not data:
            print("Empty response")
            return False

        keys = set(data.keys())
        print("Returned keys:", list(keys))

        # ✅ CHECK REQUIRED FIELDS
        missing = EXPECTED_FIELDS - keys

        if missing:
            print("Missing fields:", missing)
            return False
        else:
            print("All expected fields present")

        return True

    except Exception as e:
        print("JSON parsing failed:", e)
        return False


# =========================
# CACHE TEST
# =========================
def test_cache_logic():
    print("\n[TEST] Cache Logic")

    cache = {}
    key = "test song | test artist"

    cache[key] = {"dummy": True}

    try:
        with open("test_cache.json", "w", encoding="utf-8") as f:
            json.dump(cache, f)

        with open("test_cache.json", "r", encoding="utf-8") as f:
            loaded = json.load(f)

        if key in loaded:
            print("Cache write/read works")

            # cleanup
            os.remove("test_cache.json")

            return True
        else:
            print("Cache failed")
            return False

    except Exception as e:
        print("Cache error:", e)
        return False


# =========================
# MULTI-REQUEST TEST
# =========================
def test_multiple_requests():
    print("\n[TEST] Multiple Requests + Rate Behavior")

    success_count = 0

    for i, (name, artist) in enumerate(test_tracks):
        print(f"Request {i+1}: {name} - {artist}")

        try:
            response = requests.get(
                BASE_URL,
                headers=HEADERS,
                params={"song": name, "artist": artist}
            )

            if response.status_code == 200:
                data = response.json()

                # Optional: verify structure again
                if isinstance(data, dict):
                    success_count += 1
                else:
                    print("Invalid JSON structure")

            elif response.status_code == 429:
                print("Hit rate limit — good to know early")

            else:
                print(f"Error: {response.status_code}")

        except Exception as e:
            print("Request failed:", e)

        time.sleep(0.3)

    print(f"Successful requests: {success_count}/{len(test_tracks)}")

    return success_count > 0


# =========================
# MAIN TEST RUNNER
# =========================
if __name__ == "__main__":
    print("Running pipeline tests...\n")

    results = {
        "api_schema": test_api_connection(),
        "cache": test_cache_logic(),
        "multi": test_multiple_requests()
    }

    print("\n=========================")
    print("TEST RESULTS")
    print("=========================")

    for test, result in results.items():
        print(f"{test}: {'PASS' if result else 'FAIL'}")

    if all(results.values()):
        print("\nYou're safe to run the full pipeline.")
    else:
        print("\nFix issues before running full script.")