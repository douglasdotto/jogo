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

### Pendente de conferir na tela
- Dragão de Ossos, inimigos e região de cinzas do Capítulo VII; aura Asas do Dragão.
- Fases 3/7/10 sem morros; faíscas/esqueletos otimizados; câmera do menu → missão.
- Telas sem PNG da limpeza: Evolução, fim de partida, botão "Pular" do tutorial.
- Estrelas duplicadas no mapa da campanha.

### Próximo ciclo (sugestões)
- Medir FPS com a máquina livre (`?bench=1&fases=2,6,10,12&perfil=1`).
- Simular as 21 missões com grupo aleatório; ajustar a curva se preciso.
- Remover `assets/Skeleton_Minion|Warrior|Rogue.glb` antigos (14,5 MB sem uso).
