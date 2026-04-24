# LineaChiara

Web app locale per monitorare dimagrimento e analizzare i pasti con AI.

## Avvio

1. Copia `.env.example` in `.env`
2. Inserisci la tua `OPENAI_API_KEY`
3. Avvia il server:

```bash
npm start
```

4. Apri [http://localhost:3000](http://localhost:3000)

## Analisi pasti con AI

L'app usa un endpoint locale `/api/analyze-meal` che invia la foto all'API OpenAI tramite il server Node locale.

- Modello predefinito: `gpt-4.1-mini`
- Variabile configurabile: `OPENAI_MODEL`
- La chiave API resta nel backend locale, non nel browser

## Note

- Le calorie e i macro sono stime
- Se aggiungi più pasti nello stesso giorno, il totale calorie del check-in viene aggiornato automaticamente
