# Data Supplements

This directory contains enrichment data sourced from verified third-party
databases. It is intentionally **separate from the scraped source data** in
`data/` so the two layers remain auditable and independently maintainable.

## Layer model

```
data/*.json              ← scraped + normalised (upstream source of truth)
data/supplements/*.json  ← enrichments from external databases
```

Running `scripts/apply_enrichments.py` merges these two layers and writes
the final enriched records back into `data/*.json`. The script is
**conservative**: it only fills fields that are `null` or `"unknown"` in the
scraped layer — it never overwrites an existing value.

Every enriched field carries a `_sources` entry so the provenance is always
traceable.

## Sources

### GCAT — General Catalogue of Artificial Space Objects
- **Maintainer:** Jonathan C. McDowell (Harvard-Smithsonian CfA)
- **URL:** <https://planet4589.org/space/gcat/>
- **License:** CC BY 4.0
- **Files used:** `satcat.tsv` (satellite catalog), `orcat.tsv` (orbital catalog)
- **Fields supplied:** `launch_date`, `launch_vehicle`, `perigee_km`,
  `apogee_km`, `inclination_deg`, `altitude_km` (mean of perigee/apogee),
  `status` (mapped from GCAT status codes)
- **Last downloaded:** see `gcat_meta.json`

### Wikipedia
- **URL:** <https://en.wikipedia.org/wiki/List_of_Indian_satellites>
- **License:** CC BY-SA 3.0 — reuse with attribution
- **Method:** MediaWiki API (`action=query&prop=revisions&rvprop=content`)
  + regex extraction of `{{Infobox spacecraft}}` parameters
- **Fields supplied:** `mass_kg`, `orbit_type`, `launch_date`, `status`,
  `altitude_km`, `inclination_deg`, `mission_life`, `launch_vehicle`
- **Last downloaded:** see `wikipedia_meta.json`

## Files

| File | Description |
|------|-------------|
| `gcat_enrichments.json` | Per-spacecraft enrichments from GCAT (generated) |
| `wikipedia_enrichments.json` | Per-spacecraft enrichments from Wikipedia (generated) |
| `gcat_meta.json` | Download timestamp + GCAT version string |
| `wikipedia_meta.json` | Download timestamp + article revision IDs |

These files are committed so the enrichment is reproducible without
re-running the network scripts. Re-run the scripts only when you want to
pull fresher data.

## Adding a new source

1. Write `scripts/enrich_from_<source>.py` — outputs
   `data/supplements/<source>_enrichments.json`
2. Add the source to `apply_enrichments.py`'s `SOURCE_PRIORITY` list
3. Document the source in this README
