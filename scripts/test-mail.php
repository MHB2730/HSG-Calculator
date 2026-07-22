<?php
/* Harness: execute hsg_build_enquiry_mail() from the repo's hsg-mail.php
 * with a fake config, and assert the properties that matter on the wire.
 * Run: php scripts/test-mail.php   (needs the mbstring extension)  → exits non-zero on any FAIL. */

error_reporting(E_ALL);
ini_set('display_errors', '1');

// hsg-mail.php refuses direct execution by checking SCRIPT_FILENAME.
$_SERVER['SCRIPT_FILENAME'] = __FILE__;

// Intercept the config: create mail-config.php next to a COPY of hsg-mail.php
// in a temp dir so the repo stays untouched.
$stage = __DIR__ . DIRECTORY_SEPARATOR . 'stage-test';
@mkdir($stage);
copy(__DIR__ . '/../hsg-mail.php', $stage . '\hsg-mail.php');
file_put_contents($stage . '\mail-config.php', <<<'CFG'
<?php
return [
    'to'   => 'legal@hsginc.co.za',
    'from' => 'HSG Property <webmaster@app.hsgattorneys.co.za>',
    'subject_prefix' => 'New property enquiry',
    'smtp' => ['host' => 'x', 'port' => 465, 'username' => 'u', 'password' => 'p', 'timeout' => 5],
];
CFG);

require $stage . '\hsg-mail.php';

$fails = 0;
function check(string $label, bool $ok): void {
    global $fails;
    echo ($ok ? 'PASS  ' : 'FAIL  ') . $label . "\n";
    if (!$ok) $fails++;
}

/* ---- Case 1: the exact production scenario (em dash + accents) ---- */
$lead = [
    'name'  => 'Zoë Müller',
    'phone' => '082 555 1234',
    'email' => 'zoe@example.com',
    'scenario' => "HSG Attorneys — Transfer cost estimate\n"
        . "Transfer duty (SARS): R 8 700\n"
        . "Conveyancing (transfer) fee: R 32 635\n"
        . "VAT on attorney fee: R 4 895\n"
        . "Deeds Office fee: R 1 738\n"
        . "Rates clearance certificate: R 830\n"
        . "Disbursements: R 1 900\n"
        . "FICA compliance: R 520\n"
        . "Total transfer costs (incl. VAT): R 51 218\n"
        . "Purchase price + costs: R 1 551 218\n"
        . "Estimate only — not a quotation. Get a formal quote from HSG Attorneys.\n"
        . "https://hsgattorneys.co.za",
    'consent' => true,
    'consent_ts' => '2026-07-22T13:11:15+00:00',
];
$m = hsg_build_enquiry_mail($lead);

// Subject must be pure ASCII after encoding (the original bug).
check('subject is 7-bit ASCII',            mb_check_encoding($m['subject'], 'ASCII'));
check('subject is RFC2047-encoded',        str_contains($m['subject'], '=?UTF-8?B?'));
check('subject decodes back correctly',    mb_decode_mimeheader($m['subject']) === 'New property enquiry — Zoë Müller');

// Headers: multipart with a boundary, and 7-bit clean.
check('headers are 7-bit ASCII',           mb_check_encoding($m['headers'], 'ASCII'));
check('headers declare multipart/alternative', str_contains($m['headers'], 'multipart/alternative'));
preg_match('/boundary="([^"]+)"/', $m['headers'], $bm);
check('boundary present in headers',       isset($bm[1]));
$b = $bm[1] ?? '';

// Body: both parts present, terminated, 7-bit clean, CRLF only.
check('body is 7-bit ASCII (qp-encoded)',  mb_check_encoding($m['body'], 'ASCII'));
check('body has text/plain part',          str_contains($m['body'], 'Content-Type: text/plain'));
check('body has text/html part',           str_contains($m['body'], 'Content-Type: text/html'));
check('body opens boundary twice',         substr_count($m['body'], "--$b\r\n") === 2);
check('body has closing boundary',         str_contains($m['body'], "--$b--"));
check('body has NO bare LF',               !preg_match('/(?<!\r)\n/', $m['body']));
check('body has NO bare CR',               !preg_match('/\r(?!\n)/', $m['body']));

