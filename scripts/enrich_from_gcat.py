#!/usr/bin/env python3
"""
enrich_from_gcat.py
-------------------
Downloads Jonathan McDowell's GCAT (General Catalogue of Artificial Space
Objects) and extracts enrichment data for Indian/ISRO spacecraft.

Outputs
-------
  data/supplements/gcat_enrichments.json   — per-name enrichment records
  data/supplements/gcat_meta.json          — download timestamp + version

Sources (CC BY 4.0 — https://planet4589.org/space/gcat/)
  satcat.tsv  — satellite catalog (name, launch date, status, orbital params)
  launch.tsv  — launch log (launch vehicle, cross-referenced by Launch_Tag)

Usage
-----
  python scripts/enrich_from_gcat.py [--dry-run] [--no-launch]

Flags
-----
  --dry-run    Print match summary without writing output files.
  --no-launch  Skip downloading launch.tsv (launch vehicle data will be absent).
"""

import csv
import io
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────
GCAT_BASE   = "https://planet4589.org/space/gcat/"
SATCAT_URL  = GCAT_BASE + "tsv/cat/satcat.tsv"
LAUNCH_URL  = GCAT_BASE + "tsv/launch/launch.tsv"

# GCAT state/owner codes for India
INDIA_STATES  = {"IND"}
INDIA_OWNERS  = {"IND", "ISRO"}

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "supplements")

# GCAT status code → our vocab
STATUS_MAP = {
    "A":  "active",
    "S":  "active",        # operational/standby
    "P":  "active",        # partially operational
    "D":  "decommissioned",
    "X":  "decommissioned",
    "F":  "failed",
    "L":  "failed",        # lost / launch failure
    "E":  "decommissioned",# re-entered
    "R":  "decommissioned",# recovered
    "-":  None,
}

