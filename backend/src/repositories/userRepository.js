const { createClient } = require('@supabase/supabase-js');
const config = require('../config').supabase;

// Initialize a Supabase client for database operations.
const supabase = createClient(config.url, config.serviceRoleKey);

const TABLE = 'USERS';

async function upsertUsers(users) {
  // Filter out users without emails (required field)
  const usersWithEmail = users.filter(u => u.emailAddress);
  const skippedCount = users.length - usersWithEmail.length;
  
  if (skippedCount > 0) {
    console.warn(`    ⚠ Skipped ${skippedCount} users without email address`);
  }

  // Transform Jira user objects to our schema
  const now = new Date().toISOString();
  const rows = usersWithEmail.map(u => ({
    jira_account_id: u.accountId,
    name: u.displayName,
    email: u.emailAddress,
    created_at: now,
    updated_at: now,
    // capacity_hours_per_day and slack_account_id can be added later
  }));

  if (rows.length === 0) {
    return [];
  }

  const existingUserIds = await fetchExistingValuesByColumn(
    TABLE,
    'jira_account_id',
    rows.map(row => String(row.jira_account_id))
  );

  const rowsToSync = rows.filter(
    row => !existingUserIds.has(String(row.jira_account_id))
  );

  const skippedExistingCount = rows.length - rowsToSync.length;
  if (skippedExistingCount > 0) {
    console.log(`    → Skipped ${skippedExistingCount} existing users`);
  }

  if (rowsToSync.length === 0) {
    return [];
  }
  
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rowsToSync, { onConflict: 'jira_account_id' });

  if (error) {
    throw error;
  }
  // Supabase might return null data on upsert success,
  // so return the input rows instead
  return data || rowsToSync;
}

async function fetchExistingValuesByColumn(table, column, values) {
  const uniqueValues = [...new Set((values || []).filter(v => v !== null && v !== undefined))];
  if (uniqueValues.length === 0) {
    return new Set();
  }

  const existing = new Set();
  const batchSize = 500;

  for (let i = 0; i < uniqueValues.length; i += batchSize) {
    const batch = uniqueValues.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .in(column, batch);

    if (error) {
      throw error;
    }

    for (const row of data || []) {
      if (row[column] !== null && row[column] !== undefined) {
        existing.add(String(row[column]));
      }
    }
  }

  return existing;
}

module.exports = {
  upsertUsers,
};
