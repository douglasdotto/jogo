# Agentes

Agentes reais (Claude Code `Agent`, worktree isolada por tarefa). Estado atualizado pelo PDM ao delegar e ao integrar.

| Papel | Escopo | Ciclo 1 | Estado |
|---|---|---|---|
| Gameplay/Hero Designer | combate, heróis, balanceamento | Backlog 1–5 | em andamento |
| Animation & VFX | feedback de golpe, chefe, queda/revive | 12, 13, 14, 16 | em andamento |
| UI/UX | HUD, glifos, números de dano, menos texto | 6, 15, 46 | em andamento |
| Kingdom Designer | modo Reino | 10, 11, 17, 18 | em andamento |
| Campaign Designer | missões, fim de partida | 7, 8, 9, 19 | em andamento |
| Performance Engineer | pools, sombras | 39, 40 | em andamento |
| QA Engineer | papel do PDM: `npm test` em cada worktree e no branch integrado | — | contínuo |
| Game Analyst | agentes Explore de análise no início de cada ciclo | análise inicial | concluído |

Regras para todo agente: menor mudança que resolve; seguir padrão vizinho; sem dependências; desktop só; pouco texto na UI; rodar `npm run test:rapido` (e `npm test` se mexer em balanceamento); commitar na própria worktree; não tocar arquivos fora do escopo.
