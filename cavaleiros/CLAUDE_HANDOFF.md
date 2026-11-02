# Passagem de trabalho para o Claude

Atualizado em 2026-11-01. Tudo está commitado na `main` local; **nada foi publicado (sem push)**. `npm test` completo: 41/41. Preferências do usuário: UI simples, bonita, "cara de joguinho", pouco texto; só desktop; sem cópias com pouca mudança de herói.

## O que já está na main

- **Aviso de FPS baixo**, culling de animação fora da tela e menos alocações por quadro.
- **Campanha com equipe contínua:** equipe de 4 salva em `localStorage` `cavaleiros-time-campanha` (`{id, xp, branches}`); toda missão começa com a equipe inteira (Duelo usa 1). XP/evoluções gravam só na vitória. "Próxima" e "Repetir" abrem a tela da equipe (Seguir / marcar quem sai / Trocar N); quem entra no lugar herda o nível de quem saiu e o jogador distribui as evoluções (ou o jogo escolhe se "Evolução: automática"). Primeira vez na Campanha vai à missão 1. Flag `campaignTeamRun` só liga via mapa/Próxima/Repetir.
- **Heróis:** 36 (7 novos: Vampira, Lanceiro, Cozinheira, Xamã dos totens, Geomante, Ilusionista, Rúnica dos escudos), 144 habilidades. Níveis 1–5 (Nv4–5 reusam retrato/nome do Nv3 com moldura; +15% vida/dano; habilidades param de melhorar no Nv3, `skillLevel`). Equilíbrio ajustado (Brutamontes, Ninja, Berserker, Duelista reforçados; Invocador, Clériga, Paladino freados).
- **Campanha:** 24 missões (Cap. VIII "A última brasa"), Santuário antes da Ponte. Recalibrada: `XP_LEVELS` `[0,90,600,1600,2700]`, `PARTY_SCALE.level` 0,08/`levelMax` 1,15, `foeScale` por missão nas finais.
- **IA:** vagas em anel (sem empurra-empurra), herói ocioso caça o último inimigo, guarda da escolta ataca a 10 m do protegido, atiradores esqueleto param de recuar sem fim, resgatado foge e sai de cena, inimigo trancado volta pelo spawn (`reapStuckEnemies`), fase não espera posto bloqueado (`ADVANCE_WAIT`).
- **Visual:** cenário mais rico (acampamentos, tochas com halos, ruínas, árvores secas), efeitos de habilidade com menos brilho e no raio real, dragão do Invocador 1,9× e a 4,4 m, ultimate do Necromante (Exército dos Mortos), chapéu do Besteiro e presas da Vampira, tela de vitória enxuta com heróis comemorando.
- **Modo Teste:** botão no menu ao lado de Batalhar; arena com ondas crescentes, horda/chefe extras, resumo por herói; não grava nada.

## Parado em 2026-11-01 (3 agentes interrompidos a pedido do usuário; nada perdido, só incompleto)

Já na main e testado: 9 habilidades novas dos Magos, Slime Saltitante (Invocador), correção da ponte (muro do rio, rota pela ponte, destravador), reforço do Bardo, chapéu de caçador do Besteiro, defesa do Santuário, alcance dos totens do Xamã, correções de uso de Guerreiros/Bárbaros/Ladinos, Torta quente maior. `npm run test:rapido` 41/41.

**Interrompidos** (trabalho parcial, possivelmente incompleto, em `worktree-agent-*` dentro de `.claude/worktrees/`):
- Suporte (`worktree-agent-adfd70776542ad9ab`): Voto de Proteção (Clériga), Veneno Aderente (Alquimista), Eclipse Rubro (Vampira), Prato do Dia (Cozinheira), Espírito Acompanhante (Xamã). Estava atualizando o teste do Alquimista.
- Guerreiros/Bárbaros (`worktree-agent-a697a311fd529ffaf`): Escudo Ricochete (Guardião), Decreto de Marcha (Rei), Berro de Guerra (Brutamontes), Caçada em Matilha (Domador). Havia 1 falha no teste rápido ainda não investigada.
- Ladinos (`worktree-agent-a0581eb99f907f5d4`): Desarmar (Duelista), Pânico e Ofuscar (Ilusionista) e ultimates de área dos ladinos só com 3 ou mais inimigos. Estava ajustando skillbook.js.

Para retomar: listar as branches `worktree-agent-*`, ver `git log main..<branch>` e o `git status` dentro de cada worktree; se estiver bom, `git merge --no-ff <branch>` (conflitos de lista: manter as duas partes); senão, reaproveitar o texto acima como especificação.

Descartadas de propósito (não reimplementar): Brasa Contagiosa, Orbe Arcano, Maré de Ossos, Ninhada, Vínculo do Bestiário, Hora Congelada, Casulo de Espinhos, Hera Perseguidora, Sentença Luminosa, Névoa Rosa, Sede Compartilhada, Mordida Venenosa, Selo do Grupo, Segunda Chance, Pisão Sísmico, Rondó de Aço, Virotes Incendiários.

Também pendente: auditar Geomante e Lanceiro; confirmar a ponte no jogo real; testar a tela de evolução pré-missão, o Repetir e a prisioneira; **push** para o `origin` (GitHub douglasdotto/jogo, main ~60 commits à frente): confirmar com o usuário antes, pode disparar deploy do Pages.

## Pendências (nada disso foi visto no jogo, só nos testes)

1. **Testar do zero no navegador** (o usuário pediu para esperar os ajustes; usar uma aba/origem sem o progresso dele, nunca limpar o `localStorage` da aba dele). Conferir: visual dos 6 heróis novos, tela de evolução antes da missão, modo Teste, efeitos de habilidade, cenário em batalha, tela de vitória.
2. Modo Teste só oferece Nv1–3; falta Nv4–5 e remover um herói isolado da equipe.
3. Equipes sem tanque/curandeiro travam nas missões 10–24 (3–5 tentativas); a tela da equipe já avisa o papel que falta.
4. Heróis atravessando o mapa para caçar o último inimigo podem parecer abruptos; se incomodar, limitar a distância (`heroFreeHunt`).
5. Medir FPS com `?bench=1&inimigos=80`.
6. Ideias de herói ainda não pedidas: Escudeiro (Cavaleiro, divide o dano de um aliado), Xamã de guerra (Bárbaro), Bruxo (Mago, dano ao longo do tempo), Artífice, segundo Domador. O Caçador de recompensas foi descartado (cópia da Arqueira) e o Mago de raios repete o Arcano.

## Como integrar trabalho de agentes

Branches `worktree-agent-*` (dezenas, antigas). Usar `git merge --no-ff <branch>` e resolver conflitos mantendo as duas partes nas listas aditivas. Contagens de heróis nos testes são derivadas de `t.VARIANTS.length`; `LOOK_PREVIEW` deve seguir a ordem de `VARIANTS`. Testes carregam só trechos de `main.js`: não repetir `const` no mesmo escopo (ex.: `TAU`) e manter lógica de herói fora da região de FX.
