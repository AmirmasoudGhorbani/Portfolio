-- =====================================================================
-- Analysis views over nz_quakes (see 01_staging.sql).
-- "Modern era" = 2012-2025: one magnitude system (SeisComP), full years.
-- =====================================================================

-- Annual counts at several magnitude thresholds
CREATE OR REPLACE VIEW annual_counts AS
SELECT yr,
       count(*) FILTER (WHERE mag >= 3) AS m3,
       count(*) FILTER (WHERE mag >= 4) AS m4,
       count(*) FILTER (WHERE mag >= 5) AS m5,
       count(*) FILTER (WHERE mag >= 6) AS m6
FROM nz_quakes
GROUP BY yr
ORDER BY yr;

-- The 2012 magnitude change: average yearly counts above each threshold,
-- before (2000-2011, old CUSP system) and after (2012-2025, SeisComP).
CREATE OR REPLACE VIEW scale_change AS
WITH t AS (SELECT unnest(range(25, 65, 5)) / 10.0 AS m)
SELECT t.m AS threshold,
       count(*) FILTER (WHERE q.yr BETWEEN 2000 AND 2011) / 12.0 AS per_year_before,
       count(*) FILTER (WHERE q.yr BETWEEN 2012 AND 2025) / 14.0 AS per_year_after
FROM t JOIN nz_quakes q ON q.mag >= t.m - 1e-9
GROUP BY t.m
ORDER BY t.m;

-- Frequency-magnitude distribution, modern era, 0.1-unit bins
CREATE OR REPLACE VIEW freq_mag AS
WITH b AS (
    SELECT round(mag, 1) AS m, count(*) AS n
    FROM nz_quakes WHERE yr BETWEEN 2012 AND 2025
    GROUP BY 1
)
SELECT m,
       n / 14.0                                                      AS per_year,
       sum(n) OVER (ORDER BY m DESC ROWS UNBOUNDED PRECEDING) / 14.0 AS per_year_at_least
FROM b
ORDER BY m;

-- Hour of day (NZ local time): small quakes vs quarry blasts.
-- Quakes ignore the clock; detection doesn't, and blasting is a day job.
CREATE OR REPLACE VIEW hour_of_day AS
WITH e AS (
    SELECT event_type, mag, year(origin_utc) AS yr,
           hour(timezone('Pacific/Auckland', origin_utc::TIMESTAMPTZ)) AS h
    FROM events
    WHERE lat BETWEEN -48 AND -34 AND lon BETWEEN 165 AND 180
)
SELECT h AS hour,
       count(*) FILTER (WHERE event_type IN ('earthquake', 'unknown') AND mag < 3 AND yr BETWEEN 2012 AND 2025) AS small_quakes,
       count(*) FILTER (WHERE event_type = 'quarry blast')                                                      AS quarry_blasts
FROM e
GROUP BY h
ORDER BY h;

-- What else is in the catalogue
CREATE OR REPLACE VIEW event_types AS
SELECT event_type, count(*) AS events,
       arg_max(place, mag) AS largest_place, max(mag) AS largest_mag,
       arg_max(origin_utc, mag)::DATE AS largest_date
FROM events
GROUP BY event_type
ORDER BY events DESC;

-- The biggest quakes in the region since 2000
CREATE OR REPLACE VIEW largest AS
SELECT event_id, timezone('Pacific/Auckland', origin_utc::TIMESTAMPTZ)::DATE AS day, mag, mag_type, depth_km, place, lat, lon
FROM nz_quakes
ORDER BY mag DESC, origin_utc
LIMIT 15;

-- Map layer: every M4+ since 2000
CREATE OR REPLACE VIEW map_points AS
SELECT round(lon, 3) AS lon, round(lat, 3) AS lat, round(depth_km) AS depth,
       mag, yr
FROM nz_quakes
WHERE mag >= 4
ORDER BY mag;   -- big ones drawn last, on top

-- Depth bands, modern era
CREATE OR REPLACE VIEW depth_bands AS
SELECT depth_band, count(*) AS events,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
FROM nz_quakes
WHERE yr BETWEEN 2012 AND 2025 AND mag >= 3
GROUP BY depth_band;
