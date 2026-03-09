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

module.exports = {
	getProjectInfo,
  searchProjects,
};
