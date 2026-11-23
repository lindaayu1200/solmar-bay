// src/config.js — all tunables: palette, districts, car/weapon tables, mission names.

/** Central frozen config object: every gameplay tunable lives here. */
export const CONFIG = Object.freeze({

  // Sun-soaked late-afternoon palette.
  PALETTE: Object.freeze({
    skyTop: 0x2a3a6b,          // deep warm blue overhead
    skyBottom: 0xffb36b,       // pink/orange near horizon
    fog: 0xffd9a8,             // warm haze
    sun: 0xffdca8,             // low warm sun
    sand: 0xf0d9a0,            // beach sand
    asphalt: 0x3a3a3a,         // roads
    sidewalk: 0xbfb39a,        // pavements
    water: 0x3a9bbf,           // teal water
    buildings: [0xe8c896, 0xd9b67e, 0xf0d7a8, 0xdcc39a, 0xcbaa7a, 0xefcfa0], // warm sand variants
    neon: [0xff4b6b, 0x35e0e8, 0xffc04b, 0x9a4bff], // accent neon
    palmGreen: 0x3f8f4a,
    minimap: Object.freeze({
      road: 0x333333,
      block: 0xd9c39a,
      water: 0x3a9bbf,
      sand: 0xf0d9a0,
      marker: 0xff4b4b,
      player: 0xffffff,
      enemy: 0xff0000,
    }),
  }),

  // Four named districts plus southern slums.
  DISTRICTS: Object.freeze([
    Object.freeze({ name: 'Palm Row', cx: -120, cz: -60, radius: 160, accent: 0xffc04b, label: 'Downtown towers' }),
    Object.freeze({ name: 'Mar Vista Beach', cx: -320, cz: 80, radius: 140, accent: 0x35e0e8, label: 'West strip' }),
    Object.freeze({ name: 'El Puerto', cx: 260, cz: -40, radius: 150, accent: 0x9a4bff, label: 'Harbor' }),
    Object.freeze({ name: 'Sol Heights', cx: 60, cz: -300, radius: 130, accent: 0xff4b6b, label: 'North hills' }),
    Object.freeze({ name: 'The Shallows', cx: -40, cz: 300, radius: 120, accent: 0x8f8f8f, label: 'South slums' }),
  ]),

  // City bounds.
  CITY: Object.freeze({ min: -460, max: 460 }),

  // 7 original car archetypes.
  CARS: Object.freeze([
    Object.freeze({ name: 'Cortez GT', w: 1.9, l: 4.4, h: 1.3, color: [0xd02020, 0x2020d0], maxSpeed: 38, accel: 11, grip: 0.98, mass: 1300, rare: true }),
    Object.freeze({ name: 'Vireo Sedan', w: 1.8, l: 4.6, h: 1.4, color: [0x888888, 0x444444], maxSpeed: 27, accel: 7, grip: 0.95, mass: 1450, rare: false }),
    Object.freeze({ name: 'Palmetto Pickup', w: 2.0, l: 5.0, h: 1.7, color: [0x6b8f3a, 0x3a6b2a], maxSpeed: 24, accel: 6, grip: 0.92, mass: 1700, rare: false }),
    Object.freeze({ name: 'Cabo Van', w: 2.1, l: 5.4, h: 2.0, color: [0xc8c8c8, 0x3a9bbf], maxSpeed: 22, accel: 5, grip: 0.90, mass: 1900, rare: false }),
    Object.freeze({ name: 'Manta Spyder', w: 1.9, l: 4.2, h: 1.1, color: [0x35e0e8, 0xff4b6b], maxSpeed: 42, accel: 13, grip: 0.99, mass: 1150, rare: true }),
    Object.freeze({ name: 'Bulldog SUV', w: 2.0, l: 4.8, h: 1.8, color: [0x4a4a4a, 0x6a4a2a], maxSpeed: 23, accel: 6, grip: 0.91, mass: 1800, rare: false }),
    Object.freeze({ name: 'Sable Cruiser', w: 1.9, l: 4.7, h: 1.5, color: [0x222222, 0xffffff], maxSpeed: 30, accel: 9, grip: 0.96, mass: 1600, rare: true }),
  ]),

  // Weapons.
  WEAPONS: Object.freeze([
    Object.freeze({ name: 'Fist', damage: 8, rate: 2.5, spread: 0, range: 2, ammo: Infinity, auto: false }),
    Object.freeze({ name: 'Sidewalk .38', damage: 22, rate: 3, spread: 0.03, range: 60, ammo: 48, auto: false }),
    Object.freeze({ name: 'Cane Cutter', damage: 14, rate: 10, spread: 0.09, range: 40, ammo: 240, auto: true }),
    Object.freeze({ name: 'Buoy 12', damage: 34, rate: 1.6, spread: 0.14, range: 26, ammo: 32, auto: false }),
  ]),

  // 7 story missions with original characters.
  MISSIONS: Object.freeze([
    Object.freeze({ id: 0, title: 'First Rung', giver: 'Marisol Vega', brief: 'Prove yourself: meet Vega at the docks and take a parked truck to the impound lot.', type: 'goto', reward: 400, district: 'El Puerto' }),
    Object.freeze({ id: 1, title: 'Hot Plate', giver: 'Tito Ferrer', brief: 'Steal a Cortez GT from the beach strip for Tito without alerting the cops.', type: 'steal', reward: 700, district: 'Mar Vista Beach' }),
    Object.freeze({ id: 2, title: 'Payback Run', giver: 'Don Abel Cazares', brief: 'Deliver a shipment to The Shallows and collect a debt on the way back.', type: 'deliver', reward: 900, district: 'The Shallows' }),
    Object.freeze({ id: 3, title: 'Tail Light', giver: 'Marisol Vega', brief: 'Chase down a courier who skimmed Vega and recover the briefcase.', type: 'chase', reward: 1200, district: 'Palm Row' }),
    Object.freeze({ id: 4, title: 'Block Party', giver: 'Tito Ferrer', brief: 'Hold off a rival crew that is muscling in on our turf at Sol Heights.', type: 'wave', reward: 1500, district: 'Sol Heights' }),
    Object.freeze({ id: 5, title: 'Coast Clear', giver: 'Don Abel Cazares', brief: 'Lose a three-star heat and lay low off the west beach while the heat cools.', type: 'escape', reward: 1800, district: 'Mar Vista Beach' }),
    Object.freeze({ id: 6, title: 'Bay Sunset', giver: 'Marisol Vega', brief: 'Final score: crash the rival meet at the harbor and walk out with the whole take.', type: 'finale', reward: 4000, district: 'El Puerto' }),
  ]),

  // Police / wanted levels.
  POLICE: Object.freeze({
    spawnCounts: [0, 1, 2, 3, 4, 5],
    helicopterAt: 3,
    bustRadius: 8,
    cooldown: [0, 0, 6, 9, 12, 15],
  }),

  // Player tuning.
  PLAYER: Object.freeze({
    walkSpeed: 4,
    runSpeed: 7.5,
    health: 100,
    armorCap: 100,
    fallDamage: 6,
    camThirdDist: 6,
    camThirdHeight: 2.2,
  }),

  // Simulation counts and timing.
  SIM: Object.freeze({
    trafficCount: 22,
    pedCount: 40,
    despawnRadius: 320,
    spawnRadius: 260,
    dayLength: 600,
    sunStartAngle: 0.28, // late-afternoon low sun
  }),
});

// config-CHUNK-2-PLACEHOLDER