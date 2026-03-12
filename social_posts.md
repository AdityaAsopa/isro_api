# ISRO API Contribution — Social Posts

---

## Section 1: LinkedIn Posts (per PR)

### PR #1 — Normalize data schemas, enrich datasets, and fix API handler quality
**PR:** https://github.com/isro/api/pull/65
**Branch:** `feat/normalize-data-schemas`

---

Did you know ISRO has an open-source API? I didn't — until recently. And when I dug in, I found something that needed fixing.

The ISRO API (isro.vercel.app) serves spacecraft, launcher, and mission data to developers worldwide. But the data had grown organically from years of scraping and manual edits. Mass was stored under 9 different field names. Dates existed in 15+ formats. Some entries had spacecraft names in the mass field. Country names were inconsistent ("GERMANY" vs "Germany" vs "UK" vs "UNITED KINGDOM"). Most records were missing key fields entirely.

As a scientist, messy data is something I deal with daily. So I decided to contribute.

What I built:
- A comprehensive Python normalization pipeline that parses every date variant into ISO 8601, resolves all mass/power field variants into numeric values, classifies orbits (LEO, SSO, GEO, Lunar, Interplanetary), and infers mission status from launch date + mission life
- Enriched 113 spacecraft records from 2 fields to 8 fields by cross-referencing mission data
- Classified 81 launch vehicles by family (SLV, ASLV, PSLV, GSLV, LVM-3)
- Normalized 75 customer satellite records with consistent country names across 22 nations
- Fixed API handler code quality: removed dead imports, corrected variable names, added proper headers

The key constraint I set for myself: zero breaking changes. Every API route, every response key, every existing record — preserved. The pipeline only adds and fixes, never drops.

The normalization script is fully idempotent — run it once or ten times, same output. Fields that can't be confidently parsed are set to null, not guessed. Because when you're handling data about India's space program, you don't cut corners.

PR is live: https://github.com/isro/api/pull/65

If you use the ISRO API or care about open data for India's space program, I'd love your review.

#ISRO #OpenSource #API #DataEngineering #India #SpaceTech #OpenData

---

### PR #2 — Individual resource endpoints by ID
**PR:** https://github.com/isro/api/pull/67
**Branch:** `feat/individual-id-endpoints`

---

Small PR, big quality-of-life improvement for the ISRO API.

Before: you could fetch all 113 spacecrafts, but there was no way to ask for a single one by ID.

Now: `/api/spacecrafts/1` gives you Aryabhata. `/api/spacecraft_missions/10` gives you INSAT-3B's full mission data. Every collection now has individual record lookup.

Five new endpoints, five files. Each returns the record directly, 404 if not found, 400 if the ID isn't a valid integer. No new data — reads directly from the normalized JSON files.

PR: https://github.com/isro/api/pull/67

#ISRO #OpenSource #API #RestAPI #India #SpaceTech

---

### PR #3 — Analytics endpoint: /api/stats
**PR:** https://github.com/isro/api/pull/66
**Branch:** `feat/stats-endpoint`

---

What does India's space program look like, in numbers?

The ISRO API now has a `/api/stats` endpoint that answers that question — computed at runtime from the live data:

- How many spacecrafts are still active vs decommissioned?
- What fraction of missions were in GEO vs SSO vs LEO?
- Which countries have launched the most satellites on ISRO vehicles?
- How many kg of payload has ISRO put into orbit for foreign customers?

Every number is derived directly from the data files. Nothing hardcoded. The stats stay accurate automatically as data is updated.

PR: https://github.com/isro/api/pull/66

#ISRO #OpenSource #API #DataEngineering #SpaceData #India

---

### PR #4 — Query parameter filtering for all collection endpoints
**PR:** https://github.com/isro/api/pull/68
**Branch:** `feat/query-filtering`

---

The ISRO API now supports filtering. Some examples:

