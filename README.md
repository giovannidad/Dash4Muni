# Dash4Muni

Dashboard per i **sistemi informativi di un comune**: un'unica pagina con ricerca web, orologio, festività, notizie (RSS), avvisi e lo **stato dei servizi** (pallino verde lampeggiante / rosso), con avviso via email quando un servizio smette di rispondere.

- **Solo file**: HTML, CSS e JavaScript senza dipendenze né build. Si installa copiando i file su un qualsiasi web server.
- **Configurazione in JSON e testo**: ogni comune ha la sua cartella in `comuni/<nome>/`. Nessun database, nessun pannello di amministrazione.
- **PHP facoltativo**: serve solo per il controllo reale dello stato (codice HTTP 200), per l'avviso via email e per leggere i feed RSS di altri siti.
- **Adattivo**: da 1 a 3 colonne in base alla larghezza della pagina, tema chiaro/scuro, interfaccia in più lingue (italiano e inglese inclusi).

## Avvio rapido

1. Copia la cartella del progetto sul server (o avviane una copia in locale, vedi sotto).
2. Apri `index.html`: senza altro mostra la configurazione di esempio (`comuni/esempio/`).
3. Per un nuovo comune copia `comuni/esempio/` in `comuni/<nome>/` e modifica i file. Per mostrarlo di default crea un `comune.json` (parti da `comune.example.json`) con `{ "default": "<nome>" }`; in alternativa apri `index.html?comune=<nome>`.

Prova in locale (serve un server, i browser bloccano i file JSON aperti con doppio clic):

```bash
php -S localhost:8000          # con PHP: funzionano anche feed.php e monitor.php
# oppure, solo parte statica:
python3 -m http.server 8000
```

Poi apri http://localhost:8000.

## Cosa contiene

| Blocco | Cosa fa |
|---|---|
| elenco di collegamenti | titolo, icona, descrizione e pallino di stato per ogni sistema |
| `alert` | riquadro rosso a tutta larghezza, testo da un file `.txt` |
| `clock` | orologio digitale, 6 stili |
| `holidays` | prossime festività e calendario del mese |
| `rss` | titoli delle ultime notizie di un feed RSS/Atom |

Inoltre: motore di ricerca centrale con scelta del motore (elenco in `engines.json`), titolo e logo del comune, barra in fondo, preferenze dell'utente salvate nel browser.

## Documentazione

| Documento | Per chi |
|---|---|
| [docs/configurazione.md](docs/configurazione.md) | chi configura la dashboard di un comune: tutte le opzioni e i tipi di blocco |
| [docs/architettura.md](docs/architettura.md) | chi sviluppa: come è fatto il codice e come si estende |
| [docs/sviluppo.md](docs/sviluppo.md) | chi sviluppa: ambiente locale, prove manuali, come aggiungere blocchi e lingue |
| [CONTRIBUTING.md](CONTRIBUTING.md) | chi vuole contribuire: flusso di lavoro, regole, checklist della pull request |
| [SECURITY.md](SECURITY.md) | segnalazione di vulnerabilità e note di sicurezza |
| [CHANGELOG.md](CHANGELOG.md) | cronologia delle modifiche |

## Struttura del progetto

```
index.html          pagina unica
comune.json         facoltativo, non nel repository: comune mostrato quando l'URL non ne indica uno
comune.example.json modello per comune.json
feed.php            proxy facoltativo per i feed RSS (PHP)
monitor.php         controllo dei servizi e avviso email (PHP, facoltativo)
assets/             app.js, style.css, i18n/ (testi dell'interfaccia)
comuni/<nome>/      configurazione di un comune
  settings.json     titolo, logo, lingua, tema, layout, monitoraggio…
  engines.json      motori di ricerca
  holidays.json     festività
  sections.json     elenco ordinato delle sezioni
  sections/*.json   una sezione per file, con i suoi blocchi
data/               creata da monitor.php: stato dei controlli (non va in repository)
```

## Requisiti

- **Visualizzazione**: un browser recente (usa `fetch`, `ResizeObserver`, `color-mix`).
- **Server**: qualsiasi web server statico. Con PHP 7.4 o superiore (consigliato 8+) si abilitano controllo reale dello stato, email e feed RSS esterni. Per l'email serve che `mail()` sia configurato sul server.

## Contribuire

Segnalazioni, correzioni e nuove idee sono benvenute: leggi [CONTRIBUTING.md](CONTRIBUTING.md).

## Licenza

Copyright © 2026 Giovanni D'Addabbo, [giovannidaddabbo.com](https://www.giovannidaddabbo.com).

Licensed under the EUPL: il progetto è rilasciato con la **European Union Public Licence v. 1.2** (EUPL-1.2). Il testo completo è nel file [LICENSE](LICENSE).
