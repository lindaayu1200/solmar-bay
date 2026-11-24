// Solmar Bay player controller, avatar, and third-person camera.

/** Controls the on-foot player, vehicles, and follow camera. */
export class Player {
  constructor(ctx) {
    this.ctx = ctx;
    this.T = ctx.T;
    this.pos = new this.T.Vector3(0, 0, 0);
    this.velocity = new this.T.Vector3();
    this.currentCar = null;
    this.onFoot = true;
    this.yaw = 0;
    this.pitch = -0.18;
    this.cameraDistance = 6;
    this.cameraTargetDistance = 6;
    this.cameraHeight = 1.7;
    this.cameraLook = new this.T.Vector3();
    this.cameraDesired = new this.T.Vector3();
    this.walkTime = 0;
    this.keyWasDown = false;
    this.createAvatar();
  }

  createAvatar() {
    const T = this.T;
    const root = new T.Group();
    const skin = new T.MeshStandardMaterial({ color: 0xb97854, roughness: 0.9 });
    const shirt = new T.MeshStandardMaterial({ color: 0xf2eee0, roughness: 0.9 });
    const pants = new T.MeshStandardMaterial({ color: 0x252b35, roughness: 0.95 });
    const cap = new T.MeshStandardMaterial({ color: 0x294f4b, roughness: 0.85 });
    const makePart = (geometry, material, x, y, z) => {
      const mesh = new T.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      root.add(mesh);
      return mesh;
    };

    makePart(new T.BoxGeometry(0.62, 0.82, 0.34), shirt, 0, 1.35, 0);
    makePart(new T.BoxGeometry(0.25, 0.3, 0.27), skin, 0, 1.93, 0);
    makePart(new T.BoxGeometry(0.38, 0.11, 0.38), cap, 0, 2.12, 0);
    this.leftLeg = makePart(new T.BoxGeometry(0.23, 0.72, 0.25), pants, -0.17, 0.63, 0);
    this.rightLeg = makePart(new T.BoxGeometry(0.23, 0.72, 0.25), pants, 0.17, 0.63, 0);
    makePart(new T.BoxGeometry(0.2, 0.68, 0.23), skin, -0.42, 1.35, 0);
    makePart(new T.BoxGeometry(0.2, 0.68, 0.23), skin, 0.42, 1.35, 0);
    root.position.copy(this.pos);
    this.avatar = root;
    this.ctx.scene.add(root);
  }

  update(dt) {
    const input = this.ctx.input;
    const enterDown = input.isDown('KeyE');
    if (enterDown && !this.keyWasDown) {
      if (this.currentCar) this.exitCar();
      else this.tryEnterCar();
    }
    this.keyWasDown = enterDown;

    if (this.onFoot) this.updateOnFoot(dt);
    else this.updateInCar(dt);
    this.updateCamera(dt);
  }

  updateOnFoot(dt) {
    const input = this.ctx.input;
    const x = input.axis.x;
    const z = input.axis.y;
    const magnitude = Math.min(1, Math.hypot(x, z));
    if (magnitude > 0.01) {
      const cameraYaw = this.yaw;
      const forwardX = -Math.sin(cameraYaw);
      const forwardZ = -Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);
      const speed = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? 7 : 4.2;
      const dx = (rightX * x + forwardX * z) * speed * dt;
      const dz = (rightZ * x + forwardZ * z) * speed * dt;
      this.pos.x += dx;
      this.pos.z += dz;
      this.ctx.world.resolveCircle(this.pos, 0.6);
      this.avatar.rotation.y = Math.atan2(dx, dz);
      this.walkTime += dt * speed * 1.8;
      this.leftLeg.rotation.x = Math.sin(this.walkTime) * 0.42 * magnitude;
      this.rightLeg.rotation.x = -Math.sin(this.walkTime) * 0.42 * magnitude;
    } else {
      this.leftLeg.rotation.x *= 0.85;
      this.rightLeg.rotation.x *= 0.85;
    }
    this.avatar.position.copy(this.pos);
  }

  updateInCar(dt) {
    const input = this.ctx.input;
    this.ctx.vehicles.updatePlayer(this.currentCar, {
      throttle: input.axis.y,
      brake: input.isDown('Space') ? 1 : 0,
      steer: input.axis.x,
      handbrake: input.isDown('Space'),
    }, dt);
    this.pos.copy(this.currentCar.mesh.position);
  }

  updateCamera(dt) {
    const input = this.ctx.input;
    const look = input.pointerDelta;
    if (look) {
      this.yaw -= look.x * 0.0025;
      this.pitch = this.T.MathUtils.clamp(this.pitch - look.y * 0.002, -0.65, 0.35);
    }

    const target = this.currentCar
      ? this.currentCar.mesh.position
      : this.pos;
    const focusHeight = this.currentCar ? 1.25 : 1.45;
    this.cameraLook.set(target.x, target.y + focusHeight, target.z);
    const distance = this.currentCar ? 8 : this.cameraDistance;
    const horizontal = Math.cos(this.pitch) * distance;
    this.cameraDesired.set(
      this.cameraLook.x - Math.sin(this.yaw) * horizontal,
      this.cameraLook.y - Math.sin(this.pitch) * distance + this.cameraHeight,
      this.cameraLook.z - Math.cos(this.yaw) * horizontal,
    );
    this.ctx.camera.position.lerp(this.cameraDesired, 1 - Math.exp(-8 * dt));
    this.ctx.camera.lookAt(this.cameraLook);
  }

  enterVehicle(car) {
    if (!car || !this.onFoot) return false;
    this.currentCar = car;
    this.onFoot = false;
    this.avatar.visible = false;
    this.pos.copy(car.mesh.position);
    return true;
  }

  leaveVehicle() {
    if (!this.currentCar) return false;
    const car = this.currentCar;
    const heading = car.mesh.rotation.y;
    this.pos.set(
      car.mesh.position.x + Math.cos(heading) * 1.8,
      car.mesh.position.y,
      car.mesh.position.z - Math.sin(heading) * 1.8,
    );
    this.currentCar = null;
    this.onFoot = true;
    this.avatar.visible = true;
    this.avatar.position.copy(this.pos);
    return true;
  }

  update(dt) {
    const input = this.ctx.input;
    if (input.pressed('KeyE')) {
      if (this.currentCar) {
        this.leaveVehicle();
      } else {
        const car = this.ctx.vehicles.nearest(this.pos, 3.2);
        if (car) this.enterVehicle(car);
      }
    }

    if (this.currentCar) this.updateInCar(dt);
    else this.updateOnFoot(dt);
    this.updateCamera(dt);
  }
}
