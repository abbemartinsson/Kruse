# Backend – Datainsamling och prognossystem

Backend för att samla historisk projektdata från **Jira** och **Tempo** och lagra den i **Supabase**. Systemet möjliggör analys av tidigare projekt och prognoser för framtida projekt.

---

## Installation

```bash
npm install
```

Skapa `.env`-fil i `src/config/` med:
```
SUPABASE_URL=din-supabase-url
SUPABASE_ANON_KEY=din-anon-key
SUPABASE_SERVICE_ROLE_KEY=din-service-role-key
JIRA_BASE_URL=din-jira-url
JIRA_EMAIL=din-email
JIRA_API_TOKEN=ditt-api-token
TEMPO_API_TOKEN=ditt-tempo-token
```

---

## Kommandon

### Synkronisering

Hämta data från Jira och Tempo och spara i databasen:

```bash
# Daglig synk (issues + worklogs)
npm run sync:daily

# Full synk (allt)
npm run sync:all

# Synka specifika tabeller
npm run sync:projects
npm run sync:users
npm run sync:issues
npm run sync:worklogs

# Uppdatera projekt-tidsstämplar (start_date, last_logged_issue)
npm run sync:timestamps
```

**OBS:** `start_date` och `last_logged_issue` uppdateras automatiskt efter worklog-sync i `sync:daily` och `sync:all`.

---

### Reporting och analys

#### 1. Sök efter projekt

Hitta projekt genom att söka på projektnamn eller project key (case-insensitive, fuzzy-matching).

**Kommando:**
```bash
npm run report:search-projects -- <sökord>
```

**Exempel:**
```bash
npm run report:search-projects -- hulta
npm run report:search-projects -- web
npm run report:search-projects -- ank
```

**Output:**
```json
[
  {
    "projectId": 3,
    "projectKey": "HULTP",
    "projectName": "Hultafors Project"
  },
  {
    "projectId": 8,
    "projectKey": "HULTA",
    "projectName": "Hultafors Internal Tools"
  }
]
```

Om inga projekt hittas:
```
No projects found matching your search.
```

---

#### 2. Hämta projektinfo

Få projektets tidsöversikt inklusive total tid, `start_date`, `last_logged_issue` och antal personer som loggat worklogs.

**Kommando:**
```bash
npm run report:get-project-info -- <PROJECT_KEY>
```

**Exempel:**
```bash
npm run report:get-project-info -- HULTP
npm run report:get-project-info -- ANK
```

**Output:**
```json
{
  "projectId": 3,
  "projectKey": "HULTP",
  "projectName": "Hultafors Project",
  "startDate": "2024-01-15T08:00:00.000Z",
  "lastLoggedIssue": "2026-03-09T09:30:00.000Z",
  "totalSeconds": 288000,
  "totalHours": 80.0,
  "contributorsCount": 7
}
```

Om projektet inte finns:
```
No project found for key: HULTP
```

---

## Arbetsflöde

**Typiskt användningsscenario:**

1. **Synka data från Jira/Tempo:**
   ```bash
   npm run sync:all
   ```

2. **Hitta rätt projekt:**
   ```bash
   npm run report:search-projects -- hulta
   ```

3. **Hämta projektstatistik:**
   ```bash
  npm run report:get-project-info -- HULTP
   ```

---

## Struktur

```
src/
├── clients/          API-kommunikation (Jira, Tempo)
├── config/           Konfiguration och miljövariabler
├── repositories/     Databasinteraktion (Supabase)
├── services/         Affärslogik
├── forecasting/      Analys och prognoser
├── scripts/          Körbara scripts
└── slack/            Slack-integration (kommande)
```

---

## Framtida funktioner

- Genomsnittlig projekttid
- Prognos för nya projekt baserat på historik
- Slack-bot för att köra kommandon direkt i Slack
- Fler analysverktyg