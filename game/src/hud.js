// Solmar Bay HUD: minimap, player status, missions, and notifications.
/** Owns and updates the game's DOM interface. */
export class Hud {
  constructor(ctx) {
    this.ctx = ctx;
    this.root = document.getElementById('hud') || document.body;
    this.nodes = {};
    this.toastQueue = [];
    this.last = {};
    this.moneyShown = Number(ctx.state.money) || 0;
    this.moneyTarget = this.moneyShown;
    this.moneyChanged = performance.now();
    this.ensureDom();
  }

  /** Creates HUD elements when the page has not supplied them. */
  ensureDom() {
    const make = (id, css, selector) => {
      let n = document.getElementById(id);
      if (!n && selector) n = this.root.querySelector(selector);
      if (!n) { n = document.createElement('div'); this.root.appendChild(n); }
      n.dataset.hudId = id;
      Object.assign(n.style, { position: 'fixed', zIndex: '5', color: '#fff4dc',
        fontFamily: 'system-ui, sans-serif', textShadow: '0 2px 5px #21170f', pointerEvents: 'none', ...css });
      this.nodes[id] = n;
      return n;
    };
    const map = document.getElementById('minimap') || document.createElement('canvas');
    if (!map.id) { map.id = 'minimap'; this.root.appendChild(map); }
    Object.assign(map.style, { position: 'fixed', left: '24px', bottom: '24px', width: '190px', height: '190px',
      borderRadius: '50%', border: '2px solid rgba(255,240,210,.8)', zIndex: '5' });
    map.width = map.height = 190; this.map = map; this.g = map.getContext('2d');
    make('hud-wanted', { right: '28px', top: '20px', fontSize: '26px', letterSpacing: '5px' }, '.stars');
    make('hud-money', { right: '30px', top: '56px', fontSize: '20px' }, '.money');
    make('hud-status', { right: '30px', bottom: '28px', textAlign: 'right', fontSize: '15px', lineHeight: '1.6' });
    make('hud-speed', { right: '30px', bottom: '95px', textAlign: 'right', fontSize: '38px', fontWeight: '700' }, '.speedo');
    make('hud-mission', { left: '28px', top: '24px', maxWidth: '340px', fontSize: '16px', lineHeight: '1.5' }, '.objective');
    make('hud-dialog', { display: 'none', left: '50%', bottom: '34px', transform: 'translateX(-50%)',
      background: 'rgba(24,31,32,.82)', padding: '14px 24px', minWidth: '300px', textAlign: 'center' }, '.dialog');
    make('hud-radio', { display: 'none', left: '28px', bottom: '230px', fontSize: '14px' });
    make('hud-district', { display: 'none', left: '50%', top: '14%', transform: 'translateX(-50%)',
      fontFamily: 'Georgia, serif', fontSize: '30px', letterSpacing: '4px' }, '.district');
    make('hud-overlay', { display: 'none', inset: '0', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(15,10,10,.48)', fontSize: '64px', letterSpacing: '14px' });
    make('hud-toast', { display: 'none', left: '50%', top: '22%', transform: 'translateX(-50%)',
      fontSize: '18px', background: 'rgba(20,25,25,.72)', padding: '8px 16px' }, '.toast');
    make('hud-help', { display: 'none', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      background: 'rgba(20,25,25,.9)', padding: '22px', lineHeight: '1.7', textAlign: 'center' });
    const overlay = document.getElementById('overlay');
    if (overlay) this.nodes['hud-overlay'] = overlay;
  }

  /** Queues a short HUD notification. */
  toast(text) { this.toastQueue.push({ text, until: performance.now() + 2600 }); }
  /** Displays or hides the page-provided start screen. */
  showStart(hidden = false) {
    const n = document.getElementById('start') || document.getElementById('start-screen');
    if (n) n.hidden = hidden;
    if (hidden) {
      const hud = document.getElementById('hud');
      const crosshair = document.getElementById('crosshair');
      if (hud) hud.hidden = false;
      if (crosshair) crosshair.hidden = false;
    }
  }
  /** Displays control help text. */
  showHelp(show = true) {
    this.nodes['hud-help'].style.display = show ? 'block' : 'none';
    this.nodes['hud-help'].innerHTML = 'SOLMAR BAY<br>WASD move / drive · Mouse aim / fire<br>E enter or exit · F interact · Esc pause';
  }
  /** Draws the north-up minimap and player heading marker. */
  drawMap() {
    const g = this.g, s = this.ctx, w = this.map.width;
    g.clearRect(0, 0, w, w); g.save(); g.beginPath(); g.arc(95, 95, 94, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#2d7775'; g.fillRect(0, 0, w, w);
    const p = s.player?.position || s.player?.mesh?.position || { x: 0, z: 0 };
    if (s.world?.minimapDraw) s.world.minimapDraw(g, 95, 95, 0.55, p);
    const dots = (items, color) => (items || []).forEach(o => { const q = o.position || o.mesh?.position || o;
      if (Number.isFinite(q.x) && Number.isFinite(q.z)) { g.fillStyle = color; g.beginPath(); g.arc(95 + (q.x-p.x)*.55, 95 + (q.z-p.z)*.55, 2.5, 0, 7); g.fill(); } });
    dots(s.vehicles?.cars, '#fff'); dots(s.police?.units, '#62baff');
    const m = s.missions?.marker;
    if (m) { const q = m.position || m; g.fillStyle = '#ffd64a'; g.font = 'bold 14px sans-serif'; g.fillText('◆', 88+(q.x-p.x)*.55, 90+(q.z-p.z)*.55); }
    const heading = s.player?.heading || s.player?.rotation?.y || 0;
    g.translate(95, 95); g.rotate(-heading); g.fillStyle = '#fff'; g.beginPath();
    g.moveTo(0,-9); g.lineTo(6,7); g.lineTo(0,4); g.lineTo(-6,7); g.fill(); g.restore();
  }

  /** Refreshes visible HUD values from the shared game context. */
  update(dt = 1 / 60) {
    const s = this.ctx.state, now = performance.now(), set = (id, value) => {
      if (this.last[id] !== value) { this.nodes[id].textContent = value; this.last[id] = value; }
    };
    this.drawMap();
    const wanted = Math.max(0, Math.min(5, Number(s.wanted) || 0));
    set('hud-wanted', '★'.repeat(wanted) + '☆'.repeat(5-wanted));
    if (Number(s.money) !== this.moneyTarget) { this.moneyTarget = Number(s.money) || 0; this.moneyChanged = now; }
    this.moneyShown += (this.moneyTarget-this.moneyShown) * Math.min(1, dt*5);
    set('hud-money', '$ ' + Math.round(this.moneyShown).toLocaleString());
    const key = this.ctx.combat?.weapon;
    const weapon = key && this.ctx.combat?.weapons ? this.ctx.combat.weapons[key] : {};
    const ammo = weapon.ammo ?? weapon.reserve ?? '';
    const status = `HEALTH ${Math.ceil(s.health ?? 100)}  ARMOR ${Math.ceil(s.armor ?? 0)}<br>Weapon: ${weapon.name || 'Unarmed'}  ${ammo}`;
    if (this.last['hud-status'] !== status) { this.nodes['hud-status'].innerHTML = status; this.last['hud-status'] = status; }
    const car = this.ctx.vehicles?.current || this.ctx.player?.vehicle;
    const speed = Math.round(Math.abs(car?.speed || 0) * 3.6);
    this.nodes['hud-speed'].style.display = car ? 'block' : 'none';
    this.nodes['hud-speed'].innerHTML = car ? `${speed} <small>KM/H</small><br><small>${car.name || car.type || 'VEHICLE'}</small>` : '';
    const mission = s.mission || this.ctx.missions?.current;
    this.nodes['hud-mission'].innerHTML = mission ? `<b>${mission.giver || mission.name || 'MISSION'}</b><br>${mission.objective || mission.brief || mission.text || ''}${mission.timeLeft != null ? `<br>${Math.ceil(mission.timeLeft)}s` : ''}` : '';
    const dialog = this.ctx.missions?.dialog;
    this.nodes['hud-dialog'].style.display = dialog ? 'block' : 'none';
    this.nodes['hud-dialog'].innerHTML = dialog ? `<b>${dialog.speaker || ''}</b><br>${dialog.text || dialog}<br><small>E TO CONTINUE</small>` : '';
    this.banner('hud-radio', this.ctx.audio?.station, now, 3500);
    this.banner('hud-district', s.district, now, 2500);
    const mode = s.mode === 'dead' ? 'WASTED' : s.mode === 'busted' ? 'BUSTED' : '';
    this.nodes['hud-overlay'].style.display = mode ? 'flex' : 'none'; this.nodes['hud-overlay'].textContent = mode;
    while (this.toastQueue.length && this.toastQueue[0].until < now) this.toastQueue.shift();
    if (this.toastQueue.length) { this.nodes['hud-toast'].style.display = 'block'; this.nodes['hud-toast'].textContent = this.toastQueue[0].text; }
    else this.nodes['hud-toast'].style.display = 'none';
  }

  /** Shows a transient radio or district banner when its value changes. */
  banner(id, value, now, duration) {
    const n = this.nodes[id], key = id + 'Value';
    if (value && value !== this.last[key]) { this.last[key] = value; this.last[key+'Until'] = now + duration; n.textContent = value; }
    const left = (this.last[key+'Until'] || 0) - now;
    n.style.display = left > 0 ? 'block' : 'none'; n.style.opacity = left < 500 ? String(Math.max(0, left/500)) : '1';
  }
}
