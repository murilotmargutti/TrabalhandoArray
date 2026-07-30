// Fase 0 — prova de conceito no aparelho.
//
// Este app não é o jogo. Ele existe para responder quatro perguntas que não dá
// para responder por dedução, só medindo:
//
//   1. Quantos chunks a GPU aguenta desenhar antes do FPS cair?
//   2. O controle Bluetooth chega pela Gamepad API ou como evento de tecla?
//   3. Renderizar em 720p e deixar a TV ampliar compensa mesmo?
//   4. As paletas dos temas ficam bonitas no painel de verdade?
//
// Roda igual no navegador e na TV: mesmo arquivo, sem build. No navegador serve
// para iterar rápido; o número que vale para decidir escopo, porém, é o medido
// na TV.

import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Bench } from './bench.js';
import { THEMES } from './themes.js';
import { meshChunk } from './mesher.js';
import { generateChunk, surfaceHeight, CHUNK_SX, CHUNK_SZ } from './terrain.js';

const LOGICAL_W = 1920;
const LOGICAL_H = 1080;

const RENDER_SCALES = [
  { scale: 1.0,     label: '1920x1080 (nativo)' },
  { scale: 2 / 3,   label: '1280x720 (TV amplia)' },
  { scale: 0.5,     label: '960x540 (TV amplia)' },
];

// Quanto o piso do sombreamento sobe na direção do branco. A UA8550 de 55" é
// painel IPS: contraste baixo e preto acinzentado, então os tons escuros se
// juntam. Qual desses três valores é o certo não se decide no monitor — decide-se
// olhando a TV, e é para isso que existe o ajuste.
const SHADE_LIFTS = [
  { lift: 0.00, label: 'padrão (monitor)' },
  { lift: 0.20, label: 'médio' },
  { lift: 0.35, label: 'painel claro (IPS)' },
];

const MOVE_SPEED = 16;      // blocos por segundo
const LOOK_SPEED = 2.2;     // radianos por segundo
const MESH_BUDGET_PER_FRAME = 4;

const el = {
  canvas: document.getElementById('gl'),
  stats: document.getElementById('statsBody'),
  inputs: document.getElementById('inputsBody'),
  bench: document.getElementById('bench'),
  benchBody: document.getElementById('benchBody'),
  banner: document.getElementById('banner'),
  themeName: document.getElementById('themeName'),
  help: document.getElementById('help'),
  panels: [document.getElementById('stats'), document.getElementById('inputs'),
           document.getElementById('help'), document.getElementById('themeName')],
};

function fatal(message) {
  el.banner.style.display = 'block';
  el.banner.innerHTML = `<span class="bad">${message}</span>`;
}

// A TV entrega exatamente 1920x1080 ao app, então lá a escala é 1. No navegador
// o mesmo layout encolhe para caber na janela — o que a gente vê na tela do PC é
// a composição idêntica à da TV, só menor.
function fitToWindow() {
  const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  document.body.style.transformOrigin = '0 0';
  document.body.style.transform = `scale(${scale})`;
  document.body.style.marginLeft = `${(window.innerWidth - LOGICAL_W * scale) / 2}px`;
  document.body.style.marginTop = `${(window.innerHeight - LOGICAL_H * scale) / 2}px`;
}

let renderer;
try {
  renderer = new Renderer(el.canvas);
} catch (error) {
  fatal(error.message);
  throw error;
}

const input = new Input();

const state = {
  themeIndex: 0,
  scaleIndex: 1,          // começa em 720p: é a aposta do projeto, então é o padrão a validar
  liftIndex: 0,
  radius: 3,
  panelsVisible: true,
  camera: { pos: new Float32Array([8, 0, 8]), yaw: 0.6, pitch: -0.28 },
  loaded: new Map(),      // chave "cx,cz" -> true
  queue: [],
  meshMs: 0,
  fps: 0,
  frameMs: 0,
};

state.camera.pos[1] = surfaceHeight(8, 8) + 10;

const bench = new Bench((radius) => setRadius(radius));

function applyTheme() {
  const theme = THEMES[state.themeIndex];
  renderer.setTheme(theme);
  el.themeName.textContent = `Tema: ${theme.name}  (${state.themeIndex + 1}/${THEMES.length})`;
}

function applyRenderScale() {
  const { scale } = RENDER_SCALES[state.scaleIndex];
  renderer.resize(Math.round(LOGICAL_W * scale), Math.round(LOGICAL_H * scale));
}

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function setRadius(radius) {
  state.radius = Math.max(1, Math.min(10, radius));
  refreshChunks();
}

