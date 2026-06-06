<?php
/* =====================================================================
 * submit.php — emails HSG Property quote enquiries to the firm.
 * Put this file in the SAME folder as index.html on the cPanel host.
 * No third-party service or key needed: it sends from your own domain.
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
$data = json_decode($raw, true);
if (!is_array($data)) { $data = $_POST; }

// Honeypot: bots fill the hidden "company" field; humans never see it.
if (!empty($data['company'])) { echo json_encode(['success' => true]); exit; }

$clean = function ($s) { return trim(str_replace(["\r", "\n"], ' ', (string)$s)); };
$name     = $clean($data['name']  ?? '');
$phone    = $clean($data['phone'] ?? '');
$email    = $clean($data['email'] ?? '');
$scenario = trim((string)($data['scenario'] ?? ''));

if ($name === '' || $phone === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Invalid input']);
    exit;
}

$subject  = $SUBJECT_PREFIX . ' — ' . $name;
$body  = "New enquiry from the HSG Property app\n\n";
$body .= "Name:  $name\n";
$body .= "Phone: $phone\n";
$body .= "Email: $email\n\n";
$body .= "--- Calculation ---\n" . $scenario . "\n";

$headers  = "From: $FROM\r\n";
$headers .= "Reply-To: " . $name . " <" . $email . ">\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "X-Mailer: HSG-Property-App\r\n";

$sent = @mail($TO, $subject, $body, $headers);

echo json_encode(['success' => (bool)$sent]);
