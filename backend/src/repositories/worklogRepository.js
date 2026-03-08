const { createClient } = require('@supabase/supabase-js');
const config = require('../config').supabase;

// Initialize a Supabase client for database operations.
const supabase = createClient(config.url, config.serviceRoleKey);

const TABLE = 'WORKLOGS';

async function upsertWorklogs(worklogs) {
  const issueMap = await buildIssueLookupMap();
  const userMap = await buildUserLookupMap();

  const now = new Date().toISOString();
  const rows = [];
  let skippedCount = 0;
  let missingIssueCount = 0;
  let missingUserCount = 0;
  let missingTimeCount = 0;
  let missingStartedAtCount = 0;

  for (const worklog of worklogs) {
    const jiraIssueId = getJiraIssueId(worklog);
    const issueId = issueMap.get(jiraIssueId);
    const jiraAccountId = getJiraAccountId(worklog);
    const userId = userMap.get(jiraAccountId);
    const startedAt = getStartedAt(worklog);
    const timeSpentSeconds = worklog.timeSpentSeconds || null;

    const missingIssue = !issueId;
    const missingUser = !userId;
    const missingStartedAt = !startedAt;
    const missingTime = !timeSpentSeconds;

    if (missingIssue || missingUser || missingStartedAt || missingTime) {
      skippedCount++;
      if (missingIssue) {
        missingIssueCount++;
      }
      if (missingUser) {
        missingUserCount++;
      }
      if (missingStartedAt) {
        missingStartedAtCount++;
      }
      if (missingTime) {
        missingTimeCount++;
      }
      continue;
    }

    rows.push({
      issue_id: issueId,
      user_id: userId,
      time_spent_seconds: timeSpentSeconds,
      started_at: startedAt,
      created_at: now,
      updated_at: now,
    });
  }

  if (skippedCount > 0) {
    console.warn(`    Skipped ${skippedCount} worklogs without valid issue/user/time mapping`);
    console.warn(`    Missing issue mapping: ${missingIssueCount}`);
    console.warn(`    Missing user mapping: ${missingUserCount}`);
    console.warn(`    Missing started_at: ${missingStartedAtCount}`);
    console.warn(`    Missing time_spent_seconds: ${missingTimeCount}`);
  }

  if (rows.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'issue_id,user_id,started_at' });

  if (!error) {
    return data || rows;
  }

  // Fallback for environments where the composite unique constraint does not exist.
  const missingConstraint = String(error.message || '').includes(
    'no unique or exclusion constraint matching the ON CONFLICT specification'
  );

  if (!missingConstraint) {
    throw error;
  }

  console.warn('    Missing unique constraint for upsert, using deduplicated insert fallback');
  const existingKeys = await buildExistingWorklogKeySet();
  const rowsToInsert = rows.filter(row => {
    const key = buildWorklogKey(row.issue_id, row.user_id, row.started_at);
    if (existingKeys.has(key)) {
      return false;
    }
    existingKeys.add(key);
    return true;
  });

  if (rowsToInsert.length === 0) {
    return [];
  }

  const insertResp = await supabase.from(TABLE).insert(rowsToInsert);
  if (insertResp.error) {
    throw insertResp.error;
  }

  return insertResp.data || rowsToInsert;
}

function getJiraIssueId(worklog) {
  if (worklog.issue?.id) {
    return String(worklog.issue.id);
  }
  if (worklog.issueId) {
    return String(worklog.issueId);
  }
  return null;
}

function getJiraAccountId(worklog) {
  if (worklog.author?.accountId) {
    return worklog.author.accountId;
  }
  if (worklog.worker?.accountId) {
    return worklog.worker.accountId;
  }
  if (worklog.accountId) {
    return worklog.accountId;
  }
  return null;
}

function getStartedAt(worklog) {
  if (worklog.startedAt) {
    return worklog.startedAt;
  }
  if (worklog.startDate && worklog.startTime) {
    return `${worklog.startDate}T${worklog.startTime}Z`;
  }
  if (worklog.startDate) {
    return `${worklog.startDate}T00:00:00Z`;
  }
  return null;
}

async function buildIssueLookupMap() {
  const data = await fetchAllRows('ISSUES', 'id, jira_issue_id');
  const map = new Map();
  for (const issue of data || []) {
    map.set(String(issue.jira_issue_id), issue.id);
  }
  return map;
}

async function buildUserLookupMap() {
  const data = await fetchAllRows('USERS', 'id, jira_account_id');
  const map = new Map();
  for (const user of data || []) {
    map.set(user.jira_account_id, user.id);
  }
  return map;
}

async function fetchAllRows(table, columns) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  let hasMore = true;

  while (hasMore) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const batch = data || [];
    rows.push(...batch);
    hasMore = batch.length === pageSize;
    from += pageSize;
  }

  return rows;
}

async function buildExistingWorklogKeySet() {
  const existingRows = await fetchAllRows(TABLE, 'issue_id, user_id, started_at');
  const set = new Set();

  for (const row of existingRows) {
    set.add(buildWorklogKey(row.issue_id, row.user_id, row.started_at));
  }

  return set;
}

function buildWorklogKey(issueId, userId, startedAt) {
  return `${issueId}|${userId}|${startedAt}`;
}

module.exports = {
  upsertWorklogs,
};
