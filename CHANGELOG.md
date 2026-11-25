# Cronologia delle modifiche

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/). Le date sono nel formato AAAA-MM-GG.

## [Non rilasciato]

## [1.0.0] - 2026-11-25

Prima versione.

### Aggiunto
- **Dashboard statica** in HTML, CSS e JavaScript senza dipendenze né build.
- **Una cartella per comune** (`comuni/<nome>/`) con configurazione in JSON e testo; scelta del comune con `?comune=` o `comune.json`.
- **Layout adattivo**: da 1 a 3 colonne in base alla larghezza reale della pagina (`layout` in `settings.json`).
- **Tema** chiaro, scuro o automatico; **preferenze** (tema, lingua, motore) salvate nel browser.
- **Interfaccia multilingua** (italiano, inglese) con testi del comune traducibili.
- **Ricerca web centrale** con scelta del motore da `engines.json`.
- **Intestazione**: titolo, sottotitolo e logo (massimo 120×120 px); **barra in fondo** configurabile.
- **Sezioni e blocchi** configurabili; scelta di apertura dei collegamenti (`linkTarget`, `target`).
- **Blocchi**: elenco di collegamenti con pallino di stato, `alert` (avviso rosso con testo da file), `clock` (orologio digitale, 6 stili), `holidays` (festività e calendario, Pasqua calcolata), `rss` (feed RSS/Atom).
- **`feed.php`**: proxy facoltativo per i feed RSS, con lista di indirizzi ammessi e protezioni contro l'uso improprio.
- **`monitor.php`**: controllo dei servizi sul server (codice HTTP reale), intervallo configurabile, avviso via email dopo più controlli falliti, modalità `--dry-run`.
- **Controllo dal browser** come alternativa quando PHP non è disponibile.
- Documentazione per chi configura e per chi sviluppa; modelli per issue e pull request.
- Licenza **EUPL-1.2**.
- Nel repository c'è solo la configurazione `esempio`; le cartelle dei comuni reali e `comune.json` restano locali (`.gitignore`).
