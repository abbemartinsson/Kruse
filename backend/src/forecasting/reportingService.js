const analyticsRepository = require('../repositories/analyticsRepository');

async function getProjectInfo(projectKey) {
	const report = await analyticsRepository.getProjectInfo(projectKey);

	if (!report) {
		return null;
	}

	const hours = report.totalSeconds / 3600;

	return {
		projectId: report.projectId,
		projectKey: report.projectKey,
		projectName: report.projectName,
		startDate: report.startDate,
		lastLoggedIssue: report.lastLoggedIssue,
		totalSeconds: report.totalSeconds,
		totalHours: roundToTwoDecimals(hours),
		contributorsCount: report.contributorsCount,
	};
}

function roundToTwoDecimals(value) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function searchProjects(query) {
  const projects = await analyticsRepository.searchProjects(query);

  return projects.map(p => ({
    projectId: p.id,
    projectKey: p.jira_project_key,
    projectName: p.name,
  }));
}

module.exports = {
	getProjectInfo,
  searchProjects,
};
