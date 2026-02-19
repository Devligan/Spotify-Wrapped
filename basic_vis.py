import json, glob
import pandas as pd
import matplotlib.pyplot as plt

raw = []
for f in sorted(glob.glob("Sriharsha Spotify Account Data/StreamingHistory_music*.json")):
    with open(f, encoding="utf-8") as fh:
        raw.extend(json.load(fh))

df = pd.DataFrame(raw)
df["end_time"] = pd.to_datetime(df["endTime"])
df["month"] = df["end_time"].dt.to_period("M").astype(str)
df = df[df["msPlayed"] >= 30_000]

monthly = df.groupby("month").size().reset_index(name="songs")

fig, ax = plt.subplots(figsize=(12, 5))
ax.plot(monthly["month"], monthly["songs"], marker="o", linewidth=2, color="steelblue")
ax.set_xlabel("Month")
ax.set_ylabel("Songs Listened To")
ax.set_title("Songs Listened to by Month")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.show()