// Keyboard and mouse input: key/mouse state, per-frame edges, movement axes, and pointer lock.

/** Key codes whose browser default action is suppressed while the game is playing. */
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight',
  'KeyE', 'KeyF', 'KeyQ', 'KeyR', 'KeyH', 'KeyL',
  'Digit1', 'Digit2', 'Digit3', 'Digit4',
  'Tab', 'Escape'
]);

/** Keyboard and mouse input with edge detection and pointer lock, independent of ctx. */
export class Input {
  /** Creates window/document listeners and locks the pointer on click of the given canvas. */
  constructor(canvas = null) {
    this.keys = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: new Set(), wheel: 0 };
    this.pressedKeys = new Set();
    this.releasedKeys = new Set();
    this.pressedButtons = new Set();
    this.capture = false;
    this.locked = false;
    this.canvas = canvas || document.querySelector('canvas');
    this.lastX = 0;
    this.lastY = 0;
    this.hasLastMouse = false;

    this.onKeyDown = (event) => {
      if (this.capture && GAME_KEYS.has(event.code)) event.preventDefault();
      if (!event.repeat && !this.keys.has(event.code)) this.pressedKeys.add(event.code);
      this.keys.add(event.code);
    };
    this.onKeyUp = (event) => {
      this.keys.delete(event.code);
      this.releasedKeys.add(event.code);
    };
    this.onBlur = () => {
      this.keys.clear();
      this.mouse.buttons.clear();
    };
    this.onMouseDown = (event) => {
      if (this.capture) event.preventDefault();
      if (!this.mouse.buttons.has(event.button)) this.pressedButtons.add(event.button);
      this.mouse.buttons.add(event.button);
    };
    this.onMouseUp = (event) => {
      this.mouse.buttons.delete(event.button);
    };
    this.onMouseMove = (event) => {
      if (this.locked) {
        this.mouse.dx += event.movementX || 0;
        this.mouse.dy += event.movementY || 0;
        return;
      }
      if (this.hasLastMouse) {
        this.mouse.dx += event.clientX - this.lastX;
        this.mouse.dy += event.clientY - this.lastY;
      }
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.hasLastMouse = true;
    };
    this.onWheel = (event) => {
      if (this.capture) event.preventDefault();
      this.mouse.wheel += Math.sign(event.deltaY);
    };
    this.onCanvasClick = () => {
      if (!this.canvas || this.locked || !this.canvas.requestPointerLock) return;
      const request = this.canvas.requestPointerLock();
      if (request && typeof request.catch === 'function') request.catch(() => {});
    };
    this.onPointerLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
    };

    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('mousedown', this.onMouseDown, { passive: false });
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    if (this.canvas) this.canvas.addEventListener('click', this.onCanvasClick);
  }

  /** Enables or disables preventDefault for game keys (true while state.mode is 'play'). */
  setCapture(enabled) {
    this.capture = !!enabled;
  }

  /** Returns true if a key was pressed since the previous consume() call. */
  pressed(code) {
    return this.pressedKeys.has(code);
  }

  /** Returns true if a key was released since the previous consume() call. */
  released(code) {
    return this.releasedKeys.has(code);
  }

  /** Returns true if a key is currently held down. */
  down(code) {
    return this.keys.has(code);
  }

  /** Returns true if a mouse button was pressed since the previous consume() call. */
  mousePressed(button = 0) {
    return this.pressedButtons.has(button);
  }

  /** Returns true if a mouse button is currently held down. */
  mouseDown(button = 0) {
    return this.mouse.buttons.has(button);
  }

  /** Returns a normalized WASD/arrow axis: x right-positive, y forward-positive. */
  axis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  /** Clears per-frame edges, mouse deltas, and wheel steps; call once per frame. */
  consume() {
    this.pressedKeys.clear();
    this.releasedKeys.clear();
    this.pressedButtons.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
  }

  /** Releases pointer lock, e.g. when opening the pause menu. */
  unlock() {
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  /** Removes every listener so the input system can be disposed cleanly. */
  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    if (this.canvas) this.canvas.removeEventListener('click', this.onCanvasClick);
  }
}
