// Solmar Bay vehicle system: car pooling, physics, and traffic AI.

/**
 * Vehicles manager class.
 * @param {object} ctx - shared context (T, scene, ...)
 */
export class Vehicles {
  constructor(ctx) {
    const { T, scene, config } = ctx;
    this.T = T;
    this.scene = scene;
    this.config = config;

    /**
     * Array of active car entities.
     * @type {Array<Object>}
     */
    this.vehicles = [];

    /**
     * Mesh pool: { [type]: Array<Mesh> }
     * @type {Object}
     */
    this.pool = {};

    /**
     * Cached car type data from config.CARS.
     * @type {Object}
     */
    this.carTypes = config.CARS || {};

    /**
     * Max number of cars that should be present in traffic.
     * @type {number}
     */
    this.maxTraffic = 22;

    /**
     * Speed multiplier for each car type.
     * @type {Object}
     */
    this.speedCaps = this._initSpeedCaps();

    /**
     * Steering factor table for traffic AI.
     * @type {Object}
     */
    this.steering = {
      'default': 0.04,
      'sports': 0.06,
      'truck': 0.02,
    };

    /**
     * Create a placeholder geometry for future mesh pool.
     */
    this._initBaseGeometry();
  }

  /**
   * Initialize speed caps based on car type.
   * @private
   * @returns {Object}
   */
  _initSpeedCaps() {
    const caps = {};
    for (const type in this.carTypes) {
      const cfg = this.carTypes[type];
      caps[type] = cfg && cfg.maxSpeed ? cfg.maxSpeed : 30; // default 30 m/s
    }
    return caps;
  }

  /**
   * Prepare a basic BoxGeometry used for pooling.
   * @private
   */
  _initBaseGeometry() {
    // Placeholder: a simple box for the car body
    this.bodyGeo = new this.T.BoxGeometry(2, 1, 4);
    this.wheelGeo = new this.T.CylinderGeometry(0.5, 0.5, 0.3, 12);
    this.cabinGeo = new this.T.BoxGeometry(1.5, 0.8, 2);
  }

