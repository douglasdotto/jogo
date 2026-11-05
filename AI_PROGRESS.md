# Progresso

## Ciclo 1 — 2026-10-30 (branch `pdm-ciclo-1`, juntado na main)
Heróis Brutamontes e Invocador, 4ª habilidade para todos, barra de skills nova, mapa da campanha 3D, loading com pré-aquecimento, balanceamento (60 partidas/dificuldade), assets KayKit FREE (CC0), esqueletos 1.1, animações 1.1, fim do empurra-empurra, otimizações de FPS. Detalhes no histórico do git (merges "ciclo 1").

## Ciclo 2 — 2026-10-30 (branch `pdm-ciclo-2`, juntado na main local; sem push)
| Entrega | Origem |
|---|---|
| Tela de Evolução num cartão só, com quem evolui e o ganho real de cada rota | pedido do usuário |
| Seletor de heróis em 5 abas temáticas | pedido do usuário |
| Golem, fada e dragão do Invocador refeitos; dragão voa e não é alvo | pedido do usuário |
| Invocador com coroa de flores (não confunde com Piromante) | pedido do usuário |
| Brutamontes gigante: proporção por osso, punhos de pedra, Rig_Large | pedido do usuário |
| Rostos: olhos pretos originais, sem sobrancelhas/cicatrizes/pinturas soltas | pedido do usuário |
| Mapa: árvores redondas (Forest só para arbustos/pedras/capim), bosques, chão vivo, atmosfera por bioma | pedido do usuário |
| Zoom da roda corrigido na raiz (+ teste) | pedido do usuário |
| Menu inicial cinematográfico com equipe em 3D | pedido do usuário |
| Logo novo com brasão | pedido do usuário |
| Modo Reino removido | decisão do usuário |
| Modo Jornada removido (bench/simulação mantidos por caminho interno) | decisão do usuário |
| Morros de combate removidos (fases 3/7/10 planas) | decisão do usuário |
| Limpeza de texto em todas as telas | diretriz do usuário |
| FPS: faíscas em lote, esqueletos com menos malhas (−18% draw calls), `?perfil=1` | prioridade do usuário |
| Capítulo VII: Dragão de Ossos, Escavador, Porta-Estandarte, Rei Espectral, Carrasco Afogado | prioridade do usuário |
| Prova Paladino no 2.0 — revertida (não migrar) | decisão do usuário |

## Ciclo 3 — 2026-11-03 (branch `pdm-ciclo-3`, alterações locais)
- IA tática: na defesa, mantém uma âncora junto do santuário e limita a saída dos demais; na ponte, até dois heróis interceptam corredores próximos; evita corridas longas atrás de inimigos móveis; arqueiros estáticos podem ser interceptados dentro de um raio definido.
- Totens e torre: reparte a equipe entre objetivo e inimigos da onda; chefes têm foco coletivo, com troca temporária apenas para ameaças urgentes alcançáveis.
- Fim de onda em totens/torre: se o objetivo daquela fase já saiu do mapa e só restam até dois inimigos comuns num raio de 30 m, até dois heróis os interceptam para a fase avançar; não ativa com ondas pendentes nem chefe vivo.
- Chefes duplicados: a marca `bossPending` agora é consumida no nascimento do líder. Inimigos que voltam à fila após ficarem presos não geram um segundo chefe.
- Pesadelo: reduzi ondas e atributos nas missões que travavam a campanha; torre com menos vida; reforços do Lich limitados nos combates de chefe; Horda cresce em passos mais lentos.
- Duelista: dano base de 18 para 19 e intervalo de ataque de 0,50 s para 0,48 s após comparação com o Assassino.
- Brutamontes: a técnica Arremesso virou **Agarrão Sísmico**: reúne inimigos num raio de 6,5 m e os lança para cima; chefes são puxados e erguidos com menos força. A IA espera um grupo próximo ou uma ameaça prioritária. Removi a rotina antiga de voo e impacto individual.
- Servidor local: `server.js` escuta em `127.0.0.1` por padrão; a aba do usuário abre o jogo em `http://localhost:8081/`.
- Limpeza: removidos os três GLBs antigos (`Skeleton_Minion`, `Skeleton_Warrior`, `Skeleton_Rogue`), 14,5 MB no total. Os equivalentes KayKit 1.1 usados em combate continuam no pacote e no carregamento.

