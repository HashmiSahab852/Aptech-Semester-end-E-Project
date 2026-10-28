/* Location search used by the support and distributor pages. */
(() => {
  'use strict';

  const app = window.OceanGate;
  const { state, $, node, populateSelect } = app.shared;

  function setupLocations(kind) {
    if (!$('#locations-grid')) return;
    const records = state.locations.filter(record => record.kind === kind);
    const cities = [...new Set(records.map(record => record.city))].sort();
    populateSelect($('#location-city'), cities.map(city => ({ id: city, name: city })), 'All cities', '');
    function render() {
      const city = $('#location-city')?.value || '';
      const query = ($('#location-search')?.value || '').toLowerCase();
      const selected = records.filter(record => (!city || record.city === city) && (!query || `${record.name} ${record.city} ${record.address}`.toLowerCase().includes(query)));
      $('#locations-grid').replaceChildren(...(selected.length ? selected.map(record => node('article',
              {
                class: 'location-card'
              },
              [node('span',
                  {
                    class: 'eyebrow',
                    text: `${record.city}`
                  }),
                node('h3',
                  {
                    text: record.name
                  }),
                node('address',
                  {
                    text: record.address
                  }),
                node('p',
                  {
                    text: record.hours
                  }),
                node('p',
                  {
                    text: record.phone
                  }),
                node('a',
                  {
                    href: `mailto:${record.email}`,
                    text: record.email
                  })])) : [node('p',
              {
                class: 'empty-state',
                text: 'No locations match. Try another city or search.'
              })]));
      if ($('#location-count')) $('#location-count').textContent = `${selected.length} ${kind === 'centre' ? 'support centres' : 'outlets'}`;
    }
    $('#location-city')?.addEventListener('change', render);
    $('#location-search')?.addEventListener('input', render);
    render();
  }

  app.pages.locations = setupLocations;
})();
