# 1. Microservices on ECS / EC2 behind an ALB

- **Status:** Accepted
- **Date:** 2026-06-21

## Context

The platform has distinct domains — guests, hosts, payments, search, view rendering —
with very different load profiles. Search and view are read-heavy and bursty; payments
are low-volume but correctness-critical; host operations are write-heavy but infrequent.
A single monolith would force all of these to scale together and deploy together.

## Decision

Split the platform into independently deployable **microservices**, each behind a shared
**Application Load Balancer** with path-based routing. Run them as **containers on ECS
(Fargate)**, with a couple of legacy services remaining on **EC2** Auto Scaling groups.
Every service is **stateless** — state lives in RDS, S3, and the search index.

## Consequences

- ✅ Each service scales and deploys on its own cadence (Search can run 4× while Payment
  runs 2×).
- ✅ Statelessness means Auto Scaling can add/remove tasks freely; a failed task is just
  replaced.
- ✅ Path-based ALB routing keeps a single public entry point and TLS termination.
- ⚠️ More operational surface: service discovery, inter-service contracts, and
  distributed tracing now matter.
- ⚠️ Requires CI/CD per service and an image registry (ECR).
