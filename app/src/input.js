// Camada de entrada dupla: Gamepad API e teclado, ao mesmo tempo.
//
// Isso não é preciosismo. Numa TV webOS o controle Bluetooth pode chegar de duas
// formas — pela Gamepad API, como num PC, ou traduzido em eventos de tecla, do
// mesmo jeito que o Magic Remote. Qual das duas acontece é uma das perguntas que
// a Fase 0 existe para responder. Aceitando as duas desde já, o jogo funciona
// nos dois casos e o diagnóstico mostra qual está valendo.
//
// Nada aqui assume o mapeamento padrão de botões: o painel mostra o índice cru
// de tudo que for apertado, então o mapeamento real sai da observação.

const DEADZONE = 0.22;

// Mapeamento padrão (Xbox / "standard"). É palpite inicial, não verdade.
const PAD = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  BACK: 8, START: 9,
  DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15,
};

const KEY_ACTION = {
  Enter: 'A', NumpadEnter: 'A', Space: 'A',
  Escape: 'B', Backspace: 'B', KeyB: 'B',
  KeyX: 'X', KeyY: 'Y',
  KeyQ: 'LB', KeyE: 'RB',
  KeyC: 'LT',
  Tab: 'START',
};

const applyDeadzone = (v) => (Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE));

export class Input {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.vertical = 0;

    this.actions = new Set();     // ações disparadas neste frame (borda)
    this._held = new Set();       // botões de controle no frame anterior
    this._keys = new Set();       // teclas fisicamente abaixadas agora
    // Toque de tecla é travado aqui até o próximo update consumir. Sem isso, um
    // toque mais curto que um quadro (bem possível a 30 FPS) seria descartado
    // por ter subido e descido entre duas leituras.
    this._latched = new Set();

    this.diag = {
      source: 'nenhuma',
      padId: null,
      padMapping: null,
      padCount: 0,
      axes: [],
      pressedButtons: [],
      keyLog: [],
      gamepadApiPresent: typeof navigator.getGamepads === 'function',
    };

    window.addEventListener('keydown', (e) => this._onKey(e, true), { passive: false });
    window.addEventListener('keyup', (e) => this._onKey(e, false), { passive: false });
    window.addEventListener('gamepadconnected', (e) => {
      this.diag.keyLog.unshift(`controle conectado: ${e.gamepad.id}`);
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.diag.keyLog.unshift('controle desconectado');
    });
  }

  _onKey(event, down) {
    // Registra código e keyCode crus. Na TV o controle pode aparecer aqui com
    // números que não existem em teclado de PC — é exatamente o que queremos ver.
    if (down) {
      const label = `${event.code || '?'} (keyCode ${event.keyCode})`;
      if (this.diag.keyLog[0] !== label) {
        this.diag.keyLog.unshift(label);
        this.diag.keyLog.length = Math.min(this.diag.keyLog.length, 6);
      }
    }

    if (down) {
      this._keys.add(event.code);
      // event.repeat filtra a repetição automática do sistema: segurar a tecla
      // não pode disparar a ação dezenas de vezes.
      const action = KEY_ACTION[event.code];
      if (action && !event.repeat) this._latched.add(action);
    } else {
      this._keys.delete(event.code);
    }

    // Setas e Enter rolariam a página ou sairiam do app; segurar aqui.
    if (event.code.startsWith('Arrow') || event.code === 'Space' || event.code === 'Tab') {
      event.preventDefault();
    }
  }

  _readGamepad() {
    if (!this.diag.gamepadApiPresent) return null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let count = 0, chosen = null;
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      count++;
      if (!chosen) chosen = pad;
    }
    this.diag.padCount = count;
    return chosen;
  }

  update() {
    const held = new Set();
    let move = { x: 0, y: 0 };
    let look = { x: 0, y: 0 };
    let vertical = 0;

    const pad = this._readGamepad();
    if (pad) {
      this.diag.source = 'Gamepad API';
      this.diag.padId = pad.id;
      this.diag.padMapping = pad.mapping || '(vazio)';
      this.diag.axes = Array.from(pad.axes, (v) => Number(v.toFixed(2)));

      move.x = applyDeadzone(pad.axes[0] ?? 0);
      move.y = applyDeadzone(pad.axes[1] ?? 0);
      look.x = applyDeadzone(pad.axes[2] ?? 0);
      look.y = applyDeadzone(pad.axes[3] ?? 0);

      const pressed = [];
      pad.buttons.forEach((button, i) => {
        if (button.pressed || button.value > 0.5) pressed.push(i);
      });
      this.diag.pressedButtons = pressed;

      for (const [action, index] of Object.entries(PAD)) {
        if (pressed.includes(index)) held.add(action);
      }
      if (held.has('DUP')) vertical += 1;
      if (held.has('DDOWN')) vertical -= 1;
    } else {
      this.diag.padId = null;
      this.diag.axes = [];
      this.diag.pressedButtons = [];
    }

    if (this._keys.size > 0) {
      if (!pad) this.diag.source = 'teclado / controle remoto';

      const k = this._keys;
      if (k.has('KeyA') || k.has('ArrowLeft')) move.x -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) move.x += 1;
      if (k.has('KeyW') || k.has('ArrowUp')) move.y -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) move.y += 1;
      if (k.has('KeyJ')) look.x -= 1;
      if (k.has('KeyL')) look.x += 1;
      if (k.has('KeyI')) look.y -= 1;
      if (k.has('KeyK')) look.y += 1;
      if (k.has('KeyR')) vertical += 1;
      if (k.has('KeyF')) vertical -= 1;
      // Os botões de ação do teclado não entram em `held`: eles chegam pelo
      // travamento em _onKey, que já é por borda.
    } else if (!pad) {
      this.diag.source = 'nenhuma entrada detectada';
    }

    this.move = { x: Math.max(-1, Math.min(1, move.x)), y: Math.max(-1, Math.min(1, move.y)) };
    this.look = { x: Math.max(-1, Math.min(1, look.x)), y: Math.max(-1, Math.min(1, look.y)) };
    this.vertical = Math.max(-1, Math.min(1, vertical));

    // Ação vale só no frame em que o botão desce, senão um toque de meio segundo
    // trocaria de tema umas trinta vezes. Controle sai por comparação com o
    // frame anterior; teclado já vem travado por borda.
    this.actions = new Set([...held].filter((a) => !this._held.has(a)));
    for (const action of this._latched) this.actions.add(action);
    this._latched.clear();
    this._held = held;
  }

  pressed(action) {
    return this.actions.has(action);
  }
}
