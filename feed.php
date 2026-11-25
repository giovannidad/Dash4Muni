<?php
/**
 * Proxy facoltativo per i feed RSS/Atom (aggira il blocco CORS del browser).
 * - Accetta SOLO gli URL dei blocchi "rss" presenti nei file sections di comuni/<nome>/ (niente open proxy).
 * - Rifiuta host con IP privati/riservati, anche dopo un redirect.
 * - Cache su disco per 5 minuti, dimensione massima 2 MB.
 * Se il server non ha PHP, la dashboard prova a leggere il feed direttamente dal browser.
 */
declare(strict_types=1);

const CACHE_TTL = 300;
const MAX_BYTES = 2097152;

function fail(int $code, string $msg): void {
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $msg;
    exit;
}

function allowedFeeds(): array {
    $out = [];
    // Tutte le cartelle in comuni/<nome>/ con il loro sections.json
    foreach ((glob(__DIR__ . '/comuni/*', GLOB_ONLYDIR) ?: []) as $dir) {
        $idx = json_decode((string)@file_get_contents($dir . '/sections.json'), true);
        foreach (($idx['sections'] ?? []) as $f) {
            $f = (string)$f;
            if (strpos($f, '..') !== false || preg_match('~^(/|[a-z]+:)~i', $f)) continue;
            $s = json_decode((string)@file_get_contents($dir . '/' . $f), true);
            foreach (($s['blocks'] ?? []) as $b) {
                if (($b['type'] ?? '') === 'rss' && !empty($b['url'])) $out[] = (string)$b['url'];
            }
        }
    }
    return $out;
}

/** @return array{0:int,1:string,2:string} status, body, location */
function httpGet(string $url): array {
    $ua = 'Dash4Muni-FeedProxy/1.0';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $body = '';
        $loc = '';
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_USERAGENT => $ua,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_HTTPHEADER => ['Accept: application/rss+xml, application/atom+xml, application/xml, text/xml, */*'],
            CURLOPT_HEADERFUNCTION => function ($c, $h) use (&$loc) {
                if (stripos($h, 'location:') === 0) $loc = trim(substr($h, 9));
                return strlen($h);
            },
            CURLOPT_WRITEFUNCTION => function ($c, $d) use (&$body) {
                $body .= $d;
                return strlen($body) > MAX_BYTES ? 0 : strlen($d);
            },
        ]);
        curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return [$status, $body, $loc];
    }
    $ctx = stream_context_create(['http' => [
        'method' => 'GET', 'timeout' => 8, 'follow_location' => 0, 'ignore_errors' => true,
        'header' => "User-Agent: $ua\r\nAccept: application/rss+xml, application/atom+xml, application/xml, text/xml, */*\r\n",
    ]]);
    $body = @file_get_contents($url, false, $ctx, 0, MAX_BYTES);
    $status = 0;
    $loc = '';
    foreach (($http_response_header ?? []) as $h) {
        if (preg_match('~^HTTP/\S+\s+(\d+)~', $h, $m)) { $status = (int)$m[1]; $loc = ''; }
        elseif (stripos($h, 'location:') === 0) $loc = trim(substr($h, 9));
    }
    return [$status, (string)$body, $loc];
}

function checkHost(string $url): void {
    $p = parse_url($url);
    if (!$p || !in_array(strtolower($p['scheme'] ?? ''), ['http', 'https'], true) || empty($p['host'])) {
        fail(400, 'Bad url');
    }
    $ip = gethostbyname($p['host']);
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        fail(403, 'Blocked host');
    }
}

$url = $_GET['url'] ?? '';
if (!is_string($url) || !preg_match('~^https?://~i', $url)) fail(400, 'Bad url');
if (!in_array($url, allowedFeeds(), true)) fail(403, 'Feed not configured');

$cache = sys_get_temp_dir() . '/dash4muni_' . md5($url) . '.xml';
if (is_file($cache) && time() - filemtime($cache) < CACHE_TTL) {
    $xml = (string)file_get_contents($cache);
} else {
    $cur = $url;
    $status = 0;
    $xml = '';
    for ($i = 0; $i < 4; $i++) {
        checkHost($cur);
        [$status, $xml, $loc] = httpGet($cur);
        if ($status >= 300 && $status < 400 && $loc !== '') {
            $cur = preg_match('~^https?://~i', $loc) ? $loc : (parse_url($cur, PHP_URL_SCHEME) . '://' . parse_url($cur, PHP_URL_HOST) . '/' . ltrim($loc, '/'));
            continue;
        }
        break;
    }
    if ($status !== 200 || $xml === '') fail(502, 'Upstream error ' . $status);
    @file_put_contents($cache, $xml, LOCK_EX);
}

header('Content-Type: application/xml; charset=utf-8');
header('X-Content-Type-Options: nosniff');
echo $xml;