### Validação do ciclo 3
- Testes rápidos após as correções: **41 passaram, 0 falharam**; `rodada2.cjs`: **245 verificações passaram**; `git diff --check` limpo.
- Varredura do Pesadelo em **24 missões × 5 sementes**, com as equipes recomendadas e estrada/terreno/obstáculos. Ponte do Rio, Horda e Castelo receberam retestes direcionados de 10 sementes depois dos ajustes.
- Ponte do Rio: 10/10 vitórias, 10/10 com 3★, aldeão com 98% de vida média. Santuário: 10/10 vitórias. Cripta, Forja e Coroa de Cinzas: 10/10, todas 3★. Trilha de Brasas: 10/10 (9×3★, 1×2★). Duelo: 10/10 (7×3★, 3×2★). Castelo: 10/10, todas 3★. Horda: 10/10 (9×3★, 1×2★; média de 209 s).
- Percurso automatizado pelas **24 missões**, uma por vez, com uma equipe equilibrada fixa de quatro heróis (Duelo respeita a regra de um herói): **24/24 vitórias** em uma semente. A simulação confirma o roteiro inteiro, mas não é uma partida contínua com XP acumulado nem altera o save do navegador.
- Ruínas Antigas travava quando dois Sacerdotes móveis ficavam 25–27 m à frente após os totens daquela fase terem sido destruídos. Com a interceptação final limitada, vence em **10/10 sementes** (8×3★, 2×1★); uma semente que ficava presa agora avança.
- A mesma equipe fixa perdia Coroa de Cinzas quando um inimigo preso voltava à fila e a marca de chefe pendente gerava um segundo Rei Espectral. Com a marca consumida ao surgir o líder, a missão vence com **3★ e zero quedas** nessa semente.
- Uma passada exploratória de escalações aleatórias venceu **15/24** missões; as outras 9 terminaram em derrota antes do limite de simulação, sem travamento de fase. Investiguei duas: Ponte em Chamas terminou com Bruto + Oráculo mortos e quatro vazamentos, atacando inimigos já dentro da área do portão; Ruínas terminou com Bruto + Oráculo + Alquimista mortos antes de concluir a missão. As outras 7 derrotas não foram diagnosticadas individualmente; equipes aleatórias ainda podem perder no Pesadelo.
- Duelista × Assassino, mesma equipe de suporte e 20 sementes: antes, 12/20 contra 13/20 vitórias e 21,2 contra 24,3 de dano/s; depois do ajuste, Duelista 12/20, 22,0 de dano/s e 2,0 quedas médias (antes: 2,3). Diferença de vitórias pequena; acompanhar em testes de jogo.
- A evolução manual já oculta rotas de primeiro grau escolhidas e oferece o segundo grau; teste correspondente em `rodada2.cjs`.
- `asset-loading.cjs` passou após a remoção e confirma que os modelos necessários continuam presentes.
- Navegador (verificação inicial): menu 3D, quatro heróis e botões da campanha renderizaram em `localhost:8081`; antes da campanha, console sem avisos nem erros e save em 0/72 estrelas.
- FPS em horda cheia: benchmark visível de 15 s, fase 10, 80 inimigos, 1280×720, DPR 1,5 e sombras 1024. Medida anterior: 30,1 FPS e 800 draws; após reduzir as malhas que projetam sombra: **31,8 FPS, 764 draws e 654 draws de sombra**. Tempo médio do jogo ficou praticamente igual (23,27→23,28 ms), então o ganho é modesto e vem sobretudo de reduzir trabalho gráfico; qualidade em gráficos baixos ainda chegou a 35,7 FPS.

### Pendências
- Confirmar FPS em partidas comuns e testar se a redução de sombras mantém boa leitura visual em outras distâncias; o benchmark de horda é sintético e não garante o mesmo ganho em toda máquina.
- Se a meta for permitir vitória com qualquer composição, aprofundar balanceamento das 9 derrotas da passada aleatória; a equipe equilibrada fixa venceu as 24 missões.

### Campanha jogada no navegador — 2026-11-03
- Percorri a campanha contínua inteira no Pesadelo, da missão 1 à 24: **24/24 vitórias**, incluindo a missão final Coroa de Cinzas com **3★, zero quedas e 85% de vida**.
- Missões 19–24: O Arauto das Asas (3★), Ninho de Ossos (3★), Asas de Osso (3★), Trilha de Brasas (3★), Forja de Ossos (3★) e Coroa de Cinzas (3★). Totens, resgate, torres e chefes concluídos.
- Na exploração do console, apareceu repetidamente `TypeError: Cannot read properties of null (reading 'reset')` quando um mini-paladino morria. `Unit.die()` pedia `Death_C_Skeletons`, ausente no modelo de herói; a exceção interrompia a remoção e ocultação da barra. A morte agora escolhe um clipe disponível, e as rotinas de animação/habilidade toleram clipes ausentes.
- Adicionei uma regressão que simula a ausência do clipe de esqueleto e confirma a morte/limpeza normal do mini-paladino. `npm run test:rapido`: **41 passaram, 0 falharam**; `rodada2.cjs` passou de novo com a regressão. Na primeira tentativa, a suíte completa foi interrompida durante a bateria de simulações; a validação posterior concluiu essa bateria e passou (detalhes abaixo).

### Revisão da campanha no navegador — 2026-11-03
- Cada uma das 24 missões recebe uma semente diferente, estável enquanto o jogador navega. Ela varia terreno, vegetação e adereços, mas a rota-base de combate é compartilhada; portanto não são 24 layouts feitos do zero. Biomas se repetem, e as seis missões finais fixam Cinzas.
- O título longo “O Arauto das Asas” era cortado no painel do mapa; ajustei a quebra de linha e confirmei o título completo no navegador.
- A campanha contínua usa quatro heróis (exceto Duelo), mas os detalhes e recomendações do mapa usavam a contagem antiga de cada missão. Agora ambos mostram quatro e montam a recomendação para a composição real da campanha. Confirmei “Ponte em Chamas” no navegador: quatro heróis, com Paladino, Guardião, Viking e Clériga.
- `npm run test:rapido`: **41 passaram, 0 falharam**; `git diff --check` limpo.
- Na cena real de batalha, repeti “Ponte em Chamas” com a equipe salva (Guardião, Campeão, Druida e Paladino, nível 5): **3★, 0/7 vazamentos e zero quedas**. O save passou a 71/72 estrelas.
- Repeti “Noite sem Fim” na mesma cena e equipe: **3★ aos 3:59**, 49 abates e quatro quedas; o save chegou a **72/72 estrelas**. O painel de vitória registrou o novo recorde e o desafio 3★ no Pesadelo.
- Console do navegador após as duas partidas: nenhum erro.
- Nova amostra de equipes aleatórias, em Pesadelo, uma semente por missão, quatro heróis e nível inicial de cada missão: **21/24 vitórias**. Coração do Castelo, Ninho de Ossos e Asas de Osso terminaram com os quatro heróis mortos; as escalações eram, respectivamente, King/Campeão/Monge/Ninja, King/Viking de Gelo/Bruto/Geomante e Duelista/Crusher/Arcano/Besteiro. Nenhuma tinha um curandeiro dedicado.
- Diagnóstico do Ninho: dois heróis tinham o Totem como alvo, que terminou com 1 de 680 de vida; os outros dois interceptavam inimigos, e ainda havia nove inimigos comuns vivos quando o grupo caiu. Isso mostra pressão de sobrevivência numa composição aleatória sem cura, não abandono do objetivo pela IA. A amostra não é uma campanha contínua nem prova que toda composição aleatória seja viável.

