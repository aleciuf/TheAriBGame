const worldEl = document.getElementById("world");
const sceneEl = document.getElementById("scene");

/* background music */

const bgMusic = new Audio("music.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.5;
bgMusic.preload = "auto";

let musicStarted = false;

function startMusicOnce() {
  if (musicStarted) return;
  musicStarted = true;
  bgMusic.play().catch(() => { musicStarted = false; });
}

/* splash */

const splashEl = document.getElementById("splash");
let gameStarted = false;

function startGameOnce() {
  if (gameStarted) return;
  gameStarted = true;

  startMusicOnce();

  if (splashEl) {
    splashEl.classList.add("hide");
    window.setTimeout(() => {
      if (splashEl && splashEl.parentNode) splashEl.parentNode.removeChild(splashEl);
    }, 240);
  }
}

if (splashEl) {
  splashEl.addEventListener("pointerdown", (e) => {
    startGameOnce();
    e.preventDefault();
  }, { passive: false });

  splashEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.code === "Space") {
      startGameOnce();
      e.preventDefault();
    }
  });
}

const MAP_W = 2048;
const MAP_H = 2048;

const PLAYER_SIZE = 95;
const SPEED = 320;
const PROXIMITY = 70;

const CAMERA_ZOOM = 1.1;

const BG_IMAGE = "bg.png";
const COLLISION_IMAGE = "collision.png";
const CHARACTER_PATH = "characters/";

const DEFAULT_NPC_SIZE = 70;

const DEBUG_ENABLED = true;

const ACTIVE_SPRITE_DELAY_SEC = 5;
const MOVE_EPSILON_PX = 0.25;

const INPUT_MOVE_EPSILON = 0.04;
const INPUT_INTENT_EPSILON = 0.02;

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
  { id: "character_1", x: 1125, y: 1663, size: 90, line: "A grafiko!!!" },
  { id: "character_2", x: 1155, y: 1713, size: 90, line: "Hai un goniometro?" },
  { id: "character_3", x: 396, y: 1674, size: 90, line: "............", activeImage: "character_3_b.png" },
  { id: "character_4", x: 441, y: 1639, size: 90, line: "Sto cazzo de grafiko" },
  { id: "character_5", x: 769, y: 1764, size: 90, line: "Miao." },
  { id: "character_6", x: 774, y: 1684, size: 75, line: "A grafiko!!!" },
  { id: "character_7", x: 1308, y: 1143, size: 90, line: "Hai un goniometro?" },
  { id: "character_8", x: 1362, y: 1105, size: 90, line: "............" },
  { id: "character_9", x: 396, y: 251, size: 90, line: "Sto cazzo de grafiko" },
  { id: "character_10", x: 866, y: 668, size: 90, line: "Miao." },
  { id: "character_11", x: 949, y: 656, size: 90, line: "Hai un goniometro?" },
  { id: "character_12", x: 952, y: 489, size: 90, line: "............" },
  { id: "character_13", x: 877, y: 471, size: 90, line: "Sto cazzo de grafiko" }
];

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

const joyState = { x: 0, y: 0, mag: 0, intentMag: 0, active: false };

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function entitySrc(id) {
  return `${CHARACTER_PATH}${id}.png`;
}

function createEntity({ id, x, y, size, baseImage, activeImage }) {
  const el = document.createElement("div");
  el.className = "entity";
  if (id !== "player") {
    el.classList.add("npc");
    el.style.setProperty("--bounce-delay", `${-(Math.random() * 1.2).toFixed(2)}s`);
  }
  el.dataset.id = id;

  const img = document.createElement("img");
  img.src = baseImage ?? entitySrc(id);
  img.alt = id;
  img.draggable = false;

  const fx = document.createElement("div");
  fx.className = "entity__fx";
  fx.appendChild(img);
  el.appendChild(fx);

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
  el.style.left = Math.round(x) + "px";
  el.style.top = Math.round(y) + "px";
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
  if (box) box.textContent = text;
}

function removeBubble(el) {
  const b = el.querySelector(".bubble");
  if (b) b.remove();
}

const npcEls = new Map();

