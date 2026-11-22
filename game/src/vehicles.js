// Sunfall City — vehicles.js
// Everything with wheels: the car record, arcade driving physics for the
// player's car, parked cars waiting to be stolen, and traffic AI that follows
// the road grid (straight through intersections, sometimes turning). Cars are
// circles for collision, which keeps city-wide physics cheap and stable.

var CAR_COLORS = ['#e74c3c', '#f39c12', '#ecf0f1', '#3498db', '#9b59b6', '#1abc9c',
                  '#e67e22', '#fd79a8', '#95a5a6', '#2ecc71', '#f1c40f', '#dfe6e9'];

var Vehicles = {
  list: [],        // every car in the world (traffic, parked, player-driven)
  trafficTarget: 14,
  parkedTarget: 16,

  makeCar: function (x, y, angle, color, kind) {
    return {
      x: x, y: y, angle: angle, speed: 0, r: 17,
      color: color, kind: kind, // 'traffic' | 'parked' | 'police' | 'player'
      dirX: Math.cos(angle), dirY: Math.sin(angle),
      cruise: CFG.TRAFFIC_SPEED * randRange(0.8, 1.1),
      turnCooldown: 0, honk: 0, wrecked: false
    };
  },

  reset: function () {
    this.list.length = 0;
    var i, p;
    for (i = 0; i < this.parkedTarget; i++) {
      p = World.randomRoadPoint();
      var side = rng() < 0.5 ? -1 : 1;
      var vertical = World.roadsX.indexOf(p.x) >= 0;
      var car = this.makeCar(
        p.x + (vertical ? side * (CFG.ROAD_W / 2 - 20) : 0),
        p.y + (vertical ? 0 : side * (CFG.ROAD_W / 2 - 20)),
        vertical ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? Math.PI : 0),
        randPick(CAR_COLORS), 'parked');
      car.x = clamp(car.x, 30, CFG.WORLD_W - 30); car.y = clamp(car.y, 30, CFG.WORLD_H - 30);
      this.list.push(car);
    }
    for (i = 0; i < this.trafficTarget; i++) this.spawnTraffic();
  },

  spawnTraffic: function () {
    var p = World.randomRoadPoint();
    var vertical = World.roadsX.indexOf(p.x) >= 0;
    var angle;
    if (vertical) { angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2; p.x += (angle > 0 ? 1 : -1) * 26; }
    else { angle = rng() < 0.5 ? 0 : Math.PI; p.y += (angle === 0 ? 1 : -1) * 26; }
    var car = this.makeCar(p.x, p.y, angle, randPick(CAR_COLORS), 'traffic');
    car.speed = car.cruise;
    this.list.push(car);
    return car;
  },

  countKind: function (kind) {
    var n = 0;
    for (var i = 0; i < this.list.length; i++) if (this.list[i].kind === kind) n++;
    return n;
  },

  nearestParked: function (x, y, maxDist) {
    var best = null, bd = maxDist * maxDist;
    for (var i = 0; i < this.list.length; i++) {
      var c = this.list[i];
      if (c.kind !== 'parked') continue;
      var d = dist2(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },

  // Player steals / enters a car. Returns true if a car was taken.
  enterNearest: function (player) {
    var car = this.nearestParked(player.x, player.y, 52);
    if (!car) { // also allow re-entering the car the player just left
      for (var i = 0; i < this.list.length; i++) {
        var c = this.list[i];
        if (c.kind === 'player' && dist2(player.x, player.y, c.x, c.y) < 52 * 52) { car = c; break; }
      }
    }
    if (!car) return false;
    var wasParked = car.kind === 'parked';
    car.kind = 'player';
    player.car = car; player.driving = true;
    if (wasParked) Police.addHeat(CFG.HEAT_STEAL, car.x, car.y);
    Sfx.startEngine();
    return true;
  },

  exitCar: function (player) {
    if (!player.car) return;
    var car = player.car;
    car.kind = 'parked'; car.speed = 0;
    // Step out on the left side of the car.
    player.x = car.x + Math.cos(car.angle - Math.PI / 2) * 30;
    player.y = car.y + Math.sin(car.angle - Math.PI / 2) * 30;
    World.collide(player, player.r);
    player.car = null; player.driving = false;
    Sfx.stopEngine();
  },

  // Arcade driving for the player's car, driven by the input flags.
  drivePlayer: function (car, input, dt) {
    var accel = 0;
    if (input.up) accel = CFG.CAR_ACCEL;
    if (input.down) accel = car.speed > 8 ? -CFG.CAR_BRAKE : -CFG.CAR_ACCEL * 0.6;
    car.speed += accel * dt;
    // Rolling drag and top speeds.
    car.speed -= car.speed * 0.55 * dt;
    if (!input.up && !input.down) car.speed -= car.speed * 0.9 * dt;
    car.speed = clamp(car.speed, -CFG.CAR_MAX_REVERSE, CFG.CAR_MAX_SPEED);
    if (Math.abs(car.speed) < 2 && !input.up && !input.down) car.speed = 0;
    var steer = 0;
    if (input.left) steer = -1;
    if (input.right) steer = 1;
    var speedFrac = clamp(Math.abs(car.speed) / CFG.CAR_MAX_SPEED, 0, 1);
    car.angle += steer * CFG.CAR_TURN * (0.35 + 0.65 * speedFrac) * dt * (car.speed < 0 ? -1 : 1);
    this.moveCar(car, dt);
    Sfx.setEngine(speedFrac);
  },

  moveCar: function (car, dt) {
    var ox = car.x, oy = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    var before = { x: car.x, y: car.y };
    World.collide(car, car.r + 4);
    // If a building shoved the car sideways hard, count it as a scrape/crash.
    if (Math.abs(car.x - before.x) > 6 || Math.abs(car.y - before.y) > 6) {
      if (Math.abs(car.speed) > 190) { car.speed *= 0.35; car.crashCooldown = 0.5; }
      else car.speed *= 0.7;
    }
    car.dirX = Math.cos(car.angle); car.dirY = Math.sin(car.angle);
    return ox !== car.x || oy !== car.y;
  }
};

// Traffic AI: hold the lane offset on the current road, slow for the car ahead,
// and at an intersection either go straight or take a clean 90-degree turn.
Vehicles.updateTraffic = function (dt) {
  var list = this.list;
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    if (c.kind !== 'traffic' || c.wrecked) continue;
    c.turnCooldown -= dt;
    // Desired speed: cruise, but brake if something is close ahead.
    var want = c.cruise;
    var aheadX = c.x + Math.cos(c.angle) * 58, aheadY = c.y + Math.sin(c.angle) * 58;
    for (var j = 0; j < list.length; j++) {
      if (j === i) continue;
      var o = list[j];
      if (dist2(aheadX, aheadY, o.x, o.y) < 34 * 34) { want = Math.min(want, Math.max(0, o.speed * 0.8)); break; }
    }
    if (Game.player.driving && Game.player.car &&
        dist2(aheadX, aheadY, Game.player.car.x, Game.player.car.y) < 40 * 40) want = 0;
    c.speed += clamp(want - c.speed, -300 * dt, 130 * dt);
    // Near an intersection centre? Maybe turn onto the crossing road.
    if (c.turnCooldown <= 0) {
      var ix = World.roadsX, iy = World.roadsY, k, nearX = null, nearY = null;
      for (k = 0; k < ix.length; k++) if (Math.abs(c.x - ix[k]) < 14) nearX = ix[k];
      for (k = 0; k < iy.length; k++) if (Math.abs(c.y - iy[k]) < 14) nearY = iy[k];
      if (nearX !== null && nearY !== null) {
        c.turnCooldown = 1.6;
        if (rng() < 0.45) {
          var vertical = Math.abs(Math.sin(c.angle)) > 0.5;
          c.angle = vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
          c.x = nearX + (Math.cos(c.angle) !== 0 ? 0 : (c.angle > 0 ? 26 : -26));
          c.y = nearY + (Math.sin(c.angle) !== 0 ? 0 : (c.angle === 0 ? 26 : -26));
          if (Math.cos(c.angle) === 1) c.y = nearY + 26;
          if (Math.cos(c.angle) === -1) c.y = nearY - 26;
          if (Math.sin(c.angle) === 1) c.x = nearX + 26;
          if (Math.sin(c.angle) === -1) c.x = nearX - 26;
        }
      }
    }
    this.moveCar(c, dt);
    // Keep traffic out of the water and inside the world.
    if (c.x > CFG.BEACH_X - 40) { c.angle = Math.PI; c.x = CFG.BEACH_X - 40; }
  }
  // Top the traffic back up if wrecks thinned it out.
  if (this.countKind('traffic') < this.trafficTarget - 3 && rng() < dt * 0.5) this.spawnTraffic();
};