  /**
   * Create or reuse a mesh for a given car type.
   * @private
   * @param {string} type - car type key from config.
   * @param {string} color - hex string.
   * @returns {THREE.Mesh}
   */
  makeCarMesh(type, color) {
    const pool = this.pool[type] = this.pool[type] || [];
    let mesh = pool.pop();
    if (!mesh) {
      const bodyMat = new this.T.MeshLambertMaterial({ color: color || 0x888888 });
      const body = new this.T.Mesh(this.bodyGeo, bodyMat);
      const cabinMat = new this.T.MeshLambertMaterial({ color: 0x333333 });
      const cabin = new this.T.Mesh(this.cabinGeo, cabinMat);
      cabin.position.set(0, 0.6, -0.5);

      const wheelMat = new this.T.MeshLambertMaterial({ color: 0x222222 });
      const wheelPositions = [
        [1, -0.5, 1.5], [-1, -0.5, 1.5],
        [1, -0.5, -1.5], [-1, -0.5, -1.5],
      ];
      const wheels = wheelPositions.map(pos => {
        const w = new this.T.Mesh(this.wheelGeo, wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(...pos);
        return w;
      });

      const group = new this.T.Group();
      group.add(body, cabin, ...wheels);
      mesh = group;
    } else {
      // Recolor
      mesh.children[0].material.color.set(color || 0x888888);
    }
    return mesh;
  }

  /**
   * Spawn a single traffic car at a random spawn point.
   * @param {object} spawn - {x, z, heading}
   * @param {string} type
   * @param {string} color
   * @returns {Object} car entity
   */
  spawnTrafficCar(spawn, type, color) {
    const mesh = this.makeCarMesh(type, color);
    this.scene.add(mesh);

    const car = {
      group: mesh,
      type: type,
      pos: new this.T.Vector3(spawn.x, 0, spawn.z),
      heading: spawn.heading, // radians
      speed: 0,
      steer: 0,
      hp: 100,
      driver: 'traffic',
      laneOffset: this.T.MathUtils.randFloatSpread(5),
      color: color,
      name: this.carTypes[type]?.name || type,
      wheelSpin: 0,
    };
    mesh.position.copy(car.pos);
    mesh.rotation.y = car.heading;
    this.vehicles.push(car);
    return car;
  }

  /**
   * Update all vehicles each tick.
   * @param {number} dt - delta time seconds.
   */
  update(dt) {
    for (const car of this.vehicles) {
      this._updateCar(car, dt);
    }
  }

  /**
   * Update individual car physics.
   * @private
   * @param {Object} car
   * @param {number} dt
   */
  _updateCar(car, dt) {
    const { T } = this;
    // Basic acceleration for traffic AI
    if (car.driver === 'traffic') {
      const maxSpeed = this.speedCaps[car.type] || 30;
      if (car.speed < maxSpeed) car.speed += 5 * dt; // accel
      const steer = this.steering[car.type] || this.steering['default'];
      car.steer = steer;
    }

    // Apply steering
    car.heading += car.steer * dt;

    // Update position
    const forward = new T.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
    car.pos.addScaledVector(forward, car.speed * dt);

    // Apply to mesh
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;

    // Simple collision placeholder (world.resolveCircle not implemented yet)
    // TODO: implement world collision and damage
  }

  /**
   * Find the nearest car to a position.
   * @param {THREE.Vector3} pos
   * @param {number} maxDist
   * @returns {Object|null}
   */
  nearestCar(pos, maxDist) {
    let nearest = null;
    let bestDist = Infinity;
    for (const car of this.vehicles) {
      const d = car.pos.distanceTo(pos);
      if (d < bestDist && d <= maxDist) {
        bestDist = d;
        nearest = car;
      }
    }
    return nearest;
  }

  /**
   * Spawn a car at a given position and heading.
   * @param {string} type - car type key from config.CARS
   * @param {THREE.Vector3} pos
   * @param {number} heading
   * @returns {Object} the new car entity
   */
  addCar(type, pos, heading) {
    const typeDef = this.carTypes[type] || this.carTypes.sedan || {};
    const mesh = this._acquire(type, typeDef);
    const car = {
      type,
      mesh,
      pos: pos.clone(),
      heading,
      speed: 0,
      active: true,
    };
    car.group = new this.T.Group();
    car.group.add(mesh);
    car.group.position.copy(pos);
    car.group.rotation.y = heading;
    this.scene.add(car.group);
    this.vehicles.push(car);
    return car;
  }

  /**
   * Remove a car from the scene and return its mesh to the pool.
   * @param {Object} car
   */
  removeCar(car) {
    const idx = this.vehicles.indexOf(car);
    if (idx === -1) return;
    this.vehicles.splice(idx, 1);
    this.scene.remove(car.group);
    car.group.remove(car.mesh);
    this._release(car.type, car.mesh);
    car.active = false;
  }

  /**
   * Update all active vehicles.
   * @param {number} dt - delta time in seconds
   */
  update(dt) {
    for (const car of this.vehicles) {
      if (!car.active) continue;
      // Basic forward motion; heading and speed controlled by traffic AI.
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.group.position.copy(car.pos);
    }
  }

  /**
   * Reset all vehicles and clear the scene.
   */
  reset() {
    for (const car of this.vehicles.slice()) {
      this.removeCar(car);
    }
    this.vehicles.length = 0;
  }

  /**
   * Acquire a mesh from the pool or build a new one.
   * @private
   */
  _acquire(type, typeDef) {
    const list = this.pool[type] || (this.pool[type] = []);
    if (list.length) return list.pop();
    const box = new this.T.BoxGeometry(
      typeDef.width || 2,
      typeDef.height || 1.2,
      typeDef.length || 4
    );
    const mat = new this.T.MeshLambertMaterial({ color: typeDef.color || 0x88ccff });
    return new this.T.Mesh(box, mat);
  }

  /**
   * Return a mesh to the pool.
   * @private
   */
  _release(type, mesh) {
    (this.pool[type] || (this.pool[type] = [])).push(mesh);
  }

  /**
   * Dispose all resources used by the vehicles system.
   */
  dispose() {
    this.reset();
    for (const type of Object.keys(this.pool)) {
      for (const mesh of this.pool[type]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      this.pool[type] = [];
    }
  }

  /**
   * Spawn traffic cars around the player, keeping the count near maxTraffic.
   * @param {THREE.Vector3} center - player position to keep traffic near.
   */
  spawnTraffic(center) {
    const nearby = this.vehicles.filter(c => c.active &&
      c.pos.distanceTo(center) < 70).length;
    const want = Math.max(0, this.maxTraffic - nearby);
    for (let i = 0; i < want; i++) {
      const type = this._pickTrafficType();
      const cfg = this.carTypes[type] || {};
      const ang = Math.random() * Math.PI * 2;
      const dist = 25 + Math.random() * 30;
      const pos = new this.T.Vector3(
        center.x + Math.sin(ang) * dist,
        0,
        center.z + Math.cos(ang) * dist
      );
      this.addCar(type, pos, ang + Math.PI);
    }
  }

  /**
   * Spawn a parked (stationary, driverless) car at a position.
   * @param {string} type
   * @param {THREE.Vector3} pos
   * @param {number} heading
   * @returns {Object}
   */
  spawnParked(type, pos, heading) {
    const car = this.addCar(type, pos, heading);
    car.speed = 0;
    car.driver = null;
    return car;
  }

  /**
   * Pick a weighted random traffic type from config.
   * @private
   */
  _pickTrafficType() {
    const keys = Object.keys(this.carTypes);
    if (!keys.length) return 'sedan';
    return keys[Math.floor(Math.random() * keys.length)];
  }

  /**
   * Get the currently player-driven car, if any.
   */
  get playerCar() {
    return this.vehicles.find(c => c.driver === 'player') || null;
  }

  /**
   * Mark a car as driven by the player (or clear it with null).
   * @param {Object|null} car
   */
  set playerCar(car) {
    for (const c of this.vehicles) {
      if (c.driver === 'player') c.driver = 'traffic';
    }
    if (car) {
      car.driver = 'player';
      car.speed = 0;
    }
  }

  /**
   * Eject any driver from a car (carjacking).
   * @param {Object} car
   * @param {Object} ctx - shared context for peds/events.
   */
  stealCar(car, ctx) {
    if (car.driver === 'player') return;
    if (ctx && ctx.peds && typeof ctx.peds.panicFrom === 'function') {
      ctx.peds.panicFrom(car.pos, car);
    }
    if (ctx && ctx.events && typeof ctx.events.emit === 'function') {
      ctx.events.emit('carjack', car);
    }
    car.driver = 'player';
    car.speed = 0;
  }

  /**
   * Apply damage to a car; handle smoke, fire and explosion.
   * @param {Object} car
   * @param {number} amount
   * @param {Object} ctx
   */
  damage(car, amount, ctx) {
    car.hp = (car.hp || 100) - amount;
    if (car.hp <= 0) {
      this._explode(car, ctx);
      this.removeCar(car);
    }
  }

  /**
   * Explode a car with a flash, audio and area damage.
   * @private
   */
  _explode(car, ctx) {
    if (ctx && ctx.audio && typeof ctx.audio.explosion === 'function') {
      ctx.audio.explosion();
    }
    const impact = new this.T.Vector3().copy(car.pos);
    for (const other of this.vehicles.slice()) {
      if (other === car) continue;
      if (other.pos.distanceTo(impact) < 6) {
        this.damage(other, 60, ctx);
      }
    }
  }

  /**
   * Animate wheel spin and any cosmetic parts each tick.
   * @param {Object} car
   * @param {number} dt
   */
  _spinWheels(car, dt) {
    if (!car.mesh) return;
    car.mesh.traverse((child) => {
      if (child.isMesh && child.userData && child.userData.isWheel) {
        child.rotation.x += car.speed * dt;
      }
    });
  }

  /**
   * Keep traffic from overlapping: push cars apart along their heading.
   * @param {Object} car
   */
  _avoidCollision(car) {
    for (const other of this.vehicles) {
      if (other === car) continue;
      const d = car.pos.distanceTo(other.pos);
      if (d < 2.5) {
        const dir = new this.T.Vector3()
          .subVectors(car.pos, other.pos)
          .normalize();
        car.pos.addScaledVector(dir, (2.5 - d) * 0.5);
      }
    }
  }

  /**
   * Deactivate cars that have drifted too far from the player.
   * @param {THREE.Vector3} center
   * @param {number} radius
   */
  cullDistant(center, radius) {
    const r = radius || 120;
    for (const car of this.vehicles.slice()) {
      if (car.driver === 'player') continue;
      if (car.pos.distanceTo(center) > r) {
        this.removeCar(car);
      }
    }
  }

  /**
   * Count how many cars of a given type are currently active.
   * @param {string} type
   * @returns {number}
   */
  countByType(type) {
    return this.vehicles.filter(c => c.active && c.type === type).length;
  }

  /**
   * Random color for a spawned car based on config palette.
   * @returns {number}
   */
  _randomColor() {
    const palette = this.config.COLORS || [0x88ccff, 0xcc4444, 0x44cc44];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  /**
   * Serialize a lightweight snapshot of all active cars.
   * @returns {Array<Object>}
   */
  snapshot() {
    return this.vehicles
      .filter(c => c.active)
      .map(c => ({
        type: c.type,
        x: c.pos.x,
        z: c.pos.z,
        heading: c.heading,
        speed: c.speed,
        driver: c.driver || null,
      }));
  }

  /**
   * Restore the vehicle system from a saved snapshot.
   * @param {Array<Object>} data
   */
  restore(data) {
    this.reset();
    if (!Array.isArray(data)) return;
    for (const rec of data) {
      const pos = new this.T.Vector3(rec.x, 0, rec.z);
      const car = this.addCar(rec.type || 'sedan', pos, rec.heading || 0);
      car.speed = rec.speed || 0;
      car.driver = rec.driver || 'traffic';
    }
  }
  
  /**
   * Calculate the distance between two vehicles.
   * @param {Object} a - First vehicle
   * @param {Object} b - Second vehicle
   * @returns {number} Distance between vehicles
   */
  distanceBetween(a, b) {
    return a.pos.distanceTo(b.pos);
  }
  
  /**
   * Check if two vehicles are colliding.
   * @param {Object} a - First vehicle
   * @param {Object} b - Second vehicle
   * @returns {boolean} True if vehicles are colliding
   */
  isColliding(a, b) {
    const distance = this.distanceBetween(a, b);
    const widthA = this.carTypes[a.type]?.width || 2;
    const widthB = this.carTypes[b.type]?.width || 2;
    const lengthA = this.carTypes[a.type]?.length || 4;
    const lengthB = this.carTypes[b.type]?.length || 4;
    
    // Simple collision detection based on bounding boxes
    return distance < (widthA + widthB) / 2 + (lengthA + lengthB) / 2;
  }
  
  /**
   * Handle collision between vehicles.
   * @param {Object} a - First vehicle
   * @param {Object} b - Second vehicle
   * @param {Object} ctx - Shared context
   */
  handleCollision(a, b, ctx) {
    if (!a.active || !b.active) return;
    
    if (this.isColliding(a, b)) {
      // Simple collision response
      const damage = 10;
      this.damage(a, damage, ctx);
      this.damage(b, damage, ctx);
      
      // Add some visual feedback
      if (ctx && ctx.events && typeof ctx.events.emit === 'function') {
        ctx.events.emit('collision', { vehicleA: a, vehicleB: b });
      }
    }
  }
  
  /**
   * Get all vehicles within a certain radius.
   * @param {THREE.Vector3} center - Center position
   * @param {number} radius - Search radius
   * @returns {Array<Object>} Vehicles within radius
   */
  vehiclesInRadius(center, radius) {
    return this.vehicles.filter(car => {
      return car.active && car.pos.distanceTo(center) <= radius;
    });
  }
  
  /**
   * Find the closest vehicle to a position.
   * @param {THREE.Vector3} pos - Position to check from
   * @param {number} maxDist - Maximum distance to consider
   * @returns {Object|null} Closest vehicle or null
   */
  closestVehicle(pos, maxDist) {
    let closest = null;
    let minDist = maxDist || Infinity;
    
    for (const car of this.vehicles) {
      if (!car.active) continue;
      
      const dist = car.pos.distanceTo(pos);
      if (dist < minDist) {
        minDist = dist;
        closest = car;
      }
    }
    
    return closest;
  }
  
  /**
   * Set up event listeners for vehicle-related events.
   * @param {Object} ctx - Shared context with event system
   */
  setupEvents(ctx) {
    if (ctx && ctx.events && typeof ctx.events.on === 'function') {
      ctx.events.on('vehicleDamage', (data) => {
        this.damage(data.vehicle, data.amount, ctx);
      });
      
      ctx.events.on('spawnVehicle', (data) => {
        const pos = new this.T.Vector3(data.x, 0, data.z);
        this.addCar(data.type, pos, data.heading);
      });
    }
  }
}
