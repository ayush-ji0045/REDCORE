(() => {
  const home = 'index.html';
  const offlinePath = 'offline.html';
  const showFault = () => {
    if (!document.body || document.querySelector('[data-redcore-fault]')) return;
    const overlay = document.createElement('section');
    overlay.dataset.redcoreFault = 'true'; overlay.className = 'rc-fault-screen';
    overlay.setAttribute('role', 'alertdialog'); overlay.setAttribute('aria-labelledby', 'rc-fault-title');
    overlay.innerHTML = '<div class="rc-fault-card"><p class="rc-eyebrow">REDCORE / SYSTEM NOTICE</p><h1 id="rc-fault-title">Something went off-script.</h1><p>An unexpected error interrupted this page. Your games and saved progress have not been intentionally changed.</p><div class="rc-fault-actions"><button type="button" data-retry>Try again</button><a href="' + home + '">Back to home</a></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('[data-retry]').addEventListener('click', () => location.reload());
  };
  addEventListener('error', e => { if (e.error || e.message) showFault(); });
  addEventListener('unhandledrejection', () => showFault());
  const updateNetwork = () => {
    let banner = document.querySelector('[data-rc-network]');
    if (!navigator.onLine) {
      if (!banner) {
        banner = document.createElement('div'); banner.dataset.rcNetwork = 'true'; banner.className = 'rc-network-banner';
        banner.setAttribute('role', 'status');
        banner.innerHTML = '<span><strong>You’re offline.</strong> Some online features may not work.</span><a href="' + offlinePath + '">Troubleshoot</a><button type="button" aria-label="Dismiss offline notice">×</button>';
        document.body.prepend(banner);
        banner.querySelector('button').addEventListener('click', () => banner.remove());
      }
    } else if (banner) banner.remove();
  };
  addEventListener('offline', updateNetwork); addEventListener('online', updateNetwork);
  updateNetwork();
})();