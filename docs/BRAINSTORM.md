# Brainstorm — Jogo criativo de blocos para TV LG

Documento de exploração. Nada aqui é decisão final; serve para escolhermos o
escopo antes de escrever código.

## 1. O que estamos construindo

Um jogo de construção com blocos (estilo Minecraft) em **modo criativo puro**,
para crianças de **7 a 11 anos**, rodando em **TV LG com webOS 25** (processador
α7 AI Gen 8), instalado via **Developer Mode**, jogado com **controle Bluetooth**
já pareado na TV.

Regras de design que não se negociam:

- **Sem noite.** O sol pode se mover, mas nunca escurece. Sem lanterna, sem medo.
- **Sem monstros, sem combate, sem dano.** Não existe barra de vida nem fome.
- **Não existe "perder".** Nada de morrer, nada de perder o que construiu.
- **Não existe pressa.** Nenhum timer, nenhuma contagem regressiva.
- **Offline e sozinho.** Sem chat, sem internet, sem contas. Zero risco social.
- **Blocos infinitos.** Não precisa minerar para construir.

### Sobre "para meninas"

Vale separar duas coisas, porque isso muda o produto:

1. **Público-alvo** (quem vamos observar jogando e para quem otimizamos): sim,
   meninas de 7 a 11.
2. **Design travado em rosa/princesa**: isso eu recomendaria **não** fazer.

O que funciona melhor na prática é a estética ser **escolhida pela jogadora** na
primeira tela: 4 ou 5 "temas de ilha" (Cerejeira, Praia, Nuvem, Floresta
Mágica, Doceria) com paletas todas bonitas e nenhuma delas obrigatória. Assim
a menina que ama rosa tem rosa de sobra, e a que ama uma ilha vulcânica também
é atendida — e nenhuma sente que o jogo decidiu por ela. O que realmente
diferencia um jogo para essa faixa não é a cor: é **decoração farta, bichinhos
fofos, ferramentas que perdoam erro e zero frustração**.

Se você preferir travar em um tema único mais "princesa", também dá — é só me
dizer, o custo é o mesmo.

## 2. Restrições técnicas (e o que elas implicam)

| Restrição | Realidade | Consequência de projeto |
|---|---|---|
| webOS 25 | Motor web é **Chromium 120** | Podemos usar TypeScript moderno, WebGL2, IndexedDB, WebAudio. Nada exótico. |
| Processador α7 AI Gen 8 | GPU modesta (α7 é a linha intermediária, abaixo do α9) | **Este é o maior risco do projeto.** Mundo pequeno, poucas draw calls, zero sombras dinâmicas. |
| Instalação por devmode | `.ipk` via `ares-package` / `ares-install` | App é 100% estático e offline. A sessão do Developer Mode **expira** e precisa ser renovada no app da LG. |
| Controle Bluetooth | Já pareado na TV | Risco: o webOS pode entregar o controle pela **Gamepad API** *ou* traduzir os botões em eventos de teclado. Precisa ser testado no aparelho. |
| Tela de TV | Jogadora a ~3 m de distância | UI "10-foot": fonte grande (≥32px em 1080p), ícones grandes, alvos generosos, nada de texto pequeno. |

### Consequência mais importante

Não sabemos quanto essa GPU aguenta até medirmos **na TV**. Por isso a fase 0
do roteiro é um teste de desempenho no aparelho real, antes de qualquer sistema
de jogo. Chutar isso é a forma mais fácil de perder duas semanas.

## 3. Stack proposta

- **TypeScript + Vite** → gera arquivos estáticos, empacota direto em `.ipk`.
- **Renderização: WebGL2 via Three.js**, mas usado de forma disciplinada — a
  geometria dos chunks é construída à mão (`BufferGeometry`), Three.js entra só
  para câmera/loop/material. Alternativa é WebGL2 puro; economiza ~150 KB e dá
  controle total, mas custa umas 2 semanas a mais. **Recomendo Three.js.**
- **Voxels em `Uint8Array`** (1 byte por bloco). Mundo 256×256×64 = 4 MB. Cabe
  folgado.
