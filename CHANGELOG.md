# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- Interactive dashboard landing page with live Chart.js visualisations
- `CHANGELOG.md` — this file

---

## [1.1.0] — 2026-03-12

Seven pull requests submitted. All backward-compatible — existing routes,
wrapper keys, and record counts are unchanged.

### Added — Data
- `data/spacecraft_missions.json` — normalised to a consistent 17-field schema:
  - ISO 8601 dates (was: 15+ ad-hoc formats)
  - Numeric `mass_kg` (was: 9+ field name variants)
  - Numeric `power_watts` extracted from complex strings
  - `orbit_type` classification: LEO / SSO / GEO / Lunar / Interplanetary / Failed
  - `status` inferred from launch date + mission life: active / decommissioned / failed / unknown
- `data/spacecrafts.json` — 73 of 113 records enriched from missions cross-reference
  (was: only `id` + `name`)
- `data/launchers.json` — `vehicle_family` added: SLV / ASLV / PSLV / GSLV / LVM-3 / RLV / Scramjet-TD
- `data/customer_satellites.json` — ISO dates, numeric mass, normalised country names
- `data/centres.json` — consistent lowercase field names (`place`, `state`)
- `scripts/normalize_data.py` — idempotent Python normalisation pipeline
- `isro_scrape/isro_spacecrafts_scraper_output.json` — fresh scraper output merged into data

### Added — API endpoints
- `GET /api/stats` — aggregate analytics: counts, orbit/status distributions,
  country breakdown, vehicle family counts; all computed at runtime ([PR #66](https://github.com/isro/api/pull/66))
- `GET /api/spacecrafts/:id` — individual spacecraft lookup ([PR #67](https://github.com/isro/api/pull/67))
- `GET /api/launchers/:id` — individual launcher lookup ([PR #67](https://github.com/isro/api/pull/67))
- `GET /api/customer_satellites/:id` — individual customer satellite lookup ([PR #67](https://github.com/isro/api/pull/67))
- `GET /api/centres/:id` — individual centre lookup ([PR #67](https://github.com/isro/api/pull/67))
- `GET /api/spacecraft_missions/:id` — individual mission lookup ([PR #67](https://github.com/isro/api/pull/67))
- Query parameter filtering on all collection endpoints ([PR #68](https://github.com/isro/api/pull/68)):
  - `/api/spacecrafts?status=active&orbit_type=GEO`
  - `/api/spacecraft_missions?mission_type=Remote+Sensing&orbit_type=SSO`
  - `/api/customer_satellites?country=Germany`
  - `/api/launchers?vehicle_family=PSLV`
  - `/api/centres?state=Karnataka`
- `_links` object on `/api/spacecrafts/:id` and `/api/spacecraft_missions/:id`
  with `self` and cross-reference URLs ([PR #69](https://github.com/isro/api/pull/69))
- `schemas/` — JSON Schema definitions for all five data files ([PR #70](https://github.com/isro/api/pull/70))
- `scripts/validate_schemas.js` — local schema validation (`npm run validate`) ([PR #70](https://github.com/isro/api/pull/70))
- `.github/workflows/validate_data.yml` — CI validation on PRs touching `data/` ([PR #70](https://github.com/isro/api/pull/70))
- `tests/` — Jest test suite: 58 tests across API handlers, ID endpoints, stats,
  and data integrity ([PR #71](https://github.com/isro/api/pull/71))
- `.github/workflows/test.yml` — CI test workflow on every PR ([PR #71](https://github.com/isro/api/pull/71))

### Fixed — API handlers ([PR #65](https://github.com/isro/api/pull/65))
- Removed unused `fs` import from all 6 handlers
- Fixed misleading variable names (`launchers` → `customerSatellites`, `spacecraftMissions`)
- Added `Content-Type: application/json` header to all responses
- Sanitised error responses (no longer leak internal objects)
- `GET /api` now returns a JSON endpoint directory instead of an HTML string

### Fixed — Landing page ([PR #65](https://github.com/isro/api/pull/65))
- Added missing `/api/spacecraft_missions` endpoint link
- Removed hotlinked external images

### Changed
- `README.md` rewritten: endpoint table with record counts, full schema
  documentation, data pipeline instructions, contributing guide

---

## [1.0.0] — 2021 (initial release)

Original API with five static JSON endpoints:
`/api/spacecrafts`, `/api/launchers`, `/api/customer_satellites`,
`/api/centres`, `/api/spacecraft_missions`.
