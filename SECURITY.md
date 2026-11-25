# Sicurezza

## Segnalare una vulnerabilità

**Non aprire una issue pubblica** per problemi di sicurezza.

Usa la segnalazione privata di GitHub: scheda **Security** del repository → **Report a vulnerability**. Se non è disponibile, contatta l'autore tramite [giovannidaddabbo.com](https://www.giovannidaddabbo.com) chiedendo un canale riservato, senza scrivere i dettagli nel primo messaggio.

Indica: cosa hai trovato, come riprodurlo, quale impatto pensi che abbia e la versione o il commit interessato. Si risponde appena possibile e si concorda con te la data di pubblicazione della correzione.

## Cosa è importante proteggere

Dash4Muni gira spesso dentro la rete di un ente pubblico e mostra l'elenco dei suoi sistemi. Le parti più sensibili sono:

| Parte | Rischio | Difesa nel codice |
|---|---|---|
| `feed.php` | usato come proxy aperto o per raggiungere la rete interna (SSRF) | accetta solo gli URL dei blocchi `rss` già presenti nella configurazione; rifiuta IP privati e riservati, anche dopo un redirect; limita dimensione (2 MB), redirect e tempo |
| `monitor.php` | uso per far partire richieste arbitrarie o email | non riceve URL né destinatari dall'esterno: legge solo la configurazione; il nome del comune è validato; gli indirizzi email sono validati; lo stato in `data/` non contiene indirizzi email |
| Pagina web | iniezione di HTML/script (XSS) tramite configurazione o feed | testo inserito solo con `textContent`; collegamenti solo `http(s)`; i feed sono ridotti a testo |
| Parametro `?comune=` | accesso a percorsi non voluti | solo lettere, numeri, `-` e `_` |

## Indicazioni per chi installa

- **Non mettere dati riservati nei file di configurazione.** Tutto ciò che sta in `comuni/` è servito pubblicamente dal web server: niente password, token, chiavi, indirizzi interni che non vuoi rendere noti. I collegamenti mostrati nella dashboard (e quindi i loro indirizzi) sono visibili a chiunque apra la pagina.
- **Valuta chi può aprire la dashboard.** Se mostra sistemi interni, mettila dietro autenticazione o limita l'accesso alla rete dell'ente (a livello di web server).
- **La cartella `data/`** contiene lo stato dei controlli. Il file `.htaccess` generato la protegge su Apache; su Nginx e altri server aggiungi una regola che neghi l'accesso diretto a `data/`.
- **Email di allarme.** Usa un indirizzo di destinazione dell'ente e un mittente coerente con il dominio del server (SPF/DKIM), altrimenti i messaggi possono essere scartati.
- **`verifySsl: false`** disattiva il controllo dei certificati nei controlli: usalo solo per sistemi interni con certificati non pubblici.
- **Aggiorna PHP** a una versione supportata.

## Versioni supportate

Il progetto è giovane: le correzioni di sicurezza vengono rilasciate sul ramo principale.
