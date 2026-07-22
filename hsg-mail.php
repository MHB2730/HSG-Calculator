<?php
/* =====================================================================
 * hsg-mail.php — shared SMTP sender + lead-log helpers for HSG Property.
 * Include-only. Direct HTTP access blocked in .htaccess.
 * ===================================================================== */

if (basename((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) === 'hsg-mail.php') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Forbidden';
    exit;
}

/* Everything here is UTF-8. mb_encode_mimeheader() reads the string in the
 * internal encoding, so pin it rather than trusting the host's php.ini.
 * (PHP 8 already defaults to UTF-8; this just makes it not a guess.) */
mb_internal_encoding('UTF-8');

/**
 * @return array<string,mixed>
 */
function hsg_mail_config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $loaded = require __DIR__ . '/mail-config.php';
        if (!is_array($loaded)) {
            throw new RuntimeException('mail-config.php did not return an array');
        }
        $cfg = $loaded;
    }
    return $cfg;
}

function hsg_parse_email_address(string $fromHeader): string {
    if (preg_match('/<([^>]+)>/', $fromHeader, $m)) {
        return trim($m[1]);
    }
    return trim($fromHeader);
}

/**
 * @return array{preferred:string,dir:string,file:string,preferred_exists:bool,writable:bool}
 */
function hsg_lead_paths(): array {
    $preferred = dirname(__FILE__) . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'hsg-leads';
    $dir = is_dir($preferred) ? $preferred : dirname(__FILE__);
    return [
        'preferred'        => $preferred,
        'dir'              => $dir,
        'file'             => $dir . DIRECTORY_SEPARATOR . 'leads.log.jsonl',
        'preferred_exists' => is_dir($preferred),
        'writable'         => is_dir($dir) && is_writable($dir),
    ];
}

/**
 * Append one lead record. Returns true on write success.
 *
 * @param array<string,mixed> $record
 */
