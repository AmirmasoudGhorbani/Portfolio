"""Build the rental-market model and export the dashboard data.

Runs the SQL in ../sql against the raw MBIE CSVs in ../data/raw using DuckDB,
then writes ../dashboard/data.json for the static dashboard.

    python pipeline/build.py
"""
import csv
import json
from pathlib import Path

import duckdb
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "processed" / "rentals.duckdb"
OUT = ROOT / "dashboard" / "data.json"


CPI_XLSX = ROOT / "data" / "raw" / "cpi-june-2026-quarter.xlsx"
CPI_CSV = ROOT / "data" / "processed" / "cpi_quarterly.csv"
# Stats NZ series: all-groups CPI (table 1) and "actual rentals for housing" (table 15.02)
CPI_SERIES = {"cpi_all_groups": ("1", "SE9A"), "cpi_rentals": ("15.02", "SE904101")}


def extract_cpi():
    """Pull the two quarterly CPI series out of the Stats NZ release workbook into a CSV."""
    wb = openpyxl.load_workbook(CPI_XLSX, read_only=True, data_only=True)
    month = {"Mar": 3, "Jun": 6, "Sep": 9, "Dec": 12}
    series = {}
    for name, (sheet, code) in CPI_SERIES.items():
        rows = list(wb[sheet].iter_rows(values_only=True))
        ref = next(r for r in rows if r[0] == "Series ref: CPIQ")
        col, year = list(ref).index(code), None
        for r in rows[rows.index(ref) + 1:]:
            if r[0] not in (None, "") and str(r[0]).strip().isdigit():
                year = int(str(r[0]).strip())   # the year is only printed on its first quarter
            q = str(r[1]).strip() if r[1] else ""
            if year and q in month and r[col] not in (None, ""):
                series.setdefault(f"{year}-{month[q]:02d}-01", {})[name] = float(r[col])
    CPI_CSV.parent.mkdir(parents=True, exist_ok=True)
    with CPI_CSV.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["quarter_end", *CPI_SERIES])
        for q in sorted(series):
            w.writerow([q, *[series[q].get(k) for k in CPI_SERIES]])


def rows(con, sql):
    cur = con.execute(sql)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def iso(d):
    return d.isoformat()[:7] if d else None


def main():
    DB.parent.mkdir(parents=True, exist_ok=True)
    extract_cpi()
    con = duckdb.connect(str(DB))
    # SQL paths are relative to the project root
    import os
    os.chdir(ROOT)
    for f in sorted((ROOT / "sql").glob("*.sql")):
        con.execute(f.read_text())

    latest = con.execute("SELECT max(month) FROM tla_monthly").fetchone()[0]

    nz = rows(con, "SELECT * FROM nz_trend")
    regions = {}
    for r in rows(con, "SELECT region, month, median_rent, median_12m FROM region_trend WHERE region <> 'New Zealand'"):
        regions.setdefault(r["region"], []).append(r["median_12m"])
    region_months = [iso(r["month"]) for r in rows(con, "SELECT DISTINCT month FROM region_monthly ORDER BY month")]

    data = {
        "meta": {
            "latest": iso(latest),
            "source": "Tenancy Services, Ministry of Business, Innovation and Employment (MBIE): rental bond data",
            "built": iso(latest),
        },
        "nz": {
            "months": [iso(r["month"]) for r in nz],
            "median": [r["median_rent"] for r in nz],
            "median12": [r["median_12m"] for r in nz],
            "active": [r["bonds_active"] for r in nz],
            "lodged": [r["bonds_lodged"] for r in nz],
            "rentYoy": [r["rent_yoy_pct"] for r in nz],
            "activeYoy": [r["active_yoy_pct"] for r in nz],
        },
        "regions": {"months": region_months, "series": regions},
        "regionSummary": [
            {**r, "peak_month": iso(r["peak_month"])}
            for r in rows(con, "SELECT * FROM region_summary WHERE region <> 'New Zealand'")
        ],
        "nzSummary": [
            {**r, "peak_month": iso(r["peak_month"])}
            for r in rows(con, "SELECT * FROM region_summary WHERE region = 'New Zealand'")
        ][0],
        "districts": rows(con, "SELECT * FROM tla_summary"),
        "supplyFit": rows(con, "SELECT * FROM supply_vs_rent")[0],
        "real": [{**r, "quarter": iso(r["quarter"])} for r in rows(con, "SELECT * FROM real_rent")],
        "realSummary": {**rows(con, "SELECT * FROM real_rent_summary")[0]},
        "seasonality": rows(con, "SELECT * FROM seasonality"),
        "beds": [
            {**r, "quarter": iso(r["quarter"])}
            for r in rows(con, """SELECT quarter, bedrooms, median_rent FROM dwelling_beds
                                  WHERE dwelling_type = 'House' AND bedrooms IN ('1','2','3','4')""")
        ],
        "dwellings": [
            {**r, "quarter": iso(r["quarter"])}
            for r in rows(con, """SELECT quarter, dwelling_type, median_rent, bonds_lodged FROM dwelling_beds
                                  WHERE bedrooms = 'ALL' AND dwelling_type <> 'ALL'""")
        ],
        "bedroomCoding": [
            {**r, "quarter": iso(r["quarter"])} for r in rows(con, "SELECT * FROM bedroom_coding_check")
        ],
        "spread": [
            {"month": iso(r["month"]), "ratio": r["uq_lq_ratio"]}
            for r in rows(con, "SELECT month, uq_lq_ratio FROM rent_spread")
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":"), default=str))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB), latest month {iso(latest)}")


if __name__ == "__main__":
    main()
