<?php
/* =====================================================================
 * submit.php — emails HSG Property quote enquiries to the firm via SMTP.
 * Put this file in the SAME folder as index.html on the cPanel host.
 *
 * SMTP credentials live in mail-config.php (shared with mail-test / leads).
 *
 * DEPLOY NOTE (lead log): this script also appends every accepted
 * enquiry to a plain-text lead log (leads.log.jsonl) so a dropped or
 * spam-filtered email never loses a client. It PREFERS a sibling folder
 * OUTSIDE the web root — ../hsg-leads/ — if you create one; otherwise it
 * falls back to writing next to this file. Block leads.log.jsonl from
 * public access (.htaccess already does). Do not rely on the filename alone.
 * ===================================================================== */

require_once __DIR__ . '/hsg-mail.php';

$cfg = hsg_mail_config();
$TO             = (string)$cfg['to'];
$FROM           = (string)$cfg['from'];
$SUBJECT_PREFIX = (string)$cfg['subject_prefix'];

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Accept JSON body (the app sends JSON) or a normal form POST.
$raw  = file_get_contents('php://input');
if (strlen($raw) > 20000) {
    http_response_code(413);
    echo json_encode(['success' => false, 'error' => 'Payload too large']);
    exit;
}
$data = json_decode($raw, true);
if (!is_array($data)) { $data = $_POST; }

/* ---- Honeypot -------------------------------------------------------
 * Bots fill hidden fields; humans never see them. Two hard-won rules:
 *
 * 1. The field is NOT called "company". It used to be, and Chrome — on
 *    Android especially — autofills anything it recognises as an
 *    address-profile field (company / organization) from the user's saved
 *    profile. autocomplete="off" does NOT stop that, and the field was
 *    only positioned off-screen, so autofill still saw it. Any client who
 *    tapped an autofill suggestion was classified a bot: this endpoint
 *    returned success, the app said "Enquiry sent", and the enquiry was
 *    discarded without ever being logged or emailed. Silent client loss.
 *    Keep the name meaningless to autofill.
 *
 * 2. Rejections are LOGGED, not discarded. A honeypot that throws work
 *    away invisibly cannot be audited — that is what let the bug above
 *    run undetected. If a real client is ever caught, their details are
 *    in honeypot.log.jsonl and they can still be contacted.
 *
 * We still answer success:true so a real bot learns nothing.
 * ------------------------------------------------------------------- */
$honeypot = is_array($data['hsg_leave_blank'] ?? '') ? '' : trim((string)($data['hsg_leave_blank'] ?? ''));
if ($honeypot !== '') {
    try {
        $hpDir  = dirname(__FILE__);
        $hpLine = json_encode([
            'timestamp' => gmdate('c'),
            'ip'        => isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : 'unknown',
            'ua'        => mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200),
            'honeypot'  => mb_substr($honeypot, 0, 100),
            // Keep enough to rescue a false positive.
            'name'      => mb_substr((string)($data['name']  ?? ''), 0, 100),
            'phone'     => mb_substr((string)($data['phone'] ?? ''), 0, 40),
            'email'     => mb_substr((string)($data['email'] ?? ''), 0, 120),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($hpLine !== false) {
            @file_put_contents($hpDir . DIRECTORY_SEPARATOR . 'honeypot.log.jsonl',
                               $hpLine . "\n", FILE_APPEND | LOCK_EX);
        }
    } catch (Throwable $e) {
        // Never let logging block the response.
    }
    echo json_encode(['success' => true]);
    exit;
}

$clean = function ($s) {
    if (is_array($s)) { return ''; }
    return trim(str_replace(["\r", "\n"], ' ', (string)$s));
};
$name     = mb_substr($clean($data['name']  ?? ''), 0, 100);
$phone    = mb_substr($clean($data['phone'] ?? ''), 0, 40);
$email    = mb_substr($clean($data['email'] ?? ''), 0, 120);

$scenarioRaw = $data['scenario'] ?? '';
if (is_array($scenarioRaw)) {
    $scenarioRaw = json_encode($scenarioRaw, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
$scenario = mb_substr(trim((string)$scenarioRaw), 0, 4000);

$consent   = filter_var($data['consent'] ?? false, FILTER_VALIDATE_BOOLEAN);
$consentTs = gmdate('c');

if ($name === '' || $phone === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid input']);
    exit;
}

/* ---- Rate limit: file-based sliding window per client IP ----------- */
$RATE_MAX    = 10;
$RATE_WINDOW = 3600;
$ip  = isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : 'unknown';
$now = time();
try {
    $throttleFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'hsgrl_' . hash('sha256', $ip);
    $fh = @fopen($throttleFile, 'c+');
    if ($fh !== false) {
        if (@flock($fh, LOCK_EX)) {
            $contents = stream_get_contents($fh);
            $stamps = ($contents !== false && trim((string)$contents) !== '')
                ? array_map('intval', explode(',', trim($contents)))
                : [];
            $stamps = array_values(array_filter($stamps, function ($t) use ($now, $RATE_WINDOW) {
                return $t > 0 && ($now - $t) < $RATE_WINDOW;
            }));
            if (count($stamps) >= $RATE_MAX) {
                @flock($fh, LOCK_UN);
                @fclose($fh);
                http_response_code(429);
                echo json_encode(['success' => false, 'error' => 'Too many requests']);
                exit;
            }
            $stamps[] = $now;
            @ftruncate($fh, 0);
            @rewind($fh);
            @fwrite($fh, implode(',', $stamps));
            @fflush($fh);
            @flock($fh, LOCK_UN);
        }
        @fclose($fh);
    }
} catch (Throwable $e) {
    // Fail OPEN
}

$record = [
    'timestamp'  => gmdate('c'),
    'ip'         => $ip,
    'name'       => $name,
    'phone'      => $phone,
    'email'      => $email,
    'scenario'   => $scenario,
    'consent'    => $consent,
    'consent_ts' => $consentTs,
];

/* Persist BEFORE emailing so a mail failure never loses the lead. */
hsg_lead_append($record);

$result = hsg_send_lead_email($record);
echo json_encode(['success' => (bool)$result['ok']]);
