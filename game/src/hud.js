// Sunfall City — hud.js
// Everything drawn over the world: cash and health (top-left), wanted stars
// (top-right), the current objective with marker distance (top-centre), the
// notification banner, the bust meter, and the minimap (bottom-right) with
// roads, the player arrow, police blips and the objective marker.

var Hud = {
  draw: function (ctx, w, h) {
    var player = Game.player;
    ctx.save();

    // --- top-left: cash + health ------------------------------------------
    ctx.fillStyle = 'rgba(16,18,24,0.62)';
    roundRect(ctx, 14, 14, 218, 64, 10); ctx.fill();
    ctx.fillStyle = '#ffd83d';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('$' + player.cash.toLocaleString('en-US'), 28, 42);
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, 28, 52, 150, 12, 6); ctx.fill();
    var hpFrac = clamp(player.hp / CFG.PLAYER_MAX_HP, 0, 1);
    ctx.fillStyle = hpFrac > 0.3 ? CFG.COLORS.health : CFG.COLORS.healthLow;
    if (hpFrac > 0) { roundRect(ctx, 28, 52, 150 * hpFrac, 12, 6); ctx.fill(); }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('JAE CORSO', 186, 63);
    if (Missions.carrying) {
      ctx.fillStyle = '#ffe082';
      ctx.font = 'bold 12px Arial';
      ctx.fillText('CARRYING ITEM', 28, 94);
    }

    // --- top-right: wanted stars -------------------------------------------
    var stars = Police.displayStars();
    ctx.font = '26px Arial';
    ctx.textAlign = 'right';
    for (var i = 0; i < CFG.MAX_STARS; i++) {
      ctx.fillStyle = i < stars ? '#ffd83d' : 'rgba(255,255,255,0.28)';
      ctx.fillText('★', w - 18 - (CFG.MAX_STARS - 1 - i) * 30, 44);
    }
    if (stars > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 11px Arial';
      ctx.fillText(Police.unseenTime > 1.2 && Police.bustMeter <= 0 ? 'LOSING THEM…' : 'SUNFALL PD', w - 18, 64);
    }

    // --- top-centre: objective ----------------------------------------------
    var obj = Missions.objective();
    if (obj) {
      ctx.font = 'bold 15px Arial';
      var tw = ctx.measureText(obj).width + 34;
      ctx.fillStyle = 'rgba(16,18,24,0.62)';
      roundRect(ctx, (w - tw) / 2, 14, tw, 34, 9); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(obj, w / 2, 37);
      var m = Missions.marker();
      if (m) {
        var px = player.driving && player.car ? player.car.x : player.x;
        var py = player.driving && player.car ? player.car.y : player.y;
        var d = Math.round(Math.sqrt(dist2(px, py, m.x, m.y)) / 10);
        ctx.fillStyle = '#ffe082';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(d + ' m', w / 2, 62);
      }
    }

    // --- notification banner --------------------------------------------------
    if (Game.notifyTimer > 0 && Game.notifyText) {
      ctx.font = 'bold 19px Arial';
      var nw = ctx.measureText(Game.notifyText).width + 44;
      ctx.globalAlpha = clamp(Game.notifyTimer, 0, 1);
      ctx.fillStyle = 'rgba(16,18,24,0.78)';
      roundRect(ctx, (w - nw) / 2, 84, nw, 40, 10); ctx.fill();
      ctx.fillStyle = '#ffd83d';
      ctx.textAlign = 'center';
      ctx.fillText(Game.notifyText, w / 2, 111);
      ctx.globalAlpha = 1;
    }

    // --- bust meter -----------------------------------------------------------
    if (Police.bustMeter > 0.02) {
      ctx.fillStyle = 'rgba(16,18,24,0.7)';
      roundRect(ctx, w / 2 - 130, h - 120, 260, 30, 8); ctx.fill();
      ctx.fillStyle = '#e74c3c';
      roundRect(ctx, w / 2 - 122, h - 112, 244 * clamp(Police.bustMeter, 0, 1), 14, 6); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GET AWAY!', w / 2, h - 122 + 40);
    }

    // --- context hint ---------------------------------------------------------
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    var hint = '';
    if (!player.driving && Vehicles.nearestParked(player.x, player.y, 52)) hint = 'E — steal car';
    else if (player.driving) hint = 'E — exit car · P — pause';
    else if (Missions.index >= 4) hint = 'Enter — replay story · P — pause';
    if (hint) {
      ctx.fillStyle = 'rgba(16,18,24,0.55)';
      roundRect(ctx, 14, h - 40, ctx.measureText(hint).width + 20, 26, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(hint, 24, h - 22);
    }
    if (Sfx.muted) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText('SOUND OFF (M)', w - 18, h - 16);
    }
    ctx.restore();

    this.drawMinimap(ctx, w, h);
  },

  drawMinimap: function (ctx, w, h) {
    var MW = 232, MH = 174, MX = w - MW - 14, MY = h - MH - 14;
    var sx = MW / CFG.WORLD_W, sy = MH / CFG.WORLD_H;
    ctx.save();
    ctx.fillStyle = 'rgba(20,26,20,0.82)';
    roundRect(ctx, MX - 4, MY - 4, MW + 8, MH + 8, 10); ctx.fill();
    ctx.beginPath();
    roundRect(ctx, MX, MY, MW, MH, 7); ctx.clip();
    // Land, beach, water.
    ctx.fillStyle = '#5d8a48';
    ctx.fillRect(MX, MY, MW, MH);
    ctx.fillStyle = CFG.COLORS.sand;
    ctx.fillRect(MX + CFG.BEACH_X * sx, MY, (CFG.WATER_X - CFG.BEACH_X) * sx, MH);
    ctx.fillStyle = CFG.COLORS.water;
    ctx.fillRect(MX + CFG.WATER_X * sx, MY, MW - CFG.WATER_X * sx, MH);
    // Roads.
    ctx.strokeStyle = '#cfd4d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    var i;
    for (i = 0; i < World.roadsX.length; i++) {
      ctx.moveTo(MX + World.roadsX[i] * sx, MY);
      ctx.lineTo(MX + World.roadsX[i] * sx, MY + MH);
    }
    for (i = 0; i < World.roadsY.length; i++) {
      ctx.moveTo(MX, MY + World.roadsY[i] * sy);
      ctx.lineTo(MX + MW, MY + World.roadsY[i] * sy);
    }
    ctx.stroke();
    // Traffic dots.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (i = 0; i < Vehicles.list.length; i++) {
      var c = Vehicles.list[i];
      if (c.kind === 'traffic') ctx.fillRect(MX + c.x * sx - 1, MY + c.y * sy - 1, 2, 2);
    }
    // Police blips (blink).
    if (Math.floor(performance.now() / 350) % 2 === 0) {
      ctx.fillStyle = '#ff5252';
      for (i = 0; i < Vehicles.list.length; i++) {
        var p = Vehicles.list[i];
        if (p.kind !== 'police') continue;
        ctx.beginPath(); ctx.arc(MX + p.x * sx, MY + p.y * sy, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Objective marker.
    var m = Missions.marker();
    if (m) {
      ctx.fillStyle = CFG.COLORS.marker;
      ctx.beginPath(); ctx.arc(MX + m.x * sx, MY + m.y * sy, 4.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5c00'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(MX + m.x * sx, MY + m.y * sy, 6.4, 0, Math.PI * 2); ctx.stroke();
    }
    // Player arrow.
    var player = Game.player;
    var px = player.driving && player.car ? player.car.x : player.x;
    var py = player.driving && player.car ? player.car.y : player.y;
    var pa = player.driving && player.car ? player.car.angle : player.angle;
    ctx.translate(MX + px * sx, MY + py * sy);
    ctx.rotate(pa);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -4.4); ctx.lineTo(-5, 4.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#123'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -4.4); ctx.lineTo(-5, 4.4); ctx.closePath(); ctx.stroke();
    ctx.restore();
    // Frame label.
    ctx.fillStyle = 'rgba(10,14,10,0.45)';
    ctx.fillRect(MX + 3, MY + 3, 74, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('SUNFALL CITY', MX + 6, MY + 14);
  }
};
