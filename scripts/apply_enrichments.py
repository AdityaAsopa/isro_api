#!/usr/bin/env python3
"""
apply_enrichments.py
--------------------
Merges data/supplements/*_enrichments.json into the main data files.

Rules
-----
  1. Only fills fields that are null, missing, or "unknown" in the scraped data.
     Existing values are NEVER overwritten.
  2. Each enriched field gets a corresponding entry in the record's _sources dict
     recording which supplement contributed it.
  3. Source priority (first match wins when multiple supplements have a value):
       Wikipedia  →  GCAT
     Wikipedia is preferred for mission-description fields (mass, orbit, status).
     GCAT is authoritative for orbital mechanics (perigee, apogee, inclination).
  4. Writes enriched JSON back to data/ in-place (originals backed up to
     data/supplements/backup/ if --backup flag is used).

Usage
-----
  python scripts/apply_enrichments.py [--dry-run] [--backup]

Flags
-----
  --dry-run   Print what would change without writing any files.
  --backup    Copy current data/*.json to data/supplements/backup/ before writing.
"""

import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone

REPO_ROOT  = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR   = os.path.join(REPO_ROOT, "data")
SUPP_DIR   = os.path.join(DATA_DIR, "supplements")
BACKUP_DIR = os.path.join(SUPP_DIR, "backup")

# Which data file  →  which array key  →  fields we enrich
TARGETS = {
    "spacecrafts.json": {
        "key": "spacecrafts",
        "fields": ["launch_date", "launch_vehicle", "orbit_type", "status",
                   "mass_kg", "altitude_km", "inclination_deg"],
    },
    "spacecraft_missions.json": {
        "key": "spacecraft_missions",
        "fields": ["launch_date", "launch_vehicle", "orbit_type", "status",
                   "mass_kg", "altitude_km", "inclination_deg", "mission_life"],
    },
}

# Source priority: first wins for mission-description fields;
# GCAT wins for orbital mechanics fields.
SOURCES_PRIORITY = ["wikipedia", "gcat"]
GCAT_PREFERRED   = {"altitude_km", "perigee_km", "apogee_km", "inclination_deg"}

# ── Helpers ───────────────────────────────────────────────────────────────────

def normalise_name(s):
    if not s:
        return ""
    return re.sub(r"[\s\-_]+", " ", s.lower().strip())


def is_empty(val):
    """True if the value should be considered missing/unknown."""
    if val is None:
        return True
    if isinstance(val, str) and val.strip().lower() in ("", "unknown", "null", "n/a", "?"):
        return True
    return False


def load_supplement(name):
    path = os.path.join(SUPP_DIR, f"{name}_enrichments.json")
    if not os.path.exists(path):
        print(f"  [WARNING] {path} not found — run enrich_from_{name}.py first")
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def best_value(norm_name, field, supplements):
    """
    Return (value, source_name) for the best available supplement value,
    respecting GCAT_PREFERRED priority for orbital fields.
    """
    order = (["gcat", "wikipedia"] if field in GCAT_PREFERRED
             else ["wikipedia", "gcat"])
    for src in order:
        data = supplements.get(src, {})
        rec  = data.get(norm_name)
        if rec is None:
            continue
        val = rec.get(field)
        if not is_empty(val):
            return val, src
    return None, None


# ── Main ──────────────────────────────────────────────────────────────────────

def main(dry_run=False, backup=False):
    print("── apply_enrichments ────────────────────────────────────────────")

    # Load supplements
    supplements = {}
    for src in SOURCES_PRIORITY:
        supplements[src] = load_supplement(src)
        print(f"  Loaded {src}: {len(supplements[src])} named records")

    if not any(supplements.values()):
        print("\n  No supplement data found. Run the enrichment scripts first:")
        print("    python scripts/enrich_from_gcat.py")
        print("    python scripts/enrich_from_wikipedia.py")
        return

    # Optional backup
    if backup and not dry_run:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        for fname in TARGETS:
            src_path = os.path.join(DATA_DIR, fname)
            if os.path.exists(src_path):
                dst = os.path.join(BACKUP_DIR, f"{ts}_{fname}")
                shutil.copy2(src_path, dst)
                print(f"  Backed up {fname} → {dst}")

    total_records = 0
    total_fields_filled = 0

    for fname, config in TARGETS.items():
        path = os.path.join(DATA_DIR, fname)
        if not os.path.exists(path):
            print(f"\n  [SKIP] {fname} not found")
            continue

        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        array_key = config["key"]
        records   = data[array_key]
        fields    = config["fields"]

        file_fills = 0
        print(f"\n  {fname}  ({len(records)} records, enriching {len(fields)} fields)")

        for rec in records:
            name      = rec.get("name", "")
            norm_name = normalise_name(name)
            rec_fills = {}

            for field in fields:
                if not is_empty(rec.get(field)):
                    continue   # field already has data

                val, source = best_value(norm_name, field, supplements)
                if val is None:
                    continue

                rec_fills[field] = (val, source)

            if rec_fills:
                if dry_run:
                    fills_str = ", ".join(f"{f}={v!r} (from {s})"
                                          for f, (v, s) in rec_fills.items())
                    print(f"    [{rec.get('id','')}] {name}: {fills_str}")
                else:
                    for field, (val, source) in rec_fills.items():
                        rec[field] = val
                        # Track provenance
                        if "_sources" not in rec:
                            rec["_sources"] = {}
                        rec["_sources"][field] = source

                file_fills += len(rec_fills)
                total_fields_filled += len(rec_fills)

        total_records += len(records)
        print(f"    → {file_fills} field(s) filled across {fname}")

        if not dry_run:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"    ✓ Written → {path}")

    print(f"\n── Summary ──────────────────────────────────────────────────────")
    print(f"  Records processed : {total_records}")
    print(f"  Fields filled     : {total_fields_filled}")
    if dry_run:
        print("  [DRY RUN] No files were modified.")
    else:
        print("  ✓ Data files updated with enrichments + _sources provenance.")

    print()
    print("  Attribution required by CC BY-SA 3.0 (Wikipedia) and CC BY 4.0 (GCAT).")
    print("  See data/supplements/README.md for full source details.")
    print("── done ─────────────────────────────────────────────────────────")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    backup  = "--backup"  in sys.argv
    main(dry_run=dry_run, backup=backup)
