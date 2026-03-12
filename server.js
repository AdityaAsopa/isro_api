const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Serve static files (index.html, style.css, etc.)
app.use(express.static(__dirname));

// Import API handler functions
const spacecrafts = require('./api/spacecrafts.js');
const launchers = require('./api/launchers.js');
const customerSatellites = require('./api/customer_satellites.js');
const centres = require('./api/centres.js');
const spacecraftMissions = require('./api/spacecraft_missions.js');
const stats = require('./api/stats.js');
const health = require('./api/health.js');
const families = require('./api/families.js');
const launches = require('./api/launches.js');
const timeline = require('./api/timeline.js');
const search = require('./api/search.js');

// Helper to wrap Vercel-style handlers for Express
function wrapHandler(handler) {
  return async (req, res) => {
    try {
      // Create a Vercel-compatible response wrapper
      let statusCode = 200;
      const mockRes = {
        setHeader: (key, value) => res.setHeader(key, value),
        status: (code) => {
          statusCode = code;
          return mockRes; // Return mockRes for potential chaining
        },
        send: (data) => {
          res.status(statusCode);
          if (typeof data === 'object') {
            res.json(data);
          } else {
            res.send(data);
          }
        },
        json: (data) => {
          res.status(statusCode).json(data);
        }
      };
      await handler(req, mockRes);
    } catch (error) {
      console.error('API Error:', error);
      res.status(500).json({ error: error.message });
    }
  };
}

// API Routes
app.get('/api', wrapHandler(require('./api/index.js')));
app.get('/api/spacecrafts', wrapHandler(spacecrafts));
app.get('/api/spacecrafts/:id', wrapHandler(spacecrafts));
app.get('/api/launchers', wrapHandler(launchers));
app.get('/api/launchers/:id', wrapHandler(launchers));
app.get('/api/customer_satellites', wrapHandler(customerSatellites));
app.get('/api/customer_satellites/:id', wrapHandler(customerSatellites));
app.get('/api/centres', wrapHandler(centres));
app.get('/api/centres/:id', wrapHandler(centres));
app.get('/api/spacecraft_missions', wrapHandler(spacecraftMissions));
app.get('/api/spacecraft_missions/:id', wrapHandler(spacecraftMissions));
app.get('/api/stats', wrapHandler(stats));
app.get('/api/health', wrapHandler(health));
app.get('/api/families', wrapHandler(families));
app.get('/api/launches', wrapHandler(launches));
app.get('/api/timeline', wrapHandler(timeline));
app.get('/api/search', wrapHandler(search));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ISRO API Server running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 API Docs: http://localhost:${PORT}/api`);
});
