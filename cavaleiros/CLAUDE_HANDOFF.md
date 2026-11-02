# Passagem de trabalho para o Claude

Atualizado em 2026-11-02. Tudo está commitado na `main` local. **Nada foi publicado: a main está cerca de 80 commits à frente do `origin` (GitHub douglasdotto/jogo). Confirmar com o usuário antes do push (pode disparar o deploy do Pages).** Preferências do usuário: UI simples, bonita, "cara de joguinho", pouco texto; só desktop; sem heróis que sejam cópia com pouca mudança; menos brilho nos efeitos de habilidade; gastar poucos tokens.

## Estado atual (na main, testado: `npm run test:rapido` 41/41 e suíte completa)

- **Campanha:** 24 missões (Cap. VIII "A última brasa"), Santuário antes da Ponte; equipe contínua de 4 (XP/evoluções entre missões, Próxima e Repetir abrem a tela da equipe, quem entra herda o nível de quem saiu); recalibrada (`XP_LEVELS` `[0,90,600,1600,2700]`, `PARTY_SCALE`, `foeScale` nas missões finais).
- **Heróis:** 36, 4 habilidades cada, níveis 1–5 (habilidades param de melhorar no Nv3). Grupos: Guerreiros 6, Bárbaros 6, Magos 8, Ladinos 8, Suporte 8.
- **Habilidades (auditadas por classe):** habilidades fracas trocadas por mecânicas novas; ultimates auditadas e reforçadas/trocadas (Paladino: Legião de Luz com mini-paladinos; Rei: Julgamento Dourado; Berserker: Fúria Titânica; Crusher: Cataclismo; Oráculo, Cronomante, Duelista, Besteiro, Arqueira, Assassino, Alquimista, Rúnica reforçados). **Bardo virou o Apostador (Ladino, id `bard`)**: cartas, naipes, dados, All-in, Blefe.
- **IA:** vagas em anel, herói ocioso caça o último inimigo, guarda da escolta e defesa do Santuário (grupo fica em volta do cristal), inimigo trancado ou fugindo sem fim volta pelo spawn (`reapStuckEnemies`), `ADVANCE_WAIT`, destravador de unidades (`pushT`) e correção da ponte (muro do rio, rota pela ponte).
- **Visual:** cenário mais rico, efeitos de habilidade sem brilho aditivo grande e no raio real, dragão do Invocador 1,9× e a 4,4 m, Slime Saltitante (Invocador), chapéu de caçador do Besteiro, presas da Vampira, tela de vitória enxuta, modo Teste (botão no menu).

## Pendências (nada disso foi visto no jogo real, só em testes)

1. **Conferir no navegador** (usar a porta 8081 = origem sem o progresso do usuário; nunca limpar o `localStorage` dele): visual dos heróis novos, Legião de Luz, Apostador, efeitos das ultimates trocadas, tela de evolução antes da missão, Repetir, prisioneira do Resgate, modo Teste, ponte em Chamas/Santuário.
2. Auditar o **Geomante** e o **Lanceiro** (ficaram fora das auditorias de habilidades; as ultimates deles foram avaliadas e estão boas).
3. Medir o **Apostador** numa amostra maior (Δ de vitória vs. o −4,2 do Bardo antigo) e ajustar números se preciso.
4. Equilíbrio geral: re-medir os heróis (a medição de 1800 partidas é anterior às habilidades/ultimates novas); equipes sem tanque/curandeiro travam nas missões 10–24 (aceito, a tela da equipe avisa).
5. Modo Teste só oferece Nv1–3 e não remove um herói isolado da equipe.
6. Medir FPS com `?bench=1&inimigos=80`.
7. Ideias de herói ainda não pedidas: Escudeiro (Cavaleiro), Xamã de guerra (Bárbaro), Bruxo (Mago), Artífice, segundo Domador. Descartadas: Caçador de recompensas (cópia da Arqueira) e Mago de raios (repete o Arcano).
8. Código morto da antiga Fúria do Bestiário (`frenzyT`/`frenzyHaste`, aura de fúria, `fairyTrail(fury)`) e ramo `frost-ward` dentro do `case 'ward'`.

## Como integrar trabalho de agentes

Branches `worktree-agent-*` (dezenas, antigas, já integradas; usar `git branch --list "worktree-agent-*"` e `git log main..<branch>` para ver se há algo novo). Mesclar com `git merge --no-ff <branch>` e resolver conflitos mantendo as duas partes nas listas aditivas. Os arquivos são CRLF: editar com script node ou a ferramenta de edição, nunca `sed -i`. Contagens de heróis nos testes são derivadas de `t.VARIANTS.length`; `LOOK_PREVIEW` segue a ordem de `VARIANTS`. Testes carregam só trechos de `main.js`: não repetir `const` no mesmo escopo e manter a lógica de herói fora da região de FX. `tests/run-terrain.mjs` fatia o texto de `moveTo`: não mudar a assinatura.
