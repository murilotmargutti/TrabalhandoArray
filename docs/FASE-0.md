# Fase 0 — prova de conceito

Este app **não é o jogo**. Ele existe só para responder, por medição, quatro
perguntas que decidem o escopo de tudo o que vem depois:

1. **Quantos chunks a GPU da TV aguenta** antes do FPS cair?
2. **Como o controle Bluetooth chega ao app** — pela Gamepad API ou traduzido em
   eventos de tecla, como o Magic Remote?
3. **Renderizar em 720p e deixar a TV ampliar compensa** de verdade?
4. **As paletas dos temas ficam bonitas no painel real?** Painel de TV satura
   muito mais que monitor de PC.

Enquanto essas respostas não existirem, qualquer promessa sobre tamanho de mundo
e distância de visão é chute.

## Rodar no navegador

```bash
npm start                 # serve app/ em http://localhost:8099
```

Não há etapa de build e não há dependência de execução: o app é ES module puro
com WebGL2, o mesmo arquivo que vai para a TV.

Teclado (para testar sem controle):

| tecla | ação |
|---|---|
| WASD ou setas | andar |
| I J K L | olhar |
| R / F | subir / descer |
| Enter | inicia ou para o teste automático |
| X | troca a resolução de render |
| Y | troca o tema |
| B | mostra / esconde os painéis |
| Q / E | menos / mais chunks |

Se você tiver um controle ligado no computador (USB ou Bluetooth), ele já
aparece no painel "Entrada / Controle". Isso não prova como a TV se comporta,
mas já valida o mapeamento de botões antes de mexer no aparelho.

## Teste de fumaça automático

```bash
npm install --no-save playwright
npm start &
npm run verificar
```

Sobe um Chromium de verdade, confere que a página carrega sem erro, que os
shaders compilam, que a geometria é gerada, que a troca de tema funciona e que o
teste automático percorre os oito degraus até o fim. Sai com código diferente de
zero se algo falhar, e grava capturas de tela.

O FPS que ele reporta é **irrelevante como previsão de hardware**: no ambiente de
verificação o desenho sai por software (SwiftShader). O que o teste garante é que
a medição funciona, não quanto o aparelho entrega.

## Instalar na TV

Uma vez só, no computador:

```bash
npm install -g @webos-tools/cli
```

Uma vez só, na TV: instalar o app **Developer Mode** da loja LG, entrar com a
conta de desenvolvedor LG e ligar o Dev Mode. Anote o IP mostrado na tela.

> A sessão do Developer Mode **expira**. Quando o app parar de instalar sem
> motivo aparente, quase sempre é isso: reabra o Developer Mode na TV e renove.

Registrar a TV (uma vez só):

```bash
ares-setup-device --add tv \
  --info "host=192.168.0.XX" --info "port=9922" --info "username=prisoner"
ares-novacom --device tv --getkey
```

Empacotar e instalar:

```bash
./scripts/empacotar.sh          # só gera dist/*.ipk
./scripts/empacotar.sh tv       # gera, instala e abre na TV
```

Para ver o console de dentro do app rodando na TV:

```bash
ares-inspect --device tv --app com.murilo.ilhablocos.fase0
```

## O que medir, e o que anotar

Rode o teste automático (botão **A**, ou Enter) **duas vezes**: uma em
`1920x1080` e uma em `1280x720`, trocando com **X**. Fotografe a tabela das duas.

O que a tabela responde:

- **coluna "1% pior"** é a que importa, não a média. 60 de média com engasgo a
  cada meio segundo parece ruim de jogar; o 1% pior descreve a sensação real.
- **"orçamento a 60 FPS"** e **"orçamento a 30 FPS"** dão o raio máximo de
  chunks que o aparelho sustenta. Esse número define a distância de visão do
  jogo e, por consequência, o tamanho da ilha.
- comparar as duas resoluções diz se a aposta do 720p vale. Se 720p entregar um
  raio bem maior com imagem aceitável na TV, o jogo nasce em 720p.
- **"teto do heap"** diz quanta memória o app tem. Isso limita quantos chunks
  podem ficar carregados de uma vez.

Anote também, do painel "Entrada / Controle":

- **"lendo de"**: se disser `Gamepad API`, ótimo — é o caminho bom. Se disser
  `teclado / controle remoto`, o controle está chegando como tecla e o
  mapeamento sai da lista "últimas teclas".
- **"id do controle"** e **"mapping"**: se `mapping` vier vazio em vez de
  `standard`, os índices de botão não seguem o padrão e precisam ser mapeados na
  mão — que é justamente para isso que o painel mostra o índice cru de cada
  botão apertado.

Aperte **todos** os botões do controle, um por um, e anote o índice (ou o
keyCode) de cada um. Essa lista é o mapeamento oficial do projeto e entra na
Fase 2.

## Como isto foi construído (e por que vale para o jogo todo)

As decisões de renderização aqui não são de brinquedo — são as mesmas que o jogo
vai usar:

- **uma draw call por chunk**, com atlas de textura única, então trocar de bloco
  nunca troca de material;
- **nenhuma luz dinâmica e nenhum shadow map**: o sombreamento e a oclusão de
  ambiente são assados nos vértices na hora de montar a malha. É o que permite a
  cena inteira sair em poucas chamadas;
- **culled mesher**: só emite face que dá de frente com ar ou água. A otimização
  seguinte (greedy meshing, que junta faces coplanares e derruba bastante a
  contagem de triângulos) fica guardada para a Fase 1, já sabendo quanta folga
  existe;
- **descarte por frustum**: chunk fora de vista não vira draw call — sem isso a
  medição de FPS não significaria nada;
- **névoa não é enfeite**: ela esconde a borda da distância de renderização, o
  que deixa desenhar menos mundo sem a criança perceber corte;
- **cor do bloco vem de uniform indexada pelo tipo**, e não da textura. É por
  isso que trocar de tema custa um upload de oito `vec3` e nada mais — nenhuma
  malha é reconstruída. Foi essa escolha que tornou "tema escolhível pela
  jogadora" barato o suficiente para ser oferecido;
- **entrada dupla desde o primeiro dia**: Gamepad API e teclado ao mesmo tempo,
  decidido em tempo de execução. Toque de tecla fica travado até o próximo
  quadro consumir, senão um toque mais curto que um quadro seria descartado.

## Limites conhecidos

- O terreno é gerado por ruído, sem ilha finita nem biomas — é só carga
  realista para a medição.
- Não dá para colocar nem remover bloco. Isso é Fase 1.
- Sem áudio, sem salvar, sem bichinhos, sem interface de jogo.
- O culled mesher é o baseline honesto, não o mais rápido possível.
