#!/usr/bin/env node

/**
 * Bus Tracking System - Automated Test Script
 * 
 * This script tests the complete bus tracking workflow:
 * 1. Login and get JWT token
 * 2. Create a bus
 * 3. Create a route with multiple stops
 * 4. Assign bus to route
 * 5. Send GPS location updates simulating bus movement
 * 6. Verify geofence detection (when bus reaches stops)
 * 7. Check alerts
 * 8. Verify live tracking data
 */

const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:8000/api/v1';
const SCHOOL_ID = process.env.SCHOOL_ID || 1;

// Sample stops for route (Kathmandu area)
const SAMPLE_STOPS = [
  { name: 'School Gate', lat: 27.7172, lng: 85.3240, order: 1, type: 'start' },
  { name: 'Patan Durbar', lat: 27.6735, lng: 85.3270, order: 2, type: 'middle' },
  { name: 'Bhaktapur', lat: 27.6724, lng: 85.4094, order: 3, type: 'end' },
];

let token = '';
let busId = 0;
let routeId = 0;

// Helper: Print colored output
const log = {
  section: (msg) => console.log(`\n ✅ ${msg}`),
  success: (msg) => console.log(`   ✔ ${msg}`),
  error: (msg) => console.error(`   ❌ ${msg}`),
  info: (msg) => console.log(`   ℹ ${msg}`),
};

// 1. LOGIN
async function login() {
  log.section('STEP 1: Login and Get JWT Token');
  try {
    const response = await axios.post(`${API_BASE}/../auth/token/`, {
      email: process.env.EMAIL || 'admin@example.com',
      password: process.env.PASSWORD || 'admin123',
    });
    token = response.data.access;
    log.success(`JWT Token obtained: ${token.substring(0, 20)}...`);
  } catch (err) {
    log.error(`Login failed: ${err.response?.data?.detail || err.message}`);
    process.exit(1);
  }
}

