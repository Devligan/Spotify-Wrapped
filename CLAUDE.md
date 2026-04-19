# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with hot reload
npm run build     # Production build to dist/
npm run preview   # Preview production build locally
```

Python scripts have no `requirements.txt`; install manually:
```bash
pip install requests python-dotenv pandas matplotlib seaborn
```

The track enrichment script requires a `.env` file:
```
RAPIDAPI_KEY=your_key_here
```

## Architecture

This project has two independent layers:

### React Dashboard (`src/app.jsx`)
The entire frontend is a **single ~540-line React component file** with no routing, no CSS files (all inline styles), and no sub-components in separate files. It uses Recharts for all visualizations.

Data flow:
1. On load, `useEffect` fetches streaming JSON from `public/s/` (Sriharsha) or `public/j/` (Janya) based on the selected user
2. Records are filtered to plays ≥ 5000ms, then stored in `allRecords` state
3. A dual-slider date range controls `rangeStart`/`rangeEnd`; `useMemo` re-derives `filtered` records
4. `computeStats(filtered)` runs one aggregation pass → the `stats` object drives all three tabs: `OverviewTab`, `TemporalTab`, `TopContentTab`

Users are hardcoded in a `USERS` constant in `app.jsx`. Adding a user means editing that constant and placing their Spotify JSON exports in `public/<prefix>/`.

### Python Data Pipeline (`scripts/script.py`)
Enriches tracks with audio features via RapidAPI:
1. Reads all `StreamingHistory_music_*.json` from both user data directories
2. Uses `public/track_info.json` as a persistent cache (keyed `"trackName | artistName"`)
3. Calls `track-analysis.p.rapidapi.com` for uncached tracks (rate-limited: 5 req → 1.1s pause, 3 retries)
4. Saves incrementally back to `public/track_info.json`

**Note:** `public/track_info.json` has rich cached audio features (tempo, energy, danceability, key, mode, etc.) but the React dashboard does not use this data yet — it's available for ML tasks.

### Analysis Files
- `SriharshaDataViz.ipynb` — Jupyter EDA notebook (expects local path `"Sriharsha Spotify Account Data/"`, not in repo)
- `janyaEDAspotify.R` — R EDA using tidyverse/ggplot2
- `basic_vis.py` — quick matplotlib prototype

## Project Context

This is a course assignment (deadline April 20–22, 2026) requiring: similarity measures, classification (Decision Trees + one other), clustering, outlier detection, and optionally a music recommender. The dashboard is a bonus deliverable. The `track_info.json` audio features cache is the primary data source for ML tasks. ALWAYS read assignment_instructions.md before beginning any work in the repository. 
