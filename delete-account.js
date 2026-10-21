// Logic for delete-account.html (kept external so the page CSP can forbid inline scripts).

// Anti-clickjacking (see the note in delete-account.html): reveal the page
// only when it is the top-level window; if framed, break out of the frame.
if (window.top === window.self) {
  document.getElementById('anti-clickjack')?.remove();
} else {
  try { window.top.location = window.self.location.href; } catch { /* stays hidden */ }
  throw new Error('BoardingPal account deletion must not run inside a frame.');
}
// ---- CONFIG: set before publishing ----
const CONFIG = {
  supabaseUrl: 'https://amlehtkjbbnorborxqev.supabase.co',
  publishableKey: 'sb_publishable_bDzUHO-8mWlfK8AEQc6ddw_kI5Pv9cY',
  // Must match the developer name shown on the Google Play listing.
  developerName: 'Cosner Pagaddut',
  privacyEmail: 'pagaddutcosner10@gmail.com',
  privacyPolicyUrl: 'privacy.html#account-deletion',
};
// ---------------------------------------

const $ = (id) => document.getElementById(id);
$('developer-name').textContent = CONFIG.developerName;
$('privacy-link').href = CONFIG.privacyPolicyUrl;
$('support-link').href = 'mailto:' + CONFIG.privacyEmail + '?subject=' + encodeURIComponent('Account deletion request');

const client = supabase.createClient(CONFIG.supabaseUrl, CONFIG.publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let mode = 'password';
const setMode = (m) => {
  mode = m;
  $('password-mode').hidden = m !== 'password';
  $('code-mode').hidden = m !== 'code';
  show('');
};
$('use-code').addEventListener('click', () => setMode('code'));
$('use-password').addEventListener('click', () => setMode('password'));
$('confirm').addEventListener('change', () => { $('submit').disabled = !$('confirm').checked; });

function show(msg, kind) { $('status').textContent = msg; $('status').className = 'status ' + (kind || ''); }
const email = () => $('email').value.trim().toLowerCase();

$('send-code').addEventListener('click', async () => {
  if (!email()) { show('Enter your account email first.', 'error'); return; }
  $('send-code').disabled = true;
  // shouldCreateUser:false: this page can never create accounts. The same
  // message is shown either way so the page does not reveal who has an account.
  await client.auth.signInWithOtp({ email: email(), options: { shouldCreateUser: false } }).catch(() => {});
  show('If that email has a BoardingPal account, a 6-digit code is on its way.', 'ok');
  setTimeout(() => { $('send-code').disabled = false; }, 60000);
});

async function signIn() {
  if (mode === 'password') {
    return client.auth.signInWithPassword({ email: email(), password: $('password').value });
  }
  const token = $('code').value.trim();
  if (!/^\d{6}$/.test(token)) return { error: { message: 'Enter the 6-digit code from the email.' } };
  return client.auth.verifyOtp({ email: email(), token, type: 'email' });
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!$('confirm').checked) return;
  $('submit').disabled = true;
  show('Verifying…');
  try {
    const { data, error } = await signIn();
    if (error || !data?.session) {
      show(mode === 'password' ? 'Email or password is incorrect.' : 'That code is invalid or has expired.', 'error');
      $('submit').disabled = false;
      return;
    }
    // A password, when used, is re-checked server-side; a fresh code sign-in
    // proves recent authentication on its own.
    const body = mode === 'password' ? { password: $('password').value } : {};
    const res = await fetch(CONFIG.supabaseUrl + '/functions/v1/delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.publishableKey,
        'Authorization': 'Bearer ' + data.session.access_token,
      },
      body: JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok && result.deleted) {
      $('form').reset();
      show('Your account has been deleted.', 'ok');
    } else {
      show(result.error || 'Deletion failed. Please try again.', 'error');
      $('submit').disabled = false;
    }
  } catch (err) {
    show('Network error. Please try again.', 'error');
    $('submit').disabled = false;
  } finally {
    $('password').value = '';
    $('code').value = '';
  }
});
