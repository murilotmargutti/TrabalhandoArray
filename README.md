# Jogo criativo de blocos para TV LG (webOS)

Jogo de construção com blocos em modo criativo, para crianças de 7 a 11 anos,
feito para rodar em TV LG com webOS 25 (α7 AI Gen 8), instalado via Developer
Mode e jogado com controle Bluetooth.

Sem noite, sem monstros, sem combate, sem perder. Só construir.

## Estado atual

**Fase 0 — prova de conceito**, pronta e verificada.

O app em `app/` mede o desempenho do aparelho, diagnostica como o controle chega
ao jogo e mostra as cinco paletas de tema. Não é o jogo: ainda não dá para
colocar nem remover bloco.

```bash
npm start          # abre em http://localhost:8099
npm run verificar  # teste de fumaça num Chromium de verdade (precisa de playwright)
./scripts/empacotar.sh tv   # empacota e instala na TV
```

- [`docs/BRAINSTORM.md`](docs/BRAINSTORM.md) — escopo, conteúdo, riscos, roteiro
- [`docs/FASE-0.md`](docs/FASE-0.md) — como rodar, como instalar na TV e **o que
  medir e anotar**

## Estrutura

```
app/            aplicação webOS (ES modules + WebGL2, sem build, sem dependências)
  appinfo.json  manifesto do app na TV
  src/
    main.js     laço principal, gerência de chunks, painéis
    renderer.js WebGL2: uma draw call por chunk, sombreamento assado, névoa
    mesher.js   malha do chunk com culled mesher e oclusão de ambiente
    terrain.js  geração do terreno de teste
    input.js    Gamepad API e teclado ao mesmo tempo, com diagnóstico
    bench.js    teste de carga em degraus, com 1% pior
    themes.js   as cinco paletas
    atlas.js    atlas de textura gerado por código
scripts/        servidor local, geração de ícones, empacotamento, verificação
docs/           brainstorm e documentação da fase
```

## Decisões que valem para o projeto todo

- **Sem engine de jogo e sem etapa de build.** O app é ES module puro com
  WebGL2. Menos coisa entre o código e a TV significa menos coisa capaz de
  quebrar no empacotamento — e nada de export web pesado brigando com o
  hardware.
- **Nenhuma luz dinâmica.** Sombreamento e oclusão de ambiente são assados nos
  vértices. É o que permite desenhar a cena em poucas chamadas.
- **Tema é uniform, não geometria.** Trocar de tema custa oito `vec3` e nenhuma
  malha reconstruída. Foi isso que tornou viável deixar a jogadora escolher.
- **Entrada dupla desde o primeiro dia.** Numa TV webOS o controle pode chegar
  pela Gamepad API ou traduzido em eventos de tecla; o app aceita as duas.

## Histórico

O repositório antes continha um exercício de arrays em Java. Ele foi removido do
estado atual, mas continua no histórico do git (commit `dabbe4e`).