`/api/spacecrafts?status=active` — all currently active spacecraft
`/api/spacecraft_missions?orbit_type=SSO&mission_type=Remote+Sensing` — SSO remote sensing missions
`/api/customer_satellites?country=Germany` — all German satellites launched by ISRO
`/api/launchers?vehicle_family=PSLV` — all PSLV variants

Filters are case-insensitive, composable, and backward-compatible. Calling without params returns the full collection as before.

This is only possible because of the data normalization work in PR #65 — consistent field values make filtering meaningful. Messy data and filtering don't mix.

PR: https://github.com/isro/api/pull/68

#ISRO #OpenSource #API #RestAPI #DataEngineering #India

---

### PR #5 — Relational cross-links between resources
**PR:** https://github.com/isro/api/pull/69
**Branch:** `feat/relational-cross-links`

---

An often-overlooked quality of a well-designed API: discoverability. You shouldn't need to know the entire data model upfront — the API should guide you.

Small addition today: when you fetch a spacecraft by ID, the response now includes a `_links.mission` pointing to its detailed mission record. And vice versa — a mission record links back to its spacecraft.

```json
GET /api/spacecrafts/10
{
  "id": 10,
  "name": "INSAT-3B",
  "status": "decommissioned",
  "_links": {
    "self": "/api/spacecrafts/10",
    "mission": "/api/spacecraft_missions/5"
  }
}
```

All 64 mission records have a verified name match in the spacecrafts dataset. No link is added when there's no confirmed match — no guessing.

PR: https://github.com/isro/api/pull/69

#ISRO #OpenSource #API #RestAPI #HypermediaAPI #India

---

### PR #7 — Comprehensive test suite and CI workflow
**PR:** https://github.com/isro/api/pull/71
**Branch:** `feat/api-tests`

---

A good API isn't just well-designed — it's verifiable. Today I added a full test suite to the ISRO API.

58 tests across three layers:

**API handler tests** — every endpoint tested for correct status codes, Content-Type headers, record counts, filter behaviour (case-insensitive, composable, empty array not 404), and error handling (400/404).

**Stats tests** — the `/api/stats` response is verified mathematically: every distribution (by status, orbit type, mission type, country, vehicle family) must sum to its collection total. If the stats endpoint ever hardcodes a number, this test breaks.

**Data integrity tests** — these are the most important. They're a regression guard that fires if a scraper update or manual edit silently corrupts the schema:
- No trailing whitespace in names
- All dates in ISO 8601 format
- All mass/power fields are positive numbers, not strings
- Status and orbit type match defined enums
- Country names are title case, not all-caps

CI runs all tests + schema validation on every PR. Both must be green before merging.

PR: https://github.com/isro/api/pull/71

#ISRO #OpenSource #API #Testing #CI #Jest #India

---

### Dev batch — Four new platform endpoints (timeline, launches, families, search)

**Branch:** `dev` (fork: AdityaAsopa/iso_api)

---

The ISRO API now has four new endpoints that turn static JSON into a queryable platform.

**`/api/timeline`** — "On this day in ISRO history"

```text
/api/timeline?date=04-19  → April 19: Aryabhata launched (1975)
/api/timeline?year=1980   → All events in 1980
/api/timeline?range=2000,2023 → 23-year sweep
```

Aggregates launch dates from missions, spacecrafts, and customer satellites into one chronological stream. Exactly what every classroom project, social media bot, or "this day in space" app needs.

**`/api/launches`** — Unified launch manifest

The world-record 104-satellite launch (PSLV-C37, February 2017) was previously scattered across three data files. Now it's one event — `primary_payload: "Cartosat-2D"`, `co_passengers: [...]`, `total_payloads: 104`. Filter by `?year=`, `?vehicle_family=PSLV`, or `?outcome=success`.

**`/api/families`** — Evolutionary lineage

