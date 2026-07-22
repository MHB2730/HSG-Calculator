<?php
/* =====================================================================
 * leads.php — password-protected lead log viewer + SMTP resend.
 * Password is leads_admin_password in mail-config.php.
 * ===================================================================== */

require_once __DIR__ . '/hsg-mail.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start([
        'cookie_httponly' => true,
        'cookie_samesite' => 'Strict',
        'use_strict_mode' => true,
    ]);
}

$cfg = hsg_mail_config();
$adminPass = (string)($cfg['leads_admin_password'] ?? '');
$flash = null;
$flashOk = null;

function hsg_h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function hsg_leads_logged_in(): bool {
    return !empty($_SESSION['hsg_leads_auth']);
}

function hsg_leads_csrf(): string {
    if (empty($_SESSION['hsg_leads_csrf'])) {
        $_SESSION['hsg_leads_csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['hsg_leads_csrf'];
}

function hsg_leads_csrf_ok(?string $token): bool {
    return is_string($token)
        && isset($_SESSION['hsg_leads_csrf'])
        && hash_equals($_SESSION['hsg_leads_csrf'], $token);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'login') {
        $pass = (string)($_POST['password'] ?? '');
        if ($adminPass !== '' && hash_equals($adminPass, $pass)) {
            session_regenerate_id(true);
            $_SESSION['hsg_leads_auth'] = true;
            hsg_leads_csrf();
            header('Location: leads.php');
            exit;
        }
        $flash = 'Wrong password.';
        $flashOk = false;
    }

    if ($action === 'logout' && hsg_leads_logged_in()) {
        if (hsg_leads_csrf_ok($_POST['csrf'] ?? null)) {
            $_SESSION = [];
            session_destroy();
        }
        header('Location: leads.php');
        exit;
    }

    if ($action === 'resend' && hsg_leads_logged_in()) {
        if (!hsg_leads_csrf_ok($_POST['csrf'] ?? null)) {
            $flash = 'Invalid session token. Refresh and try again.';
            $flashOk = false;
        } else {
            $lineNo = (int)($_POST['line'] ?? 0);
            $leads = hsg_lead_read_all();
            $found = null;
            foreach ($leads as $row) {
                if ((int)($row['_line'] ?? 0) === $lineNo) {
                    $found = $row;
                    break;
                }
            }
            if (!$found) {
                $flash = "Lead line #$lineNo not found.";
                $flashOk = false;
            } else {
                $result = hsg_send_lead_email($found);
                if ($result['ok']) {
                    // The subject is RFC 2047-encoded for the wire; decode it
                    // so this admin message reads as text, not =?UTF-8?B?...?=
                    $flash = 'Resent to ' . $result['to'] . ' — '
                           . mb_decode_mimeheader($result['subject']);
                    $flashOk = true;
                } else {
                    $flash = "Resend failed.\n" . $result['log'];
                    $flashOk = false;
                }
            }
        }
    }
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

$loggedIn = hsg_leads_logged_in();
$leads = $loggedIn ? array_reverse(hsg_lead_read_all()) : [];
$paths = hsg_lead_paths();
$csrf = $loggedIn ? hsg_leads_csrf() : '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>HSG leads</title>
  <link rel="stylesheet" href="css/mail-admin.css">
</head>
<body class="admin">
<?php if (!$loggedIn): ?>
  <h1>HSG Property — leads login</h1>
  <p class="muted">Staff only. Password is set in <code>mail-config.php</code>.</p>
  <?php if ($flash !== null): ?>
    <div class="<?= $flashOk ? 'okbox' : 'errbox' ?>"><pre style="margin:0;white-space:pre-wrap"><?= hsg_h($flash) ?></pre></div>
  <?php endif; ?>
  <div class="panel login-box">
    <form method="post" autocomplete="current-password">
      <input type="hidden" name="action" value="login">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autofocus>
      <button type="submit">Log in</button>
    </form>
  </div>
<?php else: ?>
  <div class="topbar">
    <div>
      <h1>HSG Property — leads</h1>
      <p class="muted" style="margin:0">
        Log: <code><?= hsg_h($paths['file']) ?></code>
        · <?= count($leads) ?> record<?= count($leads) === 1 ? '' : 's' ?>
        · mail to <?= hsg_h((string)$cfg['to']) ?>
      </p>
    </div>
    <form method="post">
      <input type="hidden" name="action" value="logout">
      <input type="hidden" name="csrf" value="<?= hsg_h($csrf) ?>">
      <button type="submit" class="secondary">Log out</button>
    </form>
  </div>

  <?php if ($flash !== null): ?>
    <div class="<?= $flashOk ? 'okbox' : 'errbox' ?>"><pre style="margin:0;white-space:pre-wrap"><?= hsg_h($flash) ?></pre></div>
  <?php endif; ?>

  <?php if (!$leads): ?>
    <div class="panel"><p class="muted" style="margin:0">No leads logged yet.</p></div>
  <?php else: ?>
    <?php foreach ($leads as $lead): ?>
      <?php
        $line = (int)($lead['_line'] ?? 0);
        $name = (string)($lead['name'] ?? '');
        $phone = (string)($lead['phone'] ?? '');
        $email = (string)($lead['email'] ?? '');
        $when = (string)($lead['timestamp'] ?? '');
        $ip = (string)($lead['ip'] ?? '');
        $consent = !empty($lead['consent']) ? 'yes' : 'no';
        $scenario = (string)($lead['scenario'] ?? '');
      ?>
      <article class="lead">
        <div class="lead-meta">
          <span><strong>#<?= $line ?></strong></span>
          <span><?= hsg_h($when) ?></span>
          <span><?= hsg_h($name) ?></span>
          <span><a href="tel:<?= hsg_h($phone) ?>"><?= hsg_h($phone) ?></a></span>
          <span><a href="mailto:<?= hsg_h($email) ?>"><?= hsg_h($email) ?></a></span>
          <span>consent: <?= hsg_h($consent) ?></span>
          <span>ip: <?= hsg_h($ip) ?></span>
        </div>
        <pre><?= hsg_h($scenario) ?></pre>
        <div class="lead-actions">
          <form method="post">
            <input type="hidden" name="action" value="resend">
            <input type="hidden" name="csrf" value="<?= hsg_h($csrf) ?>">
            <input type="hidden" name="line" value="<?= $line ?>">
            <button type="submit">Resend email</button>
          </form>
        </div>
      </article>
    <?php endforeach; ?>
  <?php endif; ?>
<?php endif; ?>
</body>
</html>