### Revisão visual de mapas e estrelas — 2026-11-03
- Revisei os campos de batalha das fases 3, 7 e 10 no navegador. Ponte e margem do rio, ruínas e campo de cinzas aparecem com a estrada, obstáculos e HUD dentro do enquadramento; não encontrei cortes visuais novos.
- Conferi os 24 cartões da campanha salva: cada missão mostra **3/3 estrelas** e o total é **72/72**. Os capítulos somam, em ordem, **12, 9, 9, 15, 6, 3, 9 e 9** estrelas; nenhuma estrela duplicada, total 72.

### Agarrão Sísmico e FPS — 2026-11-03
- Arena Pesadelo no navegador com Brutamontes: a habilidade apareceu no seletor, ficou em Auto e entrou em recarga quando a horda se agrupou; a partida foi pausada depois da conferência. A aba da demonstração fica aberta para consulta.
- Regressão de `rodada2.cjs`: sem cast contra alvo isolado; com grupo, todos dentro do raio recebem dano, são puxados para perto e sobem; alvo fora do raio não é afetado; chefes recebem deslocamento e knock-up menores.
- Em campanha isolada no host `127.0.0.1`, conferi visualmente as telas do tutorial de seleção, Auto na batalha, relíquia e avanço de fase. A bolha aparece junto ao controle certo e não tapa a seleção.
- Cheguei à evolução durante a missão 2: Campeão → Campeão Real, números de vida/dano/DPS, três rotas e selo na rota sugerida ficaram legíveis, sem cortes.
- `npm run test:rapido`: **41 passaram, 0 falharam**. `npm test`: **42 passaram, 0 falharam**, incluindo a bateria padrão de 50 simulações (466 s).

### Comparação de composições no Pesadelo — 2026-11-04
- Rodei **15 equipes × 5 missões × 2 sementes = 150 simulações** em Santuário (Nv1), Ponte em Chamas (Nv2), Ruínas Antigas, Noite sem Fim e Coroa de Cinzas (Nv3). Todas usaram quatro heróis e as mesmas sementes por missão; o Duelo não entrou nesta amostra. A progressão de XP e relíquias entre missões não foi simulada.
- A equipe salva (Guardião, Campeão, Druida, Paladino) venceu **10/10** e fez **3★ em 5/10** no nível recomendado das missões. Repetida no Nv5, venceu **10/10 e fez 3★ em 9/10**, incluindo 3★ em Santuário e Ponte em Chamas nas duas sementes.
- O perfil Equilibrado venceu **10/10 e fez 3★ em 8/10**. O perfil Invocador (Invocador, Guardião, Piromante, Clériga) fez **3★ em 10/10**; na Horda, chegou ao fim com média de 3,5 quedas e vida do grupo em 0%.
- Lâminas (Campeão, Berserker, Assassino, Duelista), sem cura nem atirador, venceu **6/10**: perdeu as quatro tentativas de Ruínas e Coroa de Cinzas. Novos heróis e perfil Rúnico tiveram cada um uma falha em duas sementes na Coroa; não é evidência suficiente para declarar um herói individual fraco.
- A Horda ainda concede estrelas somente pelos marcos de tempo. A equipe salva e outros grupos fizeram 3★ com quatro quedas e 0% de vida; isso mede o tempo sobrevivido mesmo quando o grupo cai.
- A ordem de seleção também alterou um caso de Ruínas, mantendo equipe e semente: Ilusionista primeiro ficou incompleto no limite de 900 s, com três totens destruídos e um Mago vivo; Paladino primeiro venceu com 3★, sem quedas, em 148,7 s. A posição de formação deve ser considerada ao avaliar uma escalação.
- Conclusão limitada à amostra: a equipe salva não domina com 3★ quando começa no nível recomendado; no Nv5, a maioria dos mapas amostrados fica muito fácil. Equipes sem papéis de cura e linha de frente são sensivelmente mais frágeis. O resultado não representa uma campanha contínua com XP/relíquias acumulados.

### IA de objetivos e estrelas da Horda — 2026-11-05
- A formação agora é estável para a mesma equipe, qualquer que seja a ordem de seleção: heróis frágeis vão para trás, os mais resistentes cobrem a frente e empates usam o ID. O guarda de escolta também desempata por resistência e ID.
- Em totens/torre, a IA reserva metade do grupo para a onda; quando há chefe ativo e objetivo destrutível, até três de quatro heróis mantêm pressão no objetivo e um fica livre para o chefe. Os corredores recebem prioridade forte no alvo designado.
- Na Horda, os marcos de 60 e 120 s ainda dão até duas estrelas mesmo se todo o grupo cair. A terceira exige 180 s e ao menos um herói vivo ao fim. O mapa, HUD, relatório e critério de resultado foram alinhados.
- `npm run test:rapido`: **41 passaram, 0 falharam**; `git diff --check` limpo.
- Reteste de Ruínas com a semente que antes variava por ordem: Ilusionista primeiro e Paladino primeiro venceram **2/2 cada**, todos com 3★ e zero quedas (171 s e 160 s de média, respectivamente).
- Limite encontrado: Lâminas (Campeão, Berserker, Assassino, Duelista) ainda perdeu **2/2** em Ruínas no nível recomendado; o grupo caiu na fase 9 com dois de três totens destruídos e o Rei Espectral vivo. A simulação dessa missão não inclui XP acumulado de campanha. Na Horda, a mesma equipe venceu **2/2**, mas com 1★ após média de 86 s e quatro quedas. A escalação sem cura/alcance continua sendo um caso difícil que precisa ser avaliado em campanha contínua.

