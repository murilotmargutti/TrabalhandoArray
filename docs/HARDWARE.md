# O que se sabe sobre o hardware da TV

Levantamento feito para calibrar o escopo antes de rodar a Fase 0 no aparelho.
Cada item vem marcado com o grau de confiança, porque a diferença entre "a ARM
publicou" e "um site de análise deduziu" muda o quanto vale apostar nisso.

## O aparelho: LG UA8550 (2025)

Modelo confirmado. É a **linha de entrada 4K da LG em 2025** — UHD com LED de
retroiluminação direta, abaixo dos QNED e bem abaixo dos OLED.

| item | valor | por que importa |
|---|---|---|
| Processador | α7 AI Processor 4K Gen8 | confere com o que já foi levantado |
| Painel | 4K 3840×2160, **60 Hz nativo** | **60 FPS é o teto absoluto.** Só existem dois alvos sensatos: 60 ou 30 |
| Tamanho | **55"** | tamanho ímpar, logo **painel IPS** |
| Tipo de painel | **IPS** (ímpares: 43/55/65/75/85; VA nos pares) | contraste baixo e preto acinzentado, mas cor estável fora do eixo |
| Brilho | 300 a 350 nits, 89% de DCI-P3 | pastel vai aparecer **mais lavado** do que num monitor |
| **Bluetooth** | **5.0** | pareamento do controle está resolvido |
| HDMI | 3 portas, 2.0 | irrelevante para o jogo |
| Jogos | ALLM, Game Optimizer, VRR até 60 Hz | nada a fazer: o app web fica preso ao vsync de 60 |

