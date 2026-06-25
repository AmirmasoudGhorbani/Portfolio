# 2. Queue-based asynchronous writes (SQS)

- **Status:** Accepted
- **Date:** 2026-06-21

## Context

Publishing or updating a listing touches several systems: the primary database, the
search index, and (for photos) S3 + CDN invalidation. Doing all of this synchronously in
the request would make the host's "Save" slow and brittle — if the search cluster is
briefly slow, the whole write fails. Hosts also bulk-edit, producing spiky write bursts
that could overwhelm the database.

## Decision

The Host and Payment services **enqueue an event to SQS** and return immediately. A
dedicated **Update Service** consumes the queue and applies the writes: persist to the
DB, then re-index into Elasticsearch. The queue has a **dead-letter queue** and a
**max-receive count** for poison messages.

## Consequences

- ✅ Writes are fast and resilient — the user-facing request returns as soon as the event
  is durably queued.
- ✅ Bursts are absorbed: the queue buffers, and the Update Service scales on queue depth.
- ✅ Retries + DLQ make writes fault-tolerant without losing data.
- ⚠️ The system is **eventually consistent** — a new listing appears in search a moment
  after it's saved. Acceptable for this domain.
- ⚠️ Consumers must be **idempotent**, since SQS guarantees at-least-once delivery.