// Car-to-car bumps and running down pedestrians. The player's car raises heat.
Vehicles.updateCollisions = function (dt) {
  var list = this.list, i, j;
  for (i = 0; i < list.length; i++) {
    var a = list[i];
    if (a.crashCooldown > 0) a.crashCooldown -= dt;
    for (j = i + 1; j < list.length; j++) {
      var b = list[j];
      var rr = a.r + b.r;
      if (dist2(a.x, a.y, b.x, b.y) < rr * rr) {
        var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dist2(a.x, a.y, b.x, b.y)) || 1;
        var push = (rr - d) / 2, nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        var impact = Math.abs(a.speed - b.speed);
        if (a.kind !== 'parked') a.speed *= 0.55;
        if (b.kind !== 'parked') b.speed *= 0.55;
        if (impact > 150 && a.crashCooldown <= 0 && b.crashCooldown <= 0) {
          a.crashCooldown = b.crashCooldown = 0.6;
          Sfx.crash();
          if (a.kind === 'player' || b.kind === 'player') Police.addHeat(CFG.HEAT_HIT_CAR, a.x, a.y);
        }
      }
    }
  }
  // Cars vs pedestrians.
  var peds = People.peds;
  for (i = 0; i < list.length; i++) {
    var car = list[i];
    if (Math.abs(car.speed) < 55) continue;
    for (j = 0; j < peds.length; j++) {
      var p = peds[j];
      if (p.down <= 0 && dist2(car.x, car.y, p.x, p.y) < (car.r + p.r) * (car.r + p.r)) {
        People.runOver(p, car);
        if (car.kind === 'player') Police.addHeat(CFG.HEAT_HIT_PED, car.x, car.y);
        if (car.kind !== 'parked') car.speed *= 0.6;
      }
    }
  }
};

