// Teste de fumaça do app da Fase 0, num Chromium de verdade.
//
// Não substitui a medição na TV — aqui o desenho sai por software (SwiftShader),
// então o FPS não diz nada sobre o hardware. O que ele garante é o que dá para
// garantir automaticamente: a página sobe sem erro, os shaders compilam, a
// geometria é gerada, a troca de tema funciona e o teste automático roda os oito
// degraus até o fim.
//
// Precisa do Playwright, que é dependência só de desenvolvimento:
//   npm install --no-save playwright
//
// Uso (com o servidor já rodando em outro terminal):
//   node scripts/servidor.mjs &
//   node scripts/verificar.mjs [pasta-de-saida]

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const SAIDA = process.argv[2] || '/tmp/fase0';
const PORTA = process.env.PORTA || 8099;

// Em ambiente de CI o Chromium costuma estar num caminho fixo; localmente o
// Playwright resolve sozinho.
const CAMINHOS = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].filter(Boolean);
const executablePath = CAMINHOS.find((p) => existsSync(p));

const falhas = [];
const check = (ok, descricao, detalhe = '') => {
  console.log(`${ok ? '  ok  ' : ' FALHA'}  ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!ok) falhas.push(descricao);
};

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const erros = [];
page.on('pageerror', (e) => erros.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => {
  // favicon.ico não existe e não vai existir: não é erro do app.
  if (m.type() === 'error' && !m.text().includes('favicon')) erros.push(`CONSOLE: ${m.text()}`);
});

await page.goto(`http://127.0.0.1:${PORTA}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(5000);

const inicial = await page.evaluate(() => ({
  contextoPerdido: document.getElementById('gl').getContext('webgl2').isContextLost(),
  banner: getComputedStyle(document.getElementById('banner')).display,
  stats: document.getElementById('statsBody').innerText,
  chunks: Number(document.getElementById('statsBody').innerText.match(/chunks carregados\n(\d+)/)?.[1] ?? 0),
  draws: Number(document.getElementById('statsBody').innerText.match(/draw calls\n(\d+)/)?.[1] ?? 0),
  gamepadApi: document.getElementById('inputsBody').innerText.includes('Gamepad API existe\nsim'),
}));
await page.screenshot({ path: `${SAIDA}-1-inicio.png` });

console.log('\n--- carga inicial ---');
check(erros.length === 0, 'sem erro de JS nem de shader', erros.join(' | '));
check(!inicial.contextoPerdido, 'contexto WebGL2 vivo');
check(inicial.banner === 'none', 'sem mensagem de falha na tela');
check(inicial.chunks > 0, 'chunks gerados', `${inicial.chunks} carregados`);
check(inicial.draws > 0, 'geometria chegou na GPU', `${inicial.draws} draw calls`);
check(inicial.gamepadApi, 'Gamepad API presente no navegador');

// Cinco temas, então quatro toques em Y saem do primeiro e chegam no último.
for (let i = 0; i < 4; i++) {
  await page.keyboard.press('KeyY');
  await page.waitForTimeout(200);
}
await page.waitForTimeout(600);
const tema = await page.evaluate(() => document.getElementById('themeName').textContent);
await page.screenshot({ path: `${SAIDA}-2-tema.png` });

console.log('\n--- troca de tema ---');
check(tema.includes('5/5'), 'quatro toques em Y percorrem os cinco temas', tema.trim());

// Andar para frente tem de mover a câmera, e mover a câmera tem de trocar o
// conjunto de chunks carregados.
await page.keyboard.down('KeyW');
await page.waitForTimeout(2000);
await page.keyboard.up('KeyW');
const moveu = await page.evaluate(() => document.getElementById('statsBody').innerText);
console.log('\n--- movimento ---');
check(!moveu.includes('FPS\n0'), 'laço continua rodando depois de andar');

// Teste automático completo: oito degraus de raio.
await page.keyboard.press('Enter');
const inicio = Date.now();
let linhas = 0;
while (Date.now() - inicio < 150000) {
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => ({
    banner: document.getElementById('banner').textContent,
    linhas: document.querySelectorAll('#benchBody table tr').length,
  }));
  linhas = info.linhas;
  if (info.banner === '' && linhas > 8) break;
}
const resultado = await page.evaluate(() => ({
  texto: document.getElementById('benchBody').innerText,
  raioFinal: Number(document.getElementById('statsBody').innerText.match(/raio de chunks\n(\d+)/)?.[1] ?? 0),
}));
await page.screenshot({ path: `${SAIDA}-3-resultado.png` });

console.log('\n--- teste automático ---');
check(linhas === 9, 'os oito degraus foram medidos (mais o cabeçalho)', `${linhas} linhas`);
check(/orçamento a 30 FPS/.test(resultado.texto), 'veredito de orçamento apresentado');
check(resultado.raioFinal < 8, 'raio volta para o orçamento aprovado ao terminar',
      `raio ${resultado.raioFinal}`);
check(erros.length === 0, 'nenhum erro acumulado durante o teste', erros.join(' | '));

console.log('\n=== TABELA MEDIDA (software, só para provar que a medição funciona) ===');
console.log(resultado.texto);
console.log(`\nimagens em ${SAIDA}-*.png`);

await browser.close();

if (falhas.length > 0) {
  console.error(`\n${falhas.length} verificação(ões) falharam:`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nTodas as verificações passaram.');
