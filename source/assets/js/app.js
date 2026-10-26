/* OceanGate catalogue enhancement. XML is the only catalogue/configuration source.
 * Visitor state lives only in memory and validated URL parameters. */
(() => {
  'use strict';

  const root = new URL(document.body.dataset.root || './', location.href);
  const pageName = document.body.dataset.page || '';
  const $ = (selector, within = document) => within.querySelector(selector);
  const $$ = (selector, within = document) => [...within.querySelectorAll(selector)];
  const state = { products: [], byId: new Map(), brands: [], categories: [], config: {}, cart: new Map(), compare: [], locations: [], loaded: false };
  let cataloguePage = 1;
  const PAGE_SIZE = 12;
  let messageTimer;

  // All XML-derived text enters the document through textContent, never innerHTML.
  function node(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === undefined || value === null || value === false) return;
      if (key === 'text') element.textContent = value;
      else if (key === 'class') element.className = value;
      else if (key === 'checked') element.checked = Boolean(value);
      else if (key === 'value') element.value = value;
      else element.setAttribute(key, value === true ? '' : String(value));
    });
    children.forEach(child => element.append(child));
    return element;
  }
  const text = (xml, selector) => xml.querySelector(selector)?.textContent.trim() || '';
  const fields = xml => Object.fromEntries([...xml.children].map(child => [child.tagName, child.textContent.trim()]));
  const link = (label, path, className = '') => node('a', { href: localPath(path), class: className, text: label });
  const localPath = path => new URL(path, root).href;
  const typeLabel = value => value.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  const brandName = id => state.brands.find(brand => brand.id === id)?.name || id;
  const categoryName = id => state.categories.find(category => category.id === id)?.name || id;
  const productPath = product => `products/${product.slug}/index.html`;
  const cents = value => Math.round(Number(value) * 100);
  const money = value => new Intl.NumberFormat('en-PK', { style: 'currency', currency: state.config.currency || 'PKR', maximumFractionDigits: 2 }).format(value);
  function announce(message, error = false) {
    let target = $('#site-status');
    if (!target) {
      target = node('div', { id: 'site-status', role: 'status', 'aria-live': 'polite', class: 'site-status' });
      document.body.append(target);
    }
    clearTimeout(messageTimer);
    target.textContent = message;
    target.hidden = false;
    target.classList.add('is-visible');
    target.classList.toggle('is-error', error);
    messageTimer = setTimeout(() => target.classList.remove('is-visible'), 6000);
  }

  function safeAsset(path, allowedPrefix) {
    if (!path.startsWith(allowedPrefix) || path.includes('..') || !/^[a-zA-Z0-9_./-]+$/.test(path)) throw new Error('The catalogue contains an invalid local asset path.');
    return path;
  }

  function parseCatalogue(source) {
    const xml = new DOMParser().parseFromString(source, 'application/xml');
    if (xml.querySelector('parsererror') || xml.documentElement.tagName !== 'oceanGate') throw new Error('The catalogue XML could not be read. Please check its format.');
    const configElement = xml.querySelector('config');
    if (!configElement) throw new Error('The catalogue configuration is missing.');
    const config = fields(configElement);
    if (!/^[A-Z]{3}$/.test(config.currency || '')) throw new Error('The catalogue currency is invalid.');
    const brands = [...xml.querySelectorAll('brands > brand')].map(item => ({ id: item.getAttribute('id'), ...fields(item) }));
    const categories = [...xml.querySelectorAll('categories > category')].map(item => ({ id: item.getAttribute('id'), ...fields(item) }));
    const ids = new Set();
    const products = [...xml.querySelectorAll('products > product')].map(item => {
      const product = {
        id: item.getAttribute('id'), brand: item.getAttribute('brand'), category: item.getAttribute('category'),
        comparisonType: item.getAttribute('comparisonType'), slug: item.getAttribute('slug'), featured: item.getAttribute('featured') === 'true',
        name: text(item, 'name'), model: text(item, 'model'), description: text(item, 'description'), price: Number(text(item, 'price')),
        image: safeAsset(text(item, 'image'), 'assets/images/'), imageAlt: text(item, 'imageAlt'),
        download: safeAsset(text(item, 'download'), 'downloads/specifications/'),
        features: [...item.querySelectorAll('features > feature')].map(feature => feature.textContent.trim()),
        specifications: [...item.querySelectorAll('specifications > spec')].map(spec => ({ name: spec.getAttribute('name'), value: spec.textContent.trim() })),
        compatibility: text(item, 'compatibility'), useCases: [...item.querySelectorAll('useCases > useCase')].map(useCase => useCase.textContent.trim()),
        reviews: [...item.querySelectorAll('reviews > review')].map(review => ({ author: review.getAttribute('author'), text: review.textContent.trim() }))
      };
      if (!/^[a-zA-Z0-9_-]+$/.test(product.id || '') || ids.has(product.id) || !/^[a-z0-9-]+$/.test(product.slug || '') || !product.name || !Number.isFinite(product.price) || product.price <= 0 || !brands.some(brand => brand.id === product.brand) || !categories.some(category => category.id === product.category)) throw new Error('The catalogue contains an incomplete or duplicate product.');
      ids.add(product.id);
      return product;
    });
    if (products.length === 0) throw new Error('No products are available in the catalogue.');
    const locations = [...xml.querySelectorAll('supportCentres > centre, distributors > distributor')].map(item => ({ id: item.getAttribute('id'), kind: item.tagName, ...fields(item) }));
    return { config, products, brands, categories, locations };
  }

  // Integer quantities and known IDs are accepted; duplicate lines combine up to 99.
  function parseCart(value, byId = state.byId) {
    const cart = new Map();
    let rejected = false;
    if (!value) return { cart, rejected };
    for (const item of String(value).split(',').slice(0, 1000)) {
      const match = /^([a-zA-Z0-9_-]+):([1-9]\d?)$/.exec(item);
      if (!match || !byId.has(match[1])) { rejected = true; continue; }
      const quantity = Number(match[2]);
      const combined = (cart.get(match[1]) || 0) + quantity;
      if (combined > 99) rejected = true;
      cart.set(match[1], Math.min(combined, 99));
    }
    return { cart, rejected };
  }
  function parseComparison(value, byId = state.byId) {
    const compare = [];
    let rejected = false;
    if (!value) return { compare, rejected };
    for (const id of String(value).split(',').slice(0, 1000)) {
      const product = byId.get(id);
      if (!product || compare.includes(id) || compare.length === 2 || (compare.length && byId.get(compare[0]).comparisonType !== product.comparisonType)) { rejected = true; continue; }
      compare.push(id);
    }
    return { compare, rejected };
  }
  const serializeCart = () => [...state.cart].map(([id, quantity]) => `${id}:${quantity}`).join(',');
  function withState(url) {
    const next = new URL(url, location.href);
    const cart = serializeCart();
    cart ? next.searchParams.set('cart', cart) : next.searchParams.delete('cart');
    state.compare.length ? next.searchParams.set('compare', state.compare.join(',')) : next.searchParams.delete('compare');
    return next;
  }
  function updateStateURL() {
    const next = withState(location.href);
    history.replaceState(null, '', next);
    $$('[data-cart-count]').forEach(badge => { badge.textContent = [...state.cart.values()].reduce((sum, quantity) => sum + quantity, 0); });
    $$('[data-compare-count]').forEach(badge => { badge.textContent = state.compare.length; });
    // Search, filtering, and personal state variants are deliberately non-indexable.
    if ([...next.searchParams.keys()].some(key => ['cart', 'compare', 'q', 'sort', 'brand', 'category', 'type', 'page', 'id'].includes(key))) {
      let robots = $('meta[name="robots"]');
      if (!robots) { robots = node('meta', { name: 'robots' }); document.head.append(robots); }
      robots.content = 'noindex,follow';
    }
    updateCompareTray();
  }

  function productImage(product, className = '') {
    return node('img', { src: localPath(product.image), alt: product.imageAlt, width: 640, height: 480, loading: 'lazy', decoding: 'async', class: className });
  }
  function actionButton(label, action, id, className = 'btn btn-secondary') {
    return node('button', { type: 'button', class: className, text: label, 'data-action': action, 'data-id': id });
  }
  function productCard(product) {
    const imageLink = link('', productPath(product), 'product-image');
    imageLink.append(productImage(product));
    const content = node('div', { class: 'product-content' }, [
      node('p', { class: 'product-meta', text: `${brandName(product.brand)} / ${typeLabel(product.comparisonType)}` }),
      node('h3', {}, [link(product.name, productPath(product))]),
      node('ul', { class: 'product-features' }, product.features.slice(0, 2).map(feature => node('li', { text: feature }))),
      node('p', { class: 'product-price' }, [node('span', { text: money(product.price) }), node('small', { text: 'Demo price' })]),
      node('div', { class: 'product-actions' }, [
        link('View details', productPath(product), 'btn btn-outline'),
        actionButton('Add to cart', 'cart-add', product.id, 'btn btn-primary'),
        actionButton('Compare +', 'compare-add', product.id, 'text-action'),
        node('a', { href: localPath(product.download), download: '', class: 'text-action', text: 'Specifications .docx' })
      ])
    ]);
    return node('article', { class: 'product-card', 'data-product': product.id }, [imageLink, content]);
  }

  function addToCart(id) {
    const product = state.byId.get(id);
    if (!product) { announce('This product is unavailable. Please reload the catalogue.', true); return false; }
    const quantity = state.cart.get(id) || 0;
    if (quantity >= 99) { announce('The maximum quantity is 99 per product.', true); return false; }
    state.cart.set(id, quantity + 1);
    updateStateURL();
    if (pageName === 'cart') renderCart();
    announce(`${product.name} added to your demo cart. Quantity: ${quantity + 1}.`);
    return true;
  }
  function setQuantity(id, value) {
    if (!state.cart.has(id)) return false;
    if (!/^[1-9]\d?$/.test(String(value))) { announce('Enter a whole-number quantity from 1 to 99.', true); return false; }
    state.cart.set(id, Number(value));
    updateStateURL();
    renderCart();
    announce('Cart quantity updated.');
    return true;
  }
  function addToCompare(id) {
    const product = state.byId.get(id);
    if (!product) { announce('Select a product from this catalogue.', true); return false; }
    if (state.compare.includes(id)) { announce('That product is already selected. Choose a different product.', true); return false; }
    if (state.compare.length >= 2) { announce('Compare exactly two products. Remove or replace one first.', true); return false; }
    if (state.compare.length && state.byId.get(state.compare[0]).comparisonType !== product.comparisonType) { announce(`Choose another ${typeLabel(state.byId.get(state.compare[0]).comparisonType)} product for a compatible comparison.`, true); return false; }
    state.compare.push(id);
    updateStateURL();
    if (pageName === 'compare') renderCompare();
    announce(`${product.name} selected for comparison. ${state.compare.length} of 2 selected.`);
    return true;
  }
  function updateCompareTray() {
    let tray = $('#compare-tray');
    if (!tray) {
      tray = node('aside', { id: 'compare-tray', class: 'compare-tray', 'aria-label': 'Selected comparison products' });
      document.body.append(tray);
    }
    tray.hidden = state.compare.length === 0 || pageName === 'compare';
    if (tray.hidden) return;
    tray.replaceChildren(node('span', { text: `${state.compare.length}/2 selected` }), ...state.compare.map(id => actionButton(`Remove ${state.byId.get(id).name}`, 'compare-remove', id, 'compare-chip')), link('Compare products →', 'compare.html', 'btn btn-primary'));
  }

  function populateSelect(select, records, placeholder, selected) {
    if (!select) return;
    select.replaceChildren(node('option', { value: '', text: placeholder }), ...records.map(record => node('option', { value: record.id, text: record.name })));
    select.value = selected || '';
  }
  function setupCatalogue() {
    if (!$('#product-grid')) return;
    $('#catalogue-controls')?.addEventListener('submit', event => { event.preventDefault(); cataloguePage = 1; renderCatalogue(); });
    const params = new URLSearchParams(location.search);
    populateSelect($('#category-filter'), state.categories, 'All categories', params.has('category') ? params.get('category') : document.body.dataset.category || '');
    populateSelect($('#brand-filter'), state.brands, 'All brands', params.has('brand') ? params.get('brand') : document.body.dataset.brand || '');
    populateSelect($('#type-filter'), [...new Set(state.products.map(product => product.comparisonType))].sort().map(type => ({ id: type, name: typeLabel(type) })), 'All product types', params.get('type'));
    if ($('#search')) $('#search').value = (params.get('q') || '').slice(0, 200);
    if ($('#sort')) $('#sort').value = ['name-asc', 'price-asc', 'price-desc'].includes(params.get('sort')) ? params.get('sort') : 'name-asc';
    const requestedPage = Number(params.get('page'));
    cataloguePage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    ['#search', '#category-filter', '#brand-filter', '#type-filter', '#sort'].forEach(selector => {
      $(selector)?.addEventListener(selector === '#search' ? 'input' : 'change', () => { cataloguePage = 1; renderCatalogue(); });
    });
    $('#clear-filters')?.addEventListener('click', () => {
      ['#search', '#category-filter', '#brand-filter', '#type-filter'].forEach(selector => { if ($(selector)) $(selector).value = ''; });
      if ($('#sort')) $('#sort').value = 'name-asc';
      cataloguePage = 1;
      renderCatalogue();
    });
    renderCatalogue();
  }
  function filteredProducts() {
    const query = ($('#search')?.value || '').trim().toLocaleLowerCase();
    const category = $('#category-filter')?.value || '';
    const brand = $('#brand-filter')?.value || '';
    const type = $('#type-filter')?.value || '';
    const sort = $('#sort')?.value || 'name-asc';
    const filtered = state.products.filter(product => (!category || product.category === category) && (!brand || product.brand === brand) && (!type || product.comparisonType === type) && (!query || [product.name, product.model, brandName(product.brand), categoryName(product.category), product.description, ...product.features, ...product.specifications.map(spec => `${spec.name} ${spec.value}`)].join(' ').toLocaleLowerCase().includes(query)));
    filtered.sort((a, b) => sort === 'price-asc' ? a.price - b.price || a.name.localeCompare(b.name) : sort === 'price-desc' ? b.price - a.price || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
    return filtered;
  }
  function renderCatalogue() {
    const grid = $('#product-grid');
    if (!grid) return;
    const filtered = filteredProducts();
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    cataloguePage = Math.min(cataloguePage, pages);
    const current = filtered.slice((cataloguePage - 1) * PAGE_SIZE, cataloguePage * PAGE_SIZE);
    grid.replaceChildren(...(current.length ? current.map(productCard) : [node('div', { class: 'empty-state' }, [node('h2', { text: 'No products match these filters' }), node('p', { text: 'Try a broader search, another product type, or clear the filters.' })])]));
    if ($('#results-count')) $('#results-count').textContent = `${filtered.length} products · Showing ${filtered.length ? (cataloguePage - 1) * PAGE_SIZE + 1 : 0}–${Math.min(cataloguePage * PAGE_SIZE, filtered.length)}`;
    const pagination = $('#pagination');
    if (pagination) {
      pagination.replaceChildren();
      if (pages > 1) for (let index = 1; index <= pages; index += 1) {
        const button = node('button', { type: 'button', class: `page-button ${index === cataloguePage ? 'active' : ''}`, text: index, 'aria-label': `Page ${index}`, 'aria-current': index === cataloguePage ? 'page' : null });
        button.addEventListener('click', () => { cataloguePage = index; renderCatalogue(); grid.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
        pagination.append(button);
      }
    }
    const next = new URL(location.href);
    // Stable landing pages keep their clean canonical URL. An explicit "all"
    // value distinguishes clearing that landing's preset from an absent filter.
    const filterValue = (selector, preset) => {
      const value = $(selector)?.value || '';
      return preset ? (value === preset ? '' : value || 'all') : value;
    };
    const values = { q: $('#search')?.value.trim(), category: filterValue('#category-filter', document.body.dataset.category), brand: filterValue('#brand-filter', document.body.dataset.brand), type: $('#type-filter')?.value, sort: $('#sort')?.value === 'name-asc' ? '' : $('#sort')?.value, page: cataloguePage === 1 ? '' : cataloguePage };
    Object.entries(values).forEach(([key, value]) => value ? next.searchParams.set(key, value) : next.searchParams.delete(key));
    history.replaceState(null, '', next);
    updateStateURL();
  }

  function specificationTable(product) {
    return node('table', { class: 'spec-table table' }, [node('caption', { class: 'visually-hidden', text: `${product.name} specifications` }), node('tbody', {}, product.specifications.map(spec => node('tr', {}, [node('th', { scope: 'row', text: spec.name }), node('td', { text: spec.value || 'Not provided' })])))]);
  }
  function renderDetail() {
    const target = $('#product-detail');
    if (!target) return;
    const id = document.body.dataset.productId || new URLSearchParams(location.search).get('id');
    const product = state.byId.get(id);
    if (!product) {
      target.replaceChildren(node('div', { class: 'empty-state' }, [node('h1', { text: id ? 'Product not found' : 'Choose a product to view' }), node('p', { text: 'This product link is missing or no longer matches the catalogue.' }), link('Browse all products', 'products.html', 'btn btn-primary')]));
      return;
    }
    const image = productImage(product);
    image.loading = 'eager';
    const info = node('div', { class: 'detail-info' }, [
      node('p', { class: 'eyebrow', text: `${brandName(product.brand)} / ${typeLabel(product.comparisonType)}` }),
      node('h1', { text: product.name }), node('p', { class: 'lead', text: product.description }),
      node('p', { class: 'model', text: `Demo SKU: ${product.model}` }),
      node('p', { class: 'product-price', text: `${money(product.price)} · Demo price` }),
      node('ul', { class: 'detail-features' }, product.features.map(feature => node('li', { text: feature }))),
      node('div', { class: 'detail-actions' }, [actionButton('Add to cart', 'cart-add', product.id, 'btn btn-primary'), actionButton('Add to compare', 'compare-add', product.id), node('a', { href: localPath(product.download), download: '', class: 'btn btn-outline', text: 'Download specifications .docx' })]),
      node('p', { class: 'demo-note', text: 'Educational catalogue sample. Specifications, prices and illustrations are demonstrative and are not manufacturer-verified offers.' }),
      node('p', { class: 'context-links' }, [link(`Explore ${categoryName(product.category)}`, `categories/${product.category}/index.html`), document.createTextNode(' · '), link(`More from ${brandName(product.brand)}`, `brands/${product.brand}/index.html`)])
    ]);
    const lower = node('div', { class: 'detail-sections row g-4' }, [
      node('section', { class: 'col-lg-7' }, [node('h2', { text: 'Specifications' }), specificationTable(product)]),
      node('section', { class: 'col-lg-5' }, [node('h2', { text: 'Compatibility & care' }), node('p', { text: product.compatibility }), node('h3', { text: 'Made for these uses' }), node('ul', {}, product.useCases.map(useCase => node('li', { text: useCase }))), link('Get product support →', 'support.html'), node('h3', { text: 'Sample customer notes' }), ...product.reviews.map(review => node('blockquote', { class: 'sample-review' }, [node('p', { text: review.text }), node('cite', { text: `${review.author} · Illustrative review` })]))])
    ]);
    target.replaceChildren(node('div', { class: 'detail-grid' }, [node('div', { class: 'detail-image' }, [image, node('p', { class: 'image-caption', text: 'Product illustration' })]), info]), lower);
  }

  function comparisonSlot(index) {
    const id = state.compare[index];
    const product = state.byId.get(id);
    const reference = state.byId.get(state.compare[index === 0 ? 1 : 0]);
    const options = state.products.filter(item => !reference || (item.id !== reference.id && item.comparisonType === reference.comparisonType));
    const select = node('select', { id: `compare-slot-${index}`, class: 'form-select', 'aria-label': `Select product ${index + 1}` }, [node('option', { value: '', text: index === 1 && !state.compare[0] ? 'Select product one first' : 'Choose or replace a product' }), ...options.map(item => node('option', { value: item.id, text: `${brandName(item.brand)} — ${item.name}` }))]);
    select.value = id || '';
    select.disabled = index === 1 && !state.compare[0];
    select.addEventListener('change', () => {
      const next = select.value;
      if (!next) { state.compare.splice(index, 1); }
      else if (index === 0) { state.compare[0] = next; }
      else { state.compare[1] = next; }
      updateStateURL();
      renderCompare();
      announce(next ? 'Comparison selection updated.' : 'Product removed from comparison.');
    });
    const slot = node('section', { class: 'compare-slot' }, [node('label', { for: `compare-slot-${index}`, text: `Product ${index + 1}` }), select]);
    if (product) slot.append(productImage(product), node('h2', { text: product.name }), node('p', { text: `${brandName(product.brand)} · ${money(product.price)} demo price` }), link('View details', productPath(product)), actionButton('Remove', 'compare-remove', id, 'text-action'));
    else slot.append(node('div', { class: 'slot-empty', text: index === 0 ? 'Start with a product you want to explore.' : 'Then choose a different product of the same type.' }));
    return slot;
  }
  function renderCompare() {
    const target = $('#compare-app');
    if (!target) return;
    const differencesOnly = $('#differences-only')?.checked || false;
    const highlightDifferences = $('#highlight-differences')?.checked ?? true;
    target.replaceChildren(node('div', { class: 'compare-slots' }, [comparisonSlot(0), comparisonSlot(1)]));
    if (state.compare.length) target.append(actionButton('Reset comparison', 'compare-reset', '', 'btn btn-outline'));
    if (state.compare.length < 2) {
      target.append(node('p', { class: 'empty-state', text: state.compare.length ? 'One product selected. Choose one compatible product above to compare specifications.' : 'Select exactly two different products of the same type. Same-brand and cross-brand comparisons are both welcome.' }));
      return;
    }
    const products = state.compare.map(id => state.byId.get(id));
    const diffInput = node('input', { type: 'checkbox', id: 'differences-only', checked: differencesOnly });
    const highlightInput = node('input', { type: 'checkbox', id: 'highlight-differences', checked: highlightDifferences });
    diffInput.addEventListener('change', renderCompare);
    highlightInput.addEventListener('change', renderCompare);
    target.append(node('div', { class: 'comparison-options' }, [node('label', { for: 'differences-only' }, [diffInput, document.createTextNode(' Show differences only')]), node('label', { for: 'highlight-differences' }, [highlightInput, document.createTextNode(' Highlight differences')])]));
    const names = [...new Set(products.flatMap(product => product.specifications.map(spec => spec.name)))];
    const rows = [['Brand', ...products.map(product => brandName(product.brand))], ['Demo price', ...products.map(product => money(product.price))], ...names.map(name => [name, ...products.map(product => product.specifications.find(spec => spec.name === name)?.value || 'Not provided')]), ['Compatibility', ...products.map(product => product.compatibility)]];
    const body = node('tbody', {}, rows.filter(row => !differencesOnly || row[1] !== row[2]).map(row => node('tr', { class: row[1] !== row[2] && highlightDifferences ? 'is-different' : '' }, [node('th', { scope: 'row', text: row[0] }), node('td', { text: row[1] }), node('td', { text: row[2] })])));
    const table = node('table', { class: 'comparison-table table' }, [node('caption', { text: `${typeLabel(products[0].comparisonType)} comparison · Educational specifications` }), node('thead', {}, [node('tr', {}, [node('th', { scope: 'col', text: 'Specification' }), ...products.map(product => node('th', { scope: 'col', text: product.name }))])]), body]);
    target.append(node('div', { class: 'comparison-scroll', tabindex: '0', role: 'region', 'aria-label': 'Product comparison table; scroll horizontally if needed' }, [table]));
    if (!body.children.length) target.append(node('p', { text: 'No specification differences to show.' }));
  }

  function cartTotals(cart = state.cart, byId = state.byId) {
    return [...cart].reduce((total, [id, quantity]) => total + cents(byId.get(id).price) * quantity, 0);
  }
  function renderCart() {
    const target = $('#cart-app');
    if (!target) return;
    if (!state.cart.size) {
      target.replaceChildren(node('div', { class: 'empty-state' }, [node('h2', { text: 'Your cart is ready for a first pick' }), node('p', { text: 'Explore the catalogue and add the storage products that fit your needs.' }), link('Continue shopping', 'products.html', 'btn btn-primary')]));
      return;
    }
    const items = node('div', { class: 'cart-items' }, [...state.cart].map(([id, quantity]) => {
      const product = state.byId.get(id);
      const input = node('input', { type: 'number', inputmode: 'numeric', min: 1, max: 99, step: 1, value: quantity, 'aria-label': `Quantity for ${product.name}`, 'data-quantity-id': id });
      input.addEventListener('change', () => { if (!setQuantity(id, input.value)) { input.value = state.cart.get(id); input.focus(); } });
      return node('article', { class: 'cart-row' }, [productImage(product), node('div', { class: 'cart-product-info' }, [node('h2', {}, [link(product.name, productPath(product))]), node('p', { text: `${brandName(product.brand)} · ${money(product.price)} each` }), actionButton('Remove', 'cart-remove', id, 'text-action')]), node('div', { class: 'quantity-control' }, [actionButton('−', 'cart-decrease', id, 'quantity-button'), input, actionButton('+', 'cart-increase', id, 'quantity-button')]), node('strong', { class: 'line-total', text: money(cents(product.price) * quantity / 100) })]);
    }));
    const total = cartTotals() / 100;
    const summary = node('aside', { class: 'cart-summary' }, [node('h2', { text: 'Your demo summary' }), node('dl', {}, [node('dt', { text: 'Subtotal' }), node('dd', { text: money(total), 'data-subtotal': '' }), node('dt', { text: 'Total' }), node('dd', { text: money(total), 'data-total': '' })]), node('p', { text: 'No tax or delivery charges are added. These are illustrative prices.' }), actionButton('Demo Checkout', 'cart-checkout', '', 'btn btn-primary'), actionButton('Clear cart', 'cart-clear', '', 'btn btn-outline'), link('Continue shopping →', 'products.html'), node('p', { class: 'demo-note', text: 'This cart is a demonstration. Nothing is submitted, saved or charged.' })]);
    target.replaceChildren(node('div', { class: 'cart-layout' }, [items, summary]));
  }
  function showCheckout() {
    if (!state.cart.size) return;
    const dialog = node('dialog', { class: 'checkout-dialog', 'aria-labelledby': 'checkout-title' }, [node('h2', { id: 'checkout-title', text: 'Demo checkout summary' }), node('p', { text: 'This is a preview only. Nothing is submitted, saved or charged. No order has been placed.' }), node('ul', {}, [...state.cart].map(([id, quantity]) => node('li', { text: `${state.byId.get(id).name} × ${quantity} — ${money(cents(state.byId.get(id).price) * quantity / 100)}` }))), node('p', { class: 'product-price', text: `Demo total: ${money(cartTotals() / 100)}` })]);
    const close = node('button', { type: 'button', class: 'btn btn-primary', text: 'Back to cart' });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.append(close);
    document.body.append(dialog);
    dialog.showModal();
    close.focus();
  }

  function setupLocations() {
    if (!$('#locations-grid')) return;
    const kind = pageName === 'support' ? 'centre' : 'distributor';
    const records = state.locations.filter(record => record.kind === kind);
    const cities = [...new Set(records.map(record => record.city))].sort();
    populateSelect($('#location-city'), cities.map(city => ({ id: city, name: city })), 'All cities', '');
    function render() {
      const city = $('#location-city')?.value || '';
      const query = ($('#location-search')?.value || '').toLowerCase();
      const selected = records.filter(record => (!city || record.city === city) && (!query || `${record.name} ${record.city} ${record.address}`.toLowerCase().includes(query)));
      $('#locations-grid').replaceChildren(...(selected.length ? selected.map(record => node('article', { class: 'location-card' }, [node('span', { class: 'eyebrow', text: `${record.city} · Sample listing` }), node('h3', { text: record.name }), node('address', { text: record.address }), node('p', { text: record.hours }), node('p', { text: record.phone }), node('a', { href: `mailto:${record.email}`, text: record.email })])) : [node('p', { class: 'empty-state', text: 'No sample locations match. Try another city or search.' })]));
      if ($('#location-count')) $('#location-count').textContent = `${selected.length} sample ${kind === 'centre' ? 'support centres' : 'outlets'}`;
    }
    $('#location-city')?.addEventListener('change', render);
    $('#location-search')?.addEventListener('input', render);
    render();
  }

  function mapConfiguration(config) {
    const latitude = String(config.latitude ?? '').trim();
    const longitude = String(config.longitude ?? '').trim();
    if (latitude === '' || longitude === '') return null;
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    const zoom = Number(config.mapZoom);
    return { lat, lon, zoom: Number.isInteger(zoom) && zoom >= 1 && zoom <= 20 ? zoom : 14 };
  }
  function renderMap(config = state.config) {
    const target = $('#map-area');
    if (!target) return;
    const coordinates = mapConfiguration(config);
    if (!coordinates) {
      target.replaceChildren(node('div', { class: 'map-placeholder' }, [node('span', { class: 'map-symbol', text: '⌖', 'aria-hidden': 'true' }), node('h2', { text: 'Location to be configured' }), node('p', { text: 'Our company address and map location will appear here once confirmed.' })]));
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
    target.replaceChildren(node('iframe', { src: embed.href, title: `${config.locationLabel || 'OceanGate'} map location`, loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade', allowfullscreen: '', width: '800', height: '420' }), node('a', { href: directions.href, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-outline', text: 'Open in Google Maps / Get directions' }));
  }
  function setupContact() {
    if ($('#contact-info')) $('#contact-info').replaceChildren(node('h2', { text: 'Talk to OceanGate' }), node('address', { text: state.config.address || 'Company address to be configured' }), node('p', { text: state.config.phone || 'Phone to be configured' }), node('a', { href: `mailto:${state.config.email}`, text: state.config.email }), node('p', { class: 'demo-note', text: 'Contact placeholders are part of this educational project. Replace them before launch.' }));
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
      if (!name || !email || !subject || !message) { announce('Complete each field before opening an email draft.', true); return; }
      const body = `${message}\n\nFrom: ${name}\nReply email: ${email}`;
      // This opens the visitor's mail client; no message is transmitted by the site.
      location.href = `mailto:${state.config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      announce('Email draft requested in your mail app. Review and send it there; nothing was sent by this site.');
    });
  }

  // Preserve state only for same-site page navigation; asset links stay ordinary downloads.
  function setupNavigation() {
    document.addEventListener('click', event => {
      const anchor = event.target.closest('a[href]');
      if (!anchor || anchor.hasAttribute('download') || !state.loaded) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname) || (!url.pathname.endsWith('.html') && !url.pathname.endsWith('/'))) return;
      const next = withState(url);
      anchor.href = next.href;
      setTimeout(() => anchor.setAttribute('href', href), 0);
    }, true);
    const toggle = $('#menu-toggle');
    const menu = $('#site-nav');
    toggle?.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      menu?.classList.toggle('is-open', !expanded);
      menu?.classList.toggle('show', !expanded);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
        toggle.setAttribute('aria-expanded', 'false');
        menu?.classList.remove('is-open', 'show');
        toggle.focus();
      }
    });
    document.addEventListener('error', event => {
      if (event.target.tagName === 'IMG' && !event.target.dataset.fallback) {
        event.target.dataset.fallback = 'true';
        event.target.src = localPath('assets/images/fallback.svg');
        event.target.alt = 'Product illustration unavailable';
      }
    }, true);
  }
  function setupActions() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      if (!state.loaded) { announce('The catalogue is still loading. Please try again shortly.', true); return; }
      const id = button.dataset.id;
      switch (button.dataset.action) {
        case 'cart-add': addToCart(id); break;
        case 'compare-add': addToCompare(id); break;
        case 'compare-remove': state.compare = state.compare.filter(selected => selected !== id); updateStateURL(); renderCompare(); announce('Product removed from comparison.'); break;
        case 'compare-reset': state.compare = []; updateStateURL(); renderCompare(); announce('Comparison cleared.'); break;
        case 'cart-remove': state.cart.delete(id); updateStateURL(); renderCart(); announce('Product removed from cart.'); break;
        case 'cart-clear': state.cart.clear(); updateStateURL(); renderCart(); announce('Cart cleared.'); break;
        case 'cart-increase': setQuantity(id, (state.cart.get(id) || 0) + 1); break;
        case 'cart-decrease': setQuantity(id, (state.cart.get(id) || 0) - 1); break;
        case 'cart-checkout': showCheckout(); break;
      }
    });
  }
  // Enhancement only: pending sections stay visible, including without JavaScript.
  // Each below-fold element animates once when it enters the viewport.
  function setupMotion() {
    if (typeof window.matchMedia !== 'function' || !('IntersectionObserver' in window)) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    const targets = $$('.section-head, .category-card, .benefit, .quote, .support-banner')
      .filter(target => target.getBoundingClientRect().top >= window.innerHeight * .9);
    if (!targets.length) return;
    let remaining = targets.length;
    const stop = () => {
      observer.disconnect();
      preference.removeEventListener?.('change', onPreferenceChange);
    };
    const onPreferenceChange = event => { if (event.matches) stop(); };
    const observer = new window.IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('motion-reveal');
        observer.unobserve(entry.target);
        remaining -= 1;
      });
      if (remaining === 0) stop();
    }, { threshold: .12, rootMargin: '0px 0px -24px 0px' });
    targets.forEach((target, index) => {
      target.style.setProperty('--motion-delay', `${(index % 3) * 45}ms`);
      observer.observe(target);
    });
    preference.addEventListener?.('change', onPreferenceChange);
  }
  async function initialize() {
    setupNavigation();
    setupActions();
    setupMotion();
    const loading = $('#load-state');
    if (loading) { loading.hidden = false; loading.textContent = 'Loading the catalogue…'; }
    try {
      const response = await fetch(localPath('data/oceangate.xml'), { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`The catalogue could not be loaded (HTTP ${response.status}).`);
      Object.assign(state, parseCatalogue(await response.text()));
      state.byId = new Map(state.products.map(product => [product.id, product]));
      const params = new URLSearchParams(location.search);
      const cart = parseCart(params.get('cart'));
      const comparison = parseComparison(params.get('compare'));
      state.cart = cart.cart;
      state.compare = comparison.compare;
      state.loaded = true;
      updateStateURL();
      if (pageName === 'products') setupCatalogue();
      if (pageName === 'detail') renderDetail();
      if (pageName === 'compare') renderCompare();
      if (pageName === 'cart') renderCart();
      if (pageName === 'support' || pageName === 'where-to-buy') setupLocations();
      if (pageName === 'contact') setupContact();
      $$('[data-product-count]').forEach(target => { target.textContent = state.products.length; });
      $$('[data-brand-count]').forEach(target => { target.textContent = state.brands.length; });
      $$('[data-category-count]').forEach(target => { target.textContent = state.categories.length; });
      if (loading) loading.hidden = true;
      if (cart.rejected || comparison.rejected) announce('Some invalid cart or comparison entries were ignored. Please review your selection.', true);
      return true;
    } catch (error) {
      const message = location.protocol === 'file:' ? 'Serve this folder over local HTTP to load the catalogue. See README for start instructions.' : `${error.message || 'The catalogue could not be loaded.'} Please reload or try again later.`;
      if (loading) { loading.hidden = false; loading.textContent = message; loading.setAttribute('role', 'alert'); }
      announce(message, true);
      $$('[data-action]').forEach(button => { button.disabled = true; });
      return false;
    }
  }
  window.OceanGate = {
    ready: null,
    state: () => ({ loaded: state.loaded, products: state.products.map(product => ({ ...product })), cart: [...state.cart], compare: [...state.compare], config: { ...state.config } }),
    tests: { parseCart, parseComparison, parseCatalogue, mapConfiguration, cartTotals, cents },
    addToCart, addToCompare, setQuantity
  };
  window.OceanGate.ready = initialize();
})();
