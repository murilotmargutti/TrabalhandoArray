// Servidor estático mínimo para abrir o app no navegador do computador.
// Sem dependências de propósito: `node scripts/servidor.mjs` e pronto.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'app');
const PORTA = Number(process.env.PORTA || 8099);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  const pedido = decodeURIComponent(req.url.split('?')[0]);
  const caminho = join(RAIZ, normalize(pedido === '/' ? '/index.html' : pedido));

  // Impede sair da pasta app/ por caminho com "..".
  if (!caminho.startsWith(RAIZ)) {
    res.writeHead(403).end('proibido');
    return;
  }

  try {
    const conteudo = await readFile(caminho);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(caminho)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    }).end(conteudo);
  } catch {
    res.writeHead(404).end('não encontrado');
  }
}).listen(PORTA, () => {
  console.log(`Fase 0 em http://localhost:${PORTA}`);
  console.log('Setas ou WASD movem, IJKL olham, R/F sobem e descem.');
  console.log('Enter inicia o teste automático, X troca a resolução, Y troca o tema.');
});
