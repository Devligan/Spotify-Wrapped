import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

// ── helpers ──────────────────────────────────────────────────────────────────

function toMinutes(ms) { return ms / 60000; }

function parseRecords(raw) {
  return raw
    .filter(r => r.msPlayed >= 5000)
    .map(r => {
      const dt = new Date(r.endTime);
      return {
        endTime: dt,
        artistName: r.artistName,
        trackName: r.trackName,
        msPlayed: r.msPlayed,
        minutes: toMinutes(r.msPlayed),
        hour: dt.getHours(),
        dayOfWeek: dt.toLocaleDateString("en-US", { weekday: "short" }),
        month: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`,
        date: dt.toISOString().slice(0, 10),
      };
    });
}

function filterByRange(records, start, end) {
  const s = new Date(start);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return records.filter(r => r.endTime >= s && r.endTime <= e);
}

function computeStats(records) {
  if (!records.length) return null;

  const totalMin = records.reduce((a, r) => a + r.minutes, 0);
  const uniqueArtists = new Set(records.map(r => r.artistName)).size;
  const uniqueTracks = new Set(records.map(r => r.trackName)).size;

  const byDate = {};
  records.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + r.minutes; });
  const dailyVals = Object.values(byDate);
  const avgDaily = dailyVals.reduce((a, b) => a + b, 0) / (dailyVals.length || 1);
  const maxDaily = Math.max(...dailyVals);

  // hourly
  const hourly = Array.from({ length: 24 }, (_, h) => ({ h: String(h), m: 0 }));
  records.forEach(r => { hourly[r.hour].m += r.minutes; });

  // day of week
  const DOW_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowMap = {};
  records.forEach(r => { dowMap[r.dayOfWeek] = (dowMap[r.dayOfWeek] || 0) + r.minutes; });
  const dow = DOW_ORDER.map(d => ({ day: d, min: Math.round(dowMap[d] || 0) }));

  // monthly
  const monthMap = {};
  records.forEach(r => { monthMap[r.month] = (monthMap[r.month] || 0) + r.minutes; });
  const monthly = Object.keys(monthMap).sort().map(m => ({ m, min: Math.round(monthMap[m]) }));

  // top artists
  const artistMap = {};
  records.forEach(r => { artistMap[r.artistName] = (artistMap[r.artistName] || 0) + r.minutes; });
  const topArtists = Object.entries(artistMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, min]) => ({ name, min: Math.round(min) }));

  // top tracks
  const trackMap = {};
  records.forEach(r => {
    const k = `${r.trackName} — ${r.artistName}`;
    trackMap[k] = (trackMap[k] || 0) + r.minutes;
  });
  const topTracks = Object.entries(trackMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, min]) => ({ name, min: Math.round(min) }));

  // unique artists per month
  const monthArtists = {};
  records.forEach(r => {
    if (!monthArtists[r.month]) monthArtists[r.month] = new Set();
    monthArtists[r.month].add(r.artistName);
  });
  const uniquePerMonth = Object.keys(monthArtists).sort()
    .map(m => ({ m, count: monthArtists[m].size }));

  // sessions (gap > 30 min = new session)
  const sorted = [...records].sort((a, b) => a.endTime - b.endTime);
  const sessions = [];
  let cur = 0;
  sorted.forEach((r, i) => {
    if (i === 0) { sessions.push(r.minutes); return; }
    const gap = (r.endTime - sorted[i - 1].endTime) / 60000;
    if (gap > 30) { sessions.push(r.minutes); cur++; }
    else sessions[cur] = (sessions[cur] || 0) + r.minutes;
  });
  const sessBuckets = [0,30,60,120,180,300,Infinity];
  const sessLabels = ["<30m","30–60m","1–2h","2–3h","3–5h","5h+"];
  const sessHist = sessLabels.map((label, i) => ({
    label,
    count: sessions.filter(s => s >= sessBuckets[i] && s < sessBuckets[i + 1]).length,
  }));

  // night vs day
  const nightMin = records.filter(r => r.hour >= 19 || r.hour <= 2).reduce((a, r) => a + r.minutes, 0);
  const dayMin = totalMin - nightMin;

  // heatmap
  const DOW_FULL = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const heatMap = {};
  records.forEach(r => {
    const k = `${r.dayOfWeek}-${r.hour}`;
    heatMap[k] = (heatMap[k] || 0) + r.minutes;
  });
  const heatData = [];
  DOW_FULL.forEach(d => {
    for (let h = 0; h < 24; h++) heatData.push({ day: d, hour: h, val: heatMap[`${d}-${h}`] || 0 });
  });
  const heatMax = Math.max(...heatData.map(r => r.val));

  return {
    totalMin: Math.round(totalMin),
    totalHours: (totalMin / 60).toFixed(1),
    totalStreams: records.length,
    uniqueArtists,
    uniqueTracks,
    avgDaily: avgDaily.toFixed(1),
    maxDaily: maxDaily.toFixed(1),
    hourly,
    dow,
    monthly,
    topArtists,
    topTracks,
    uniquePerMonth,
    sessHist,
    nightMin: Math.round(nightMin),
    dayMin: Math.round(dayMin),
    heatData,
    heatMax,
  };
}

// ── constants ─────────────────────────────────────────────────────────────────

const USERS = {
  Sriharsha: [
    "/Sriharsha Spotify Account Data/StreamingHistory_music_0.json",
    "/Sriharsha Spotify Account Data/StreamingHistory_music_1.json",
  ],
  Janya: [
    "/Janya Spotify Account Data/StreamingHistory_music_0.json",
    "/Janya Spotify Account Data/StreamingHistory_music_1.json"
    // add more paths if Janya has more files
  ],
};

const TABS = ["Overview", "Temporal", "Top Content"];
const COLORS = ["#1DB954","#1ed760","#535353","#b3b3b3","#404040","#888"];
const DOW_FULL = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ── main component ────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState("Sriharsha");
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Overview");

  // date range state
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(100);
  const [sliderStart, setSliderStart] = useState(0);
  const [sliderEnd, setSliderEnd] = useState(100);

  // load data whenever user changes
  useEffect(() => {
    setLoading(true);
    Promise.all(USERS[user].map(path => fetch(path).then(r => r.json())))
      .then(arrays => {
        const records = parseRecords(arrays.flat());
        records.sort((a, b) => a.endTime - b.endTime);
        setAllRecords(records);

        if (records.length) {
          const first = records[0].date;
          const last = records[records.length - 1].date;
          setMinDate(first); setMaxDate(last);
          setRangeStart(first); setRangeEnd(last);
          setSliderMin(0); setSliderMax(100);
          setSliderStart(0); setSliderEnd(100);
        }
        setLoading(false);
      })
      .catch(err => { console.error(err); setLoading(false); });
  }, [user]);

  // slider ↔ date sync helpers
  function dateToSlider(dateStr) {
    if (!minDate || !maxDate) return 0;
    const total = new Date(maxDate) - new Date(minDate);
    const pos = new Date(dateStr) - new Date(minDate);
    return Math.round((pos / total) * 100);
  }
  function sliderToDate(val) {
    if (!minDate || !maxDate) return "";
    const total = new Date(maxDate) - new Date(minDate);
    const ms = new Date(minDate).getTime() + (val / 100) * total;
    return new Date(ms).toISOString().slice(0, 10);
  }

  function handleSliderStartChange(val) {
    const v = Math.min(Number(val), sliderEnd - 1);
    setSliderStart(v);
    setRangeStart(sliderToDate(v));
  }
  function handleSliderEndChange(val) {
    const v = Math.max(Number(val), sliderStart + 1);
    setSliderEnd(v);
    setRangeEnd(sliderToDate(v));
  }
  function handleDateStartChange(val) {
    setRangeStart(val);
    setSliderStart(dateToSlider(val));
  }
  function handleDateEndChange(val) {
    setRangeEnd(val);
    setSliderEnd(dateToSlider(val));
  }

  const filtered = useMemo(
    () => (rangeStart && rangeEnd ? filterByRange(allRecords, rangeStart, rangeEnd) : allRecords),
    [allRecords, rangeStart, rangeEnd]
  );

  const stats = useMemo(() => computeStats(filtered), [filtered]);

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 36 }}>🎵</span>
          <div>
            <h1 style={s.h1}>Spotify Listening Dashboard</h1>
            <p style={s.sub}>Personal analytics · processed on the fly</p>
          </div>
        </div>

        {/* user toggle */}
        <div style={s.radioGroup}>
          {Object.keys(USERS).map(u => (
            <label key={u} style={{ ...s.radioLabel, background: user === u ? "#1DB954" : "#282828", color: user === u ? "#000" : "#fff" }}>
              <input type="radio" name="user" value={u} checked={user === u} onChange={() => setUser(u)} style={{ display: "none" }} />
              {u}
            </label>
          ))}
        </div>
      </div>

      {/* DATE RANGE CONTROLS */}
      <div style={s.rangeBar}>
        <span style={s.rangeLabel}>Date Range</span>

        {/* dual range slider */}
        <div style={s.sliderWrap}>
          <input type="range" min={sliderMin} max={sliderMax} value={sliderStart}
            onChange={e => handleSliderStartChange(e.target.value)}
            style={{ ...s.slider, zIndex: sliderStart > 90 ? 5 : 3 }} />
          <input type="range" min={sliderMin} max={sliderMax} value={sliderEnd}
            onChange={e => handleSliderEndChange(e.target.value)}
            style={{ ...s.slider, zIndex: 4 }} />
          {/* track fill */}
          <div style={{
            ...s.trackFill,
            left: `${sliderStart}%`,
            width: `${sliderEnd - sliderStart}%`,
          }} />
        </div>

        {/* date inputs */}
        <input type="date" value={rangeStart} min={minDate} max={rangeEnd}
          onChange={e => handleDateStartChange(e.target.value)} style={s.dateInput} />
        <span style={{ color: "#b3b3b3" }}>→</span>
        <input type="date" value={rangeEnd} min={rangeStart} max={maxDate}
          onChange={e => handleDateEndChange(e.target.value)} style={s.dateInput} />
      </div>

      {/* TABS */}
      <div style={s.tabBar}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }}>
            {t}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={s.content}>
        {loading && <div style={s.loading}>Loading data…</div>}
        {!loading && !stats && <div style={s.loading}>No data in selected range.</div>}
        {!loading && stats && (
          <>
            {tab === "Overview" && <OverviewTab stats={stats} />}
            {tab === "Temporal" && <TemporalTab stats={stats} />}
            {tab === "Top Content" && <TopContentTab stats={stats} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── tab components ────────────────────────────────────────────────────────────

function OverviewTab({ stats }) {
  const statCards = [
    { label: "Total Hours", value: stats.totalHours, sub: `${stats.totalMin.toLocaleString()} minutes` },
    { label: "Total Streams", value: stats.totalStreams.toLocaleString(), sub: "unique plays" },
    { label: "Unique Artists", value: stats.uniqueArtists.toLocaleString(), sub: "explored" },
    { label: "Unique Tracks", value: stats.uniqueTracks.toLocaleString(), sub: "songs" },
    { label: "Daily Average", value: `${stats.avgDaily}`, sub: "minutes/day" },
    { label: "Peak Day", value: `${stats.maxDaily}`, sub: "minutes in one day" },
  ];

  const nightDayPie = [
    { name: "Night (7PM–3AM)", value: stats.nightMin },
    { name: "Day", value: stats.dayMin },
  ];

  return (
    <div>
      <div style={s.grid6}>
        {statCards.map(c => (
          <div key={c.label} style={s.statCard}>
            <div style={s.statVal}>{c.value}</div>
            <div style={s.statLabel}>{c.label}</div>
            <div style={s.statSub}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={s.grid2}>
        <Card title="Night vs Day Listening">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={nightDayPie} dataKey="value" cx="50%" cy="50%" outerRadius={85}
                label={({ name, percent }) => `${(percent * 100).toFixed(1)}%`} labelLine={false}>
                <Cell fill="#1DB954" />
                <Cell fill="#535353" />
              </Pie>
              <Legend formatter={v => <span style={{ color: "#fff", fontSize: 12 }}>{v}</span>} />
              <Tooltip contentStyle={tt} formatter={v => [`${Math.round(v)} min`]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Session Length Distribution">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.sessHist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="label" tick={{ fill: "#b3b3b3", fontSize: 11 }} />
              <YAxis tick={{ fill: "#b3b3b3", fontSize: 11 }} />
              <Tooltip contentStyle={tt} formatter={v => [`${v} sessions`]} />
              <Bar dataKey="count" fill="#1DB954" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function TemporalTab({ stats }) {
  const heatMax = stats.heatMax || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card title="Monthly Listening Activity (minutes)">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={stats.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="m" tick={{ fill: "#b3b3b3", fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fill: "#b3b3b3", fontSize: 11 }} />
            <Tooltip contentStyle={tt} formatter={v => [`${v} min`]} />
            <Line type="monotone" dataKey="min" stroke="#1DB954" strokeWidth={3} dot={{ r: 3, fill: "#1DB954" }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div style={s.grid2}>
        <Card title="Listening by Hour of Day">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="h" tick={{ fill: "#b3b3b3", fontSize: 11 }} />
              <YAxis tick={{ fill: "#b3b3b3", fontSize: 11 }} />
              <Tooltip contentStyle={tt} formatter={v => [`${Math.round(v)} min`]} />
              <Bar dataKey="m" fill="#1DB954" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Listening by Day of Week">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.dow}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="day" tick={{ fill: "#b3b3b3", fontSize: 11 }} />
              <YAxis tick={{ fill: "#b3b3b3", fontSize: 11 }} />
              <Tooltip contentStyle={tt} formatter={v => [`${Math.round(v)} min`]} />
              <Bar dataKey="min" fill="#535353" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Heatmap: Day × Hour Intensity">
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "44px repeat(24,1fr)", gap: 2, minWidth: 680 }}>
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ textAlign: "center", fontSize: 9, color: "#b3b3b3" }}>{h}</div>
            ))}
            {DOW_FULL.map(d => [
              <div key={d} style={{ fontSize: 10, color: "#b3b3b3", display: "flex", alignItems: "center" }}>{d}</div>,
              ...Array.from({ length: 24 }, (_, h) => {
                const row = stats.heatData.find(r => r.day === d && r.hour === h);
                const opacity = row ? Math.min(row.val / heatMax, 1) : 0;
                return (
                  <div key={`${d}-${h}`} title={`${d} ${h}:00 — ${Math.round(row?.val || 0)} min`}
                    style={{ height: 18, borderRadius: 2, background: `rgba(29,185,84,${opacity.toFixed(2)})`, cursor: "default" }} />
                );
              }),
            ])}
          </div>
          <p style={{ fontSize: 11, color: "#b3b3b3", marginTop: 8 }}>Darker green = more listening. Hover a cell for exact minutes.</p>
        </div>
      </Card>
    </div>
  );
}

function TopContentTab({ stats }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={s.grid2}>
        <Card title="Top 10 Artists by Minutes">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[...stats.topArtists].reverse()} layout="vertical" margin={{ left: 8, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" tick={{ fill: "#b3b3b3", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#fff", fontSize: 10 }} width={100} />
              <Tooltip contentStyle={tt} formatter={v => [`${v} min`]} />
              <Bar dataKey="min" fill="#1DB954" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Top 10 Tracks by Minutes">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[...stats.topTracks].reverse()} layout="vertical" margin={{ left: 8, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" tick={{ fill: "#b3b3b3", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#fff", fontSize: 10 }} width={120} />
              <Tooltip contentStyle={tt} formatter={v => [`${v} min`]} />
              <Bar dataKey="min" fill="#1ed760" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Unique Artists Discovered Per Month">
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={stats.uniquePerMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="m" tick={{ fill: "#b3b3b3", fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fill: "#b3b3b3", fontSize: 11 }} />
            <Tooltip contentStyle={tt} formatter={v => [`${v} artists`]} />
            <Line type="monotone" dataKey="count" stroke="#1ed760" strokeWidth={3} dot={{ r: 3, fill: "#1ed760" }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ── shared ui ─────────────────────────────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div style={s.card}>
      <h3 style={s.cardTitle}>{title}</h3>
      {children}
    </div>
  );
}

const tt = { background: "#333", border: "none", color: "#fff" };

// ── styles ────────────────────────────────────────────────────────────────────

const s = {
  page: { background: "#121212", minHeight: "100vh", color: "#fff", fontFamily: "Arial,sans-serif", paddingBottom: 48 },
  header: { background: "linear-gradient(135deg,#1DB954,#191414)", padding: "28px 28px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 },
  h1: { margin: 0, fontSize: 26, fontWeight: 700 },
  sub: { margin: 0, color: "#b3ffcb", fontSize: 13 },
  radioGroup: { display: "flex", gap: 8 },
  radioLabel: { padding: "10px 22px", borderRadius: 24, cursor: "pointer", fontWeight: 600, fontSize: 14, transition: "all .2s", userSelect: "none" },

  rangeBar: { background: "#1a1a1a", padding: "16px 28px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", borderBottom: "1px solid #282828" },
  rangeLabel: { fontWeight: 600, fontSize: 13, color: "#b3b3b3", whiteSpace: "nowrap" },
  sliderWrap: { position: "relative", flex: 1, minWidth: 160, height: 20, display: "flex", alignItems: "center" },
  slider: {
    position: "absolute", width: "100%", appearance: "none", WebkitAppearance: "none",
    background: "transparent", height: 4, outline: "none", pointerEvents: "all", cursor: "pointer",
  },
  trackFill: { position: "absolute", height: 4, background: "#1DB954", borderRadius: 2, pointerEvents: "none" },
  dateInput: { background: "#282828", border: "1px solid #404040", color: "#fff", borderRadius: 6, padding: "6px 10px", fontSize: 12 },

  tabBar: { background: "#181818", padding: "0 24px", display: "flex", gap: 4, borderBottom: "1px solid #282828" },
  tabBtn: { background: "transparent", color: "#b3b3b3", border: "none", padding: "14px 18px", cursor: "pointer", fontWeight: 400, fontSize: 14, borderBottom: "3px solid transparent", transition: "all .2s" },
  tabActive: { color: "#fff", fontWeight: 700, borderBottom: "3px solid #1DB954" },

  content: { padding: "24px 24px 0" },
  loading: { textAlign: "center", color: "#b3b3b3", padding: 60, fontSize: 16 },

  grid6: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14, marginBottom: 24 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },

  statCard: { background: "#282828", borderRadius: 12, padding: "18px 14px", textAlign: "center" },
  statVal: { fontSize: 26, fontWeight: 700, color: "#1DB954" },
  statLabel: { fontSize: 12, fontWeight: 600, marginTop: 4 },
  statSub: { fontSize: 11, color: "#b3b3b3", marginTop: 2 },

  card: { background: "#282828", borderRadius: 12, padding: "18px 16px" },
  cardTitle: { margin: "0 0 14px", fontSize: 14, fontWeight: 600, color: "#fff" },
};