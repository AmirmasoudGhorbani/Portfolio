-- ============================================================
-- 02 · Analysis views
-- Rents are weekly, in nominal NZD. Comparisons use 12-month trailing
-- averages of the monthly median so seasonality doesn't skew them.
-- ============================================================

-- National trend: monthly median, 12-month trailing average, year-on-year change
CREATE OR REPLACE VIEW nz_trend AS
WITH t AS (
    SELECT month, median_rent, bonds_lodged, bonds_active,
           avg(median_rent) OVER w12  AS median_12m,
           count(*)         OVER w12  AS n_12m
    FROM tla_monthly
    WHERE is_nz_total
    WINDOW w12 AS (ORDER BY month ROWS BETWEEN 11 PRECEDING AND CURRENT ROW)
)
SELECT month, median_rent, bonds_lodged, bonds_active,
       CASE WHEN n_12m = 12 THEN round(median_12m, 1) END                          AS median_12m,
       round(100 * (median_rent  / lag(median_rent, 12)  OVER (ORDER BY month) - 1), 1) AS rent_yoy_pct,
       round(100 * (bonds_active / lag(bonds_active, 12) OVER (ORDER BY month) - 1), 1) AS active_yoy_pct
FROM t
ORDER BY month;

-- Regional trend with 12-month trailing average
CREATE OR REPLACE VIEW region_trend AS
SELECT region, month, median_rent, bonds_active,
       round(avg(median_rent) OVER (PARTITION BY region ORDER BY month
             ROWS BETWEEN 11 PRECEDING AND CURRENT ROW), 1)                      AS median_12m
FROM region_monthly
ORDER BY region, month;

-- Region scorecard: latest level, growth over 1, 2, 5 and 10 years, peak, supply change
CREATE OR REPLACE VIEW region_summary AS
WITH latest AS (SELECT max(month) AS m FROM region_monthly),
r AS (
    SELECT t.region, t.month, t.median_12m, t.bonds_active
    FROM region_trend t
),
pk AS (
    SELECT region, arg_max(month, median_12m) AS peak_month, max(median_12m) AS peak_12m
    FROM r GROUP BY region
)
SELECT r.region,
       r.median_12m                                                             AS median_12m_now,
       round(100 * (r.median_12m / y1.median_12m  - 1), 1)                       AS growth_1y_pct,
       round(100 * (r.median_12m / y2.median_12m  - 1), 1)                       AS growth_2y_pct,
       round(100 * (r.median_12m / y5.median_12m  - 1), 1)                       AS growth_5y_pct,
       round(100 * (r.median_12m / y10.median_12m - 1), 1)                       AS growth_10y_pct,
       pk.peak_month, pk.peak_12m,
       round(100 * (r.median_12m / pk.peak_12m - 1), 1)                          AS vs_peak_pct,
       r.bonds_active                                                            AS active_now,
       round(100 * (r.bonds_active::DOUBLE / y2.bonds_active - 1), 1)            AS active_2y_pct
FROM r
JOIN latest ON r.month = latest.m
JOIN r y1  ON y1.region  = r.region AND y1.month  = r.month - INTERVAL 1 YEAR
JOIN r y2  ON y2.region  = r.region AND y2.month  = r.month - INTERVAL 2 YEAR
JOIN r y5  ON y5.region  = r.region AND y5.month  = r.month - INTERVAL 5 YEAR
JOIN r y10 ON y10.region = r.region AND y10.month = r.month - INTERVAL 10 YEAR
JOIN pk    ON pk.region  = r.region
ORDER BY growth_2y_pct;

-- District / city leaderboard (only areas with enough bonds to be stable)
CREATE OR REPLACE VIEW tla_summary AS
WITH t AS (
    SELECT location, month, bonds_lodged, bonds_active,
           avg(median_rent)  OVER w AS median_12m,
           avg(bonds_lodged) OVER w AS lodged_12m,
           avg(bonds_active) OVER w AS active_12m,
           count(median_rent) OVER w AS n_12m
    FROM tla_monthly
    WHERE NOT is_nz_total
    WINDOW w AS (PARTITION BY location ORDER BY month ROWS BETWEEN 11 PRECEDING AND CURRENT ROW)
),
latest AS (SELECT max(month) AS m FROM tla_monthly)
SELECT a.location,
       round(a.median_12m, 1)                                       AS median_12m_now,
       round(a.lodged_12m)                                          AS bonds_per_month,
       a.bonds_active                                               AS active_now,
       round(100 * (a.median_12m / b.median_12m - 1), 1)            AS growth_2y_pct,
       round(100 * (a.median_12m / c.median_12m - 1), 1)            AS growth_5y_pct,
       round(100 * (a.active_12m / b.active_12m - 1), 1)            AS active_2y_pct,
       rank() OVER (ORDER BY a.median_12m DESC)                     AS rank_most_expensive
FROM t a
JOIN latest ON a.month = latest.m
LEFT JOIN t b ON b.location = a.location AND b.month = a.month - INTERVAL 2 YEAR
LEFT JOIN t c ON c.location = a.location AND c.month = a.month - INTERVAL 5 YEAR
WHERE a.n_12m = 12 AND a.lodged_12m >= 30
ORDER BY median_12m_now DESC;

