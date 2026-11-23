// config.js - every gameplay tunable for Solmar Bay: palette, districts, cars, weapons, missions.

/**
 * PALETTE - sun-soaked late-afternoon color scheme; all hexes are CSS strings.
 */
const PALETTE = {
  skyTop: '#e8865a',
  skyBottom: '#f7c9a4',
  fog: '#f0c9b0',
  sun: '#ffcf8a',
  sand: '#e8d3a7',
  asphalt: '#4a4744',
  sidewalk: '#c9c2b2',
  water: '#2c8f96',
  buildingBase: ['#e6cfa6', '#dfc18e', '#f0d9b8', '#d9b98c', '#e8d4ac', '#f3e0c2'],
  neon: ['#ff5fa2', '#ffd166', '#4dd0e1', '#ff8f5e'],
  palmGreen: '#5e9c52',
  minimapRoad: '#8d8574',
  minimapWater: '#2c8f96',
  minimapPlayer: '#ff5fa2',
  minimapPolice: '#4dd0e1'
};

/**
 * DISTRICTS - the five named neighborhoods of Solmar Bay with accents and labels.
 */
const DISTRICTS = [
  { name: 'Palm Row', cx: -120, cz: -60, radius: 150, accent: '#ff5fa2', label: 'Downtown towers' },
  { name: 'Mar Vista Beach', cx: -320, cz: 80, radius: 140, accent: '#ffd166', label: 'West beach strip' },
  { name: 'El Puerto', cx: 260, cz: -40, radius: 150, accent: '#4dd0e1', label: 'East harbor docks' },
  { name: 'Sol Heights', cx: 60, cz: -300, radius: 130, accent: '#ff8f5e', label: 'North hill homes' },
  { name: 'The Shallows', cx: -40, cz: 300, radius: 130, accent: '#e8865a', label: 'South low blocks' }
];

/**
 * CITY - geometry and bounds of the playable city.
 */
const CITY = {
  bounds: { min: -460, max: 460 },
  roadSpacing: 60,
  roadWidth: 10,
  sidewalkWidth: 3,
  waterWestEdge: -420,
  waterLevel: 0
};

/**
 * CARS - seven original archetypes; w/l/h in meters, speeds in m/s, rare is spawn weight hint.
 */
const CARS = [
  { name: 'Cortez GT', w: 1.9, l: 4.3, h: 1.2, color: ['#d9534f', '#f2c14e'], maxSpeed: 34, accel: 12, grip: 0.82, mass: 1200, rare: 0.10 },
  { name: 'Vireo Sedan', w: 1.8, l: 4.5, h: 1.4, color: ['#e6cfa6', '#7f9fb4'], maxSpeed: 27, accel: 8, grip: 0.75, mass: 1400, rare: 0.20 },
  { name: 'Palmetto Pickup', w: 2.0, l: 5.2, h: 1.7, color: ['#5e9c52', '#c9c2b2'], maxSpeed: 24, accel: 7, grip: 0.70, mass: 1800, rare: 0.15 },
  { name: 'Cabo Van', w: 2.1, l: 5.0, h: 2.2, color: ['#f0d9b8', '#4dd0e1'], maxSpeed: 20, accel: 6, grip: 0.68, mass: 2000, rare: 0.15 },
  { name: 'Manta Spyder', w: 1.9, l: 4.1, h: 1.1, color: ['#ff5fa2', '#ffd166'], maxSpeed: 40, accel: 15, grip: 0.90, mass: 1100, rare: 0.08 },
  { name: 'Bulldog SUV', w: 2.2, l: 4.8, h: 1.8, color: ['#4a4744', '#dfc18e'], maxSpeed: 26, accel: 8, grip: 0.73, mass: 1700, rare: 0.12 },
  { name: 'Sable Cruiser', w: 2.0, l: 4.7, h: 1.5, color: ['#ffffff', '#4dd0e1'], maxSpeed: 32, accel: 11, grip: 0.80, mass: 1500, rare: 0.05 }
];

/**
 * WEAPONS - hand weapons and firearms with damage, rate (shots/s), spread, range, ammo, auto.
 */
const WEAPONS = [
  { name: 'Fist', damage: 12, rate: 2.0, spread: 0.0, range: 1.6, ammo: Infinity, auto: false },
  { name: 'Sidewalk .38', damage: 26, rate: 3.0, spread: 0.02, range: 40, ammo: 60, auto: false },
  { name: 'Cane Cutter', damage: 18, rate: 9.0, spread: 0.05, range: 55, ammo: 120, auto: true },
  { name: 'Buoy 12', damage: 45, rate: 1.2, spread: 0.09, range: 25, ammo: 30, auto: false }
];

/**
 * CONFIG - frozen aggregate of all gameplay tunables consumed by every system via ctx.config.
 */
export const CONFIG = Object.freeze({
  palette: PALETTE,
  districts: DISTRICTS,
  city: CITY,
  cars: CARS,
  weapons: WEAPONS
});

// config-CHUNK-2-PLACEHOLDER
