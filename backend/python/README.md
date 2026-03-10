# Python Machine Learning för Arbetsbelastningsprognoser

Detta system använder Prophet (Facebook's time series forecasting library) för att prediktera framtida arbetsbelastning baserat på historiska worklogs.

## Installation

### 1. Installera Python 3.8+

Se till att du har Python installerat:
```bash
python --version
```

### 2. Installera Python-dependencies

```bash
cd backend/python
pip install -r requirements.txt
```

Eller med virtual environment (rekommenderat):
```bash
cd backend/python
python -m venv venv
source venv/bin/activate  # På Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Dependencies

- **pandas**: Datahantering och aggregering
- **numpy**: Numeriska beräkningar
- **scikit-learn**: Machine learning utilities
- **prophet**: Time series forecasting (Facebook Prophet)
- **python-dateutil**: Datumhantering

## Hur det fungerar

### Input
Scriptet tar emot JSON-data via stdin:
```json
{
  "worklogs": [
    {
      "time_spent_seconds": 7200,
      "started_at": "2024-01-15T09:00:00Z",
      "user_id": 123
    }
  ],
  "forecast_months": 3,
  "include_historical": true
}
```

### Process
1. **Data preparation**: Konverterar worklogs till veckodata och aggregerar timmar
2. **Model training**: Tränar Prophet-modell med historiska data
3. **Forecasting**: Genererar veckovisa och månadsvisa prognoser
4. **Historical comparison**: Jämför med samma period tidigare år

### Output
Scriptet returnerar JSON med:
- Veckovisa prognoser med konfidensintervall
- Månadsvisa aggregerade prognoser
- Historisk jämförelse (samma månad tidigare år)
- Nuvarande statistik och trender
- Datavalidering och kvalitetsmått

## Modellkonfiguration

Prophet-modellen är konfigurerad för:
- **Yearly seasonality**: Identifierar årsvariation
- **Changepoint prior scale**: 0.05 (låg för stabila prognoser)
- **Seasonality prior scale**: 10.0 (medelhög för säsongsmönster)

## Användning från Node.js

Systemet anropas automatiskt från `forecastService.js`:

```javascript
const forecast = await forecastService.generateWorkloadForecast({
  forecastMonths: 3,
  includeHistorical: true
});
```

## Felsökning

### "Python not found"
- Kontrollera att Python är installerat och finns i PATH
- På Windows: Använd `python` eller `py` kommandot

### "Module not found"
- Installera dependencies: `pip install -r requirements.txt`
- Kontrollera virtual environment är aktiverat

### "Insufficient data for forecasting"
- Prophet kräver minst 8 veckors data för säkra prognoser
- Synkronisera mer historisk data från Jira/Tempo

### Import errors
- Vissa installationer kräver `python3` istället för `python`
- Uppdatera `forecastService.js` om annan Python-kommando behövs

## Prestandatips

- Första körningen tar längre tid (model training)
- Mer historisk data = bättre prognoser
- Prophet rekommenderas för data med tydliga mönster
- Minst 3-6 månaders historik rekommenderas

## Framtida förbättringar

- Support för ARIMA och andra modeller
- Automatisk modellval baserat på data
- Hyperparameter tuning
- Konfidensintervall-kalibrering
- Ensemble methods för robusthet
