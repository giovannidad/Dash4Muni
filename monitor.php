<?php
/**
 * Monitoraggio dei sistemi di un comune + avviso via email.
 *
 * Uso:
 *   - dalla dashboard:  monitor.php?comune=<nome>   (restituisce lo stato in JSON)
 *   - da cron (facoltativo, consigliato):  php monitor.php <nome>
 *   - prova senza inviare nulla e senza salvare:  php monitor.php <nome> --dry-run
 *
 * Funzionamento:
 *   - Legge i collegamenti di comuni/<nome>/sections/*.json (solo gli elementi con controllo attivo)
 *     e li controlla UNA volta ogni "intervalSeconds", qualunque sia il numero di visitatori.
 *   - Un servizio è "su" solo se risponde con un codice atteso (default HTTP 200, redirect seguiti).
 *   - Dopo "failuresBeforeAlert" controlli falliti consecutivi invia UNA email a "email.to".
 *     Non ripete l'avviso finché il servizio non torna su (salvo "reminderHours" > 0).
 *   - Dalla dashboard i controlli partono dopo la risposta, così la pagina non rallenta.
 * Le impostazioni stanno in comuni/<nome>/settings.json, voce "monitor".
 */
declare(strict_types=1);

const DEFAULT_INTERVAL = 300;
const MAX_BODY = 65536;

$cli = PHP_SAPI === 'cli';
$args = $cli ? array_slice($argv, 1) : [];
$dry = in_array('--dry-run', $args, true);
$name = $cli
    ? (array_values(array_filter($args, fn ($a) => $a !== '--dry-run'))[0] ?? '')
    : ($_GET['comune'] ?? '');

/* ---------- utilità ---------- */
function readJson(string $file): array {
    $d = json_decode((string)@file_get_contents($file), true);
    return is_array($d) ? $d : [];
}

function localized($v, string $lang): string {
    if (is_string($v)) return $v;
    if (is_array($v)) return (string)($v[$lang] ?? $v['en'] ?? (reset($v) ?: ''));
    return '';
}

function dataDir(): string {
    $d = __DIR__ . '/data';
    if (!is_dir($d)) @mkdir($d, 0775, true);
    if (is_dir($d) && is_writable($d)) {
        if (!is_file($d . '/.htaccess')) {
            @file_put_contents($d . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
        }
        return $d;
    }
    $t = sys_get_temp_dir() . '/dash4muni';
    @mkdir($t, 0775, true);
    return $t;
}

/** Risposta JSON; dal web chiude la connessione per poter lavorare dopo. */
function emit(array $payload, bool $cli, bool $closeConnection = false): void {
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | ($cli ? JSON_PRETTY_PRINT : 0));
    if ($cli) { echo $json, "\n"; return; }
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    if ($closeConnection) {
        ignore_user_abort(true);
        header('Connection: close');
        header('Content-Length: ' . strlen($json));
    }
    echo $json;
    if ($closeConnection) {
        while (ob_get_level() > 0) @ob_end_flush();
        flush();
        if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    }
}

function fail(int $code, string $msg, bool $cli): void {
    if ($cli) { fwrite(STDERR, $msg . "\n"); exit(1); }
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['enabled' => false, 'error' => $msg]);
    exit;
}

/* ---------- elenco dei servizi da controllare ---------- */
function loadTargets(string $dir, string $lang): array {
    $out = [];
    $idx = readJson($dir . '/sections.json');
    foreach (($idx['sections'] ?? []) as $f) {
        $f = (string)$f;
        if (strpos($f, '..') !== false || preg_match('~^(/|[a-z]+:)~i', $f)) continue;
        $s = readJson($dir . '/' . $f);
        foreach (($s['blocks'] ?? []) as $b) {
            if (!empty($b['type'])) continue;                 // solo blocchi di collegamenti
            foreach (($b['items'] ?? []) as $it) {
                if (($it['check'] ?? null) === false) continue;
                $url = is_string($it['check'] ?? null) ? $it['check'] : ($it['url'] ?? '');
                if (!is_string($url) || !preg_match('~^https?://~i', $url) || isset($out[$url])) continue;
                $expect = array_values(array_filter(
                    array_map('intval', (array)($it['expectCodes'] ?? [200])),
                    fn ($c) => $c >= 100 && $c < 600
                )) ?: [200];
                $out[$url] = ['key' => $url, 'name' => localized($it['title'] ?? $url, $lang), 'expect' => $expect];
            }
        }
    }
    return $out;
}

