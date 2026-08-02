/**
 * Portfolio visitor tracker. Plain browser TypeScript, no imports — compiled
 * standalone to js/tracking.js (see package.json build:client). Posts events
 * to /api/track, which is the only place that talks to Google Sheets.
 */
(function () {
  'use strict';

  var VISITOR_KEY = 'pv_visitor_id';
  var SESSION_KEY = 'pv_session_id';
  var UTM_KEY = 'pv_utm';

  function uuid(): string {
    if ('randomUUID' in crypto) return crypto.randomUUID();
    // Fallback for older browsers without crypto.randomUUID.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getVisitorId(): string {
    try {
      var existing = localStorage.getItem(VISITOR_KEY);
      if (existing) return existing;
      var created = uuid();
      localStorage.setItem(VISITOR_KEY, created);
      return created;
    } catch {
      return uuid();
    }
  }

  var isNewSession = false;
  function getSessionId(): string {
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      var created = uuid();
      sessionStorage.setItem(SESSION_KEY, created);
      isNewSession = true;
      return created;
    } catch {
      isNewSession = true;
      return uuid();
    }
  }

  interface UtmParams {
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
  }

  function getUtmParams(): UtmParams {
    try {
      var stored = sessionStorage.getItem(UTM_KEY);
      var params = new URLSearchParams(location.search);
      var fromUrl: UtmParams = {
        utmSource: params.get('utm_source') || '',
        utmMedium: params.get('utm_medium') || '',
        utmCampaign: params.get('utm_campaign') || '',
      };
      if (fromUrl.utmSource || fromUrl.utmMedium || fromUrl.utmCampaign) {
        sessionStorage.setItem(UTM_KEY, JSON.stringify(fromUrl));
        return fromUrl;
      }
      if (stored) return JSON.parse(stored) as UtmParams;
      return { utmSource: '', utmMedium: '', utmCampaign: '' };
    } catch {
      return { utmSource: '', utmMedium: '', utmCampaign: '' };
    }
  }

  var visitorId = getVisitorId();
  var sessionId = getSessionId();
  var utm = getUtmParams();
  var lastEventTime = Date.now();

  type EventType =
    | 'page_view'
    | 'download'
    | 'button_click'
    | 'contact'
    | 'project_open'
    | 'external_link'
    | 'navigation';

  interface TrackOptions {
    page?: string;
    button?: string;
    download?: string;
    project?: string;
  }

  function track(eventType: EventType, opts?: TrackOptions): void {
    var now = Date.now();
    var durationSeconds = Math.max(0, (now - lastEventTime) / 1000);
    lastEventTime = now;

    var payload = {
      visitorId: visitorId,
      sessionId: sessionId,
      isNewSession: isNewSession,
      eventType: eventType,
      page: (opts && opts.page) || location.pathname + location.hash,
      pageTitle: document.title,
      language: navigator.language || '',
      timezone: (function () {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        } catch {
          return '';
        }
      })(),
      referrer: document.referrer || '',
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
      utmCampaign: utm.utmCampaign,
      button: (opts && opts.button) || '',
      download: (opts && opts.download) || '',
      project: (opts && opts.project) || '',
      durationSeconds: durationSeconds,
    };

    // isNewSession is consumed by exactly one request (the first of the
    // session); every subsequent call in this page lifetime is not new.
    isNewSession = false;

    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {
        /* tracking must never break the site for the visitor */
      });
    } catch {
      /* no-op */
    }
  }

  function isInternalAnchor(url: URL): boolean {
    return url.origin === location.origin && url.pathname === location.pathname && url.hash.length > 0;
  }

  function classifyAndTrack(anchor: HTMLAnchorElement): void {
    var projectCard = anchor.closest('[data-project]') as HTMLElement | null;
    var href = anchor.getAttribute('href') || '';
    var download = anchor.getAttribute('download');

    if (href.indexOf('Muhammad-Satrio-Resume.pdf') !== -1) {
      track('download', { download: 'Resume' });
      return;
    }
    if (href.indexOf('Marketing-Portfolio.pdf') !== -1) {
      track('download', { download: 'Marketing Portfolio' });
      return;
    }
    if (href.indexOf('Video-Portfolio') !== -1) {
      track('download', { download: 'Video Portfolio' });
      return;
    }
    if (href.indexOf('mailto:') === 0) {
      track('contact', { button: 'Email' });
      return;
    }

    var url: URL;
    try {
      url = new URL(href, location.href);
    } catch {
      return;
    }

    if (projectCard) {
      track('project_open', { project: projectCard.getAttribute('data-project') || '' });
      return;
    }
    if (isInternalAnchor(url)) {
      track('navigation', { page: url.hash });
      return;
    }
    if (url.hostname.indexOf('github.com') !== -1) {
      track('button_click', { button: 'GitHub' });
      return;
    }
    if (url.hostname.indexOf('linkedin.com') !== -1) {
      track('button_click', { button: 'LinkedIn' });
      return;
    }
    if (url.origin !== location.origin) {
      track('external_link', { button: anchor.textContent ? anchor.textContent.trim().slice(0, 80) : href });
      return;
    }
    if (download !== null) {
      track('download', { download: anchor.textContent ? anchor.textContent.trim().slice(0, 80) : 'File' });
    }
  }

  document.addEventListener(
    'click',
    function (evt) {
      var target = evt.target as HTMLElement | null;
      if (!target) return;
      var anchor = target.closest('a') as HTMLAnchorElement | null;
      if (anchor) {
        classifyAndTrack(anchor);
        return;
      }
      var contactBtn = target.closest('[data-track-contact]');
      if (contactBtn) {
        track('contact', { button: 'Contact' });
      }
    },
    true
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      track('page_view');
    });
  } else {
    track('page_view');
  }
})();
