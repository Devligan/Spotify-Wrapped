import json
import time
import requests

track_info = {}

def get_key(track, artist):
    return f"{track}||{artist}"

def get_track_data(track_name, artist_name, headers):
    try:
        search = requests.get(
            "https://api.spotify.com/v1/search",
            headers=headers,
            params={
                "q": f"{track_name} {artist_name}",
                "type": "track",
                "limit": 1
            }
        ).json()

        items = search.get("tracks", {}).get("items", [])
        if not items:
            return None

        track = items[0]

        track_id = track["id"]
        artist_id = track["artists"][0]["id"]
        album_id = track["album"]["id"]

        features = requests.get(
            f"https://api.spotify.com/v1/audio-features/{track_id}",
            headers=headers
        ).json()

        artist = requests.get(
            f"https://api.spotify.com/v1/artists/{artist_id}",
            headers=headers
        ).json()

        return {
            "track_id": track_id,
            "album_id": album_id,
            "genres": artist.get("genres", []),
            "popularity": track.get("popularity"),
            "features": {
                "danceability": features.get("danceability"),
                "energy": features.get("energy"),
                "tempo": features.get("tempo"),
                "valence": features.get("valence")
            }
        }

    except Exception as e:
        print("Error:", e)
        return None