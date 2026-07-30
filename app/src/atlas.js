// Atlas de textura gerado por código, em tons de cinza.
//
// A cor final do bloco é `cinza_da_textura * cor_do_tema`, resolvida no shader.
// Isso é de propósito: trocar de tema fica sendo um único upload de uniform,
// sem regerar textura nem remontar malha nenhuma. Se a troca de tema fosse
// mexer na geometria, ela custaria caro e não daria para oferecer como opção.
//
// Também mantém o teste honesto: medir geometria SEM textura daria um número
// otimista demais, porque amostragem de textura consome banda de memória — e
// banda é justamente o que costuma faltar numa GPU de TV.

import { BLOCK_COUNT } from './themes.js';

const TILE = 32;          // pixels por tile
export const ATLAS_COLS = 4;
const ROWS = Math.ceil(BLOCK_COUNT / ATLAS_COLS);

// Ruído determinístico: mesmo atlas em toda execução, então duas medições
// diferentes são comparáveis.
function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// Cada padrão devolve um brilho entre ~0.72 e 1.0. Nunca perto de 0: o tom
// escuro tem que vir do tema e da oclusão, não da textura.
const PATTERNS = {
  1: (x, y) => (hash2(x, y) < 0.14 ? 0.82 : 0.97) - hash2(x * 3, y * 3) * 0.06, // grama
  2: (x, y) => 0.86 + hash2(x >> 1, y >> 1) * 0.14,                             // terra
  3: (x, y) => 0.88 + hash2(x >> 2, y >> 2) * 0.12,                             // pedra
  4: (x, y) => 0.93 + hash2(x, y) * 0.07,                                       // areia
  5: (x, y) => 0.90 + Math.sin((x + y * 0.5) * 0.7) * 0.06,                     // água
  6: (x, y) => (x % 8 < 2 ? 0.84 : 0.97) - hash2(x, y) * 0.05,                  // tronco
  7: (x, y) => (hash2(x, y) < 0.3 ? 0.78 : 1.0),                                // folhas
};

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * ATLAS_COLS;
  canvas.height = TILE * ROWS;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(canvas.width, canvas.height);

  for (let type = 1; type < BLOCK_COUNT; type++) {
    const pattern = PATTERNS[type] || (() => 0.95);
    const ox = (type % ATLAS_COLS) * TILE;
    const oy = Math.floor(type / ATLAS_COLS) * TILE;

    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const v = Math.max(0, Math.min(1, pattern(x, y))) * 255;
        const i = ((oy + y) * canvas.width + (ox + x)) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Canto superior esquerdo do tile, em coordenadas 0..1.
export function tileOrigin(type) {
  return [
    (type % ATLAS_COLS) / ATLAS_COLS,
    Math.floor(type / ATLAS_COLS) / ROWS,
  ];
}

export const TILE_UV = [1 / ATLAS_COLS, 1 / ROWS];

// Margem para o mipmap não sangrar o tile vizinho.
export const UV_INSET = 0.5 / (TILE * ATLAS_COLS);
