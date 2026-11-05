# Qualidade

## Portões de integração
1. Diff revisado pelo PDM (escopo, padrão, sem texto fixo extra na UI, sem mobile).
2. `cd cavaleiros && npm run test:rapido` verde na worktree do agente.
3. Após merge no branch do ciclo: `npm test` completo (inclui `simulacao.cjs`, ~2–3 min) verde.
4. Jogo carrega no navegador (`node cavaleiros/server.js`, :8080) sem erro no console.

## Linha de base
| Data | Commit | Testes | Observação |
|---|---|---|---|
| 2026-10-30 | 10adb93 | 23/23 (simulação 139 s) | menu carrega sem erro no console |

## Métricas de performance
`?bench=1` registra draw calls, triângulos, memória e tempos do quadro. `?perfil=1` separa tempos em ms/quadro da contagem de draws de sombra por quadro. Amostra exploratória em 2026-11-05: após limitar cada inimigo a uma malha de sombra, o trecho da fase 12 caiu de 450,6 para 292 draws de sombra/quadro e de 12,6 para 2,95 ms de sombra/quadro. O teste posterior sofreu throttling de rAF a 1 Hz e tinha 3 unidades vivas a menos; não usar FPS nem esses tempos como comparação final. Falta repetir com o benchmark realmente em primeiro plano e a mesma carga.

Em 2026-11-05, rodei o benchmark visivelmente no navegador embutido, fase 12, alvo de 40 inimigos, quatro heróis Nv3, habilidades automáticas e viewport 1023×719. Em alta qualidade, sombra 1024 px e pixel ratio 1,5 registraram 21,7 FPS, callback de 34,42 ms e sombra de 9,9 ms/quadro (347 draws). Outras amostras em alta foram: sombra 512/pixel ratio 1,5, 19 FPS; sombra 2048/pixel ratio 1,5, 17,6 FPS; sombra 1024/pixel ratio 1, 16,9 FPS. Em baixa qualidade, pixel ratio 1 e sem sombras, uma amostra registrou 27,9 FPS e callback de 24,62 ms. A variação e o aviso de FPS baixo impedem atribuir o resultado à resolução. Não alterei os padrões gráficos. O benchmark aceita `pixelratio=1|1.25|1.5` e `sombra=512|1024|2048`; resta repetir várias vezes em Chrome com aceleração e carga estáveis antes de definir uma linha de base comparável.