### Rei Espectral e avanço da campanha — 2026-11-05
- Ruínas agora distribui um totem por fase entre 8 e 10 e agenda o Rei Espectral para a fase 11; a missão, HUD e painel de ameaças concordam. A IA manda três de quatro heróis ao totem durante a onda, deixando um para conter os inimigos.
- Inimigos comuns que não sofrem dano, não se aproximam e ficam fora do alcance de ataque por 15 s voltam à fila de surgimento; unidades ao alcance e chefes não são removidos. Nas missões de chefe, a equipe alcança um Golem que tenha sido empurrado até 30 m do posto.
- Regressões: `node tests/run-all.cjs --rapido` — **41 passaram, 0 falharam**. A suíte sem `--rapido` foi interrompida porque inclui 40 simulações aleatórias demoradas; essa bateria não foi registrada como aprovada.
- Varredura independente, uma semente, equipe recomendada e dificuldade Pesadelo em cada missão: **24/24 vitórias**, sem fases incompletas. É uma verificação por missão, não uma campanha contínua com experiência acumulada.
- Ruínas recomendada: **4/4 vitórias** no seed 20261105, três com 3★ e uma com 1★/uma queda. Duas equipes sem cura venceram **1/4 cada**; seguem capazes de vencer, com risco alto. Vila e Fazendas, que antes ficavam sem encerrar contra um atirador ou Golem isolado, venceram **2/2 cada** após os ajustes de perseguição.

### Separação entre heróis — 2026-11-05
- Heróis em movimento agora usam a folga compacta de combate entre si, tanto no desvio de rota quanto na resolução de colisões. A formação parada e o espaçamento entre outros aliados continuam com a folga maior.
- `node cavaleiros/tests/run-all.cjs --rapido`: **41 passaram, 0 falharam**. `node cavaleiros/tests/empurra.cjs detalhe`: cinco equipes sem sobreposição persistente (0,0% overlaps).
- Na repetição visual de Ponte em Chamas no Pesadelo, os heróis mantiveram posições distintas na ponte e no combate, sem bloqueio visível entre aliados.

### Organização dos estilos e arquitetura — 2026-11-05
- Os estilos gerais saíram do bloco inline de `index.html` para `base.css`, preservando a posição da folha na cascata. O HTML ficou dedicado à estrutura da página.
- `AI_PDM.md` agora descreve o tamanho atual de `main.js` e as 24 missões da campanha.
- A lógica do jogo não mudou nesta limpeza.

### Critério de ameaça da IA — 2026-11-05
- Centralizei a classificação de chefes, totens, sacerdotes, bombardeiros, inimigos prioritários e golpes mirando aliados em `isUrgentEnemy`; habilidades que podem interromper telegráfos pedem essa condição explicitamente.
- Removi as seis cópias do predicado usadas na decisão de lançar habilidades. A lógica específica de defesa e a de alvos da Caçada em Matilha continuam separadas.
- Atualizei os testes visuais para buscar regras em `base.css` após a extração da folha. `node tests/run-all.cjs --rapido`: **41 passaram, 0 falharam**.
- A suíte completa iniciou as 50 simulações aleatórias, mas ficou vários minutos sem retorno e foi interrompida; não está registrada como aprovada.

### Confiabilidade do perfil e revisão do backlog — 2026-11-05
- O painel `?perfil=1` agora mostra `sombra` como ms/quadro e `sombraDraws` como draws/quadro; antes, a contagem recebia unidade de tempo incorreta.
- Auditei os P0 1–9 e o item 19 contra o código atual e marquei as correções já entregues como concluídas.
- `node tests/bench-timing.cjs`: passou, incluindo a regressão que distingue as unidades do perfil.
- A medição exploratória de FPS foi feita com outra aba do jogo aberta; não serve como baseline comparável. Nova medição isolada segue pendente antes de decidir mudanças visuais de desempenho.

### Sombras na horda — 2026-11-05
- Cada inimigo esqueleto usa agora só a maior malha visível como caster de sombra; armas e acessórios mantêm aparência e animação, mas não abrem novas chamadas. Os heróis conservam as sombras de todas as peças.
- `rodada2.cjs`: **249 verificações passaram**, incluindo a regressão de um caster por inimigo e sombras completas para heróis. `npm run test:rapido`: **41 passaram, 0 falharam**.
- No perfil da fase 12 (40 inimigos-alvo, qualidade alta), `sombraDraws` caiu de **450,6 para 292 draws/quadro**; o painel marcou 12,6 ms antes e 2,95 ms depois. O total foi de **588 para 433 draws**.
- A execução posterior teve rAF em **1 Hz** e cerca de três unidades vivas a menos; portanto não valida FPS comparável. A próxima medida precisa ocorrer com a aba realmente em primeiro plano e carga constante.
- Fechei as abas temporárias do benchmark. O browser voltou à vitória de teste de Ponte em Chamas na aba original.

### Organização do mapa da campanha — 2026-11-05
- Extraí a geometria pura da estrada, regiões e posições dos cartões para `campaign-layout.js`; `campaign.js` mantém a integração com as missões e reexporta a estrada usada pelo mapa 3D.
- Centralizei o carregamento de fonte de campanha nos testes para incluir o novo módulo sem alterar os ambientes de teste.
- Atualizei o backlog: o mapa gera posições determinísticas e sem sobreposição para 24, 25, 28 e 36 missões.

