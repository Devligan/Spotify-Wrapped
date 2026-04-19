import json

import pandas as pd

# Convert track_info dict → DataFrame
with open("public/track_info.json", encoding="utf-8") as f:
    track_info = json.load(f)

# Convert dict → DataFrame
features_df = pd.DataFrame(track_info).T

# Features you care about
ALL_FEATURES = ['energy', 'danceability', 'happiness', 'acousticness',
                'instrumentalness', 'liveness', 'speechiness', 'tempo',
                'popularity', 'loudness', 'duration', 'mode', 'key']

print("\n--- Feature Ranges ---")

for col in ALL_FEATURES:
    if col not in features_df.columns:
        continue
    
    # Handle special cases
    if col == 'loudness':
        values = features_df[col].dropna().apply(lambda x: float(str(x).replace(' dB','')))
    elif col == 'duration':
        def convert_duration(x):
            try:
                m, s = str(x).split(':')
                return int(m)*60 + int(s)
            except:
                return None
        values = features_df[col].dropna().apply(convert_duration)
    elif col == 'mode':
        values = features_df[col].dropna().apply(lambda x: 1 if str(x).lower() == 'major' else 0)
    elif col == 'key':
        key_map = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,
                   'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}
        values = features_df[col].dropna().apply(lambda x: key_map.get(str(x), None)).dropna()
    else:
        values = pd.to_numeric(features_df[col], errors='coerce').dropna()
    
    if len(values) == 0:
        continue

    print(f"{col}: min = {values.min()}, max = {values.max()}")