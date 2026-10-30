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

### Em andamento
- 4ª habilidade do Brutamontes e do Invocador (testes de 4 skills falham até entrar).

### Parado de propósito (voltam ao backlog)
- Jornada variada + salvar run (35); sequência de vitória/derrota (49) — interrompidos para entregar mais rápido.

### Pendências de verificação
- Simulação completa depois de 4ª skill + física + inimigos (agentes pularam a sim por pedido de velocidade).
- Visual no navegador: criaturas do Invocador, Brutamontes, mapa 3D, inimigos novos, tutorial do Reino.
- `tests/camera-wheel-fit.cjs` depende de CRLF no main.js (frágil).
