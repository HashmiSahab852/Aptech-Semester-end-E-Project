/* where-to-buy.html: search and filter the sample distributor listings. */
(() => {
  'use strict';

  const app = window.OceanGate;

  app.start(() => app.pages.locations('distributor'));
})();
