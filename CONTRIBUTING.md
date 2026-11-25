# Contribuire a Dash4Muni

Grazie dell'interesse! Questo documento spiega come proporre modifiche. Puoi scrivere in italiano o in inglese.

## Come puoi aiutare

- **Segnalare un problema**: apri una *issue* con il modello "Segnalazione di errore".
- **Proporre una funzione**: apri una *issue* con il modello "Richiesta di funzione" e descrivi il bisogno prima della soluzione.
- **Correggere o migliorare**: apri una *pull request* (vedi sotto).
- **Tradurre**: aggiungere una lingua è semplice, vedi [docs/sviluppo.md](docs/sviluppo.md#aggiungere-una-lingua).
- **Migliorare la documentazione**: sono ben accettate anche le correzioni piccole.

Per modifiche grandi (nuovi tipi di blocco, cambiamenti al formato dei file di configurazione) apri prima una issue, così ci accordiamo sulla direzione prima che tu scriva codice.

## Principi da rispettare

1. **Nessuna build e nessuna dipendenza.** Niente npm, bundler, framework o librerie caricate da CDN: l'installazione deve restare "copia i file sul server".
2. **Configurazione nei file, non nel codice.** Una nuova possibilità si espone come opzione in `settings.json` o nel blocco, con un valore predefinito che mantiene il comportamento di prima.
3. **Compatibilità.** Le configurazioni esistenti non devono smettere di funzionare. Se serve rompere la compatibilità, va scritto nel [CHANGELOG](CHANGELOG.md) e discusso prima.
4. **Funziona anche senza PHP.** PHP può aggiungere funzioni, ma la dashboard deve restare usabile su hosting statico.
5. **Sicurezza.** Testo di configurazione e dei feed solo con `textContent`; indirizzi solo `http(s)`; niente input libero verso server esterni. Vedi [SECURITY.md](SECURITY.md).
6. **Privacy e dati reali.** Non committare indirizzi email, nomi o dati reali di persone, password, token o chiavi. Le configurazioni di esempio usano solo dati fittizi (`example.org`, `ict@example.org`).

## Flusso di lavoro

1. **Fork** del repository e creazione di un ramo dal ramo principale, con un nome descrittivo: `fix/calendario-mese-corto`, `feat/blocco-meteo`, `docs/guida-installazione`.
2. **Modifica** seguendo [docs/sviluppo.md](docs/sviluppo.md) (ambiente locale, stile, ricette).
3. **Prova** con la lista in [docs/sviluppo.md](docs/sviluppo.md#prove-manuali), sulla configurazione `esempio`.
4. **Documenta**: aggiorna [docs/configurazione.md](docs/configurazione.md) se cambia ciò che vede chi configura, [docs/architettura.md](docs/architettura.md) se cambia la struttura del codice, e il [CHANGELOG](CHANGELOG.md).
5. **Commit** piccoli e con un messaggio chiaro (vedi sotto).
6. **Pull request** verso il ramo principale, compilando il modello.

### Messaggi di commit

Una riga di riepilogo (massimo ~70 caratteri) all'imperativo o in forma nominale, in italiano o inglese, con un prefisso opzionale:

```
feat: aggiunge il blocco meteo
fix: il calendario mostra il mese corretto a febbraio
docs: spiega come configurare il cron
refactor: separa la lettura dei feed dal disegno
```

Nel corpo spiega il **perché** della modifica, non solo il cosa.

### Pull request

Una buona pull request:

- fa **una cosa sola** ed è abbastanza piccola da essere letta con calma;
- spiega il problema che risolve e come l'hai provata (browser e versione, con o senza PHP);
- include, per le modifiche visive, una schermata (chiaro e scuro, largo e stretto);
- passa la lista di controllo del modello.

## Checklist rapida

- [ ] `node --check assets/app.js` e `php -l` sui file PHP modificati senza errori
- [ ] tutti i JSON validi
- [ ] nessuna dipendenza nuova, nessun errore nuovo in console
- [ ] testo dell'interfaccia aggiunto in **tutte** le lingue di `assets/i18n/`
- [ ] tema chiaro e scuro controllati; layout a 1, 2 e 3 colonne controllato
- [ ] documentazione e CHANGELOG aggiornati
- [ ] nessun dato reale o segreto nei file

## Comportamento

Siamo qui per costruire uno strumento utile ai comuni. Si discute del codice e delle idee, mai delle persone: rispetto, pazienza e gentilezza con tutti, in particolare con chi è alla prima contribuzione.

## Licenza dei contributi

Il progetto è rilasciato con la **EUPL-1.2** (vedi [LICENSE](LICENSE)). Inviando una modifica accetti che venga rilasciata con la stessa licenza.