-- Seasonality: each calendar month's rent and lodgements relative to the
-- centred 12-month average, averaged over 2010-2019 (a stable, pre-COVID decade)
CREATE OR REPLACE VIEW seasonality AS
WITH t AS (
    SELECT month, median_rent, bonds_lodged,
           avg(median_rent)  OVER w AS rent_ma,
           avg(bonds_lodged) OVER w AS lodged_ma
    FROM tla_monthly
    WHERE is_nz_total
    WINDOW w AS (ORDER BY month ROWS BETWEEN 6 PRECEDING AND 5 FOLLOWING)
)
SELECT month(month)                                         AS month_num,
       strftime(any_value(month), '%b')                     AS month_name,
       round(100 * (avg(median_rent / rent_ma) - 1), 2)     AS rent_vs_trend_pct,
       round(100 * (avg(bonds_lodged / lodged_ma) - 1), 1)  AS lodgements_vs_trend_pct
FROM t
WHERE year(month) BETWEEN 2010 AND 2019
GROUP BY month_num
ORDER BY month_num;

-- National median by dwelling type and bedrooms (reliable quarters only)
CREATE OR REPLACE VIEW dwelling_beds AS
SELECT quarter, dwelling_type, bedrooms, median_rent, bonds_lodged
FROM dwelling_quarterly
WHERE is_nz_total AND bedrooms_reliable
  AND dwelling_type IN ('House', 'Apartment', 'Flat', 'Room', 'ALL')
  AND bedrooms IN ('1', '2', '3', '4', 'ALL')
ORDER BY quarter, dwelling_type, bedrooms;

-- Data-quality check behind the bedroom cut-off
CREATE OR REPLACE VIEW bedroom_coding_check AS
SELECT quarter,
       round(100.0 * sum(bonds_lodged) FILTER (WHERE bedrooms = '1')  / sum(bonds_lodged) FILTER (WHERE bedrooms = 'ALL'), 1) AS pct_one_bed,
       round(100.0 * sum(bonds_lodged) FILTER (WHERE bedrooms = 'NA') / sum(bonds_lodged) FILTER (WHERE bedrooms = 'ALL'), 1) AS pct_unknown_beds
FROM dwelling_quarterly
WHERE is_nz_total AND dwelling_type = 'ALL'
GROUP BY quarter
ORDER BY quarter;

-- Affordability spread: upper vs lower quartile rent, national
CREATE OR REPLACE VIEW rent_spread AS
SELECT month, uq_rent, lq_rent, round(uq_rent / lq_rent, 3) AS uq_lq_ratio
FROM tla_monthly
WHERE is_nz_total
ORDER BY month;

-- Does local supply explain local rents? District-level correlation between
-- 2-year growth in active tenancies and 2-year growth in median rent.
CREATE OR REPLACE VIEW supply_vs_rent AS
SELECT count(*)                                           AS districts,
       round(corr(active_2y_pct, growth_2y_pct), 3)       AS correlation,
       round(regr_slope(growth_2y_pct, active_2y_pct), 3) AS slope,
       round(regr_intercept(growth_2y_pct, active_2y_pct), 3) AS intercept
FROM tla_summary;

-- Real rents: the quarterly average of the national monthly median for new
-- tenancies, deflated by CPI into dollars of the latest quarter. Also indexed to
-- June 2018 = 100 alongside CPI and the CPI rentals index (all tenants).
CREATE OR REPLACE VIEW real_rent AS
WITH bonds AS (
    SELECT date_trunc('quarter', month) + INTERVAL 2 MONTH AS quarter_end,
           avg(median_rent) AS median_rent,
           count(*)          AS n_months
    FROM tla_monthly
    WHERE is_nz_total
    GROUP BY 1
),
j AS (
    SELECT c.quarter_end, b.median_rent, c.cpi_all_groups, c.cpi_rentals,
           last_value(c.cpi_all_groups) OVER (ORDER BY c.quarter_end
                ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS cpi_latest,
           first_value(b.median_rent)    OVER w0 AS rent_0,
           first_value(c.cpi_all_groups) OVER w0 AS cpi_0,
           first_value(c.cpi_rentals)    OVER w0 AS rentals_0
    FROM cpi_quarterly c
    JOIN bonds b ON b.quarter_end = c.quarter_end AND b.n_months = 3
    WINDOW w0 AS (ORDER BY c.quarter_end)
)
SELECT quarter_end                                         AS quarter,
       round(median_rent, 1)                               AS nominal_rent,
       round(median_rent * cpi_latest / cpi_all_groups, 1) AS real_rent,
       round(100 * median_rent / rent_0, 1)                AS index_new_tenancies,
       round(100 * cpi_rentals / rentals_0, 1)             AS index_all_tenants,
       round(100 * cpi_all_groups / cpi_0, 1)              AS index_cpi
FROM j
ORDER BY quarter;

CREATE OR REPLACE VIEW real_rent_summary AS
WITH r AS (SELECT *, row_number() OVER (ORDER BY quarter DESC) AS k FROM real_rent),
now AS (SELECT * FROM r WHERE k = 1),
y2  AS (SELECT * FROM r WHERE k = 9),
pk  AS (SELECT arg_max(quarter, real_rent) AS peak_quarter, max(real_rent) AS peak_real FROM real_rent)
SELECT now.quarter                                                    AS latest_quarter,
       now.real_rent                                                   AS real_rent_now,
       pk.peak_quarter, pk.peak_real,
       round(100 * (now.real_rent / pk.peak_real - 1), 1)              AS real_vs_peak_pct,
       round(100 * (now.nominal_rent / y2.nominal_rent - 1), 1)        AS nominal_2y_pct,
       round(100 * (now.index_cpi / y2.index_cpi - 1), 1)              AS cpi_2y_pct,
       round(100 * (now.real_rent / y2.real_rent - 1), 1)              AS real_2y_pct,
       round(100 * (now.index_all_tenants / y2.index_all_tenants - 1), 1) AS all_tenants_2y_pct,
       now.index_new_tenancies, now.index_all_tenants, now.index_cpi
FROM now, y2, pk;
