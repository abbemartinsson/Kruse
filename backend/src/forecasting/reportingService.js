const analyticsRepository = require('../repositories/analyticsRepository');
const analyticsService = require('./analyticsService');
const forecastService = require('./forecastSerive');

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

/**
 * Get workload forecast with historical comparison.
 * 
 * @param {number} forecastMonths - Number of months to forecast (default 3)
 * @returns {Promise<Object>} Forecast report
 */
async function getWorkloadForecast(forecastMonths = 3) {
	try {
		const forecast = await forecastService.getComprehensiveWorkloadForecast({
			forecastMonths
		});
		
		return {
			forecast: forecast.forecast,
			historical: forecast.historical,
			current_state: forecast.current_state,
			data_info: forecast.data_info,
			generated_at: forecast.generated_at
		};
	} catch (error) {
		console.error('Error in getWorkloadForecast:', error);
		throw error;
	}
}

/**
 * Get historical comparison for current month vs previous years.
 * Shows workload and team size for same period in history.
 * 
 * @param {Object} options - Comparison options
 * @param {number} options.month - Month to compare (default current)
 * @param {number} options.year - Year to compare (default current)
 * @param {number} options.yearsBack - Years to look back (default 3)
 * @returns {Promise<Object>} Historical comparison report
 */
async function getHistoricalWorkloadComparison(options = {}) {
	try {
		const comparison = await analyticsService.getHistoricalComparison(options);
		
		return {
			current_period: {
				year: comparison.current_period.year,
				month: comparison.current_period.month,
				total_hours: comparison.current_period.total_hours,
				active_users: comparison.current_period.active_users,
				worklog_count: comparison.current_period.worklog_count
			},
			previous_years: comparison.historical_periods.map(p => ({
				year: p.year,
				total_hours: p.total_hours,
				active_users: p.active_users,
				worklog_count: p.worklog_count,
				compared_to_current: {
					hours_difference: roundToTwoDecimals(
						comparison.current_period.total_hours - p.total_hours
					),
					hours_change_percent: roundToTwoDecimals(
						((comparison.current_period.total_hours - p.total_hours) / p.total_hours) * 100
					),
					users_difference: comparison.current_period.active_users - p.active_users
				}
			})),
			summary: {
				trend: comparison.comparison.trend,
				average_hours_across_years: comparison.comparison.average_hours_across_years,
				max_hours: comparison.comparison.max_hours,
				min_hours: comparison.comparison.min_hours,
				years_analyzed: comparison.comparison.total_years_analyzed
			}
		};
	} catch (error) {
		console.error('Error in getHistoricalWorkloadComparison:', error);
		throw error;
	}
}

/**
 * Get workload analytics for a specific time period.
 * 
 * @param {Object} options - Analytics options
 * @param {Date} options.startDate - Start date
 * @param {Date} options.endDate - End date
 * @returns {Promise<Object>} Workload analytics report
 */
async function getWorkloadAnalytics(options = {}) {
	try {
		const analytics = await analyticsService.getWorkloadAnalytics(options);
		
		return {
			summary: {
				total_hours: analytics.total_hours,
				total_worklogs: analytics.total_worklogs,
				unique_users: analytics.unique_users,
				average_weekly_hours: analytics.averages.weekly_hours,
				average_hours_per_user: analytics.averages.hours_per_user
			},
			date_range: analytics.date_range,
			weekly_breakdown: analytics.weekly_data,
			monthly_breakdown: analytics.monthly_data
		};
	} catch (error) {
		console.error('Error in getWorkloadAnalytics:', error);
		throw error;
	}
}

/**
 * Get simple forecast summary for quick reporting.
 * 
 * @param {number} forecastMonths - Number of months to forecast
 * @returns {Promise<Object>} Simplified forecast summary
 */
async function getWorkloadForecastSummary(forecastMonths = 3) {
	try {
		return await forecastService.getWorkloadForecastSummary(forecastMonths);
	} catch (error) {
		console.error('Error in getWorkloadForecastSummary:', error);
		throw error;
	}
}

module.exports = {
	getProjectInfo,
	searchProjects,
	getWorkloadForecast,
	getHistoricalWorkloadComparison,
	getWorkloadAnalytics,
	getWorkloadForecastSummary
};
