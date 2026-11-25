# Guida allo sviluppo

Ambiente locale, prove manuali e ricette per le modifiche più comuni. Per capire come è fatto il codice leggi prima [architettura.md](architettura.md).

## Ambiente locale

Servono solo un browser e un server locale (i file JSON non si leggono da `file://`). Con PHP si prova tutto:

```bash
php -S localhost:8000
```

Senza PHP si prova la parte statica (si disattivano il controllo dal server, i feed esterni e le email):

```bash
python3 -m http.server 8000
```

Apri http://localhost:8000. Senza `comune.json` si vede la configurazione di esempio (`comuni/esempio/`), che è quella da usare per le prove. Un tuo `comune.json` locale non va in repository (è nel `.gitignore`).

Nessuna build: modifica i file e ricarica la pagina.

## Prove manuali

Non ci sono test automatici: prima di aprire una pull request percorri questa lista sulla configurazione `esempio`.

**Sempre**
- [ ] La pagina si carica senza errori nella console del browser (le richieste bloccate da CORS verso siti esterni sono normali).
- [ ] Tema chiaro, scuro e automatico (pulsante in alto a destra): testi leggibili ovunque.
- [ ] Cambio lingua: tutti i testi cambiano.
- [ ] Ridimensiona la finestra da larga a stretta e viceversa: 3 → 2 → 1 colonna senza ricaricare, senza barra di scorrimento orizzontale a 375 px.
- [ ] Ricerca: il motore scelto viene ricordato dopo il ricaricamento.

**Se tocchi i blocchi**
- [ ] Il blocco si ridisegna correttamente dopo un cambio di colonne e un cambio di lingua.
- [ ] Un campo mancante o sbagliato nel JSON non rompe la pagina (il blocco si nasconde o mostra un messaggio).
- [ ] Nessun testo di configurazione o di feed finisce nella pagina come HTML.

**Se tocchi PHP**
- [ ] `php -l feed.php && php -l monitor.php` senza errori.
- [ ] `php monitor.php esempio --dry-run` stampa lo stato (imposta temporaneamente `monitor.enabled: true` nella tua copia).
- [ ] Verifica l'email di allarme con un servizio finto non raggiungibile (ad esempio `http://127.0.0.1:9/`) e **solo in `--dry-run`**.

> **Non inviare mai email reali durante le prove.** Usa `--dry-run` oppure imposta `email.enabled` a `false` nella tua copia di prova, e non mettere indirizzi reali nelle configurazioni di esempio.

## Ricette

### Aggiungere un tipo di blocco

1. Scrivi `renderNome(el, block)` in `assets/app.js`: riempie `el` (un `<article class="block">`).
2. Aggiungi il ramo in `renderBlock` (`if (block.type === 'nome') …`).
3. Se il blocco deve occupare tutta la larghezza di default, aggiungilo alla condizione `isWide` in `render()`.
4. Se il blocco mostra dati che cambiano, tieni cache e stato in `state` (il blocco viene ridisegnato quando cambiano le colonne) e, se serve, aggiorna con il timer esistente.
5. Stili in `assets/style.css`, con le variabili di colore del tema (`--card`, `--text`, `--muted`, `--accent`…) in modo che funzionino in chiaro e scuro.
6. Testi dell'interfaccia in **tutti** i file di `assets/i18n/`.
7. Metti l'esempio in `comuni/esempio/sections/` e documenta le opzioni in [configurazione.md](configurazione.md).
8. Se il blocco contiene collegamenti da monitorare, ricorda che `monitor.php` legge solo i blocchi senza `type`: se serve, estendi `loadTargets()`.

### Aggiungere uno stile all'orologio

1. Aggiungi il nome a `CLOCK_STYLES` in `app.js`.
2. Se serve markup diverso, gestiscilo in `tick()` (come `flip` e `minimal`).
3. Aggiungi le regole `.clock-<nome>` in `style.css` (colori con variabili o verificati in chiaro e scuro).
4. Documentalo in [configurazione.md](configurazione.md).

### Aggiungere una lingua

Copia `assets/i18n/en.json` in `assets/i18n/<codice>.json`, traduci, aggiungi la lingua a `languages` nei `settings.json` dei comuni che la vogliono. Le chiavi devono essere le stesse in tutti i file: aggiungendo un testo, aggiungilo a tutte le lingue.

### Aggiungere una opzione di configurazione

1. Leggila in `app.js` con un valore predefinito sensato (la configurazione esistente deve continuare a funzionare).
2. Se contiene un percorso, passala da `res()`; se contiene un testo traducibile, da `txt()`.
3. Documentala in [configurazione.md](configurazione.md) e, se utile, mostrala in `comuni/esempio/`.

## Stile del codice

- JavaScript: ES2020 senza moduli né librerie, un solo file; funzioni piccole con un commento sul *perché* quando non è ovvio; `textContent` e mai `innerHTML` con dati esterni.
- CSS: variabili di colore sul `:root`, mai colori fissi per testo o sfondi che devono seguire il tema (gli stili dell'orologio e degli avvisi sono eccezioni volute).
- PHP: `declare(strict_types=1)`, compatibile con PHP 7.4+, nessuna dipendenza, nessun input libero verso l'esterno.
- JSON: indentazione a 2 spazi, UTF-8, senza commenti (non sono ammessi).
- Testi per gli utenti in italiano (e traduzioni), nomi di variabili e funzioni in inglese.

## Controlli rapidi da terminale

```bash
node --check assets/app.js                      # sintassi del JavaScript
for f in comuni/*/*.json comuni/*/sections/*.json assets/i18n/*.json comune.json; do
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1]))' "$f" || echo "JSON non valido: $f"
done
php -l feed.php && php -l monitor.php           # sintassi PHP
```
