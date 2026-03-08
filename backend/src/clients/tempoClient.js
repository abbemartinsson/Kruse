const axios = require('axios');
const config = require('../config').tempo;

// Simple Tempo client to wrap HTTP calls.
class TempoClient {
  constructor() {
    if (!config.baseUrl || !config.apiToken) {
      throw new Error('Tempo configuration is missing, make sure .env is loaded');
    }

    this.http = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiToken}`,
      },
    });
  }

  /**
   * Fetch all Tempo worklogs.
   * Returns an array of worklog objects as Tempo delivers them.
   */
  async fetchAllWorklogs() {
    const allWorklogs = [];
    const limit = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const resp = await this.http.get('/worklogs', {
        params: {
          offset,
          limit,
        },
      });

      const batch = resp.data.results || [];
      allWorklogs.push(...batch);

      // Tempo pagination can vary between tenants; use the safest continuation rule.
      // Keep paging while we receive full batches, stop when the API returns a short/empty batch.
      offset += batch.length;
      hasMore = batch.length === limit;
    }

    return allWorklogs;
  }
}

module.exports = new TempoClient();
