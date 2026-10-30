# Progresso

## Ciclo 1 — 2026-10-30 (branch `pdm-ciclo-1`, nada enviado ao remoto)
Análise: 4 agentes Explore (heróis/combate, campanha/Jornada, Reino, tecnologia/VFX/UI) → `AI_BACKLOG.md` (50 itens).
Linha de base: 23/23 testes; jogo carrega sem erro.

### Integrado
| Entrega | Backlog / pedido | Observação |
|---|---|---|
| Zoom da roda vence o enquadramento automático (mín. 8) | pedido do usuário | feito pelo PDM |
| VFX: faísca no corpo a corpo, hit-stop no crítico, queda/volta de herói, morte de chefe, reduced-motion | 12, 13, 14, 16 | |
| Reino: ondas pela dificuldade, guarda pelo nº da onda, reparo, demolição, pop do herói caído | 10, 11, 17, 18 | |
| UI: glifos Engenheira/Domador/Oráculo, números de dano somados, esquiva própria, menos texto | 6, 15, 46 | |
| Testes: mira, colisão, dicas de skill, zoom | 45 | |
| Reino: mercado, dificuldade própria + recordes, ataque-movendo e patrulha | 21, 22, 33 | |
| Campanha: dica de vitória, fase real do chefe, recorde só em objetivos com tempo, Repetir direto | 7, 8, 9, 19 | conflito com Reino resolvido |
| Combate: limiares do Pesadelo, splash Engenheira/Oráculo, Ninja, `controlEnemy` com retorno decrescente em chefes | 1–5 | Pesadelo 8/10 → 5/10 na sim |
| Visual: fera do Domador nova, Engenheira/Domador/Oráculo com receita, variantes.html com todos | pedido do usuário | |
| Barra de skills: retrato + anel de vida + 4 botões; rastro de dano | 47, 48 + pedido | |
| Reino: objetivos guiados | 34 | |
| Sinergias por estado + 5 duplas novas, ícones na escolha | 24 | |
| Física: fim do empurra-empurra (contato, plantado, contorno) | pedido do usuário | teste `empurra.cjs` |
| Performance: pools, sombra estável, pixel ratio 1,5, esqueletos fundidos, cenário em lotes | 39, 40 + FPS | draw calls 907→714 |
| Heróis novos: Brutamontes e Invocador | pedido do usuário | |
| Mapa da campanha 3D low poly com posições geradas | 37 + pedido | |
| 4ª habilidade para os 27 heróis (teclas Z X V B; R no controle direto) | pedido do usuário | |
| Inimigos: Besteiro Venenoso, Bruxa de Ossos, fúria do Rei | 28 (parcial), 29 | |

| 4ª habilidade do Brutamontes (Muralha) e do Invocador (Fúria do Bestiário) | pedido do usuário | |
| Barra de skills: retrato 88px + 4 skills em 2×2 | pedido do usuário | feito pelo PDM |
| Mapa da campanha: maior, selos numerados, ←/→, faixa de capítulos, mais detalhes | pedido do usuário | |
| Mapa de batalha: decoração por bioma/fase e ambiente animado | pedido do usuário | |
| Tela de loading animada + pré-aquecimento de shaders/modelos | pedido do usuário | 1º quadro 85→14 ms |
| Balanceamento pós-4ª skill (60 partidas/dificuldade) | — | Fácil 100%, Normal 92%, Difícil 72%, Pesadelo 38% |
| Assets KayKit FREE (CC0) baixados: Adventurers 2.0, Animations 1.1, Skeletons 1.1, Weapons, Forest, Dungeon | pedido do usuário | `assets/kaykit/` |
| Esqueletos 1.1 com animações especiais e flecha quebrada | — | −8,7 MB na batalha |
| Heróis com Character Animations 1.1, Besteiro no Ranger 2.0, arco pronto | — | menu 22→12 MB |
| Cenário com Forest/Dungeon (batalha, campanha, salão do trono) | — | +10–25% triângulos |
| Fada, golem e dragãozinho do Invocador refeitos | pedido do usuário | `summon-models.js` |
| Brutamontes 1,6× | pedido do usuário | |

### Parado de propósito (voltam ao backlog)
- Jornada variada + salvar run (35); sequência de vitória/derrota (49) — interrompidos para entregar mais rápido.

### Pendências / próximo ciclo
- FPS: fase 6 com ~57 ms de envio por quadro no bench (anômala); fase 2 com ~670k triângulos. Medir com a máquina livre.
- Medir as 18 missões da campanha com o balanceamento novo (só a Ponte foi medida).
- Estrelas duplicadas no mapa da campanha (selo + estandarte 3D); câmera no fim da estrada mostra só 3 missões.
- Reino: abrir e jogar até a 1ª onda com esqueletos 1.1; mapa do Reino ainda é criado depois da tela de loading.
- Arquivos antigos `assets/Skeleton_Minion|Warrior|Rogue.glb` (14,5 MB) não são mais usados — remover.
- Brutamontes e Duelista abaixo da média de vitória.
- Backlog parado: Jornada variada/salvar run (35), sequência de vitória/derrota (49).
- `tests/camera-wheel-fit.cjs` depende de CRLF no main.js (frágil).