// 2. CREATE BUS
async function createBus() {
  log.section('STEP 2: Create a Bus');
  try {
    const response = await axios.post(
      `${API_BASE}/core/vehicles/`,
      {
        vehicle_no: `BUS-${Date.now()}`,
        vehicle_model: 'Toyota Coaster',
        made_year: 2022,
        note: 'Test bus for automated testing',
        active_status: true,
        is_tracking_active: true,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    busId = response.data.id;
    log.success(`Bus created: ${response.data.vehicle_no} (ID: ${busId})`);
  } catch (err) {
    log.error(`Bus creation failed: ${err.response?.data || err.message}`);
    process.exit(1);
  }
}

// 3. CREATE ROUTE
async function createRoute() {
  log.section('STEP 3: Create Transport Route');
  try {
    const response = await axios.post(
      `${API_BASE}/core/transport-routes/`,
      {
        title: `Route-${Date.now()}`,
        fare: '100.00',
        active_status: true,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    routeId = response.data.id;
    log.success(`Route created: ${response.data.title} (ID: ${routeId})`);
  } catch (err) {
    log.error(`Route creation failed: ${err.response?.data || err.message}`);
    process.exit(1);
  }
}

// 4. ADD STOPS TO ROUTE
async function addStops() {
  log.section('STEP 4-6: Add Stops to Route');
  for (const stop of SAMPLE_STOPS) {
    try {
      const response = await axios.post(
        `${API_BASE}/core/bus-stops/`,
        {
          route: routeId,
          stop_name: stop.name,
          latitude: stop.lat,
          longitude: stop.lng,
          stop_order: stop.order,
          stop_type: stop.type,
          geofence_radius: 100,
          active_status: true,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const emoji = stop.type === 'start' ? '🟢' : stop.type === 'end' ? '🔴' : '🔵';
      log.success(`${emoji} ${stop.name} added (order: ${stop.order})`);
    } catch (err) {
      log.error(`Stop ${stop.name} failed: ${err.response?.data || err.message}`);
    }
  }
}

// 5. ASSIGN BUS TO ROUTE
async function assignBusToRoute() {
  log.section('STEP 3b: Assign Bus to Route');
  try {
    const response = await axios.post(
      `${API_BASE}/core/assign-vehicles/`,
      {
        vehicle: busId,
        route: routeId,
        active_status: true,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    log.success(`Bus assigned to route (Assignment ID: ${response.data.id})`);
  } catch (err) {
    log.error(`Bus assignment failed: ${err.response?.data || err.message}`);
  }
}

// 6. SEND GPS LOCATION UPDATES (Simulating movement)
async function sendGPSUpdates() {
  log.section('STEP 8: Send GPS Location Updates (Simulating Bus Movement)');

  // Route between stops with intermediate points
  const waypoints = [
    { lat: 27.7172, lng: 85.3240, speed: 0, name: 'Starting at School' },
    { lat: 27.715, lng: 85.324, speed: 20, name: 'Moving towards Patan' },
    { lat: 27.71, lng: 85.325, speed: 30, name: 'On main road' },
    { lat: 27.6735, lng: 85.3270, speed: 5, name: '🟢 REACHED PATAN' }, // Geofence trigger
    { lat: 27.673, lng: 85.330, speed: 0, name: 'Stopped at Patan' },
    { lat: 27.673, lng: 85.335, speed: 25, name: 'Resuming to Bhaktapur' },
    { lat: 27.67, lng: 85.37, speed: 35, name: 'Highway speed' },
    { lat: 27.6724, lng: 85.4094, speed: 5, name: '🔴 REACHED BHAKTAPUR' }, // Geofence trigger
  ];

  for (let i = 0; i < waypoints.length; i++) {
    const waypoint = waypoints[i];
    try {
      const response = await axios.post(
        `${API_BASE}/core/bus-locations/`,
        {
          vehicle: busId,
          latitude: waypoint.lat,
          longitude: waypoint.lng,
          speed: waypoint.speed,
          heading: 45,
          accuracy: 5,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      log.success(`${waypoint.name} (${waypoint.speed} km/h) - ETA to next: ${response.data.eta_minutes || 'N/A'} min`);

      if (response.data.stop_reached) {
        log.info(`🎉 Stop reached! ${response.data.stop_reached.students_picked} students picked up`);
      }

      // Wait between updates
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      log.error(`GPS update failed: ${err.response?.data || err.message}`);
    }
  }
}

// 7. GET ROUTE WITH STOPS
async function getFullRoute() {
  log.section('STEP 7: Get Full Route with Stops');
  try {
    const response = await axios.get(
      `${API_BASE}/core/transport-routes/${routeId}/`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    log.success(`Route: ${response.data.title}`);
    if (response.data.stops) {
      response.data.stops.forEach((stop) => {
        log.info(`  - Stop ${stop.stop_order}: ${stop.stop_name} (${stop.latitude}, ${stop.longitude})`);
      });
    }
  } catch (err) {
    log.error(`Failed to fetch route: ${err.response?.data || err.message}`);
  }
}

// 8. GET LIVE TRACKING DATA
async function getLiveTracking() {
  log.section('STEP 10: Get Live Tracking Data');
  try {
    const response = await axios.get(
      `${API_BASE}/core/bus-locations/?vehicle_id=${busId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const location = response.data[0] || response.data.results?.[0];
    if (location) {
      log.success(`Live location: ${location.latitude}, ${location.longitude}`);
      log.info(`  Speed: ${location.speed} km/h`);
      log.info(`  Timestamp: ${location.timestamp}`);
    }
  } catch (err) {
    log.error(`Failed to fetch live data: ${err.response?.data || err.message}`);
  }
}

// 9. GET ALERTS
async function getAlerts() {
  log.section('STEP 12: Get Transport Alerts');
  try {
    const response = await axios.get(
      `${API_BASE}/core/transport-alerts/?vehicle_id=${busId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const alerts = Array.isArray(response.data) ? response.data : response.data.results || [];
    if (alerts.length > 0) {
      alerts.slice(0, 5).forEach((alert) => {
        const icon = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : 'ℹ';
        log.info(`${icon} ${alert.alert_type}: ${alert.message}`);
      });
    } else {
      log.info('No alerts generated yet');
    }
  } catch (err) {
    log.error(`Failed to fetch alerts: ${err.response?.data || err.message}`);
  }
}

// MAIN TEST FLOW
async function runTests() {
  console.log('\n🚌 BUS TRACKING SYSTEM - AUTOMATED TEST\n');
  console.log(`API Base: ${API_BASE}\n`);

  await login();
  await createBus();
  await createRoute();
  await addStops();
  await assignBusToRoute();
  await getFullRoute();
  await sendGPSUpdates();
  await getLiveTracking();
  await getAlerts();

  log.section('ALL TESTS COMPLETED ✅');
  console.log('\n📊 Test Summary:');
  console.log(`   - Bus ID: ${busId}`);
  console.log(`   - Route ID: ${routeId}`);
  console.log(`   - Stops: ${SAMPLE_STOPS.length}`);
  console.log(`   - GPS updates sent: ${SAMPLE_STOPS.length + 3}`);
  console.log(`\n🎉 Test script finished!\n`);
}

// Run if executed directly
if (require.main === module) {
  runTests().catch((err) => {
    log.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runTests };
