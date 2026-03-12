/**
 * GET /api/search?q=chandrayaan
 *
 * Full-text search across all five ISRO data collections.
 * Case-insensitive substring match on name and key descriptive fields.
 *
 * Query params:
 *   ?q=chandrayaan               — required search term
 *   ?collection=spacecrafts      — optional: limit to one collection
 *     (spacecrafts | spacecraft_missions | customer_satellites | launchers | centres)
 *
 * Response:
 * {
 *   "query": "chandrayaan",
 *   "count": 3,
 *   "results": [
 *     { "collection": "spacecrafts", "id": 68, "name": "Chandrayaan-1",
 *       "match_field": "name", ...record }
 *   ]
 * }
 */

const spacecraftsData = require("../data/spacecrafts.json");
const missionsData = require("../data/spacecraft_missions.json");
const customerSatellitesData = require("../data/customer_satellites.json");
const launchersData = require("../data/launchers.json");
const centresData = require("../data/centres.json");

// Fields to search per collection (in priority order — first match wins for match_field)
const SEARCH_TARGETS = {
  spacecrafts: ["name", "orbit_type", "status"],
  spacecraft_missions: ["name", "mission_type", "orbit_type", "payloads", "launch_site"],
  customer_satellites: ["id", "country", "launcher"],
  launchers: ["id", "vehicle_family"],
  centres: ["name", "place", "state"],
};

function searchCollection(records, collectionKey, term) {
  const fields = SEARCH_TARGETS[collectionKey];
  const results = [];

  for (const record of records) {
    let matchField = null;
    for (const field of fields) {
      const val = record[field];
      if (val && typeof val === "string" && val.toLowerCase().includes(term)) {
        matchField = field;
        break;
      }
    }
    if (matchField) {
      results.push({
        collection: collectionKey,
        id: record.id,
        name: record.name || record.id,
        match_field: matchField,
        ...record,
      });
    }
  }
  return results;
}

const COLLECTIONS = {
  spacecrafts: spacecraftsData.spacecrafts,
  spacecraft_missions: missionsData.spacecraft_missions,
  customer_satellites: customerSatellitesData.customer_satellites,
  launchers: launchersData.launchers,
  centres: centresData.centres,
};

module.exports = async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json");
    const { q, collection } = req.query;

    if (!q || q.trim().length === 0) {
      res.status(400);
      res.send({ error: "Missing required query parameter: q" });
      return;
    }

    const term = q.trim().toLowerCase();

    if (collection && !COLLECTIONS[collection]) {
      res.status(400);
      res.send({
        error: `Unknown collection '${collection}'. Valid values: ${Object.keys(COLLECTIONS).join(", ")}`,
      });
      return;
    }

    const collectionsToSearch = collection
      ? { [collection]: COLLECTIONS[collection] }
      : COLLECTIONS;

    let results = [];
    for (const [key, records] of Object.entries(collectionsToSearch)) {
      results = results.concat(searchCollection(records, key, term));
    }

    res.send({
      query: q.trim(),
      count: results.length,
      results,
    });
  } catch (error) {
    res.status(500);
    res.send({ error: error.message });
  }
};
