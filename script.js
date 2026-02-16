const worldEl = document.getElementById("world");
const sceneEl = document.getElementById("scene");

const MAP_W = 2048;
const MAP_H = 2048;

const PLAYER_SIZE = 80;
const SPEED = 320;
const PROXIMITY = 70;

const CAMERA_ZOOM = 1.1;

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
bgImg.style.pointerEvents = "none";
sceneEl.appendChild(bgImg);

const npcs = [
  { id: "character_1", x: 1125, y: 1663, size: 75, line: "A grafiko!!!" },
  { id: "character_2", x: 1155, y: 1713, size: 75, line: "Hai un goniometro?" },
  { id: "character_3", x: 396, y: 1674, size: 75, line: "............", activeImage: "character_3_b.png" },
  { id: "character_4", x: 441, y: 1639, size: 75, line: "Sto cazzo de grafiko" },
  { id: "character_5", x: 769, y: 1764, size: 75, line: "Miao." },
  { id: "character_6", x: 774, y: 1684, size: 75, line: "A grafiko!!!" },
  { id: "character_7", x: 1308, y: 1143, size: 75, line: "Hai un goniometro?" },
  { id: "character_8", x: 1362, y: 1105, size: 75, line: "............" },
  { id: "character_9", x: 396, y: 251, size: 75, line: "Sto cazzo de grafiko" },
  { id: "character_10", x: 866, y: 668, size: 75, line: "Miao." },
  { id: "character_11", x: 949, y: 656, size: 75, line: "Hai un goniometro?" },
  { id: "character_12", x: 952, y: 489, size: 75, line: "............" },
  { id: "character_13", x: 877, y: 471, size: 75, line: "Sto cazzo de grafiko" }
];

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
let joyVec = { x: 0, y: 0 };

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function entitySrc(id) {
  return `${CHARACTER_PATH}${id}.png`;
}

function createEntity({ id, x, y, size, baseImage, activeImage }) {
  const el = document.createElement("div");
  el.className = "entity";
  el.dataset.id = id;

  const img = document.createElement("img");
  img.src = baseImage ?? entitySrc(id);
  img.alt = id;
  img.draggable = false;
  el.appendChild(img);

  sceneEl.appendChild(el);
  setPos(el, x, y, size);

  return {
    el,
    img,
    baseSrc: img.src,
    activeSrc: activeImage ? `${CHARACTER_PATH}${activeImage}` : null
  };
}

function setPos(el, x, y, size) {
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.width = size + "px";
  el.style.height = size + "px";
}

function ensureBubble(el, text) {
  let b = el.querySelector(".bubble");

  if (!b) {
    b = document.createElement("div");
    b.className = "bubble";
    b.innerHTML = `<div class="bubble__box"></div><div class="bubble__tail"></div>`;
    el.appendChild(b);
  }

  const box = b.querySelector(".bubble__box");
  if (box) { box.textContent = text; }
}

function removeBubble(el) {
  const b = el.querySelector(".bubble");
  if (b) { b.remove(); }
}

const npcEls = new Map();

for (const n of npcs) {
  const size = n.size ?? DEFAULT_NPC_SIZE;
  npcEls.set(n.id, createEntity({ id: n.id, x: n.x, y: n.y, size, activeImage: n.activeImage }));
}

const player = { x: Math.round(MAP_W / 2), y: Math.round(MAP_H / 2) };
const playerEnt = createEntity({ id: "player", x: player.x, y: player.y, size: PLAYER_SIZE });

let activeId = null;

function nearest() {
  let bestId = null;
  let bestD = Infinity;

  for (const n of npcs) {
    const size = n.size ?? DEFAULT_NPC_SIZE;
    const d = dist(n.x + size / 2, n.y + size / 2, player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
    if (d < bestD) { bestD = d; bestId = n.id; }
  }

  return { id: bestId, d: bestD };
}

function setNpcSpriteActive(ent, isActive) {
  if (!ent || !ent.img) { return; }

  if (isActive) {
    if (ent.activeSrc) { ent.img.src = ent.activeSrc; }
  } else {
    ent.img.src = ent.baseSrc;
  }
}

function setActive(id) {
  if (activeId === id) { return; }

  if (activeId) {
    const prevEnt = npcEls.get(activeId);
    if (prevEnt) {
      prevEnt.el.classList.remove("active");
      prevEnt.el.style.zIndex = "";
      setNpcSpriteActive(prevEnt, false);
      removeBubble(prevEnt.el);
    }
  }

  activeId = id;
  if (!id) { return; }

  const n = npcs.find((v) => v.id === id);
  const ent = npcEls.get(id);
  if (!n || !ent) { return; }

  ent.el.classList.add("active");
  ent.el.style.zIndex = "9000";
  setNpcSpriteActive(ent, true);
  ensureBubble(ent.el, n.line);
}

window.addEventListener("keydown", (e) => {
  if (e.key in keys) { keys[e.key] = true; e.preventDefault(); }
}, { passive: false });

window.addEventListener("keyup", (e) => {
  if (e.key in keys) { keys[e.key] = false; e.preventDefault(); }
}, { passive: false });

function stopKeys() {
  keys.ArrowUp = false;
  keys.ArrowDown = false;
  keys.ArrowLeft = false;
  keys.ArrowRight = false;
}

function getCameraTransform() {
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

function applyCamera() {
  const cam = getCameraTransform();
  sceneEl.style.transform = `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.zoom})`;
}

function setKeysFromPoint(clientX, clientY) {
  const rect = worldEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const dx = clientX - cx;
  const dy = clientY - cy;

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

  function setKnob(nx, ny, radius) {
    const kx = nx * radius;
    const ky = ny * radius;
    joyKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  }

  function resetJoy() {
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

function inputVector() {
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

let debugVisible = false;
let debugEl = null;

function toggleDebug() {
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

window.addEventListener("resize", () => {
  sceneEl.style.width = MAP_W + "px";
  sceneEl.style.height = MAP_H + "px";
  bgImg.style.width = MAP_W + "px";
  bgImg.style.height = MAP_H + "px";
  applyCamera();
});

let last = performance.now();

function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;

  const v = inputVector();
  const speed = SPEED * v.mag;

  const stepX = v.x * speed * dt;
  const stepY = v.y * speed * dt;

  player.x = clamp(player.x + stepX, 0, MAP_W - PLAYER_SIZE);
  player.y = clamp(player.y + stepY, 0, MAP_H - PLAYER_SIZE);

  setPos(playerEnt.el, player.x, player.y, PLAYER_SIZE);

  const n = nearest();
  setActive(n.d <= PROXIMITY ? n.id : null);

  applyCamera();
  requestAnimationFrame(loop);
}

applyCamera();
requestAnimationFrame(loop);