for (const n of npcs) {
  const size = n.size ?? DEFAULT_NPC_SIZE;
  npcEls.set(n.id, createEntity({ id: n.id, x: n.x, y: n.y, size, activeImage: n.activeImage }));
}

const player = { x: MAP_W / 2, y: MAP_H / 2 };
const playerEnt = createEntity({ id: "player", x: player.x, y: player.y, size: PLAYER_SIZE });

let activeId = null;

let stillNearSeconds = 0;
let lastNearId = null;
let activeSpriteApplied = false;

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
  if (!ent || !ent.img) return;
  if (isActive) {
    if (ent.activeSrc) ent.img.src = ent.activeSrc;
  } else {
    ent.img.src = ent.baseSrc;
  }
}

function resetStillNearState() {
  stillNearSeconds = 0;
  lastNearId = null;
  activeSpriteApplied = false;
}

function setActive(id) {
  if (activeId === id) return;

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
  resetStillNearState();

  if (!id) return;

  const n = npcs.find(v => v.id === id);
  const ent = npcEls.get(id);
  if (!n || !ent) return;

  ent.el.classList.add("active");
  ent.el.style.zIndex = "9000";

  setNpcSpriteActive(ent, false);
  ensureBubble(ent.el, n.line);
}

window.addEventListener("keydown", (e) => {
  if (!gameStarted) {
    if (e.key === "Enter" || e.key === " " || e.code === "Space") {
      startGameOnce();
      e.preventDefault();
    }
    return;
  }

  if (e.key in keys) { keys[e.key] = true; e.preventDefault(); }
}, { passive: false });

