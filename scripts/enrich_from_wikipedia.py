#!/usr/bin/env python3
"""
enrich_from_wikipedia.py
------------------------
Queries the Wikipedia MediaWiki API to extract spacecraft infobox data for
every ISRO spacecraft and mission in the data files.

No third-party libraries required — uses only Python stdlib.

Outputs
-------
  data/supplements/wikipedia_enrichments.json  — per-name enrichment records
  data/supplements/wikipedia_meta.json         — revision IDs + timestamp

Source
------
  Wikipedia (https://en.wikipedia.org) — CC BY-SA 3.0
  Reuse permitted with attribution.

Usage
-----
  python scripts/enrich_from_wikipedia.py [--dry-run] [--limit N]

Flags
-----
  --dry-run   Fetch only the first --limit (default 5) names; don't write files.
  --limit N   Fetch at most N spacecraft (default: all).
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

WIKI_API     = "https://en.wikipedia.org/w/api.php"
RATE_DELAY   = 0.5   # seconds between requests (be polite)
USER_AGENT   = "isro-api-enrichment/1.0 (https://github.com/isro/api; open-source research)"

REPO_ROOT    = os.path.join(os.path.dirname(__file__), "..")
OUT_DIR      = os.path.join(REPO_ROOT, "data", "supplements")

# ── Orbit type vocabulary ─────────────────────────────────────────────────────
ORBIT_KEYWORDS = {
    "GEO":              "GEO",
    "GEOSTATIONARY":    "GEO",
    "GEOSYNCHRONOUS":   "GEO",
    "GSO":              "GEO",
    "GTO":              "GEO",
    "SSO":              "SSO",
    "SUN-SYNCHRONOUS":  "SSO",
    "SUN SYNCHRONOUS":  "SSO",
    "LEO":              "LEO",
    "LOW EARTH":        "LEO",
    "POLAR":            "SSO",
    "LUNAR":            "Lunar",
    "MOON":             "Lunar",
    "LLO":              "Lunar",
    "MARS":             "Interplanetary",
    "HELIOCENTRIC":     "Interplanetary",
    "INTERPLANETARY":   "Interplanetary",
    "L1":               "Interplanetary",
    "L2":               "Interplanetary",
    "LAGRANGE":         "Interplanetary",
}

STATUS_KEYWORDS = {
    "OPERATIONAL":     "active",
    "ACTIVE":          "active",
    "FUNCTIONING":     "active",
    "DECOMMISSIONED":  "decommissioned",
    "RETIRED":         "decommissioned",
    "DEFUNCT":         "decommissioned",
    "END OF LIFE":     "decommissioned",
    "DECAYED":         "decommissioned",
    "RE-ENTERED":      "decommissioned",
    "FAILED":          "failed",
    "LAUNCH FAILURE":  "failed",
    "LOST":            "failed",
    "PARTIAL FAILURE": "failed",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def wiki_get(params):
    """Make a GET request to the Wikipedia API and return parsed JSON."""
    params["format"] = "json"
    params["formatversion"] = "2"
    url = WIKI_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def search_wikipedia(name):
    """Return the best Wikipedia page title for a given spacecraft name."""
    data = wiki_get({
        "action": "query",
        "list":   "search",
        "srsearch": name + " ISRO satellite spacecraft",
        "srlimit": 3,
        "srnamespace": 0,
    })
    results = data.get("query", {}).get("search", [])
    if not results:
        return None
    # Prefer an exact (case-insensitive) title match
    nl = name.lower()
    for r in results:
        if r["title"].lower() == nl or r["title"].lower().startswith(nl):
            return r["title"]
    return results[0]["title"]


def fetch_wikitext(title):
    """Fetch the raw wikitext of a Wikipedia article."""
    data = wiki_get({
        "action":  "query",
        "titles":  title,
        "prop":    "revisions",
        "rvprop":  "content|ids",
        "rvslots": "main",
    })
    pages = data.get("query", {}).get("pages", [])
    if not pages:
        return None, None
    page = pages[0]
    if page.get("missing"):
        return None, None
    revs = page.get("revisions", [])
    if not revs:
        return None, None
    rev = revs[0]
    rev_id = rev.get("revid")
    wikitext = rev.get("slots", {}).get("main", {}).get("content", "")
    return wikitext, rev_id


def extract_infobox(wikitext):
    """
    Extract {{Infobox spacecraft}} (or similar) from wikitext and return
    a dict of lowercased param → raw value strings.
    """
    if not wikitext:
        return {}

    # Find the infobox block — handles nested {{ }} to find the closing }}
    start = re.search(r'\{\{\s*[Ii]nfobox\s+(?:spacecraft|satellite|space\s*mission)', wikitext)
    if not start:
        return {}

    pos   = start.start()
    depth = 0
    end   = pos
    for i, ch in enumerate(wikitext[pos:], pos):
        if wikitext[i:i+2] == "{{":
            depth += 1
        elif wikitext[i:i+2] == "}}":
            depth -= 1
            if depth == 0:
                end = i + 2
                break

    block = wikitext[pos:end]

    # Split on pipe-prefixed parameters (but not pipes inside nested {{ }})
    params = {}
    # Remove the template name line
    block = re.sub(r'^\{\{\s*[Ii]nfobox[^|]+', "", block).strip()
    # Split on | that are at depth 0
    parts = []
    buf = ""
    d = 0
    for ch in block:
        if ch == "{":
            d += 1
        elif ch == "}":
            d -= 1
        if ch == "|" and d == 0:
            parts.append(buf)
            buf = ""
        else:
            buf += ch
    parts.append(buf)

    for part in parts:
        if "=" not in part:
            continue
        key, _, val = part.partition("=")
        key = key.strip().lower().replace(" ", "_")
        val = val.strip()
        # Strip wiki markup from value (links, refs, templates, HTML tags)
        val = re.sub(r"<ref[^/]*/?>.*?</ref>", "", val, flags=re.DOTALL)
        val = re.sub(r"<[^>]+>", "", val)
        val = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", val)
        val = re.sub(r"\{\{[^}]*\}\}", " ", val)
        val = re.sub(r"'{2,}", "", val)
        val = re.sub(r"\s+", " ", val).strip()
        if key and val:
            params[key] = val

    return params


def parse_mass(params):
    """Extract mass in kg from infobox params."""
    for key in ("mass", "launch_mass", "spacecraft_mass", "wet_mass", "dry_mass",
                "liftoff_mass", "lift_off_mass"):
        val = params.get(key)
        if not val:
            continue
        # e.g. "1380 kg", "1,380 kg", "3045", "3.045 t"
        m = re.search(r"([\d,\.]+)\s*(?:kg)?", val.replace(",", ""))
        if m:
            num = float(m.group(1).replace(",", ""))
            # convert tonnes to kg
            if "t" in val.lower() and num < 1000:
                num *= 1000
            if 1 <= num <= 100_000:
                return round(num, 1)
    return None


def parse_orbit_type(params):
    """Extract orbit type from infobox params."""
    for key in ("orbit", "orbit_type", "orbital_regime", "regime",
                "apoapsis", "periapsis", "inclination", "insertion_orbit"):
        val = params.get(key, "")
        if not val:
            continue
        vu = val.upper()
        for kw, ot in ORBIT_KEYWORDS.items():
            if kw in vu:
                return ot
    return None


def parse_altitude(params):
    """Extract mean altitude in km."""
    for key in ("apoapsis", "apogee", "altitude"):
        val = params.get(key, "")
        m = re.search(r"([\d,\.]+)\s*km", val.replace(",", ""))
        if m:
            return round(float(m.group(1)), 1)
    return None


def parse_inclination(params):
    for key in ("inclination",):
        val = params.get(key, "")
        m = re.search(r"([\d\.]+)\s*°?", val)
        if m:
            v = float(m.group(1))
            if 0 <= v <= 180:
                return round(v, 2)
    return None


def parse_launch_date(params):
    for key in ("launch_date", "launch", "date", "liftoff"):
        val = params.get(key, "")
        if not val:
            continue
        # Try common formats
        for fmt in ("%B %d, %Y", "%d %B %Y", "%Y-%m-%d", "%B %Y", "%Y %B %d"):
            try:
                # extract date-like substring
                m = re.search(r"\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}", val)
                if m:
                    return datetime.strptime(m.group(), fmt.strip()).strftime("%Y-%m-%d")
            except Exception:
                pass
        # Fallback: just grab YYYY-MM-DD if present
        m = re.search(r"(\d{4}-\d{2}-\d{2})", val)
        if m:
            return m.group(1)
        # Just a year
        m = re.search(r"\b(19|20)\d{2}\b", val)
        if m:
            return m.group() + "-01-01"  # year only
    return None


def parse_status(params):
    for key in ("status", "spacecraft_status", "mission_status"):
        val = params.get(key, "")
        if not val:
            continue
        vu = val.upper()
        for kw, st in STATUS_KEYWORDS.items():
            if kw in vu:
                return st
    return None


def parse_launch_vehicle(params):
    for key in ("launch_vehicle", "rocket", "vehicle", "launcher"):
        val = params.get(key, "")
        if val and 3 <= len(val) <= 40:
            # Clean up common wiki annotations
            val = re.sub(r"\s*\(.*?\)", "", val).strip()
            if val:
                return val
    return None


def parse_mission_life(params):
    for key in ("mission_life", "mission_duration", "design_life"):
        val = params.get(key, "")
        if val and len(val) < 60:
            return val
    return None


def enrich_one(name):
    """
    Look up a spacecraft name on Wikipedia and return an enrichment dict.
    Returns None if no useful data found.
    """
    title = search_wikipedia(name)
    if not title:
        return None, None, None

    wikitext, rev_id = fetch_wikitext(title)
    if not wikitext:
        return None, title, rev_id

    params = extract_infobox(wikitext)
    if not params:
        return None, title, rev_id

    result = {
        "mass_kg":         parse_mass(params),
        "orbit_type":      parse_orbit_type(params),
        "altitude_km":     parse_altitude(params),
        "inclination_deg": parse_inclination(params),
        "launch_date":     parse_launch_date(params),
        "status":          parse_status(params),
        "launch_vehicle":  parse_launch_vehicle(params),
        "mission_life":    parse_mission_life(params),
    }

    # Only return if at least one field was found
    has_data = any(v is not None for v in result.values())
    return (result if has_data else None), title, rev_id


def normalise_name(s):
    return re.sub(r"[\s\-_]+", " ", s.lower().strip()) if s else ""


# ── Main ──────────────────────────────────────────────────────────────────────

def main(dry_run=False, limit=None):
    os.makedirs(OUT_DIR, exist_ok=True)

    # Collect all unique spacecraft names from both data files
    names = {}
    for fname, key in [("spacecrafts.json", "spacecrafts"),
                        ("spacecraft_missions.json", "spacecraft_missions")]:
        try:
            data = json.load(open(os.path.join(REPO_ROOT, "data", fname)))
            for rec in data[key]:
                n = rec.get("name", "").strip()
                if n:
                    names[normalise_name(n)] = n   # norm → original
        except Exception as e:
            print(f"  WARNING: could not load {fname}: {e}")

    name_list = list(names.values())
    if limit:
        name_list = name_list[:int(limit)]

    print(f"── Wikipedia enrichment ─────────────────────────────────────────")
    print(f"  {len(name_list)} spacecraft names to look up")
    if dry_run:
        print(f"  [DRY RUN] — will fetch at most {min(limit or 5, len(name_list))} names")
        name_list = name_list[:int(limit or 5)]

    enrichments = {}
    revision_ids = {}
    hit = miss = error = 0

    for i, name in enumerate(name_list, 1):
        print(f"  [{i:3d}/{len(name_list)}] {name} … ", end="", flush=True)
        try:
            result, wp_title, rev_id = enrich_one(name)
            if result:
                norm = normalise_name(name)
                enrichments[norm] = {"name_raw": name, "wikipedia_title": wp_title, **result}
                revision_ids[wp_title] = rev_id
                fields = [k for k, v in result.items() if v is not None]
                print(f"✓  [{', '.join(fields)}]")
                hit += 1
            else:
                print(f"—  (no infobox data)")
                miss += 1
        except Exception as e:
            print(f"✗  {e}")
            error += 1
        time.sleep(RATE_DELAY)

    print(f"\n  Results: {hit} enriched, {miss} no data, {error} errors")

    if dry_run:
        print("\n[DRY RUN] Output files NOT written.")
        return

    out_path = os.path.join(OUT_DIR, "wikipedia_enrichments.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(enrichments, f, indent=2, ensure_ascii=False)
    print(f"\n  Written → {out_path}")

    meta = {
        "source":        "Wikipedia",
        "license":       "CC BY-SA 3.0",
        "attribution":   "Wikipedia contributors, via MediaWiki API",
        "api_url":       WIKI_API,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "names_queried": len(name_list),
        "enriched":      hit,
        "revision_ids":  revision_ids,
    }
    meta_path = os.path.join(OUT_DIR, "wikipedia_meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"  Written → {meta_path}")
    print("\n── Wikipedia enrichment complete ────────────────────────────────")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    limit_arg = None
    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        if idx + 1 < len(sys.argv):
            limit_arg = int(sys.argv[idx + 1])
    main(dry_run=dry_run, limit=limit_arg)
