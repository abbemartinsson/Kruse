require('dotenv').config({ path: './src/config/.env' });

const reportingService = require('../forecasting/reportingService');

const command = process.argv[2];

async function main() {
  try {
    if (command === 'get-project-info') {
      const projectKey = process.argv[3];

      if (!projectKey) {
        console.error('Missing project key. Usage: node src/scripts/reporting.js get-project-info <PROJECT_KEY>');
        process.exit(1);
      }

      const report = await reportingService.getProjectInfo(projectKey);

      if (!report) {
        console.error(`No project found for key: ${projectKey}`);
        process.exit(1);
      }

      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    }

    if (command === 'search-projects') {
      const query = process.argv[3];

      if (!query) {
        console.error('Missing search query. Usage: node src/scripts/reporting.js search-projects <QUERY>');
        process.exit(1);
      }

      const projects = await reportingService.searchProjects(query);

      if (projects.length === 0) {
        console.log('No projects found matching your search.');
        process.exit(0);
      }

      console.log(JSON.stringify(projects, null, 2));
      process.exit(0);
    }

    console.error('Unknown command. Supported commands: get-project-info, search-projects');
    process.exit(1);
  } catch (error) {
    console.error('Reporting error:', error.message || error);
    process.exit(1);
  }
}

main();
