<?php
/* =====================================================================
 * submit.php — emails HSG Property quote enquiries to the firm.
 * Put this file in the SAME folder as index.html on the cPanel host.
 * No third-party service or key needed: it sends from your own domain.
 *
 * DEPLOY NOTE (lead log): this script also appends every accepted
 * enquiry to a plain-text lead log (leads.log.jsonl) so a dropped or
 * spam-filtered email never loses a client. It PREFERS a sibling folder
 * OUTSIDE the web root — ../hsg-leads/ — if you create one; otherwise it
 * falls back to writing next to this file, where the log WOULD be
 * web-served and could leak lead data. So on deploy either create the
 * ../hsg-leads/ folder, or block leads.log.jsonl from public access
 * (e.g. deny it in .htaccess). Do not rely on the filename alone.
 * ===================================================================== */

/* ---- SETTINGS (edit these if needed) ------------------------------- */
$TO             = 'legal@hsginc.co.za';                       // where leads are sent
$FROM           = 'HSG Property <noreply@hsgattorneys.co.za>';// MUST be an address on your domain
$SUBJECT_PREFIX = 'New property enquiry';
/* ------------------------------------------------------------------- */

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
// (Kept ABOVE the rate limit so silent bot-success stays free/unmetered.)
if (!empty($data['company'])) { echo json_encode(['success' => true]); exit; }

// Trim and flatten a value to a single safe line. Arrays (which a JSON
// body could smuggle in) collapse to '' so nothing ever casts to "Array".
$clean = function ($s) {
    if (is_array($s)) { return ''; }
    return trim(str_replace(["\r", "\n"], ' ', (string)$s));
};
$name     = mb_substr($clean($data['name']  ?? ''), 0, 100);
$phone    = mb_substr($clean($data['phone'] ?? ''), 0, 40);
$email    = mb_substr($clean($data['email'] ?? ''), 0, 120);

// Scenario is long free text. Guard against array injection via the JSON
// body: flatten any array to a JSON string before coercing to string.
$scenarioRaw = $data['scenario'] ?? '';
if (is_array($scenarioRaw)) {
    $scenarioRaw = json_encode($scenarioRaw, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
$scenario = mb_substr(trim((string)$scenarioRaw), 0, 4000);

// POPIA consent — the client form already enforces the checkbox; here we
// simply RECORD what arrived. FILTER_VALIDATE_BOOLEAN accepts 1/true/on/yes
// (and 'on' from a plain form POST); anything else is treated as false.
$consent   = filter_var($data['consent'] ?? false, FILTER_VALIDATE_BOOLEAN);
$consentTs = gmdate('c');   // ISO8601 UTC — when we received the consent flag

if ($name === '' || $phone === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid input']);
    exit;
}

/* ---- Rate limit: file-based sliding window per client IP -----------
 * This is a public, unauthenticated endpoint that fires an outbound
 * email on every accepted POST, so we throttle per IP to stop one
 * client flooding the inbox. cPanel shared hosting may lack APCu, so we
 * use a cheap temp file: one file per IP in the system temp dir, named
 * by a SHA-256 of the IP, holding the timestamps of recent accepted
 * sends. Timestamps older than the window are dropped (sliding window).
 * We read REMOTE_ADDR only — the spoofable X-Forwarded-For is NEVER
 * trusted for the limit. If any file IO fails we FAIL OPEN and allow the
 * send, so a disk hiccup can never block a genuine client. */
$RATE_MAX    = 10;      // max accepted submissions ...
$RATE_WINDOW = 3600;    // ... per this many seconds (one hour)
$ip  = isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : 'unknown';
$now = time();
try {
    $throttleFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'hsgrl_' . hash('sha256', $ip);
    $fh = @fopen($throttleFile, 'c+');   // create if absent; open at start, never truncate
    if ($fh !== false) {
        if (@flock($fh, LOCK_EX)) {      // lock across the whole read-modify-write
            $contents = stream_get_contents($fh);
            $stamps = ($contents !== false && trim((string)$contents) !== '')
                ? array_map('intval', explode(',', trim($contents)))
                : [];
            // Keep only timestamps still inside the sliding window.
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
            $stamps[] = $now;            // record this accepted submission, write back
            @ftruncate($fh, 0);
            @rewind($fh);
            @fwrite($fh, implode(',', $stamps));
            @fflush($fh);
            @flock($fh, LOCK_UN);
        }
        @fclose($fh);
    }
} catch (\Throwable $e) {
    // Fail OPEN — never block a genuine client because of throttle IO.
}

/* ---- Persist the lead BEFORE emailing ------------------------------
 * A dropped or spam-filtered email is a permanently lost client, so we
 * append every accepted submission as one JSON line to a local log.
 * Preferred location is the sibling ../hsg-leads/ folder (outside the
 * web root) if the deploy created it; otherwise we fall back to this
 * script's own directory. Wrapped in try/@ so a logging failure can
 * never block the email that follows. */
try {
    $leadDir = dirname(__FILE__) . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'hsg-leads';
    if (!is_dir($leadDir)) { $leadDir = dirname(__FILE__); }   // fall back to script dir
    $leadFile = $leadDir . DIRECTORY_SEPARATOR . 'leads.log.jsonl';
    $record = [
        'timestamp'  => gmdate('c'),   // ISO8601 UTC
        'ip'         => $ip,
        'name'       => $name,
        'phone'      => $phone,
        'email'      => $email,
        'scenario'   => $scenario,
        'consent'    => $consent,
        'consent_ts' => $consentTs,
    ];
    $line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line !== false) {
        @file_put_contents($leadFile, $line . "\n", FILE_APPEND | LOCK_EX);
    }
} catch (\Throwable $e) {
    // Logging must never block the email — swallow any failure.
}

/* NOTE: everything below is UNVERIFIED visitor input. Staff must not
 * click links, open attachments or dial numbers from this email without
 * independently verifying the sender — treat the content as untrusted. */
$subject  = $SUBJECT_PREFIX . ' — ' . $name;
$body  = "New enquiry from the HSG Property app\n\n";
$body .= "Name:  $name\n";
$body .= "Phone: $phone\n";
$body .= "Email: $email\n";
$body .= "POPIA consent: " . ($consent ? 'yes' : 'no') . " (recorded " . $consentTs . ")\n\n";
$body .= "--- Calculation ---\n" . $scenario . "\n\n";
$body .= "(Unverified visitor input — verify the sender before acting on any links.)\n";

$headers  = "From: $FROM\r\n";
$headers .= "Reply-To: " . $name . " <" . $email . ">\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "X-Mailer: HSG-Property-App\r\n";

$sent = @mail($TO, $subject, $body, $headers);

echo json_encode(['success' => (bool)$sent]);
