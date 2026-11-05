const fs = require('node:fs');
const path = require('node:path');

module.exports = function loadCampaignSource(dir = path.resolve(__dirname, '..')) {
  const layout = fs.readFileSync(path.join(dir, 'campaign-layout.js'), 'utf8').replace(/^export\s+/gm, '');
  const campaign = fs.readFileSync(path.join(dir, 'campaign.js'), 'utf8')
    .replace(/^import \{ CAMPAIGN_ROAD, campaignRoadX, layoutCampaign \} from '\.\/campaign-layout\.js';\r?\n/m, '')
    .replace(/^export \{ CAMPAIGN_ROAD, campaignRoadX \};\r?\n/m, '')
    .replace(/^export\s+/gm, '');
  return `${layout}\n${campaign}`;
};
