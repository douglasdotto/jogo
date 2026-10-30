// node tests/campaign-storage.cjs — progresso funciona quando o armazenamento falha.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'campaign.js'), 'utf8').replace(/^export /gm, '');
function loadCampaign(localStorage) {
  const context = vm.createContext({ URLSearchParams, location: { search: '' } });
  if (localStorage) context.localStorage = localStorage;
  vm.runInContext(`${source}\nthis.api = { MISSIONS, starsOf, unlocked, totalStars, saveStars, missionRecords, saveMissionRecord, missionMedal, saveMissionMedal, campaignCosmetics, equippedCampaignCosmetic, equipCampaignCosmetic, campaignStorageIsVolatile, campaignStorageWasCorrupted, campaignCorruptBackupFailed };`, context);
  return context.api;
}

function assertSessionProgress(api) {
  assert.equal(api.saveStars('vila', 2), true);
  assert.equal(api.starsOf('vila'), 2, 'estrelas novas continuam disponíveis na sessão');
  assert.equal(api.unlocked(1), true, 'o progresso da campanha libera a próxima missão');
  assert.equal(api.totalStars(), 2);

  assert.equal(api.saveMissionRecord('vila', { won: true, difficultyId: 'normal', seconds: 123 }), true);
  assert.equal(api.missionRecords('vila')[0].seconds, 123, 'recorde fica disponível na sessão');

  const result = api.saveMissionMedal('vila', { won: true, stars: 3, difficultyId: 'dificil' });
  assert.equal(result.newBest, true);
  assert.equal(result.newChallenge.difficultyId, 'dificil');
  const medal = api.missionMedal('vila');
  assert.equal(medal.best.difficultyId, 'dificil');
  assert.equal(medal.challenges.find((challenge) => challenge.difficultyId === 'dificil').done, true);
}

assertSessionProgress(loadCampaign());
assertSessionProgress(loadCampaign({ getItem() { throw new Error('storage bloqueado'); }, setItem() { throw new Error('storage bloqueado'); } }));
const volatileApi = loadCampaign({ getItem() { return null; }, setItem() { throw new Error('quota cheia'); } });
assert.equal(volatileApi.campaignStorageIsVolatile(), false);
volatileApi.saveStars('vila', 2);
assert.equal(volatileApi.campaignStorageIsVolatile(), true, 'avisa quando a gravação das estrelas ficou só na sessão');

const stored = new Map([
  ['cavaleiros-campanha', JSON.stringify({ vila: 1 })],
  ['cavaleiros-recordes-missao', JSON.stringify({ vila: { normal: { seconds: 200 } } })],
]);
const readOnlyStorage = {
  getItem(key) { return stored.get(key) ?? null; },
  setItem() { throw new Error('quota cheia'); },
};
const api = loadCampaign(readOnlyStorage);
assert.equal(api.starsOf('vila'), 1, 'carrega o progresso que já estava salvo');
assert.equal(api.saveStars('vila', 2), true);
assert.equal(api.starsOf('vila'), 2, 'uma leitura seguinte não apaga a gravação em memória');
assert.equal(api.saveMissionRecord('vila', { won: true, difficultyId: 'normal', seconds: 123 }), true);
assert.equal(api.missionRecords('vila')[0].seconds, 123);

