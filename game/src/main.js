// Solmar Bay game entry point: scene setup, state, and fixed-step loop.
import { mulberry32 } from './rng.js';
import { CONFIG } from './config.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { World } from './city.js';
import { Peds } from './peds.js';
import { Vehicles } from './vehicles.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { SaveSystem } from './save.js';

/** Wait for document readiness, then report boot failures on the start screen. */
function ready() {
  const boot = () => { try { init(); } catch (error) {
    const screen = document.getElementById('start-screen') || document.body;
    const message = document.createElement('pre');
    message.style.cssText = 'color:#ff6b55;white-space:pre-wrap';
    message.textContent = `SOLMAR BAY failed to start\n${error.stack || error}`;
    screen.appendChild(message);
  } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}

/** Create the renderer, systems, controls, and animation loop. */
function init() {
  const T = window.THREE;
  if (!T) throw new Error('THREE vendor script was not loaded');
  const canvas = document.querySelector('canvas') || document.body.appendChild(document.createElement('canvas'));
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.background = new T.Color(CONFIG.PALETTE.skyTop);
  scene.fog = new T.FogExp2(CONFIG.PALETTE.fog, 0.0018);
  const camera = new T.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1600);
  const sun = new T.DirectionalLight(CONFIG.PALETTE.sun, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -120;
  sun.shadow.camera.right = sun.shadow.camera.top = 120;
  scene.add(sun, new T.HemisphereLight(0xffe2bc, 0x52636a, 0.85));
  const sky = new T.Mesh(new T.SphereGeometry(900, 24, 16), new T.MeshBasicMaterial({
    color: CONFIG.PALETTE.skyTop, side: T.BackSide, depthWrite: false,
  }));
  scene.add(sky);
  const state = { mode: 'menu', money: 500, wanted: 0, health: 100, armor: 0, time: 0,
    district: 'Palm Row', currentCar: null, mission: null, missionIndex: 0 };
  const config = Object.assign({}, CONFIG, { cityHalf: CONFIG.CITY.max, cityStep: 60, city: { bounds: { min: CONFIG.CITY.min, max: CONFIG.CITY.max }, roadSpacing: 60 }, POLICE: { heatPerCrime: 1 }, COLORS: ['#d02020', '#2020d0', '#888888', '#c8c8c8', '#35e0e8', '#4a4a4a', '#222222', '#6b8f3a'] });
  const ctx = { T, scene, camera, renderer, config, rng: mulberry32(1337), state };
  ctx.input = new Input(canvas);
  ctx.audio = new AudioSys(ctx);
  ctx.world = new World(ctx); ctx.world.build();
  ctx.peds = new Peds(ctx);
  ctx.vehicles = new Vehicles(ctx);
  ctx.player = new Player(ctx);
  ctx.combat = new Combat(ctx);
  ctx.police = new Police(ctx);
  ctx.missions = new Missions(ctx);
  ctx.hud = new Hud(ctx);
  ctx.save = new SaveSystem(ctx);
  window.__SOLMAR = { ctx };
  const start = document.getElementById('btnNew');
  const continueButton = document.getElementById('btnContinue');
  const begin = (loadSave = true) => {
    if (state.mode !== 'menu') return;
    ctx.audio.ensureContext(); ctx.audio.startEngine(); if (loadSave) ctx.save.load();
    state.mode = 'play'; ctx.input.setCapture(true); ctx.hud.showStart(true);
    if (canvas.requestPointerLock) canvas.requestPointerLock();
  };
  const continueGame = () => {
    if (state.mode !== 'menu') return;
    ctx.save.load();
    begin(false);
  };
  if (start) start.addEventListener('click', begin);
  if (continueButton) continueButton.addEventListener('click', continueGame);
  else canvas.addEventListener('click', begin, { once: true });
  const step = 1 / 60, terminal = { mode: null, timer: 0 };
  let previous = performance.now(), accumulator = 0;
  function animate(now) {
    requestAnimationFrame(animate);
    const frame = Math.min((now - previous) / 1000, 0.1); previous = now;
    ctx.input.consume();
    if (state.mode === 'play' && ctx.input.pressed('Escape')) {
      state.mode = 'paused'; ctx.input.setCapture(false); ctx.input.unlock(); ctx.hud.showHelp(true);
    } else if (state.mode === 'paused' && ctx.input.pressed('Escape')) {
      state.mode = 'play'; ctx.input.setCapture(true); ctx.hud.showHelp(false);
    }
    if (state.mode === 'play') {
      accumulator = Math.min(accumulator + frame, step * 4);
      while (accumulator >= step) {
        state.time += step;
        ctx.world.update?.(step); ctx.peds.update(step); ctx.vehicles.update(step);
        ctx.player.update(step); state.currentCar = ctx.player.currentCar;
        ctx.combat.update(step); ctx.police.update(step); ctx.missions.update(step);
        ctx.hud.update(step); ctx.audio.tick?.(step); ctx.save.update?.(step);
        if (state.health <= 0) { state.mode = 'dead'; terminal.mode = 'dead'; terminal.timer = 3; }
        if (state.mode === 'busted' && terminal.mode !== 'busted') { terminal.mode = 'busted'; terminal.timer = 3; }
        accumulator -= step;
      }
    } else if (terminal.mode && state.mode === terminal.mode) {
      terminal.timer -= frame;
      if (terminal.timer <= 0) {
        ctx.player.pos.set(-120, 0, -60); ctx.player.health = state.health = 100;
        state.wanted = 0; ctx.police.heat = 0; state.mode = 'play'; terminal.mode = null;
        ctx.input.setCapture(true); ctx.save.saveProgress();
      }
    }
    sun.position.set(ctx.player.pos.x - 60, 90, ctx.player.pos.z - 50);
    sun.target.position.copy(ctx.player.pos); sun.target.updateMatrixWorld();
    sun.shadow.camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot === 'start') {
    state.mode = 'menu';
    window.__shotReady = true;
  } else if (['play', 'chase', 'end'].includes(shot)) {
    try {
      state.mode = 'play'; ctx.input.setCapture(false); ctx.hud.showStart(true);
      ctx.player.pos.set(20, 0, 20);
       if (ctx.vehicles.spawnTraffic) ctx.vehicles.spawnTraffic(new T.Vector3(20, 0, 20));
       ctx.vehicles.spawnParked('sedan', new T.Vector3(28, 0, 8), 0);
       ctx.vehicles.spawnParked('taxi', new T.Vector3(12, 0, 34), Math.PI);
      if (shot === 'chase' || shot === 'end') {
        state.wanted = shot === 'end' ? 2 : 3;
        ctx.police.heat = shot === 'end' ? 3 : 5;
        ctx.police.spawnCop(); ctx.police.spawnCop(); ctx.police.spawnCop();
      }
      if (shot === 'end' && ctx.missions.items && ctx.missions.items[0]) {
        ctx.missions.startMission(ctx.missions.items[0].id);
      }
      window.__SOLMAR.ctx.state.mode = 'play';
    } catch (error) {
      console.warn('Screenshot staging failed', error);
    } finally {
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(animate);
}

ready();
