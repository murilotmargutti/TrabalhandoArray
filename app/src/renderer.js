// Renderizador WebGL2.
//
// Regras que valem para o jogo todo, não só para o teste:
//   - uma draw call por chunk (opaco), mais uma para a água;
//   - nenhuma luz dinâmica, nenhum shadow map: sombreamento vem assado na malha;
//   - textura única em atlas, então trocar de bloco nunca troca de material;
//   - cor do bloco vem de uniform indexada pelo tipo, então trocar de tema é
//     um upload de 8 vec3 e nada mais.
//
// Névoa não é enfeite: ela esconde a borda da distância de renderização, o que
// permite desenhar menos chunks sem a criança perceber um corte no mundo.

import { buildAtlas } from './atlas.js';
import { BLOCK_COUNT } from './themes.js';
import { FLOATS_PER_VERTEX } from './mesher.js';
import { CHUNK_SX, CHUNK_SY, CHUNK_SZ } from './terrain.js';

const VERT_SRC = `#version 300 es
in vec3 aPos;
in vec2 aUV;
in float aShade;
in float aType;

uniform mat4 uViewProj;
uniform vec3 uChunkOrigin;
uniform vec3 uCamPos;
uniform vec3 uBlockColor[${BLOCK_COUNT}];

out vec2 vUV;
out float vShade;
out vec3 vTint;
out float vDist;

void main() {
  vec3 world = aPos + uChunkOrigin;
  gl_Position = uViewProj * vec4(world, 1.0);
  vUV = aUV;
  vShade = aShade;
  vTint = uBlockColor[int(aType)];
  vDist = length(world - uCamPos);
}`;

const FRAG_SRC = `#version 300 es
precision mediump float;

in vec2 vUV;
in float vShade;
in vec3 vTint;
in float vDist;

uniform sampler2D uAtlas;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uAlpha;

out vec4 outColor;

void main() {
  float detail = texture(uAtlas, vUV).r;
  vec3 c = vTint * detail * vShade;
  float fog = clamp((vDist - uFogStart) / (uFogEnd - uFogStart), 0.0, 1.0);
  outColor = vec4(mix(c, uFogColor, fog), uAlpha);
}`;

// --- matrizes -------------------------------------------------------------

