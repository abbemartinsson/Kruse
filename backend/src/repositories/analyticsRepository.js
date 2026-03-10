const { createClient } = require('@supabase/supabase-js');
const config = require('../config').supabase;

const supabase = createClient(config.url, config.serviceRoleKey);

const PROJECTS_TABLE = 'PROJECTS';
const ISSUES_TABLE = 'ISSUES';
const WORKLOGS_TABLE = 'WORKLOGS';

async function getProjectInfo(projectKey) {
	const normalizedProjectKey = String(projectKey || '').trim().toUpperCase();

	if (!normalizedProjectKey) {
		throw new Error('projectKey is required');
	}

	const project = await findProjectByKey(normalizedProjectKey);
	if (!project) {
		return null;
	}

	const issueIds = await getIssueIdsForProject(project.id);
	if (issueIds.length === 0) {
		return {
			projectId: project.id,
			projectKey: project.jira_project_key,
			projectName: project.name,
			startDate: project.start_date,
			lastLoggedIssue: project.last_logged_issue,
			totalSeconds: 0,
			contributorsCount: 0,
		};
	}

	const stats = await getProjectWorklogStats(issueIds);

	return {
		projectId: project.id,
		projectKey: project.jira_project_key,
		projectName: project.name,
		startDate: project.start_date,
		lastLoggedIssue: project.last_logged_issue,
		totalSeconds: stats.totalSeconds,
		contributorsCount: stats.contributorsCount,
	};
}

async function findProjectByKey(projectKey) {
	const { data, error } = await supabase
		.from(PROJECTS_TABLE)
		.select('id, jira_project_key, name, start_date, last_logged_issue')
		.eq('jira_project_key', projectKey)
		.limit(1)
		.maybeSingle();

	if (error) {
		throw error;
	}

	return data || null;
}

async function getIssueIdsForProject(projectId) {
	const pageSize = 1000;
	const issueIds = [];
	let from = 0;
	let hasMore = true;

	while (hasMore) {
		const to = from + pageSize - 1;
		const { data, error } = await supabase
			.from(ISSUES_TABLE)
			.select('id')
			.eq('project_id', projectId)
			.order('id', { ascending: true })
			.range(from, to);

		if (error) {
			throw error;
		}

		const batch = data || [];
		for (const issue of batch) {
			issueIds.push(issue.id);
		}

		hasMore = batch.length === pageSize;
		from += pageSize;
	}

	return issueIds;
}

async function getProjectWorklogStats(issueIds) {
	const issueIdChunks = chunkArray(issueIds, 200);
	let totalSeconds = 0;
	const contributorIds = new Set();
	const seenWorklogIds = new Set();

	for (const chunk of issueIdChunks) {
		const chunkRows = await fetchAllWorklogsForIssueChunk(chunk);
		for (const row of chunkRows) {
			if (seenWorklogIds.has(row.id)) {
				continue;
			}

			seenWorklogIds.add(row.id);
			totalSeconds += row.time_spent_seconds || 0;
			if (row.user_id) {
				contributorIds.add(row.user_id);
			}
		}
	}

	return {
		totalSeconds,
		contributorsCount: contributorIds.size,
	};
}

