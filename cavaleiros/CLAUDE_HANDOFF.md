# Passagem de trabalho para o Claude

Atualizado em 2026-11-01. Nada commitado nem publicado. Preferências: UI simples, bonita, "cara de joguinho", pouco texto; só desktop.

## Aviso de FPS

Concluído. `npm test` completo passou 41/41.

## Campanha com equipe contínua

Implementado em `main.js` + `campaign.css`; testes em `tests/rodada2.cjs`.

- Equipe de 4 salva em localStorage `cavaleiros-time-campanha` (`{id, xp, branches}`).
- Toda missão começa com a equipe inteira. Duelo (`goal.type 'duel'`) usa 1 escolhido.
- Herói novo entra no nível 1 (exceto a primeira montagem de save antigo sem equipe, que entra no nível da missão).
- XP/evoluções gravam só na vitória; a composição grava ao começar.
- "Próxima" mantém a dificuldade e abre a tela da equipe: Seguir/Enter, clicar marca quem sai, "Trocar N". Mostra papéis e "Falta: …" quando a equipe não cobre o que a missão pede. Aparece sempre que houver missão seguinte liberada.
- Primeira vez na Campanha vai direto à missão 1.
- Flag `campaignTeamRun` liga o modo só via mapa/Próxima/Repetir; simulações e testes com `setMission` seguem o fluxo antigo.

## Tela de vitória

Refeita (`battle-hud.css`, `progression.js` rewardHTML, `main.js` endTeamLevels/missionNextHTML): cartão de uma coluna, chips numa fileira, retratos com nível e barra de XP. O usuário pediu "ajustar mais" e ainda não disse o quê — pedir print.

## Integrado

- Performance: culling de animação fora da tela/sombra; menos alocações em flechas inimigas e recuo.
- Cenário mais rico (`world.js`/`scenery-assets.js`): acampamentos, tochas com halos, ruínas, estandartes, árvores secas. Visto rapidamente no fundo do menu (fase 10), sem erro no console; falta ver em batalha. Revisão apontou, ainda sem correção:
  1. Halos (tochas da estrada ~world.js:2298, tochas de parede do castelo ~2397, velas do cemitério ~2388, `torch_mounted` da vila ~1158) entram antes do modelo; se o pacote falhar, ficam brilhos sem tocha.
  2. `preloadSceneryProps` (scenery-assets.js:89-93) faz `a && b` e `buildKitProps` exige todos os modelos (inclusive `torch_mounted` do pacote dungeon): uma falha parcial, ou o mundo do menu criado antes do pacote, apaga todos os enfeites. Montar por item.
  3. Halo da tocha da vila ignora `heightAt` do terreno.
  4. `buildKitProps` quebra se um modelo vier sem atributo `normal`.
- Correções da revisão da equipe contínua já aplicadas (Enter segue, ramo inválido cai no automático, quem sai e volta não perde XP, `?tudo=1` não força a missão 1). Ficou: a sugestão "Equipe anterior" na troca pode apontar o herói que saiu.
- Ao terminar uma missão em modo de teste, a faixa "Modo de teste · não salva" fica sobre o logo do menu (preexistente).

## Em andamento (worktrees, branches `worktree-agent-*`)

- IA dos bonecos: sem empurrões; herói ocioso ataca o inimigo mais próximo na tela; em missões de proteger 1 guarda fica e o resto caça; atiradores atiram de onde estão; sem inimigos, param perto de onde lutaram.
- Equilíbrio das missões pelo tamanho real do grupo.
- Capítulo VIII com 3 missões.
- Níveis 4 e 5 dos heróis (Nv4–5 reusam retrato/nome do Nv3 com moldura).

Ao integrar: ver `git branch --list "worktree-agent-*"` e `git log main..<branch>`; aplicar com `git diff main...<branch> > x.patch && git apply x.patch` (o checkout tem mudanças não commitadas, então merge direto não serve). As branches de performance (`worktree-agent-ab92af74502065ae7`) e cenário (`worktree-agent-aa16978e67407299d`) já foram aplicadas — não reaplicar. Depois, `git worktree remove` das worktrees em `.claude/worktrees/`.

## Pendências

1. Integrar as 4 branches — IA `worktree-agent-a83c5fdcfbca6046e`, equilíbrio `worktree-agent-a95240f5da46fdc61`, Capítulo VIII `worktree-agent-a1cc2cad9d5197ffc`, níveis 4–5 `worktree-agent-aea9a2b0473b27d07` (há dezenas de branches `worktree-agent-*` antigas; use só estas). Os agentes podiam ainda estar rodando quando a sessão parou: confira se cada branch tem commits antes (IA pode conflitar com níveis 4–5 na classe Hero; equilíbrio e IA mexem em `main.js`).
2. Corrigir os 4 achados do cenário acima.
3. `npm test` completo.
4. Conferir no navegador: cenário, tela de vitória, IA na Ponte.
5. Medir FPS com `?bench=1&inimigos=80`.
