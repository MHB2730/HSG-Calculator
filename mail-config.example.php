<?php
/* =====================================================================
 * mail-config.example.php — template for mail-config.php.
 *
 * COPY this to mail-config.php ON THE SERVER and fill in the real values.
 * mail-config.php is deliberately .gitignore'd: it holds the SMTP password
 * and must never be committed. It is also denied over HTTP by .htaccess
 * (see the ^(mail-config|hsg-mail)\.php$ rule).
 *
 * Because it is not in the repo, it is NOT part of the deploy bundle
 * either — it is uploaded once, by hand, and left in place across
 * deploys. If submit.php ever returns a 500, a missing or malformed
 * mail-config.php is the first thing to check.
 * ===================================================================== */

return [
    // Where enquiries are delivered.
    'to' => 'legal@hsginc.co.za',

    // Envelope + From identity. MUST be a real mailbox on a domain that
    // publishes SPF for this server. app.hsgattorneys.co.za publishes
    // "v=spf1 mx a include:spf.host-h.net ?all"; the parent
    // hsgattorneys.co.za publishes NO SPF, so do not send as the parent.
    'from' => 'HSG Property <webmaster@app.hsgattorneys.co.za>',

    // Prefixed to every enquiry subject, followed by " — " and the name.
    // The em dash is MIME-encoded by hsg-mail.php; do not "fix" that by
    // reverting to a plain hyphen — see the header-encoding note there.
    'subject_prefix' => 'New property enquiry',

    'smtp' => [
        'host'     => 'smtp.app.hsgattorneys.co.za',
        'port'     => 465,                 // implicit TLS (ssl://)
        'username' => 'webmaster@app.hsgattorneys.co.za',
        'password' => 'PUT-THE-REAL-PASSWORD-HERE',
        'timeout'  => 30,
    ],
];