function hsg_lead_append(array $record): bool {
    try {
        $paths = hsg_lead_paths();
        $line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($line === false) {
            return false;
        }
        return @file_put_contents($paths['file'], $line . "\n", FILE_APPEND | LOCK_EX) !== false;
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * @return list<array<string,mixed>>
 */
function hsg_lead_read_all(): array {
    $paths = hsg_lead_paths();
    if (!is_file($paths['file'])) {
        return [];
    }
    $raw = @file($paths['file'], FILE_IGNORE_NEW_LINES);
    if ($raw === false) {
        return [];
    }
    $out = [];
    foreach ($raw as $i => $line) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        $row = json_decode($line, true);
        if (!is_array($row)) {
            continue;
        }
        $row['_line'] = $i + 1;
        $out[] = $row;
    }
    return $out;
}

/** Escape untrusted visitor input for the HTML part. */
function hsg_h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * One label/value row in the contact block. $href, when given, makes the
 * value clickable (tel: / mailto:) so staff can act on it in one tap.
 */
function hsg_contact_row(string $label, string $value, string $href = ''): string {
    if ($value === '') { $value = '—'; }
    $shown = hsg_h($value);
    if ($href !== '') {
        $shown = '<a href="' . hsg_h($href) . '" style="color:#121212;text-decoration:underline;">'
               . $shown . '</a>';
    }
    return '<tr>'
         . '<td width="120" style="padding:6px 12px 6px 0;font:400 12px/1.4 Arial,sans-serif;'
         . 'color:#888;vertical-align:top;">' . hsg_h($label) . '</td>'
         . '<td style="padding:6px 0;font:600 14px/1.4 Arial,sans-serif;color:#121212;'
         . 'vertical-align:top;">' . $shown . '</td>'
         . "</tr>\r\n";
}

/**
 * Render the plain-text calculation block as HTML table rows.
 *
 * The scenario arrives as "Label: Value" lines with the occasional heading
 * or note that has no colon. Lines that split become two-column rows; the
 * rest span the full width. Totals are emphasised.
 */
function hsg_scenario_rows(string $scenario): string {
    $rows = '';
    foreach (preg_split('/\R/', $scenario) ?: [] as $line) {
        $line = trim($line);
        if ($line === '') { continue; }

        $pos = mb_strpos($line, ': ');
        if ($pos === false) {
            $rows .= '<tr><td colspan="2" style="padding:10px 0 4px;font:600 13px/1.4 Arial,sans-serif;'
                  .  'color:#121212;border-bottom:1px solid #e6e6e6;">' . hsg_h($line) . "</td></tr>\r\n";
            continue;
        }

        $label = trim(mb_substr($line, 0, $pos));
        $value = trim(mb_substr($line, $pos + 2));
        $isTotal = (mb_stripos($label, 'total') !== false) || (mb_stripos($label, 'purchase price +') !== false);
        $weight  = $isTotal ? '700' : '400';
        $border  = $isTotal ? '2px solid #121212' : '1px solid #f0f0f0';

        $rows .= '<tr>'
              .  '<td style="padding:7px 12px 7px 0;font:' . $weight . ' 13px/1.4 Arial,sans-serif;'
              .  'color:#333;border-bottom:' . $border . ';">' . hsg_h($label) . '</td>'
              .  '<td style="padding:7px 0;font:' . $weight . ' 13px/1.4 Arial,sans-serif;color:#121212;'
              .  'text-align:right;white-space:nowrap;border-bottom:' . $border . ';">' . hsg_h($value) . '</td>'
              .  "</tr>\r\n";
    }
    return $rows;
}

/**
 * Build the enquiry email subject/body/headers from a lead-shaped array.
 *
 * Sent as multipart/alternative: a plain-text part for text-only clients and
 * an HTML part for everything else. BOTH parts use CRLF line endings, which
 * is what fixes the "everything runs together in one paragraph" rendering —
 * the body previously used bare \n, and Outlook collapses plain-text lines
 * that are not CRLF-terminated.
 *
 * @param array<string,mixed> $lead
 * @return array{to:string,from:string,subject:string,body:string,headers:string,reply_to:string}
 */
function hsg_build_enquiry_mail(array $lead): array {
    $cfg = hsg_mail_config();
    $name = trim((string)($lead['name'] ?? 'Visitor'));
    $phone = trim((string)($lead['phone'] ?? ''));
    $email = trim((string)($lead['email'] ?? ''));
    $scenario = trim((string)($lead['scenario'] ?? ''));
    $consent = !empty($lead['consent']);
    $consentTs = trim((string)($lead['consent_ts'] ?? gmdate('c')));

    /* RFC 5322 headers must be 7-bit ASCII, and this subject carries a
     * literal em dash. hsg_smtp_send() writes the subject straight into the
     * SMTP DATA stream, so an unencoded UTF-8 byte went out raw — and the
     * firm's Microsoft 365 servers rejected EVERY such enquiry, while the
     * identical mail with an ASCII subject delivered (see the xneelo mail
     * log for 22 Jul 2026). RFC 2047-encode it. mb_encode_mimeheader()
     * leaves a pure-ASCII string untouched, so this is a no-op for names
     * that were already fine. */
    $subject = mb_encode_mimeheader(
        (string)$cfg['subject_prefix'] . ' — ' . $name,
        'UTF-8',
        'B'
    );
    $consentText = ($consent ? 'yes' : 'no') . ' (recorded ' . $consentTs . ')';
    $warning = 'Unverified visitor input — verify the sender before acting on any '
             . 'links, attachments or phone numbers above.';

    /* ---- Plain-text part (CRLF throughout) ---- */
    $text  = "NEW PROPERTY ENQUIRY - HSG Property app\r\n";
    $text .= "=======================================\r\n\r\n";
    $text .= "Name:          $name\r\n";
    $text .= "Phone:         $phone\r\n";
    $text .= "Email:         $email\r\n";
    $text .= "POPIA consent: $consentText\r\n\r\n";
    $text .= "--- CALCULATION ---\r\n\r\n";
    $text .= str_replace("\n", "\r\n", str_replace("\r\n", "\n", $scenario)) . "\r\n\r\n";
    $text .= "-- \r\n" . $warning . "\r\n";

    /* ---- HTML part ---- */
    $html  = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;">' . "\r\n"
           . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
           . 'style="background:#f4f4f4;padding:24px 12px;"><tr><td align="center">' . "\r\n"
           . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
           . 'style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;'
           . 'border:1px solid #e0e0e0;">' . "\r\n"

           // Header bar
           . '<tr><td style="background:#121212;padding:18px 24px;">'
           . '<div style="font:700 17px/1.3 Arial,sans-serif;color:#ffffff;">New property enquiry</div>'
           . '<div style="font:400 12px/1.4 Arial,sans-serif;color:#b0b0b0;padding-top:3px;">'
           . 'Submitted via the HSG Property app</div></td></tr>' . "\r\n"

           // Contact details
           . '<tr><td style="padding:20px 24px 6px;">'
           . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . "\r\n"
           . hsg_contact_row('Name', $name)
           . hsg_contact_row('Phone', $phone, $phone !== '' ? 'tel:' . preg_replace('/[^0-9+]/', '', $phone) : '')
           . hsg_contact_row('Email', $email, $email !== '' ? 'mailto:' . $email : '')
           . hsg_contact_row('POPIA consent', $consentText)
           . '</table></td></tr>' . "\r\n"

           // Calculation
           . '<tr><td style="padding:14px 24px 4px;">'
           . '<div style="font:700 11px/1.4 Arial,sans-serif;color:#888;letter-spacing:.08em;'
           . 'text-transform:uppercase;padding-bottom:6px;">Calculation</div>'
           . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . "\r\n"
           . hsg_scenario_rows($scenario)
           . '</table></td></tr>' . "\r\n"

           // Footer warning
           . '<tr><td style="padding:16px 24px 22px;">'
           . '<div style="font:400 11px/1.5 Arial,sans-serif;color:#8a6d3b;background:#fcf8e3;'
           . 'border:1px solid #faebcc;border-radius:5px;padding:10px 12px;">'
           . hsg_h($warning) . '</div></td></tr>' . "\r\n"

           . '</table></td></tr></table></body></html>' . "\r\n";

    /* ---- Assemble multipart/alternative ---- */
    $boundary = 'hsg-' . bin2hex(random_bytes(12));
    $body  = 'This is a multi-part message in MIME format.' . "\r\n\r\n";
    $body .= '--' . $boundary . "\r\n";
    $body .= 'Content-Type: text/plain; charset=UTF-8' . "\r\n";
    $body .= 'Content-Transfer-Encoding: quoted-printable' . "\r\n\r\n";
    $body .= quoted_printable_encode($text) . "\r\n";
    $body .= '--' . $boundary . "\r\n";
    $body .= 'Content-Type: text/html; charset=UTF-8' . "\r\n";
    $body .= 'Content-Transfer-Encoding: quoted-printable' . "\r\n\r\n";
    $body .= quoted_printable_encode($html) . "\r\n";
    $body .= '--' . $boundary . '--' . "\r\n";

    $from = (string)$cfg['from'];

    /* Same rule for the Reply-To display name — an accented client name
     * would reproduce the subject bug exactly. Strip the address-list
     * punctuation first: for a plain-ASCII name the encoder is a no-op, so
     * "Smith, John" would otherwise split Reply-To into two addresses. */
    $replyName = mb_encode_mimeheader(
        trim(str_replace(['"', '<', '>', ',', ';', ':', '@'], ' ', $name)),
        'UTF-8',
        'B'
    );
    $replyTo = ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL))
        ? ($replyName . ' <' . $email . '>')
        : $from;

    $headers  = "From: $from\r\n";
    $headers .= "Reply-To: $replyTo\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= 'Content-Type: multipart/alternative; boundary="' . $boundary . '"' . "\r\n";
    $headers .= "X-Mailer: HSG-Property-App\r\n";

    return [
        'to'       => (string)$cfg['to'],
        'from'     => $from,
        'subject'  => $subject,
        'body'     => $body,
        'headers'  => $headers,
        'reply_to' => $replyTo,
    ];
}

