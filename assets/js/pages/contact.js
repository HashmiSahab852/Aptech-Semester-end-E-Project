/* Contact page: configured map and a visitor-reviewed email draft. */
(() => {
  'use strict';

  const app = window.OceanGate;
  const { state, $, node, announce, mapConfiguration } = app.shared;

  function renderMap(config = state.config) {
    const target = $('#map-area');
    if (!target) return;
    const coordinates = mapConfiguration(config);
    if (!coordinates) {
      target.replaceChildren(node('div',
          {
            class: 'map-placeholder'
          },
          [node('span',
              {
                class: 'map-symbol',
                text: '⌖',
                'aria-hidden': 'true'
              }),
            node('h2',
              {
                text: 'Location to be configured'
              }),
            node('p',
              {
                text: 'Our company address and map location will appear here once confirmed.'
              })]));
      return;
    }
    const point = `${coordinates.lat},${coordinates.lon}`;
    const embed = new URL('https://maps.google.com/maps');
    embed.searchParams.set('q', point);
    embed.searchParams.set('z', coordinates.zoom);
    embed.searchParams.set('output', 'embed');
    const directions = new URL('https://www.google.com/maps/dir/');
    directions.searchParams.set('api', '1');
    directions.searchParams.set('destination', point);
    target.replaceChildren(node('iframe',
        {
          src: embed.href,
          title: `${config.locationLabel || 'OceanGate'} map location`,
          loading: 'lazy',
          referrerpolicy: 'no-referrer-when-downgrade',
          allowfullscreen: '',
          width: '800',
          height: '420'
        }),
      node('a',
        {
          href: directions.href,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'btn btn-outline',
          text: 'Open in Google Maps / Get directions'
        }));
  }

  function setupContact() {
    if ($('#contact-info')) $('#contact-info').replaceChildren(node('h2',
        {
          text: 'Talk to OceanGate'
        }),
      node('address',
        {
          text: state.config.address || 'Company address to be configured'
        }),
      node('p',
        {
          text: state.config.phone || 'Phone to be configured'
        }),
      node('a',
        {
          href: `mailto:${state.config.email}`,
          text: state.config.email
        }),
      node('p',
        {
          class: 'demo-note',
          text: 'Contact placeholders are part of this educational project. Replace them before launch.'
        }));
    renderMap();
    $('#contact-form')?.addEventListener('submit', event => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const values = new FormData(form);
        const name = String(values.get('name') || '').trim().slice(0, 120);
        const email = String(values.get('email') || '').trim().slice(0, 200);
        const subject = String(values.get('subject') || '').trim().slice(0, 160);
        const message = String(values.get('message') || '').trim().slice(0, 5000);
        if (!name || !email || !subject || !message) {
          announce('Complete each field before opening an email draft.',
            true);
          return;
        }
        const body = `${message}\n\nFrom: ${name}\nReply email: ${email}`;
        // This opens the visitor's mail client; no message is transmitted by the site.
        location.href = `mailto:${state.config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        announce('Email draft requested in your mail app. Review and send it there; nothing was sent by this site.');
      });
  }

  app.start(setupContact);
})();
