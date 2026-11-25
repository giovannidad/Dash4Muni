# Architettura

Come è fatto Dash4Muni, per chi vuole modificarlo o estenderlo. Per l'uso e la configurazione vedi [configurazione.md](configurazione.md).

## Principi

1. **Nessuna build, nessuna dipendenza.** HTML, CSS e JavaScript "vanilla", serviti così come sono. Chi installa copia i file.
2. **Configurazione = file.** Il comportamento si cambia con JSON e testo in `comuni/<nome>/`, mai nel codice.
3. **Funziona senza PHP.** PHP aggiunge funzioni (stato reale, email, feed esterni), ma la dashboard deve restare utilizzabile su un hosting statico.
4. **Un comune non deve poter rompere gli altri.** Ogni comune vive nella propria cartella; il codice è condiviso.
5. **Sicura per costruzione.** Il testo di configurazione e dei feed finisce nella pagina solo come testo, mai come HTML.

## File del codice

| File | Ruolo |
|---|---|
| `index.html` | scheletro della pagina; un piccolo script nell'`<head>` applica il tema salvato prima del primo disegno per evitare lampi di colore |
| `assets/app.js` | tutta la logica (un solo IIFE, nessun modulo) |
| `assets/style.css` | stili, temi e layout |
| `assets/i18n/*.json` | testi dell'interfaccia per lingua |
| `feed.php` | proxy dei feed RSS |
| `monitor.php` | controllo dei servizi e avviso email |

## Avvio della pagina (`init()` in `app.js`)

```
loadPrefs()                  preferenze da localStorage
pickComune()                 ?comune= → comune.json → "esempio"; il nome è validato con /^[a-z0-9_-]+$/i
settings.json                impostazioni del comune
loadStrings()                assets/i18n/<lingua>.json
applyTheme / setTitle / setFooter / applyLayout / renderLangs / applyStrings
engines.json, holidays.json
loadSections()               sections.json + ogni file-sezione (Promise.allSettled: un file rotto non blocca gli altri)
render()                     costruisce il DOM
runChecks()                  stato dei servizi
timer                        orologio (1 s), feed e avvisi (30 s), stato dei servizi (refreshSeconds)
eventi                       ricerca, tema, lingua, ResizeObserver, tasto "/"
```

Tutto lo stato è nell'oggetto `state` (impostazioni, sezioni, stringhe, preferenze, mappe di stato e cache).

## Percorsi e comuni

`state.base` vale `comuni/<nome>/`. La funzione `res(percorso)` anteponi `state.base` ai percorsi relativi (non agli URL assoluti, ai percorsi che iniziano con `/` e ai `data:`): è l'unico punto in cui si risolvono i percorsi dei file di configurazione. Ogni nuovo campo che contiene un percorso va passato da `res()`.

## Rendering

`render()` ricostruisce da zero il contenuto di `#sections`:

1. `colCount()` calcola le colonne dalla larghezza di `#sections` e dai parametri `layout` (`layoutCfg()`).
2. Per ogni sezione crea una griglia CSS con `--cols` colonne; ogni colonna è un `div.col`.
3. I blocchi "a tutta larghezza" (`alert`, o `fullWidth: true`) vanno direttamente nella griglia con `grid-column: 1 / -1`, prima delle colonne.
4. Gli altri blocchi vanno nella colonna indicata da `column` (limitata alle colonne disponibili) oppure nella meno carica (peso = 2 + numero di elementi).
5. Un `ResizeObserver` su `#sections` richiama `render()` solo se il numero di colonne cambia. Per questo i blocchi devono potersi ridisegnare senza perdere lo stato: stati e cache stanno in `state`, non nel DOM.

`renderBlock(block, id)` sceglie il disegno in base a `block.type`:

| `type` | Funzione |
|---|---|
| `alert` | `renderAlert` |
| `clock` | `renderClock` (+ `tick()` globale) |
| `holidays` | `renderHolidays` |
| `rss` | `renderFeed` |
| nessuno | elenco di collegamenti (`renderItem`) |

## Testi e lingue

