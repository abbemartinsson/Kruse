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
    // start_date, end_date handled separately later
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

module.exports = {
  upsertProjects,
};