ISRO's real achievement isn't individual missions — it's the series. INSAT has been flying since 1982. IRNSS/NavIC reached full constellation in 2016. Cartosat-3 in 2019 delivers sub-metre resolution. This endpoint groups all 113 spacecraft into 15 named families, each with a description of its role in India's space programme.

**`/api/search?q=`** — Full-text search across everything

```text
/api/search?q=chandrayaan    → matches across spacecrafts + missions
/api/search?q=Karnataka      → find ISRO centres in Karnataka
/api/search?q=Germany        → all German customer satellites
```

Case-insensitive, cross-collection, with `match_field` so you know why each result matched. Plus `/api/health` for uptime monitoring.

44 new tests. Updated dashboard with cards for each new endpoint.

Everything on the fork dev branch while the 7 upstream PRs are reviewed.

#ISRO #OpenSource #API #India #SpaceTech #OpenData

---

### PR #6 — JSON Schema validation and CI data integrity checks
**PR:** https://github.com/isro/api/pull/70
**Branch:** `feat/json-schema-validation`

---

Good data is hard to maintain without guardrails. This PR adds them.

Formal JSON Schemas for all five ISRO data files — enforcing required fields, constraining orbit types and mission statuses to known enums, validating ISO 8601 date formats, and rejecting unknown fields.

A CI workflow now runs on every PR that touches `data/` — if any file violates its schema, the PR fails. This means future scraper updates, manual edits, or data contributions can't silently corrupt the schema that all those filtering and cross-linking features depend on.

`npm run validate` also works locally, so contributors get fast feedback before pushing.

PR: https://github.com/isro/api/pull/70

#ISRO #OpenSource #API #CI #DataQuality #JSONSchema #India

---

## Section 2: Twitter/X Thread

### Thread: Contributing to the ISRO API — an open-source journey