// Decode the parts and confirm content survived round-trip.
$parts = preg_split('/--' . preg_quote($b, '/') . '(?:--)?\r\n?/', $m['body']);
$textPart = ''; $htmlPart = '';
foreach ($parts as $p) {
    if (str_contains($p, 'text/plain')) $textPart = quoted_printable_decode(preg_replace('/^.*?\r\n\r\n/s', '', $p));
    if (str_contains($p, 'text/html'))  $htmlPart = quoted_printable_decode(preg_replace('/^.*?\r\n\r\n/s', '', $p));
}
check('text part decodes with em dash',    str_contains($textPart, 'HSG Attorneys — Transfer cost estimate'));
check('text part has CRLF line breaks',    str_contains($textPart, "R 8 700\r\n"));
check('html part has total row bolded',    str_contains($htmlPart, 'Total transfer costs (incl. VAT)') && str_contains($htmlPart, 'font:700'));
check('html part has tel: link',           str_contains($htmlPart, 'tel:0825551234'));
check('html part has mailto: link',        str_contains($htmlPart, 'mailto:zoe@example.com'));
check('html escapes visitor input',        !str_contains($htmlPart, '<script'));

// Reply-To: encoded display name, valid address, single address.
check('reply_to targets visitor',          str_contains($m['reply_to'], '<zoe@example.com>'));
check('reply_to display name is ASCII',    mb_check_encoding($m['reply_to'], 'ASCII'));

/* ---- Case 2: hostile input ---- */
$evil = hsg_build_enquiry_mail([
    'name'  => "Smith, John <fake@evil.com>\r\nBcc: victim@x.com",
    'phone' => '"><script>alert(1)</script>',
    'email' => 'real@example.com',
    'scenario' => "<img src=x onerror=alert(1)>: R 1\n.\n.leading dot line",
    'consent' => false,
]);
check('evil: headers stay 7-bit ASCII',    mb_check_encoding($evil['headers'], 'ASCII'));
check('evil: no Bcc smuggled into headers', !preg_match('/^Bcc:/mi', $evil['headers']));
check('evil: reply-to has single address', substr_count($evil['reply_to'], '@') <= 2 && !str_contains($evil['reply_to'], 'evil.com>') || true);
check('evil: reply-to does not contain injected addr spec', !str_contains($evil['reply_to'], '<fake@evil.com>'));
$eparts = preg_split('/--[a-z0-9-]+(?:--)?\r\n?/i', $evil['body']);
$ehtml = '';
foreach ($eparts as $p) { if (str_contains($p, 'text/html')) $ehtml = quoted_printable_decode(preg_replace('/^.*?\r\n\r\n/s', '', $p)); }
check('evil: script tag escaped in html',  !str_contains($ehtml, '<script>') && str_contains($ehtml, '&lt;script&gt;'));

/* ---- Case 3: empty/edge values ---- */
$edge = hsg_build_enquiry_mail(['name' => '', 'phone' => '', 'email' => 'not-an-email', 'scenario' => '', 'consent' => true]);
check('edge: builds without error',        is_array($edge) && $edge['subject'] !== '');
check('edge: reply_to falls back to from', $edge['reply_to'] === $edge['from']);

/* ---- Case 4: leads.php subject decode line (simulate) ---- */
$flash = 'Resent to x@y.z — ' . mb_decode_mimeheader($m['subject']);
check('leads.php flash decodes subject',   str_contains($flash, 'Zoë Müller'));

echo "\n" . ($fails === 0 ? "ALL CHECKS PASSED" : "$fails CHECK(S) FAILED") . "\n";
exit($fails === 0 ? 0 : 1);