const cosmeticData = new Map();
const cosmeticStorage = { getItem(key) { return cosmeticData.get(key) ?? null; }, setItem(key, value) { cosmeticData.set(key, String(value)); } };
const cosmetics = loadCampaign(cosmeticStorage);
assert.equal(cosmetics.campaignCosmetics().length, 8, 'há um visual por capítulo e dois visuais de domínio');
assert.equal(cosmetics.campaignStorageIsVolatile(), false, 'storage que grava normalmente não mostra aviso');
const countedReads = new Map();
const countedStorage = {
  getItem(key) {
    countedReads.set(key, (countedReads.get(key) || 0) + 1);
    if (key === 'cavaleiros-campanha-visual') return JSON.stringify({ rulesVersion: 2 });
    return null;
  },
  setItem() {},
};
const countedCampaign = loadCampaign(countedStorage);
countedCampaign.campaignCosmetics();
assert.equal(countedReads.get('cavaleiros-campanha'), countedCampaign.MISSIONS.length, 'o cálculo de recompensas lê as estrelas de cada arena só uma vez');
assert.equal(countedReads.get('cavaleiros-medalhas-missao'), 1, 'o cálculo de domínio lê as medalhas uma vez');
const chapterCosmetics = cosmetics.campaignCosmetics().filter((cosmetic) => cosmetic.track !== 'challenge');
const challengeCosmetics = cosmetics.campaignCosmetics().filter((cosmetic) => cosmetic.track === 'challenge');
assert.deepEqual(Array.from(chapterCosmetics, (cosmetic) => cosmetic.requiredStars), [4, 3, 3, 5, 2, 1], 'cada capítulo pede uma estrela por arena');
assert.deepEqual(Array.from(chapterCosmetics, (cosmetic) => cosmetic.requiredArenas), [4, 3, 3, 5, 2, 1], 'cada capítulo acompanha arenas concluídas');
assert.deepEqual(Array.from(challengeCosmetics, (cosmetic) => cosmetic.requiredArenas), [18, 18], 'domínio 3★ agora inclui a missão final do castelo');
assert.equal(cosmetics.equipCampaignCosmetic('ossos'), false, 'não equipa visual bloqueado');
assert.equal(cosmetics.equipCampaignCosmetic('vanguarda'), false, 'desafio ainda bloqueado não pode ser equipado');
cosmetics.saveStars('vila', 3);
let firstChapterReward = cosmetics.campaignCosmetics().find((cosmetic) => cosmetic.id === 'vila');
assert.equal(firstChapterReward.completedArenas, 1);
assert.equal(firstChapterReward.stars, 3, 'estrelas extras contam para domínio do capítulo');
assert.equal(firstChapterReward.unlocked, false, '3 estrelas numa arena não compensam outras arenas sem vitória');
for (const id of ['ponte', 'santuario', 'chamas']) cosmetics.saveStars(id, 1);
firstChapterReward = cosmetics.campaignCosmetics().find((cosmetic) => cosmetic.id === 'vila');
assert.equal(firstChapterReward.completedArenas, 4);
assert.equal(firstChapterReward.stars, 6, 'as estrelas extras permanecem no total após concluir o capítulo');
assert.equal(firstChapterReward.unlocked, true, '1 estrela na primeira conclusão de cada arena libera o visual');
assert.equal(cosmetics.equipCampaignCosmetic('vila'), true);
assert.equal(loadCampaign(cosmeticStorage).equippedCampaignCosmetic().id, 'vila', 'aparência equipada persiste entre sessões');
for (const mission of cosmetics.MISSIONS.slice(0, -1)) cosmetics.saveMissionMedal(mission.id, { won: true, stars: 3, difficultyId: 'dificil' });
let vanguard = cosmetics.campaignCosmetics().find((cosmetic) => cosmetic.id === 'vanguarda');
assert.equal(vanguard.completedArenas, 17, 'a barra conta as 17 arenas anteriores concluídas');
assert.equal(vanguard.unlocked, false, 'em saves novos, a arena final também é necessária para o domínio');
assert.deepEqual(Array.from(vanguard.pendingMissions, (mission) => mission.id), ['coracao-do-castelo'], 'a missão nova aparece como pendência real');
cosmetics.saveMissionMedal(cosmetics.MISSIONS.at(-1).id, { won: true, stars: 3, difficultyId: 'dificil' });
vanguard = cosmetics.campaignCosmetics().find((cosmetic) => cosmetic.id === 'vanguarda');
assert.equal(vanguard.unlocked, true, '3★ em todas as arenas, incluindo a final, libera a recompensa');
assert.equal(vanguard.completedArenas, 18, 'a missão final aumenta o progresso do domínio');
assert.equal(cosmetics.equipCampaignCosmetic('vanguarda'), true);
for (const mission of cosmetics.MISSIONS) cosmetics.saveMissionMedal(mission.id, { won: true, stars: 3, difficultyId: 'pesadelo' });
assert.equal(cosmetics.campaignCosmetics().find((cosmetic) => cosmetic.id === 'pesadelo').unlocked, true, '3★ no Pesadelo em toda a campanha libera o cosmético próprio');
assert.equal(loadCampaign(cosmeticStorage).equippedCampaignCosmetic().id, 'vanguarda', 'equipamento de desafio persiste entre sessões');
assert.equal(cosmetics.equipCampaignCosmetic(null), true);
assert.equal(cosmetics.equippedCampaignCosmetic(), null, 'pode remover a aparência');

