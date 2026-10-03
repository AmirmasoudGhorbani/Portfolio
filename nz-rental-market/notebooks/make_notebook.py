"""Generate and execute notebooks/analysis.ipynb.

    python notebooks/make_notebook.py
"""
from pathlib import Path

import nbformat as nbf
from nbclient import NotebookClient

HERE = Path(__file__).resolve().parent
md, code = nbf.v4.new_markdown_cell, nbf.v4.new_code_cell

cells = [
    md("""# New Zealand rental market, 1993–2026

**Question:** what is happening to rents in New Zealand, where, and why?

**Data:** three public CSVs from Tenancy Services (MBIE), plus Stats NZ's CPI release workbook (June 2026 quarter): monthly rental bonds by district and by region since February 1993, and quarterly bonds by dwelling type and bedrooms since 2020. A bond is lodged when a new tenancy starts, so these are rents on *new* tenancies, in nominal NZD per week.

**Method:** the CSVs are loaded and modelled in DuckDB with the SQL in `../sql`. Comparisons use 12-month trailing averages of the monthly median so seasonality doesn't distort them. This notebook runs that same model, checks the data, and works through each finding."""),
    code("""import duckdb, pandas as pd, matplotlib.pyplot as plt
from pathlib import Path
from scipy import stats

ROOT = Path.cwd().parent
con = duckdb.connect()
import os; os.chdir(ROOT)                      # the SQL reads data/raw/... relative to the project root
for f in sorted(Path("sql").glob("*.sql")):
    con.execute(f.read_text())
q = lambda sql: con.execute(sql).df()

plt.rcParams.update({"figure.figsize": (10, 4), "axes.spines.top": False, "axes.spines.right": False,
                     "axes.grid": True, "grid.alpha": .3, "font.size": 10})
BLUE, ORANGE, GREEN, GREY = "#2a78d6", "#eb6834", "#1baf7a", "#8a8a8a\""""),
    md("## 1. Data profile and quality checks"),
    code("""q(\"\"\"SELECT 'district (TLA) monthly' AS dataset, count(*) AS rows, min(month) AS first, max(month) AS last,
          count(DISTINCT location) AS areas FROM tla_monthly
   UNION ALL
   SELECT 'region monthly', count(*), min(month), max(month), count(DISTINCT region) FROM region_monthly
   UNION ALL
   SELECT 'dwelling × bedrooms quarterly', count(*), min(quarter), max(quarter), count(DISTINCT sa2_code) FROM dwelling_quarterly\"\"\")"""),
    md("**Missing months.** Small districts have gaps, most likely where too few bonds were lodged to publish a median. They're excluded from rankings by requiring a full 12 months of data and at least 30 new bonds a month."),
    code("""q(\"\"\"SELECT location, count(*) AS months_present, 402 - count(*) AS months_missing
   FROM tla_monthly WHERE NOT is_nz_total GROUP BY 1 HAVING count(*) < 402 ORDER BY 2 LIMIT 8\"\"\")"""),
    md("**Reconciliation.** If the data is internally consistent, active tenancies summed across districts should match the regional totals. They agree within 0.6% in every month except one: April 2020, the COVID-19 Level 4 lockdown, when so few bonds were lodged that small districts went unpublished while still counting towards their region."),
    code("""recon = q(\"\"\"
WITH d AS (SELECT month, sum(bonds_active) AS districts FROM tla_monthly WHERE NOT is_nz_total GROUP BY 1),
     r AS (SELECT month, sum(bonds_active) AS regions FROM region_monthly WHERE NOT is_nz_total GROUP BY 1)
SELECT d.month, districts, regions, round(100.0 * (districts - regions) / regions, 3) AS diff_pct
FROM d JOIN r USING (month) ORDER BY month\"\"\")
print(recon["diff_pct"].abs().describe().round(3))
outliers = recon[recon["diff_pct"].abs() > 0.6]
assert list(outliers["month"].dt.strftime("%Y-%m")) == ["2020-04"], "unexpected months where totals diverge"
outliers"""),
    md("## 2. The national trend: rents have stalled"),
    code("""nz = q("SELECT * FROM nz_trend")
fig, ax = plt.subplots()
ax.plot(nz["month"], nz["median_12m"], color=BLUE, lw=2)
ax.set_title("Median weekly rent for new tenancies, New Zealand (12-month average)", loc="left")
ax.yaxis.set_major_formatter(lambda v, _: f"${v:,.0f}")
plt.show()
nz.loc[nz["month"].dt.month == 7, ["month", "median_rent", "median_12m", "rent_yoy_pct"]].tail(8)"""),
    md("**Is this flat spell unusual?** Searching for every run of months where the 12-month average grew less than 1% a year finds three in 33 years. The current one is the first since 2009–10 and is still running; 1998–2001 was longer."),
    code("""nz["yoy12"] = 100 * (nz["median_12m"] / nz["median_12m"].shift(12) - 1)
flat = nz["yoy12"] < 1
runs = (flat != flat.shift()).cumsum()
spells = (nz[flat].groupby(runs[flat])
          .agg(start=("month", "min"), end=("month", "max"), months=("month", "size"))
          .sort_values("months", ascending=False))
spells"""),
    md("""### Adjusting for inflation

Nominal rents have been flat, but prices haven't. Deflating the quarterly median by Stats NZ's all-groups CPI (June 2018 to June 2026, the span in the release workbook) shows what a new tenancy costs in today's dollars. The CPI "actual rentals for housing" index adds a second view: rents paid by *all* tenants, not just new ones."""),
    code("""real = q("SELECT * FROM real_rent")
fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4))
a1.plot(real["quarter"], real["real_rent"], color=BLUE, lw=2, label="Real (June 2026 $)")
a1.plot(real["quarter"], real["nominal_rent"], color=GREY, ls="--", label="Nominal")
a1.yaxis.set_major_formatter(lambda v, _: f"${v:,.0f}"); a1.legend(frameon=False)
a1.set_title("Median weekly rent, new tenancies", loc="left")
for col, c, lab in [("index_new_tenancies", BLUE, "New tenancies"), ("index_all_tenants", ORANGE, "All tenants (CPI rentals)"), ("index_cpi", GREY, "CPI")]:
    a2.plot(real["quarter"], real[col], color=c, lw=2, ls="--" if col == "index_cpi" else "-", label=lab)
a2.legend(frameon=False); a2.set_title("Index, June 2018 = 100", loc="left")
plt.show()
q("SELECT * FROM real_rent_summary").T"""),
    md("**Result:** in real terms, new-tenancy rents peaked in Q1 2022 and are now 8% lower. Over the last two years they fell 6.7% after inflation (nominal −0.3%, CPI +6.9%). Rents for all tenants rose less than inflation since 2018 (+29% vs +34%) and are now slowing too."),
    md("## 3. Cities are cooling, regions are climbing"),
    code("""q(\"\"\"SELECT region, median_12m_now, growth_1y_pct, growth_2y_pct, growth_5y_pct, vs_peak_pct, active_2y_pct
   FROM region_summary ORDER BY growth_2y_pct\"\"\")"""),
    md("## 4. Testing a hypothesis: does local supply explain local rents?\n\nNationally, rents stalled while active tenancies grew 6–8% a year, which suggests more supply cooled the market. If that were the mechanism, districts where tenancies grew fastest should show the slowest rent growth: a negative correlation."),
    code("""d = q("SELECT location, growth_2y_pct, active_2y_pct, bonds_per_month FROM tla_summary")
r, p = stats.pearsonr(d["active_2y_pct"], d["growth_2y_pct"])
rho, p_s = stats.spearmanr(d["active_2y_pct"], d["growth_2y_pct"])
fit = stats.linregress(d["active_2y_pct"], d["growth_2y_pct"])
print(f"n = {len(d)} districts | Pearson r = {r:.2f} (p = {p:.2f}) | Spearman rho = {rho:.2f} (p = {p_s:.2f})")

fig, ax = plt.subplots(figsize=(8, 5))
ax.scatter(d["active_2y_pct"], d["growth_2y_pct"], color=BLUE, s=30)
xs = pd.Series([d["active_2y_pct"].min(), d["active_2y_pct"].max()])
ax.plot(xs, fit.intercept + fit.slope * xs, color=GREY, ls="--")
for name in ["Wellington City", "Selwyn District", "Timaru District", "Dunedin City", "Auckland"]:
    row = d[d["location"] == name].iloc[0]
    ax.annotate(name.replace(" District", "").replace(" City", ""), (row["active_2y_pct"], row["growth_2y_pct"]),
                xytext=(5, 4), textcoords="offset points", fontsize=9)
ax.axhline(0, color="k", lw=.6)
ax.set_xlabel("Growth in active tenancies, 2 years (%)"); ax.set_ylabel("Growth in median rent, 2 years (%)")
ax.set_title(f"No local relationship (r = {r:.2f})", loc="left")
plt.show()"""),
    md("**Result: no relationship.** Both Pearson and rank (Spearman) correlations are near zero and far from significant. Selwyn grew tenancies by nearly half and rents still rose; Wellington City grew them modestly and rents fell. The original supply story doesn't hold at district level. The slowdown looks nationwide (interest rates, migration, the wider economy) with local demand shocks on top, such as Wellington's public-sector job cuts. Those are hypotheses for further work: this dataset alone can't test them."),
    md("## 5. Seasonality: the rental year"),
    code("""s = q("SELECT * FROM seasonality")
fig, ax = plt.subplots(figsize=(10, 3.5))
ax.bar(s["month_name"], s["lodgements_vs_trend_pct"], color=[ORANGE if v > 0 else BLUE for v in s["lodgements_vs_trend_pct"]])
ax.set_title("New tenancies vs the yearly trend, by calendar month (2010–2019 average, %)", loc="left")
plt.show()
s"""),
    md("## 6. A data-quality issue in the bedroom breakdown\n\nFrom late 2024 the bedroom field changes behaviour: first the share of bonds with no bedroom count jumps, then those unknowns appear to be recorded as \"1 bedroom\". The result is that 1-bedroom houses suddenly show the same median rent as 3-bedroom houses, which isn't plausible."),
    code("""bc = q("SELECT * FROM bedroom_coding_check")
fig, ax = plt.subplots(figsize=(10, 3.5))
ax.plot(bc["quarter"], bc["pct_one_bed"], color=ORANGE, lw=2, label="Recorded as 1 bedroom")
ax.plot(bc["quarter"], bc["pct_unknown_beds"], color=BLUE, lw=2, label="No bedroom count")
ax.axvspan(pd.Timestamp("2024-10-01"), bc["quarter"].max(), color="#c9a04c", alpha=.15, label="Excluded")
ax.set_title("Share of new bonds by bedroom coding (%)", loc="left"); ax.legend(frameon=False)
plt.show()
q(\"\"\"SELECT quarter, bedrooms, median_rent FROM dwelling_quarterly
   WHERE is_nz_total AND dwelling_type = 'House' AND bedrooms IN ('1','3') AND quarter >= '2024-01-01'
   ORDER BY quarter, bedrooms\"\"\").pivot(index="quarter", columns="bedrooms", values="median_rent")"""),
    md("**Decision:** bedroom comparisons use 2020 Q1 to 2024 Q3 only. Totals across all bedrooms are unaffected and used for every period."),
    md("""## 7. Conclusions and limitations

1. **Rents have stalled, and are falling in real terms.** The national median has held at about $590–600 a week since 2024, the first flat spell since 2009–10. After inflation, new-tenancy rents are 8% below their 2022 peak.
2. **The slowdown is uneven.** Wellington-area cities are down 4–6% in two years and Auckland is flat, while the West Coast, Southland and Otago are still rising 8–11%.
3. **Local supply doesn't explain it.** There's no district-level link between tenancy growth and rent growth (r ≈ 0.07).
4. **Rentals follow a strong seasonal cycle.** New tenancies run about 20% above trend in February, and rents peak in January.
5. **The cheap end is being squeezed.** The upper-to-lower quartile ratio has fallen from 1.73 (2015) to 1.44.

**Limitations.** Most comparisons use nominal rents; the inflation-adjusted view covers June 2018 onwards, the span of the CPI release workbook. Bonds capture new tenancies only, not rents paid by sitting tenants. Medians for small districts are noisy, so rankings require 30+ new bonds a month. Correlation across districts can't establish causes."""),
]

nb = nbf.v4.new_notebook(cells=cells, metadata={"kernelspec": {"name": "python3", "display_name": "Python 3", "language": "python"}})
NotebookClient(nb, timeout=180, kernel_name="python3", resources={"metadata": {"path": str(HERE)}}).execute()
nbf.write(nb, HERE / "analysis.ipynb")
print("wrote notebooks/analysis.ipynb")
