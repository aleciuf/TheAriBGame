const worldEl = document.getElementById("world");
const sceneEl = document.getElementById("scene");

const WORLD_W = 900;
const WORLD_H = 520;
const FOX_SIZE = 48;
const SPEED = 260;
const PROXIMITY = 78;

const BG_IMAGE = "bg.png";
const COLLISION_IMAGE = "collision.png";
const CHARACTER_PATH = "characters/";

const DEFAULT_NPC_SIZE = 56;
const NPC_SCALE = 1;

const CAMERA_ZOOM = 1.6;
const DEBUG_ENABLED = true;

sceneEl.style.width = WORLD_W + "px";
sceneEl.style.height = WORLD_H + "px";
sceneEl.style.backgroundImage = `url("${BG_IMAGE}")`;

const npcs = [
  { id: "character_1", x: 180, y: 140, size: 56, line: "A grafiko!!!" },
  { id: "character_2", x: 680, y: 120, size: 60, line: "Hai un goniometro?" },
  { id: "character_3", x: 270, y: 360, size: 52, line: "............" },
  { id: "character_4", x: 700, y: 360, size: 64, line: "Sto cazzo de grafiko" },
  { id: "character_5", x: 460, y: 250, size: 56, line: "Miao." }
];

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
let joyVec = { x: 0, y: 0 };

function clamp (v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist (ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function viewport () {
  return worldEl.getBoundingClientRect();
}

function createEntity ({ id, x, y, size }) {
  const el = document.createElement("div");
  el.className = "entity";
  el.dataset.id = id;

  const img = document.createElement("img");
  img.src = `${CHARACTER_PATH}${id}.png`;
  img.alt = id;
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

function ensureBubble (el, text) {
  let b = el.querySelector(".bubble");
  if (!b) {
    b = document.createElement("div");
    b.className = "bubble";
    b.innerHTML = `<div class="box"></div><div class="tail"></div>`;
    el.appendChild(b);
  }
  b.querySelector(".box").textContent = text;
}

function removeBubble (el) {
  const b = el.querySelector(".bubble");
  if (b) { b.remove(); }
}

/* NPC CREATION */

const npcEls = new Map();

for (const n of npcs) {
  const size = (n.size ?? DEFAULT_NPC_SIZE) * NPC_SCALE;
  npcEls.set(n.id, createEntity({ ...n, size }));
}

/* PLAYER */

const player = { x: 350, y: 230 };
const playerEl = createEntity({ id: "player", x: player.x, y: player.y, size: FOX_SIZE });

/* PROXIMITY */

let activeId = null;

function nearest () {
  let bestId = null;
  let bestD = Infinity;

  for (const n of npcs) {
    const size = (n.size ?? DEFAULT_NPC_SIZE) * NPC_SCALE;
    const d = dist(n.x + size / 2, n.y + size / 2, player.x + FOX_SIZE / 2, player.y + FOX_SIZE / 2);
    if (d < bestD) { bestD = d; bestId = n.id; }
  }

  return { id: bestId, d: bestD };
}

function setActive (id) {
  if (activeId === id) { return; }

  if (activeId) {
    const prev = npcEls.get(activeId);
    prev.classList.remove("active");
    removeBubble(prev);
  }

  activeId = id;
  if (!id) { return; }

  const n = npcs.find((v) => v.id === id);
  const el = npcEls.get(id);
  el.classList.add("active");
  ensureBubble(el, n.line);
}

/* INPUT: keyboard */

window.addEventListener("keydown", (e) => {
  if (e.key in keys) { keys[e.key] = true; e.preventDefault(); }
}, { passive: false });

window.addEventListener("keyup", (e) => {
  if (e.key in keys) { keys[e.key] = false; e.preventDefault(); }
}, { passive: false });

function stopKeys () {
  keys.ArrowUp = false;
  keys.ArrowDown = false;
  keys.ArrowLeft = false;
  keys.ArrowRight = false;
}

/* INPUT: touch on world */

function setKeysFromPoint (clientX, clientY) {
  const r = viewport();
  const x = (clientX - r.left) / r.width * WORLD_W;
  const y = (clientY - r.top) / r.height * WORLD_H;

  const dx = x - (player.x + FOX_SIZE / 2);
  const dy = y - (player.y + FOX_SIZE / 2);

  const dead = 12;
  keys.ArrowLeft = dx < -dead;
  keys.ArrowRight = dx > dead;
  keys.ArrowUp = dy < -dead;
  keys.ArrowDown = dy > dead;
}

let worldPointerDown = false;

worldEl.addEventListener("pointerdown", (e) => {
  worldPointerDown = true;
  setKeysFromPoint(e.clientX, e.clientY);
  e.preventDefault();
}, { passive: false, capture: true });

worldEl.addEventListener("pointermove", (e) => {
  if (!worldPointerDown) { return; }
  setKeysFromPoint(e.clientX, e.clientY);
  e.preventDefault();
}, { passive: false, capture: true });

worldEl.addEventListener("pointerup", (e) => {
  worldPointerDown = false;
  stopKeys();
  e.preventDefault();
}, { passive: false, capture: true });

worldEl.addEventListener("pointercancel", () => {
  worldPointerDown = false;
  stopKeys();
}, { capture: true });

/* INPUT: joystick */

const joy = document.getElementById("joy");
const joyKnob = document.getElementById("joyKnob");

if (joy && joyKnob) {
  let joyActive = false;

  function setKnob (nx, ny, radius) {
    const kx = nx * radius;
    const ky = ny * radius;
    joyKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  }

  function resetJoy () {
    joyVec.x = 0;
    joyVec.y = 0;
    joyKnob.style.transform = "translate(-50%, -50%)";
  }

  joy.addEventListener("pointerdown", (e) => {
    joyActive = true;
    joy.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, { passive: false });

  joy.addEventListener("pointermove", (e) => {
    if (!joyActive) { return; }

    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    const radius = Math.min(r.width, r.height) * 0.34;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, radius);

    const nx = (dx / len) * (clamped / radius);
    const ny = (dy / len) * (clamped / radius);

    joyVec.x = nx;
    joyVec.y = ny;

    setKnob(nx, ny, radius);
    e.preventDefault();
  }, { passive: false });

  joy.addEventListener("pointerup", (e) => {
    joyActive = false;
    resetJoy();
    e.preventDefault();
  }, { passive: false });

  joy.addEventListener("pointercancel", () => {
    joyActive = false;
    resetJoy();
  });
}

function inputVector () {
  let x = 0;
  let y = 0;

  if (keys.ArrowLeft) { x -= 1; }
  if (keys.ArrowRight) { x += 1; }
  if (keys.ArrowUp) { y -= 1; }
  if (keys.ArrowDown) { y += 1; }

  if (x || y) {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len, mag: 1 };
  }

  const mag = clamp(Math.hypot(joyVec.x, joyVec.y), 0, 1);
  if (mag < 0.08) { return { x: 0, y: 0, mag: 0 }; }

  return { x: joyVec.x / (mag || 1), y: joyVec.y / (mag || 1), mag };
}

/* COLLISION */

const collision = {
  ready: false,
  disabled: false,
  canvas: document.createElement("canvas"),
  ctx: null
};

collision.canvas.width = WORLD_W;
collision.canvas.height = WORLD_H;
collision.ctx = collision.canvas.getContext("2d", { willReadFrequently: true });

(function loadCollisionMask () {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    collision.ctx.clearRect(0, 0, WORLD_W, WORLD_H);
    collision.ctx.drawImage(img, 0, 0, WORLD_W, WORLD_H);
    collision.ready = true;
  };
  img.onerror = () => {
    collision.disabled = true;
  };
  img.src = COLLISION_IMAGE;
})();

function isWalkableAt (x, y) {
  if (collision.disabled) { return true; }
  if (!collision.ready) { return true; }

  const px = clamp(Math.round(x), 0, WORLD_W - 1);
  const py = clamp(Math.round(y), 0, WORLD_H - 1);

  try {
    const data = collision.ctx.getImageData(px, py, 1, 1).data;
    return (data[0] + data[1] + data[2]) >= 600;
  } catch (err) {
    collision.disabled = true;
    return true;
  }
}

function playerFoot (nx, ny) {
  return { x: nx + FOX_SIZE / 2, y: ny + FOX_SIZE * 0.85 };
}

/* DEBUG (D) */

let debugVisible = false;
let debugEl = null;

function toggleDebug () {
  if (!DEBUG_ENABLED) { return; }

  debugVisible = !debugVisible;

  if (!debugEl) {
    debugEl = document.createElement("img");
    debugEl.src = COLLISION_IMAGE;
    debugEl.style.position = "absolute";
    debugEl.style.left = "0";
    debugEl.style.top = "0";
    debugEl.style.width = "100%";
    debugEl.style.height = "100%";
    debugEl.style.opacity = "0.35";
    debugEl.style.pointerEvents = "none";
    debugEl.style.imageRendering = "pixelated";
    sceneEl.appendChild(debugEl);
  }

  debugEl.style.display = debugVisible ? "block" : "none";
}

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "d") {
    toggleDebug();
  }
});

