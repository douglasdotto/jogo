# AI PDM — Age of Popozitos

Missão: evoluir o jogo em ciclos (analisar → priorizar → delegar → implementar → testar → integrar → repetir), sem perder identidade, estilo e mecânicas centrais.

## Como retomar numa sessão nova
1. Ler `AI_PROGRESS.md` (último ciclo), `AI_BACKLOG.md` (próximos itens) e `AI_QUALITY.md` (como validar).
2. Conferir o estado real: `git log --oneline -15`, `git status`, `cd cavaleiros && npm test`.
3. Retomar itens "Em andamento" só depois de confirmar no código o que já entrou.

## Coordenação
- Cada ciclo roda num branch `pdm-ciclo-N` saído da `main`; nada vai para `main` nem para o remoto sem pedido do usuário.
- Tarefas independentes vão para agentes em worktrees isoladas (`isolation: worktree`), um agente por conjunto de arquivos.
- Agentes que mexem no mesmo arquivo grande (`main.js`) só em paralelo se as regiões forem disjuntas; o PDM resolve conflitos no merge.
- Integração: revisar diff → `npm test` no branch do ciclo → merge `--no-ff` → registrar em `AI_PROGRESS.md`.

## Regras fixas do usuário
- Só desktop: nada de layout/toque mobile.
- UI com pouco texto: ícones, números, rótulos de 1–3 palavras; detalhe só em tooltip.
- Menor mudança que resolve; seguir o padrão do código vizinho; sem dependências novas.
- Sem push, deploy ou ação destrutiva sem confirmação.

## Arquitetura (resumo)
- Jogo de navegador em Three.js, sem build: `cavaleiros/index.html` carrega módulos ES; `server.js` serve em :8080.
- `main.js` (~8,4 mil linhas): heróis, combate, HUD, fluxo de jogo. `monsters.js`: inimigos e chefes. `skillbook.js`: técnicas e ultimates. `campaign.js`: 18 missões (modo Reino removido por decisão do usuário; `village-models.js` guarda só as casas/castelo do mapa da campanha). `progression.js`: ouro, maestria, oficina.
- Testes em `cavaleiros/tests/` (Node puro, `npm test`; `simulacao.cjs` leva ~2–3 min).

## Limitações reais
- Não há execução contínua sem o usuário: cada ciclo roda numa sessão ativa. Para continuar, o usuário pede "próximo ciclo" (ou usa `/loop`).
- Agentes não testam no navegador; validação visual é feita pelo PDM quando o ciclo pede.
