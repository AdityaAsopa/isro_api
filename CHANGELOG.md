# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added — New API endpoints

- `GET /api/timeline` — chronological event stream across all collections;
  supports `?date=MM-DD` ("on this day"), `?month=YYYY-MM`, `?year=YYYY`,
  `?range=YYYY,YYYY`; deduplicates spacecrafts that already appear in missions
- `GET /api/launches` — unified launch manifest merging spacecraft missions +
  customer satellites into one event per (vehicle, date); fields: `launch_date`,
  `vehicle`, `vehicle_family`, `launch_site`, `primary_payload`, `co_passengers[]`,
  `total_payloads`, `total_mass_kg`, `outcome`; filters: `?year=`, `?vehicle_family=`,
  `?outcome=`
- `GET /api/families[?name=INSAT]` — spacecraft grouped into 15 named evolutionary
  series (INSAT, GSAT, IRS, Cartosat, RISAT, IRNSS/NavIC, Chandrayaan, Resourcesat,
  Oceansat, EOS, Rohini, SROSS, Bhaskara, INS, Microsat); collection endpoint
  returns summaries sorted by member count; `?name=` returns full members list
  sorted chronologically
- `GET /api/search?q=<term>` — case-insensitive substring search across all five
  collections; optional `?collection=` to narrow scope; response includes
  `match_field` indicating which field triggered the hit
- `GET /api/health` — health check returning `status`, `timestamp`, and per-collection
  record counts

### Added — Tests

- 44 new Jest tests across `timeline.test.js`, `launches.test.js`,
  `families.test.js`, and `search.test.js`

### Added — Local Dev & Data Viewer

- `server.js` — Express wrapper for local development (`npm start`, port 3000);
  adapts all 11 Vercel-style handlers via a `wrapHandler()` bridge that merges
  Express `req.params` into `req.query` so Vercel-style ID handlers work unchanged;
  serves static files + all API routes including the 4 new endpoints
- `viewer.html` — generic data viewer; auto-detects response shape for all 10
  endpoint response types (spacecrafts, spacecraft_missions, launchers,
  customer_satellites, centres, events, launches, families, members, results);
  card layout ≤20 items / table view >20 items; live search box; status/orbit/outcome
  colour badges; back navigation to dashboard
- `index.html` — all 11 endpoint cards now link to `viewer.html?endpoint=...`
  for a formatted view instead of raw JSON; "Explore API" hero button also uses viewer
- `package.json` — added `express` dependency; `start`/`dev` scripts; `main: server.js`

### Added — Dashboard & Docs

- Interactive dashboard (`index.html`) updated: four new endpoint cards with "New"
  badge; four additional feature pills; new `/api/health` card
- `isro_api_plan.md` — big-picture vision document (10 platform moves)
- `social_posts.md` — LinkedIn posts and X thread for all contributions

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