### Interceptação de ameaças aos objetivos — 2026-11-05
- No Santuário, a regra anterior bloqueava todo alvo a mais de 12 m, inclusive inimigos que já atacavam um herói. Agora o guarda mais resistente/de suporte fica no cristal; até dois aliados interceptam inimigos de qualquer tipo que já tenham um herói ou o objetivo como alvo, até 26 m. Um inimigo distante que ainda não ameaça ninguém não puxa a formação.
- Na Ponte em Chamas, corredores marcados recebem um raio de interceptação de 16 m; inimigos comuns ficam limitados aos 12 m próximos do portão. A dupla responde aos corredores diretos, e equipes maiores mantêm uma âncora com até dois interceptores. Se todos estiverem ocupados, a âncora cobre a ameaça.
- Reduzi de 30% para 20% a chance de um inimigo corpo a corpo virar corredor da ponte, para a equipe de dois não perder por sobrecarga de vazamentos.
- `rodada2.cjs`: **249 verificações**; `npm run test:rapido`: **42 passaram, 0 falharam**.
- Pesadelo, missão isolada, 10 sementes: Santuário com 2 heróis (Paladino + Guardião) **10/10 vitórias**, 6×3★ e 4×1★, sem quedas; vida média: 80% no grupo e 53% no santuário. Com os 4 heróis recomendados (Paladino, Guardião, Piromante e Clériga), **10/10 vitórias com 3★**, zero quedas ou vazamentos e 84% de vida média no santuário. Ponte em Chamas com 2 heróis **10/10 vitórias**, sem quedas; 5×1★ e 5×2★. A equipe alternativa Paladino + Piromante venceu **5/5**, com 1×3★. São amostras por missão, sem XP carregado entre fases.
- `npm test` foi interrompido após mais de 11 minutos durante a bateria longa de simulações; não está registrado como aprovado. Os testes rápidos e as simulações direcionadas acima passaram após os ajustes.

### Agressores móveis no Santuário — 2026-11-05
- A defesa agora reconhece ataque ativo de inimigos móveis e corpo a corpo, além dos atiradores imóveis. A âncora continua junto ao cristal e a interceptação remota continua limitada a dois heróis dentro de 26 m; inimigos sem alvo ativo seguem sem atrair a formação.
- `rodada2.cjs`: 249 verificações passaram, incluindo atirador e perseguidor móveis que atacam heróis; `npm run test:rapido`: **42 passaram, 0 falharam**.
- Pesadelo, Santuário isolado, 10 sementes por amostra com quatro heróis, sem XP entre fases: equipe recomendada mais dois heróis sorteados venceu **10/10**, com 7×3★, 3×2★ e 80% de vida média no cristal; equipe totalmente aleatória venceu **10/10**, com 8×3★, 1×2★, 1×1★ e 70% de vida média no cristal. Houve 0 vazamentos nas duas amostras.

### Menos perseguição aos inimigos — 2026-11-05
- Atiradores inimigos agora recuam por até 1,8 s, depois ficam 8 s parados para atacar; cada recuo percorre 1,5 m em vez de 3 m. Os três atiradores com comportamento próprio também recuam 1,5 m por vez.
- Na Caçada, o alvo marcado só foge até 9 m adiante e a perseguição termina a 13 m do posto, mantendo dois interceptadores.
- `rodada2.cjs`: **249 verificações**; `npm run test:rapido`: **42 passaram, 0 falharam**. A verificação mantém o recuo do herói à distância e limita a fuga do mago inimigo.
- Pesadelo, missões isoladas e sem XP entre fases: Santuário, 10 equipes aleatórias de quatro heróis, **10/10 vitórias**, 5×3★, 3×2★, 2×1★, sem vazamentos; Caçada, 10 equipes aleatórias de três heróis, **10/10 vitórias e 3★ em todas**, sem quedas e com 90% de vida média no grupo.

### Varredura com uma equipe sem cura — 2026-11-05
- Nas 24 missões isoladas do Pesadelo, a mesma equipe determinística de quatro heróis (Lanceiro, Oráculo, Guardião e Geomante) venceu **20/24**. As quatro derrotas foram Torre de Ossos (fase 10), Lago Sombrio (fase 9, Carrasco com 225/1416 de vida), Cemitério (fase 11) e Coração do Castelo (fase 13, Lich ainda com vida cheia).
- Repeti essas quatro missões no mesmo seed com a equipe equilibrada recomendada (Paladino, Guardião, Piromante e Clériga): venceu **4/4**, todas sem quedas exceto Cemitério (1 queda/1★). Isso confirma um risco alto da equipe sem cura nas fases longas, não um travamento geral da IA.
- A varredura é isolada por missão, sem XP acumulado. Não alterei a dificuldade global; a campanha contínua foi reproduzida separadamente com a progressão real abaixo.

### Recuo curto dos atiradores — 2026-11-05
- O recuo era recalculado em relação à posição atual a cada quadro, transformando um pequeno passo em uma corrida contínua. Agora o atirador fixa um único destino a 0,9 m, só recua quando o herói chega a 3,4 m e espera 7 s antes de outro passo.
- `rodada2.cjs`: **249 verificações passaram**, incluindo a distância curta e o fim do recuo ao chegar no destino.

### Campanha contínua no Pesadelo — 2026-11-05
- O simulador agora mantém a equipe e usa XP e evoluções salvos entre missões, incluindo a escolha de um herói no Duelo. Cenários usam estrada, terreno e obstáculos; o armazenamento fica isolado na VM de teste.
- Com Paladino, Guardião, Piromante e Clériga, uma campanha reproduzível venceu **24/24 missões**, somou **70/72 estrelas** e teve **4 quedas**. Apenas Ponte em Chamas e Noite sem Fim ficaram em 2★; as outras 22 missões ficaram em 3★.
- Ao fim, a equipe terminou entre 3.079 e 3.206 XP por herói, com quatro evoluções em cada um. A missão Noite sem Fim concentrou as quatro quedas da campanha; não impediu a vitória.

