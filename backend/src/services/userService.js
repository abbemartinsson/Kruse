const jiraClient = require('../clients/jiraClient');
const userRepo = require('../repositories/userRepository');

async function syncUsers() {
  // 1. fetch from Jira
  const jiraUsers = await jiraClient.fetchAllUsers();

  // 2. transform and save to database
  const saved = await userRepo.upsertUsers(jiraUsers);
  return saved;
}

module.exports = {
  syncUsers,
};
