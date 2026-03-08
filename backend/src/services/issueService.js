const jiraClient = require('../clients/jiraClient');
const issueRepo = require('../repositories/issueRepository');

async function syncIssues() {
  // 1. fetch from Jira
  const jiraIssues = await jiraClient.fetchAllIssues();

  // 2. transform and save to database
  const saved = await issueRepo.upsertIssues(jiraIssues);
  return saved;
}

async function syncIssuesAllStatuses() {
  // Fetch all issues regardless of status category.
  // Needed when downstream data (for example worklogs) references non-Done issues.
  const jiraIssues = await jiraClient.fetchAllIssues('ORDER BY created DESC');

  const saved = await issueRepo.upsertIssues(jiraIssues);
  return saved;
}

module.exports = {
  syncIssues,
  syncIssuesAllStatuses,
};