**1/**
I recently discovered that ISRO has an open-source API serving spacecraft, launcher, and mission data. As an Indian scientist, I had to look closer. What I found was a data quality challenge hiding in plain sight. A thread on what I did about it. 🧵

**2/**
The API (isro.vercel.app) has 5 endpoints covering 113 spacecrafts, 81 launchers, 75 customer satellites, 64 missions, and 44 research centres. But the underlying data had grown chaotic over time — accumulated from multiple scrapers and manual edits over years.

**3/**
How chaotic? Mass alone was stored under 9 different field names: `weight`, `lift-off_mass`, `liftoff_mass`, `lift_off_mass`, `spacecraft_mass`, `mass`, `liftoffmass`, `liftoff mass`... you get the idea. Power had 5+ variants. Dates existed in 15+ different formats.

**4/**
Some entries had values in entirely wrong fields — one had `mission: "7 Years"` (that's mission_life, not mission type). Another had `lift-off_mass: "IRS-P3"` — that's a spacecraft name, not a mass value. The spacecrafts endpoint had only id + name. That's it. For 113 records.

**5/**
As someone who works with messy scientific data daily, this felt like a familiar challenge. So I built a normalization pipeline in Python that:
- Parses 15+ date formats → ISO 8601
- Resolves 9+ mass variants → numeric mass_kg
- Extracts wattage from strings like "15 Sq.m Solar Array generating 1360W" → 1360

**6/**
The pipeline also classifies orbits (LEO, SSO, GEO, Lunar, Interplanetary, Failed), infers mission status from launch date + designed lifetime, normalizes country names to title case, and cross-references missions to enrich spacecraft records from 2 fields to 8.

**7/**
The hard constraint: zero breaking changes. Same API routes. Same response wrapper keys. Every existing record preserved. The pipeline only adds structure and fills gaps — it never drops data. When you're handling data about India's space missions, you respect what's already there.

**8/**
The script is fully idempotent — run it once or a hundred times, same result. Anything that can't be confidently parsed becomes null, not a guess. Because bad data that looks right is worse than missing data that's honest.

**9/**
Results:
- 64 missions: consistent 17-field schema, 59 ISO dates, 61 numeric masses
- 113 spacecrafts: 73 enriched with launch date, vehicle, orbit, status
- 81 launchers: classified by vehicle family
- 75 customer satellites: ISO dates, numeric mass, 22 normalized countries

**10/**
Also fixed the API handlers — removed dead `fs` imports from every file, fixed a variable named `launchers` that actually held customer satellite data (yes, really), added Content-Type headers, and sanitized error responses.

**11/**
PR #1 is live: https://github.com/isro/api/pull/65

This is the foundation. Next up: query parameters, filtering, individual ID endpoints, stats, cross-links, schemas, and tests. If you use the ISRO API or care about open data for India's space program — I'd appreciate a review or a star.

**12/**
The next wave of PRs turned the normalized data into real API features. `/api/spacecrafts?status=active`. `/api/spacecraft_missions?orbit_type=SSO`. `/api/customer_satellites?country=Germany`. Filters are case-insensitive, composable, backward-compatible.

**13/**
Individual record lookup: `/api/spacecrafts/1` → Aryabhata. `/api/spacecraft_missions/10` → full INSAT-3B mission data. Five new endpoints. Each returns 404 for missing IDs, 400 for invalid ones. No guessing.

**14/**
Discoverability: each spacecraft record now includes a `_links.mission` pointing to its detailed mission entry, and vice versa. Cross-linked by verified name matching — all 64 missions confirmed. No link added when there's no match.

**15/**
`/api/stats` — India's space program in numbers. Active vs decommissioned. GEO vs SSO vs LEO. Which countries fly on ISRO vehicles. Total payload mass launched for foreign customers. All computed live from the data — nothing hardcoded.

**16/**
To keep it all honest: JSON Schemas for every data file. A CI workflow that validates them on every PR. And a full Jest test suite — 58 tests across handlers, ID endpoints, stats math, and data integrity. Tests that would have caught every bug we found while building this.

**17/**
7 PRs. 6 open. All independent, all backward-compatible, all built on the normalized data foundation.

The ISRO API serves data about one of the most ambitious space programs on the planet. It deserves to be reliable, queryable, and well-tested.

github.com/isro/api — open for review and contribution.

**18/**
While the PRs are under review, development continues on the fork. Four new endpoints just landed on the `dev` branch.

**19/**
`/api/timeline` — every ISRO launch event, queryable by date.

`?date=04-19` → what launched on April 19? (Aryabhata, 1975)
`?year=2023` → everything ISRO launched in 2023
`?range=1975,1999` → the first 25 years

Cross-references missions + spacecrafts + customer satellites. All dates already ISO 8601 — so this was just filtering.

**20/**
`/api/launches` — unified launch manifest.

PSLV-C37 (Feb 2017, 104 satellites) was scattered across 3 files. Now it's one object: primary payload, co-passengers array, total_payloads: 104, total_mass_kg, outcome.

Filter: `?vehicle_family=PSLV`, `?year=2017`, `?outcome=success`

**21/**
`/api/families?name=INSAT` — satellite family trees.

ISRO's strength is iterative engineering. The INSAT series has flown since 1982. IRNSS/NavIC is a 7-satellite constellation. Cartosat evolved from 2.5m to sub-metre resolution over 15 years.

15 families. Each with a description, member count, and chronologically sorted members.

**22/**
`/api/search?q=chandrayaan` — full-text search across all 5 collections.

One query, every collection. Response includes `match_field` so you know why each result matched.

`?collection=centres` to narrow scope. 400 on missing `?q`. Empty results return `count: 0`, not 404.

**23/**
`/api/health` — for uptime monitoring. Status, timestamp, per-collection record counts.

44 new tests. Dashboard updated with cards for every new endpoint, "New" badges, feature pills.

The fork is at: github.com/AdityaAsopa/iso_api · branch: `dev`

#ISRO #OpenSource #India #SpaceTech #OpenData #DataEngineering #API

---

---

*This document is updated live with each new PR and thread extension.*
