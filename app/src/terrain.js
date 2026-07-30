// Geração de terreno para o teste.
//
// Não é o terreno do jogo final — é um terreno com relevo, água e árvores só
// para que a malha gerada tenha complexidade parecida com a real. Medir FPS em
// cima de um chão plano daria um número bonito e mentiroso.

import { BLOCK } from './themes.js';

export const CHUNK_SX = 16;
export const CHUNK_SY = 48;
export const CHUNK_SZ = 16;

// O volume é gerado com 1 bloco de borda em cada lado. Assim o mesher enxerga
// os vizinhos sem precisar consultar o chunk ao lado — o que evita costura
// errada nas fronteiras e oclusão de ambiente quebrada nas quinas.
export const PAD = 1;
export const PSX = CHUNK_SX + PAD * 2;
export const PSY = CHUNK_SY + PAD * 2;
export const PSZ = CHUNK_SZ + PAD * 2;

export const pidx = (px, py, pz) => px + pz * PSX + py * PSX * PSZ;

const WATER_LEVEL = 12;

function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

const smooth = (t) => t * t * (3 - 2 * t);

function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const tx = smooth(x - xi), ty = smooth(y - yi);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
}

function heightAt(wx, wz) {
  const n =
    valueNoise(wx * 0.035, wz * 0.035) * 0.60 +
    valueNoise(wx * 0.090, wz * 0.090) * 0.28 +
    valueNoise(wx * 0.210, wz * 0.210) * 0.12;
  return Math.floor(6 + n * 22);
}

// Árvore decidida pela posição no mundo, não por sorteio: qualquer chunk pode
// ser regerado e sai idêntico, e a mesma cena se repete entre medições.
function hasTree(wx, wz) {
  return hash2(wx * 7 + 11, wz * 13 + 5) > 0.988;
}

export function generateChunk(cx, cz) {
  const data = new Uint8Array(PSX * PSY * PSZ);

  for (let pz = 0; pz < PSZ; pz++) {
    for (let px = 0; px < PSX; px++) {
      const wx = cx * CHUNK_SX + px - PAD;
      const wz = cz * CHUNK_SZ + pz - PAD;
      const h = heightAt(wx, wz);

      for (let py = 0; py < PSY; py++) {
        const wy = py - PAD;
        let block = BLOCK.AIR;

        if (wy <= h) {
          if (wy === h) {
            block = h <= WATER_LEVEL + 1 ? BLOCK.SAND : BLOCK.GRASS;
          } else if (wy > h - 4) {
            block = BLOCK.DIRT;
          } else {
            block = BLOCK.STONE;
          }
        } else if (wy <= WATER_LEVEL) {
          block = BLOCK.WATER;
        }

        if (block !== BLOCK.AIR) data[pidx(px, py, pz)] = block;
      }

      // Árvores: tronco de 5 e uma copa 3x3x3. Copa entra também quando a
      // árvore nasce no chunk vizinho, senão a folhagem seria cortada na borda.
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const tx = wx + dx, tz = wz + dz;
          if (!hasTree(tx, tz)) continue;
          const th = heightAt(tx, tz);
          if (th <= WATER_LEVEL + 1) continue;

          const trunkTop = th + 5;
          if (dx === 0 && dz === 0) {
            for (let wy = th + 1; wy <= trunkTop; wy++) {
              const py = wy + PAD;
              if (py >= 0 && py < PSY) data[pidx(px, py, pz)] = BLOCK.LOG;
            }
          }
          if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
            for (let wy = trunkTop - 1; wy <= trunkTop + 1; wy++) {
              const py = wy + PAD;
              if (py < 0 || py >= PSY) continue;
              if (dx === 0 && dz === 0 && wy <= trunkTop) continue;
              const i = pidx(px, py, pz);
              if (data[i] === BLOCK.AIR) data[i] = BLOCK.LEAVES;
            }
          }
        }
      }
    }
  }

  return data;
}

export function surfaceHeight(wx, wz) {
  return Math.max(heightAt(wx, wz), WATER_LEVEL);
}
