// Sunfall City — config.js
// Every tunable number for the game lives here: world geometry, road layout,
// movement speeds, wanted-level tuning, mission rewards and the colour palette.
// Nothing in this file touches the DOM; it is pure data read by all other files.

var CFG = {
  // World geometry. The city is a grid of blocks separated by roads.
  WORLD_W: 3200,
  WORLD_H: 2400,
  ROAD_W: 118,          // asphalt width of every street
  BLOCK: 400,           // distance between neighbouring road centrelines
  ROAD_X0: 260,         // centreline x of the first vertical road
  ROAD_Y0: 260,         // centreline y of the first horizontal road
  COLS: 8,              // vertical roads
  ROWS: 6,              // horizontal roads
  BEACH_X: 2920,        // sand starts here, on the east edge
  WATER_X: 3060,        // open water starts here

  // Player on foot
  WALK_SPEED: 168,      // px per second
  SPRINT_SPEED: 268,
  PLAYER_R: 13,         // collision radius
  PLAYER_MAX_HP: 100,

  // Vehicles
  CAR_LEN: 46,
  CAR_WID: 24,
  CAR_ACCEL: 340,       // px/s^2 when the throttle is held
  CAR_BRAKE: 520,
  CAR_MAX_SPEED: 430,   // px/s forward
  CAR_MAX_REVERSE: 150,
  CAR_TURN: 2.55,       // rad/s at full lock, scaled by speed
  TRAFFIC_SPEED: 165,
  POLICE_SPEED: 452,    // a touch faster than the player's top speed

  // Wanted system
  HEAT_STEAL: 34,       // stealing a car
  HEAT_HIT_CAR: 16,     // ramming another car
  HEAT_HIT_PED: 46,     // running a pedestrian down
  HEAT_SHOT: 22,        // firing a weapon in public
  HEAT_PER_STAR: 40,    // heat needed per star
  MAX_STARS: 5,
  HEAT_DECAY: 3.2,      // heat per second lost while unseen
  SIGHT_RANGE: 560,     // police "see" the player inside this radius
  BUST_RADIUS: 64,      // a cop this close starts the bust meter
  BUST_TIME: 2.4,       // seconds of being pinned before BUSTED

  // Combat
  BULLET_SPEED: 780,
  BULLET_LIFE: 0.55,    // seconds
  GUN_COOLDOWN: 0.16,
  GUN_DAMAGE: 34,       // three hits drop a guard
  GUARD_HP: 100,
  GUARD_DAMAGE: 9,      // per guard bullet that lands
  GUARD_RANGE: 330,

  // Economy / mission rewards (filled in below)
  REWARDS: null,

  // Palette — warm, sun-soaked coastal colours.
  COLORS: null
};

// Mission payouts in dollars, indexed by mission number.
CFG.REWARDS = [250, 600, 900, 2500];

// The warm Sunfall palette. Buildings pick from ROOFS; the rest is fixed scenery.
CFG.COLORS = {
  grass: '#79a85b',
  blockGround: '#cbb98f',
  sidewalk: '#d8cfb4',
  road: '#4a4a52',
  roadEdge: '#f3e9c8',
  laneMark: '#f7d774',
  sand: '#f2dd9a',
  water: '#3d9db8',
  waterDeep: '#2f86a3',
  palmTrunk: '#8a6b42',
  palmLeaf: '#3f9e4d',
  player: '#ff7847',
  playerSkin: '#f2c193',
  pedShirts: ['#e8e3d5', '#7fb3d5', '#f1948a', '#82e0aa', '#f9e79f', '#d2b4de', '#f0b27a'],
  police: '#2e4a7d',
  policeLight: '#e74c3c',
  marker: '#ffd83d',
  health: '#58d158',
  healthLow: '#e74c3c',
  ROOFS: ['#e2725b', '#d95f43', '#c96f4a', '#e8a87c', '#b8574a', '#dda15e',
          '#bc6c25', '#e07a5f', '#d4a373', '#ccd5ae', '#a3b18a', '#e9c46a']
};

// Deterministic random helper (mulberry32). The screenshot staging reseeds this
// so staged scenes are identical on every load; normal play uses Math.random.
var _rngState = 123456789;
function rng() {
  _rngState |= 0; _rngState = (_rngState + 0x6D2B79F5) | 0;
  var t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function seedRng(seed) { _rngState = seed | 0; }
function randRange(a, b) { return a + rng() * (b - a); }
function randPick(arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
