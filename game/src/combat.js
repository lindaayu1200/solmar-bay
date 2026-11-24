// Solmar Bay combat system: weapons, damage, crime reports, and pickups.

/** Manages player weapons, hitscan damage, and pickups. */
export class Combat {
  constructor(ctx) {
    this.ctx = ctx;
    this.slots = ['fist', 'pistol', 'SMG', 'shotgun'];
    this.ammo = { fist: Infinity, pistol: 48, SMG: 180, shotgun: 24 };
    this.currentSlot = 0;
    this.cooldown = 0;
    this.tracers = [];
    this.pickups = [];
    this.aiming = false;
    this.muzzleLight = null;
    this.muzzleTimer = 0;
    this.weapons = {
      fist: { damage: 18, range: 1.8, cooldown: 0.45, spread: 0 },
      pistol: { damage: 28, range: 90, cooldown: 0.32, spread: 0.012 },
      SMG: { damage: 13, range: 75, cooldown: 0.09, spread: 0.035 },
      shotgun: { damage: 12, range: 38, cooldown: 0.75, spread: 0.09, pellets: 7 }
    };
    this.createEffects();
    this.createPickups();
  }

  createEffects() {
    const { T, scene } = this.ctx;
    if (!T || !scene) return;
    this.muzzleLight = new T.PointLight(0xffb45a, 0, 8);
    scene.add(this.muzzleLight);
  }

  createPickups() {
    const { T, scene, world } = this.ctx;
    if (!T || !scene) return;
    const spots = this.ctx.config?.pickupSpots || world?.spawnPoints?.pickups || [];
    const kinds = ['health', 'armor', 'ammo'];
    spots.forEach((spot, index) => {
      const geometry = new T.BoxGeometry(0.7, 0.7, 0.7);
      const material = new T.MeshStandardMaterial({
        color: [0x55d878, 0x4f9bff, 0xffc34f][index % 3],
        emissive: [0x174d25, 0x102d59, 0x52370e][index % 3]
      });
      const mesh = new T.Mesh(geometry, material);
      mesh.position.set(spot.x, (spot.y || 0) + 0.8, spot.z);
      scene.add(mesh);
      this.pickups.push({ kind: kinds[index % kinds.length], mesh, baseY: mesh.position.y, active: true });
    });
  }

  get weapon() {
    return this.slots[this.currentSlot];
  }

  selectSlot(slot) {
    const index = typeof slot === 'number' ? slot - 1 : this.slots.indexOf(slot);
    if (index >= 0 && index < this.slots.length) this.currentSlot = index;
  }

  cycleWeapon(direction = 1) {
    this.currentSlot = (this.currentSlot + direction + this.slots.length) % this.slots.length;
  }

  aim(enabled) {
    this.aiming = Boolean(enabled) && !this.ctx.state.currentCar;
    this.ctx.player?.setAiming?.(this.aiming);
    this.ctx.hud?.showCrosshair?.(this.aiming);
  }

  fire() {
    if (this.cooldown > 0 || this.ctx.state.mode !== 'play') return false;
    const weapon = this.weapon;
    if (this.ammo[weapon] <= 0) return false;
    const stats = this.weapons[weapon];
    this.cooldown = stats.cooldown;
    if (weapon !== 'fist') this.ammo[weapon]--;
    this.ctx.audio?.playGun?.(weapon);
    const origin = this.ctx.camera.position.clone();
    const direction = this.getShotDirection(stats.spread);
    const hit = this.findHit(origin, direction, stats.range);
    if (hit) this.applyDamage(hit, stats.damage * (weapon === 'shotgun' ? stats.pellets : 1), weapon);
    this.showShot(origin, hit?.point || origin.clone().addScaledVector(direction, stats.range));
    return true;
  }

  getShotDirection(spread) {
    const direction = new this.ctx.T.Vector3();
    this.ctx.camera.getWorldDirection(direction);
    if (spread) {
      const rng = this.ctx.rng;
      direction.x += (rng() - 0.5) * spread;
      direction.y += (rng() - 0.5) * spread;
      direction.z += (rng() - 0.5) * spread;
      direction.normalize();
    }
    return direction;
  }

  findHit(origin, direction, range) {
    const { T, peds, police, vehicles, world } = this.ctx;
    const raycaster = new T.Raycaster(origin, direction, 0, range);
    const targets = [];
    for (const ped of peds?.list || []) if (ped.mesh) targets.push(ped.mesh);
    for (const cop of police?.cops || []) if (cop.mesh) targets.push(cop.mesh);
    for (const car of vehicles?.cars || []) if (car.mesh) targets.push(car.mesh);
    const objectHit = raycaster.intersectObjects(targets, true)[0];
    const wall = this.raycastBuildings(origin, direction, range, world?.colliders || []);
    if (wall && (!objectHit || wall.distance < objectHit.distance)) return { type: 'wall', ...wall };
    return objectHit ? { type: this.classifyTarget(objectHit.object), target: objectHit.object, point: objectHit.point, distance: objectHit.distance } : null;
  }

  classifyTarget(object) {
    const { peds, police, vehicles } = this.ctx;
    const matches = (items) => (items || []).some((item) => item.mesh === object || item.mesh?.children?.includes(object));
    if (matches(peds?.list)) return 'ped';
    if (matches(police?.cops)) return 'cop';
    if (matches(vehicles?.cars)) return 'vehicle';
    let parent = object?.parent;
    while (parent) {
      if (matches(peds?.list)) return 'ped';
      parent = parent.parent;
    }
    return 'world';
  }

  raycastBuildings(origin, direction, range, colliders) {
    const { T } = this.ctx;
    if (!colliders.length) return null;
    const raycaster = new T.Raycaster(origin, direction, 0, range);
    const hit = raycaster.intersectObjects(colliders, true)[0];
    return hit ? { point: hit.point, distance: hit.distance, object: hit.object } : null;
  }

  applyDamage(hit, amount) {
    if (!hit?.target || amount <= 0) return false;
    const { peds, police, vehicles } = this.ctx;
    const groups = [peds?.list, police?.cops, vehicles?.cars];
    for (const group of groups) {
      const entity = (group || []).find((item) => {
        let node = hit.target;
        while (node) {
          if (node === item.mesh) return true;
          node = node.parent;
        }
        return false;
      });
      if (!entity) continue;
      entity.health = Math.max(0, (entity.health ?? 100) - amount);
      entity.hit = true;
      if (entity.health === 0) entity.dead = true;
      return true;
    }
    return false;
  }

  fireWeapon() {
    const weapon = this.currentWeapon();
    if (!weapon || this.cooldown > 0) return false;
    if (weapon.ammo !== Infinity && weapon.ammo <= 0) return false;
    this.cooldown = weapon.fireRate;
    if (weapon.ammo !== Infinity) weapon.ammo -= 1;
    const origin = this.ctx.camera.getWorldPosition(new this.ctx.T.Vector3());
    const hit = this.findHit(origin, this.getShotDirection(weapon.spread), weapon.range);
    if (hit && hit.type !== 'wall') this.applyDamage(hit, weapon.damage);
    this.ctx.events?.emit?.('weapon-fired', { weapon, hit });
    return true;
  }

  update(delta) {
    this.cooldown = Math.max(0, this.cooldown - delta);
    if (this.ctx.input?.isPressed?.('fire')) this.fireWeapon();
  }

  currentWeapon() {
    const weapons = this.ctx.player?.weapons || [];
    return weapons[this.ctx.player?.weaponIndex || 0] || null;
  }
}
