# Backendstruktur – Datainsamling och prognossystem

## Syfte

Detta dokument beskriver hur backend-koden bör struktureras för systemet som hämtar data från Jira och Tempo, lagrar den i Supabase och gör den tillgänglig för vidare analys och prognoser.

Målet är att ha en **tydlig och professionell kodstruktur** som gör systemet lätt att:

* utveckla vidare
* underhålla
* felsöka
* skala upp vid behov

Systemet består huvudsakligen av tre funktionella delar:

1. Datainsamling (sync från API:er)
2. Databasinteraktion
3. Analys och integrationer (t.ex. Slack)

---

# Översikt av backend

Backendens huvuduppgift är att:

1. Hämta data från Jira och Tempo
2. Transformera datan till rätt format
3. Spara den i databasen
4. Göra datan tillgänglig för analys och Slack-kommandon

Översiktligt flöde:

```
Jira API
Tempo API
   │
   │
   ▼
API Clients
   │
   ▼
Services (business logic)
   │
   ▼
Repositories (database layer)
   │
   ▼
Supabase Database
```

---

# Rekommenderad mappstruktur

```
backend/
│
├── src/
│
│   ├── config/
│   │
│   ├── clients/
│   │
│   ├── services/
│   │
│   ├── repositories/
│   │
│   ├── jobs/
│   │
│   ├── utils/
│   │
│   ├── forecasting/
│   │
│   ├── slack/
│   │
│   └── index
│
├── scripts/
│
├── tests/
│
└── README.md
```

Varje del har ett tydligt ansvar.

---

# config

```
src/config/
```

Denna mapp innehåller konfiguration för hela systemet.

Exempel:

* API-nycklar
* databasanslutning
* miljövariabler

Exempel på filer:

```
env
supabase
jira
tempo
```

Syftet är att **alla externa inställningar ska ligga på ett ställe**.

---

# clients

```
src/clients/
```

Clients ansvarar för att kommunicera med externa API:er.

Här ska endast kod som gör **HTTP-anrop** finnas.

Exempel på clients:

```
jiraClient
tempoClient
```

Ansvar:

* skicka requests till API:er
* ta emot svar
* returnera datan

Clients ska **inte innehålla affärslogik**.

Exempel på vad en client gör:

* hämta projekt från Jira
* hämta issues
* hämta worklogs från Tempo

---

# services

```
src/services/
```

Services innehåller systemets **affärslogik**.

De använder:

* clients
* repositories

Exempel på services:

```
projectService
issueService
worklogService
syncService
```

Exempel på ansvar:

* synkronisera projekt
* synkronisera issues
* synkronisera worklogs

En service kan exempelvis:

1. hämta issues från Jira
2. transformera datan
3. spara den i databasen

---

# repositories

```
src/repositories/
```

Repositories ansvarar för **all databasinteraktion**.

All kod som skriver eller läser från databasen ska ligga här.

Exempel på repositories:

```
projectRepository
issueRepository
userRepository
worklogRepository
```

Exempel på funktioner:

* insert project
* update issue
* upsert worklog
* fetch project data

Detta gör att resten av systemet **inte behöver veta hur databasen fungerar**.

---

# jobs

```
src/jobs/
```

Jobs ansvarar för **schemalagda uppgifter**.

Här ligger logik som körs automatiskt, exempelvis daglig synkronisering.

Exempel:

```
dailySyncJob
```

Denna job ska:

1. starta synkronisering
2. hämta projekt
3. hämta användare
4. hämta issues
5. hämta worklogs

Jobs kan köras via:

* cron
* scheduler
* manuellt script

---

# utils

```
src/utils/
```

Denna mapp innehåller hjälpfunktioner som används på flera ställen.

Exempel:

```
logger
dateHelpers
apiHelpers
```

Typiska funktioner:

* loggning
* datumhantering
* felhantering

---

# forecasting

```
src/forecasting/
```

Här ligger kod för analys och prognoser.

Denna del kommer att använda:

* data från databasen
* Python-modeller

Exempel på funktioner:

* beräkna genomsnittlig projekttid
* analysera historiska projekt
* generera prognoser

Denna modul används senare av Slack-boten.

---

# slack

```
src/slack/
```

Denna mapp innehåller integrationen mot Slack.

Här hanteras:

* slash commands
* inkommande requests
* svar till Slack

Exempel:

```
commandHandlers
slackClient
```

Exempel på commands:

```
/forecast
/project-hours
```

---

# scripts

```
scripts/
```

Scripts används för manuella operationer.

Exempel:

* köra full sync
* testa API:er
* migrera data

---

# tests

```
tests/
```

Denna mapp innehåller tester för systemet.

Exempel:

* test av API clients
* test av services
* test av forecasting

---

# Rekommenderat dataflöde

När systemet kör den dagliga synkroniseringen sker följande:

1. Job startas
2. Jira client hämtar projekt
3. Service bearbetar datan
4. Repository sparar projekten
5. Jira client hämtar issues
6. Repository sparar issues
7. Tempo client hämtar worklogs
8. Repository sparar worklogs

---

# Daglig synkronisering

Synkroniseringen ska köras **en gång per dag**.

Rekommenderat flöde:

```
1. sync projects
2. sync users
3. sync issues
4. sync worklogs
```

Varje steg ska använda **upsert** i databasen för att undvika duplicerade rader.

---

# Viktiga principer

Backendkoden ska följa dessa principer:

### Separation of concerns

Varje del av systemet har ett tydligt ansvar:

* clients → externa API:er
* services → affärslogik
* repositories → databas

---

### Återanvändbar kod

Kod ska delas upp i mindre funktioner som kan återanvändas.

---

### Tydlig struktur

Alla utvecklare ska snabbt kunna förstå:

* var kod ligger
* vad den gör
* hur systemet fungerar

---

# Sammanfattning

Backendstrukturen ska göra systemet:

* stabilt
* lätt att utveckla vidare
* lätt att underhålla

Genom att dela upp systemet i:

* clients
* services
* repositories
* jobs
* forecasting
* slack

kan varje del utvecklas separat samtidigt som systemet behåller en tydlig struktur.