/* CAMERA */

function applyCamera () {
  const r = viewport();

  const viewW = r.width;
  const viewH = r.height;

  const targetX = viewW / 2 - (player.x + FOX_SIZE / 2) * CAMERA_ZOOM;
  const targetY = viewH / 2 - (player.y + FOX_SIZE / 2) * CAMERA_ZOOM;

  const minX = viewW - WORLD_W * CAMERA_ZOOM;
  const minY = viewH - WORLD_H * CAMERA_ZOOM;

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

  const v = inputVector();
  const speed = SPEED * v.mag;

  const stepX = v.x * speed * dt;
  const stepY = v.y * speed * dt;

  let nx = clamp(player.x + stepX, 0, WORLD_W - FOX_SIZE);
  let ny = clamp(player.y + stepY, 0, WORLD_H - FOX_SIZE);

  const foot = playerFoot(nx, ny);

  if (isWalkableAt(foot.x, foot.y)) {
    player.x = nx;
    player.y = ny;
  } else {
    nx = clamp(player.x + stepX, 0, WORLD_W - FOX_SIZE);
    ny = player.y;
    let f = playerFoot(nx, ny);
    if (isWalkableAt(f.x, f.y)) { player.x = nx; }

    nx = player.x;
    ny = clamp(player.y + stepY, 0, WORLD_H - FOX_SIZE);
    f = playerFoot(nx, ny);
    if (isWalkableAt(f.x, f.y)) { player.y = ny; }
  }

  setPos(playerEl, player.x, player.y, FOX_SIZE);

  const n = nearest();
  setActive(n.d <= PROXIMITY ? n.id : null);

  applyCamera();
  requestAnimationFrame(loop);
}

applyCamera();
requestAnimationFrame(loop);
