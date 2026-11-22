// Sunfall City — missions.js
// Jae Corso's four-mission story chain. Missions run back to back: finish one
// and the next begins with a banner. Each mission is a small stage machine —
// a stage has an objective line, an optional map marker, and a completion test
// checked every frame. Finishing the chain unlocks free roam, and the whole
// story can be replayed with Enter.

var Missions = {
  index: 0,          // 0..3 active mission, 4 = story complete
  stage: 0,
  timer: 0,          // mission 2's delivery countdown
  carrying: false,   // mission 2 / 4 item in hand
  caseSpawned: false,

  NAMES: ['First Wheels', 'Package Run', 'Lose the Heat', 'The Marina Score'],

  reset: function () {
    this.index = 0; this.stage = 0; this.timer = 0;
    this.carrying = false; this.caseSpawned = false;
  },

  // Restart just the current mission (after a bust, a waste, or a failed run).
  restartCurrent: function () {
    this.stage = 0; this.timer = 0; this.carrying = false; this.caseSpawned = false;
    Police.setForced(0);
    Combat.clearGuards();
    if (this.index < 4) Game.notify('Mission restarted: ' + this.NAMES[this.index]);
  },

  // Free-roam Enter key: wipe the chain back to mission 1 and run it again.
  replay: function () {
    this.reset();
    Police.clear();
    Combat.clearGuards();
    this.startBanner();
  },

  startBanner: function () {
    if (this.index < 4) Game.notify('Mission ' + (this.index + 1) + ': ' + this.NAMES[this.index]);
  },

  completeMission: function () {
    var reward = CFG.REWARDS[this.index];
    Game.addCash(reward);
    Game.notify(this.NAMES[this.index] + ' complete — +$' + reward);
    Sfx.cash();
    this.index++;
    this.stage = 0; this.timer = 0; this.carrying = false; this.caseSpawned = false;
    Police.setForced(0);
    Combat.clearGuards();
    if (this.index >= 4) Game.notify('Story complete! Free roam — press Enter to replay the story.');
    else this.startBanner();
    Game.saveGame();
  },

  // The current objective line for the HUD.
  objective: function () {
    if (this.index >= 4) return 'Free roam. Press Enter to replay the story.';
    switch (this.index) {
      case 0:
        return this.stage === 0 ? 'Steal a car (walk up and press E)' : 'Deliver the car to Sunfall Auto Garage';
      case 1:
        if (this.stage === 0) return 'Pick up the package at the Harbor Warehouse';
        return 'Deliver the package to Palm Court Safehouse — ' + Math.ceil(this.timer) + 's';
      case 2:
        return this.stage === 0 ? 'Break police line of sight and stay hidden' : 'Reach the Old Depot Hideout';
      case 3:
        if (this.stage === 0) return 'Drive to Sunfall Marina';
        if (this.stage === 1) return 'Shoot past the guards and grab the cash case';
        return 'Escape! Get the cash to Palm Court Safehouse';
    }
    return '';
  },

  // The current map marker, or null when the stage has no fixed destination.
  marker: function () {
    if (this.index >= 4) return null;
    var W = World;
    switch (this.index) {
      case 0: return this.stage === 1 ? W.garage : null;
      case 1: return this.stage === 0 ? W.packageSpot : W.safehouse;
      case 2: return this.stage === 1 ? W.hideout : null;
      case 3:
        if (this.stage === 0) return W.marina;
        if (this.stage === 1) return { x: W.marina.x - 30, y: W.marina.y - 60, label: 'Cash case' };
        return W.safehouse;
    }
    return null;
  },

  atMarker: function (player, m, radius) {
    var px = player.driving && player.car ? player.car.x : player.x;
    var py = player.driving && player.car ? player.car.y : player.y;
    return dist2(px, py, m.x, m.y) < radius * radius;
  },

  update: function (dt) {
    if (this.index >= 4 || Game.state !== 'playing') return;
    var player = Game.player, W = World;
    switch (this.index) {

      case 0: // First Wheels
        if (this.stage === 0 && player.driving) { this.stage = 1; Game.notify('Nice wheels. Now deliver it.'); }
        else if (this.stage === 1 && player.driving && this.atMarker(player, W.garage, 84)) this.completeMission();
        break;

      case 1: // Package Run
        if (this.stage === 0 && this.atMarker(player, W.packageSpot, 62)) {
          this.stage = 1; this.carrying = true; this.timer = 80;
          Police.setForced(2);
          Sfx.pickup();
          Game.notify('Package picked up — the heat is on!');
        } else if (this.stage === 1) {
          this.timer -= dt;
          if (this.timer <= 0) {
            Game.notify('Too slow — the package went cold. Try again.');
            this.restartCurrent();
          } else if (this.atMarker(player, W.safehouse, 76)) {
            this.completeMission();
          }
        }
        break;

      case 2: // Lose the Heat
        if (this.stage === 0) {
          if (Police.forcedStars === 0) Police.setForced(3);
          // Hidden long enough? unseenTime is Police's own line-of-sight clock.
          if (Police.unseenTime > 3.2) { this.stage = 1; Game.notify('You broke their line of sight — now move!'); }
        } else if (this.atMarker(player, W.hideout, 84)) {
          Police.clear();
          this.completeMission();
        }
        break;

      case 3: // The Marina Score
        if (this.stage === 0 && this.atMarker(player, W.marina, 96)) {
          this.stage = 1;
          if (!this.caseSpawned) {
            this.caseSpawned = true;
            Combat.spawnGuard(W.marina.x - 90, W.marina.y - 110);
            Combat.spawnGuard(W.marina.x + 30, W.marina.y - 150);
            Game.notify('Guards! The case is on the dock — grab it.');
          }
        } else if (this.stage === 1) {
          var kase = { x: W.marina.x - 30, y: W.marina.y - 60 };
          if (!player.driving && this.atMarker(player, kase, 44)) {
            this.stage = 2; this.carrying = true;
            Police.setForced(3);
            Sfx.pickup();
            Game.notify('Case grabbed — RUN!');
          }
        } else if (this.stage === 2 && this.atMarker(player, W.safehouse, 84)) {
          Police.clear();
          this.completeMission();
        }
        break;
    }
  }
};