async function fetchAllWorklogsForIssueChunk(issueIdChunk) {
	const pageSize = 1000;
	const rows = [];
	let from = 0;
	let hasMore = true;

	while (hasMore) {
		const to = from + pageSize - 1;
		const { data, error } = await supabase
			.from(WORKLOGS_TABLE)
			.select('id, time_spent_seconds, user_id')
			.in('issue_id', issueIdChunk)
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

function chunkArray(values, chunkSize) {
	const chunks = [];
	for (let i = 0; i < values.length; i += chunkSize) {
		chunks.push(values.slice(i, i + chunkSize));
	}
	return chunks;
}

async function searchProjects(query) {
  const searchPattern = `%${query}%`;

  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select('id, jira_project_key, name')
    .or(`name.ilike.${searchPattern},jira_project_key.ilike.${searchPattern}`)
    .order('name', { ascending: true })
    .limit(50);

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Get all worklogs with user information for forecasting and historical analysis.
 * Optionally filter by date range.
 * 
 * @param {Object} options - Filter options
 * @param {Date} options.startDate - Optional start date filter
 * @param {Date} options.endDate - Optional end date filter
 * @param {string} options.projectKey - Optional project key filter
 * @returns {Promise<Array>} Array of worklogs with time_spent_seconds, started_at, user_id
 */
async function getAllWorklogsForForecast(options = {}) {
	const { startDate, endDate, projectKey } = options;
	
	let query = supabase
		.from(WORKLOGS_TABLE)
		.select('id, time_spent_seconds, started_at, user_id, issue_id');
	
	if (startDate) {
		query = query.gte('started_at', startDate.toISOString());
	}
	
	if (endDate) {
		query = query.lte('started_at', endDate.toISOString());
	}
	
	// If filtering by project, need to join through issues
	if (projectKey) {
		// First get the project
		const project = await findProjectByKey(projectKey);
		if (!project) {
			return [];
		}
		
		// Get issue IDs for this project
		const issueIds = await getIssueIdsForProject(project.id);
		if (issueIds.length === 0) {
			return [];
		}
		
		// Filter worklogs by these issues
		query = query.in('issue_id', issueIds);
	}
	
	query = query.order('started_at', { ascending: true });
	
	// Fetch all data (pagination if needed)
	const allWorklogs = [];
	const pageSize = 1000;
	let from = 0;
	let hasMore = true;
	
	while (hasMore) {
		const to = from + pageSize - 1;
		const { data, error } = await query.range(from, to);
		
		if (error) {
			throw error;
		}
		
		const batch = data || [];
		allWorklogs.push(...batch);
		hasMore = batch.length === pageSize;
		from += pageSize;
	}
	
	return allWorklogs;
}

/**
 * Get workload summary grouped by time period (week/month).
 * 
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date
 * @param {Date} options.endDate - End date
 * @param {string} options.groupBy - 'week' or 'month'
 * @returns {Promise<Array>} Array of aggregated workload data
 */
async function getWorkloadByPeriod(options = {}) {
	const { startDate, endDate, groupBy = 'week' } = options;
	
	// Use raw SQL for better date grouping
	const truncFunction = groupBy === 'month' ? 'month' : 'week';
	
	let query = `
		SELECT 
			date_trunc('${truncFunction}', started_at) as period_start,
			SUM(time_spent_seconds) as total_seconds,
			COUNT(DISTINCT user_id) as active_users,
			COUNT(*) as worklog_count
		FROM ${WORKLOGS_TABLE}
	`;
	
	const conditions = [];
	if (startDate) {
		conditions.push(`started_at >= '${startDate.toISOString()}'`);
	}
	if (endDate) {
		conditions.push(`started_at <= '${endDate.toISOString()}'`);
	}
	
	if (conditions.length > 0) {
		query += ' WHERE ' + conditions.join(' AND ');
	}
	
	query += `
		GROUP BY date_trunc('${truncFunction}', started_at)
		ORDER BY period_start ASC
	`;
	
	const { data, error } = await supabase.rpc('exec_sql', { query });
	
	if (error) {
		// If RPC doesn't exist, fall back to fetching all and grouping in JS
		return getWorkloadByPeriodFallback(options);
	}
	
	return data || [];
}

/**
 * Fallback method to group worklogs by period in JavaScript.
 */
async function getWorkloadByPeriodFallback(options = {}) {
	const { startDate, endDate, groupBy = 'week' } = options;
	
	const worklogs = await getAllWorklogsForForecast({ startDate, endDate });
	
	// Group in JavaScript
	const grouped = {};
	
	for (const worklog of worklogs) {
		const date = new Date(worklog.started_at);
		let periodKey;
		
		if (groupBy === 'month') {
			periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		} else {
			// Week grouping - get Monday of the week
			const day = date.getDay();
			const diff = date.getDate() - day + (day === 0 ? -6 : 1);
			const monday = new Date(date.setDate(diff));
			periodKey = monday.toISOString().split('T')[0];
		}
		
		if (!grouped[periodKey]) {
			grouped[periodKey] = {
				period_start: periodKey,
				total_seconds: 0,
				active_users: new Set(),
				worklog_count: 0
			};
		}
		
		grouped[periodKey].total_seconds += worklog.time_spent_seconds || 0;
		grouped[periodKey].active_users.add(worklog.user_id);
		grouped[periodKey].worklog_count += 1;
	}
	
	// Convert to array and format
	return Object.values(grouped).map(item => ({
		period_start: item.period_start,
		total_seconds: item.total_seconds,
		active_users: item.active_users.size,
		worklog_count: item.worklog_count
	})).sort((a, b) => a.period_start.localeCompare(b.period_start));
}

/**
 * Get historical comparison for same month in previous years.
 * 
 * @param {number} month - Month number (1-12)
 * @param {number} currentYear - Current year
 * @param {number} yearsBack - How many years to look back (default 3)
 * @returns {Promise<Array>} Historical data for each year
 */
async function getHistoricalComparisonByMonth(month, currentYear, yearsBack = 3) {
	const comparisons = [];
	
	for (let i = 1; i <= yearsBack; i++) {
		const year = currentYear - i;
		
		// Get start and end of month
		const startDate = new Date(year, month - 1, 1);
		const endDate = new Date(year, month, 0, 23, 59, 59);
		
		const worklogs = await getAllWorklogsForForecast({ startDate, endDate });
		
		if (worklogs.length > 0) {
			const totalSeconds = worklogs.reduce((sum, w) => sum + (w.time_spent_seconds || 0), 0);
			const uniqueUsers = new Set(worklogs.map(w => w.user_id)).size;
			
			comparisons.push({
				year,
				month,
				period: `${year}-${String(month).padStart(2, '0')}`,
				total_hours: Math.round(totalSeconds / 3600 * 100) / 100,
				total_seconds: totalSeconds,
				active_users: uniqueUsers,
				worklog_count: worklogs.length
			});
		}
	}
	
	return comparisons;
}

module.exports = {
	getProjectInfo,
	searchProjects,
	getAllWorklogsForForecast,
	getWorkloadByPeriod,
	getHistoricalComparisonByMonth,
};
