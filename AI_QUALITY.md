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
