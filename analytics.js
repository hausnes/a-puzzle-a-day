// Besøksstatistikk med Google Analytics, bare for spillere som har sagt ja.
// Google-skriptet lastes ikke i det hele tatt før samtykket er gitt, så uten ja
// settes ingen informasjonskapsler og ingenting sendes til Google.
// Valget lagres bare i denne nettleseren og synkroniseres ikke.
(() => {
  const MEASUREMENT_ID = 'G-238C6GDTZ1';
  const KEY = 'apad:analytics'; // 'yes' | 'no'

  let consent = null;
  try { consent = localStorage.getItem(KEY); } catch { /* spør på nytt */ }

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(s);
  }

  // Fjerner Analytics-kapslene (_ga, _ga_XXXX) når noen trekker tilbake samtykket.
  function clearCookies() {
    for (const c of document.cookie.split(';')) {
      const name = c.split('=')[0].trim();
      if (!name.startsWith('_ga')) continue;
      for (const domain of ['', `; domain=${location.hostname}`, `; domain=.${location.hostname}`]) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
      }
    }
  }

  function save(value) {
    consent = value;
    try { localStorage.setItem(KEY, value); } catch { /* gjelder bare denne økten */ }
  }

  let banner = null;
  function showBanner() {
    if (banner) { banner.hidden = false; banner.querySelector('button').focus(); return; }
    banner = document.createElement('div');
    banner.className = 'consent';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Besøksstatistikk');
    banner.innerHTML = `
      <p>Kan vi telle besøk med Google Analytics? Det hjelper oss å se hvor mange som spiller.
        Google setter da informasjonskapsler og får vite om besøket ditt. Spillet virker likt uansett,
        og du kan ombestemme deg under «Slik spiller du».</p>
      <div class="consent-actions">
        <button type="button" data-consent="yes">Ja, det er greit</button>
        <button type="button" data-consent="no">Nei takk</button>
      </div>`;
    banner.addEventListener('click', e => {
      const value = e.target.closest('[data-consent]')?.dataset.consent;
      if (!value) return;
      const wasOn = consent === 'yes';
      save(value);
      banner.hidden = true;
      if (value === 'yes') start();
      else if (wasOn) { clearCookies(); location.reload(); } // stopper skriptet som allerede kjører
    });
    document.body.appendChild(banner);
  }

  // Brukes av game.js for å telle hendelser, f.eks. at dagens oppgave er løst.
  // Gjør ingenting uten samtykke.
  window.track = (name, params) => { if (started) gtag('event', name, params); };

  function init() {
    document.getElementById('btn-analytics')?.addEventListener('click', showBanner);
    if (consent === 'yes') start();
    else if (consent !== 'no') showBanner();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
