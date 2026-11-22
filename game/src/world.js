// Sunfall City — world.js
// Builds the city once at boot: the road grid, one or two buildings per block
// (kept as solid rectangles for collision), sidewalk palms, beach props and the
// named places the missions use. Also owns the collision helpers every moving
// thing shares: circle vs. building rectangles, and "is this point on a road".

var World = {
  buildings: [],   // {x, y, w, h, roof, floors} — solid
  palms: [],       // {x, y, s} decorative sidewalk palms
  lamps: [],       // {x, y} street lamps at corners (decorative)
  umbrellas: [],   // {x, y, c} beach umbrellas
  roadsX: [],      // centrelines of vertical roads
  roadsY: [],      // centrelines of horizontal roads

  // Named places, filled by build().
  garage: null, hideout: null, safehouse: null, marina: null,
  packageSpot: null, playerSpawn: null,

  build: function () {
    var C = CFG, i, j;
    this.buildings.length = 0; this.palms.length = 0;
    this.lamps.length = 0; this.umbrellas.length = 0;
    this.roadsX.length = 0; this.roadsY.length = 0;

    for (i = 0; i < C.COLS; i++) this.roadsX.push(C.ROAD_X0 + i * C.BLOCK);
    for (j = 0; j < C.ROWS; j++) this.roadsY.push(C.ROAD_Y0 + j * C.BLOCK);

    // One or two buildings inside each block, kept clear of the roads.
    var half = C.BLOCK / 2, roadHalf = C.ROAD_W / 2, pad = 26;
    for (i = 0; i < C.COLS - 1; i++) {
      for (j = 0; j < C.ROWS - 1; j++) {
        var bx = this.roadsX[i] + roadHalf + pad;
        var by = this.roadsY[j] + roadHalf + pad;
        var bw = C.BLOCK - C.ROAD_W - pad * 2;
        var bh = C.BLOCK - C.ROAD_W - pad * 2;
        // Skip the marina block (south-east, by the water) — it stays a dock.
        if (i === C.COLS - 2 && j === C.ROWS - 2) continue;
        if (rng() < 0.45) {
          this.addBuilding(bx, by, bw, bh);
        } else {
          var qw = bw / 2 - 10, qh = bh / 2 - 10;
          this.addBuilding(bx, by, qw, qh);
          this.addBuilding(bx + bw - qw, by, qw, qh);
          this.addBuilding(bx, by + bh - qh, qw, qh);
          this.addBuilding(bx + bw - qw, by + bh - qh, qw, qh);
        }
        // A palm or two on the block corners.
        if (rng() < 0.8) this.palms.push({ x: bx - 12, y: by - 12, s: randRange(0.8, 1.25) });
        if (rng() < 0.5) this.palms.push({ x: bx + bw + 12, y: by + bh + 12, s: randRange(0.8, 1.2) });
      }
    }
    // Lamps on intersection corners.
    for (i = 0; i < C.COLS; i++) for (j = 0; j < C.ROWS; j++) {
      this.lamps.push({ x: this.roadsX[i] + roadHalf + 8, y: this.roadsY[j] + roadHalf + 8 });
    }
    // Beach dressing: umbrellas and palms along the sand.
    for (var k = 0; k < 14; k++) {
      this.umbrellas.push({ x: randRange(C.BEACH_X + 26, C.WATER_X - 30), y: randRange(80, C.WORLD_H - 80), c: randPick(C.COLORS.ROOFS) });
    }
    for (var m = 0; m < 12; m++) {
      this.palms.push({ x: randRange(C.BEACH_X + 8, C.BEACH_X + 40), y: randRange(60, C.WORLD_H - 60), s: randRange(0.9, 1.4) });
    }
    this.placeNamedSpots();
  },

  addBuilding: function (x, y, w, h) {
    this.buildings.push({
      x: x, y: y, w: w, h: h,
      roof: randPick(CFG.COLORS.ROOFS),
      floors: 2 + Math.floor(rng() * 6)
    });
  },

  // Fixed story locations, all on roads or open ground so they are reachable.
  placeNamedSpots: function () {
    var rx = this.roadsX, ry = this.roadsY;
    this.playerSpawn = { x: rx[1], y: ry[1] + 90 };
    this.garage = { x: rx[1] + 150, y: ry[4], label: 'Sunfall Auto Garage' };
    this.hideout = { x: rx[0] + 40, y: ry[0] + 40, label: 'Old Depot Hideout' };
    this.safehouse = { x: rx[2] - 140, y: ry[0] + 30, label: 'Palm Court Safehouse' };
    this.packageSpot = { x: rx[6], y: ry[4] + 120, label: 'Harbor Warehouse' };
    this.marina = { x: CFG.BEACH_X - 60, y: ry[CFG.ROWS - 1] + 40, label: 'Sunfall Marina' };
  },

  // --- queries -------------------------------------------------------------
  isRoad: function (x, y) {
    var half = CFG.ROAD_W / 2, i;
    for (i = 0; i < this.roadsX.length; i++) if (Math.abs(x - this.roadsX[i]) <= half) return true;
    for (i = 0; i < this.roadsY.length; i++) if (Math.abs(y - this.roadsY[i]) <= half) return true;
    return false;
  },
  nearestRoadPoint: function (x, y) {
    var best = null, bd = Infinity, i, px, py, d;
    for (i = 0; i < this.roadsX.length; i++) {
      px = this.roadsX[i]; py = clamp(y, 40, CFG.WORLD_H - 40);
      d = dist2(x, y, px, py); if (d < bd) { bd = d; best = { x: px, y: py }; }
    }
    for (i = 0; i < this.roadsY.length; i++) {
      py = this.roadsY[i]; px = clamp(x, 40, CFG.WORLD_W - 40);
      d = dist2(x, y, px, py); if (d < bd) { bd = d; best = { x: px, y: py }; }
    }
    return best;
  },
  randomRoadPoint: function () {
    if (rng() < 0.5) return { x: randPick(this.roadsX), y: randRange(60, CFG.WORLD_H - 60) };
    return { x: randRange(60, CFG.WORLD_W - 60), y: randPick(this.roadsY) };
  },

  // Push a circle (x, y, r) out of every building and clamp it to the world.
  // Mutates and returns the point. Water is solid for everyone.
  collide: function (p, r) {
    var bs = this.buildings;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      var nx = clamp(p.x, b.x, b.x + b.w), ny = clamp(p.y, b.y, b.y + b.h);
      var dx = p.x - nx, dy = p.y - ny, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          var d = Math.sqrt(d2);
          p.x = nx + (dx / d) * r; p.y = ny + (dy / d) * r;
        } else {
          // Centre inside the rect: push out through the nearest face.
          var left = p.x - b.x, right = b.x + b.w - p.x, top = p.y - b.y, bot = b.y + b.h - p.y;
          var m = Math.min(left, right, top, bot);
          if (m === left) p.x = b.x - r; else if (m === right) p.x = b.x + b.w + r;
          else if (m === top) p.y = b.y - r; else p.y = b.y + b.h + r;
        }
      }
    }
    if (p.x > CFG.WATER_X - r) p.x = CFG.WATER_X - r;
    p.x = clamp(p.x, r, CFG.WORLD_W - r);
    p.y = clamp(p.y, r, CFG.WORLD_H - r);
    return p;
  },
  pointInBuilding: function (x, y) {
    var bs = this.buildings;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
    }
    return false;
  }
};

