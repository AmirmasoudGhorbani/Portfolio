-- ============================================================
-- 01 · Staging: load MBIE rental bond CSVs into typed tables
-- Source: Tenancy Services (MBIE) rental bond data
-- ============================================================

-- Monthly bonds by territorial authority (district / city), Feb 1993 onwards.
-- "NA" is bonds with no recorded district and is dropped.
CREATE OR REPLACE TABLE tla_monthly AS
SELECT
    strptime(TimeFrame, '%d/%m/%Y')::DATE        AS month,
    CAST(location_id AS INTEGER)                 AS location_id,
    location,
    location = 'ALL'                             AS is_nz_total,
    TRY_CAST(LodgedBonds AS INTEGER)             AS bonds_lodged,
    TRY_CAST(ActiveBonds AS INTEGER)             AS bonds_active,
    TRY_CAST(ClosedBonds AS INTEGER)             AS bonds_closed,
    TRY_CAST(MedianRent AS DOUBLE)               AS median_rent,
    TRY_CAST(GeometricMeanRent AS DOUBLE)        AS geomean_rent,
    TRY_CAST(UpperQuartileRent AS DOUBLE)        AS uq_rent,
    TRY_CAST(LowerQuartileRent AS DOUBLE)        AS lq_rent
FROM read_csv('data/raw/detailed-monthly-tla-tenancy.csv', header = true, all_varchar = true)
WHERE location <> 'NA';

-- Monthly bonds by region. "NA" is bonds with no recorded region and is dropped.
CREATE OR REPLACE TABLE region_monthly AS
SELECT
    strptime(TimeFrame, '%d/%m/%Y')::DATE        AS month,
    CAST(location_id AS INTEGER)                 AS location_id,
    CASE WHEN location = 'ALL' THEN 'New Zealand'
         ELSE replace(location, ' Region', '') END AS region,
    location = 'ALL'                             AS is_nz_total,
    TRY_CAST(LodgedBonds AS INTEGER)             AS bonds_lodged,
    TRY_CAST(ActiveBonds AS INTEGER)             AS bonds_active,
    TRY_CAST(ClosedBonds AS INTEGER)             AS bonds_closed,
    TRY_CAST(MedianRent AS DOUBLE)               AS median_rent,
    TRY_CAST(UpperQuartileRent AS DOUBLE)        AS uq_rent,
    TRY_CAST(LowerQuartileRent AS DOUBLE)        AS lq_rent
FROM read_csv('data/raw/detailed-monthly-region-tenancy.csv', header = true, all_varchar = true)
WHERE location <> 'NA';

-- Quarterly bonds by dwelling type and bedrooms (2020 Q1 onwards).
-- Location codes are Stats NZ SA2 areas; -99 is the national total.
-- Bedroom counts are only reliable to 2024 Q3: from 2024 Q4 the share of
-- bonds with unknown bedrooms jumps (7% -> 27%), and from 2025 Q4 those
-- appear to be recorded as "1 bedroom" (1-bed share 14% -> 54%).
CREATE OR REPLACE TABLE dwelling_quarterly AS
SELECT
    CAST(TimeFrame AS DATE)                      AS quarter,
    NULLIF("Location Id", 'NULL')                AS sa2_code,
    "Location Id" = '-99'                        AS is_nz_total,
    "Dwelling Type"                              AS dwelling_type,
    "Number Of Beds"                             AS bedrooms,
    TRY_CAST("Total Bonds" AS INTEGER)           AS bonds_lodged,
    TRY_CAST("Active Bonds" AS INTEGER)          AS bonds_active,
    TRY_CAST("Median Rent" AS DOUBLE)            AS median_rent,
    CAST(TimeFrame AS DATE) <= DATE '2024-07-01' AS bedrooms_reliable
FROM read_csv('data/raw/detailed-quarterly-sa2-dwelling-beds.csv', header = true, all_varchar = true);

-- Quarterly CPI from Stats NZ (base June 2017 quarter = 1000), extracted from the
-- release workbook by pipeline/build.py. Covers June 2018 to June 2026.
--   cpi_all_groups: the overall price level, used to adjust rents for inflation
--   cpi_rentals:    "actual rentals for housing", rents paid by all tenants, not just new ones
CREATE OR REPLACE TABLE cpi_quarterly AS
SELECT CAST(quarter_end AS DATE)            AS quarter_end,
       CAST(cpi_all_groups AS DOUBLE)      AS cpi_all_groups,
       CAST(cpi_rentals AS DOUBLE)         AS cpi_rentals
FROM read_csv('data/processed/cpi_quarterly.csv', header = true);
