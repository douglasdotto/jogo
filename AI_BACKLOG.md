# Backlog priorizado

Legenda: esforço P/M/G · risco B/M/A · área. Referências `arquivo:linha` são do commit 10adb93 (podem ter mudado).
Fora de escopo por decisão do usuário: qualquer trabalho de mobile/toque.
Modo Reino REMOVIDO do jogo por decisão do usuário: itens 10, 11, 17, 18, 21, 22, 30–34 cancelados.

## P0 — bugs e correções de base
| # | Item | Área | Esf/Risco | Onde |
|---|---|---|---|---|
| 1 | Limiares de dificuldade inalcançáveis (`>=1.25`, `>1.2` com max 1.18): Golem aleatório, 3 crânios e limite de sacerdotes nunca valem | Combate | P/B | monsters.js:413,895,896,901,934 |
| 2 | Engenheira e Oráculo herdam `splash` 1.4 do Mago (maior área do jogo) | Heróis | P/B | main.js:48,106,110,112 |
| 3 | Ninja contado como "À distância" na cobertura de equipe | Heróis | P/B | class-info.js:45 |
| 4 | `rootT`/`slowT` sobrescritos em vez de `Math.max` | Combate | P/B | main.js:4981,2937 |
| 5 | Chefes podem ficar travados em atordoamento (sem resistência a controle) | Combate | M/M | main.js, monsters.js:847 |
| 6 | `SKILL_GLYPHS` sem engineer, beast_tamer, oracle (+ teste que exija glifo de toda variante) | UI | P/B | main.js:1567 |
| 7 | Dica de vitória descartada no relatório; fallback diz "24 estrelas" (máx 54) | Campanha | P/B | stats.js:121, battle-report.js:140 |
| 8 | `BOSSES` sem DarkKnight; cálculo da fase de chefe `ceil(f/6)*6` frágil | Campanha | P/B | campaign.js:667, main.js:7539, battle-report.js:74 |
| 9 | Recorde de tempo gravado em objetivos de duração fixa (defend, breach, survive, hunt) | Campanha | P/B | main.js:7639 |
| 10 | Reino: `D.interval` ignorado, `/1.1` encolhe ondas, guarda do portal cresce por relógio e não por onda | Reino | P/B | kingdom.js:44,52,767 |
| 11 | Reino: herói morto ocupa pop; obra destruída não devolve nada; relógio mostra 2:00 com onda aos 3:00 | Reino | P/B | kingdom.js:73,316,1003 |

## P1 — diversão e feedback de alto impacto
| # | Item | Área | Esf/Risco | Onde |
|---|---|---|---|---|
| 12 | Faísca/corte + mini hit-stop no ataque corpo a corpo e no crítico | VFX | P/B | main.js:2159-2172,2355 |
| 13 | Morte de chefe com slow-mo, shake e explosão de luz | VFX | P/B | main.js:7507 |
| 14 | Queda e revive de herói com efeito próprio | VFX | P/B | main.js:2078,5565 |
| 15 | Números de dano: somar ticks, limitar, esquiva ≠ cura, dano maior que cura | UI/VFX | M/B | pop-text-pool.js, main.js:2018,3211, index.html:40 |
| 16 | Shake/hit-stop respeitando `prefers-reduced-motion` | VFX | P/B | main.js:4439 |
| 17 | Reino: reparar prédios com aldeão | Reino | P/B | kingdom.js:168,925 |
| 18 | Reino: demolir prédio com devolução parcial | Reino | P/B | kingdom.js |
| 19 | "Repetir" com mesma equipe e dificuldade; botão da Jornada que diz "Jogar de novo" mas volta ao menu | Campanha/UI | M/B | main.js:6776,7867,7909 |
| 20 | Assinaturas iguais ao ataque básico (Besteiro, Piromante, Criomante) | Heróis | P/M | main.js:2905-2960 |
| 21 | Reino: fim do ouro trava o jogo (mercado/troca) | Reino | M/M | kingdom.js |
| 22 | Reino: escolha de dificuldade própria + recorde/estrelas com recompensa na campanha | Reino | M/M | kingdom.js, main.js:777 |

