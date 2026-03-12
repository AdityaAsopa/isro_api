# ISRO API — The Big Picture

## Context

We've submitted 7 PRs that fix the foundation: normalized data, consistent schemas, filtering, individual endpoints, stats, cross-links, tests, and CI. The API now works correctly.

But it serves **50 years of India's space program** — Aryabhata (1975) through Chandrayaan-3 (2023). 113 spacecrafts, 81 launch vehicles, 64 detailed missions, 75 foreign customer satellites from 22 countries, 44 research centres across 14 states. This isn't a weekend project's worth of data — it's a national record.

The question isn't "what code improvements does this repo need?" It's: **what should India's open space data platform look like?**

---

## Who needs this (and doesn't know it yet)

| Audience | What they'd do with it |
|----------|----------------------|
| **Students & educators** | Classroom projects, quiz apps, science fair dashboards, exam prep on Indian space history |
| **Journalists & data storytellers** | Launch cadence charts, budget-per-mission analysis, "this day in ISRO history" pieces |
| **App developers** | Space tracking apps, widgets, Alexa/Google Assistant skills, Telegram bots |
| **Researchers** | Orbital debris tracking, mission success rate analysis, remote sensing coverage studies |
| **Policy analysts** | Commercial launch market share, international partnership mapping, capability benchmarks vs. other agencies |
| **Visualization artists** | 3D orbit renderers, launch timeline animations, satellite constellation maps |
| **Hackathon participants** | Every Indian hackathon needs space data — this should be the first API they reach for |
| **ISRO itself** | Public-facing data portal, transparency dashboard, recruitment inspiration |
| **International space community** | Comparative analysis (ISRO vs NASA vs ESA vs CNSA launch rates, cost-per-kg) |

---

## The Vision: 10 Big Moves

### 1. `/api/timeline` — This Day in ISRO History
**What:** Endpoint that returns every event that happened on a given date (or date range) across all of ISRO's history.
```
GET /api/timeline?date=04-19        → April 19: Aryabhata launched (1975)
GET /api/timeline?month=2023-07     → All events in July 2023
GET /api/timeline?range=1975,2025   → Full 50-year timeline
```
**Why:** Every news outlet, every social media account, every classroom needs "on this day" content. This makes it trivially queryable.
**Data source:** All existing launch_date fields + can be enriched with decommission dates, milestone dates.

### 2. `/api/launches` — Unified Launch Manifest
**What:** A single view merging spacecraft missions, customer satellite launches, and launcher data into a unified launch event record.
```json
{
  "launch_date": "2017-02-15",
  "vehicle": "PSLV-C37",
  "vehicle_family": "PSLV",
  "launch_site": "SDSC SHAR",
  "primary_payload": "Cartosat-2D",
  "co_passengers": ["DOVE-1", "DOVE-2", ..., "LEMUR-2"],
  "total_payloads": 104,
  "total_mass_kg": 1378,
  "outcome": "success"
}
```
**Why:** The world-record 104-satellite launch (PSLV-C37) is currently spread across three separate data files. A unified launch view is what developers actually want.
**Data source:** Cross-reference spacecraft_missions + customer_satellites + launchers by vehicle name and date.

### 3. GraphQL Endpoint
**What:** A single `/api/graphql` endpoint that lets consumers query exactly the fields and relationships they need.
```graphql
{
  spacecraft(name: "Chandrayaan-3") {
    launch_date
    orbit_type
    mass_kg
    mission { payloads, power_watts }
    launcher { vehicle_family }
  }
}
```
**Why:** REST is great for simple lookups, but the relational nature of space data (spacecraft → mission → launcher → customer satellites) is a natural fit for GraphQL. Developers building apps shouldn't need 5 API calls to assemble one view.
**Implementation:** `apollo-server` or `graphql-yoga` on a single Vercel function. Schema maps directly to our normalized JSON.

### 4. Satellite Family Trees
**What:** Endpoint that returns the evolution of satellite series — INSAT, IRS, GSAT, Cartosat, Chandrayaan.
```
GET /api/families
GET /api/families/INSAT  → [INSAT-1A, 1B, 1C, 1D, 2A, 2B, ..., 4CR]
```
**Why:** ISRO's strength is iterative improvement. The INSAT series spans 40+ years. The IRS series evolved from 1A (1988) to Resourcesat-2A (2016). Showing this lineage makes ISRO's engineering philosophy visible.
**Data source:** Name-pattern matching + manual curation for edge cases.

### 5. Interactive Documentation Portal
**What:** Not just an OpenAPI spec, but a full interactive docs site — try endpoints live, see example responses, understand the data model visually.
**Implementation options:**
- **OpenAPI 3.1 spec** (`openapi.yaml`) → auto-generate with Swagger UI or Redoc
- **Hosted on Vercel** alongside the API (e.g., `isro.vercel.app/docs`)
- Entity relationship diagram showing spacecraft ↔ mission ↔ launcher ↔ customer satellite connections
**Why:** The API is useless if people can't discover it. Interactive docs are the difference between "a JSON endpoint" and "a platform."