- **Malha de chunk com _greedy meshing_** + **atlas de textura única** →
  1 draw call por chunk opaco + 1 para transparentes.
- **Iluminação assada nos vértices** (ambient occlusion pré-calculado). Sem
  shadow map, sem luz dinâmica. Blocos que "brilham" usam textura emissiva
  falsa.
- **Renderizar em 1280×720** e deixar a TV fazer o upscale — o escalonador da
  LG é bom e isso praticamente dobra o orçamento de GPU.
- **Salvar em IndexedDB** (localStorage é pequeno demais). Autosave contínuo,
  sem botão "salvar" — criança não salva.
- **Áudio: WebAudio** com arquivos curtos em `.ogg`.
- **Sem engine de jogo pronta** (Unity/Godot): o export web delas é grande,
  pesado e briga com o hardware da TV. Web nativo é a escolha certa aqui.

## 4. Conteúdo e mecânicas

### 4.1 Mundo

**Ilha finita**, não mundo infinito. Motivos: cabe na memória, roda rápido,
carrega instantâneo e — o mais importante — **criança não se perde**. A ilha
tem borda visível (praia → mar raso) e a jogadora sempre acha o caminho de volta.

Biomas dentro da mesma ilha, com transições suaves: campo de flores, bosque de
cerejeiras, praia, lago cristalino, colina alta com vista, uma gruta clara
(iluminada, nunca escura).

### 4.2 Blocos (~50, agrupados em paletas)

O peso vai em **decoração**, não em blocos de sobrevivência:

- **Base**: grama, terra, areia, pedra, madeira (5 cores), tijolo, mármore.
- **Cor**: 16 blocos lisos coloridos + 16 de vidro colorido.
- **Decoração**: flores (8 tipos), tapete, cortina, almofada, quadro, vaso,
  lustre, luminária, cristal, bolo, sorvete, arbusto, fonte de água.
- **Estrutura**: escada, meio-bloco, cerca, portão, porta, janela, telhado
  (peças em ângulo), pilar, arco.
- **Natureza**: água, folhas, tronco, nuvem (sim, bloco de nuvem — dá para
  construir castelo no céu).

### 4.3 Ferramentas de construção que mudam tudo para criança

Estas são, na minha opinião, o que separa "um Minecraft pior" de um jogo que
uma criança de 8 anos consegue realmente usar:

1. **Desfazer / Refazer** — botão dedicado, óbvio, ilimitado. Criança erra o
   clique toda hora. Sem isso o jogo frustra em 5 minutos.
2. **Modo espelho (simetria)** — constrói metade da casa, o jogo espelha a outra
   metade automaticamente. Resultado bonito com metade do esforço.
3. **Carimbos** (peças prontas) — porta, janela, telhado, árvore, arco, escada
   em espiral. Coloca inteiro de uma vez.
4. **Linha e preenchimento** — marca dois pontos e o jogo preenche a parede ou
   o piso. Evita a tortura de colocar 400 blocos um por um.
5. **Voar desde o começo**, sem desbloquear nada. Segura o botão e sobe.
6. **Conta-gotas** — aponta para um bloco existente e ele vai para a mão.

### 4.4 Bichinhos (companhia, nunca ameaça)

Animais passivos que andam pela ilha: gatinho, coelho, capivara, filhote de
dragão, pônei, passarinho. Dá para **fazer carinho, dar um nome e ganhar um
que te segue**. Nenhum ataca, nenhum morre, nenhum pode ser machucado —
inclusive a jogadora não tem como ferir um nem por acidente.

### 4.5 Progresso sem pressão

Nada de missão obrigatória. Em vez disso, um **álbum de coleção**: encontrar
flores, bichinhos e lugares da ilha preenche figurinhas. Puramente opcional,
sem prazo, sem perder nada se ignorar.

### 4.6 Modo foto

Congela a cena, esconde a interface, oferece molduras e adesivos, e salva na
galeria do jogo. Criança dessa idade **ama mostrar o que construiu** — e essa é
a mecânica de "compartilhar" mais segura possível, porque não sai do aparelho.

