# Sunfall City — an original open-world crime game

[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Rank](https://make.fun/badge/gta6-01/jontumpil/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Reward](https://make.fun/badge/gta6-01/jontumpil/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Sunfall City** is a top-down 2D open-world crime game that runs entirely in
the browser — pure HTML5 canvas and classic JavaScript, no libraries, no build
step, no network requests. You are **Jae Corso**, newly arrived in a sun-soaked
coastal city of palm-lined avenues, terracotta rooftops and one long beach.
Start with nothing, steal your first car, and work a four-mission story chain
for fixer money while the Sunfall PD tries to run you down.

## What's in the city

- **A living city** — an 8×6 road grid with lane markings, ~90 buildings with
  collision, sidewalks, street lamps, palms, a beach with umbrellas, and open
  water on the east shore.
- **On foot & behind the wheel** — walk, sprint, steal any parked car with `E`,
  and drive with arcade physics. Traffic AI holds its lanes, brakes for the
  car ahead, and turns at intersections.
- **Pedestrians** who stroll the kerbs and flee from gunfire, speeding cars
  and trouble.
- **A wanted system** — stealing cars, ramming traffic, running people down
  and shooting all raise your stars (up to 5). Police cars spawn on nearby
  roads, chase and ram you; break their line of sight and the heat decays.
  Get pinned and you're **BUSTED**; lose all your health and you're **WASTED**.
- **Combat** — aim with the mouse, click to shoot. The final mission is
  guarded by armed men who shoot back.
- **Four-mission story** — *First Wheels* (steal & deliver a car),
  *Package Run* (a timed delivery under a 2-star tail), *Lose the Heat*
  (survive a 3-star chase and reach the hideout), and *The Marina Score*
  (shoot past two guards, grab the cash case, escape to the safehouse).
  Finish the story and free roam continues; press `Enter` to replay it.
- **HUD & minimap** — cash, health, wanted stars, the current objective with
  its distance, an off-screen objective arrow, and a live minimap with roads,
  traffic, police blips and the mission marker.
- **Save & continue** — progress (cash, mission, position) autosaves to
  `localStorage`; the title screen's Continue button picks it back up.
- **Synth sound** — engine hum, sirens, gunshots, pickups and cash, all
  generated with WebAudio. No audio files. `M` mutes.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move / drive |
| Shift | Sprint |
| E | Steal, enter or exit a car |
| Mouse + left click | Aim & shoot (on foot) |
| P / Esc | Pause |
| M | Mute |
| Enter | Replay the story (after finishing it) |

## Run it

Any static file server pointed at `game/` works. With Node:

```sh
node serve.ts        # then open http://localhost:8080
```

or simply:

```sh
python3 -m http.server 8000 --directory game
```

`main.ts` is the competition entry program: it copies `game/` and
`screenshots/` to the output directory and writes the `dossier.json` summary
with the vendored make.fun library (`vendor/makefun-game.ts`).

## Screenshots

The four images in `screenshots/` are real renders of this game, staged
deterministically by `game/src/shots.js` — open the game with `?shot=1`
through `?shot=4` to see the same scenes live: downtown on foot, driving the
Package Run, a three-star chase, and the Marina Score.

## Code layout

One job per file, all classic scripts loaded in order by `game/index.html`:

- `game/src/config.js` — every tunable: world geometry, speeds, heat, rewards, palette
- `game/src/world.js` — city generation, collision, scenery and marker drawing
- `game/src/vehicles.js` — car physics, parked cars, theft, traffic AI
- `game/src/people.js` — Jae on foot, pedestrians and their fleeing
- `game/src/police.js` — the wanted system, police AI, bust logic
- `game/src/combat.js` — shooting, bullets, the marina guards
- `game/src/missions.js` — the four-mission story chain
- `game/src/hud.js` — HUD and minimap
- `game/src/audio.js` — the WebAudio synth
- `game/src/game.js` — boot, input, camera, state machine, save/load, main loop
- `game/src/shots.js` — the deterministic screenshot staging (`?shot=1..4`)

Everything in Sunfall City — the city, the names, the art, the code — is
original to this project.