Fontes: [LG UA85 (LG Egito)](https://www.lg.com/eg_en/tv-soundbars/uhd-4k-tvs/55ua85006la/),
[review com tabela de especificações](https://promotop.net/blog/lg-ua8550-uhd-2025-vale-a-pena-review-completo-pros-e-contras-tabela-de-especificacoes-e-dicas-de-configuracao/),
[Zoom](https://www.zoom.com.br/tv/deumzoom/review-tv-lg-ua8550),
[Review Smart TVs](https://reviewsmarttvs.com.br/smart-tv-lg-ua8550-vale-a-pena/).

### Correção ao otimismo da seção anterior

O levantamento abaixo concluiu que a GPU provavelmente daria conta, apoiado no par
Cortex-A78 + Mali-G510 que a ARM associa às TVs **OLED** da LG. Sabendo agora que
o aparelho é a **linha de entrada**, essa extrapolação ficou bem mais frágil: não
há motivo para supor que uma UHD de entrada receba o mesmo SoC de um OLED evo, e
o normal na indústria é justamente o contrário.

Um sinal concreto nessa direção: as análises registram **engasgos ao abrir menus
de configuração mais pesados** do próprio sistema. Isso não é um teste de GPU, mas
não é o comportamento de um aparelho sobrando desempenho.

Conclusão revisada, e é a honesta: **o risco de desempenho volta a ser alto e
empatado com o de memória.** A pesquisa não resolveu nem um nem outro.

### O que já dá para decidir com isto

1. **Alvo de 60 FPS, com plano B explícito de 30.** O painel é 60 Hz e o
   `requestAnimationFrame` está preso ao vsync: não existe 45 FPS estável, quem
   perde o quadro de 60 cai para 30. O teste da Fase 0 já reporta o orçamento nos
   dois alvos exatamente por isso.
2. **Renderizar em 720p deixa de ser aposta e passa a ser a hipótese principal.**
   Numa TV de entrada, gastar o dobro de pixels para uma imagem que o
   escalonador da própria LG reconstrói bem é o pior negócio disponível.
3. **As paletas precisam de validação no painel, não no monitor.** Com 300–350
   nits, 89% de DCI-P3 e painel IPS, tons pastel próximos entre si tendem a se
   achatar num borrão. O tema **Nuvem** era o caso mais exposto — todos os blocos
   ficavam entre 0,66 e 1,00 de valor — e por isso teve a faixa alargada antes
   mesmo de ir para a TV.
4. **IPS é boa notícia para o uso real.** Criança joga do sofá, de lado, deitada
   no chão. IPS perde contraste mas mantém a cor fora do eixo, que é exatamente
   a troca que interessa aqui.

### O problema do sombreamento escuro, e como ele foi tratado

O renderizador transmite a forma dos blocos por sombreamento assado: oclusão de
ambiente de 0,55 a 1,00 multiplicada pela orientação da face, que vai de 0,55 na
face de baixo a 1,00 no topo. No pior caso isso dá **0,30 do tom do bloco**.

Num painel IPS de ~300 nits, com preto acinzentado e numa sala iluminada, 0,30 e
0,35 aparecem como o mesmo cinza. O efeito prático é que os cantos escuros de uma
construção perdem a forma — justamente onde a criança precisa ver que existe um
canto.

Adivinhar o valor certo no monitor seria errar de um lado ou do outro: levantar
pouco não resolve, levantar muito achata o volume e a construção fica sem relevo.
Então o app da Fase 0 ganhou **três níveis de sombreamento comparáveis na própria
TV** (botão LT, ou tecla C):

| nível | piso levantado | pior caso resultante |
|---|---|---|
| padrão (monitor) | 0,00 | 0,30 |
| médio | 0,20 | 0,44 |
| painel claro (IPS) | 0,35 | 0,55 |

É um `uniform` no shader, não valor assado na malha — trocar não reconstrói
geometria nenhuma, então dá para alternar olhando a tela e decidir na hora. A
mesma escolha de arquitetura que tornou os temas baratos.

## Resumo

O quadro é **melhor do que o brainstorm supôs**. A suspeita inicial era de que o
α7, sendo a linha intermediária, teria GPU bem mais fraca que o α9. As fontes
apontam outra coisa: os níveis de processador da LG compartilham praticamente os
mesmos núcleos, e a diferença real está em **memória** e em blocos de
processamento de imagem, não em poder de GPU.

Isso desloca o risco em vez de eliminá-lo: a GPU provavelmente dá conta, e a
**memória** passa a ser a restrição mais provável.

## O que é fato publicado

**A LG desenha os SoCs em parceria com a ARM, e o par usado é Cortex-A78 +
Mali-G510.** A própria ARM lista "Arm Cortex-A78" e "Arm Mali-G510" como as
tecnologias empregadas nas TVs OLED da LG, incluindo a família OLED evo 2025
([arm.com](https://www.arm.com/company/success-library/arm-designs/lg-oled-tv)).
Para a linha OLED 2024 há a descrição mais completa: **quad-core Cortex-A78 e
Mali-G510**, comparável a um chip de celular intermediário de 2021 ou 2022
([engineersgarage](https://www.engineersgarage.com/a-look-inside-the-modern-smart-tv/)).

**A Mali-G510 é a linha "mainstream" da terceira geração Valhall, configurável de
2 a 6 núcleos de shader**, com cerca de o dobro do desempenho da Mali-G57 que
substituiu ([arm.com](https://www.arm.com/products/silicon-ip-multimedia/gpu/mali-g510),
[Android Authority](https://www.androidauthority.com/arm-mali-g710-g610-g510-g310-1225934/),
[VideoCardz](https://videocardz.com/press-release/arm-announces-mali-g710-g610-g510-and-g310-graphics-processing-units)).
Traduzindo para referência conhecida: a G57 MP2 fica na faixa da Adreno 618 e a
MP3 na da Adreno 620, então uma G510 cai aproximadamente na faixa
**Adreno 620–630** — GPU de celular intermediário de 2021/2022
([Notebookcheck](https://www.notebookcheck.net/ARM-Mali-G57-MP2-GPU-Benchmarks-and-Specs.537758.0.html)).

**O motor web do webOS 25 é o Chromium 120**, e a LG não atualiza a versão do
Chromium depois que uma versão maior sai
([webOS TV Developer](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine),
[notas da comunidade](https://gist.github.com/throwaway96/5648720758e354a018c95150d0bb7fb8)).
WebGL2 existe no Chrome desde a versão 56, então está garantido com folga.

**O α7 AI Processor 4K Gen8 é a faixa de entrada/intermediária da linha 2025**,
aparecendo em modelos QNED como o QNED70A e o 55QNED8AA
([LG Índia](https://www.lg.com/in/tv-soundbars/qned/55qned8aa6a/),
[TV Reviews](https://tvreviews.net/lg-qned70a-qned70-2025/)). Acima dele ficam o
α8, o α9 Gen8 e o α11 Gen2 dos OLED evo
([HomeTechnologyReview](https://hometechnologyreview.com/2025-lg-qned-evo-tvs-ai-upgrades-gaming-features-and-true-wireless-4k/)).

## O que é dedução de terceiros, não fato

**Os níveis α5/α7/α9 usariam os mesmos núcleos de CPU e GPU, diferindo sobretudo
na quantidade de memória.** É a conclusão do tab-tv, que também registra o motivo
de ninguém ter certeza: **a LG bloqueia a leitura das informações do processador
no nível de usuário** — dá para descobrir que há quatro núcleos e nada além disso
([tab-tv](https://en.tab-tv.com/lg-%CE%B19-intelligent-processor-tv-lg-what-this-processor-is/)).
É uma dedução plausível e coerente com o resto, mas não é especificação oficial.

**A extrapolação da OLED evo para o α7 Gen8 é minha, não das fontes.** A página da
ARM cobre a família OLED evo, cujo processador é o α11 Gen2. Dizer que o α7 Gen8
usa a mesma Mali-G510 é inferência a partir de: (a) a LG usa a mesma família de
SoC na linha toda, e (b) o tab-tv indica núcleos compartilhados entre níveis.

## O buraco que a pesquisa não fecha

**Quantos núcleos de shader tem a G510 desta TV.** A Mali-G510 vai de 2 a 6
núcleos, e a LG não publica a configuração. Entre uma MC2 e uma MC6 há três vezes
de diferença de capacidade — e nada indica que o modelo de entrada receba a
configuração cheia. Esse é o número que decide a distância de visão do jogo, e
**nenhuma fonte pública tem ele**.

**Quanta memória o app recebe.** A LG documenta que uma página grande demais faz a
TV encerrar o navegador ou reiniciar sozinha, mas não publica o limite
([suporte LG](https://www.lg.com/us/support/help-library/lg-tv-memory-shortage-error-app-wont-run--20154522128317),
[webOS TV Developer](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)).
Como o α7 é justamente o nível com menos memória, é aqui que o risco se concentra
agora.

## O que isso muda no plano

1. **A GPU deixa de ser o risco principal.** Um renderizador de voxel com culled
   mesh, uma draw call por chunk e nenhuma luz dinâmica, rodando a 720p, é bem
   dentro do que uma GPU classe Adreno 620 entrega — jogos de bloco rodam nesse
   nível de hardware há anos. Continua sendo preciso medir, mas a expectativa
   razoável passou a ser positiva.
2. **A memória sobe para risco número um.** Malha de chunk é o que ocupa espaço, e
   é onde o α7 tende a ter menos folga. Reforça duas decisões já tomadas:
   **ilha finita** e **descarregar malha de chunk fora de vista**. O app da Fase 0
   já mostra o teto do heap e o total de geometria na GPU exatamente por isso.
3. **Vale usar o Beanviser**, a ferramenta oficial da LG que mede CPU e memória do
   app rodando na TV e detecta vazamento
   ([webOS TV Developer](https://webostv.developer.lge.com/develop/tools/beanviser-introduction)).
   Ela complementa o painel do app: o painel mede o heap de JavaScript, o
   Beanviser mede o processo inteiro.
4. **Identificar o modelo exato da TV ajuda.** Sabendo se é QNED70A, QNED8AA ou
   outro, dá para procurar teardown e ficha técnica daquele aparelho específico e
   talvez fechar a questão da memória sem adivinhação.

## Conclusão honesta

A pesquisa estreitou a faixa de incerteza e melhorou o prognóstico, mas **não
substitui a medição**. Os dois números que definem o escopo — núcleos de shader da
GPU e memória disponível ao app — a LG não publica, e um deles a própria TV se
recusa a informar. Rodar a Fase 0 no aparelho continua sendo o único jeito de
saber.
