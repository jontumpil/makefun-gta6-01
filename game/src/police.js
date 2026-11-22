// Sunfall City — police.js
// The wanted system. Crimes add "heat"; every CFG.HEAT_PER_STAR points of heat
// is one star (max 5). Police cars spawn on nearby roads and hunt the player's
// current position — but they only *see* the player within SIGHT_RANGE. Stay
// unseen and the heat bleeds away; get pinned by a nearby cop while slow and
// the bust meter fills until BUSTED.

var Police = {
  heat: 0,
  unseenTime: 0,
  bustMeter: 0,      // 0..1
  forcedStars: 0,    // missions can hold a minimum wanted level
  lastKnownX: 0, lastKnownY: 0,

  stars: function () {
    var s = Math.floor(this.heat / CFG.HEAT_PER_STAR);
    return clamp(Math.max(s, this.forcedStars > 0 ? 1 : 0), 0, CFG.MAX_STARS);
  },
  displayStars: function () {
    return clamp(Math.max(Math.floor(this.heat / CFG.HEAT_PER_STAR), this.forcedStars), 0, CFG.MAX_STARS);
  },

  addHeat: function (amount, x, y) {
    this.heat = Math.min(this.heat + amount, CFG.HEAT_PER_STAR * CFG.MAX_STARS);
    this.lastKnownX = x; this.lastKnownY = y;
    this.unseenTime = 0;
  },

  setForced: function (stars) {
    this.forcedStars = stars;
    if (stars > 0) this.heat = Math.max(this.heat, stars * CFG.HEAT_PER_STAR - 6);
  },

  clear: function () { this.heat = 0; this.forcedStars = 0; this.bustMeter = 0; this.unseenTime = 0; },

  policeCars: function () {
    var out = [];
    for (var i = 0; i < Vehicles.list.length; i++) if (Vehicles.list[i].kind === 'police') out.push(Vehicles.list[i]);
    return out;
  },

  spawnCop: function () {
    var player = Game.player;
    // Spawn on a road 520–760px away so they arrive, not materialise.
    for (var tries = 0; tries < 12; tries++) {
      var p = World.randomRoadPoint();
      var d = dist2(p.x, p.y, player.x, player.y);
      if (d > 520 * 520 && d < 900 * 900) {
        var cop = Vehicles.makeCar(p.x, p.y, 0, CFG.COLORS.police, 'police');
        cop.cruise = CFG.POLICE_SPEED;
        Vehicles.list.push(cop);
        return cop;
      }
    }
    return null;
  },

  update: function (dt) {
    var player = Game.player;
    var px = player.driving && player.car ? player.car.x : player.x;
    var py = player.driving && player.car ? player.car.y : player.y;
    var stars = this.displayStars();
    var cops = this.policeCars();

    // Does any cop currently see the player?
    var seen = false;
    for (var i = 0; i < cops.length; i++) {
      if (dist2(cops[i].x, cops[i].y, px, py) < CFG.SIGHT_RANGE * CFG.SIGHT_RANGE) { seen = true; break; }
    }
    if (stars > 0 && seen) { this.lastKnownX = px; this.lastKnownY = py; this.unseenTime = 0; }
    else this.unseenTime += dt;

    // Heat decays while unseen; forced stars (missions) hold their floor.
    if (!seen && this.unseenTime > 1.2) {
      var floor = this.forcedStars * CFG.HEAT_PER_STAR - 6;
      this.heat = Math.max(this.heat - CFG.HEAT_DECAY * dt * 10, Math.max(0, floor));
      if (this.forcedStars === 0 && this.heat < 1) { this.heat = 0; this.bustMeter = 0; }
    }

    // Maintain the squad size for the current wanted level.
    var wanted = stars === 0 ? 0 : Math.min(2 + stars, 6);
    if (cops.length < wanted && rng() < dt * 1.5) this.spawnCop();
    if (cops.length > wanted + 2) {
      // Extras give up and drive off (despawn far ones).
      for (var j = cops.length - 1; j >= 0 && cops.length > wanted + 2; j--) {
        if (dist2(cops[j].x, cops[j].y, px, py) > 700 * 700) { Vehicles.list.splice(Vehicles.list.indexOf(cops[j]), 1); cops.splice(j, 1); }
      }
    }

    // Siren follows the chase.
    if (stars > 0) Sfx.startSiren(); else Sfx.stopSiren();

    this.updateCops(cops, dt, px, py, seen);
    this.updateBust(cops, dt, px, py);
  },

  updateCops: function (cops, dt, px, py, seen) {
    var player = Game.player;
    for (var i = 0; i < cops.length; i++) {
      var cop = cops[i];
      // Target: the player if seen, else the last known position, then search.
      var tx = seen ? px : this.lastKnownX, ty = seen ? py : this.lastKnownY;
      var dx = tx - cop.x, dy = ty - cop.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var desired = Math.atan2(dy, dx);
      var diff = wrapAngle(desired - cop.angle);
      cop.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
      var targetSpeed = CFG.POLICE_SPEED;
      if (d < 90) targetSpeed = CFG.POLICE_SPEED * 0.55;      // don't overshoot the ram
      if (!seen && d < 40) targetSpeed = 60;                    // searching, slow crawl
      if (Math.abs(diff) > 2.2) targetSpeed = 90;               // turning around
      cop.speed += clamp(targetSpeed - cop.speed, -420 * dt, 300 * dt);
      Vehicles.moveCar(cop, dt);
      // Ramming a fleeing car on foot pace: nudge damage on hard contact.
      if (player.driving && player.car && dist2(cop.x, cop.y, player.car.x, player.car.y) < 36 * 36) {
        if (Math.abs(cop.speed) > 200 && !cop.ramCooldown) {
          cop.ramCooldown = 0.8;
          Game.damagePlayer(4, 'crash');
          Sfx.crash();
        }
      }
      if (cop.ramCooldown > 0) cop.ramCooldown -= dt;
    }
  },

  updateBust: function (cops, dt, px, py) {
    var player = Game.player;
    var playerSpeed = player.driving && player.car ? Math.abs(player.car.speed) : 0;
    var pinned = false;
    if (this.displayStars() > 0) {
      for (var i = 0; i < cops.length; i++) {
        if (dist2(cops[i].x, cops[i].y, px, py) < CFG.BUST_RADIUS * CFG.BUST_RADIUS) { pinned = true; break; }
      }
    }
    // On foot a close cop busts you fast; in a car you must be nearly stopped.
    if (pinned && (!player.driving || playerSpeed < 55)) {
      this.bustMeter += dt / CFG.BUST_TIME;
      if (this.bustMeter >= 1) { Game.onBusted(); this.bustMeter = 0; }
    } else {
      this.bustMeter = Math.max(0, this.bustMeter - dt * 1.6);
    }
  }
};

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
