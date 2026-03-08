const jiraClient = require('../clients/jiraClient');
const projectRepo = require('../repositories/projectRepository');

async function syncProjects() {
  // 1. fetch from Jira
  const jiraProjects = await jiraClient.fetchAllProjects();

  // 2. optionally transform/filter
  const saved = await projectRepo.upsertProjects(jiraProjects);
  return saved;
}

module.exports = {
  syncProjects,
};