- `txt(valore)`: restituisce una stringa da un valore di configurazione che può essere una stringa o `{ it: "…", en: "…" }`, con ricaduta sulla lingua predefinita.
- `t(chiave, variabili)`: testo dell'interfaccia da `assets/i18n/`, con segnaposto `{nome}`.
- Gli elementi statici di `index.html` usano `data-i18n`, `data-i18n-title`, `data-i18n-placeholder`, applicati da `applyStrings()`.

## Stato dei servizi

Per ogni collegamento con controllo attivo `renderItem` registra in `state.checks` un elemento `{ id, url, key }`. La `key` è la stringa **così come scritta nel JSON** (il campo `check` o `url`): è la chiave che usa anche `monitor.php`, quindi le due parti devono restare allineate.

`runChecks(force)`:

1. `loadServerStatus()` chiede `monitor.php?comune=<nome>`. Se risponde con `enabled: true`, lo stato dei servizi coperti viene applicato (`applyServer`) con il vero codice HTTP.
2. Per gli elementi non coperti (o senza PHP) c'è il controllo dal browser, `probe(url)`: prima `fetch` normale (legge il codice se stessa origine o CORS), poi `no-cors` (dice solo se l'host risponde). Non più spesso di `monitor.intervalSeconds` (salvo aggiornamento manuale), con 3 richieste in parallelo al massimo.
3. Gli stati restano in `state.status` e `paintDot(id)` li riapplica dopo ogni `render()`.

### `monitor.php`

- Legge `comuni/<nome>/sections.json` e le sezioni; controlla solo i collegamenti con indirizzo `http(s)://` assoluto, senza `check: false`.
- **Un controllo ogni `intervalSeconds`**, indipendente dal numero di visitatori: lo stato (`data/status-<nome>.json`) porta l'orario dell'ultimo controllo e un blocco `flock` impedisce esecuzioni sovrapposte.
- Dal web risponde subito con lo stato attuale (chiude la connessione) e poi esegue i controlli; da riga di comando (`php monitor.php <nome>`, cron) risponde a controllo finito.
- Per ogni servizio tiene `fails` (fallimenti consecutivi) e `alerted`; invia una sola email quando `fails >= failuresBeforeAlert` e azzera `alerted` al ripristino.
- `--dry-run` non invia email e non salva lo stato.

### `feed.php`

Proxy con lista di indirizzi ammessi: accetta solo gli URL dei blocchi `rss` trovati nelle sezioni dei comuni. Segue al più 4 redirect controllando a ogni passaggio che l'host non sia privato o riservato, limita la risposta a 2 MB e tiene una cache su disco di 5 minuti.

## Blocchi con aggiornamento

- **Feed**: `loadFeed(f, force)` con cache in `state.feedCache` (per URL); `parseFeed` gestisce RSS 2.0, RSS 1.0 e Atom con `DOMParser`; le descrizioni sono ridotte a testo.
- **Avvisi**: `loadAlert(a, force)` con cache in `state.textCache`; la prima riga del file è il titolo, il resto la descrizione; file vuoto = blocco nascosto.
- Un timer da 30 s richiama entrambi, ma ogni blocco si aggiorna solo quando scade il suo `refreshMinutes` / `refreshSeconds`.

## Sicurezza (regole del codice)

- Il contenuto proveniente da configurazione o feed entra nel DOM **solo** con `textContent`. L'unico `innerHTML` è la costante `ALERT_ICON`.
- Gli indirizzi dei collegamenti passano da `safeUrl()`: solo `http:` e `https:`.
- I collegamenti esterni hanno `rel="noopener"` quando si aprono in una nuova scheda (`setTarget`).
- Il parametro `?comune=` è validato prima di costruire qualunque percorso.
- Le richieste di controllo e dei feed usano `credentials: 'omit'`.
- Lato PHP: nessun input libero verso l'esterno (solo URL già presenti nella configurazione), controllo degli IP privati nel proxy dei feed, validazione degli indirizzi email, nomi dei comuni validati.

## Preferenze

`localStorage['dash4muni.prefs']` contiene `{ theme, lang, engine }`. Tutte le letture e scritture sono in `try/catch`: la pagina deve funzionare anche con l'archiviazione bloccata.
