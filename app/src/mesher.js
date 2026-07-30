// Construção da malha de um chunk.
//
// Estratégia: "culled mesher" — emite quad só para face que dá de frente com ar
// ou água. É o que a maioria dos jogos de voxel usa de verdade, então é a
// medição honesta. Existe otimização melhor (greedy meshing, que junta faces
// coplanares num quad só e derruba a contagem de triângulos bastante), mas ela
// entra na Fase 1 já sabendo quanto de folga temos.
//
// A oclusão de ambiente é calculada por vértice e assada direto na malha. Não
// existe luz dinâmica nenhuma no jogo — é isso que permite a cena inteira sair
// em uma draw call por chunk.

import { BLOCK } from './themes.js';
import { tileOrigin, TILE_UV, UV_INSET } from './atlas.js';
import { CHUNK_SX, CHUNK_SY, CHUNK_SZ, PAD, PSX, PSY, PSZ, pidx } from './terrain.js';

export const FLOATS_PER_VERTEX = 7; // pos(3) + uv(2) + shade(1) + tipo(1)

// Sombreamento fixo por orientação da face. Sem isto, um cubo iluminado por
// nada vira uma silhueta chapada e a criança não enxerga a forma do que
// construiu.
const FACE_LIGHT = [0.80, 0.80, 1.00, 0.55, 0.68, 0.68];

// n, u, v com cross(u, v) === n, para o quad sair no sentido anti-horário
// visto de fora e o culling de face traseira funcionar.
const FACES = [
  { n: [ 1,  0,  0], u: [ 0, 0, -1], v: [0, 1, 0] },
  { n: [-1,  0,  0], u: [ 0, 0,  1], v: [0, 1, 0] },
  { n: [ 0,  1,  0], u: [ 1, 0,  0], v: [0, 0, -1] },
  { n: [ 0, -1,  0], u: [ 1, 0,  0], v: [0, 0, 1] },
  { n: [ 0,  0,  1], u: [ 1, 0,  0], v: [0, 1, 0] },
  { n: [ 0,  0, -1], u: [-1, 0,  0], v: [0, 1, 0] },
];

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const AO_SHADE = [0.55, 0.72, 0.86, 1.0];

const isSolid = (b) => b !== BLOCK.AIR && b !== BLOCK.WATER;

class Growable {
  constructor(Type, initial) {
    this.Type = Type;
    this.buf = new Type(initial);
    this.len = 0;
  }
  need(extra) {
    if (this.len + extra <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + extra) cap *= 2;
    const next = new this.Type(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  push(...values) {
    this.need(values.length);
    for (let i = 0; i < values.length; i++) this.buf[this.len++] = values[i];
  }
  trimmed() {
    return this.buf.subarray(0, this.len);
  }
}

export function meshChunk(data) {
  const opaque = { verts: new Growable(Float32Array, 8192), idx: new Growable(Uint32Array, 4096) };
  const water = { verts: new Growable(Float32Array, 1024), idx: new Growable(Uint32Array, 512) };

  const at = (px, py, pz) => {
    if (px < 0 || py < 0 || pz < 0 || px >= PSX || py >= PSY || pz >= PSZ) return BLOCK.AIR;
    return data[pidx(px, py, pz)];
  };

  for (let y = 0; y < CHUNK_SY; y++) {
    for (let z = 0; z < CHUNK_SZ; z++) {
      for (let x = 0; x < CHUNK_SX; x++) {
        const px = x + PAD, py = y + PAD, pz = z + PAD;
        const block = data[pidx(px, py, pz)];
        if (block === BLOCK.AIR) continue;

        const isWater = block === BLOCK.WATER;
        const target = isWater ? water : opaque;
        const [u0, v0] = tileOrigin(block);

        for (let f = 0; f < 6; f++) {
          const { n, u, v } = FACES[f];
          const neighbor = at(px + n[0], py + n[1], pz + n[2]);

          // Bloco sólido esconde a face. Água só mostra a face que encosta no
          // ar, senão o volume submerso todo viraria geometria invisível.
          if (isWater ? neighbor !== BLOCK.AIR : isSolid(neighbor)) continue;

          const light = FACE_LIGHT[f];
          const base = target.verts.len / FLOATS_PER_VERTEX;
          const shades = [0, 0, 0, 0];

          for (let c = 0; c < 4; c++) {
            const [su, sv] = CORNERS[c];

            let ao = 3;
            if (!isWater) {
              const s1 = isSolid(at(
                px + n[0] + u[0] * su, py + n[1] + u[1] * su, pz + n[2] + u[2] * su));
              const s2 = isSolid(at(
                px + n[0] + v[0] * sv, py + n[1] + v[1] * sv, pz + n[2] + v[2] * sv));
              const cr = isSolid(at(
                px + n[0] + u[0] * su + v[0] * sv,
                py + n[1] + u[1] * su + v[1] * sv,
                pz + n[2] + u[2] * su + v[2] * sv));
              ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + cr);
            }
            shades[c] = AO_SHADE[ao] * light;

            const vx = x + 0.5 + (n[0] + u[0] * su + v[0] * sv) * 0.5;
            const vy = y + 0.5 + (n[1] + u[1] * su + v[1] * sv) * 0.5;
            const vz = z + 0.5 + (n[2] + u[2] * su + v[2] * sv) * 0.5;

            const tu = u0 + ((su + 1) / 2) * TILE_UV[0];
            const tv = v0 + ((1 - sv) / 2) * TILE_UV[1];
            const iu = Math.min(Math.max(tu, u0 + UV_INSET), u0 + TILE_UV[0] - UV_INSET);
            const iv = Math.min(Math.max(tv, v0 + UV_INSET), v0 + TILE_UV[1] - UV_INSET);

            target.verts.push(vx, vy, vz, iu, iv, shades[c], block);
          }

          // Diagonal escolhida pelo lado mais escuro. Sem esse cuidado a
          // oclusão faz uma "dobra" visível atravessando a face.
          if (shades[0] + shades[2] > shades[1] + shades[3]) {
            target.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          } else {
            target.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
          }
        }
      }
    }
  }

  return {
    opaque: { vertices: opaque.verts.trimmed(), indices: opaque.idx.trimmed() },
    water: { vertices: water.verts.trimmed(), indices: water.idx.trimmed() },
  };
}
