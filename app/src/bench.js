// Teste automático de carga.
//
// Sobe a distância de renderização degrau por degrau e mede quanto o aparelho
// entrega em cada um. A saída é a resposta que a Fase 0 precisa dar: qual é o
// orçamento REAL de chunks visíveis, medido, não estimado.
//
// A média de FPS sozinha engana — 60 de média com engasgo a cada meio segundo
// parece ruim de jogar. Por isso medimos também o "1% pior": a média dos 1% de
// quadros mais lentos. É esse número que descreve a sensação de fluidez.

const RADII = [1, 2, 3, 4, 5, 6, 7, 8];
const WARMUP_MS = 1000;   // tempo para o mesher terminar e o cache assentar
const MEASURE_MS = 3000;

export class Bench {
  constructor(onRadiusChange) {
    this.onRadiusChange = onRadiusChange;
    this.active = false;
    this.results = [];
    this.stepIndex = 0;
    this.phase = 'idle';
    this.elapsed = 0;
    this.frames = [];
  }

  start() {
    this.active = true;
    this.results = [];
    this.stepIndex = 0;
    this._beginStep();
  }

  stop() {
    this.active = false;
    this.phase = 'idle';
  }

  _beginStep() {
    this.phase = 'warmup';
    this.elapsed = 0;
    this.frames = [];
    this.onRadiusChange(RADII[this.stepIndex]);
  }

  get label() {
    if (!this.active) return null;
    const radius = RADII[this.stepIndex];
    const step = `${this.stepIndex + 1}/${RADII.length}`;
    return this.phase === 'warmup'
      ? `Preparando ${step} — raio ${radius}`
      : `Medindo ${step} — raio ${radius}`;
  }

  // dtMs é o tempo do quadro que acabou de ser desenhado.
  update(dtMs, stats) {
    if (!this.active) return;
    this.elapsed += dtMs;

    if (this.phase === 'warmup') {
      if (this.elapsed >= WARMUP_MS) {
        this.phase = 'measure';
        this.elapsed = 0;
        this.frames = [];
      }
      return;
    }

    this.frames.push(dtMs);
    if (this.elapsed < MEASURE_MS) return;

    this.results.push(this._summarize(RADII[this.stepIndex], stats));
    this.stepIndex++;
    if (this.stepIndex >= RADII.length) {
      this.active = false;
      this.phase = 'done';
    } else {
      this._beginStep();
    }
  }

  _summarize(radius, stats) {
    const times = [...this.frames].sort((a, b) => a - b);
    const total = times.reduce((sum, t) => sum + t, 0);
    const avgFps = times.length > 0 ? 1000 / (total / times.length) : 0;

    const worstCount = Math.max(1, Math.floor(times.length * 0.01));
    const worst = times.slice(-worstCount);
    const lowFps = 1000 / (worst.reduce((sum, t) => sum + t, 0) / worst.length);

    return {
      radius,
      chunks: stats.loadedChunks,
      visible: stats.visibleChunks,
      avgFps,
      lowFps,
      triangles: stats.triangles,
      drawCalls: stats.drawCalls,
      meshMs: stats.meshMs,
      gpuMB: stats.gpuBytes / (1024 * 1024),
    };
  }

  // Maior raio que sustentou o alvo, olhando o 1% pior e não a média: o objetivo
  // é "nunca engasga", não "a média fecha bonito".
  budgetFor(targetFps) {
    let best = null;
    for (const row of this.results) {
      if (row.lowFps >= targetFps) best = row;
      else break;
    }
    return best;
  }
}