function perspective(out, fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect; out[5] = f;
  out[10] = (far + near) * nf; out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

function lookAt(out, eye, yaw, pitch) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const fx = Math.sin(yaw) * cp, fy = sp, fz = -Math.cos(yaw) * cp;
  // Câmera nunca rola, então "direita" é só o forward girado 90° no plano XZ.
  // Com yaw 0 o forward é -Z e a direita tem de ser +X; trocar esse sinal gira
  // a imagem inteira em 180°.
  const rx = Math.cos(yaw), ry = 0, rz = Math.sin(yaw);
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;

  out[0] = rx; out[1] = ux; out[2] = -fx; out[3] = 0;
  out[4] = ry; out[5] = uy; out[6] = -fy; out[7] = 0;
  out[8] = rz; out[9] = uz; out[10] = -fz; out[11] = 0;
  out[12] = -(rx * eye[0] + ry * eye[1] + rz * eye[2]);
  out[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
  out[14] = fx * eye[0] + fy * eye[1] + fz * eye[2];
  out[15] = 1;
  return out;
}

function multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

// --- renderizador ---------------------------------------------------------

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,          // custa banda demais para o ganho numa TV
      depth: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 não disponível neste aparelho.');

    this.gl = gl;
    this.canvas = canvas;
    this.chunks = new Map();
    this.stats = { drawCalls: 0, triangles: 0 };

    this.program = this._buildProgram();
    this.uniforms = {};
    for (const name of ['uViewProj', 'uChunkOrigin', 'uCamPos', 'uBlockColor',
                        'uAtlas', 'uFogColor', 'uFogStart', 'uFogEnd', 'uAlpha']) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }
    this.attribs = {
      aPos: gl.getAttribLocation(this.program, 'aPos'),
      aUV: gl.getAttribLocation(this.program, 'aUV'),
      aShade: gl.getAttribLocation(this.program, 'aShade'),
      aType: gl.getAttribLocation(this.program, 'aType'),
    };

    this.atlas = this._buildTexture();
    this.blockColors = new Float32Array(BLOCK_COUNT * 3);
    this.fogColor = new Float32Array(3);
    this.clearColor = [0, 0, 0];

    this.proj = new Float32Array(16);
    this.view = new Float32Array(16);
    this.viewProj = new Float32Array(16);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  _compile(type, src) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Shader falhou: ' + gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  _buildProgram() {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, this._compile(gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(program, this._compile(gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Link falhou: ' + gl.getProgramInfoLog(program));
    }
    return program;
  }

  _buildTexture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlas());
    gl.generateMipmap(gl.TEXTURE_2D);
    // NEAREST no aumento mantém o pixel quadradinho; mipmap linear na redução
    // evita o chuvisco que aparece em bloco distante.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  setTheme(theme) {
    this.blockColors.fill(0);
    for (const [type, rgb] of Object.entries(theme.colors)) {
      this.blockColors.set(rgb, Number(type) * 3);
    }
    this.fogColor.set(theme.fog);
    this.clearColor = theme.sky;
  }

  _buildPart(part) {
    if (part.indices.length === 0) return null;
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, part.vertices, gl.STATIC_DRAW);

    const stride = FLOATS_PER_VERTEX * 4;
    const { aPos, aUV, aShade, aType } = this.attribs;
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(aShade);
    gl.vertexAttribPointer(aShade, 1, gl.FLOAT, false, stride, 20);
    gl.enableVertexAttribArray(aType);
    gl.vertexAttribPointer(aType, 1, gl.FLOAT, false, stride, 24);

    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, part.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    return { vao, vbo, ebo, count: part.indices.length };
  }

  uploadChunk(key, cx, cz, mesh) {
    this.removeChunk(key);
    this.chunks.set(key, {
      origin: [cx * CHUNK_SX, 0, cz * CHUNK_SZ],
      opaque: this._buildPart(mesh.opaque),
      water: this._buildPart(mesh.water),
      bytes: mesh.opaque.vertices.byteLength + mesh.opaque.indices.byteLength +
             mesh.water.vertices.byteLength + mesh.water.indices.byteLength,
    });
  }

  removeChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    const gl = this.gl;
    for (const part of [chunk.opaque, chunk.water]) {
      if (!part) continue;
      gl.deleteVertexArray(part.vao);
      gl.deleteBuffer(part.vbo);
      gl.deleteBuffer(part.ebo);
    }
    this.chunks.delete(key);
  }

  clearChunks() {
    for (const key of [...this.chunks.keys()]) this.removeChunk(key);
  }

  get gpuBytes() {
    let total = 0;
    for (const chunk of this.chunks.values()) total += chunk.bytes;
    return total;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  // Descarte grosseiro: esfera do chunk contra os planos do frustum. Chunk fora
  // de vista não vira draw call. É a otimização de maior retorno por linha
  // escrita, e sem ela a medição de FPS não significa nada.
  _visible(origin, viewProj) {
    const cx = origin[0] + CHUNK_SX / 2;
    const cy = CHUNK_SY / 2;
    const cz = origin[2] + CHUNK_SZ / 2;
    const radius = Math.hypot(CHUNK_SX, CHUNK_SY, CHUNK_SZ) / 2;
    const m = viewProj;

    for (let i = 0; i < 6; i++) {
      const sign = i % 2 === 0 ? 1 : -1;
      const col = i >> 1;
      const a = m[col] * sign + m[3];
      const b = m[4 + col] * sign + m[7];
      const c = m[8 + col] * sign + m[11];
      const d = m[12 + col] * sign + m[15];
      const len = Math.hypot(a, b, c) || 1;
      if ((a * cx + b * cy + c * cz + d) / len < -radius) return false;
    }
    return true;
  }

  render(camera, drawDistance) {
    const gl = this.gl;
    const { width, height } = this.canvas;

    gl.viewport(0, 0, width, height);
    gl.clearColor(this.clearColor[0], this.clearColor[1], this.clearColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    perspective(this.proj, (70 * Math.PI) / 180, width / height, 0.1, drawDistance + 64);
    lookAt(this.view, camera.pos, camera.yaw, camera.pitch);
    multiply(this.viewProj, this.proj, this.view);

    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(this.uniforms.uAtlas, 0);
    gl.uniformMatrix4fv(this.uniforms.uViewProj, false, this.viewProj);
    gl.uniform3fv(this.uniforms.uCamPos, camera.pos);
    gl.uniform3fv(this.uniforms.uBlockColor, this.blockColors);
    gl.uniform3fv(this.uniforms.uFogColor, this.fogColor);
    gl.uniform1f(this.uniforms.uFogStart, drawDistance * 0.55);
    gl.uniform1f(this.uniforms.uFogEnd, drawDistance);

    let drawCalls = 0, triangles = 0;
    const visible = [];
    for (const chunk of this.chunks.values()) {
      if (this._visible(chunk.origin, this.viewProj)) visible.push(chunk);
    }

    // Passe opaco primeiro, água depois: a água é transparente e precisa
    // enxergar o fundo já desenhado.
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.uniform1f(this.uniforms.uAlpha, 1);
    for (const chunk of visible) {
      if (!chunk.opaque) continue;
      gl.uniform3fv(this.uniforms.uChunkOrigin, chunk.origin);
      gl.bindVertexArray(chunk.opaque.vao);
      gl.drawElements(gl.TRIANGLES, chunk.opaque.count, gl.UNSIGNED_INT, 0);
      drawCalls++;
      triangles += chunk.opaque.count / 3;
    }

    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.uniform1f(this.uniforms.uAlpha, 0.72);
    for (const chunk of visible) {
      if (!chunk.water) continue;
      gl.uniform3fv(this.uniforms.uChunkOrigin, chunk.origin);
      gl.bindVertexArray(chunk.water.vao);
      gl.drawElements(gl.TRIANGLES, chunk.water.count, gl.UNSIGNED_INT, 0);
      drawCalls++;
      triangles += chunk.water.count / 3;
    }
    gl.depthMask(true);
    gl.bindVertexArray(null);

    this.stats.drawCalls = drawCalls;
    this.stats.triangles = triangles;
    this.stats.visibleChunks = visible.length;
  }
}