// Drawing: a rounded body, cabin, windshield and headlights, rotated to angle.
Vehicles.draw = function (ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  var L = CFG.CAR_LEN, W = CFG.CAR_WID;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(ctx, -L / 2 + 3, -W / 2 + 4, L, W, 7); ctx.fill();
  ctx.fillStyle = car.wrecked ? '#555' : car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7); ctx.fill();
  ctx.fillStyle = 'rgba(20,24,32,0.85)';
  roundRect(ctx, -6, -W / 2 + 4, 15, W - 8, 4); ctx.fill();   // cabin
  ctx.fillStyle = '#bfe8f5';
  roundRect(ctx, 8, -W / 2 + 5, 5, W - 10, 2); ctx.fill();    // windshield
  roundRect(ctx, -11, -W / 2 + 5, 4, W - 10, 2); ctx.fill();  // rear window
  ctx.fillStyle = '#fff6b0';
  ctx.fillRect(L / 2 - 3, -W / 2 + 3, 3, 5);
  ctx.fillRect(L / 2 - 3, W / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff5a4d';
  ctx.fillRect(-L / 2, -W / 2 + 3, 3, 5);
  ctx.fillRect(-L / 2, W / 2 - 8, 3, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#f4f6f8';
    roundRect(ctx, -L / 2 + 6, -W / 2 + 2, L - 12, W - 4, 6); ctx.fill();
    ctx.fillStyle = CFG.COLORS.police;
    ctx.fillRect(-4, -W / 2 + 2, 9, W - 4);
    ctx.fillStyle = (Math.floor(performance.now() / 280) % 2 === 0) ? '#ff3b30' : '#3b82f6';
    roundRect(ctx, -3, -5, 8, 10, 3); ctx.fill();
  }
  ctx.restore();
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