// Carrega o que falta e descarrega o que saiu do raio. Descarregar importa tanto
// quanto carregar: malha de chunk fora de vista ocupando memória de GPU é o
// caminho mais curto para o app ser morto pelo webOS.
function refreshChunks() {
  const c0x = Math.floor(state.camera.pos[0] / CHUNK_SX);
  const c0z = Math.floor(state.camera.pos[2] / CHUNK_SZ);
  const wanted = new Set();

  for (let dz = -state.radius; dz <= state.radius; dz++) {
    for (let dx = -state.radius; dx <= state.radius; dx++) {
      const cx = c0x + dx, cz = c0z + dz;
      const key = chunkKey(cx, cz);
      wanted.add(key);
      if (!state.loaded.has(key) && !state.queue.some((job) => job.key === key)) {
        // Fila ordenada por distância: o que está na cara da jogadora aparece
        // primeiro, e a borda longe pode chegar um quadro depois sem incomodar.
        state.queue.push({ key, cx, cz, dist: dx * dx + dz * dz });
      }
    }
  }

  state.queue.sort((a, b) => a.dist - b.dist);
  state.queue = state.queue.filter((job) => wanted.has(job.key));

  for (const key of [...state.loaded.keys()]) {
    if (!wanted.has(key)) {
      renderer.removeChunk(key);
      state.loaded.delete(key);
    }
  }
}

function processQueue() {
  const started = performance.now();
  let built = 0;
  while (state.queue.length > 0 && built < MESH_BUDGET_PER_FRAME) {
    const job = state.queue.shift();
    const voxels = generateChunk(job.cx, job.cz);
    const mesh = meshChunk(voxels);
    renderer.uploadChunk(job.key, job.cx, job.cz, mesh);
    state.loaded.set(job.key, true);
    built++;
  }
  state.meshMs = built > 0 ? performance.now() - started : 0;
}

function updateCamera(dt) {
  const cam = state.camera;
  cam.yaw += input.look.x * LOOK_SPEED * dt;
  cam.pitch -= input.look.y * LOOK_SPEED * dt;
  const limit = Math.PI / 2 - 0.05;
  cam.pitch = Math.max(-limit, Math.min(limit, cam.pitch));

  // Mesma base do renderizador: se divergir, andar para o lado vai para o lado
  // errado.
  const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  const rx = Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
  const step = MOVE_SPEED * dt;

  cam.pos[0] += (fx * -input.move.y + rx * input.move.x) * step;
  cam.pos[2] += (fz * -input.move.y + rz * input.move.x) * step;
  cam.pos[1] += input.vertical * step;
  cam.pos[1] = Math.max(2, Math.min(120, cam.pos[1]));
}

function handleActions() {
  if (input.pressed('A') || input.pressed('START')) {
    if (bench.active) {
      bench.stop();
    } else {
      state.budgetApplied = false;
      bench.start();
    }
  }
  if (input.pressed('X')) {
    state.scaleIndex = (state.scaleIndex + 1) % RENDER_SCALES.length;
    applyRenderScale();
  }
  if (input.pressed('Y')) {
    state.themeIndex = (state.themeIndex + 1) % THEMES.length;
    applyTheme();
  }
  if (input.pressed('B')) {
    state.panelsVisible = !state.panelsVisible;
    for (const panel of el.panels) panel.classList.toggle('hidden', !state.panelsVisible);
  }
  if (input.pressed('LT')) {
    state.liftIndex = (state.liftIndex + 1) % SHADE_LIFTS.length;
    renderer.shadeLift = SHADE_LIFTS[state.liftIndex].lift;
  }
  if (input.pressed('LB')) setRadius(state.radius - 1);
  if (input.pressed('RB')) setRadius(state.radius + 1);
}

// --- painéis ---------------------------------------------------------------

const row = (key, value, cls = 'v') =>
  `<div class="row"><span class="k">${key}</span><span class="${cls}">${value}</span></div>`;

function fpsClass(fps) {
  if (fps >= 55) return 'good';
  if (fps >= 28) return 'warn';
  return 'bad';
}

function drawStats() {
  const stats = renderer.stats;
  const mem = performance.memory;
  let html = '';
  html += row('FPS', state.fps.toFixed(0), fpsClass(state.fps));
  html += row('tempo/quadro', `${state.frameMs.toFixed(1)} ms`);
  html += row('render', RENDER_SCALES[state.scaleIndex].label);
  html += row('sombreamento', SHADE_LIFTS[state.liftIndex].label);
  html += row('raio de chunks', state.radius);
  html += row('chunks carregados', state.loaded.size);
  html += row('chunks visíveis', stats.visibleChunks ?? 0);
  html += row('draw calls', stats.drawCalls);
  html += row('triângulos', (stats.triangles / 1000).toFixed(0) + ' mil');
  html += row('malha (último quadro)', `${state.meshMs.toFixed(1)} ms`);
  html += row('geometria na GPU', `${(renderer.gpuBytes / 1048576).toFixed(1)} MB`);
  if (state.queue.length > 0) html += row('na fila', state.queue.length, 'warn');
  if (mem) {
    html += row('heap JS', `${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB`);
    html += row('teto do heap', `${(mem.jsHeapSizeLimit / 1048576).toFixed(0)} MB`);
  }
  el.stats.innerHTML = html;
}

