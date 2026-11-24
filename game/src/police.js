// Wanted response system: police pursuit, foot officers, and helicopter search.

/** Manages wanted heat, police units, pursuit behavior, and arrests. */
export class Police {
  constructor(ctx) {
    this.ctx = ctx;
    this.T = ctx.T;
    this.list = [];
    this.heli = null;
    this.heat = 0;
    this.cooldown = 0;
    this.bustTime = 0;
    this.shotClock = 0;
    this.spawnClock = 0;
    this.material = new this.T.MeshLambertMaterial({ color: 0x182b48 });
    this.white = new this.T.MeshLambertMaterial({ color: 0xe8e5d9 });
  }

  /** Add crime heat and update the visible wanted stars. */
  reportCrime(amount = 1) {
    const cfg = this.ctx.config.POLICE || {};
    this.heat += Math.max(0, amount) * (cfg.heatPerCrime || 1);
    this.ctx.state.wanted = Math.min(5, Math.max(1, Math.ceil(this.heat)));
    this.cooldown = 8 + this.ctx.state.wanted * 4;
  }

  /** Create a police vehicle entity near the player's current position. */
  spawnCop() {
    const T = this.T, p = this.ctx.player.pos;
    const angle = this.ctx.rng() * Math.PI * 2;
    const d = 34 + this.ctx.rng() * 18;
    const x = p.x + Math.cos(angle) * d, z = p.z + Math.sin(angle) * d;
    const group = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(2, 0.8, 4.4), this.material);
    body.position.y = 0.65;
    const roof = new T.Mesh(new T.BoxGeometry(1.5, 0.55, 2), this.white);
    roof.position.y = 1.25;
    const light = new T.Mesh(new T.BoxGeometry(0.8, 0.18, 0.35), new T.MeshBasicMaterial({ color: 0xff3344 }));
    light.position.set(0, 1.62, 0);
    group.add(body, roof, light);
    group.position.set(x, 0, z);
    this.ctx.scene.add(group);
    this.list.push({ group, pos: group.position, hp: 100, speed: 0, foot: false, shot: 0 });
  }

  /** Create or remove the circling helicopter and its searchlight. */
  updateHeli() {
    if (this.ctx.state.wanted < 3) {
      if (this.heli) this.ctx.scene.remove(this.heli.group);
      this.heli = null;
      return;
    }
    if (this.heli) return;
    const T = this.T, group = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(2, 1, 3), this.material);
    const rotor = new T.Mesh(new T.BoxGeometry(7, 0.08, 0.2), this.white);
    rotor.position.y = 0.8;
    group.add(body, rotor);
    const spot = new T.SpotLight(0xffedba, 2, 70, Math.PI / 7, 0.5);
    spot.position.set(0, -0.4, 0);
    group.add(spot);
    group.position.y = 35;
    this.ctx.scene.add(group);
    this.heli = { group, rotor, spot, angle: 0 };
  }

  /** Apply damage to an officer and add heat when one is killed. */
  damageCop(cop, dmg) {
    if (!cop || cop.hp <= 0) return;
    cop.hp -= dmg;
    if (cop.hp <= 0) {
      this.ctx.scene.remove(cop.group);
      this.list.splice(this.list.indexOf(cop), 1);
      this.reportCrime(1);
    }
  }

  /** Advance wanted decay, spawning, pursuit, shooting, and busting. */
  update(dt) {
    const { player, state, audio } = this.ctx;
    const target = player.pos;
    const wanted = state.wanted || 0;
    let seen = false, nearest = Infinity;
    for (const cop of this.list) nearest = Math.min(nearest, cop.pos.distanceTo(target));
    seen = nearest < 90;
    if (wanted > 0) {
      if (seen) this.cooldown = Math.max(this.cooldown, 4);
      else this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.heat = Math.max(0, this.heat - dt * 0.12);
        state.wanted = Math.min(5, Math.ceil(this.heat));
        this.cooldown = 2;
      }
    }
    const count = [0, 1, 2, 3, 4, 6][wanted] || 0;
    this.spawnClock -= dt;
    if (this.list.length < count && this.spawnClock <= 0) {
      this.spawnCop(); this.spawnClock = 1.5;
    }
    while (this.list.length > count) {
      const cop = this.list.pop(); this.ctx.scene.remove(cop.group);
    }
    this.updateHeli();
    this.shotClock -= dt;
    for (const cop of this.list) {
      const dx = target.x - cop.pos.x, dz = target.z - cop.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      cop.group.rotation.y = Math.atan2(dx, dz);
      cop.speed = Math.min(17, cop.speed + dt * 8);
      cop.pos.x += dx / dist * cop.speed * dt;
      cop.pos.z += dz / dist * cop.speed * dt;
      if (dist < 4 && player.currentCar) {
        player.currentCar.hp = Math.max(0, (player.currentCar.hp || 100) - 8 * dt);
      }
      if (!player.currentCar && dist < 28 && this.shotClock <= 0) {
        player.health = Math.max(0, player.health - (4 + this.ctx.rng() * 4));
        state.health = player.health;
        this.shotClock = 1.3;
      }
    }
    if (this.heli) {
      const h = this.heli;
      h.angle += dt * 0.3;
      h.group.position.set(target.x + Math.cos(h.angle) * 40, 35 + Math.sin(h.angle * 2), target.z + Math.sin(h.angle) * 40);
      h.group.rotation.y = -h.angle;
      h.rotor.rotation.y += dt * 18;
      h.spot.target.position.set(target.x, 0, target.z);
      if (!h.spot.target.parent) this.ctx.scene.add(h.spot.target);
    }
    if (!player.currentCar && wanted > 0 && nearest < 2.5) this.bustTime += dt;
    else this.bustTime = 0;
    if (this.bustTime >= 1.5) {
      state.mode = 'busted';
      state.money = Math.max(0, (state.money || 0) - 100 * wanted);
      state.wanted = 0; this.heat = 0; this.bustTime = 0;
      player.pos.set(-120, 0, -60);
    }
    if (audio && audio.setSiren) audio.setSiren(wanted > 0 && this.list.length > 0);
  }
}
