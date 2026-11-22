// Sunfall City — game.js
// The conductor: owns the player, camera, input, the state machine
// (title / playing / paused / busted / wasted), saving to localStorage, the
// main loop, and the order everything is drawn in. All other files hang off
// the global Game object created here.

var Game = {
  state: 'title',
  player: null,
  camera: { x: 0, y: 0, w: 1280, h: 800 },
  input: { up: false, down: false, left: false, right: false, sprint: false },
  mouse: { x: 0, y: 0, down: false, active: false },
  notifyText: '',
  notifyTimer: 0,
  hurtTimer: 0,
  endTimer: 0,
  frozen: false,       // screenshot staging sets this to hold a posed scene
  started: false,

  // --- lifecycle -------------------------------------------------------------
  boot: function () {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', function () { Game.resize(); });
    World.build();
    this.player = People.makePlayer();
    Vehicles.reset();
    People.resetPeds();
    this.bindInput();
    this.bindMenu();
    this.updateContinueButton();
    this.lastTime = performance.now();
    requestAnimationFrame(function (t) { Game.frame(t); });
  },

  resize: function () {
    var w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = w; this.canvas.height = h;
    this.camera.w = w; this.camera.h = h;
  },

  newGame: function () {
    this.player = People.makePlayer();
    this.player.cash = 0;
    Missions.reset();
    Police.clear();
    Combat.reset();
    Vehicles.reset();
    People.resetPeds();
    this.state = 'playing';
    this.started = true;
    this.hideMenu();
    Missions.startBanner();
    this.notify('Welcome to Sunfall City, Jae.');
    this.saveGame();
  },

  continueGame: function () {
    var save = this.loadSave();
    if (!save) { this.newGame(); return; }
    this.player = People.makePlayer();
    this.player.cash = save.cash || 0;
    this.player.x = save.x || this.player.x;
    this.player.y = save.y || this.player.y;
    Missions.reset();
    Missions.index = clamp(save.missionIndex || 0, 0, 4);
    Police.clear();
    Combat.reset();
    Vehicles.reset();
    People.resetPeds();
    World.collide(this.player, this.player.r);
    this.state = 'playing';
    this.started = true;
    this.hideMenu();
    this.notify('Welcome back to Sunfall City.');
    if (Missions.index < 4) Missions.startBanner();
  },

  // --- save / load -------------------------------------------------------------
  saveGame: function () {
    if (!this.player) return;
    try {
      localStorage.setItem('sunfallCitySaveV1', JSON.stringify({
        cash: this.player.cash,
        missionIndex: Missions.index,
        x: Math.round(this.player.driving && this.player.car ? this.player.car.x : this.player.x),
        y: Math.round(this.player.driving && this.player.car ? this.player.car.y : this.player.y)
      }));
    } catch (e) { /* storage unavailable — play on without saving */ }
    this.updateContinueButton();
  },
  loadSave: function () {
    try {
      var raw = localStorage.getItem('sunfallCitySaveV1');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  updateContinueButton: function () {
    var btn = document.getElementById('btnContinue');
    if (btn) btn.disabled = !this.loadSave();
  },

  // --- feedback ----------------------------------------------------------------
  notify: function (text) { this.notifyText = text; this.notifyTimer = 3.4; },
  addCash: function (amount) { this.player.cash += amount; },
  damagePlayer: function (amount, cause) {
    var p = this.player;
    if (!p || p.dead || this.state !== 'playing') return;
    p.hp -= amount;
    this.hurtTimer = 0.35;
    if (p.hp <= 0) { p.hp = 0; this.onWasted(); }
  },
  onGuardDown: function (guard) {
    this.addCash(50);
    this.notify('Guard down — +$50');
  },

  onBusted: function () {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.endTimer = 2.8;
    Sfx.busted(); Sfx.stopSiren(); Sfx.stopEngine();
    var fine = Math.min(this.player.cash, 120);
    this.player.cash -= fine;
  },
  onWasted: function () {
    if (this.state !== 'playing') return;
    this.player.dead = true;
    this.state = 'wasted';
    this.endTimer = 2.8;
    Sfx.stopSiren(); Sfx.stopEngine();
  },
  respawn: function () {
    var p = this.player;
    if (p.driving) Vehicles.exitCar(p);
    p.x = World.playerSpawn.x; p.y = World.playerSpawn.y;
    p.hp = CFG.PLAYER_MAX_HP; p.dead = false;
    Police.clear();
    Combat.reset();
    Missions.restartCurrent();
    this.state = 'playing';
    this.notify('Back on the streets of Sunfall.');
    this.saveGame();
  }
};

// --- input -------------------------------------------------------------------
Game.bindInput = function () {
  var keyMap = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right'
  };
  window.addEventListener('keydown', function (e) {
    if (keyMap[e.code]) { Game.input[keyMap[e.code]] = true; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') Game.input.sprint = true;
    if (e.repeat) return;
    if (e.code === 'KeyE' && Game.state === 'playing') Game.toggleVehicle();
    if (e.code === 'KeyM') { var m = Sfx.toggleMute(); Game.notify(m ? 'Sound off' : 'Sound on'); }
    if ((e.code === 'KeyP' || e.code === 'Escape')) {
      if (Game.state === 'playing') Game.state = 'paused';
      else if (Game.state === 'paused') Game.state = 'playing';
    }
    if (e.code === 'Enter' && Game.state === 'playing' && Missions.index >= 4) Missions.replay();
  });
  window.addEventListener('keyup', function (e) {
    if (keyMap[e.code]) Game.input[keyMap[e.code]] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') Game.input.sprint = false;
  });
  this.canvas.addEventListener('mousemove', function (e) {
    var r = Game.canvas.getBoundingClientRect();
    Game.mouse.x = e.clientX - r.left; Game.mouse.y = e.clientY - r.top;
    Game.mouse.active = true;
  });
  this.canvas.addEventListener('mousedown', function (e) {
    Sfx.init();
    if (e.button === 0) Game.mouse.down = true;
  });
  window.addEventListener('mouseup', function () { Game.mouse.down = false; });
  this.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
};

Game.bindMenu = function () {
  var self = this;
  document.getElementById('btnNew').addEventListener('click', function () { Sfx.init(); self.newGame(); });
  document.getElementById('btnContinue').addEventListener('click', function () { Sfx.init(); self.continueGame(); });
};
Game.hideMenu = function () {
  var el = document.getElementById('menu');
  if (el) el.style.display = 'none';
};
Game.toggleVehicle = function () {
  var p = this.player;
  if (p.driving) Vehicles.exitCar(p);
  else if (Vehicles.enterNearest(p)) this.notify('Car stolen! The heat may notice…');
};

// --- simulation ----------------------------------------------------------------
Game.update = function (dt) {
  var p = this.player;
  if (this.notifyTimer > 0) this.notifyTimer -= dt;
  if (this.hurtTimer > 0) this.hurtTimer -= dt;

  if (this.state === 'busted' || this.state === 'wasted') {
    this.endTimer -= dt;
    Vehicles.updateTraffic(dt);
    if (this.endTimer <= 0) this.respawn();
    return;
  }
  if (this.state !== 'playing') return;

  if (p.driving && p.car) Vehicles.drivePlayer(p.car, this.input, dt);
  else People.updatePlayer(p, this.input, dt);
  // The player avatar rides inside the car while driving.
  if (p.driving && p.car) { p.x = p.car.x; p.y = p.car.y; }

  Vehicles.updateTraffic(dt);
  Vehicles.updateCollisions(dt);
  People.updatePeds(dt);
  Police.update(dt);
  Combat.update(dt);
  Missions.update(dt);

  // Camera follows the player (or their car).
  var fx = p.driving && p.car ? p.car.x : p.x;
  var fy = p.driving && p.car ? p.car.y : p.y;
  this.camera.x = clamp(fx - this.camera.w / 2, 0, Math.max(0, CFG.WORLD_W - this.camera.w));
  this.camera.y = clamp(fy - this.camera.h / 2, 0, Math.max(0, CFG.WORLD_H - this.camera.h));
};

// --- drawing -------------------------------------------------------------------
Game.render = function () {
  var ctx = this.ctx, cam = this.camera, p = this.player;
  ctx.fillStyle = CFG.COLORS.waterDeep;
  ctx.fillRect(0, 0, cam.w, cam.h);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  World.draw(ctx, cam);
  var m = (this.state === 'playing' || this.state === 'paused') ? Missions.marker() : null;
  if (m) World.drawMarker(ctx, m);
  // Mission 4's cash case sits on the dock as a bright briefcase.
  if (Missions.index === 3 && Missions.stage === 1) {
    var kx = World.marina.x - 30, ky = World.marina.y - 60;
    ctx.fillStyle = '#8d6e63';
    roundRect(ctx, kx - 11, ky - 8, 22, 16, 3); ctx.fill();
    ctx.fillStyle = '#ffd83d';
    ctx.fillRect(kx - 11, ky - 2, 22, 3);
  }
  for (var i = 0; i < People.peds.length; i++) People.drawPed(ctx, People.peds[i]);
  Combat.drawGuards(ctx);
  for (var j = 0; j < Vehicles.list.length; j++) Vehicles.draw(ctx, Vehicles.list[j]);
  People.drawPlayer(ctx, p);
  Combat.drawBullets(ctx);
  ctx.restore();

  // Off-screen objective arrow at the screen edge.
  if (m && this.state === 'playing') this.drawMarkerArrow(ctx, m);

  if (this.started && this.state !== 'title') Hud.draw(ctx, cam.w, cam.h);
  if (this.hurtTimer > 0) {
    ctx.fillStyle = 'rgba(231,76,60,' + (this.hurtTimer * 0.55) + ')';
    ctx.fillRect(0, 0, cam.w, cam.h);
  }
  if (this.state === 'paused') this.drawBigText(ctx, 'PAUSED', 'Press P to resume');
  if (this.state === 'busted') this.drawBigText(ctx, 'BUSTED', 'The Sunfall PD got you. Fine paid.');
  if (this.state === 'wasted') this.drawBigText(ctx, 'WASTED', 'You wake up back in the city…');
  // Title backdrop: slow pan across the city behind the menu.
  if (this.state === 'title') {
    var t = performance.now() / 1000;
    this.camera.x = clamp(1200 + Math.sin(t * 0.05) * 700 - cam.w / 2 + cam.w / 2, 0, Math.max(0, CFG.WORLD_W - cam.w));
    this.camera.y = clamp(1000 + Math.cos(t * 0.04) * 420, 0, Math.max(0, CFG.WORLD_H - cam.h));
  }
};

Game.drawMarkerArrow = function (ctx, m) {
  var cam = this.camera;
  var sx = m.x - cam.x, sy = m.y - cam.y;
  if (sx > 0 && sx < cam.w && sy > 0 && sy < cam.h) return; // on screen already
  var cx = clamp(sx, 36, cam.w - 36), cy = clamp(sy, 36, cam.h - 36);
  var a = Math.atan2(sy - cy, sx - cx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = CFG.COLORS.marker;
  ctx.beginPath();
  ctx.moveTo(15, 0); ctx.lineTo(-9, -9); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill();
  ctx.restore();
};

Game.drawBigText = function (ctx, title, sub) {
  var w = this.camera.w, h = this.camera.h;
  ctx.fillStyle = 'rgba(10,10,16,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = title === 'BUSTED' ? '#5aa2ff' : (title === 'WASTED' ? '#ff5a4d' : '#ffffff');
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, w / 2, h / 2 - 8);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '17px Arial';
  ctx.fillText(sub, w / 2, h / 2 + 30);
};

// --- main loop -------------------------------------------------------------------
Game.frame = function (t) {
  var dt = Math.min(0.033, (t - this.lastTime) / 1000 || 0.016);
  this.lastTime = t;
  if (!this.frozen) this.update(dt);
  this.render();
  var self = this;
  requestAnimationFrame(function (nt) { self.frame(nt); });
};

// Exposed for the screenshot staging (shots.js) and curious consoles.
window.Sunfall = Game;

window.addEventListener('DOMContentLoaded', function () { Game.boot(); });
