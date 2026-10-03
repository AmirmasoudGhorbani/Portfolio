"""Build the earthquake model and export the dashboard data.

    python pipeline/fetch.py    # download the GeoNet catalogue (only if refreshing)
    python pipeline/build.py    # model it and write dashboard/data.json

Runs the SQL in ../sql with DuckDB, then does the parts that are easier in
Python: declustering, aftershock-decay fits, the b-value with a bootstrap,
the cross-section and the city table.
"""
import json
import os
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from scipy.optimize import minimize

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "processed" / "quakes.duckdb"
OUT = ROOT / "dashboard" / "data.json"
COAST = ROOT / "data" / "raw" / "nz-coastline.json"
MODERN = (2012, 2025)        # one magnitude system, full years
EARTH_R = 6371.0

CITIES = {
    "Auckland": (-36.85, 174.76), "Hamilton": (-37.79, 175.28), "Tauranga": (-37.69, 176.17),
    "Rotorua": (-38.14, 176.25), "Gisborne": (-38.66, 178.02), "Napier": (-39.49, 176.91),
    "New Plymouth": (-39.06, 174.08), "Palmerston North": (-40.35, 175.61),
    "Wellington": (-41.29, 174.78), "Nelson": (-41.27, 173.28), "Blenheim": (-41.51, 173.95),
    "Christchurch": (-43.53, 172.64), "Queenstown": (-45.03, 168.66),
    "Dunedin": (-45.87, 170.50), "Invercargill": (-46.41, 168.35),
}

# Aftershock sequences: mainshock id, a box around the rupture, days to follow
SEQUENCES = {
    "kaikoura": {"name": "Kaikōura M7.8, 14 Nov 2016", "id": "2016p858000",
                 "box": (-43.2, -41.3, 172.4, 175.0), "days": 365},
    "darfield": {"name": "Darfield M7.2, 4 Sep 2010", "id": "3366146",
                 "box": (-43.8, -43.3, 171.6, 173.0), "days": 170},  # stops before Christchurch, 22 Feb 2011
}


