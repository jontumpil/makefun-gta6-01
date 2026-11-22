// Sunfall City — shots.js
// Screenshot staging for the make.fun dossier. When the page is opened with
// ?shot=1..4, the game boots into a posed, deterministic scene instead of the
// title screen: the world is rebuilt from a fixed seed, the player, cars,
// police and mission state are placed by hand, the normal loop runs for about
// a second so the HUD and AI settle, and then the frame freezes with
// window.__shotReady = true so a headless browser can capture it.
//
//   1 — cover: Jae on foot downtown, objective + minimap on show
//   2 — driving through traffic on a Package Run
//   3 — a three-star police chase
//   4 — the Marina Score: guards, the cash case, and Jae closing in

(function () {
  var params = new URLSearchParams(window.location.search);
  var shot = parseInt(params.get('shot') || '0', 10);
  if (!shot || shot < 1 || shot > 4) return;
  window.__shotNumber = shot;

  window.addEventListener('DOMContentLoaded', function () {
    // Rebuild everything from one seed so the shot is identical every load.
    seedRng(20261122);
    World.build();
    Game.newGame();
    seedRng(4242); // entity placement below uses its own stream

    var staging = [null, stageCover, stageDriving, stageChase, stageMarina];
    staging[shot]();

    // Centre the camera on the action immediately.
    var p = Game.player;
    Game.camera.x = clamp(p.x - Game.camera.w / 2, 0, Math.max(0, CFG.WORLD_W - Game.camera.w));
    Game.camera.y = clamp(p.y - Game.camera.h / 2, 0, Math.max(0, CFG.WORLD_H - Game.camera.h));

    // Let the simulation breathe for a moment, then freeze the posed frame.
    setTimeout(function () {
      Game.frozen = true;
      Game.render();
      window.__shotReady = true;
    }, 1100);
  });

  function putPlayerOnFoot(x, y, angle) {
    var p = Game.player;
    if (p.driving) Vehicles.exitCar(p);
    p.x = x; p.y = y; p.angle = angle;
    World.collide(p, p.r);
  }

  function putPlayerInCar(x, y, angle, speed, color) {
    var car = Vehicles.makeCar(x, y, angle, color || '#e74c3c', 'player');
    car.speed = speed;
    Vehicles.list.push(car);
    var p = Game.player;
    p.car = car; p.driving = true; p.x = x; p.y = y;
    return car;
  }

  function addTraffic(x, y, angle, color) {
    var car = Vehicles.makeCar(x, y, angle, color, 'traffic');
    car.speed = car.cruise;
    Vehicles.list.push(car);
    return car;
  }

  function addCop(x, y, angle) {
    var cop = Vehicles.makeCar(x, y, angle, CFG.COLORS.police, 'police');
    cop.speed = 330;
    Vehicles.list.push(cop);
    return cop;
  }

  function stageCover() {
    // Downtown corner: Jae on foot, peds around, traffic passing, and the
    // first delivery objective live on the HUD and minimap.
    var x = World.roadsX[2], y = World.roadsY[2];
    putPlayerOnFoot(x + 86, y + 84, -0.7);
    Missions.index = 0; Missions.stage = 1;
    addTraffic(x - 26, y - 210, Math.PI / 2, '#f39c12');
    addTraffic(x + 26, y + 250, -Math.PI / 2, '#3498db');
    addTraffic(x - 240, y + 26, 0, '#ecf0f1');
    Game.notify('Mission 1: First Wheels');
  }

  function stageDriving() {
    // Mid Package Run: Jae's stolen coupe in flowing traffic, package aboard,
    // the safehouse marked across town and the clock ticking on the HUD.
    var y = World.roadsY[3];
    putPlayerInCar(World.roadsX[3] + 160, y + 26, 0, 330, '#9b59b6');
    Missions.index = 1; Missions.stage = 1; Missions.carrying = true; Missions.timer = 47;
    Police.heat = CFG.HEAT_PER_STAR + 8; // one star of attention
    addTraffic(World.roadsX[3] + 430, y + 26, 0, '#f1c40f');
    addTraffic(World.roadsX[3] - 190, y + 26, 0, '#1abc9c');
    addTraffic(World.roadsX[4] - 60, y - 26, Math.PI, '#e67e22');
    addTraffic(World.roadsX[3] + 26, y - 330, Math.PI / 2, '#fd79a8');
    Game.notify('Package aboard — lose the tail!');
  }

  function stageChase() {
    // Three stars: squad cars closing on Jae's car from behind and the side.
    var y = World.roadsY[2];
    var px = World.roadsX[4] + 120;
    putPlayerInCar(px, y + 26, 0, 395, '#e74c3c');
    Missions.index = 2; Missions.stage = 0;
    Police.heat = CFG.HEAT_PER_STAR * 3 + 10;
    Police.lastKnownX = px; Police.lastKnownY = y + 26;
    addCop(px - 190, y + 30, 0.12);
    addCop(px - 300, y - 60, 0.3);
    addCop(px + 90, y - 120, 2.6);
    addTraffic(px + 330, y + 26, 0, '#95a5a6');
    Game.notify('SUNFALL PD — pull over!');
  }

  function stageMarina() {
    // The Marina Score, seconds before the grab: two guards on the dock,
    // the cash case glowing between them, Jae approaching on foot.
    var m = World.marina;
    Missions.index = 3; Missions.stage = 1; Missions.caseSpawned = true;
    Combat.spawnGuard(m.x - 90, m.y - 110);
    Combat.spawnGuard(m.x + 30, m.y - 150);
    putPlayerOnFoot(m.x - 150, m.y + 30, -0.9);
    Game.player.hp = 82;
    Game.notify('The Marina Score — grab the case!');
  }
})();