/**
 * Send via authenticated SMTP. Returns [ok(bool), log(string)].
 *
 * @param array<string,mixed>|null $smtpOverride optional smtp subset for tests
 */
function hsg_smtp_send(
    string $to,
    string $subject,
    string $body,
    string $headers,
    string $fromHeader,
    ?array $smtpOverride = null
): array {
    $cfg = hsg_mail_config();
    $smtp = $smtpOverride ?? ($cfg['smtp'] ?? []);
    $log = [];

    $host = (string)($smtp['host'] ?? '');
    $port = (int)($smtp['port'] ?? 465);
    $user = (string)($smtp['username'] ?? '');
    $pass = (string)($smtp['password'] ?? '');
    $timeout = (int)($smtp['timeout'] ?? 30);
    $fromAddr = hsg_parse_email_address($fromHeader);

    if ($host === '' || $user === '' || $pass === '' || $fromAddr === '') {
        return [false, "SMTP config incomplete (host/user/pass/from)."];
    }
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return [false, "Invalid recipient: $to"];
    }
    if (!filter_var($fromAddr, FILTER_VALIDATE_EMAIL)) {
        return [false, "Invalid From address: $fromAddr"];
    }

    $remote = 'ssl://' . $host . ':' . $port;
    $log[] = "Connecting to $remote …";

    $errno = 0;
    $errstr = '';
    $ctx = stream_context_create([
        'ssl' => [
            // Shared-host certs often mismatch; still encrypt the session.
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true,
        ],
    ]);
    $fp = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        return [false, implode("\n", $log) . "\nCONNECT FAILED: [$errno] $errstr"];
    }
    stream_set_timeout($fp, $timeout);

    $read = function () use ($fp, &$log): string {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            $log[] = '← ' . rtrim($line, "\r\n");
            // Multi-line replies: "250-…" continues, "250 …" ends.
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };
    $write = function (string $cmd) use ($fp, &$log): void {
        $trim = trim($cmd);
        if (strcasecmp($trim, 'AUTH LOGIN') === 0) {
            $visible = 'AUTH LOGIN';
        } elseif (preg_match('/^[A-Za-z0-9+\/=]+$/', $trim) && strlen($trim) >= 8) {
            $visible = '[credential]';
        } else {
            $visible = strlen($cmd) > 140 ? substr($cmd, 0, 137) . '…' : $cmd;
        }
        $log[] = '→ ' . $visible;
        fwrite($fp, $cmd . "\r\n");
    };
    $expect = function (string $resp, string $codes) use (&$log): bool {
        $okCodes = array_map('trim', explode(',', $codes));
        $code = substr(trim($resp), 0, 3);
        if (!in_array($code, $okCodes, true)) {
            $log[] = "EXPECTED $codes, got: " . trim($resp);
            return false;
        }
        return true;
    };

    try {
        $banner = $read();
        if (!$expect($banner, '220')) {
            fclose($fp);
            return [false, implode("\n", $log)];
        }

        $ehloHost = 'app.hsgattorneys.co.za';
        $write('EHLO ' . $ehloHost);
        if (!$expect($read(), '250')) {
            fclose($fp);
            return [false, implode("\n", $log)];
        }

        $write('AUTH LOGIN');
        if (!$expect($read(), '334')) {
            fclose($fp);
            return [false, implode("\n", $log)];
        }
        $write(base64_encode($user));
        if (!$expect($read(), '334')) {
            fclose($fp);
            return [false, implode("\n", $log)];
        }
        $write(base64_encode($pass));
        $authResp = $read();
        if (!$expect($authResp, '235')) {
            $log[] = 'AUTH failed — check username/password and that SMTP is allowed for this mailbox.';
            fclose($fp);
            return [false, implode("\n", $log)];
        }
        $log[] = 'AUTH OK';

        $write('MAIL FROM:<' . $fromAddr . '>');
        if (!$expect($read(), '250')) {
            fclose($fp);
            return [false, implode("\n", $log)];
        }

        $write('RCPT TO:<' . $to . '>');
        if (!$expect($read(), '250,251')) {
            fclose($fp);
            return [false, implode("\n", $log)];
        }

        $write('DATA');
        if (!$expect($read(), '354')) {
            fclose($fp);
            return [false, implode("\n", $log)];
        }

        // Dot-stuff body lines that start with '.'
        $safeBody = preg_replace('/^\./m', '..', $body);
        $msg  = 'Subject: ' . $subject . "\r\n";
        $msg .= $headers;
        if (stripos($headers, 'From:') === false) {
            $msg .= 'From: ' . $fromHeader . "\r\n";
        }
        if (stripos($headers, 'To:') === false) {
            $msg .= 'To: <' . $to . ">\r\n";
        }
        $msg .= "\r\n" . $safeBody . "\r\n.";

        // Log only a short preview of DATA payload
        $log[] = '→ DATA payload (' . strlen($msg) . ' bytes) subject=' . $subject;
        fwrite($fp, $msg . "\r\n");
        if (!$expect($read(), '250')) {
            fclose($fp);
            return [false, implode("\n", $log)];
        }

        $write('QUIT');
        $read();
        fclose($fp);

        $log[] = 'SMTP send completed successfully.';
        return [true, implode("\n", $log)];
    } catch (Throwable $e) {
        if (is_resource($fp)) {
            fclose($fp);
        }
        $log[] = 'Exception: ' . $e->getMessage();
        return [false, implode("\n", $log)];
    }
}

/**
 * Convenience: send a lead-shaped enquiry via SMTP.
 *
 * @param array<string,mixed> $lead
 * @return array{ok:bool,log:string,to:string,subject:string}
 */
function hsg_send_lead_email(array $lead): array {
    $mail = hsg_build_enquiry_mail($lead);
    [$ok, $log] = hsg_smtp_send(
        $mail['to'],
        $mail['subject'],
        $mail['body'],
        $mail['headers'],
        $mail['from']
    );
    return [
        'ok'      => $ok,
        'log'     => $log,
        'to'      => $mail['to'],
        'subject' => $mail['subject'],
    ];
}
