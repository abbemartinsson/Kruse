const analyticsRepository = require('../repositories/analyticsRepository');

/**
 * Get all historical worklogs for forecasting.
 * 
 * @param {Object} options - Filter options
 * @param {Date} options.startDate - Optional start date
 * @param {Date} options.endDate - Optional end date
 * @param {string} options.projectKey - Optional project filter
 * @returns {Promise<Array>} Worklog data
 */
async function getHistoricalWorklogs(options = {}) {
	try {
		return await analyticsRepository.getAllWorklogsForForecast(options);
	} catch (error) {
		console.error('Error fetching historical worklogs:', error);
		throw error;
	}
}

/**
 * Get workload grouped by time period.
 * 
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date
 * @param {Date} options.endDate - End date
 * @param {string} options.groupBy - 'week' or 'month'
 * @returns {Promise<Array>} Aggregated workload data
 */
async function getWorkloadByPeriod(options = {}) {
	try {
		return await analyticsRepository.getWorkloadByPeriod(options);
	} catch (error) {
		console.error('Error fetching workload by period:', error);
		throw error;
	}
}

/**
 * Get historical comparison for current month vs previous years.
 * 
 * @param {Object} options - Query options
 * @param {number} options.month - Month number (1-12, default current month)
 * @param {number} options.year - Year (default current year)
 * @param {number} options.yearsBack - Years to look back (default 3)
 * @returns {Promise<Object>} Historical comparison with current period data
 */
async function getHistoricalComparison(options = {}) {
	try {
		const now = new Date();
		const month = options.month || (now.getMonth() + 1);
		const year = options.year || now.getFullYear();
		const yearsBack = options.yearsBack || 3;
		
		// Get historical data for previous years
		const historicalData = await analyticsRepository.getHistoricalComparisonByMonth(
			month,
			year,
			yearsBack
		);
		
		// Get current year data
		const startDate = new Date(year, month - 1, 1);
		const endDate = new Date(year, month, 0, 23, 59, 59);
		const currentWorklogs = await analyticsRepository.getAllWorklogsForForecast({
			startDate,
			endDate
		});
		
		const currentTotalSeconds = currentWorklogs.reduce((sum, w) => sum + (w.time_spent_seconds || 0), 0);
		const currentUniqueUsers = new Set(currentWorklogs.map(w => w.user_id)).size;
		
		const currentYearData = {
			year,
			month,
			period: `${year}-${String(month).padStart(2, '0')}`,
			total_hours: Math.round(currentTotalSeconds / 3600 * 100) / 100,
			total_seconds: currentTotalSeconds,
			active_users: currentUniqueUsers,
			worklog_count: currentWorklogs.length,
			is_current: true
		};
		
		// Calculate trends
		const allYears = [currentYearData, ...historicalData].sort((a, b) => b.year - a.year);
		
		let trend = 'stable';
		if (allYears.length >= 2) {
			const current = allYears[0].total_hours;
			const previous = allYears[1].total_hours;
			const changePercent = ((current - previous) / previous) * 100;
			
			if (changePercent > 10) {
				trend = 'increasing';
			} else if (changePercent < -10) {
				trend = 'decreasing';
			}
		}
		
		return {
			current_period: currentYearData,
			historical_periods: historicalData,
			comparison: {
				trend,
				total_years_analyzed: allYears.length,
				average_hours_across_years: Math.round(
					allYears.reduce((sum, y) => sum + y.total_hours, 0) / allYears.length * 100
				) / 100,
				max_hours: Math.max(...allYears.map(y => y.total_hours)),
				min_hours: Math.min(...allYears.map(y => y.total_hours))
			}
		};
	} catch (error) {
		console.error('Error in getHistoricalComparison:', error);
		throw error;
	}
}

/**
 * Get comprehensive workload analytics including trends and patterns.
 * 
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date (default: 6 months ago)
 * @param {Date} options.endDate - End date (default: now)
 * @returns {Promise<Object>} Workload analytics
 */
async function getWorkloadAnalytics(options = {}) {
	try {
		const now = new Date();
		const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
		
		const startDate = options.startDate || sixMonthsAgo;
		const endDate = options.endDate || now;
		
		// Get worklogs
		const worklogs = await analyticsRepository.getAllWorklogsForForecast({
			startDate,
			endDate
		});
		
		if (worklogs.length === 0) {
			return {
				total_hours: 0,
				total_worklogs: 0,
				unique_users: 0,
				date_range: {
					start: startDate.toISOString(),
					end: endDate.toISOString()
				},
				weekly_data: [],
				monthly_data: []
			};
		}
		
		// Get weekly and monthly breakdowns
		const weeklyData = await analyticsRepository.getWorkloadByPeriod({
			startDate,
			endDate,
			groupBy: 'week'
		});
		
		const monthlyData = await analyticsRepository.getWorkloadByPeriod({
			startDate,
			endDate,
			groupBy: 'month'
		});
		
		// Calculate totals
		const totalSeconds = worklogs.reduce((sum, w) => sum + (w.time_spent_seconds || 0), 0);
		const uniqueUsers = new Set(worklogs.map(w => w.user_id)).size;
		
		// Calculate averages
		const avgWeeklyHours = weeklyData.length > 0
			? weeklyData.reduce((sum, w) => sum + w.total_seconds, 0) / weeklyData.length / 3600
			: 0;
		
		return {
			total_hours: Math.round(totalSeconds / 3600 * 100) / 100,
			total_worklogs: worklogs.length,
			unique_users: uniqueUsers,
			date_range: {
				start: startDate.toISOString(),
				end: endDate.toISOString()
			},
			averages: {
				weekly_hours: Math.round(avgWeeklyHours * 100) / 100,
				hours_per_user: Math.round((totalSeconds / 3600 / uniqueUsers) * 100) / 100
			},
			weekly_data: weeklyData.map(w => ({
				period: w.period_start,
				hours: Math.round(w.total_seconds / 3600 * 100) / 100,
				active_users: w.active_users,
				worklog_count: w.worklog_count
			})),
			monthly_data: monthlyData.map(m => ({
				period: m.period_start,
				hours: Math.round(m.total_seconds / 3600 * 100) / 100,
				active_users: m.active_users,
				worklog_count: m.worklog_count
			}))
		};
	} catch (error) {
		console.error('Error in getWorkloadAnalytics:', error);
		throw error;
	}
}

module.exports = {
	getHistoricalWorklogs,
	getWorkloadByPeriod,
	getHistoricalComparison,
	getWorkloadAnalytics
};