### Fuga menor dos inimigos — 2026-11-05
- O alvo marcado agora começa a fugir quando um herói chega a 3,8 m e recua até cerca de 6 m à frente da âncora, em vez de correr até 9 m. Ao chegar nesse limite, para e enfrenta a equipe.
- Atiradores agora recuam 0,6 m quando um herói chega a 3,2 m e esperam 9 s antes de outro passo (antes: 0,9 m, 3,4 m e 7 s).
- `rodada2.cjs` verifica o destino máximo, a interrupção da fuga e o passo dos atiradores; `npm run test:rapido`: **42 passaram, 0 falharam**.
- No Pesadelo, 10 equipes aleatórias venceram a Caçada **10/10 vezes, todas com 3★**, sem quedas; tempo médio de 15,3 s. A mudança não adicionou dano ou vida.

### Controles de benchmark em primeiro plano — 2026-11-05
- `bench.js` agora varia pixel ratio em 1, 1,25 ou 1,5 e tamanho de sombra em 512, 1024 ou 2048 px; restaura o renderer mesmo se o benchmark falhar.
- O benchmark foi rodado visivelmente com uma fase, quatro heróis e carga de 40 inimigos. As amostras variaram de 16,9 a 21,7 FPS em alta qualidade, então não justificam mudar os padrões gráficos. A execução ainda não forma uma linha de base estável sem throttling.
- `bench-timing.cjs` confere os valores e a restauração após sucesso e falha; incluído nos **42 testes rápidos aprovados**.

### Interceptação dividida na Caçada — 2026-11-05
- No Duelo, a seleção da equipe destaca Paladino; sem ele, Anjo e depois Clériga. A simulação contínua agora confirma a opção destacada, como o teclado/clique do jogo.
- A Caçada limitava interceptores só quando o alvo estava além do alcance normal. No Arauto das Asas, os quatro heróis grudavam no alvo e ignoravam Sacerdotes e inimigos próximos. Agora dois interceptores são escolhidos em todas as distâncias; os demais não podem perseguir o alvo livremente e protegem o grupo.
- Regressão cobre alvo perto da formação, dois interceptores, e a escolha de Sacerdote pelo defensor. `rodada2.cjs`: **250 verificações passaram**.
- A equipe aleatória Brute/Clériga/Anjo/Xamã, seed `20261105`, passou de derrota na missão 19 para **24/24 vitórias, 64 estrelas e 7 quedas** na campanha contínua do Pesadelo. O Anjo entrou no Duelo por padrão; Resgate, Cemitério e Trono tiveram uma queda cada, e Noite sem Fim quatro.

### Reuso de projéteis inimigos — 2026-11-05
- Orbes e modelos clonados das flechas do Besteiro agora voltam para estoques limitados a 32 malhas por tipo depois do impacto, expiração ou morte do alvo. Reutilizar orbes também restaura o material próprio do atirador.
- `rodada2.cjs` confirma reuso de identidade para ambos os tipos e troca correta do material; **251 verificações passaram**. `npm run test:rapido`: **42 passaram, 0 falharam**.
- A alteração reduz criação de `Mesh` e clones GLTF em combate; ainda não há FPS estável que permita quantificar o ganho no quadro.

### Menos corrida do alvo da Caçada — 2026-11-05
- O alvo marcado agora recua só até 5 m à frente da âncora (antes 6,5 m) e dá passos menores quando alguém se aproxima, reduzindo o tempo de perseguição sem remover sua mecânica de fuga.
- `rodada2.cjs`: **251 verificações passaram**; `npm run test:rapido`: **42 passaram, 0 falharam**. A regressão cobre o novo limite e a parada antecipada do alvo.

### Disparos reutilizados e detalhes visuais — 2026-11-05
- Projéteis dos heróis agora reutilizam malhas por identidade visual (herói, tipo e habilidade), com até 8 por visual e teto global de 96. Os acessórios do projétil são montados uma vez para cada malha reutilizável.
- O Campeão ganhou uma ombreira assimétrica de couro e bronze com friso dourado. O shader rúnico ganhou um pulso que percorre o círculo e 14 marcas externas, sem criar malhas ou chamadas de desenho.
- Regressões cobrem reuso sem mistura entre orbe e flecha, escala própria do disparo de habilidade, identidade do Campeão e componentes do shader rúnico. `rodada2.cjs`: **252 verificações**; `npm run test:rapido`: **42 passaram, 0 falharam**.
- A campanha contínua no Pesadelo, seed `20261106`, venceu **24/24** com Paladino/Guardião/Piromante/Arqueira, somou **62/72 estrelas** e teve 8 quedas. O mesmo resultado foi observado antes e depois do pool.

### Composições sem cura no Pesadelo — 2026-11-05
- Campanha contínua, seed `20261106`, quatro combatentes corpo a corpo (Campeão/Berserker/Assassino/Duelista): venceu 4/24 missões e caiu em Fazendas, missão 5, após 7 quedas; os quatro caíram com 15 inimigos vivos. Esta equipe sem alcance e sem cura continua sendo uma composição de risco muito alto.
- Campanha contínua, seed `20261107`, Lanceiro/Oráculo/Guardião/Geomante: derrota no Lago Sombrio, missão 12, fase 9, após 11/24 vitórias e 10 quedas; o Carrasco ainda tinha 492/1444 de vida. A amostra confirma que composições sem cura podem falhar em chefes longos.
- Esses resultados não justificam reduzir a dificuldade global: a equipe protegida com dano misto concluiu a campanha na mesma seed com 62 estrelas e 8 quedas. Manter as derrotas sem cura como risco de composição enquanto ampliamos a amostra.