const oldCampaignData = new Map([
  ['cavaleiros-campanha', JSON.stringify({ vila: 3, ponte: 3 })],
  ['cavaleiros-campanha-visual', JSON.stringify({ equipped: 'vila' })],
]);
const oldCampaign = loadCampaign({ getItem(key) { return oldCampaignData.get(key) ?? null; }, setItem(key, value) { oldCampaignData.set(key, String(value)); } });
assert.equal(oldCampaign.campaignCosmetics().find((cosmetic) => cosmetic.id === 'vila').unlocked, true, 'estrelas de saves antigos continuam valendo para o visual');
assert.deepEqual(JSON.parse(oldCampaignData.get('cavaleiros-campanha-visual')).legacyUnlocked, ['vila'], 'migração preserva o visual que já havia sido conquistado pela regra antiga');
assert.equal(oldCampaign.equippedCampaignCosmetic().id, 'vila', 'visual já equipado em save antigo continua válido');
assert.equal(oldCampaign.equipCampaignCosmetic(null), true);
assert.equal(oldCampaign.equipCampaignCosmetic('vila'), true, 're-equipar preserva o entitlement migrado');

const chapterIIds = cosmetics.MISSIONS.filter((mission) => mission.chapter === 'Capítulo I · Sinais na estrada').map(({ id }) => id);
const completedChapterData = new Map([
  ['cavaleiros-campanha', JSON.stringify(Object.fromEntries(chapterIIds.map((id) => [id, 1])))],
  ['cavaleiros-campanha-visual', JSON.stringify({ rulesVersion: 2, equipped: 'vila' })],
]);
const completedChapterSave = loadCampaign({
  getItem(key) { return completedChapterData.get(key) ?? null; },
  setItem(key, value) { completedChapterData.set(key, String(value)); },
});
completedChapterSave.MISSIONS.push({ id: 'arena-extra-vila', chapter: 'Capítulo I · Sinais na estrada', name: 'Arena extra da Vila' });
const expandedChapterReward = completedChapterSave.campaignCosmetics().find((cosmetic) => cosmetic.id === 'vila');
assert.equal(expandedChapterReward.requiredArenas, chapterIIds.length + 1);
assert.equal(expandedChapterReward.completedArenas, chapterIIds.length);
assert.equal(expandedChapterReward.unlocked, true, 'a migração reconhece a conclusão da lista antiga apesar da arena nova');
assert.equal(expandedChapterReward.legacyEntitlement, true);
assert.deepEqual(Array.from(expandedChapterReward.pendingMissions, (mission) => mission.id), ['arena-extra-vila']);
assert.equal(completedChapterSave.equippedCampaignCosmetic().id, 'vila', 'o cosmético previamente equipado continua válido após a migração');
assert.equal(completedChapterSave.equipCampaignCosmetic('vila'), true, 'o cosmético migrado também pode ser equipado novamente');

const legacyChallengeMedals = Object.fromEntries(cosmetics.MISSIONS.slice(0, -1).map((mission) => [mission.id, { best: 'dificil', challenges: { dificil: true } }]));
const legacyChallengeData = new Map([
  ['cavaleiros-medalhas-missao', JSON.stringify(legacyChallengeMedals)],
  ['cavaleiros-campanha-visual', JSON.stringify({ rulesVersion: 2 })],
]);
const legacyChallenge = loadCampaign({ getItem(key) { return legacyChallengeData.get(key) ?? null; }, setItem(key, value) { legacyChallengeData.set(key, String(value)); } });
let preservedVanguard = legacyChallenge.campaignCosmetics().find((cosmetic) => cosmetic.id === 'vanguarda');
assert.equal(preservedVanguard.requiredArenas, 18, 'o requisito atualizado inclui a missão nova');
assert.equal(preservedVanguard.completedArenas, 17);
assert.equal(preservedVanguard.unlocked, true, 'a migração mantém uma recompensa conquistada sob a regra antiga');
assert.equal(preservedVanguard.legacyEntitlement, true, 'a interface identifica a recompensa preservada e a missão extra');
assert.deepEqual(Array.from(preservedVanguard.pendingMissions, (mission) => mission.id), ['coracao-do-castelo']);
assert.deepEqual(JSON.parse(legacyChallengeData.get('cavaleiros-campanha-visual')).legacyUnlocked, ['vanguarda']);
legacyChallenge.saveMissionMedal('coracao-do-castelo', { won: true, stars: 3, difficultyId: 'dificil' });
preservedVanguard = legacyChallenge.campaignCosmetics().find((cosmetic) => cosmetic.id === 'vanguarda');
assert.equal(preservedVanguard.completedArenas, 18);
assert.equal(preservedVanguard.legacyEntitlement, false, '3★ na nova fase atualiza o domínio antigo para a campanha completa');
assert.equal(preservedVanguard.pendingMissions.length, 0);

