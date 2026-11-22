// Sunfall City — people.js
// The player character on foot and the crowd: pedestrians stroll the sidewalks,
// wander between waypoints, and sprint away screaming (well, silently) when a
// car bears down on them, shots are fired, or the player waves trouble nearby.

var People = {
  peds: [],
  pedTarget: 26,

  makePlayer: function () {
    return {
      x: World.playerSpawn.x, y: World.playerSpawn.y, r: CFG.PLAYER_R,
      angle: 0, hp: CFG.PLAYER_MAX_HP, cash: 0,
      driving: false, car: null, walkCycle: 0, dead: false
    };
  },

  resetPeds: function () {
    this.peds.length = 0;
    for (var i = 0; i < this.pedTarget; i++) this.peds.push(this.spawnPed());
  },

  spawnPed: function () {
    // Peds live on sidewalks: pick a road point and offset to the kerb.
    var p = World.randomRoadPoint();
    var vertical = World.roadsX.indexOf(p.x) >= 0;
    var off = (rng() < 0.5 ? -1 : 1) * (CFG.ROAD_W / 2 + 14);
    var ped = {
      x: clamp(p.x + (vertical ? off : randRange(-30, 30)), 20, CFG.WORLD_W - 20),
      y: clamp(p.y + (vertical ? randRange(-30, 30) : off), 20, CFG.WORLD_H - 20),
      r: 11, angle: randRange(0, Math.PI * 2),
      speed: randRange(46, 78), shirt: randPick(CFG.COLORS.pedShirts),
      tx: 0, ty: 0, flee: 0, down: 0, walkCycle: randRange(0, 6)
    };
    if (World.pointInBuilding(ped.x, ped.y)) { var np = World.nearestRoadPoint(ped.x, ped.y); ped.x = np.x; ped.y = np.y; }
    this.retarget(ped);
    return ped;
  },

  retarget: function (ped) {
    // Stroll to another kerb point a block or two away.
    var p = World.randomRoadPoint();
    var vertical = World.roadsX.indexOf(p.x) >= 0;
    var off = (rng() < 0.5 ? -1 : 1) * (CFG.ROAD_W / 2 + 14);
    ped.tx = clamp(p.x + (vertical ? off : 0), 20, CFG.WORLD_W - 20);
    ped.ty = clamp(p.y + (vertical ? 0 : off), 20, CFG.WORLD_H - 20);
  },

  // A car ran this pedestrian down. They stay down, then get up and flee.
  runOver: function (ped, car) {
    ped.down = 2.6;
    ped.flee = 5;
    Sfx.hit();
  },

  // Something scary happened at (x, y): nearby peds run from it.
  scare: function (x, y, radius) {
    for (var i = 0; i < this.peds.length; i++) {
      var p = this.peds[i];
      if (dist2(x, y, p.x, p.y) < radius * radius) p.flee = Math.max(p.flee, 2.5);
    }
  },

  updatePlayer: function (player, input, dt) {
    if (player.driving) return;
    var mx = 0, my = 0;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    var moving = (mx !== 0 || my !== 0);
    if (moving) {
      var len = Math.sqrt(mx * mx + my * my);
      var sp = input.sprint ? CFG.SPRINT_SPEED : CFG.WALK_SPEED;
      player.x += (mx / len) * sp * dt;
      player.y += (my / len) * sp * dt;
      player.walkCycle += dt * (input.sprint ? 13 : 9);
    }
    // Face the mouse when aiming, else face the walk direction.
    if (Game.mouse.active) {
      var wx = Game.camera.x + Game.mouse.x, wy = Game.camera.y + Game.mouse.y;
      player.angle = Math.atan2(wy - player.y, wx - player.x);
    } else if (moving) {
      player.angle = Math.atan2(my, mx);
    }
    World.collide(player, player.r);
    // Slow health regen keeps the game forgiving between fights.
    if (player.hp > 0 && player.hp < CFG.PLAYER_MAX_HP) player.hp = Math.min(CFG.PLAYER_MAX_HP, player.hp + dt * 2.2);
  },

  updatePeds: function (dt) {
    var player = Game.player;
    for (var i = 0; i < this.peds.length; i++) {
      var p = this.peds[i];
      if (p.down > 0) {
        p.down -= dt;
        if (p.down <= 0) this.retarget(p); // get up and hurry somewhere safer
        continue;
      }
      var speed = p.speed, tx = p.tx, ty = p.ty;
      if (p.flee > 0) {
        p.flee -= dt;
        // Run directly away from the player (the usual source of trouble).
        var fx = p.x - player.x, fy = p.y - player.y;
        var fl = Math.sqrt(fx * fx + fy * fy) || 1;
        tx = p.x + (fx / fl) * 200; ty = p.y + (fy / fl) * 200;
        speed = 235;
      }
      var dx = tx - p.x, dy = ty - p.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 8) { if (p.flee <= 0) this.retarget(p); continue; }
      p.angle = Math.atan2(dy, dx);
      p.x += Math.cos(p.angle) * speed * dt;
      p.y += Math.sin(p.angle) * speed * dt;
      p.walkCycle += dt * (p.flee > 0 ? 14 : 8);
      World.collide(p, p.r);
    }
    if (this.peds.length < this.pedTarget && rng() < dt * 0.4) this.peds.push(this.spawnPed());
  },

  drawPed: function (ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.down > 0) {
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = p.shirt;
      roundRect(ctx, -12, -6, 24, 12, 6); ctx.fill();
      ctx.fillStyle = CFG.COLORS.playerSkin;
      ctx.beginPath(); ctx.arc(14, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    var bob = Math.sin(p.walkCycle) * 1.6;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 3, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(0, bob * 0.3, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CFG.COLORS.playerSkin;
    ctx.beginPath(); ctx.arc(0, bob * 0.3, 5.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  drawPlayer: function (ctx, player) {
    if (player.driving) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    var bob = Math.sin(player.walkCycle) * 1.8;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 4, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(player.angle);
    // Gun arm pointing toward aim.
    ctx.fillStyle = '#37474f';
    ctx.fillRect(6, 3, 13, 4);
    ctx.fillStyle = '#22252a';
    ctx.fillRect(16, 3.5, 8, 3);
    ctx.rotate(-player.angle);
    ctx.fillStyle = CFG.COLORS.player;
    ctx.beginPath(); ctx.arc(0, bob * 0.3, 10.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CFG.COLORS.playerSkin;
    ctx.beginPath(); ctx.arc(0, bob * 0.3, 6, 0, Math.PI * 2); ctx.fill();
    // Jae's signature teal cap.
    ctx.fillStyle = '#0e7c86';
    ctx.beginPath(); ctx.arc(0, bob * 0.3, 6, Math.PI * 0.9, Math.PI * 1.9); ctx.fill();
    ctx.restore();
  }
};