### 6. Embeddable Widgets & Badges
**What:**
- **SVG badges** — `![ISRO Active Spacecrafts](isro.vercel.app/badge/active-spacecrafts)` → dynamically rendered count badge (like npm download badges)
- **Embed cards** — `<iframe src="isro.vercel.app/embed/spacecraft/chandrayaan-3">` → a styled card showing mission details, embeddable in any website
- **OG image generation** — `isro.vercel.app/og/spacecraft/chandrayaan-3` → auto-generated social media preview image with mission details
**Why:** If you want ISRO data everywhere — in blog posts, GitHub READMEs, Wikipedia discussions, classroom presentations — it needs to be embeddable without code.

### 7. SDKs & Client Libraries
**What:** Published packages that wrap the API:
- `npm install isro-api` (JavaScript/TypeScript)
- `pip install isro-api` (Python)
```python
from isro import ISRO
api = ISRO()
active = api.spacecrafts.filter(status="active")
chandrayaan = api.missions.get("Chandrayaan-3")
print(chandrayaan.orbit_type)  # "Lunar"
```
**Why:** Every serious API has client libraries. Scientists use Python. Web devs use JS. If we want adoption, meet people where they code.

### 8. Real-Time & Near-Real-Time Data
**What:**
- **TLE (Two-Line Element) integration** — current orbital positions of active ISRO satellites from Space-Track.org or CelesTrak
- **Next launch countdown** — if ISRO publishes upcoming launch dates
- **Webhook/SSE subscriptions** — notify when new data is added
```
GET /api/spacecrafts/active/positions  → current lat/lon/alt of active satellites
GET /api/next-launch                   → countdown to next scheduled launch
```
**Why:** Static historical data is a reference. Real-time data is a platform. The difference between Wikipedia and a dashboard.

### 9. Geospatial Features
**What:**
- **Launch site coordinates** — SDSC SHAR (13.7199°N, 80.2304°E), etc.
- **Centre locations** — lat/lon for all 44 ISRO centres
- **GeoJSON endpoints** — for map integration
```
GET /api/centres?format=geojson  → GeoJSON FeatureCollection, droppable into Mapbox/Leaflet
GET /api/launches/map            → all launch sites with mission counts
```
**Why:** Space is inherently geographic. People want to see where things launch from, where ground stations are, where ISRO operates. This data exists (PR #60 is already adding launch coordinates). Make it a first-class feature.

### 10. `/api/compare` — Cross-Agency Benchmarking
**What:** Curated comparison data between ISRO and other space agencies (launch counts, cost-per-kg, active satellites, mission types).
```
GET /api/compare?agencies=ISRO,NASA,ESA&metric=launches_per_year
```
**Why:** ISRO's cost efficiency is legendary (Mangalyaan cost less than the movie Gravity). But there's no easy way to quantify this programmatically. A comparison endpoint makes ISRO's achievements legible to policy researchers, journalists, and students worldwide.
**Caveat:** This requires curated external data, not just ISRO scraping. Could be a community-contributed dataset with validation.

---

## Infrastructure to Support This

| Need | Solution |
|------|----------|
| **Caching** | Vercel Edge caching with `Cache-Control` headers; data changes rarely |
| **Rate limiting** | Vercel's built-in or simple token bucket middleware |
| **Versioning** | `/api/v2/` prefix when breaking changes are needed |
| **Health check** | `/api/health` returning uptime, data freshness timestamp, record counts |
| **Monitoring** | Vercel Analytics + `/api/stats` as a self-monitoring endpoint |
| **Data freshness** | GitHub Actions cron (PR #64 already proposes this) + normalization pipeline |
| **Search** | Full-text search across all entities — `/api/search?q=chandrayaan` |

---

## Recommended Next Steps (Prioritized)

### Immediate (this session)
1. **OpenAPI 3.1 spec** (`openapi.yaml`) — documents everything we've built, enables auto-generated interactive docs
2. **Response envelope with pagination** — `/api/spacecrafts?page=1&limit=10` with metadata

### Short-term (next few sessions)
3. **`/api/timeline`** — "this day in ISRO history" endpoint
4. **`/api/launches`** — unified launch manifest (cross-referencing existing data)
5. **Satellite family classification** — programmatic grouping of INSAT, IRS, GSAT series
6. **GeoJSON support** for centres (coordinates can be looked up for the 44 centres)

### Medium-term (separate project scope)
7. **Interactive docs portal** (Swagger UI or Redoc hosted on Vercel)
8. **Python SDK** (`pip install isro-api`)
9. **JavaScript SDK** (`npm install isro-api`)
10. **SVG badge generator** endpoint

### Long-term (community-driven)
11. **GraphQL endpoint**
12. **TLE satellite position integration**
13. **Cross-agency comparison data**
14. **Embeddable widgets**

---

## What makes this more than "just another API"

Most open-source APIs are utilities. This one can be a **monument** — a programmatic interface to 50 years of a nation's journey to space. From Aryabhata to Chandrayaan-3, from 360 kg in LEO to interplanetary missions.

The data already exists. The schemas are now clean. The question is: do we build a JSON endpoint, or do we build the definitive platform for anyone in the world who wants to understand what India has done in space?
