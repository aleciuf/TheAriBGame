const worldEl = document.getElementById("world");
const sceneEl = document.getElementById("scene");

const MAP_W = 1280;
const MAP_H = 1270;

const PLAYER_SIZE = 64;
const SPEED = 320;
const PROXIMITY = 110;

const CAMERA_ZOOM = 1.6;

const BG_IMAGE = "bg.png";
const COLLISION_IMAGE = "collision.png";
const CHARACTER_PATH = "characters/";

const DEFAULT_NPC_SIZE = 70;

const DEBUG_ENABLED = true;

sceneEl.style.width = MAP_W + "px";
sceneEl.style.height = MAP_H + "px";

const bgImg = document.createElement("img");
bgImg.className = "bg";
bgImg.src = BG_IMAGE;
bgImg.alt = "";
bgImg.draggable = false;
bgImg.style.position = "absolute";
bgImg.style.left = "0";
bgImg.style.top = "0";
bgImg.style.width = MAP_W + "px";
bgImg.style.height = MAP_H + "px";
sceneEl.appendChild(bgImg);

const npcs = [
  { id: "character_1", x: 200, y: 200, size: 70, line: "A grafiko!!!" },
  { id: "character_2", x: 820, y: 320, size: 70, line: "Hai un goniometro?" },
  { id: "character_3", x: 420, y: 920, size: 70, line: "............" },
  { id: "character_4", x: 980, y: 860, size: 74, line: "Sto cazzo de grafiko" },
  { id: "character_5", x: 620, y: 560, size: 70, line: "Miao." }
];

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
let joyVec = { x: 0, y: 0 };

function clamp (v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist (ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

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

const npcEls = new Map();

for (const n of npcs) {
  const size = n.size ?? DEFAULT_NPC_SIZE;
  npcEls.set(n.id, createEntity({ ...n, size }));
}

const player = { x: Math.round(MAP_W / 2), y: Math.round(MAP_H / 2) };
const playerEl = createEntity({ id: "player", x: player.x, y: player.y, size: PLAYER_SIZE });

let activeId = null;

function nearest () {
  let bestId = null;
  let bestD = Infinity;

  for (const n of npcs) {
    const size = n.size ?? DEFAULT_NPC_SIZE;
    const d = dist(
      n.x + size / 2,
      n.y + size / 2,
      player.x + PLAYER_SIZE / 2,
      player.y + PLAYER_SIZE / 2
    );
    if (d < bestD) { bestD = d; bestId = n.id; }
  }

  return { id: bestId, d: bestD };
}

function setActive (id) {
  if (activeId === id) { return; }

  if (activeId) {
    const prev = npcEls.get(activeId);
    if (prev) {
      prev.classList.remove("active");
      removeBubble(prev);
    }
  }

  activeId = id;
  if (!id) { return; }

  const n = npcs.find((v) => v.id === id);
  const el = npcEls.get(id);
  if (!n || !el) { return; }

  el.classList.add("active");
  ensureBubble(el, n.line);
}

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

function setKeysFromPoint (clientX, clientY) {
  const rect = worldEl.getBoundingClientRect();
  const viewW = rect.width;
  const viewH = rect.height;

  const cam = getCameraTransform();
  const wx = (clientX - rect.left - cam.tx) / cam.zoom;
  const wy = (clientY - rect.top - cam.ty) / cam.zoom;

  const dx = wx - (player.x + PLAYER_SIZE / 2);
  const dy = wy - (player.y + PLAYER_SIZE / 2);

  const dead = 18;
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

const collision = {
  ready: false,
  disabled: false,
  canvas: document.createElement("canvas"),
  ctx: null
};

collision.canvas.width = MAP_W;
collision.canvas.height = MAP_H;
collision.ctx = collision.canvas.getContext("2d", { willReadFrequently: true });

(function loadCollisionMask () {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    collision.ctx.clearRect(0, 0, MAP_W, MAP_H);
    collision.ctx.drawImage(img, 0, 0);
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

  const px = clamp(Math.round(x), 0, MAP_W - 1);
  const py = clamp(Math.round(y), 0, MAP_H - 1);

  try {
    const data = collision.ctx.getImageData(px, py, 1, 1).data;
    return (data[0] + data[1] + data[2]) >= 600;
  } catch (err) {
    collision.disabled = true;
    return true;
  }
}

function playerFoot (nx, ny) {
  return { x: nx + PLAYER_SIZE / 2, y: ny + PLAYER_SIZE * 0.85 };
}

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
    debugEl.style.width = MAP_W + "px";
    debugEl.style.height = MAP_H + "px";
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

function getCameraTransform () {
  const rect = worldEl.getBoundingClientRect();
  const viewW = rect.width;
  const viewH = rect.height;

  const targetX = viewW / 2 - (player.x + PLAYER_SIZE / 2) * CAMERA_ZOOM;
  const targetY = viewH / 2 - (player.y + PLAYER_SIZE / 2) * CAMERA_ZOOM;

  const minX = viewW - MAP_W * CAMERA_ZOOM;
  const minY = viewH - MAP_H * CAMERA_ZOOM;

  const tx = clamp(targetX, minX, 0);
  const ty = clamp(targetY, minY, 0);

  return { tx, ty, zoom: CAMERA_ZOOM };
}

function applyCamera () {
  const cam = getCameraTransform();
  sceneEl.style.transform = `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.zoom})`;
}

window.addEventListener("resize", () => {
  applyCamera();
});

let last = performance.now();

function loop (t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;

  const v = inputVector();
  const speed = SPEED * v.mag;

  const stepX = v.x * speed * dt;
  const stepY = v.y * speed * dt;

  let nx = clamp(player.x + stepX, 0, MAP_W - PLAYER_SIZE);
  let ny = clamp(player.y + stepY, 0, MAP_H - PLAYER_SIZE);

  const foot = playerFoot(nx, ny);

  if (isWalkableAt(foot.x, foot.y)) {
    player.x = nx;
    player.y = ny;
  } else {
    nx = clamp(player.x + stepX, 0, MAP_W - PLAYER_SIZE);
    ny = player.y;
    let f = playerFoot(nx, ny);
    if (isWalkableAt(f.x, f.y)) { player.x = nx; }

    nx = player.x;
    ny = clamp(player.y + stepY, 0, MAP_H - PLAYER_SIZE);
    f = playerFoot(nx, ny);
    if (isWalkableAt(f.x, f.y)) { player.y = ny; }
  }

  setPos(playerEl, player.x, player.y, PLAYER_SIZE);

  const n = nearest();
  setActive(n.d <= PROXIMITY ? n.id : null);

  applyCamera();
  requestAnimationFrame(loop);
}

applyCamera();
requestAnimationFrame(loop);