const brokenRaw = '{"vila":3,';
const brokenData = new Map([['cavaleiros-campanha', brokenRaw], ['cavaleiros-campanha-corrompido', 'backup anterior']]);
const brokenStorage = { getItem(key) { return brokenData.get(key) ?? null; }, setItem(key, value) { brokenData.set(key, String(value)); } };
const broken = loadCampaign(brokenStorage);
assert.equal(broken.starsOf('vila'), 0, 'um JSON malformado não quebra o carregamento');
assert.equal(broken.campaignStorageWasCorrupted(), true, 'o save inválido sinaliza dados corrompidos');
assert.equal(broken.campaignStorageIsVolatile(), false, 'backup bem sucedido não finge falha de gravação');
assert.equal(broken.campaignCorruptBackupFailed(), false);
assert.equal(brokenData.get('cavaleiros-campanha'), brokenRaw, 'o conteúdo original ainda não foi sobrescrito');
assert.equal(brokenData.get('cavaleiros-campanha-corrompido'), 'backup anterior', 'backup anterior é preservado');
assert.equal(brokenData.get('cavaleiros-campanha-corrompido-1'), brokenRaw, 'cria uma cópia adicional sem apagar a anterior');
broken.saveStars('vila', 1);
assert.equal(JSON.parse(brokenData.get('cavaleiros-campanha')).vila, 1, 'novos resultados podem seguir salvando');
assert.equal(brokenData.get('cavaleiros-campanha-corrompido-1'), brokenRaw, 'a cópia bruta continua recuperável depois do novo save');

const noBackupRaw = new Map([['cavaleiros-campanha', brokenRaw]]);
const noBackup = loadCampaign({ getItem(key) { return noBackupRaw.get(key) ?? null; }, setItem() { throw new Error('quota cheia'); } });
assert.equal(noBackup.starsOf('vila'), 0);
assert.equal(noBackup.campaignStorageWasCorrupted(), true);
assert.equal(noBackup.campaignCorruptBackupFailed(), true, 'falha ao preservar o save é informada');
assert.equal(noBackup.campaignStorageIsVolatile(), true);
assert.equal(noBackup.saveStars('vila', 1), true, 'o progresso segue na sessão mesmo sem backup');
assert.equal(noBackup.starsOf('vila'), 1);
assert.equal(noBackupRaw.get('cavaleiros-campanha'), brokenRaw, 'sem backup, o próximo save não destrói o conteúdo original');

const transientRaw = '{"vila":"2"}';
const transientData = new Map([['cavaleiros-campanha', transientRaw]]);
let backupAvailable = false;
const transientStorage = {
  getItem(key) { return transientData.get(key) ?? null; },
  setItem(key, value) {
    if (!backupAvailable && key.startsWith('cavaleiros-campanha-corrompido')) throw new Error('falha temporária de storage');
    transientData.set(key, String(value));
  },
};
const transient = loadCampaign(transientStorage);
assert.equal(transient.campaignStorageWasCorrupted(), true);
assert.equal(transient.campaignCorruptBackupFailed(), true, 'a primeira tentativa de backup falha');
transient.saveStars('vila', 2);
assert.equal(transient.starsOf('vila'), 2, 'o progresso segue disponível na memória enquanto o backup falha');
assert.equal(transientData.get('cavaleiros-campanha'), transientRaw, 'a chave original continua intacta durante a falha');
backupAvailable = true;
assert.equal(transient.saveStars('ponte', 1), true, 'a próxima gravação tenta salvar de novo o backup');
assert.equal(transientData.get('cavaleiros-campanha-corrompido'), transientRaw, 'o retry preserva o texto corrompido original');
assert.deepEqual(JSON.parse(transientData.get('cavaleiros-campanha')), { vila: 2, ponte: 1 }, 'só grava o save novo depois de preservar o original');
assert.equal(transient.campaignCorruptBackupFailed(), false, 'o erro transitório é encerrado após o backup');
assert.equal(transient.campaignStorageIsVolatile(), false, 'depois que o storage volta, o progresso sai da memória');

