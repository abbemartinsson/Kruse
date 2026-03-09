const { createClient } = require('@supabase/supabase-js');
const config = require('../config').supabase;

// Initialize a Supabase client for database operations.
const supabase = createClient(config.url, config.serviceRoleKey);

const TABLE = 'PROJECTS';

async function upsertProjects(projects) {
  // Transform Jira project objects to our schema
  const now = new Date().toISOString();
  const rows = projects.map(p => ({
    jira_project_id: p.id,
    jira_project_key: p.key,
    name: p.name,
    created_at: now,
    updated_at: now,
    // start_date, last_logged_issue calculated from worklogs
  }));
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'jira_project_id' });

  if (error) {
    throw error;
  }
  // Supabase might return null data on upsert success,
  // so return the input rows instead
  return data || rows;
}

async function updateProjectTimestamps() {
  // Fetch all projects
  const { data: projects, error: projectsError } = await supabase
    .from(TABLE)
    .select('id, jira_project_key');

  if (projectsError) {
    throw projectsError;
  }

  if (!projects || projects.length === 0) {
    return 0;
  }

  let updatedCount = 0;

  for (const project of projects) {
    // Get all issue IDs for this project
    const { data: issues, error: issuesError } = await supabase
      .from('ISSUES')
      .select('id')
      .eq('project_id', project.id);

    if (issuesError) {
      console.warn(`    ⚠ Error fetching issues for project ${project.jira_project_key}:`, issuesError.message);
      continue;
    }

    if (!issues || issues.length === 0) {
      continue;
    }

    const issueIds = issues.map(i => i.id);

    // Get earliest (MIN) started_at from worklogs for these issues
    const { data: earliestWorklog, error: earliestError } = await supabase
      .from('WORKLOGS')
      .select('started_at')
      .in('issue_id', issueIds)
      .order('started_at', { ascending: true })
      .limit(1)
      .single();

    if (earliestError && earliestError.code !== 'PGRST116') {
      console.warn(`    ⚠ Error fetching earliest worklog for project ${project.jira_project_key}:`, earliestError.message);
      continue;
    }

    // Get latest (MAX) started_at from worklogs for these issues
    const { data: latestWorklog, error: latestError } = await supabase
      .from('WORKLOGS')
      .select('started_at')
      .in('issue_id', issueIds)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (latestError && latestError.code !== 'PGRST116') {
      console.warn(`    ⚠ Error fetching latest worklog for project ${project.jira_project_key}:`, latestError.message);
      continue;
    }

    if (!earliestWorklog || !latestWorklog) {
      continue;
    }

    const startDate = earliestWorklog.started_at;
    const lastLoggedIssue = latestWorklog.started_at;

    // Update project with calculated timestamps
    const { error: updateError } = await supabase
      .from(TABLE)
      .update({
        start_date: startDate,
        last_logged_issue: lastLoggedIssue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    if (updateError) {
      console.warn(`    ⚠ Error updating timestamps for project ${project.jira_project_key}:`, updateError.message);
      continue;
    }

    updatedCount++;
  }

  return updatedCount;
}

module.exports = {
  upsertProjects,
  updateProjectTimestamps,
};