## 5. Controles no controle de videogame

Menus **radiais**, não grades: com analógico, escolher em roda é muito mais
rápido e mais fácil de acertar do que navegar célula por célula.

| Botão | Ação |
|---|---|
| Analógico esquerdo | Andar |
| Analógico direito | Olhar |
| A | Pular / dois toques = voar |
| Gatilho direito (RT) | Colocar bloco |
| Gatilho esquerdo (LT) | Remover bloco |
| LB / RB | Trocar bloco da barra rápida |
| Y | Abrir paleta de blocos (menu radial) |
| X | Abrir carimbos |
| B | Conta-gotas |
| Select / Back | **Desfazer** |
| Start | Menu (pausa, foto, ajustes) |
| Direcional ↑↓ | Subir / descer voando |

Camada de entrada dupla obrigatória: **Gamepad API + mapeamento de teclas do
webOS**, decidido em tempo de execução. Assim funciona mesmo se a TV entregar
o controle como teclado, e o Magic Remote continua servindo de emergência.

## 6. Acessibilidade e cuidado com a criança

- Sem texto piscando, sem flash, sem estímulo forte (TV grande, perto do rosto).
- Paleta segura para daltonismo; nenhuma informação transmitida só por cor.
- Rótulos curtos em **pt-BR** sempre acompanhados de ícone (leitor iniciante).
- Áudio suave, volume padrão baixo, música desligável.
- Zero coleta de dados, zero rede, zero compra.
- Tutorial de 60 segundos jogável, sem parede de texto.

## 7. Riscos, em ordem de gravidade

1. **Desempenho na GPU α7.** Mitigação: medir na TV na fase 0; orçamento de
   chunks visíveis definido pela medição, não pelo desejo.
2. **Controle não aparecer na Gamepad API.** Mitigação: camada de entrada dupla
   e teste no aparelho na fase 0.
3. **Memória do app no webOS.** Heap de app de TV é limitado. Mitigação: arrays
   tipados, descartar malha de chunk fora de vista, sem vazamento de textura.
4. **Sessão do Developer Mode expirando** no meio do desenvolvimento.
   Mitigação: renovar antes de cada sessão de teste; documentar o passo a passo.
5. **Escopo.** Voxel engine é fácil de começar e infinita de terminar.
   Mitigação: fase 1 fecha com uma ilha jogável e feia; beleza vem depois.

## 8. Roteiro proposto

- **Fase 0 — Prova de conceito no aparelho (o mais importante).**
  App webOS mínimo instalado por devmode que: desenha um campo de cubos,
  mostra FPS na tela e lista o que o controle está mandando. Objetivo:
  descobrir o orçamento real de desempenho e como o controle chega.
- **Fase 1 — Núcleo voxel.** Geração da ilha, malha de chunk, voar, colocar e
  remover bloco.
- **Fase 2 — Controles e interface.** Menu radial, barra rápida, desfazer,
  layout de TV.
- **Fase 3 — Conteúdo.** Os ~50 blocos, biomas, carimbos, espelho, temas de ilha.
- **Fase 4 — Encanto.** Bichinhos, modo foto, música, álbum de coleção.
- **Fase 5 — Acabamento.** Salvar/carregar, ajustes, tutorial, empacotar `.ipk`.

Fase 0 é curta e derruba os dois maiores riscos de uma vez. É por onde eu
começaria.

## 9. Nomes para pensar

Ilha dos Sonhos · Blocolândia · Jardim de Blocos · Ilha Encantada ·
Mundo Florido · Cria & Sonha · Ilha da Cerejeira

---

## Perguntas abertas

1. Estética **escolhível pela jogadora** (recomendado) ou **tema único** já
   definido?
2. Ilha finita (recomendado) ou mundo que cresce sem fim?
3. Alguma criança específica vai testar? Idade exata ajuda a calibrar leitura
   e dificuldade das ferramentas.
4. Vamos direto para a Fase 0 no aparelho, ou você prefere primeiro um protótipo
   rodando no navegador do computador (mais rápido de iterar, mas não mede o
   risco real)?