# GCAT OpOrbit field prefix → our orbit_type vocab
# OpOrbit values look like "LLEO/I", "GEO/S", "HLEO/S", "MO", "LLO", "HCO"
ORBIT_TYPE_MAP = {
    "GEO":   "GEO",
    "GSO":   "GEO",
    "GTO":   "GEO",
    "XGSO":  "GEO",
    "IGSO":  "GEO",
    "LLEO":  "LEO",     # Low LEO
    "MLEO":  "LEO",     # Medium LEO
    "HLEO":  "LEO",     # High LEO
    "LEO":   "LEO",
    "MEO":   "MEO",
    "EEO":   "LEO",
    "PEO":   "LEO",
    "SSO":   "SSO",
    "SSOL":  "SSO",
    "SO":    "LEO",
    "HEO":   "LEO",
    "MO":    "Interplanetary",  # Mars orbit
    "LLO":   "Lunar",           # Lunar orbit
    "SEL1":  "Interplanetary",  # Sun-Earth L1
    "SEL2":  "Interplanetary",
    "L1":    "Interplanetary",
    "L4":    "Interplanetary",
    "L5":    "Interplanetary",
    "HCO":   "Interplanetary",  # Heliocentric
    "PCO":   "Interplanetary",  # Planetocentric
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def fetch_tsv(url):
    """Download a TSV file from GCAT and return list-of-dicts."""
    print(f"  Fetching {url} ...", end=" ", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "isro-api-enrichment/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    print(f"OK ({len(raw):,} bytes)")
    # GCAT TSV files use '#' as the first character of the header line
    lines = raw.splitlines()
    if lines and lines[0].startswith("#"):
        lines[0] = lines[0][1:].strip()   # strip leading '#'
    reader = csv.DictReader(io.StringIO("\n".join(lines)), delimiter="\t")
    return list(reader)


def clean(s):
    """Strip whitespace; return None for empty / dash placeholders."""
    if s is None:
        return None
    s = s.strip()
    return None if s in ("", "-", "?", "N/A", "n/a", "UNK") else s


def parse_float(s):
    s = clean(s)
    if s is None:
        return None
    try:
        return float(re.sub(r"[^\d.\-]", "", s))
    except ValueError:
        return None


def parse_date(s):
    """Return YYYY-MM-DD string or None.  GCAT uses YYYY-MM-DD format."""
    s = clean(s)
    if s is None:
        return None
    # GCAT LDate: "YYYY-MM-DD" or "YYYY-MM" or "YYYY"
    for fmt, length in (("%Y-%m-%d", 10), ("%Y-%m", 7), ("%Y", 4)):
        if len(s) >= length:
            try:
                return datetime.strptime(s[:length], fmt).strftime("%Y-%m-%d")
            except Exception:
                pass
    # Sometimes GCAT uses "YYYY Mon DD", e.g. "2017 Feb 15"
    try:
        return datetime.strptime(s, "%Y %b %d").strftime("%Y-%m-%d")
    except Exception:
        pass
    return None


def normalise_name(s):
    """Lowercase, collapse whitespace, strip punctuation for fuzzy matching."""
    if not s:
        return ""
    s = s.lower().strip()
    s = re.sub(r"[\s\-_]+", " ", s)
    return s


def map_orbit_type(op_orbit):
    """
    Map GCAT OpOrbit field to our orbit_type vocabulary.
    OpOrbit values like 'LLEO/I', 'GEO/S', 'MO', 'LLO/O' — take the prefix before '/'.
    """
    if not op_orbit:
        return None
    code = op_orbit.strip().upper().split("/")[0]
    for key, val in ORBIT_TYPE_MAP.items():
        if code == key or code.startswith(key):
            return val
    return None


def infer_orbit_from_altitude(perigee, apogee, inc):
    """Infer orbit type from orbital elements when OpOrbit is unavailable."""
    if perigee is None or apogee is None:
        return None
    mean_alt = (perigee + apogee) / 2
    if apogee > 80_000:
        return "Interplanetary"
    if apogee > 30_000:
        return "GEO"
    if inc is not None and 95 <= inc <= 105:
        return "SSO"
    if mean_alt < 2_000:
        return "LEO"
    return None


# ── Main ──────────────────────────────────────────────────────────────────────

def main(dry_run=False, no_launch=False):
    os.makedirs(OUT_DIR, exist_ok=True)

    print("-- GCAT enrichment --")

    # 1. Download satcat
    print("\n[1/3] Satellite catalog (satcat.tsv)")
    satcat_rows = fetch_tsv(SATCAT_URL)
    print(f"  {len(satcat_rows):,} rows loaded")

    # Print detected columns for debugging
    if satcat_rows:
        cols = list(satcat_rows[0].keys())
        print(f"  Columns ({len(cols)}): {', '.join(cols[:20])}{'...' if len(cols) > 20 else ''}")

    # Column detection — GCAT column names are fixed but may have leading spaces
    sample = satcat_rows[0] if satcat_rows else {}
    col_map = {k.strip().lower(): k for k in sample.keys()}

    def find_col(*candidates):
        for c in candidates:
            if c in col_map:
                return col_map[c]
        return None

    name_col    = find_col("name", "satname", "plname")
    ldate_col   = find_col("ldate", "launch", "launchdate")
    status_col  = find_col("status")
    dest_col    = find_col("dest", "orbit", "orb")
    op_orbit_col = find_col("oporbit", "oportbit", "op_orbit")
    jcat_col    = find_col("jcat")
    ltag_col    = find_col("launch_tag", "ltag", "launchtag")
    state_col   = find_col("state")
    owner_col   = find_col("owner")
    mass_col    = find_col("mass")
    perigee_col = find_col("perigee")
    apogee_col  = find_col("apogee")
    inc_col     = find_col("inc", "incl")

    print(f"  Key columns: name={name_col}, ldate={ldate_col}, status={status_col}, "
          f"mass={mass_col}, perigee={perigee_col}, apogee={apogee_col}, "
          f"inc={inc_col}, op_orbit={op_orbit_col}, launch_tag={ltag_col}")

    # Filter for Indian satellites
    indian_rows = []
    for row in satcat_rows:
        state = clean(row.get(state_col, "")) or ""
        owner = clean(row.get(owner_col, "")) or ""
        if state.upper() in INDIA_STATES or owner.upper() in INDIA_OWNERS:
            indian_rows.append(row)

    print(f"  {len(indian_rows)} Indian satellite records found")

    # Build lookup by JCAT and Launch_Tag
    satcat_by_jcat  = {}
    ltags_needed    = set()
    for row in indian_rows:
        jcat = clean(row.get(jcat_col, ""))
        ltag = clean(row.get(ltag_col, ""))
        if jcat:
            satcat_by_jcat[jcat] = row
        if ltag:
            ltags_needed.add(ltag)

    # 2. Download launch.tsv for launch vehicle data
    launch_vehicle_by_ltag = {}
    if not no_launch:
        print("\n[2/3] Launch log (launch.tsv) — for launch vehicle data")
        try:
            launch_rows = fetch_tsv(LAUNCH_URL)
            print(f"  {len(launch_rows):,} rows loaded")

            lsample = launch_rows[0] if launch_rows else {}
            lcol_map = {k.strip().lower().replace(" ", "_"): k for k in lsample.keys()}

            def find_lcol(*candidates):
                for c in candidates:
                    if c in lcol_map:
                        return lcol_map[c]
                return None

            l_ltag_col = find_lcol("launch_tag", "ltag", "launchtag", "tag")
            l_lv_col   = find_lcol("lv_type", "lv", "launchvehicle", "vehicle", "rocket")
            l_lvf_col  = find_lcol("lvfamily", "lv_family", "family")

            print(f"  Launch cols: tag={l_ltag_col}, lv={l_lv_col}, lv_family={l_lvf_col}")

            for row in launch_rows:
                ltag = clean(row.get(l_ltag_col, ""))
                if ltag and ltag in ltags_needed:
                    lv = clean(row.get(l_lv_col, ""))
                    if lv:
                        launch_vehicle_by_ltag[ltag] = lv

            print(f"  {len(launch_vehicle_by_ltag)} launch vehicle records matched")
        except Exception as e:
            print(f"  WARNING: Could not load launch.tsv: {e}. Launch vehicle data will be absent.")
    else:
        print("\n[2/3] Skipping launch.tsv (--no-launch flag)")

    # 3. Build enrichments dict keyed by normalised satellite name
    print("\n[3/3] Building enrichments ...")
    enrichments = {}
    for row in indian_rows:
        name_raw = clean(row.get(name_col, ""))
        if not name_raw:
            continue
        norm_name = normalise_name(name_raw)
        jcat      = clean(row.get(jcat_col, ""))
        ltag      = clean(row.get(ltag_col, ""))

        # Dates and status
        ldate  = parse_date(row.get(ldate_col, ""))
        status = STATUS_MAP.get(clean(row.get(status_col, "")) or "", None)

        # Orbital parameters — directly from satcat columns
        perigee = parse_float(row.get(perigee_col, "")) if perigee_col else None
        apogee  = parse_float(row.get(apogee_col, ""))  if apogee_col else None
        inc     = parse_float(row.get(inc_col, ""))      if inc_col    else None
        mass    = parse_float(row.get(mass_col, ""))     if mass_col   else None

        # Orbit type — prefer OpOrbit, fall back to Dest, then altitude heuristic
        op_orbit = clean(row.get(op_orbit_col, "")) if op_orbit_col else None
        orbit_t  = map_orbit_type(op_orbit)
        if orbit_t is None:
            dest    = clean(row.get(dest_col, "")) if dest_col else None
            orbit_t = map_orbit_type(dest)
        if orbit_t is None:
            orbit_t = infer_orbit_from_altitude(perigee, apogee, inc)

        # Altitude — mean of perigee and apogee
        altitude = round((perigee + apogee) / 2, 1) if (perigee and apogee) else None

        # Launch vehicle from launch.tsv cross-reference
        lv = launch_vehicle_by_ltag.get(ltag) if ltag else None

        enrichments[norm_name] = {
            "name_raw":        name_raw,
            "jcat":            jcat,
            "launch_tag":      ltag,
            "launch_date":     ldate,
            "launch_vehicle":  lv,
            "status":          status,
            "orbit_type":      orbit_t,
            "perigee_km":      perigee,
            "apogee_km":       apogee,
            "altitude_km":     altitude,
            "inclination_deg": inc,
            "mass_kg":         mass,
        }

    # Remove entries where nothing useful was found
    enrichments = {k: v for k, v in enrichments.items()
                   if any(v[f] is not None for f in
                          ("launch_date", "launch_vehicle", "status", "orbit_type",
                           "perigee_km", "apogee_km", "altitude_km", "inclination_deg", "mass_kg"))}

    print(f"  {len(enrichments)} named records with at least one enrichable field")

    # Check against our existing spacecraft names
    try:
        repo_root = os.path.join(os.path.dirname(__file__), "..")
        sc_data   = json.load(open(os.path.join(repo_root, "data", "spacecrafts.json")))
        sc_names  = [normalise_name(s["name"]) for s in sc_data["spacecrafts"]]
        matched   = sum(1 for n in sc_names if n in enrichments)
        print(f"  {matched}/{len(sc_names)} spacecraft names matched in GCAT")
    except Exception:
        pass

    if dry_run:
        print("\n[DRY RUN] Output files NOT written.")
        sample_keys = list(enrichments.keys())[:5]
        for k in sample_keys:
            print(f"  {k}: {enrichments[k]}")
        return

    # Write enrichments
    out_path = os.path.join(OUT_DIR, "gcat_enrichments.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(enrichments, f, indent=2, ensure_ascii=False)
    print(f"\n  Written -> {out_path}")

    # Write meta
    meta = {
        "source":           "GCAT -- General Catalogue of Artificial Space Objects",
        "maintainer":       "Jonathan C. McDowell",
        "url":              "https://planet4589.org/space/gcat/",
        "license":          "CC BY 4.0",
        "downloaded_at":    datetime.now(timezone.utc).isoformat(),
        "satcat_url":       SATCAT_URL,
        "launch_url":       LAUNCH_URL if not no_launch else None,
        "indian_sat_count": len(indian_rows),
        "enrichment_count": len(enrichments),
    }
    meta_path = os.path.join(OUT_DIR, "gcat_meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"  Written -> {meta_path}")
    print("\n-- GCAT enrichment complete --")


if __name__ == "__main__":
    dry_run   = "--dry-run"   in sys.argv
    no_launch = "--no-launch" in sys.argv
    main(dry_run=dry_run, no_launch=no_launch)