function drawInputs() {
  const d = input.diag;
  let html = '';
  html += row('lendo de', d.source, d.source.startsWith('Gamepad') ? 'good' : 'warn');
  html += row('Gamepad API existe', d.gamepadApiPresent ? 'sim' : 'NÃO',
              d.gamepadApiPresent ? 'good' : 'bad');
  html += row('controles conectados', d.padCount);
  if (d.padId) {
    html += `<div class="k" style="margin-top:6px">id do controle</div>`;
    html += `<div class="v" style="font-size:21px;word-break:break-all">${d.padId}</div>`;
    html += row('mapping', d.padMapping);
  }
  if (d.axes.length > 0) html += row('eixos', d.axes.join('  '));
  html += row('botões apertados', d.pressedButtons.length > 0 ? d.pressedButtons.join(', ') : '—');
  if (d.keyLog.length > 0) {
    html += `<div class="k" style="margin-top:6px">últimas teclas</div>`;
    html += d.keyLog.map((k) => `<div class="v" style="font-size:21px">${k}</div>`).join('');
  }
  el.inputs.innerHTML = html;
}

function drawBenchResults() {
  if (bench.results.length === 0) {
    el.bench.style.display = 'none';
    return;
  }
  el.bench.style.display = 'block';
  // A lista de botões já não é útil depois do teste e disputaria o mesmo canto
  // que a tabela.
  el.help.classList.add('hidden');

  let html = '<table><tr><th>raio</th><th>chunks vis.</th><th>FPS médio</th>' +
             '<th>1% pior</th><th>triângulos</th><th>draws</th><th>GPU</th></tr>';
  for (const r of bench.results) {
    html += `<tr>
      <td>${r.radius}</td>
      <td>${r.visible}</td>
      <td class="${fpsClass(r.avgFps)}">${r.avgFps.toFixed(0)}</td>
      <td class="${fpsClass(r.lowFps)}">${r.lowFps.toFixed(0)}</td>
      <td>${(r.triangles / 1000).toFixed(0)} mil</td>
      <td>${r.drawCalls}</td>
      <td>${r.gpuMB.toFixed(1)} MB</td>
    </tr>`;
  }
  html += '</table>';

  const at60 = bench.budgetFor(55);
  const at30 = bench.budgetFor(28);
  html += `<div style="margin-top:14px">`;
  html += row('render medido', RENDER_SCALES[state.scaleIndex].label);
  html += row('orçamento a 60 FPS',
    at60 ? `raio ${at60.radius} — ${at60.visible} chunks visíveis` : 'nem o raio 1 aguentou',
    at60 ? 'good' : 'bad');
  html += row('orçamento a 30 FPS',
    at30 ? `raio ${at30.radius} — ${at30.visible} chunks visíveis` : 'nem o raio 1 aguentou',
    at30 ? 'good' : 'bad');
  html += `</div>`;
  el.benchBody.innerHTML = html;
}

// --- laço principal --------------------------------------------------------

let lastTime = performance.now();
let fpsAccum = 0, fpsFrames = 0;
let hudTimer = 0;

function frame(now) {
  const dtMs = Math.min(now - lastTime, 100);   // trava o passo se a aba dormir
  lastTime = now;
  const dt = dtMs / 1000;

  input.update();
  handleActions();
  if (!bench.active) updateCamera(dt);
  refreshChunks();
  processQueue();
  renderer.render(state.camera, state.radius * CHUNK_SX + 16);

  fpsAccum += dtMs;
  fpsFrames++;
  if (fpsAccum >= 250) {
    state.fps = (fpsFrames * 1000) / fpsAccum;
    state.frameMs = fpsAccum / fpsFrames;
    fpsAccum = 0;
    fpsFrames = 0;
  }

  bench.update(dtMs, {
    ...renderer.stats,
    loadedChunks: state.loaded.size,
    meshMs: state.meshMs,
    gpuBytes: renderer.gpuBytes,
  });

  // Terminar o teste no degrau mais pesado deixaria o app parecendo quebrado.
  // Assim que ele acaba, cai para o orçamento que a própria medição aprovou.
  if (bench.phase === 'done' && !state.budgetApplied) {
    state.budgetApplied = true;
    const budget = bench.budgetFor(55) || bench.budgetFor(28);
    setRadius(budget ? budget.radius : 2);
  }

  const label = bench.label;
  if (label) {
    el.banner.style.display = 'block';
    el.banner.textContent = label;
  } else {
    el.banner.style.display = 'none';
  }

  hudTimer += dtMs;
  if (hudTimer >= 200) {   // painel em DOM a 5 Hz: atualizar todo quadro custaria FPS
    hudTimer = 0;
    if (state.panelsVisible) {
      drawStats();
      drawInputs();
      drawBenchResults();
    }
  }

  requestAnimationFrame(frame);
}

window.addEventListener('resize', fitToWindow);

fitToWindow();
applyTheme();
applyRenderScale();
refreshChunks();
requestAnimationFrame(frame);
