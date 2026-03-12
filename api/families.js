/**
 * GET /api/families
 * GET /api/families?name=INSAT
 *
 * Groups ISRO spacecraft into named satellite families based on
 * name-pattern matching. Each family represents an evolutionary series.
 *
 * Query params:
 *   ?name=INSAT — return members of a specific family (case-insensitive)
 */

const spacecraftsData = require("../data/spacecrafts.json");

// Family definitions: order matters — first match wins.
// Each entry: { id, label, description, test(name) }
const FAMILY_DEFS = [
  {
    id: "INSAT",
    label: "INSAT",
    description:
      "Indian National Satellite System — multipurpose geostationary communication & meteorology series (1982–present)",
    test: (n) => /^insat-/i.test(n),
  },
  {
    id: "KALPANA",
    label: "KALPANA",
    description:
      "Meteorological satellites (originally METSAT); named after Kalpana Chawla",
    test: (n) => /^kalpana/i.test(n) || /^metsat/i.test(n) || /^cms-/i.test(n),
  },
  {
    id: "GSAT",
    label: "GSAT",
    description:
      "Geostationary communication satellites for DTH, broadband, and strategic communication (2001–present)",
    test: (n) => /^gsat-/i.test(n),
  },
  {
    id: "IRS",
    label: "IRS",
    description:
      "Indian Remote Sensing satellite series — Earth observation for agriculture, forestry, and disaster management (1988–present)",
    test: (n) => /^irs-/i.test(n),
  },
  {
    id: "RESOURCESAT",
    label: "Resourcesat",
    description:
      "Natural resource monitoring continuation of IRS-P6; multi-spectral imagers for land use (2003–present)",
    test: (n) => /resourcesat/i.test(n),
  },
  {
    id: "CARTOSAT",
    label: "Cartosat",
    description:
      "High-resolution cartographic imaging series for topographic mapping and urban planning (2005–present)",
    test: (n) => /cartosat/i.test(n),
  },
  {
    id: "RISAT",
    label: "RISAT",
    description:
      "Radar Imaging Satellite series — all-weather, day-night synthetic aperture radar (2012–present)",
    test: (n) => /^risat-/i.test(n),
  },
  {
    id: "OCEANSAT",
    label: "Oceansat",
    description:
      "Ocean Colour Monitor and Ku-band scatterometer satellites for oceanographic studies",
    test: (n) => /oceansat/i.test(n),
  },
  {
    id: "IRNSS",
    label: "IRNSS / NavIC",
    description:
      "Indian Regional Navigation Satellite System — 7-satellite regional positioning constellation (2013–present)",
    test: (n) => /^irnss-/i.test(n),
  },
  {
    id: "CHANDRAYAAN",
    label: "Chandrayaan",
    description:
      "Lunar exploration missions — India's programme to study the Moon's surface, mineralogy, and water ice",
    test: (n) => /chandrayaan/i.test(n),
  },
  {
    id: "EOS",
    label: "EOS",
    description:
      "Earth Observation Satellites — successor branding to IRS/Cartosat series (2020–present)",
    test: (n) => /^eos-/i.test(n),
  },
  {
    id: "ROHINI",
    label: "Rohini",
    description:
      "India's first indigenous experimental satellites, launched by SLV-3 (1980–1983)",
    test: (n) => /^rohini/i.test(n),
  },
  {
    id: "SROSS",
    label: "SROSS",
    description:
      "Stretched Rohini Satellite Series — scientific and remote sensing technology demonstrators (1987–1999)",
    test: (n) => /^sross/i.test(n),
  },
  {
    id: "BHASKARA",
    label: "Bhaskara",
    description:
      "India's first experimental remote sensing satellites (1979–1981)",
    test: (n) => /^bhaskara/i.test(n),
  },
  {
    id: "INS",
    label: "INS (NanoSat)",
    description:
      "ISRO Nano Satellite series — small student/experimental payloads (2017–present)",
    test: (n) => /^ins-1/i.test(n),
  },
  {
    id: "MICROSAT",
    label: "Microsat",
    description:
      "Micro-satellite technology demonstrators for reconnaissance and sub-metre imaging",
    test: (n) => /^microsat/i.test(n),
  },
  {
    id: "GISAT",
    label: "GISAT",
    description:
      "Geostationary Imaging Satellites for near-real-time Earth observation",
    test: (n) => /^gisat/i.test(n),
  },
];

function classifySpacecrafts() {
  const families = {};

  for (const def of FAMILY_DEFS) {
    families[def.id] = {
      id: def.id,
      label: def.label,
      description: def.description,
      count: 0,
      members: [],
    };
  }

  for (const s of spacecraftsData.spacecrafts) {
    const name = s.name || "";
    for (const def of FAMILY_DEFS) {
      if (def.test(name)) {
        families[def.id].members.push(s);
        families[def.id].count += 1;
        break;
      }
    }
  }

  // Sort members within each family chronologically
  for (const fam of Object.values(families)) {
    fam.members.sort((a, b) => {
      const da = a.launch_date || "9999";
      const db = b.launch_date || "9999";
      return da.localeCompare(db);
    });
  }

  return families;
}

const FAMILIES = classifySpacecrafts();

module.exports = async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json");
    const { name } = req.query;

    if (name) {
      const key = Object.keys(FAMILIES).find(
        (k) => k.toLowerCase() === name.toLowerCase()
      );
      if (!key) {
        res.status(404);
        res.send({ error: `Family '${name}' not found` });
        return;
      }
      const fam = FAMILIES[key];
      res.send({
        id: fam.id,
        label: fam.label,
        description: fam.description,
        count: fam.count,
        members: fam.members,
      });
    } else {
      // Return summary list (no members arrays to keep it lightweight)
      const list = Object.values(FAMILIES)
        .filter((f) => f.count > 0)
        .sort((a, b) => b.count - a.count)
        .map(({ id, label, description, count }) => ({
          id,
          label,
          description,
          count,
          _links: { self: `/api/families?name=${id}` },
        }));

      res.send({
        count: list.length,
        families: list,
      });
    }
  } catch (error) {
    res.status(500);
    res.send({ error: error.message });
  }
};
