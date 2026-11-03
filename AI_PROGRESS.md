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
