# 3. Elasticsearch for catalog search

- **Status:** Accepted
- **Date:** 2026-06-21

## Context

Travelers search by city, dates, price range, amenities, and free text, expecting
sub-100ms results with faceted filtering. Running these queries against the primary
relational database would mean expensive `LIKE`/join queries that compete with
transactional load and don't rank well by relevance.

## Decision

Maintain a dedicated **Elasticsearch** (or Apache Solr) cluster as the search index.
The Update Service re-indexes a listing whenever it changes, keeping the index in sync
asynchronously. The **Search Service queries Elasticsearch, never the primary DB**.

## Consequences

- ✅ Fast, relevance-ranked, faceted search that scales reads independently of the DB.
- ✅ Search load never competes with transactional writes on the primary database.
- ✅ The index can be re-sharded or scaled out without touching the system of record.
- ⚠️ The index is a **derived store** — it can be rebuilt from the DB, but sync lag means
  eventual consistency with the source of truth.
- ⚠️ Operational cost of running and tuning a search cluster (mapping, analyzers, shards).
