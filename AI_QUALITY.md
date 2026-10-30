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
`?bench=1` registra draw calls e triângulos (bench.js). Ainda sem medição registrada — fazer antes/depois do item 39/40.