## P2 — profundidade
| # | Item | Área | Esf/Risco | Onde |
|---|---|---|---|---|
| 23 | Sistema de passivas por herói (dados + painel) | Heróis | M/M | main.js, skillbook.js, stats.js |
| 24 | Mais sinergias e regras consistentes (fonte da lentidão, guarda) | Heróis | M/B | synergies.js, main.js:2271 |
| 25 | Rotas de evolução específicas por herói; usar `skillPower`/`controlPower` mortos | Heróis | G/M | upgrade-branches.js, main.js:1301 |
| 26 | Rebalancear DPS (Assassino/Monge vs Alquimista/Arqueira/Engenheira) com simulação | Heróis | M/M | main.js:43-114, tests/simulacao.cjs |
| 27 | Curva da campanha: Ruínas pesada demais, níveis caindo após Duelo, Lago Sombrio antes do Cemitério | Campanha | M/M | campaign.js:16-35 |
| 28 | Chefes repetidos: mecânicas novas (fúria do Rei) e menos Carrasco fora de missões de chefe | Campanha | G/M | monsters.js, main.js:6843 |
| 29 | Inimigos com ameaças variadas aos heróis (veneno, lentidão) | Combate | M/M | monsters.js |
| 30 | Reino: pesquisas/eras (ferraria, universidade) — backlog Reino v2 | Reino | G/M | kingdom.js |
| 31 | Reino: novas unidades com contra-ataques — backlog Reino v2 | Reino | G/A | kingdom.js |
| 32 | Reino: portão, sino da vila, torre melhorada — backlog Reino v2 | Reino | M/A | kingdom.js, kingdom-world.js |
| 33 | Reino: ataque-movendo / patrulha | Reino | M/B | kingdom.js:906 |
| 34 | Reino: tutorial e objetivos guiados | Reino | M/B | kingdom.js, tutorial.js |
| 35 | Jornada: semente variável/modificadores, salvar run entre fases | Campanha | G/M | main.js:886 |
| 36 | Narrativa: antagonista "necromante" x Lich; tela curta por capítulo | Campanha | M/B | campaign.js |
| 37 | Mapa da campanha com posições geradas (hoje 18 fixas, missão 19 quebra) | Campanha | M/B | campaign.js:701 |
| 38 | Farm de ouro repetindo a Vila | Economia | P/M | progression.js:123 |

## P3 — técnica e manutenção
| # | Item | Área | Esf/Risco | Onde |
|---|---|---|---|---|
| 39 | Pools: `glow()`, `waterSplash`, material da queimadura, clones da torreta/`fireBolt` | Perf | M/B | main.js:2868,2927,3048,3137,3311 |
| 40 | Sombra alinhada à grade de texels, pixel ratio ≤1.5; medir com `?bench=1` | Perf | P/B | main.js:226-230,7994 |
| 41 | Remover CSS mobile morto e consolidar CSS inline no battle-hud.css | UI | M/M | index.html, battle-hud.css, campaign.css |
| 42 | Extrair dados de heróis e física de main.js (ajustar marcadores dos testes) | Arquitetura | M/M | main.js, tests/* |
| 43 | Extrair biblioteca de FX (~1400 linhas) | Arquitetura | G/M | main.js:3148-4554 |
| 44 | Centralizar `keydown` (Esc tratado em 3 lugares) | Arquitetura | M/M | main.js |
| 45 | Testes: mira, skillTooltip, collisionMove | QA | M/B | tests/ |
| 46 | Menos texto: controle direto vira chip com tooltip; tirar "Cancelar mira"; popups de sinergia viram ícone | UI | P/B | index.html:690, main.js:6463,8112,2277 |
| 47 | Barra de skills: mini-retrato com anel de vida no lugar do nome | UI | M/B | main.js:1591 |
| 48 | Barra de vida com rastro de dano atrasado | UI | P/B | main.js:1910, index.html:195 |
| 49 | Vitória/derrota com sequência curta (slow-mo, câmera, Cheer) | VFX | M/B | main.js:7794,7844 |
| 50 | Predicado "inimigo urgente" copiado em 5 lugares | Arquitetura | P/B | main.js:2596,2734,4810,4975,5028 |
