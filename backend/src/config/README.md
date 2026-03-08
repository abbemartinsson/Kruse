# Config

Denna mapp innehåller all konfiguration för systemet.

## Filer

- `.env` - Miljövariabler (kopiera från .env.example och fyll i riktiga värden)
- `jira.js` - Jira API-konfiguration
- `tempo.js` - Tempo API-konfiguration
- `supabase.js` - Supabase databas-konfiguration
- `index.js` - Exporterar alla konfigurationer

## Användning

```javascript
const config = require('./config');
console.log(config.jira.baseUrl);
```