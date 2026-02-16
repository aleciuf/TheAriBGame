const worldEl = document.getElementById("world");
const sceneEl = document.getElementById("scene");

/* CONFIG */

const MAP_W = 1280;
const MAP_H = 1270;

const VIEWPORT_RATIO = 900 / 520;

const PLAYER_SIZE = 64;
const SPEED = 320;
const PROXIMITY = 90;

const CAMERA_ZOOM = 1.6;

const BG_IMAGE = "bg.png";
const COLLISION_IMAGE = "collision.png";
const CHARACTER_PATH = "characters/";

const DEFAULT_NPC_SIZE = 70;

const DEBUG_ENABLED = true;

/* BACKGROUND */

const bgImg = document.createElement("img");
bgImg.src = BG_IMAGE;
bgImg.style.position = "absolute";
bgImg.style.left = "0";
bgImg.style.top = "0";
bgImg.style.width = MAP_W + "px";
bgImg.style.height = MAP_H + "px";
bgImg.draggable = false;

sceneEl.appendChild(bgImg);

sceneEl.style.width = MAP_W + "px";
sceneEl.style.height = MAP_H + "px";

/* NPCS */

const npcs = [
  { id: "character_1", x: 200, y: 200, size: 70, line: "A grafiko!!!" },
  { id: "character_2", x: 800, y: 300, size: 70, line: "Hai un goniometro?" },
  { id: "character_3", x: 400, y: 900, size: 70, line: "............" }
];

function clamp (v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist (ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function createEntity ({ id, x, y, size }) {
  const el = document.createElement("div");
  el.className = "entity";
  el.dataset.id = id;

  const img = document.createElement("img");
  img.src = `${CHARACTER_PATH}${id}.png`;
  img.draggable = false;

  el.appendChild(img);
  sceneEl.appendChild(el);

  setPos(el, x, y, size);
  return el;
}

function setPos (el, x, y, size) {
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.width = size + "px";
  el.style.height = size + "px";
}

const npcEls = new Map();

for (const n of npcs) {
  npcEls.set(n.id, createEntity(n));
}

/* PLAYER */

const player = { x: MAP_W / 2, y: MAP_H / 2 };

const playerEl = createEntity({
  id: "player",
  x: player.x,
  y: player.y,
  size: PLAYER_SIZE
});

/* INPUT */

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener("keydown", (e) => {
  if (e.key in keys) { keys[e.key] = true; }
});

window.addEventListener("keyup", (e) => {
  if (e.key in keys) { keys[e.key] = false; }
});

/* COLLISION */

const collision = {
  ready: false,
  canvas: document.createElement("canvas"),
  ctx: null
};

collision.canvas.width = MAP_W;
collision.canvas.height = MAP_H;
collision.ctx = collision.canvas.getContext("2d", { willReadFrequently: true });

(function loadCollision () {
  const img = new Image();
  img.onload = () => {
    collision.ctx.drawImage(img, 0, 0);
    collision.ready = true;
  };
  img.src = COLLISION_IMAGE;
})();

function isWalkableAt (x, y) {
  if (!collision.ready) { return true; }

  const px = clamp(Math.round(x), 0, MAP_W - 1);
  const py = clamp(Math.round(y), 0, MAP_H - 1);

  const data = collision.ctx.getImageData(px, py, 1, 1).data;
  return (data[0] + data[1] + data[2]) >= 600;
}

/* CAMERA */

function applyCamera () {
  const rect = worldEl.getBoundingClientRect();
  const viewW = rect.width;
  const viewH = rect.height;

  const targetX = viewW / 2 - (player.x + PLAYER_SIZE / 2) * CAMERA_ZOOM;
  const targetY = viewH / 2 - (player.y + PLAYER_SIZE / 2) * CAMERA_ZOOM;

  const minX = viewW - MAP_W * CAMERA_ZOOM;
  const minY = viewH - MAP_H * CAMERA_ZOOM;

  const tx = clamp(targetX, minX, 0);
  const ty = clamp(targetY, minY, 0);

  sceneEl.style.transform = `translate(${tx}px, ${ty}px) scale(${CAMERA_ZOOM})`;
}

window.addEventListener("resize", () => {
  applyCamera();
});

/* GAME LOOP */

let last = performance.now();

function loop (t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;

  let vx = 0;
  let vy = 0;

  if (keys.ArrowLeft) { vx -= 1; }
  if (keys.ArrowRight) { vx += 1; }
  if (keys.ArrowUp) { vy -= 1; }
  if (keys.ArrowDown) { vy += 1; }

  const len = Math.hypot(vx, vy) || 1;

  const nx = clamp(player.x + (vx / len) * SPEED * dt, 0, MAP_W - PLAYER_SIZE);
  const ny = clamp(player.y + (vy / len) * SPEED * dt, 0, MAP_H - PLAYER_SIZE);

  const footX = nx + PLAYER_SIZE / 2;
  const footY = ny + PLAYER_SIZE * 0.85;

  if (isWalkableAt(footX, footY)) {
    player.x = nx;
    player.y = ny;
  }

  setPos(playerEl, player.x, player.y, PLAYER_SIZE);

  applyCamera();

  requestAnimationFrame(loop);
}

applyCamera();
requestAnimationFrame(loop);
