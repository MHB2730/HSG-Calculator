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

// Honeypot: bots fill the hidden "company" field; humans never see it.
if (!empty($data['company'])) { echo json_encode(['success' => true]); exit; }

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