### Reuso de impactos e detalhes das skills — 2026-11-05
- Anéis de impacto e feixes curtos agora reciclam malhas em estoques limitados a 128 e 32. Os materiais continuam usando os pools existentes; efeitos antigos são liberados corretamente ao reiniciar.
- O shader de raios de luz usado por curas, bênçãos e golpes santos ganhou faixas luminosas ascendentes e fios em espiral dentro da malha existente, sem draw calls adicionais.
- `rodada2.cjs`: **252 verificações passaram**, incluindo 100 usos sequenciais que reaproveitam uma malha e um material por tipo. `simulacao-perfil.cjs` e `vfx-shaders.cjs` passaram; `npm run test:rapido`: **42 passaram, 0 falharam**.
- A arena Normal foi aberta no browser em modo de teste (não salva); chegou à onda 3 e o Chrome exibiu o aviso interno de FPS baixo. Como o próprio aviso recomenda aceleração gráfica e a sessão não fornece FPS comparável, isso fica como observação do ambiente, não como medida de ganho ou regressão.

### Reuso das marcas de chão — 2026-11-05
- As marcas circulares de fogo, poções e áreas de habilidade agora reutilizam malhas e materiais em pools limitados a 128, reduzindo alocação por impacto e encerramento de efeitos.
- Marcas ligadas a FX de acompanhamento ficam uma atualização fora do pool antes de serem reutilizadas; isso deixa o FX antigo detectar a remoção da base e evita que ele siga outra área.
- `rodada2.cjs`: **252 verificações passaram**, incluindo 100 ciclos sequenciais de poças que reaproveitam uma única malha e um material. `simulacao-perfil.cjs` passou; `npm run test:rapido`: **42 passaram, 0 falharam**. O teste `run-terrain.mjs` também cobre o reinício com o helper de limpeza presente.

### Guarda sobrevivente, ponte e direção visual — 2026-11-05
- Em escolta, o herói vivo que sobrar mantém a vaga de guarda ao lado do aldeão e não caça para além do perímetro. Regressão cobre um único Berserker, ameaça próxima e inimigo distante.
- Na Ponte em Chamas, quando restam só dois heróis, a âncora também intercepta ameaças comuns dentro dos 12 m do portão; o alcance de corredores marcados continua limitado a 16 m. Com quatro heróis, a âncora mantém o posto e até dois aliados interceptam. `rodada2.cjs`: **253 verificações passaram**.
- O simulador de campanha ganhou `Vector3.addScalar`; a campanha completa agora percorre habilidades de projétil sem falhar por limitação do vetor falso. `npm run test:rapido`: **42 passaram, 0 falharam**.
- Campanha contínua Pesadelo, seed `20261106`, equipe Paladino/Guardião/Piromante/Clériga: **24/24 vitórias, 69/72 estrelas e 4 quedas**. Ponte em Chamas ficou em 1★ com quatro vazamentos; Noite sem Fim concentrou as quatro quedas. Na simulação isolada, Paladino/Guardião teve três vazamentos e 1★; a equipe recomendada Paladino/Viking teve dois vazamentos e 2★. Ambas venceram; a defesa da ponte ainda merece calibração.
- Primeira rodada na direção 3D mobile polida: ombreira com brasão em camadas para o Campeão; flores facetadas com miolo em geometria mesclada; brilho diagonal no cristal de gelo; botões de habilidade com moldura, relevo e brilho interno. As flores seguem instanciadas e o shader não adiciona geometrias ou chamadas de desenho.
- `hero-identity.cjs`, `vfx-shaders.cjs`, `scene-perf.cjs` e `terrain.js` passaram. Arena Normal atualizada e ativa no browser; o visual foi conferido em execução, embora o brilho do cristal de gelo não aparecesse nessa arena.

### Foco dividido na ponte e nova rodada visual — 2026-11-05
- Na Ponte em Chamas, a âncora agora escolhe a ameaça alcançável mais perto de cruzar. Os outros heróis evitam alvos que já têm um aliado focado e dividem os corredores; quando só há um alvo acessível, continuam concentrando ataques. Os limites de perseguição não aumentaram.
- `rodada2.cjs`: **254 verificações passaram**, incluindo regressões com dois e quatro heróis para conferir a divisão de alvos. `npm run test:rapido`: **42 passaram, 0 falharam**.
- Campanha contínua Pesadelo, seed `20261106`, Paladino/Guardião/Piromante/Clériga: **24/24 vitórias, 70/72 estrelas e 4 quedas**; Ponte em Chamas subiu de 1★ para 2★, e Noite sem Fim ficou em 2★. No mapa isolado seed `3688601093`, quatro heróis caíram de cinco para três vazamentos, ainda com 1★; vale manter a ponte na próxima calibração.
- Três frentes visuais receberam mudanças de baixo custo: ombreiras facetadas mais largas no Paladino; copas de árvore em facetas maiores com paleta um pouco mais viva; moldura e relevo nos grupos da barra de habilidades, preservando os estados de recarga e ultimate.
- Os agentes validaram `hero-identity.cjs`, `scene-perf.cjs`, `terrain.js`, `skill-slot4.cjs` e `skill-tooltip.cjs`, além de sintaxe e `git diff --check`. A captura real do browser confirmou copas facetadas e grupos de habilidades coloridos pela identidade dos heróis; a ombreira do Paladino ainda precisa de conferência em câmera próxima.

