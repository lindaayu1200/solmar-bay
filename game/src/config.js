// config.js - every gameplay tunable for Solmar Bay in one frozen object: palette, districts, cars, weapons, missions.

/**
 * CONFIG - the single frozen object of all gameplay tunables. Nothing else may
 * define gameplay numbers; every system reads what it needs via ctx.config.
 * Colors are CSS hex strings; distances are meters; speeds are m/s.
 */
export const CONFIG = Object.freeze({

  // Sun-soaked late-afternoon palette: low warm sun, pink/orange sky, teal water.
  PALETTE: Object.freeze({
    skyTop: '#4a6bd8',       // deep warm blue overhead
    skyBottom: '#ffb36b',    // pink/orange near the horizon
    fog: '#ffd9a8',          // warm haze
    sun: '#ffdca8',          // low warm sun
    sand: '#f0d9a0',         // beach sand
    asphalt: '#3a3a3a',      // roads
    sidewalk: '#bfb39a',     // pavements
    water: '#3a9bbf',        // teal water
    buildingBase: [          // six warm sand-stucco variants
      '#e8c896', '#d9b67e', '#f0d7a8',
      '#dcc39a', '#cbaa7a', '#efcfa0',
    ],
    neon: ['#ff4b6b', '#35e0e8', '#ffc04b', '#9a4bff'], // accent neon
    palmGreen: '#3f8f4a',
    minimap: Object.freeze({
      road: '#333333',
      block: '#d9c39a',
      water: '#3a9bbf',
      sand: '#f0d9a0',
      marker: '#ff4b4b',
      player: '#ffffff',
      enemy: '#ff0000',
    }),
  }),

  // The five named districts of Solmar Bay; cx/cz are centers, radius reach.
  DISTRICTS: Object.freeze([
    Object.freeze({ name: 'Palm Row', cx: -120, cz: -60, radius: 160, accent: '#ffc04b', label: 'Downtown towers' }),
    Object.freeze({ name: 'Mar Vista Beach', cx: -320, cz: 80, radius: 140, accent: '#35e0e8', label: 'West strip' }),
    Object.freeze({ name: 'El Puerto', cx: 260, cz: -40, radius: 150, accent: '#9a4bff', label: 'Harbor' }),
    Object.freeze({ name: 'Sol Heights', cx: 60, cz: -300, radius: 130, accent: '#ff4b6b', label: 'North hills' }),
    Object.freeze({ name: 'The Shallows', cx: -40, cz: 300, radius: 120, accent: '#8f8f8f', label: 'South slums' }),
  ]),

  // City bounds in meters; water lies beyond the west edge and south harbor.
  CITY: Object.freeze({ min: -460, max: 460, waterWest: -420 }),

  // Seven original car archetypes (no real brands); rare is a spawn weight hint.
  CARS: Object.freeze([
    Object.freeze({ name: 'Cortez GT', w: 1.9, l: 4.4, h: 1.3, color: ['#d02020', '#2020d0'], maxSpeed: 38, accel: 11, grip: 0.98, mass: 1300, rare: true }),
    Object.freeze({ name: 'Vireo Sedan', w: 1.8, l: 4.6, h: 1.4, color: ['#888888', '#444444'], maxSpeed: 27, accel: 7, grip: 0.95, mass: 1450, rare: false }),
    Object.freeze({ name: 'Palmetto Pickup', w: 2.0, l: 5.0, h: 1.7, color: ['#6b8f3a', '#3a6b2a'], maxSpeed: 24, accel: 6, grip: 0.92, mass: 1700, rare: false }),
    Object.freeze({ name: 'Cabo Van', w: 2.1, l: 5.4, h: 2.0, color: ['#c8c8c8', '#3a9bbf'], maxSpeed: 22, accel: 5, grip: 0.90, mass: 1900, rare: false }),
    Object.freeze({ name: 'Manta Spyder', w: 1.9, l: 4.2, h: 1.1, color: ['#35e0e8', '#ff4b6b'], maxSpeed: 42, accel: 13, grip: 0.99, mass: 1150, rare: true }),
    Object.freeze({ name: 'Bulldog SUV', w: 2.0, l: 4.8, h: 1.8, color: ['#4a4a4a', '#6a4a2a'], maxSpeed: 23, accel: 6, grip: 0.91, mass: 1800, rare: false }),
    Object.freeze({ name: 'Sable Cruiser', w: 1.9, l: 4.7, h: 1.5, color: ['#222222', '#ffffff'], maxSpeed: 30, accel: 9, grip: 0.96, mass: 1600, rare: true }),
  ]),

  // Weapons: damage per hit, shots per second, spread, effective range, ammo, auto fire.
  WEAPONS: Object.freeze([
    Object.freeze({ name: 'Fist', damage: 8, rate: 2.5, spread: 0, range: 2, ammo: Infinity, auto: false }),
    Object.freeze({ name: 'Sidewalk .38', damage: 22, rate: 3, spread: 0.03, range: 60, ammo: 48, auto: false }),
    Object.freeze({ name: 'Cane Cutter', damage: 14, rate: 10, spread: 0.09, range: 40, ammo: 240, auto: true }),
    Object.freeze({ name: 'Buoy 12', damage: 34, rate: 1.6, spread: 0.14, range: 26, ammo: 32, auto: false }),
  ]),

  // Seven story missions in narrative order with original characters and payouts.
  MISSIONS: Object.freeze([
    Object.freeze({ id: 0, title: 'First Rung', giver: 'Marisol Vega', brief: 'Prove yourself: meet Vega at the docks and take a parked truck to the impound lot.', type: 'goto', reward: 400, district: 'El Puerto' }),
    Object.freeze({ id: 1, title: 'Hot Plate', giver: 'Tito Ferrer', brief: 'Steal a Cortez GT from the beach strip for Tito without alerting the cops.', type: 'steal', reward: 700, district: 'Mar Vista Beach' }),
    Object.freeze({ id: 2, title: 'Payback Run', giver: 'Don Abel Cazares', brief: 'Deliver a shipment to The Shallows and collect a debt on the way back.', type: 'deliver', reward: 900, district: 'The Shallows' }),
    Object.freeze({ id: 3, title: 'Tail Light', giver: 'Marisol Vega', brief: 'Chase down a courier who skimmed Vega and recover the briefcase.', type: 'chase', reward: 1200, district: 'Palm Row' }),
    Object.freeze({ id: 4, title: 'Block Party', giver: 'Tito Ferrer', brief: 'Hold off the rival crew Los Chacales who are muscling in on Sol Heights.', type: 'wave', reward: 1500, district: 'Sol Heights' }),
  ]),
});

// config-CHUNK-2-PLACEHOLDER