const readRecoveryRaw = JSON.stringify({ vila: 3, ponte: 2 });
const readRecoveryData = new Map([['cavaleiros-campanha', readRecoveryRaw]]);
let failFirstCampaignRead = true;
const readRecoveryStorage = {
  getItem(key) {
    if (key === 'cavaleiros-campanha' && failFirstCampaignRead) {
      failFirstCampaignRead = false;
      throw new Error('falha transitória de leitura');
    }
    return readRecoveryData.get(key) ?? null;
  },
  setItem(key, value) { readRecoveryData.set(key, String(value)); },
};
const readRecovery = loadCampaign(readRecoveryStorage);
assert.equal(readRecovery.campaignStorageWasCorrupted(), false, 'falha ao ler não é tratada como corrupção');
assert.equal(readRecovery.saveStars('caca', 1), true, 'a gravação relê o save antes de compor um objeto parcial');
assert.deepEqual(JSON.parse(readRecoveryData.get('cavaleiros-campanha')), { vila: 3, ponte: 2, caca: 1 }, 'a leitura repetida recupera as estrelas existentes');
assert.equal(readRecovery.totalStars(), 6);

const persistentReadRaw = JSON.stringify({ vila: 3, ponte: 2 });
const persistentReadData = new Map([['cavaleiros-campanha', persistentReadRaw]]);
let readsBlocked = true;
const persistentRead = loadCampaign({
  getItem(key) { if (key === 'cavaleiros-campanha' && readsBlocked) throw new Error('storage indisponível'); return persistentReadData.get(key) ?? null; },
  setItem(key, value) { persistentReadData.set(key, String(value)); },
});
assert.equal(persistentRead.campaignStorageWasCorrupted(), false);
assert.equal(persistentRead.saveStars('caca', 1), true);
readsBlocked = false;
assert.equal(persistentRead.saveStars('cemiterio', 1), true, 'a próxima gravação relê e recupera a base');
assert.deepEqual(JSON.parse(persistentReadData.get('cavaleiros-campanha')), { vila: 3, ponte: 2, caca: 1, cemiterio: 1 }, 'mescla ações monotônicas e preserva estrelas antigas');
assert.equal(persistentRead.campaignStorageIsVolatile(), false, 'o aviso some depois que a base e as ações pendentes foram salvas');

const pendingRecordsData = new Map([['cavaleiros-recordes-missao', JSON.stringify({ vila: { dificil: { seconds: 400 } } })]]);
let blockRecordsRead = true;
const pendingRecords = loadCampaign({
  getItem(key) { if (key === 'cavaleiros-recordes-missao' && blockRecordsRead) throw new Error('falha de leitura'); return pendingRecordsData.get(key) ?? null; },
  setItem(key, value) { pendingRecordsData.set(key, String(value)); },
});
assert.equal(pendingRecords.saveMissionRecord('vila', { won: true, difficultyId: 'normal', seconds: 180 }), true);
blockRecordsRead = false;
assert.equal(pendingRecords.saveMissionRecord('vila', { won: true, difficultyId: 'normal', seconds: 170 }), true);
assert.deepEqual(JSON.parse(JSON.stringify(pendingRecords.missionRecords('vila').map((record) => [record.difficultyId, record.seconds]))), [['normal', 170], ['dificil', 400]], 'o menor tempo novo mescla sem apagar outros recordes salvos');
assert.equal(pendingRecords.campaignStorageIsVolatile(), false);

const pendingMedalsData = new Map([['cavaleiros-medalhas-missao', JSON.stringify({ vila: { best: 'dificil', challenges: { dificil: true } } })]]);
let blockMedalsRead = true;
const pendingMedals = loadCampaign({
  getItem(key) { if (key === 'cavaleiros-medalhas-missao' && blockMedalsRead) throw new Error('falha de leitura'); return pendingMedalsData.get(key) ?? null; },
  setItem(key, value) { pendingMedalsData.set(key, String(value)); },
});
pendingMedals.saveMissionMedal('vila', { won: true, stars: 3, difficultyId: 'pesadelo' });
blockMedalsRead = false;
const recoveredMedal = pendingMedals.missionMedal('vila');
assert.equal(recoveredMedal.best.difficultyId, 'pesadelo', 'a melhor dificuldade pendente prevalece');
assert.deepEqual(JSON.parse(JSON.stringify(recoveredMedal.challenges.map((challenge) => [challenge.difficultyId, challenge.done]))), [['dificil', true], ['pesadelo', true]], 'desafios antigos e novos se unem');
assert.equal(pendingMedals.campaignStorageIsVolatile(), false);

