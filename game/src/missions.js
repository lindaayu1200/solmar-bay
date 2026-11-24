// Story missions, objective markers, dialogs, payouts, and progression.
/** Runs the seven story missions and their world markers. */
export class Missions {
  constructor(ctx) {
    this.ctx = ctx;
    this.items = ctx.config.MISSIONS || [];
    this.activeMission = null;
    this.dialog = null;
    this.done = new Set();
    this.markers = [];
    const T = window.THREE;
    this.group = new T.Group();
    ctx.scene.add(this.group);
    this._buildMarkers();
  }

  /** Build a reusable arrow at each mission giver. */
  _buildMarkers() {
    const T = window.THREE;
    const geo = new T.ConeGeometry(0.65, 1.5, 8);
    const mat = new T.MeshStandardMaterial({ color: 0xffbd45, emissive: 0x7a3d08 });
    this.items.forEach((m, i) => {
      const p = m.giver || m.start || m.from || { x: -120 + i * 35, z: 80 };
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(p.x, (p.y || 0) + 2.2, p.z);
      this.group.add(mesh);
      this.markers.push({ mission: m, mesh, point: p });
    });
  }

  /** Return the nearest available mission giver within interaction range. */
  nearestGiver(pos) {
    let best = null;
    for (const entry of this.markers) {
      if (this.done.has(entry.mission.id) || this.activeMission) continue;
      const dx = pos.x - entry.point.x, dz = pos.z - entry.point.z;
      const d = Math.hypot(dx, dz);
      if (d <= 6 && (!best || d < best.distance)) best = { ...entry, distance: d };
    }
    return best;
  }

  /** Start a configured mission by id. */
  startMission(id) {
    const m = this.items.find(x => x.id === id);
    if (!m || this.done.has(id) || this.activeMission) return false;
    this.activeMission = { data: m, stage: 0, elapsed: 0, wave: 0, target: null };
    this.ctx.state.mission = m.name;
    if (m.type === 'steal' || m.type === 'chase') this._spawnTarget(m);
    this._objective(m.objective || m.description || m.name);
    return true;
  }

  /** Spawn a mission car when the vehicle system supports mission spawns. */
  _spawnTarget(m) {
    const v = this.ctx.vehicles;
    const p = m.target || m.from || m.start;
    if (!p || !v) return;
    if (v.spawnMissionCar) this.activeMission.target = v.spawnMissionCar(m.archetype, p, m.color);
    else if (v.spawnCar) this.activeMission.target = v.spawnCar(m.archetype, p, m.color);
  }

  /** Present mission text through the available HUD interface. */
  _objective(text) {
    if (this.ctx.hud && this.ctx.hud.setObjective) this.ctx.hud.setObjective(text);
  }

  /** Update dialog, mission conditions, markers, and completion. */
  update(dt) {
    const c = this.ctx, pos = c.player && (c.player.position || c.player);
    this.markers.forEach((e, i) => {
      e.mesh.rotation.y += dt * 1.8;
      e.mesh.position.y = 2.2 + Math.sin(c.state.time + i) * 0.25;
    });
    if (!this.activeMission) {
      if (pos) {
        const giver = this.nearestGiver(pos);
        if (giver) this._showDialog(giver.mission);
      }
      return;
    }
    const a = this.activeMission, m = a.data;
    a.elapsed += dt;
    if ((c.state.health !== undefined && c.state.health <= 0) || (m.time && a.elapsed > m.time)) return this._fail();
    if (m.type === 'goto' && this._near(pos, m.target || m.to || m.end, 6)) return this._complete();
    if (m.type === 'steal') {
      if (a.target && a.target.health !== undefined && a.target.health <= 0) return this._fail();
      if (this._near(pos, m.deliver || m.garage, 8) && (a.target && a.target.stolen)) return this._complete();
    }
    if (m.type === 'deliver' && a.elapsed > (m.time || 90)) return this._fail();
    if (m.type === 'chase' && a.target && a.target.health < 30 && (c.state.wanted || 0) === 0) return this._complete();
    if (m.type === 'wave' && a.elapsed >= 30) return this._complete();
    if (m.type === 'escape' && (c.state.wanted || 0) === 0) return this._complete();
    if (m.type === 'finale') this._updateFinale(a, m);
  }

  /** Advance harbor finale stages and show its closing card. */
  _updateFinale(a, m) {
    const targets = [m.car || m.target, m.harbor || m.to];
    const p = this.ctx.player && (this.ctx.player.position || this.ctx.player);
    if (this._near(p, targets[a.stage], 8)) {
      a.stage++;
      if (a.stage >= 2) {
        const el = document.createElement('div');
        el.textContent = 'RAFA LEAVES SOLMAR BAY - FOR NOW';
        el.style.cssText = 'position:fixed;inset:40% 10%;text-align:center;color:white;font: bold 28px sans-serif;z-index:1000;background:#000b;padding:30px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
        this._complete(10000);
      } else this._objective('Drive to the harbor');
    }
  }

  /** Check proximity to a configured world position. */
  _near(pos, point, range) {
    return !!(pos && point && Math.hypot(pos.x - point.x, pos.z - point.z) <= range);
  }

  /** Show a compact giver dialog and accept with E. */
  _showDialog(m) {
    const input = this.ctx.input;
    const pressed = input && (input.wasPressed ? input.wasPressed('KeyE') : input.pressed && input.pressed('KeyE'));
    if (!this.dialog) {
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:24px;bottom:24px;background:#17130fdd;color:white;padding:14px 18px;font:16px sans-serif;z-index:900;max-width:360px';
      box.textContent = `${m.giverName || m.contact || 'Solmar Bay'}: ${m.dialogue || m.description || m.name}  [E]`;
      document.body.appendChild(box);
      this.dialog = box;
    }
    if (pressed) { this.dialog.remove(); this.dialog = null; this.startMission(m.id); }
  }

  /** Pay out and persist a completed mission. */
  _complete(amount) {
    const c = this.ctx, m = this.activeMission.data;
    c.state.money = (c.state.money || 0) + (amount || m.payout || 0);
    this.done.add(m.id);
    this._finish();
    if (c.audio && c.audio.playMissionComplete) c.audio.playMissionComplete();
    if (c.save && c.save.saveProgress) c.save.saveProgress();
  }

  /** Fail and make the giver available for a retry. */
  _fail() {
    if (this.ctx.hud && this.ctx.hud.showBanner) this.ctx.hud.showBanner('MISSION FAILED');
    this._finish();
  }

  /** Clear active mission state and objective. */
  _finish() {
    this.activeMission = null;
    this.ctx.state.mission = null;
    this._objective('');
  }
}
