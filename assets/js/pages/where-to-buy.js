/* where-to-buy.html: search and filter the distributor listings. */
(() => {
  'use strict';

  const app = window.OceanGate;

  app.start(() => app.pages.locations('distributor'));
})();