const pendingCorruptRaw = '{"vila":"2","ponte":3}';
const pendingCorruptData = new Map([['cavaleiros-campanha', pendingCorruptRaw]]);
let blockCorruptRead = true;
const pendingCorrupt = loadCampaign({
  getItem(key) { if (key === 'cavaleiros-campanha' && blockCorruptRead) throw new Error('falha de leitura'); return pendingCorruptData.get(key) ?? null; },
  setItem(key, value) { pendingCorruptData.set(key, String(value)); },
});
pendingCorrupt.campaignStorageWasCorrupted();
pendingCorrupt.saveStars('caca', 1);
blockCorruptRead = false;
assert.equal(pendingCorrupt.starsOf('ponte'), 3, 'recupera campos válidos do raw que estava ilegível');
assert.equal(pendingCorrupt.starsOf('caca'), 1, 'preserva a ação pendente junto dos dados recuperados');
assert.equal(pendingCorrupt.campaignStorageWasCorrupted(), true, 'o raw inválido continua sinalizado');
assert.equal(pendingCorruptData.get('cavaleiros-campanha-corrompido'), pendingCorruptRaw, 'faz backup do raw inválido antes da gravação mesclada');
assert.deepEqual(JSON.parse(pendingCorruptData.get('cavaleiros-campanha')), { ponte: 3, caca: 1 });
assert.equal(pendingCorrupt.campaignStorageIsVolatile(), false);

for (const raw of ['{"vila":"1"}', '{"vila":4}', '{"vila":-1}', '{"vila":1.5}', '{"vila":true}']) {
  const data = new Map([['cavaleiros-campanha', raw]]);
  const campaign = loadCampaign({ getItem(key) { return data.get(key) ?? null; }, setItem(key, value) { data.set(key, String(value)); } });
  assert.equal(campaign.campaignStorageWasCorrupted(), true, `rejeita esquema de estrelas inválido: ${raw}`);
  assert.equal(campaign.totalStars(), 0, 'valores inválidos nunca contaminam o total da campanha');
  assert.equal(typeof campaign.totalStars(), 'number', 'o total de estrelas permanece numérico');
  assert.equal(data.get('cavaleiros-campanha'), raw, 'o save original não é sobrescrito durante a leitura');
  assert.ok([...data.keys()].some((key) => key.startsWith('cavaleiros-campanha-corrompido') && data.get(key) === raw), 'o conteúdo inválido fica preservado');
}

const mixedRaw = '{"vila":3,"ponte":"x","santuario":2}';
const mixedData = new Map([['cavaleiros-campanha', mixedRaw]]);
const mixed = loadCampaign({ getItem(key) { return mixedData.get(key) ?? null; }, setItem(key, value) { mixedData.set(key, String(value)); } });
assert.equal(mixed.campaignStorageWasCorrupted(), true, 'um campo inválido sinaliza que o arquivo precisa de reparo');
assert.equal(mixed.starsOf('vila'), 3, 'as estrelas válidas antes do campo ruim são recuperadas');
assert.equal(mixed.starsOf('ponte'), 0, 'o campo inválido não entra no progresso');
assert.equal(mixed.starsOf('santuario'), 2, 'as estrelas válidas depois do campo ruim também são recuperadas');
assert.equal(mixed.totalStars(), 5);
assert.equal(mixedData.get('cavaleiros-campanha-corrompido'), mixedRaw, 'o JSON bruto completo segue recuperável no backup');

// A tela do mapa calcula o aviso antes de chamar renderCampaign, que só depois consulta as estrelas.
// A checagem precisa descobrir corrupção nesse primeiro acesso, sem exigir fechar e reabrir o mapa.
const firstMapRaw = '{"vila":"1"}';
const firstMapData = new Map([['cavaleiros-campanha', firstMapRaw]]);
const firstMap = loadCampaign({ getItem(key) { return firstMapData.get(key) ?? null; }, setItem(key, value) { firstMapData.set(key, String(value)); } });
const firstMapWarning = firstMap.campaignStorageWasCorrupted()
  ? 'Um save da campanha estava corrompido. Uma cópia foi preservada no navegador.'
  : '';
assert.match(firstMapWarning, /save da campanha estava corrompido/, 'o aviso é calculável já na primeira abertura do mapa');
assert.equal(firstMap.totalStars(), 0);
assert.equal(firstMapData.get('cavaleiros-campanha-corrompido'), firstMapRaw, 'a primeira checagem do mapa preserva o save antes da renderização');

console.log('OK: estrelas, recordes e medalhas continuam funcionando em memória se localStorage estiver indisponível ou falhar ao gravar.');
