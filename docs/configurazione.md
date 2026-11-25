# Configurazione

Riferimento per chi configura la dashboard di un comune. Tutto si fa con file di testo (JSON e `.txt`) dentro `comuni/<nome>/`; non serve toccare il codice.

## Indice

- [Un comune, una cartella](#un-comune-una-cartella)
- [Scegliere il comune](#scegliere-il-comune)
- [settings.json](#settingsjson)
- [Sezioni e blocchi](#sezioni-e-blocchi)
- [Tipi di blocco](#tipi-di-blocco): elenco di collegamenti, `alert`, `clock`, `holidays`, `rss`
- [Stato dei servizi e avviso email](#stato-dei-servizi-e-avviso-email)
- [Motori di ricerca](#motori-di-ricerca)
- [Lingue](#lingue)
- [Preferenze dell'utente](#preferenze-dellutente)

## Un comune, una cartella

```
comuni/<nome>/
  settings.json     impostazioni generali
  engines.json      motori di ricerca
  holidays.json     festività
  sections.json     elenco ordinato dei file-sezione
  sections/         un file JSON per sezione
  logo.png          stemma (o .svg), facoltativo
  avviso.txt        esempio di testo per un blocco "alert"
```

I percorsi scritti nei file di un comune (logo, icone, `sections.json`, `file` degli avvisi, feed locali) sono **relativi alla cartella del comune**.
`<nome>` può contenere solo lettere, numeri, `-` e `_`.

## Scegliere il comune

- `index.html?comune=esempio` mostra `comuni/esempio/`.
- Senza parametro si usa il `default` del file `comune.json`; se il file non c'è si usa `esempio`.
- `comune.json` è locale a ogni installazione e **non fa parte del repository**: crealo partendo da `comune.example.json`, con contenuto `{ "default": "<nome>" }`.
- Nuovo comune: copia `comuni/esempio/` in `comuni/<nome>/`, modifica i file, poi apri `?comune=<nome>` oppure imposta il `default` in `comune.json`.

Nel repository c'è solo `comuni/esempio/` (il `.gitignore` esclude le altre cartelle di `comuni/`), così le configurazioni reali dei comuni, con i loro indirizzi e contatti, non finiscono online per sbaglio. Se vuoi versionare la configurazione di un comune, fallo in un repository privato separato.

## settings.json

Tutte le voci sono facoltative tranne dove indicato; un testo può essere una stringa oppure un oggetto per lingua: `{ "it": "…", "en": "…" }`.

```json
{
  "title": { "it": "Comune di Esempio", "en": "Example Municipality" },
  "subtitle": { "it": "Dashboard dei servizi", "en": "Services dashboard" },
  "logo": "logo.svg",
  "logoAlt": { "it": "Stemma del Comune", "en": "Municipality crest" },
  "logoLink": "",
  "footer": { "text": "Autore:", "link": "https://example.org", "linkLabel": "Nome Cognome" },
  "defaultLanguage": "it",
  "languages": { "it": "Italiano", "en": "English" },
  "defaultTheme": "auto",
  "defaultEngine": "duckduckgo",
  "layout": { "maxColumns": 3, "minColumnWidth": 300, "maxWidth": 1600 },
  "linkTarget": "_blank",
  "searchInNewTab": false,
  "refreshSeconds": 120,
  "timeoutSeconds": 8,
  "feedProxy": "feed.php?url={url}",
  "monitor": { "enabled": false }
}
```

| Voce | Significato |
|---|---|
| `title`, `subtitle` | titolo centrale e riga sotto; il titolo è anche il titolo della scheda del browser |
| `logo` | immagine nella cartella del comune, mostrata sopra il titolo con **massimo 120×120 px** (proporzioni mantenute). Vuoto o non trovato: nessun logo |
| `logoAlt`, `logoLink` | testo alternativo; URL se il logo deve essere cliccabile |
| `footer` | barra alta 20 px in fondo: `text`, `link`, `linkLabel` (senza `linkLabel` si mostra l'indirizzo). Rimuovendo `footer` la barra scompare |
| `defaultLanguage`, `languages` | lingua iniziale e lingue offerte (vedi [Lingue](#lingue)) |
| `defaultTheme` | `auto` (segue il sistema), `light` o `dark`. L'utente può cambiarlo |
| `defaultEngine` | `id` del motore di ricerca predefinito |
| `layout` | vedi sotto |
| `linkTarget` | `"_blank"` apre i link in una nuova scheda (default), `"_self"` nella stessa. Vale per collegamenti, feed, logo e barra in fondo |
| `searchInNewTab` | `true` apre i risultati di ricerca in una nuova scheda |
| `refreshSeconds` | ogni quanti secondi la dashboard rilegge lo stato dei servizi. Se manca, o vale 0, non c'è aggiornamento automatico (resta il pulsante ↻). Consigliato 120 |
| `timeoutSeconds` | timeout dei controlli e dei feed dal browser (default 8) |
| `feedProxy` | indirizzo del proxy per i feed RSS; `{url}` è sostituito dall'indirizzo del feed. Vuoto: nessun proxy |
| `monitor` | controllo dei servizi sul server e avviso email (vedi sotto) |

### Layout

Le colonne si calcolano dalla **larghezza reale della pagina** e cambiano mentre si ridimensiona la finestra: da 1 colonna (telefono) a 3 (schermo largo). Si usano tante colonne quante ne stanno con almeno `minColumnWidth` pixel ciascuna.

| Voce | Default | Significato |
|---|---|---|
| `maxColumns` | 3 | numero massimo di colonne (fino a 6) |
| `minColumnWidth` | 300 | larghezza minima di una colonna, in px |
| `maxWidth` | 1600 | larghezza massima del contenuto, in px; oltre resta centrato |

Un blocco con `"column": 3` finisce nell'ultima colonna disponibile quando le colonne sono meno di 3.

### Apertura dei collegamenti

L'ordine di priorità è: `"target"` sul collegamento, `"target"` sul blocco, `linkTarget` in `settings.json`, `"_blank"`. I valori ammessi sono `"_blank"` e `"_self"`.

## Sezioni e blocchi

Una **sezione** è un file in `sections/`; contiene **blocchi**. L'ordine delle sezioni è quello di `sections.json`:

```json
{ "sections": [ "sections/oggi.json", "sections/notizie.json" ] }
```

Esempio di sezione:

```json
{
  "title": { "it": "Titolo", "en": "Title" },
  "blocks": [
    {
      "title": "Nome blocco",
      "column": 2,
      "items": [
        { "title": "Sito", "url": "https://example.com", "icon": "🌐",
          "description": "Testo opzionale", "check": "https://example.com/health" }
      ]
    }
  ]
}
```

Per creare una nuova sezione: aggiungi il file in `sections/` e il suo percorso in `sections.json`.

**Opzioni comuni a tutti i blocchi**

| Opzione | Significato |
|---|---|
| `type` | tipo di blocco; senza `type` è un elenco di collegamenti |
| `title` | titolo del blocco (stringa o oggetto per lingua) |
| `column` | colonna di destinazione (1–3). Senza, il blocco va nella colonna con meno contenuto |
| `fullWidth` | `true` = occupa tutta la larghezza, sopra le colonne della sezione (default per `alert`) |
| `target` | `"_blank"` o `"_self"` per i collegamenti del blocco |

## Tipi di blocco

### Elenco di collegamenti

Senza `type`. Ogni elemento di `items`:

| Opzione | Significato |
|---|---|
| `title` | titolo (obbligatorio) |
| `url` | indirizzo del collegamento |
| `description` | riga di testo sotto il titolo |
| `icon` | emoji, oppure immagine (percorso relativo alla cartella del comune, o URL). Senza icona si prova `/favicon.ico` del sito, poi la lettera iniziale |
| `favicon` | `false` salta il tentativo di usare la favicon del sito |
| `check` | `false` = nessun pallino di stato; un URL = controlla quell'indirizzo invece di `url` |
| `expectCodes` | codici HTTP considerati "online", ad esempio `[200, 401]` (default `[200]`) |
| `target` | `"_blank"` o `"_self"` per questo collegamento |

### `alert`: avviso su sfondo rosso

```json
{ "type": "alert", "file": "avviso.txt" }
```

Riquadro rosso con icona di avviso, titolo e descrizione, a **tutta la larghezza**.

- **Testo da file**: `file` indica un file di testo nella cartella del comune. La **prima riga è il titolo**, le righe successive sono la descrizione (gli a capo sono mantenuti). Modificando il file l'avviso si aggiorna da solo entro `refreshSeconds` del blocco (default 120).
- **File vuoto = nessun avviso**: per toglierlo basta svuotare il file.
- **Testo nel JSON**: in alternativa, o se il file manca, `"title"` e `"description"` direttamente nel blocco.
- `file` può essere un oggetto per lingua: `{ "it": "avviso.it.txt", "en": "avviso.en.txt" }`.
- `"fullWidth": false` lo mette in una colonna.

### `clock`: orologio digitale

```json
{ "type": "clock", "column": 1, "style": "accent", "seconds": false, "hour12": false, "timezone": "Europe/Rome" }
```

| Opzione | Significato |
|---|---|
| `style` | aspetto, default `accent` (elenco sotto) |
| `seconds` | mostra i secondi. Se non indicato: nascosti in `accent`, visibili negli altri stili |
| `hour12` | formato 12 ore (default `false`) |
| `timezone` | fuso orario, ad esempio `"Europe/Rome"` (default: quello del dispositivo) |

Stili: `accent` (colore di accento, compatto), `led` (cifre verdi su blu notte), `amber` (cifre arancioni su fondo scuro caldo), `lcd` (cifre scure su fondo verde-grigio con segmenti spenti), `minimal` (cifre grandi e sottili, segue il tema), `flip` (ogni cifra su una carta).
Si possono mettere più orologi, ad esempio con fusi o stili diversi.

### `holidays`: festività

```json
{ "type": "holidays", "title": "Prossime festività", "column": 1, "count": 5, "calendar": "closed" }
```

Mostra le prossime `count` festività (default 5) e un calendario del mese. `calendar` decide come parte:

- `"open"` (default): calendario visibile, con il pulsante "Nascondi calendario";
- `"closed"`: chiuso all'avvio, con il pulsante "Mostra calendario";
- `"none"`: nessun calendario, solo l'elenco.

Le festività sono in `holidays.json` del comune:

```json
{ "holidays": [
  { "date": "12-25", "name": { "it": "Natale", "en": "Christmas Day" } },
  { "easter": 1, "name": { "it": "Lunedì dell'Angelo", "en": "Easter Monday" } }
] }
```

`date` è `MM-GG` (data fissa); `easter` è lo scarto in giorni dalla Pasqua (0 = Pasqua, 1 = Pasquetta), calcolata automaticamente ogni anno. Aggiungi qui anche il santo patrono.

### `rss`: feed RSS / Atom

```json
{ "type": "rss", "url": "https://example.com/feed.xml", "title": "Nome",
  "count": 5, "showDescription": false, "refreshMinutes": 30 }
```

| Opzione | Significato |
|---|---|
| `url` | indirizzo del feed (RSS 2.0, RSS 1.0 o Atom) |
| `title` | titolo del blocco; se manca si usa quello del feed |
| `count` | quante notizie mostrare (default 6) |
| `showDescription` | mostra un estratto senza HTML (default `false`) |
| `refreshMinutes` | ogni quanti minuti riscaricare il feed (default 15) |

**Come viene letto il feed.** Prima tramite `feed.php` (impostazione `feedProxy`), poi direttamente dal browser. La maggior parte dei siti non consente al browser di leggere i propri feed (CORS): senza PHP funzionano solo i feed della stessa origine o con CORS abilitato; gli altri mostrano "Feed non disponibile".
`feed.php` accetta **solo** gli URL dei blocchi `rss` presenti nelle sezioni dei comuni, rifiuta indirizzi interni (anche dopo un redirect), limita la dimensione a 2 MB e tiene i risultati in cache per 5 minuti.

## Stato dei servizi e avviso email

Ogni collegamento ha un pallino: **verde lampeggiante** = online, **rosso** = problema, **grigio** = controllo in corso. Il tooltip dice il motivo (ad esempio "Online (HTTP 200) · controllo delle 19:48").

Due modalità; la dashboard usa la prima se `monitor.php` risponde, altrimenti la seconda:

1. **Controllo sul server** (richiede PHP, consigliato). `monitor.php` legge il vero codice HTTP: un servizio è online solo se risponde con un codice atteso (default **200**, redirect seguiti). La dashboard si limita a leggere il risultato.
2. **Controllo dal browser** (senza PHP). Per i siti esterni il browser non può leggere il codice HTTP (CORS): il pallino è verde se l'host risponde, rosso se non è raggiungibile; un 404/500 esterno risulterebbe verde. I controlli non sono più frequenti di `monitor.intervalSeconds` per non pesare sui siti. Se la dashboard è su HTTPS, gli URL `http://` appaiono rossi.

### Configurazione del monitoraggio

In `settings.json`, voce `monitor`:

```json
"monitor": {
  "enabled": true,
  "intervalSeconds": 300,
  "timeoutSeconds": 10,
  "failuresBeforeAlert": 2,
  "reminderHours": 0,
  "notifyOnRecovery": false,
  "verifySsl": true,
  "timezone": "Europe/Rome",
  "email": {
    "enabled": true,
    "to": "ict@example.org",
    "from": "",
    "fromName": "Dash4Muni",
    "subject": "Attenzione: Servizio Down"
  }
}
```

| Voce | Significato |
|---|---|
| `enabled` | attiva il monitoraggio sul server |
| `intervalSeconds` | un controllo ogni N secondi (default 300, minimo 60), qualunque sia il numero di visitatori |
| `timeoutSeconds` | timeout per sito (default 10, tra 3 e 30) |
| `failuresBeforeAlert` | controlli falliti di fila prima dell'avviso (default 2, evita i falsi allarmi) |
| `reminderHours` | se > 0, ripete l'avviso ogni N ore finché il servizio è giù (default 0 = una volta sola) |
| `notifyOnRecovery` | invia una email anche quando il servizio torna online |
| `verifySsl` | `false` accetta certificati non validi |
| `timezone` | fuso per gli orari nelle email (default `Europe/Rome`) |
| `email.enabled` | abilita l'invio |
| `email.to` | destinatario; più indirizzi separati da virgola |
| `email.from`, `email.fromName` | mittente; con `from` vuoto si usa `dashboard@<dominio del server>` |
| `email.subject` | oggetto (default "Attenzione: Servizio Down"); `email.recoverySubject` per il ripristino |

**Cosa viene controllato.** Tutti i collegamenti degli elenchi con indirizzo `http(s)://` assoluto, tranne quelli con `"check": false`. I controlli sono sequenziali e scaricano al massimo 64 KB per sito.

**Email.** Quando un servizio non risponde per `failuresBeforeAlert` controlli di fila parte **una** email con oggetto "Attenzione: Servizio Down"; il corpo elenca servizio, indirizzo, esito, da quando è giù e l'orario. Più servizi caduti nello stesso controllo finiscono in un'unica email. L'avviso non si ripete finché il servizio non torna online (salvo `reminderHours`).

**Quando parte il controllo.** Il server controlla quando qualcuno ha la dashboard aperta. Perché l'avviso arrivi anche a dashboard chiusa, aggiungi un cron:

```
*/5 * * * * php /percorso/Dash4Muni/monitor.php <nome>
```

**Requisiti.** PHP con `mail()` funzionante (server di posta configurato) e permesso di scrittura sulla cartella `data/` (si crea da sola; se non è scrivibile si usa la cartella temporanea di sistema). Lo stato è in `data/status-<nome>.json`.

**Prova senza inviare nulla.**

```bash
php monitor.php <nome> --dry-run
```

Esegue i controlli e stampa l'email che partirebbe, senza inviarla né salvare lo stato.

## Motori di ricerca

`engines.json` elenca i motori; `{q}` è il testo cercato:

```json
{ "engines": [
  { "id": "duckduckgo", "name": "DuckDuckGo", "url": "https://duckduckgo.com/?q={q}" }
] }
```

`defaultEngine` in `settings.json` è l'`id` del motore iniziale. La scelta dell'utente viene ricordata.

## Lingue

I testi dell'interfaccia sono in `assets/i18n/<lingua>.json`. Per aggiungere una lingua copia `assets/i18n/en.json` in `assets/i18n/fr.json`, traducilo e aggiungi `"fr": "Français"` a `languages` in `settings.json`. I testi dei comuni (titoli, descrizioni) possono avere una versione per lingua; se manca quella richiesta si usa la lingua predefinita.

## Preferenze dell'utente

Tema, motore di ricerca e lingua scelti dall'utente sono salvati nel `localStorage` del browser (chiave `dash4muni.prefs`): valgono per quel browser e quel dispositivo e prevalgono sui valori predefiniti di `settings.json`.
