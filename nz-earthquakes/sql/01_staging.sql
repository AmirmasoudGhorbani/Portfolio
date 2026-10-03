-- =====================================================================
-- Staging: load the GeoNet catalogue exports and type them.
-- Raw files: data/raw/quakes_YYYY.csv.gz, FDSN "text" format, M2.5+.
-- =====================================================================

CREATE OR REPLACE TABLE events_raw AS
SELECT *
FROM read_csv('data/raw/quakes_*.csv.gz', delim = '|', header = true,
              all_varchar = true, normalize_names = true, filename = true);

-- One row per event, typed. GeoNet revises events after the fact, so if an
-- event appears in two files (a year boundary or a re-download) keep the copy
-- from the newest file.
CREATE OR REPLACE TABLE events AS
SELECT
    trim(eventid)                                         AS event_id,
    CAST(trim(time) AS TIMESTAMP)                         AS origin_utc,
    CAST(trim(latitude) AS DOUBLE)                        AS lat,
    -- events east of the antimeridian come back as negative longitudes
    CASE WHEN CAST(trim(longitude) AS DOUBLE) < 0
         THEN CAST(trim(longitude) AS DOUBLE) + 360
         ELSE CAST(trim(longitude) AS DOUBLE) END         AS lon,
    CAST(trim(depthkm) AS DOUBLE)                         AS depth_km,
    CAST(trim(magnitude) AS DOUBLE)                       AS mag,
    trim(magtype)                                         AS mag_type,
    trim(eventlocationname)                               AS place,
    trim(eventtype)                                       AS event_type
FROM events_raw
QUALIFY row_number() OVER (PARTITION BY trim(eventid) ORDER BY filename DESC) = 1;

-- The study region: mainland New Zealand and its offshore margins.
-- Tectonic events are those typed "earthquake"; during 2012-2018 many
-- reviewed-later events were left as "unknown", so those count too.
CREATE OR REPLACE VIEW nz_quakes AS
SELECT *,
    date_trunc('day', origin_utc)::DATE                     AS day,
    year(origin_utc)                                        AS yr,
    CASE WHEN depth_km < 40 THEN 'Shallow (<40 km)'
         WHEN depth_km < 100 THEN '40–100 km'
         WHEN depth_km < 200 THEN '100–200 km'
         ELSE '200 km +' END                                AS depth_band
FROM events
WHERE lat BETWEEN -48 AND -34
  AND lon BETWEEN 165 AND 180
  AND event_type IN ('earthquake', 'unknown', 'volcano-tectonic');