window.addEventListener("keyup", (e) => {
  if (!gameStarted) return;
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

  const dpr = window.devicePixelRatio || 1;
  const tx = Math.round(cam.tx * dpr) / dpr;
  const ty = Math.round(cam.ty * dpr) / dpr;

  sceneEl.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${cam.zoom})`;
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
  if (!gameStarted) return;
  worldPointerDown = true;
  setKeysFromPoint(e.clientX, e.clientY);
  e.preventDefault();
}, { passive: false, capture: true });

worldEl.addEventListener("pointermove", (e) => {
  if (!gameStarted) return;
  if (!worldPointerDown) return;
  setKeysFromPoint(e.clientX, e.clientY);
  e.preventDefault();
}, { passive: false, capture: true });

worldEl.addEventListener("pointerup", (e) => {
  if (!gameStarted) return;
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

  const JOY_KNOB_RADIUS_SCALE = 0.34;
  const JOY_INPUT_RADIUS_MULT = 2.6;
  const JOY_DEADZONE = 0.03;
  const JOY_EXPO = 1.15;

  function setKnob(nx, ny, radius) {
    const kx = nx * radius;
    const ky = ny * radius;
    joyKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  }

  function resetJoy() {
    joyState.x = 0;
    joyState.y = 0;
    joyState.mag = 0;
    joyState.intentMag = 0;
    joyState.active = false;
    joyKnob.style.transform = "translate(-50%, -50%)";
  }

  function applyJoyFromPointer(clientX, clientY) {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const dx = clientX - cx;
    const dy = clientY - cy;

    const knobRadius = Math.min(r.width, r.height) * JOY_KNOB_RADIUS_SCALE;
    const inputRadius = knobRadius * JOY_INPUT_RADIUS_MULT;

    const len = Math.hypot(dx, dy);

    if (len < 0.0001) {
      joyState.x = 0;
      joyState.y = 0;
      joyState.mag = 0;
      joyState.intentMag = 0;
      setKnob(0, 0, knobRadius);
      return;
    }

    const ux = dx / len;
    const uy = dy / len;

    const knobMag = Math.min(len, knobRadius) / knobRadius;
    const inputMagRaw = Math.min(len, inputRadius) / inputRadius;

    let mag = inputMagRaw;

    if (mag < JOY_DEADZONE) {
      mag = 0;
    } else {
      mag = (mag - JOY_DEADZONE) / (1 - JOY_DEADZONE);
      mag = Math.pow(mag, JOY_EXPO);
    }

    joyState.x = ux;
    joyState.y = uy;
    joyState.mag = mag;
    joyState.intentMag = inputMagRaw;

    setKnob(ux * knobMag, uy * knobMag, knobRadius);
  }

  joy.addEventListener("pointerdown", (e) => {
    if (!gameStarted) {
      startGameOnce();
      e.preventDefault();
      return;
    }

    joyActive = true;
    joyState.active = true;
    joy.setPointerCapture(e.pointerId);
    applyJoyFromPointer(e.clientX, e.clientY);
    e.preventDefault();
  }, { passive: false });

  joy.addEventListener("pointermove", (e) => {
    if (!gameStarted) return;
    if (!joyActive) return;
    applyJoyFromPointer(e.clientX, e.clientY);
    e.preventDefault();
  }, { passive: false });

  joy.addEventListener("pointerup", (e) => {
    if (!gameStarted) return;
    joyActive = false;
    resetJoy();
    e.preventDefault();
  }, { passive: false });

  joy.addEventListener("pointercancel", () => {
    joyActive = false;
    resetJoy();
  });
}

let debugVisible = false;
let debugEl = null;

function toggleDebug() {
  if (!DEBUG_ENABLED) return;

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
  if (!gameStarted) return;
  if (e.key.toLowerCase() === "d") toggleDebug();
});

window.addEventListener("resize", () => {
  sceneEl.style.width = MAP_W + "px";
  sceneEl.style.height = MAP_H + "px";
  bgImg.style.width = MAP_W + "px";
  bgImg.style.height = MAP_H + "px";
  applyCamera();
});

function updateNpcActiveSprite(dt, isPlayerMoving) {
  if (!activeId) {
    resetStillNearState();
    return;
  }

  const ent = npcEls.get(activeId);
  if (!ent) {
    resetStillNearState();
    return;
  }

  if (!ent.activeSrc) {
    resetStillNearState();
    return;
  }

  if (lastNearId !== activeId) {
    stillNearSeconds = 0;
    activeSpriteApplied = false;
    lastNearId = activeId;
    setNpcSpriteActive(ent, false);
  }

  if (isPlayerMoving) {
    stillNearSeconds = 0;
    activeSpriteApplied = false;
    setNpcSpriteActive(ent, false);
    return;
  }

  stillNearSeconds += dt;

  if (!activeSpriteApplied && stillNearSeconds >= ACTIVE_SPRITE_DELAY_SEC) {
    setNpcSpriteActive(ent, true);
    activeSpriteApplied = true;
  }
}

function inputVector() {
  let x = 0;
  let y = 0;

  if (keys.ArrowLeft) x -= 1;
  if (keys.ArrowRight) x += 1;
  if (keys.ArrowUp) y -= 1;
  if (keys.ArrowDown) y += 1;

  if (x || y) {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len, mag: 1 };
  }

  if (joyState.mag <= 0) return { x: 0, y: 0, mag: 0 };
  return { x: joyState.x, y: joyState.y, mag: joyState.mag };
}

function isAnyKeyMoving() {
  return !!(keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight);
}

let last = performance.now();

function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;

  const v = gameStarted ? inputVector() : { x: 0, y: 0, mag: 0 };
  const speed = SPEED * v.mag;

  const stepX = v.x * speed * dt;
  const stepY = v.y * speed * dt;

  const wasX = player.x;
  const wasY = player.y;

  player.x = clamp(player.x + stepX, 0, MAP_W - PLAYER_SIZE);
  player.y = clamp(player.y + stepY, 0, MAP_H - PLAYER_SIZE);

  setPos(playerEnt.el, player.x, player.y, PLAYER_SIZE);

  const movedByPos = Math.hypot(player.x - wasX, player.y - wasY) > MOVE_EPSILON_PX;
  const movedByInput = v.mag > INPUT_MOVE_EPSILON;
  const movedByIntent = isAnyKeyMoving() || (joyState.active && joyState.intentMag > INPUT_INTENT_EPSILON);
  const isPlayerMoving = movedByIntent || movedByInput || movedByPos;

  const n = nearest();
  setActive(n.d <= PROXIMITY ? n.id : null);

  updateNpcActiveSprite(dt, isPlayerMoving);

  applyCamera();
  requestAnimationFrame(loop);
}

applyCamera();
requestAnimationFrame(loop);
