// Sunfall City — combat.js
// Gunplay, on foot only: aim with the mouse, click to fire. One shared bullet
// list carries both the player's shots and the marina guards' return fire.
// Guards are spawned by the final mission; they hold their ground, track the
// player inside GUARD_RANGE, and shoot on a steady cadence.

var Combat = {
  bullets: [],   // {x, y, vx, vy, life, friendly}
  guards: [],    // {x, y, r, hp, angle, fireTimer, alive}
  cooldown: 0,

  reset: function () { this.bullets.length = 0; this.guards.length = 0; this.cooldown = 0; },

  spawnGuard: function (x, y) {
    var g = { x: x, y: y, r: 12, hp: CFG.GUARD_HP, angle: Math.PI, fireTimer: randRange(0.4, 1.1), alive: true, walkCycle: 0 };
    this.guards.push(g);
    return g;
  },
  clearGuards: function () { this.guards.length = 0; },
  guardsAlive: function () {
    var n = 0;
    for (var i = 0; i < this.guards.length; i++) if (this.guards[i].alive) n++;
    return n;
  },

  fireBullet: function (x, y, angle, friendly) {
    this.bullets.push({
      x: x, y: y,
      vx: Math.cos(angle) * CFG.BULLET_SPEED,
      vy: Math.sin(angle) * CFG.BULLET_SPEED,
      life: CFG.BULLET_LIFE, friendly: friendly
    });
  },

  tryPlayerShoot: function (player, dt) {
    this.cooldown -= dt;
    if (!Game.mouse.down || player.driving || Game.state !== 'playing') return;
    if (this.cooldown > 0) return;
    this.cooldown = CFG.GUN_COOLDOWN;
    var wx = Game.camera.x + Game.mouse.x, wy = Game.camera.y + Game.mouse.y;
    var angle = Math.atan2(wy - player.y, wx - player.x);
    var spread = randRange(-0.035, 0.035);
    this.fireBullet(player.x + Math.cos(angle) * 20, player.y + Math.sin(angle) * 20, angle + spread, true);
    Sfx.shot();
    People.scare(player.x, player.y, 240);
    Police.addHeat(CFG.HEAT_SHOT, player.x, player.y);
  },

  update: function (dt) {
    var player = Game.player;
    this.tryPlayerShoot(player, dt);

    // Guards: face the player, fire when in range and line of sight is clear.
    for (var i = 0; i < this.guards.length; i++) {
      var g = this.guards[i];
      if (!g.alive) continue;
      var d = Math.sqrt(dist2(g.x, g.y, player.x, player.y));
      g.angle = Math.atan2(player.y - g.y, player.x - g.x);
      g.fireTimer -= dt;
      if (d < CFG.GUARD_RANGE && g.fireTimer <= 0 && !player.driving) {
        g.fireTimer = randRange(0.75, 1.25);
        var inaccuracy = randRange(-0.09, 0.09);
        this.fireBullet(g.x + Math.cos(g.angle) * 18, g.y + Math.sin(g.angle) * 18, g.angle + inaccuracy, false);
        Sfx.guardShot();
      }
      // Guards shuffle a little toward cover range but never chase far.
      if (d < CFG.GUARD_RANGE && d > 150) {
        g.x += Math.cos(g.angle) * 34 * dt;
        g.y += Math.sin(g.angle) * 34 * dt;
        World.collide(g, g.r);
        g.walkCycle += dt * 7;
      }
    }

    // Bullets fly, die on buildings, and hit their targets.
    for (var j = this.bullets.length - 1; j >= 0; j--) {
      var b = this.bullets[j];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      var dead = b.life <= 0 || World.pointInBuilding(b.x, b.y) ||
                 b.x < 0 || b.y < 0 || b.x > CFG.WORLD_W || b.y > CFG.WORLD_H;
      if (!dead && b.friendly) {
        for (var k = 0; k < this.guards.length; k++) {
          var gd = this.guards[k];
          if (gd.alive && dist2(b.x, b.y, gd.x, gd.y) < (gd.r + 3) * (gd.r + 3)) {
            gd.hp -= CFG.GUN_DAMAGE;
            dead = true;
            Sfx.hit();
            if (gd.hp <= 0) { gd.alive = false; Game.onGuardDown(gd); }
            break;
          }
        }
      }
      if (!dead && !b.friendly && !player.driving) {
        if (dist2(b.x, b.y, player.x, player.y) < (player.r + 3) * (player.r + 3)) {
          dead = true;
          Game.damagePlayer(CFG.GUARD_DAMAGE, 'shot');
        }
      }
      if (dead) this.bullets.splice(j, 1);
    }
  },

  drawGuards: function (ctx) {
    for (var i = 0; i < this.guards.length; i++) {
      var g = this.guards[i];
      ctx.save();
      ctx.translate(g.x, g.y);
      if (!g.alive) {
        ctx.rotate(g.angle + Math.PI / 2);
        ctx.fillStyle = '#5d4037';
        roundRect(ctx, -13, -7, 26, 14, 7); ctx.fill();
        ctx.fillStyle = CFG.COLORS.playerSkin;
        ctx.beginPath(); ctx.arc(15, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(0, 4, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(g.angle);
      ctx.fillStyle = '#263238';
      ctx.fillRect(6, 3, 14, 4); // guard's rifle arm
      ctx.rotate(-g.angle);
      ctx.fillStyle = '#5d4037';
      ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = CFG.COLORS.playerSkin;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      // Health tick above a wounded guard.
      if (g.hp < CFG.GUARD_HP) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-12, -20, 24, 4);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-12, -20, 24 * (g.hp / CFG.GUARD_HP), 4);
      }
      ctx.restore();
    }
  },

  drawBullets: function (ctx) {
    ctx.fillStyle = '#ffe082';
    for (var i = 0; i < this.bullets.length; i++) {
      var b = this.bullets[i];
      ctx.beginPath(); ctx.arc(b.x, b.y, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
};