/* ---------- controllo di un indirizzo ---------- */
/** @return array{0:?int,1:?string} codice HTTP finale, errore */
function probe(string $url, int $timeout, bool $verify): array {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $got = 0;
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => min(5, $timeout),
            CURLOPT_USERAGENT => 'Dash4Muni-Monitor/1.0',
            CURLOPT_SSL_VERIFYPEER => $verify,
            CURLOPT_SSL_VERIFYHOST => $verify ? 2 : 0,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            // scarica al massimo 64 KB: serve solo il codice di risposta
            CURLOPT_WRITEFUNCTION => function ($c, $d) use (&$got) {
                $got += strlen($d);
                return $got > MAX_BODY ? 0 : strlen($d);
            },
        ]);
        curl_exec($ch);
        $errno = curl_errno($ch);
        $err = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        if ($code > 0 && ($errno === 0 || $errno === 23)) return [$code, null];   // 23 = interruzione voluta
        return [$code > 0 ? $code : null, $errno === 28 ? 'timeout' : ($err ?: 'nessuna risposta')];
    }
    $ctx = stream_context_create([
        'http' => ['method' => 'GET', 'timeout' => $timeout, 'follow_location' => 1, 'max_redirects' => 5,
                   'ignore_errors' => true, 'header' => "User-Agent: Dash4Muni-Monitor/1.0\r\n"],
        'ssl' => ['verify_peer' => $verify, 'verify_peer_name' => $verify],
    ]);
    @file_get_contents($url, false, $ctx, 0, MAX_BODY);
    $code = null;
    foreach (($http_response_header ?? []) as $h) {
        if (preg_match('~^HTTP/\S+\s+(\d+)~', $h, $m)) $code = (int)$m[1];
    }
    return $code ? [$code, null] : [null, 'nessuna risposta'];
}

/* ---------- email ---------- */
function sendMail(array $cfg, string $subject, string $body, bool $dry): bool {
    $list = is_array($cfg['to'] ?? null) ? $cfg['to'] : preg_split('/[,;\s]+/', (string)($cfg['to'] ?? ''), -1, PREG_SPLIT_NO_EMPTY);
    $to = array_values(array_filter($list, fn ($a) => filter_var($a, FILTER_VALIDATE_EMAIL)));
    if (!$to) return false;
    $host = preg_replace('/^www\./i', '', (string)($_SERVER['SERVER_NAME'] ?? gethostname() ?: 'localhost'));
    $from = (string)($cfg['from'] ?? '');
    if (!filter_var($from, FILTER_VALIDATE_EMAIL)) $from = 'dashboard@' . $host;
    $fromName = str_replace(["\r", "\n", '"'], '', (string)($cfg['fromName'] ?? 'Dash4Muni'));
    $headers = [
        'From: ' . $fromName . ' <' . $from . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'X-Auto-Response-Suppress: All',
    ];
    $subject = str_replace(["\r", "\n"], ' ', $subject);
    if ($dry) {
        echo "[dry-run] email NON inviata\nA: " . implode(', ', $to) . "\nDa: $from\nOggetto: $subject\n\n$body\n";
        return true;
    }
    $encSubject = function_exists('mb_encode_mimeheader') && preg_match('/[^\x20-\x7E]/', $subject)
        ? mb_encode_mimeheader($subject, 'UTF-8') : $subject;
    return @mail(implode(', ', $to), $encSubject, $body, implode("\r\n", $headers));
}

function describe(array $r): string {
    return $r['code'] !== null ? 'risposta HTTP ' . $r['code'] : 'nessuna risposta (' . ($r['error'] ?? 'errore') . ')';
}

