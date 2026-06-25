# 4. CloudFront + S3 for media delivery

- **Status:** Accepted
- **Date:** 2026-06-21

## Context

Listing pages are photo-heavy, and guests browse globally. Serving images directly from
the application or a single-region bucket would add latency for distant users and put
avoidable load on the origin.

## Decision

Store listing photos in **S3** (private bucket, access via Origin Access Control) and
serve them — along with other static assets — through **CloudFront**. Route 53 points the
static/photo hostname at CloudFront and the API hostname at the ALB. An S3 lifecycle rule
moves older media to cheaper storage tiers.

## Consequences

- ✅ Photos are cached at edge POPs close to users, cutting latency and origin cost.
- ✅ The S3 bucket stays private; only CloudFront can read it.
- ✅ Static delivery is fully decoupled from the dynamic API path.
- ⚠️ Cache invalidation is needed when a photo is replaced (or use versioned object keys).
- ⚠️ Two DNS targets (CloudFront vs ALB) to manage in Route 53.