### Dez equipes variadas na Ponte e mock de simulação — 2026-11-05
- Pesadelo, Ponte em Chamas, quatro heróis aleatórios, 10 sementes e sem XP acumulado: **10/10 vitórias**, com 4×3★, 3×2★ e 3×1★; média de 0,1 queda. A pior rodada teve quatro vazamentos, mas não perdeu a missão.
- A primeira execução revelou que o mock de `Quaternion` do simulador não implementava `identity()`, chamado pelo disparo especial do Ninja. Completei o mock nos dois harnesses; era uma limitação dos testes, não um erro do jogo.
- A aba real do jogo permaneceu em execução durante a conferência visual, sem abrir uma segunda sessão.

### IA sob pressão, empurra-empurra e recuo inimigo — 2026-11-05
- Reação de dano do herói continua visível, mas limita o bloqueio da IA a 0,32 s. Antes a janela de animação podia suspender movimento e seleção de alvo por mais de um segundo. Regressão em `rodada2.cjs`.
- Durante o destrave de movimento, os heróis voltam a desviar parcialmente dos aliados; o solucionador físico também distribui melhor o deslocamento, evitando jogar quase toda a fila para o lado. Regressão de corredor em `rodada2.cjs`.
- Atiradores e suportes inimigos recuam apenas uma vez por aproximação: passo de 0,9 m, até 0,8 s, e só armam nova fuga quando a equipe se afasta a 8,5 m. Sacerdote e Xamã usam a mesma lógica comum. `chapter7-monsters.cjs` cobre recuo, ataque, rearme e contato coincidente.
- Extração de `HEROES`, `VARIANTS`, grupos, formações, esqueletos e dificuldades para `hero-roster.js`; os testes agora carregam os dados pelo módulo correto.
- `rodada2.cjs`: **256 verificações passaram**. `npm run test:rapido`: **42 passaram, 0 falharam** após integrar as mudanças.
- `npm test` iniciou, mas o runner ficou mais de cinco minutos sem saída no bloco de 50 simulações padrão; interrompi esse bloco. As campanhas contínuas Pesadelo acima e os testes rápidos foram executados separadamente.
- Browser: a missão A Ponte do Rio começou no Pesadelo; após a primeira onda, a equipe estava agrupada junto ao aldeão, com **100% de vida**, sete abates e nenhum erro no console. A partida ficou aberta na aba lateral para continuar a inspeção.

### Campanha Pesadelo com composições variadas — 2026-11-05
- Composição sorteada Brute/Clériga/Anjo/Xamã, seed `20261105`: **24/24 vitórias, 63/72 estrelas e 7 quedas**. Ponte do Rio terminou com 3★; Ponte em Chamas, Duelo, Cemitério e Arauto das Asas ficaram com 1★; Noite sem Fim ficou com 2★.
- Sem cura e só corpo a corpo (Campeão/Berserker/Assassino/Duelista), seed `20261106`: **4/24 missões**. Caiu em Fazendas, fase 6, após 7 quedas no total; o Rei ainda tinha 148/1363 de vida e três inimigos vivos. É uma falha de composição extrema, não uma trava da campanha para equipes variadas.

### Resposta a ameaças, custo por quadro e direção visual — 2026-11-05
- Heróis agora interrompem o foco anterior quando um inimigo já os escolheu como alvo durante a aproximação, sem mudar os limites de perseguição. A regressão reproduz esse intervalo antes do golpe; `rodada2.cjs`: **257 verificações passaram**.
- `separatePair` compara distância ao quadrado e só calcula a raiz se houver sobreposição. `collision-separate.cjs` e `empurra.cjs` passaram antes e depois da alteração.
- O simulador reutiliza o snapshot de unidades em cada quadro, preservando a fotografia inicial mesmo quando a lista muda durante a atualização. O perfil apontou `separate`, `separatePair` e `moveTo` como os principais custos. Uma simulação levou 42,15 s depois da mudança; sem comparação A/B controlada, não atribuí o tempo à otimização.
- `run-all.cjs` agora anuncia cada teste antes de iniciá-lo e imprime sua duração; a ordem e a cobertura não mudaram. A suíte padrão com 50 simulações ainda não foi repetida após a interrupção anterior.
- Direção visual: roupas texturizadas com acabamento fosco; silhuetas Mage ampliadas em 8% no corpo/pernas e 12% nas mangas, sem malhas adicionais; moldura azul e dourada no HUD; Agarrão Sísmico com anel convergente, fragmentos e onda de impacto.
- `npm run test:rapido`: **42 passaram, 0 falharam**. Aba lateral continua aberta na missão 3, fase 3/4, com a escolha de evolução aguardando e nenhum inimigo restante.

### Extração dos metadados da barra de habilidades — 2026-11-05
- `SKILL_KEYS` e `SKILL_GLYPHS` agora vivem em `cavaleiros/skill-ui.js`; `main.js` importa esses dados e fica com a montagem/renderização da barra. O módulo é puro e não altera gameplay.
- `skill-glyphs.cjs` e `skill-tooltip.cjs` carregam o módulo; `simulacao.cjs` injeta os dados na VM, permitindo que `empurra.cjs`, `ponte-travessia.cjs` e `simulacao-perfil.cjs` reutilizem o runner; `rodada2.cjs` também os injeta. `skill-slot4.cjs` verifica as teclas no módulo novo.
- Checks focados passaram: `skill-glyphs.cjs` (36 variantes), `skill-tooltip.cjs` (36 × 4 slots), `empurra.cjs`, `ponte-travessia.cjs`, `simulacao-perfil.cjs`, `skill-slot4.cjs` e `rodada2.cjs` (**257 verificações**). `npm run test:rapido`: **42 passaram, 0 falharam**.