// --- drawing ---------------------------------------------------------------
// Only the slice of the city inside the camera view is drawn. Order matters:
// ground, beach/water, roads, block floors, buildings, then props.
World.draw = function (ctx, cam) {
  var C = CFG, COL = C.COLORS;
  var vx = cam.x - 40, vy = cam.y - 40, vw = cam.w + 80, vh = cam.h + 80;

  // Base ground and the beach/water edge on the east side.
  ctx.fillStyle = COL.grass;
  ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
  ctx.fillStyle = COL.sand;
  ctx.fillRect(C.BEACH_X, cam.y, C.WATER_X - C.BEACH_X, cam.h);
  var grad = ctx.createLinearGradient(C.WATER_X, 0, C.WORLD_W, 0);
  grad.addColorStop(0, COL.water); grad.addColorStop(1, COL.waterDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(C.WATER_X, cam.y, C.WORLD_W - C.WATER_X, cam.h);
  // Lazy wave lines drifting on the water.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  var t = performance.now() / 900;
  ctx.beginPath();
  for (var wy = Math.floor(cam.y / 90) * 90; wy < cam.y + cam.h + 90; wy += 90) {
    for (var wx = C.WATER_X + 24; wx < C.WORLD_W; wx += 130) {
      var off = Math.sin(t + wy * 0.05 + wx * 0.02) * 7;
      ctx.moveTo(wx + off, wy);
      ctx.quadraticCurveTo(wx + 16 + off, wy - 6, wx + 32 + off, wy);
    }
  }
  ctx.stroke();

  // Block floors (sidewalk slabs) under the buildings.
  ctx.fillStyle = COL.blockGround;
  var roadHalf = C.ROAD_W / 2, i, j;
  for (i = 0; i < C.COLS - 1; i++) for (j = 0; j < C.ROWS - 1; j++) {
    var bx = this.roadsX[i] + roadHalf, by = this.roadsY[j] + roadHalf;
    if (bx + C.BLOCK < vx || by + C.BLOCK < vy || bx > vx + vw || by > vy + vh) continue;
    ctx.fillRect(bx, by, C.BLOCK - C.ROAD_W, C.BLOCK - C.ROAD_W);
  }

  // Roads: asphalt, edge lines, dashed centre lines.
  ctx.fillStyle = COL.road;
  for (i = 0; i < this.roadsX.length; i++) ctx.fillRect(this.roadsX[i] - roadHalf, cam.y, C.ROAD_W, cam.h);
  for (j = 0; j < this.roadsY.length; j++) ctx.fillRect(cam.x, this.roadsY[j] - roadHalf, cam.w, C.ROAD_W);
  ctx.fillStyle = COL.roadEdge;
  for (i = 0; i < this.roadsX.length; i++) {
    ctx.fillRect(this.roadsX[i] - roadHalf, cam.y, 3, cam.h);
    ctx.fillRect(this.roadsX[i] + roadHalf - 3, cam.y, 3, cam.h);
  }
  for (j = 0; j < this.roadsY.length; j++) {
    ctx.fillRect(cam.x, this.roadsY[j] - roadHalf, cam.w, 3);
    ctx.fillRect(cam.x, this.roadsY[j] + roadHalf - 3, cam.w, 3);
  }
  ctx.fillStyle = COL.laneMark;
  for (i = 0; i < this.roadsX.length; i++)
    for (var dy = Math.floor(cam.y / 46) * 46; dy < cam.y + cam.h + 46; dy += 46)
      ctx.fillRect(this.roadsX[i] - 2, dy, 4, 24);
  for (j = 0; j < this.roadsY.length; j++)
    for (var dx = Math.floor(cam.x / 46) * 46; dx < cam.x + cam.w + 46; dx += 46)
      ctx.fillRect(dx, this.roadsY[j] - 2, 24, 4);

  // Buildings: shadow, walls, roof with a parapet and a rooftop unit.
  for (i = 0; i < this.buildings.length; i++) {
    var b = this.buildings[i];
    if (b.x + b.w < vx || b.y + b.h < vy || b.x > vx + vw || b.y > vy + vh) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    var uw = Math.min(34, b.w / 4), uh = Math.min(26, b.h / 4);
    ctx.fillRect(b.x + b.w / 2 - uw / 2, b.y + b.h / 2 - uh / 2, uw, uh);
  }

  // Beach umbrellas.
  for (i = 0; i < this.umbrellas.length; i++) {
    var u = this.umbrellas[i];
    if (u.x < vx || u.y < vy || u.x > vx + vw || u.y > vy + vh) continue;
    ctx.fillStyle = u.c;
    ctx.beginPath(); ctx.arc(u.x, u.y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(u.x, u.y, 5, 0, Math.PI * 2); ctx.fill();
  }

  // Palms: trunk dot and six fronds.
  ctx.strokeStyle = COL.palmLeaf;
  ctx.lineWidth = 3;
  for (i = 0; i < this.palms.length; i++) {
    var p = this.palms[i];
    if (p.x < vx - 30 || p.y < vy - 30 || p.x > vx + vw + 30 || p.y > vy + vh + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 5, 12 * p.s, 6 * p.s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    for (var f = 0; f < 6; f++) {
      var a = (f / 6) * Math.PI * 2 + p.x * 0.01;
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + Math.cos(a) * 12 * p.s, p.y + Math.sin(a) * 12 * p.s - 4,
                           p.x + Math.cos(a) * 19 * p.s, p.y + Math.sin(a) * 19 * p.s + 3);
    }
    ctx.stroke();
    ctx.fillStyle = COL.palmTrunk;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.4 * p.s, 0, Math.PI * 2); ctx.fill();
  }

  // Street lamps: small posts with a warm glow dot.
  ctx.fillStyle = '#6d6d75';
  for (i = 0; i < this.lamps.length; i++) {
    var l = this.lamps[i];
    if (l.x < vx || l.y < vy || l.x > vx + vw || l.y > vy + vh) continue;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    ctx.fillStyle = '#ffe9a3';
    ctx.beginPath(); ctx.arc(l.x, l.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6d6d75';
  }
};

// Pulsing beacon + floating label for the current mission marker.
World.drawMarker = function (ctx, m) {
  var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 240);
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.3 * pulse;
  ctx.fillStyle = CFG.COLORS.marker;
  ctx.beginPath(); ctx.arc(m.x, m.y, 34 + pulse * 10, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = CFG.COLORS.marker;
  ctx.beginPath(); ctx.arc(m.x, m.y, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a5c00';
  ctx.font = 'bold 17px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('!', m.x, m.y + 1);
  if (m.label) {
    ctx.font = 'bold 13px Arial';
    var w = ctx.measureText(m.label).width + 16;
    ctx.fillStyle = 'rgba(20,20,28,0.72)';
    roundRect(ctx, m.x - w / 2, m.y - 58, w, 22, 6); ctx.fill();
    ctx.fillStyle = '#ffe082';
    ctx.fillText(m.label, m.x, m.y - 46);
  }
  ctx.restore();
};
