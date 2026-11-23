// peds.js — pedestrians: pooled sidewalk walkers that idle, walk, flee gunfire, and ragdoll.
// Part 1 of 2 (pool + humanoid builder + spawn/cull loop). Part 2: per-ped behavior, panic, hit, minimap.

// Warm sun-soaked Solmar Bay palettes for skin, shirts and pants.
const SKIN_TONES = ['#f0c8a0', '#e8b48c', '#d9a06e', '#c68a52', '#a96f3f', '#8a5a34'];
const SHIRT_COLORS = ['#e07b54', '#4a90d9', '#7aa54a', '#e2c34a', '#8e6fb5', '#e8e8e8', '#d9546b'];
const PANTS_COLORS = ['#3b4a5a', '#4a3b2f', '#2f3b4a', '#5a5a5a', '#4a5a3b', '#6b5a3b'];

/** Peds: pooled low-poly sidewalk pedestrians kept alive only near the player. */
export class Peds {
  /** @param {object} ctx shared context { T, scene, config, rng, world, audio, police } */
  constructor(ctx) {
    this.ctx = ctx;
    this.T = ctx.T;
    this.list = [];           // alive peds near the player (exposed to HUD and combat)
    this.pool = [];           // 48 prebuilt humanoids, reused forever
    this.cap = 40;            // target alive peds near player
    this.spawnRadius = 260;   // spawn within this distance (m)
    this.despawnRadius = 320; // despawn beyond this distance (m)
    this.materials = this.buildMaterials();
    this.buildPool();
  }

  /** Build one shared material per palette color, reused by every humanoid. */
  buildMaterials() {
    const T = this.T;
    const make = (colors) => colors.map((c) => new T.MeshLambertMaterial({ color: c }));
    return {
      skin: make(SKIN_TONES),
      shirt: make(SHIRT_COLORS),
      pants: make(PANTS_COLORS),
    };
  }

  /** Prebuild 48 hidden humanoids once at boot; they are only ever reused. */
  buildPool() {
    for (let i = 0; i < 48; i++) {
      const group = this.buildHumanoid();
      group.visible = false;
      this.ctx.scene.add(group);
      this.pool.push({
        group,
        active: false,
        state: 'idle',        // 'idle' | 'walk' | 'flee' | 'dead'
        speed: 0,             // current speed (m/s)
        hp: 100,
        path: [],             // sidewalk waypoints [{x,z}, ...]
        target: 0,            // next waypoint index into path
        pos: { x: 0, z: 0 },  // current world x/z
        panicT: 0,            // seconds left in flee state
        deadT: 0,             // seconds since killed (fade/respawn timer)
      });
    }
  }

  /** Build one low-poly humanoid Group from boxes: torso, head, 2 legs, 2 arms. */
  buildHumanoid() {
    const T = this.T;
    const rng = this.ctx.rng;
    const g = new T.Group();
    const matSkin = this.pickMat(this.materials.skin, rng);
    const matShirt = this.pickMat(this.materials.shirt, rng);
    const matPants = this.pickMat(this.materials.pants, rng);

    // Local helper: add one box mesh (12 tris) to the group.
    const addBox = (w, h, d, mat, x, y, z) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };

    addBox(0.44, 0.6, 0.24, matShirt, 0, 1.0, 0);              // torso
    const head = addBox(0.24, 0.24, 0.24, matSkin, 0, 1.55, 0); // head
    addBox(0.16, 0.72, 0.18, matPants, -0.13, 0.36, 0);        // left leg
    addBox(0.16, 0.72, 0.18, matPants, 0.13, 0.36, 0);         // right leg
    const leftArm = addBox(0.12, 0.58, 0.12, matSkin, -0.29, 1.0, 0);
    const rightArm = addBox(0.12, 0.58, 0.12, matSkin, 0.29, 1.0, 0);

    // Keep limb refs for idle phone pose / flee arm pump / ragdoll in part 2.
    g.userData = { head, leftArm, rightArm };
    return g;
  }

  /** Pick a random shared material via the seeded rng. */
  pickMat(mats, rng) {
    return mats[Math.floor(rng() * mats.length)];
  }

  /** Per-frame: cull far peds, refill near the player, then advance each ped. */
  update(dt, playerPos) {
    this.cullFar(playerPos);
    this.refill(playerPos);
    for (const ped of this.list) this.updatePed(ped, dt, playerPos);
  }

  /** Despawn peds beyond despawnRadius, returning them to the idle pool. */
  cullFar(playerPos) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const ped = this.list[i];
      const dx = ped.pos.x - playerPos.x;
      const dz = ped.pos.z - playerPos.z;
      if (dx * dx + dz * dz > this.despawnRadius * this.despawnRadius) this.release(ped);
    }
  }

  /** Spawn peds from the pool on nearby sidewalk waypoints until the cap is met. */
  refill(playerPos) {
    let guard = 0;
    while (this.list.length < this.cap && guard++ < 60) {
      const ped = this.pool.find((p) => !p.active);
      if (!ped) return;
      if (this.spawnOne(ped, playerPos)) this.list.push(ped);
    }
  }
// peds-CHUNK-2-PLACEHOLDER
