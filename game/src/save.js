// Persists campaign progress and radio settings in localStorage.

const SAVE_KEY = 'solmar-bay-save-v1';
const SAVE_VERSION = 1;
const AUTOSAVE_INTERVAL = 60;

/** Manages validated local campaign saves and periodic autosaving. */
export class SaveSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.elapsed = 0;
    this.storage = null;

    try {
      if (typeof localStorage !== 'undefined') this.storage = localStorage;
    } catch (error) {
      this.storage = null;
    }
  }

  /** Loads a valid save and merges supported fields into the live game state. */
  load() {
    if (!this.storage) return false;

    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!this.isValidSave(data)) return false;

      const state = this.ctx.state;
      state.money = data.money;
      state.missionsDone = data.missionsDone.slice();
      state.missionIndex = data.missionIndex;

      if (this.ctx.missions) {
        if (Array.isArray(this.ctx.missions.completed)) {
          this.ctx.missions.completed = data.missionsDone.slice();
        }
        if (Number.isInteger(data.missionIndex)) {
          this.ctx.missions.index = data.missionIndex;
        }
      }

      state.wanted = 0;
      if (data.settings && typeof data.settings.radioStation === 'string') {
        state.radioStation = data.settings.radioStation;
        if (this.ctx.audio) this.ctx.audio.radioStation = data.settings.radioStation;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /** Stores campaign progress, completed missions, and the selected radio station. */
  saveProgress() {
    if (!this.storage) return false;

    try {
      const state = this.ctx.state;
      const completed = this.completedMissions();
      const money = Number.isFinite(state.money) ? Math.max(0, state.money) : 0;
      const data = {
        version: SAVE_VERSION,
        money,
        missionIndex: this.missionIndex(),
        missionsDone: completed,
        settings: { radioStation: this.radioStation() }
      };
      this.storage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      return false;
    }
  }

  /** Clears the autosave timer and persists immediately after a mission completes. */
  onMissionDone() {
    this.elapsed = 0;
    return this.saveProgress();
  }

  /** Advances the sixty second play timer and saves when its interval expires. */
  update(delta, mode = this.ctx.state.mode) {
    if (mode !== 'play' || !Number.isFinite(delta) || delta <= 0) return false;
    this.elapsed += delta;
    if (this.elapsed < AUTOSAVE_INTERVAL) return false;
    this.elapsed %= AUTOSAVE_INTERVAL;
    return this.saveProgress();
  }

  /** Removes the stored campaign for starting a new game from the menu. */
  wipe() {
    this.elapsed = 0;
    if (!this.storage) return false;
    try {
      this.storage.removeItem(SAVE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  isValidSave(data) {
    return Boolean(data && data.version === SAVE_VERSION &&
      Number.isFinite(data.money) && data.money >= 0 &&
      Number.isInteger(data.missionIndex) && data.missionIndex >= 0 &&
      Array.isArray(data.missionsDone) &&
      data.missionsDone.every((mission) => typeof mission === 'string'));
  }

  completedMissions() {
    const missions = this.ctx.missions;
    const source = missions && Array.isArray(missions.completed)
      ? missions.completed
      : this.ctx.state.missionsDone;
    return Array.isArray(source)
      ? [...new Set(source.filter((mission) => typeof mission === 'string'))]
      : [];
  }

  missionIndex() {
    const missions = this.ctx.missions;
    const index = missions && Number.isInteger(missions.index)
      ? missions.index
      : this.ctx.state.missionIndex;
    return Number.isInteger(index) && index >= 0 ? index : 0;
  }

  radioStation() {
    const audio = this.ctx.audio;
    const station = audio && typeof audio.radioStation === 'string'
      ? audio.radioStation
      : this.ctx.state.radioStation;
    return typeof station === 'string' ? station : '';
  }
}
