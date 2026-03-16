const { createClient } = require('@supabase/supabase-js');
const config = require('../config').supabase;

// Initialize a Supabase client for database operations.
const supabase = createClient(config.url, config.serviceRoleKey);

const TABLE = 'ISSUES';

async function upsertIssues(issues) {
  // Build lookup maps for projects and users
  const projectMap = await buildProjectLookupMap();
  const userMap = await buildUserLookupMap();

  const now = new Date().toISOString();
  const rows = [];
  let skippedCount = 0;

  for (const issue of issues) {
    // Get internal project_id from our database
    const jiraProjectId = issue.fields.project?.id;
    const projectId = projectMap.get(jiraProjectId);

    if (!projectId) {
      skippedCount++;
      continue; // Skip issues for projects we don't have
    }

    // Get internal user_id from our database (assignee can be null)
    let assigneeUserId = null;
    if (issue.fields.assignee?.accountId) {
      assigneeUserId = userMap.get(issue.fields.assignee.accountId);
    }

    rows.push({
      jira_issue_id: parseInt(issue.id, 10),
      jira_issue_key: issue.key,
      project_id: projectId,
      assignee_user_id: assigneeUserId,
      title: issue.fields.summary,
      status: issue.fields.status?.name || 'Unknown',
      estimated_time_seconds: issue.fields.timetracking?.originalEstimateSeconds || null,
      created_at: now,
      updated_at: now,
    });
  }

  if (skippedCount > 0) {
    console.warn(`    ⚠ Skipped ${skippedCount} issues without matching project`);
  }

  if (rows.length === 0) {
    return [];
  }

  const existingIssueMap = await fetchExistingIssueStateMap(
    rows.map(row => String(row.jira_issue_id))
  );

  const rowsToSync = [];
  let statusChangedCount = 0;
  let newIssueCount = 0;

  for (const row of rows) {
    const existing = existingIssueMap.get(String(row.jira_issue_id));
    if (!existing) {
      newIssueCount++;
      rowsToSync.push(row);
      continue;
    }

    if (existing.status !== row.status) {
      statusChangedCount++;
      rowsToSync.push({
        ...row,
        // Preserve original created_at for existing rows.
        created_at: existing.created_at || row.created_at,
      });
    }
  }

  const skippedExistingCount = rows.length - rowsToSync.length;
  if (skippedExistingCount > 0) {
    console.log(`    → Skipped ${skippedExistingCount} unchanged existing issues`);
  }

  if (statusChangedCount > 0) {
    console.log(`    → Synced ${statusChangedCount} issues with changed status`);
  }

  if (newIssueCount > 0) {
    console.log(`    → Synced ${newIssueCount} new issues`);
  }

  if (rowsToSync.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rowsToSync, { onConflict: 'jira_issue_id' });

  if (error) {
    throw error;
  }

  return data || rowsToSync;
}

/**
 * Build a map from jira_project_id to internal project id
 */
async function buildProjectLookupMap() {
  const { data, error } = await supabase
    .from('PROJECTS')
    .select('id, jira_project_id');

  if (error) {
    throw error;
  }

  const map = new Map();
  for (const project of data || []) {
    map.set(String(project.jira_project_id), project.id);
  }
  return map;
}

/**
 * Build a map from jira_account_id to internal user id
 */
async function buildUserLookupMap() {
  const { data, error } = await supabase
    .from('USERS')
    .select('id, jira_account_id');

  if (error) {
    throw error;
  }

  const map = new Map();
  for (const user of data || []) {
    map.set(user.jira_account_id, user.id);
  }
  return map;
}

async function fetchExistingIssueStateMap(issueIds) {
  const uniqueIds = [...new Set((issueIds || []).filter(v => v !== null && v !== undefined))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const map = new Map();
  const batchSize = 500;

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(TABLE)
      .select('jira_issue_id, status, created_at')
      .in('jira_issue_id', batch);

    if (error) {
      throw error;
    }

    for (const row of data || []) {
      map.set(String(row.jira_issue_id), {
        status: row.status,
        created_at: row.created_at,
      });
    }
  }

  return map;
}

module.exports = {
  upsertIssues,
};
