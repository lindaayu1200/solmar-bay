// Solmar Bay pedestrians: pooled sidewalk walkers, panic, and ragdoll behavior.
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
update(dt, playerPos = this.ctx.player && this.ctx.player.pos ? this.ctx.player.pos : { x: 0, z: 0 }) {
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
  /** Lazily resolve sidewalk waypoints (world.pedPaths, or a generated grid fallback). */
  waypoints() {
    const world = this.ctx.world;
    if (world && world.pedPaths && world.pedPaths.length) return world.pedPaths.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.z));
    if (this._waypoints) return this._waypoints;
    const { bounds, roadSpacing } = this.ctx.config.city;
    const half = bounds.max;
    const step = roadSpacing || 60;
    const off = step / 2;
    const pts = [];
    for (let x = -half; x <= half; x += step) {
      for (let z = -half; z <= half; z += step) {
        pts.push({ x: x - off, z }, { x: x + off, z }, { x, z: z - off }, { x, z: z + off });
      }
    }
    this._waypoints = pts;
    return pts;
  }

  /** Activate one pooled ped on a sidewalk waypoint near the player. */
  spawnOne(ped, playerPos) {
    const rng = this.ctx.rng;
    const pts = this.waypoints();
    if (!pts.length) return false;
    let wpt = null;
    const r2 = this.spawnRadius * this.spawnRadius;
    for (let i = 0; i < pts.length && !wpt; i++) {
      const p = pts[i];
      if ((p.x - playerPos.x) ** 2 + (p.z - playerPos.z) ** 2 <= r2) wpt = p;
    }
    if (!wpt) wpt = pts[Math.floor(rng() * pts.length)];
    ped.active = true;
    ped.hp = 100;
    ped.pos.x = wpt.x + rng() * 2 - 1;
    ped.pos.z = wpt.z + rng() * 2 - 1;
    ped.fleeX = ped.fleeZ = 0;
    ped.phase = rng() * Math.PI * 2;
    ped.group.position.set(ped.pos.x, 0, ped.pos.z);
    ped.group.rotation.set(0, rng() * Math.PI * 2, 0);
    ped.group.visible = true;
    ped.panicT = 0;
    ped.deadT = 0;
    this.rollPath(ped);
    if (rng() < 0.5) {
      ped.state = 'idle';
      ped.speed = 0;
      ped.idleT = 2 + rng() * 4;
    } else {
      ped.state = 'walk';
      ped.speed = 1.4 + rng() * 0.5;
      ped.idleT = 4 + rng() * 6;
    }
    return true;
  }

  /** Roll a short random hop-path of nearby sidewalk waypoints. */
  rollPath(ped) {
    const rng = this.ctx.rng;
    const pts = this.waypoints();
    ped.path = [];
    ped.target = 0;
    let cx = ped.pos.x;
    let cz = ped.pos.z;
    for (let i = 0, hops = 3 + Math.floor(rng() * 4); i < hops; i++) {
      let pick = null;
      for (let t = 0; t < 12 && !pick; t++) {
        const p = pts[Math.floor(rng() * pts.length)];
        if ((p.x - cx) ** 2 + (p.z - cz) ** 2 < 8100) pick = p; // within 90 m
      }
      if (!pick) pick = pts[Math.floor(rng() * pts.length)];
      ped.path.push({ x: pick.x + rng() * 2 - 1, z: pick.z + rng() * 2 - 1 });
      cx = pick.x;
      cz = pick.z;
    }
  }

  /** Return a ped to the idle pool and drop it from the alive list. */
  release(ped) {
    const i = this.list.indexOf(ped);
    if (i >= 0) this.list.splice(i, 1);
    ped.active = false;
    ped.group.visible = false;
    ped.state = 'idle';
    ped.speed = 0;
    ped.path = [];
    ped.target = 0;
    ped.panicT = 0;
    ped.deadT = 0;
  }

  /** Per-ped state machine: dead fade, flee, walk, idle. */
  updatePed(ped, dt) {
    const rng = this.ctx.rng;
    if (ped.state === 'dead') {
      ped.deadT += dt;
      if (ped.deadT >= 8) this.release(ped);
      else if (ped.deadT > 7) ped.group.position.y -= dt * 1.4; // sink = cheap fade
      return;
    }
    if (ped.state === 'flee') {
      this.fleeStep(ped, dt);
      ped.panicT -= dt;
      if (ped.panicT <= 0) {
        ped.state = 'walk';
        ped.speed = 1.4 + rng() * 0.5;
        ped.idleT = 4 + rng() * 6;
        this.rollPath(ped);
      }
      return;
    }
    if (ped.state === 'walk') {
      this.walkStep(ped, dt);
      ped.idleT -= dt;
      if (ped.idleT <= 0) {
        ped.state = 'idle';
        ped.speed = 0;
        ped.idleT = 2 + rng() * 4;
      }
    } else {
      this.idlePose(ped);
      ped.idleT -= dt;
      if (ped.idleT <= 0) {
        ped.state = 'walk';
        ped.speed = 1.4 + rng() * 0.5;
        ped.idleT = 4 + rng() * 6;
        this.rollPath(ped);
      }
    }
  }

  /** Advance a walker to the next waypoint, facing travel and swinging arms. */
  walkStep(ped, dt) {
    if (!ped.path.length || ped.target >= ped.path.length) {
      this.rollPath(ped);
      return;
    }
    const w = ped.path[ped.target];
    const dx = w.x - ped.pos.x;
    const dz = w.z - ped.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.7) {
      if (++ped.target >= ped.path.length) this.rollPath(ped);
      return;
    }
    const k = Math.min(1, (ped.speed * dt) / d);
    ped.pos.x += dx * k;
    ped.pos.z += dz * k;
    const g = ped.group;
    g.position.set(ped.pos.x, 0, ped.pos.z);
    g.rotation.y = Math.atan2(dx, dz);
    ped.phase += dt * ped.speed * 5;
    const s = Math.sin(ped.phase) * 0.5;
    g.userData.leftArm.rotation.x = s;
    g.userData.rightArm.rotation.x = -s;
    g.userData.head.rotation.x = 0;
  }

  /** Idle phone pose: one arm bent up, head tilted down. */
  idlePose(ped) {
    const g = ped.group;
    g.userData.leftArm.rotation.x = -1.2;
    g.userData.rightArm.rotation.x = -0.2;
    g.userData.head.rotation.x = 0.4;
  }

  /** Sprint away from the stored threat direction, arms pumping. */
  fleeStep(ped, dt) {
    ped.pos.x += ped.fleeX * ped.speed * dt;
    ped.pos.z += ped.fleeZ * ped.speed * dt;
    const g = ped.group;
    g.position.set(ped.pos.x, 0, ped.pos.z);
    g.rotation.y = Math.atan2(ped.fleeX, ped.fleeZ);
    ped.phase += dt * ped.speed * 5;
    const s = Math.sin(ped.phase) * 0.9;
    g.userData.leftArm.rotation.x = s;
    g.userData.rightArm.rotation.x = -s;
    g.userData.head.rotation.x = 0;
  }

  /** Nearby peds panic and run 5 m/s away from a threat, occasionally screaming. */
  panicFrom(x, z, radius) {
    const r2 = radius * radius;
    for (const ped of this.list) {
      if (ped.state === 'dead') continue;
      const dx = ped.pos.x - x;
      const dz = ped.pos.z - z;
      if (dx * dx + dz * dz > r2) continue;
      const d = Math.hypot(dx, dz) || 1;
      ped.fleeX = dx / d;
      ped.fleeZ = dz / d;
      ped.state = 'flee';
      ped.speed = 5;
      ped.panicT = 2.5 + this.ctx.rng() * 2;
      if (this.ctx.rng() < 0.15 && this.ctx.audio && this.ctx.audio.scream) {
        this.ctx.audio.scream(ped.pos);
      }
    }
  }

  /** Apply damage; kill = ragdoll-tip + murder report, then fade/respawn after 8s. */
  hit(ped, dmg) {
    if (ped.state === 'dead') return;
    ped.hp -= dmg;
    if (ped.hp <= 0) {
      ped.state = 'dead';
      ped.deadT = 0;
      ped.speed = 0;
      ped.group.rotation.x = Math.PI / 2; // ragdoll-lite: fall over
      if (this.ctx.police && this.ctx.police.reportCrime) {
        this.ctx.police.reportCrime('murder', { x: ped.pos.x, y: 0, z: ped.pos.z });
      }
    }
  }

  /** Draw up to cap nearby peds as white dots on the minimap canvas. */
  minimapDraw(g, cx, cy, scale, playerPos) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < this.list.length && i < 40; i++) {
      const p = this.list[i];
      g.fillRect(cx + (p.pos.x - playerPos.x) * scale - 1,
        cy + (p.pos.z - playerPos.z) * scale - 1, 2, 2);
    }
  }
}
