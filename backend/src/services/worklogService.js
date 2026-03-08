const tempoClient = require('../clients/tempoClient');
const worklogRepo = require('../repositories/worklogRepository');

async function syncWorklogs() {
  // 1. fetch from Tempo
  const tempoWorklogs = await tempoClient.fetchAllWorklogs();

  // 2. transform and save to database
  const saved = await worklogRepo.upsertWorklogs(tempoWorklogs);
  return saved;
}

module.exports = {
  syncWorklogs,
};