/* ---------- esecuzione dei controlli ---------- */
function runChecks(array $targets, array $state, array $mon, string $siteTitle, bool $dry): array {
    $now = time();
    $timeout = max(3, min(30, (int)($mon['timeoutSeconds'] ?? 10)));
    $verify = ($mon['verifySsl'] ?? true) !== false;
    $needFails = max(1, (int)($mon['failuresBeforeAlert'] ?? 2));
    $reminder = max(0, (float)($mon['reminderHours'] ?? 0));
    $mail = is_array($mon['email'] ?? null) ? $mon['email'] : [];
    $mailOn = !empty($mail['enabled']);

    $items = [];
    $newDown = [];
    $recovered = [];
    foreach ($targets as $key => $t) {
        [$code, $err] = probe($key, $timeout, $verify);
        $up = $code !== null && in_array($code, $t['expect'], true);
        $prev = $state['items'][$key] ?? [];
        $fails = $up ? 0 : ((int)($prev['fails'] ?? 0)) + 1;
        $alerted = (bool)($prev['alerted'] ?? false);
        $lastAlert = (int)($prev['lastAlert'] ?? 0);
        $since = (isset($prev['up']) && $prev['up'] === $up) ? (int)($prev['since'] ?? $now) : $now;
        $rec = ['name' => $t['name'], 'up' => $up, 'code' => $code, 'error' => $up ? null : $err,
                'since' => $since, 'fails' => $fails, 'alerted' => $alerted, 'lastAlert' => $lastAlert];

        if (!$up && $fails >= $needFails) {
            if (!$alerted) {
                $rec['alerted'] = true; $rec['lastAlert'] = $now; $newDown[$key] = $rec;
            } elseif ($reminder > 0 && $now - $lastAlert >= $reminder * 3600) {
                $rec['lastAlert'] = $now; $newDown[$key] = $rec;
            }
        } elseif ($up && $alerted) {
            $recovered[$key] = $rec;
            $rec['alerted'] = false; $rec['lastAlert'] = 0;
        }
        $items[$key] = $rec;
    }

    $mailError = null;
    $stamp = date('d/m/Y H:i T');
    if ($newDown && $mailOn) {
        $lines = [];
        foreach ($newDown as $key => $r) {
            $lines[] = "Servizio: {$r['name']}\nIndirizzo: $key\nEsito: " . describe($r)
                . "\nGiù dalle: " . date('d/m/Y H:i', $r['since']) . "\nControlli falliti consecutivi: {$r['fails']}";
        }
        $body = "Il sistema di monitoraggio ha rilevato che "
            . (count($newDown) > 1 ? "i seguenti servizi non sono raggiungibili" : "il seguente servizio non è raggiungibile")
            . ":\n\n" . implode("\n\n", $lines)
            . "\n\nRilevato il: $stamp\n\nMessaggio automatico di Dash4Muni ($siteTitle).\n";
        if (!sendMail($mail, (string)($mail['subject'] ?? 'Attenzione: Servizio Down'), $body, $dry)) {
            $mailError = 'invio email non riuscito';
            foreach ($newDown as $key => $_) {           // riprova al prossimo controllo
                if (!$dry) { $items[$key]['alerted'] = (bool)($state['items'][$key]['alerted'] ?? false); $items[$key]['lastAlert'] = (int)($state['items'][$key]['lastAlert'] ?? 0); }
            }
        }
    }
    if ($recovered && $mailOn && !empty($mon['notifyOnRecovery'])) {
        $names = array_map(fn ($r) => "Servizio: {$r['name']}", array_values($recovered));
        $body = "I seguenti servizi sono tornati raggiungibili:\n\n" . implode("\n", $names)
            . "\n\nRilevato il: $stamp\n\nMessaggio automatico di Dash4Muni ($siteTitle).\n";
        sendMail($mail, (string)($mail['recoverySubject'] ?? 'Servizio ripristinato'), $body, $dry);
    }
    return ['checked' => $now, 'items' => $items, 'mailError' => $mailError];
}

/* ---------- programma principale ---------- */
if (!is_string($name) || !preg_match('/^[a-z0-9_-]+$/i', $name)) fail(400, 'Comune non valido', $cli);
$dir = __DIR__ . '/comuni/' . $name;
if (!is_dir($dir)) fail(404, 'Comune non trovato', $cli);

$settings = readJson($dir . '/settings.json');
$mon = is_array($settings['monitor'] ?? null) ? $settings['monitor'] : [];
if (empty($mon['enabled'])) { emit(['enabled' => false, 'items' => new stdClass()], $cli); exit; }

date_default_timezone_set((string)($mon['timezone'] ?? 'Europe/Rome'));
$lang = (string)($settings['defaultLanguage'] ?? 'it');
$siteTitle = localized($settings['title'] ?? $name, $lang);
$interval = max(60, (int)($mon['intervalSeconds'] ?? DEFAULT_INTERVAL));

$dataDir = dataDir();
$stateFile = $dataDir . '/status-' . $name . '.json';
$state = readJson($stateFile);
$isStale = fn (array $s) => time() - (int)($s['checked'] ?? 0) >= $interval - 5;

function publicView(array $state, int $interval): array {
    $items = [];
    foreach (($state['items'] ?? []) as $k => $r) {
        $items[$k] = ['name' => $r['name'] ?? '', 'up' => (bool)($r['up'] ?? false), 'code' => $r['code'] ?? null,
                      'error' => $r['error'] ?? null, 'since' => $r['since'] ?? null];
    }
    return ['enabled' => true, 'checked' => (int)($state['checked'] ?? 0), 'intervalSeconds' => $interval,
            'items' => $items ?: new stdClass()];
}

$mustRun = $dry || $isStale($state);
if (!$mustRun) { emit(publicView($state, $interval), $cli); exit; }

// Dal web: rispondi subito con lo stato attuale, poi esegui i controlli.
if (!$cli) emit(publicView($state, $interval), false, true);
@set_time_limit(0);

$lock = $dry ? null : @fopen($dataDir . '/status-' . $name . '.lock', 'c');
if (!$dry && (!$lock || !flock($lock, LOCK_EX | LOCK_NB))) {
    if ($cli) emit(publicView($state, $interval), true);
    exit;                                                   // un altro processo sta già controllando
}
if (!$dry) {                                                // riletto dopo il blocco: forse è già stato aggiornato
    $state = readJson($stateFile);
    if (!$isStale($state)) { flock($lock, LOCK_UN); if ($cli) emit(publicView($state, $interval), true); exit; }
}

$targets = loadTargets($dir, $lang);
$result = runChecks($targets, $state, $mon, $siteTitle, $dry);
if (!$dry) {
    @file_put_contents($stateFile, json_encode($result, JSON_UNESCAPED_UNICODE), LOCK_EX);
    flock($lock, LOCK_UN);
}
if ($cli) emit(publicView($result, $interval), true);