def haversine(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_R * np.arcsin(np.sqrt(a))


def rows(con, sql):
    cur = con.execute(sql)
    cols = [d[0] for d in cur.description]
    out = []
    for r in cur.fetchall():
        d = {}
        for k, v in zip(cols, r):
            d[k] = v.isoformat() if hasattr(v, "isoformat") else (round(v, 4) if isinstance(v, float) else v)
        out.append(d)
    return out


def decluster(df):
    """Gardner-Knopoff (1974) windows: working down from the largest event,
    anything smaller inside its space-time window is a dependent (aftershock
    or foreshock). Returns a boolean array: True for mainshocks."""
    t = (df.origin_utc - df.origin_utc.min()).dt.total_seconds().to_numpy() / 86400
    lat, lon, mag = df.lat.to_numpy(), df.lon.to_numpy(), df.mag.to_numpy()
    main = np.ones(len(df), bool)
    for i in np.argsort(-mag, kind="stable"):
        if not main[i]:
            continue
        m = mag[i]
        dist_km = 10 ** (0.1238 * m + 0.983)
        days = 10 ** (0.032 * m + 2.7389) if m >= 6.5 else 10 ** (0.5409 * m - 0.547)
        idx = np.arange(np.searchsorted(t, t[i] - days), np.searchsorted(t, t[i] + days))
        idx = idx[(idx != i) & main[idx] & (mag[idx] <= m)]
        near = idx[haversine(lat[i], lon[i], lat[idx], lon[idx]) <= dist_km]
        main[near] = False
    return main


def b_value(mags, mc, dm=0.1):
    """Aki (1965) maximum-likelihood b-value with Utsu's binning correction."""
    x = mags[mags >= mc - 1e-9]
    return np.log10(np.e) / (x.mean() - (mc - dm / 2))


def omori_fit(df, seq, mmin=3.5, t_min=0.05):
    """Fit the modified Omori law n(t) = K / (c + t)^p by maximum likelihood."""
    main = df[df.event_id == seq["id"]].iloc[0]
    la0, la1, lo0, lo1 = seq["box"]
    s = df[(df.origin_utc > main.origin_utc) & df.lat.between(la0, la1) & df.lon.between(lo0, lo1) & (df.mag >= mmin)]
    t = (s.origin_utc - main.origin_utc).dt.total_seconds().to_numpy() / 86400
    t_max = seq["days"]
    t = t[(t >= t_min) & (t <= t_max)]

    def nll(p):
        K, c, q = np.exp(p[0]), np.exp(p[1]), p[2]
        q = q + 1e-6 if abs(q - 1) < 1e-6 else q
        integral = K * ((c + t_max) ** (1 - q) - (c + t_min) ** (1 - q)) / (1 - q)
        return integral - np.sum(np.log(K) - q * np.log(c + t))

    r = minimize(nll, [np.log(len(t)), np.log(0.05), 1.1], method="Nelder-Mead",
                 options={"maxiter": 5000, "xatol": 1e-7, "fatol": 1e-7})
    K, c, p = np.exp(r.x[0]), np.exp(r.x[1]), r.x[2]
    # observed daily counts on log-spaced bins, for the chart
    edges = np.unique(np.round(np.logspace(np.log10(t_min), np.log10(t_max), 22), 4))
    counts, _ = np.histogram(t, edges)
    mids = np.sqrt(edges[:-1] * edges[1:])
    obs = [{"t": round(float(m), 4), "rate": round(float(n / (b - a)), 3)}
           for m, n, a, b in zip(mids, counts, edges[:-1], edges[1:]) if n > 0]
    fit = [{"t": round(float(x), 4), "rate": round(float(K / (c + x) ** p), 3)}
           for x in np.logspace(np.log10(t_min), np.log10(t_max), 60)]
    return {"name": seq["name"], "mag": float(main.mag), "n": int(len(t)), "mmin": mmin,
            "K": round(K, 1), "c": round(c, 3), "p": round(p, 2), "obs": obs, "fit": fit,
            "day1": int(((t >= 0) & (t < 1)).sum()), "after30": int((t >= 30).sum()), "days": t_max}


def cross_section(df):
    """Quakes within 50 km of a line running WNW from the Hikurangi trench,
    across the central North Island: shows the Pacific plate diving under it."""
    lat0, lon0, az = -40.2, 178.6, np.radians(302)
    k = np.radians(1) * EARTH_R
    x = (df.lon - lon0) * k * np.cos(np.radians(lat0))
    y = (df.lat - lat0) * k
    along = x * np.sin(az) + y * np.cos(az)
    across = x * np.cos(az) - y * np.sin(az)
    s = df[(along.between(0, 500)) & (across.abs() <= 50) & (df.mag >= 3)]
    s = s.assign(along=along[s.index])
    end = (lat0 + 500 * np.cos(az) / k, lon0 + 500 * np.sin(az) / (k * np.cos(np.radians(lat0))))
    # reference places along the line (distance from the trench, km)
    places = {"Hawke's Bay coast": (-39.70, 177.10), "Taupō": (-38.69, 176.07),
              "Taranaki coast": (-38.55, 174.60)}
    marks = []
    for name, (la, lo) in places.items():
        px, py = (lo - lon0) * k * np.cos(np.radians(lat0)), (la - lat0) * k
        marks.append({"name": name, "along": round(float(px * np.sin(az) + py * np.cos(az)), 1)})
    return {"points": [[round(a, 1), round(d, 1), round(m, 1)] for a, d, m in zip(s.along, s.depth_km, s.mag)],
            "line": [[lon0, lat0], [round(end[1], 3), round(end[0], 3)]], "marks": marks}


def city_table(df, main):
    m = df.assign(main=main)
    m = m[m.yr.between(*MODERN) & (m.depth_km < 40)]
    years = MODERN[1] - MODERN[0] + 1
    out = []
    for name, (la, lo) in CITIES.items():
        near = m[haversine(la, lo, m.lat.to_numpy(), m.lon.to_numpy()) <= 100]
        n4 = int(((near.mag >= 4) & near.main).sum())
        n5 = int(((near.mag >= 5) & near.main).sum())
        rate5 = n5 / years
        out.append({"city": name, "lat": la, "lon": lo,
                    "m4_all": int((near.mag >= 4).sum()), "m4_main": n4, "m5_main": n5,
                    "m4_per_year": round(n4 / years, 1),
                    # Poisson chance of at least one shallow M5+ mainshock in a given year
                    "p5_year": round(100 * (1 - np.exp(-rate5))),
                    "every_years": round(years / n5, 1) if n5 else None})
    return sorted(out, key=lambda r: -r["m4_main"])


def main():
    DB.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB))
    os.chdir(ROOT)
    for f in sorted((ROOT / "sql").glob("*.sql")):
        con.execute(f.read_text())

    df = con.execute("SELECT * FROM nz_quakes ORDER BY origin_utc").df()

    # Declustering on the modern era at M3+ (complete, one magnitude system)
    mod = df[(df.yr >= MODERN[0]) & (df.mag >= 3)].reset_index(drop=True)
    is_main = decluster(mod)
    con.execute("CREATE OR REPLACE TABLE declustered AS SELECT * FROM mod")
    con.execute("ALTER TABLE declustered ADD COLUMN is_main BOOLEAN")
    con.register("flags", pd.DataFrame({"event_id": mod.event_id, "is_main": is_main}))
    con.execute("UPDATE declustered SET is_main = flags.is_main FROM flags WHERE declustered.event_id = flags.event_id")
    yearly = rows(con, """SELECT yr, count(*) AS all_events, count(*) FILTER (WHERE is_main) AS mainshocks
                          FROM declustered GROUP BY yr ORDER BY yr""")
    monthly = rows(con, """SELECT date_trunc('month', origin_utc)::DATE AS month,
                                  count(*) AS all_events, count(*) FILTER (WHERE is_main) AS mainshocks
                           FROM declustered GROUP BY 1 ORDER BY 1""")

    # b-value, modern era, with a bootstrap 95% interval
    mags = df[df.yr.between(*MODERN)].mag.to_numpy()
    mc = 3.0
    rng = np.random.default_rng(7)
    above = mags[mags >= mc - 1e-9]
    boot = [b_value(rng.choice(above, len(above)), mc) for _ in range(500)]
    b = b_value(mags, mc)
    b_by_mc = [{"mc": m, "b": round(b_value(mags, m), 3)} for m in (2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0)]
    years = MODERN[1] - MODERN[0] + 1
    a = np.log10((above.size) / years) + b * mc       # log10 N(>=M) = a - bM, per year

    # Old-scale M -> modern-scale equivalent (same yearly rate)
    sc = con.execute("SELECT * FROM scale_change").df()
    equiv = []
    for _, r in sc.iterrows():
        if r.threshold > 5:
            continue
        # interpolate the modern-era cumulative rate curve in log space
        fm = con.execute("SELECT m, per_year_at_least FROM freq_mag ORDER BY m").df()
        m_eq = np.interp(-np.log10(r.per_year_before), -np.log10(fm.per_year_at_least), fm.m)
        equiv.append({"old": r.threshold, "modern": round(float(m_eq), 2)})

    latest = df.origin_utc.max()
    data = {
        "meta": {"latest": latest.date().isoformat(), "first": df.origin_utc.min().date().isoformat(),
                 "events": int(len(df)), "modern": MODERN,
                 "source": "GeoNet: New Zealand earthquake catalogue (FDSN event service) and quake API"},
        "coast": json.loads(COAST.read_text()),
        "map": con.execute("SELECT lon, lat, depth, mag, yr FROM map_points").fetchall(),
        "largest": rows(con, "SELECT * FROM largest"),
        "annual": rows(con, "SELECT * FROM annual_counts"),
        "scaleChange": rows(con, "SELECT * FROM scale_change"),
        "scaleEquiv": equiv,
        "freqMag": rows(con, "SELECT * FROM freq_mag WHERE m >= 2.5"),
        "gr": {"a": round(a, 3), "b": round(b, 3), "mc": mc, "b_lo": round(float(np.percentile(boot, 2.5)), 3),
               "b_hi": round(float(np.percentile(boot, 97.5)), 3), "n": int(above.size), "byMc": b_by_mc},
        "declustered": {"yearly": yearly, "monthly": monthly,
                        "share_main": round(float(is_main.mean()), 3), "n": int(len(mod))},
        "aftershocks": {k: omori_fit(df, s) for k, s in SEQUENCES.items()},
        "section": cross_section(df[df.yr.between(*MODERN)]),
        "cities": city_table(mod, is_main),
        "hours": rows(con, "SELECT * FROM hour_of_day"),
        "eventTypes": rows(con, "SELECT * FROM event_types"),
        "depthBands": rows(con, "SELECT * FROM depth_bands"),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":"), default=str))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB), {len(df):,} events to {latest.date()}")


if __name__ == "__main__":
    main()
