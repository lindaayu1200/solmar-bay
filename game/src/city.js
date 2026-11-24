// Solmar Bay world builder: roads, districts, beach, harbor, and palms.
import * as R from './rng.js';

/** World: builds all city geometry once at boot into ctx.scene. */
export class World {
  /** @param {object} ctx shared game context */
  constructor(ctx) {
    this.ctx = ctx;
    this.T = ctx.T;
    this.config = ctx.config;
    this.rng = ctx.rng;

    // Exposed city data (populated by the make* passes below).
    this.districts = [];
    this.roadGraph = [];
    this.colliders = [];
    this.carSpawns = [];
    this.pedPaths = [];
    this.landmarks = [];
    this.waterLevel = -0.5;
    this.groundMesh = null;
    this.waterMesh = null;
    this.ferris = null;

    // Shared canvas texture cache: key -> {canvas, texture}.
    this.textureCache = new Map();
  }

  /** Get (or lazily build) a shared canvas texture by key + paint function. */
  _texture(key, w, h, paint) {
    if (this.textureCache.has(key)) return this.textureCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    paint(canvas.getContext('2d'), w, h);
    const texture = new this.T.CanvasTexture(canvas);
    this.textureCache.set(key, texture);
    return texture;
  }

  /** Procedural warm-sand base material for the ground. */
  _sandTexture() {
    return this._texture('sand', 128, 128, (g, w, h) => {
      g.fillStyle = '#c9b894';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) {
        g.fillStyle = this.rng.pick(['#c2ad85', '#d2c09e', '#bdab84']);
        g.fillRect(this.rng.float() * w, this.rng.float() * h, 1, 1);
      }
    });
  }

  /** Procedural asphalt + lane-dash texture for the roads. */
  _roadTexture() {
    return this._texture('road', 64, 64, (g, w, h) => {
      g.fillStyle = '#3a3a40';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#d8cfa0';
      // Single horizontal dashed lane line down the middle (repeats via wrap).
      g.fillRect(0, h / 2 - 1, w / 2, 2);
    });
  }

  /** Main build entry; called once from main boot. */
  build() {
    this.makeGroundAndWater();
    this.makeRoadGrid();
    this._makeBlocks();
    this._makeWater();
    this._makePalms();
    return this;
  }

  /** Big sand/asphalt base plane + west/south water + beach palms. */
  makeGroundAndWater() {
    const { T } = this;
    const size = 1200;
    const geo = new T.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const sand = new T.MeshStandardMaterial({
      map: this._sandTexture(),
      roughness: 1,
      metalness: 0,
    });
    this.groundMesh = new T.Mesh(geo, sand);
    this.groundMesh.receiveShadow = true;
    this.ctx.scene.add(this.groundMesh);

    // Water on the west + south edges, slightly transparent teal at y=-0.5.
    const waterGeo = new T.PlaneGeometry(size, size, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new T.MeshStandardMaterial({
      color: 0x2fb8a6,
      transparent: true,
      opacity: 0.82,
      roughness: 0.25,
      metalness: 0.05,
    });
    this.waterMesh = new T.Mesh(waterGeo, waterMat);
    this.waterMesh.position.set(-600, this.waterLevel, -600);
    this.ctx.scene.add(this.waterMesh);

    // Palms along the west beach edge + scattered around plazas.
    this._makePalms();
  }

  /** Instanced palm trees: trunk cylinders + cone fronds. */
  _makePalms() {
    const { T } = this;
    const count = 140;
    const trunk = new T.CylinderGeometry(0.16, 0.28, 3.4, 6);
    const trunkMat = new T.MeshStandardMaterial({ color: 0x7a5c3e, roughness: 1 });
    const frond = new T.ConeGeometry(1.7, 0.5, 6);
    const frondMat = new T.MeshStandardMaterial({ color: 0x2f8f3f, roughness: 0.9 });

    const tDummy = new T.Object3D();
    const fDummy = new T.Object3D();
    const palms = [];
    for (let i = 0; i < count; i++) {
      const nearBeach = i < 90;
      const x = nearBeach ? -460 + this.rng.float() * 20 : this.rng.range(-200, 200);
      const z = nearBeach ? this.rng.range(-460, 460) : this.rng.range(-200, 200);
      palms.push({ x, z });
    }
    const trunkMesh = new T.InstancedMesh(trunk, trunkMat, count);
    const frondMesh = new T.InstancedMesh(frond, frondMat, count);
    palms.forEach((p, i) => {
      const h = 3.4 + this.rng.float() * 1.2;
      tDummy.position.set(p.x, h / 2, p.z);
      tDummy.rotation.set(0, this.rng.float() * Math.PI, this.rng.range(-0.12, 0.12));
      tDummy.updateMatrix();
      trunkMesh.setMatrixAt(i, tDummy.matrix);
      fDummy.position.set(p.x, h + 0.2, p.z);
      fDummy.rotation.set(this.rng.range(-0.2, 0.2), 0, this.rng.range(-0.2, 0.2));
      fDummy.updateMatrix();
      frondMesh.setMatrixAt(i, fDummy.matrix);
    });
    this.ctx.scene.add(trunkMesh);
    this.ctx.scene.add(frondMesh);
  }

  /** Grid roads every 60 units + diagonal beach boulevard; merged asphalt + sidewalks. */
  makeRoadGrid() {
    const { T } = this;
    const step = 60;
    const half = 460;
    const roadTex = this._roadTexture();
    roadTex.wrapS = roadTex.wrapT = T.RepeatWrapping;
    roadTex.repeat.set(1, 1);
    const asphalt = new T.MeshStandardMaterial({ map: roadTex, roughness: 0.95 });
    const sidewalk = new T.MeshStandardMaterial({ color: 0xbdb7a6, roughness: 1 });

    const roadParts = [];
    const walkParts = [];
    const rows = [];
    for (let x = -half; x <= half; x += step) {
      rows.push(x);
      const g = new T.PlaneGeometry(12, half * 2 + step);
      g.rotateX(-Math.PI / 2);
      g.translate(x, 0.02, 0);
      roadParts.push(g);
      const s = new T.PlaneGeometry(2, half * 2 + step);
      s.rotateX(-Math.PI / 2);
      s.translate(x - step / 2, 0.05, 0);
      walkParts.push(s);
      s.translate(step, 0, 0);
      walkParts.push(s);
    }
    for (let z = -half; z <= half; z += step) {
      const g = new T.PlaneGeometry(half * 2 + step, 12);
      g.rotateX(-Math.PI / 2);
      g.translate(0, 0.02, z);
      roadParts.push(g);
      const s = new T.PlaneGeometry(half * 2 + step, 2);
      s.rotateX(-Math.PI / 2);
      s.translate(0, 0.05, z - step / 2);
      walkParts.push(s);
      s.translate(0, 0, step);
      walkParts.push(s);
    }

    // Diagonal beach boulevard through Mar Vista Beach.
    const bz = (bx) => bx * 0.6 + 120;
    const bg = new T.PlaneGeometry(10, 620);
    bg.rotateX(-Math.PI / 2);
    bg.rotateZ(0.54);
    bg.translate(80, 0.02, 220);
    roadParts.push(bg);

    this._merge(roadParts, asphalt, 0.02);
    this._merge(walkParts, sidewalk, 0.05);

    // Road graph for pathing.
    this.roadGraph = [];
    for (let x = -half; x <= half; x += step) {
      for (let z = -half; z <= half; z += step) {
        this.roadGraph.push({ x, z });
      }
    }
  }

  /** Merge geometry parts into one mesh (BufferGeometryUtils if available, else manual). */
  _merge(parts, material, y) {
    const { T } = this;
    const merged = T.BufferGeometryUtils
      ? T.BufferGeometryUtils.mergeBufferGeometries(parts, false)
      : this._manualMerge(parts);
    const mesh = new T.Mesh(merged, material);
    mesh.receiveShadow = true;
    this.ctx.scene.add(mesh);
    return mesh;
  }

  /** Fallback manual geometry merge when BufferGeometryUtils is missing. */
  _manualMerge(parts) {
    const { T } = this;
    const pos = [];
    const uv = [];
    const idx = [];
    let base = 0;
    for (const p of parts) {
      const pp = p.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        pos.push(pp.getX(i), pp.getY(i), pp.getZ(i));
      }
      const uvA = p.attributes.uv;
      for (let i = 0; i < uvA.count; i++) {
        uv.push(uvA.getX(i), uvA.getY(i));
      }
      const ia = p.index;
      for (let i = 0; i < ia.count; i++) {
        idx.push(ia.getX(i) + base);
      }
      base += pp.count;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  /** Build scattered building blocks with windows on the ground-plane cells. */
  _makeBlocks() {
    const { T } = this;
    const parts = [];
    const half = this.config.cityHalf;
    const step = this.config.cityStep;
    const rng = this.rng;
    const palette = ['#d8cfc2', '#c9bfae', '#e0d6c6', '#b9ad98', '#cbbfae'];

    for (let x = -half; x < half; x += step) {
      for (let z = -half; z < half; z += step) {
        // Leave a void along the beach boulevard strip.
        if (Math.abs(z - (x * 0.6 + 120)) < 30) continue;
        if (rng.float() < 0.35) continue; // keep some open lots
        const w = rng.float(8, 18);
        const d = rng.float(8, 18);
        const h = rng.float(6, 40);
        const geo = new T.BoxGeometry(w, h, d);
        geo.translate(x + rng.float(-4, 4), h / 2, z + rng.float(-4, 4));
        const mat = new T.MeshStandardMaterial({
          color: rng.pick(palette),
          roughness: 0.9,
          metalness: 0.05,
        });
        const mesh = new T.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.ctx.scene.add(mesh);
        this.colliders.push({
          min: [mesh.position.x - w / 2, 0, mesh.position.z - d / 2],
          max: [mesh.position.x + w / 2, h, mesh.position.z + d / 2],
        });
        parts.push(geo);
      }
    }
  }

  /** Build the beach water plane at the configured level. */
  _makeWater() {
    const { T } = this;
    const half = this.config.cityHalf + 40;
    const geo = new T.PlaneGeometry(half * 2, half * 2);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, this.waterLevel, 0);
    const mat = new T.MeshStandardMaterial({
      color: 0x2a7fb8,
      transparent: true,
      opacity: 0.82,
      roughness: 0.2,
      metalness: 0.4,
    });
    this.waterMesh = new T.Mesh(geo, mat);
    this.ctx.scene.add(this.waterMesh);
  }

  /** Drop a few palm trees along the beachfront. */
  _makePalms() {
    const { T } = this;
    const rng = this.rng;
    const trunkMat = new T.MeshStandardMaterial({ color: 0x7a5233, roughness: 1 });
    const leafMat = new T.MeshStandardMaterial({ color: 0x2f7d2f, roughness: 0.9 });

    for (let i = 0; i < 60; i++) {
      const x = rng.float(-this.config.cityHalf, this.config.cityHalf);
      const z = x * 0.6 + 120 + rng.float(-25, 25);
      const trunk = new T.CylinderGeometry(0.35, 0.55, rng.float(6, 9), 6);
      trunk.translate(x, 4, z);
      this.ctx.scene.add(new T.Mesh(trunk, trunkMat));
      for (let j = 0; j < 6; j++) {
        const leaf = new T.ConeGeometry(rng.float(2, 3), rng.float(1.5, 2.2), 6);
        const a = (j / 6) * Math.PI * 2;
        leaf.translate(x + Math.cos(a) * 1.4, 8.4, z + Math.sin(a) * 1.4);
        this.ctx.scene.add(new T.Mesh(leaf, leafMat));
      }
    }
  }

}
