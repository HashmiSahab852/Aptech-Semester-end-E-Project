/* OceanGate catalogue enhancement. XML is the only catalogue/configuration source.
* Cart and comparison state live only in memory and validated URL parameters. The one exception is
* the demo login session, kept in localStorage (see "Demo login session" below). */
(() => {
  'use strict';

  const root = new URL(document.body.dataset.root || './', location.href);
  const pageName = document.body.dataset.page || '';
  const $ = (selector, within = document) => within.querySelector(selector);
  const $$ = (selector, within = document) => [...within.querySelectorAll(selector)];
  const state = {
    products: [],
    byId: new Map(),
    brands: [],
    categories: [],
    config: {},
    cart: new Map(),
    compare: [],
    locations: [],
    loaded: false
  };
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
  const fields = xml => Object.fromEntries([...xml.children].map(child => [child.tagName,
        child.textContent.trim()]));
  const link = (label,
    path,
    className = '') => node('a',
    {
      href: localPath(path),
      class: className,
      text: label
    });
  const localPath = path => new URL(path, root).href;
  const typeLabel = value => value.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  const brandName = id => state.brands.find(brand => brand.id === id)?.name || id;
  const categoryName = id => state.categories.find(category => category.id === id)?.name || id;
  const productPath = product => `products/${product.slug}.html`;
  const cents = value => Math.round(Number(value) * 100);
  const money = value => new Intl.NumberFormat('en-PK',
    {
      style: 'currency',
      currency: state.config.currency || 'PKR',
      maximumFractionDigits: 2
    }).format(value);
  function announce(message, error = false) {
    const drawerMessage = $('#cart-drawer[open] .cart-drawer-message');
    if (drawerMessage) {
      drawerMessage.textContent = message;
      drawerMessage.classList.toggle('is-error', error);
      return;
    }
    let target = $('#site-status');
    if (!target) {
      target = node('div',
        {
          id: 'site-status',
          role: 'status',
          'aria-live': 'polite',
          class: 'site-status'
        });
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
    const brands = [...xml.querySelectorAll('brands > brand')].map(item => ({
          id: item.getAttribute('id'),
          ...fields(item)
        }));
    const categories = [...xml.querySelectorAll('categories > category')].map(item => ({
          id: item.getAttribute('id'),
          ...fields(item)
        }));
    const ids = new Set();
    const products = [...xml.querySelectorAll('products > product')].map(item => {
        const product = {
          id: item.getAttribute('id'),
          brand: item.getAttribute('brand'),
          category: item.getAttribute('category'),
          comparisonType: item.getAttribute('comparisonType'),
          slug: item.getAttribute('slug'),
          featured: item.getAttribute('featured') === 'true',
          name: text(item,
            'name'),
          model: text(item,
            'model'),
          description: text(item,
            'description'),
          price: Number(text(item,
              'price')),
          image: safeAsset(text(item, 'image'), 'assets/images/'), imageAlt: text(item, 'imageAlt'),
          download: safeAsset(text(item, 'download'), 'downloads/specifications/'),
          features: [...item.querySelectorAll('features > feature')].map(feature => feature.textContent.trim()),
          specifications: [...item.querySelectorAll('specifications > spec')].map(spec => ({
                name: spec.getAttribute('name'),
                value: spec.textContent.trim()
              })),
          compatibility: text(item,
            'compatibility'),
          useCases: [...item.querySelectorAll('useCases > useCase')].map(useCase => useCase.textContent.trim()),
          reviews: [...item.querySelectorAll('reviews > review')].map(review => ({
                author: review.getAttribute('author'),
                text: review.textContent.trim()
              }))
        };
        if (!/^[a-zA-Z0-9_-]+$/.test(product.id || '') || ids.has(product.id) || !/^[a-z0-9-]+$/.test(product.slug || '') || !product.name || !Number.isFinite(product.price) || product.price <= 0 || !brands.some(brand => brand.id === product.brand) || !categories.some(category => category.id === product.category)) throw new Error('The catalogue contains an incomplete or duplicate product.');
        ids.add(product.id);
        return product;
      });
    if (products.length === 0) throw new Error('No products are available in the catalogue.');
    const locations = [...xml.querySelectorAll('supportCentres > centre, distributors > distributor')].map(item => ({
          id: item.getAttribute('id'),
          kind: item.tagName,
          ...fields(item)
        }));
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
      if (!product || compare.includes(id) || compare.length === 2 || (compare.length && byId.get(compare[0]).comparisonType !== product.comparisonType)) {
        rejected = true;
        continue;
      }
      compare.push(id);
    }
    return { compare, rejected };
  }
  const serializeCart = () => [...state.cart].map(([id, quantity]) => `${id}:${quantity}`).join(',');
  function withState(url) {
    const next = new URL(url, location.href);
    const cart = serializeCart();
    cart ? next.searchParams.set('cart', cart) : next.searchParams.delete('cart');
    state.compare.length ? next.searchParams.set('compare',
      state.compare.join(',')) : next.searchParams.delete('compare');
    return next;
  }
  function updateStateURL() {
    const next = withState(location.href);
    history.replaceState(null, '', next);
    $$('[data-cart-count]').forEach(badge => {
        badge.textContent = [...state.cart.values()].reduce((sum,
            quantity) => sum + quantity,
          0);
      });
    $$('[data-compare-count]').forEach(badge => { badge.textContent = state.compare.length; });
    // Search, filtering, and personal state variants are deliberately non-indexable.
    if ([...next.searchParams.keys()].some(key => ['cart',
          'compare',
          'q',
          'sort',
          'brand',
          'category',
          'type',
          'page',
          'id'].includes(key))) {
      let robots = $('meta[name="robots"]');
      if (!robots) { robots = node('meta', { name: 'robots' }); document.head.append(robots); }
      robots.content = 'noindex,follow';
    }
    updateCompareTray();
    if (cartDrawer?.open) renderCartDrawer();
  }

  function productImage(product, className = '') {
    return node('img',
      {
        src: localPath(product.image),
        alt: product.imageAlt,
        width: 640,
        height: 480,
        loading: 'lazy',
        decoding: 'async',
        class: className
      });
  }
  function actionButton(label, action, id, className = 'btn btn-secondary') {
    return node('button',
      {
        type: 'button',
        class: className,
        text: label,
        'data-action': action,
        'data-id': id
      });
  }

  // Page files subscribe only to the state they display.
  const pageUpdates = new Map();
  const pageActions = new Map();
  let started = false;

  function onChange(kind, render) {
    pageUpdates.set(kind, render);
  }

  function refresh(kind) {
    pageUpdates.get(kind)?.();
  }

  function onAction(name, handler) {
    pageActions.set(name, handler);
  }

  // A shared side cart for every Add to cart button, including catalogue cards.
  let cartDrawer;
  let cartDrawerTrigger;
  let recentlyAddedId;

  function ensureCartDrawer() {
    if (cartDrawer) return cartDrawer;
    const close = node('button', {
      type: 'button', class: 'cart-drawer-close', text: '×', 'aria-label': 'Close cart'
    });
    close.addEventListener('click', () => cartDrawer.close());
    const continueShopping = node('button', {
      type: 'button', class: 'btn btn-outline cart-drawer-continue', text: 'Continue shopping'
    });
    continueShopping.addEventListener('click', () => cartDrawer.close());
    cartDrawer = node('dialog', {
      id: 'cart-drawer', class: 'cart-drawer', 'aria-labelledby': 'cart-drawer-title'
    }, [
      node('header', { class: 'cart-drawer-header' }, [
        node('div', {}, [
          node('span', { class: 'eyebrow', text: 'Your selection' }),
          node('h2', { id: 'cart-drawer-title', text: 'Your Cart' })
        ]), close
      ]),
      node('p', { class: 'cart-drawer-message', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }),
      node('div', { class: 'cart-drawer-items', 'aria-label': 'Cart items' }),
      node('footer', { class: 'cart-drawer-footer' }, [
        node('div', { class: 'cart-drawer-subtotal' }, [
          node('span', { text: 'Subtotal' }), node('strong', { 'data-drawer-subtotal': '' })
        ]),
        node('p', { class: 'cart-drawer-note', text: 'Review your selection and quantities in your cart.' }),
        link('View Cart →', 'cart.html', 'btn btn-primary cart-drawer-view'),
        continueShopping
      ])
    ]);
    cartDrawer.addEventListener('close', () => {
      document.body.classList.remove('cart-drawer-open');
      if (cartDrawerTrigger?.isConnected) cartDrawerTrigger.focus({ preventScroll: true });
    });
    cartDrawer.addEventListener('click', event => {
      if (event.target === cartDrawer) {
        const bounds = cartDrawer.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) cartDrawer.close();
      }
      const button = event.target.closest('[data-drawer-action]');
      if (!button || button.disabled) return;
      const { id, drawerAction } = button.dataset;
      if (!state.cart.has(id)) return;
      if (drawerAction === 'remove') {
        const name = state.byId.get(id).name;
        state.cart.delete(id);
        updateStateURL();
        refresh('cart');
        announce(`${name} removed from cart.`);
      } else {
        const change = drawerAction === 'increase' ? 1 : -1;
        setQuantity(id, state.cart.get(id) + change);
      }
    });
    document.body.append(cartDrawer);
    return cartDrawer;
  }

  function renderCartDrawer() {
    if (!cartDrawer) return;
    const focused = document.activeElement;
    const focusKey = cartDrawer.contains(focused) && focused.dataset.drawerAction
      ? { id: focused.dataset.id, action: focused.dataset.drawerAction } : null;
    const items = $('.cart-drawer-items', cartDrawer);
    const totalQuantity = [...state.cart.values()].reduce((total, quantity) => total + quantity, 0);
    $('#cart-drawer-title', cartDrawer).textContent = `Your Cart (${totalQuantity})`;
    const controls = (label, action, id, disabled) => node('button', {
      type: 'button', text: label, class: action === 'remove' ? 'cart-drawer-remove' : 'cart-drawer-quantity-button',
      'data-drawer-action': action, 'data-id': id, disabled,
      'aria-label': `${action === 'increase' ? 'Increase quantity of' : action === 'decrease' ? 'Decrease quantity of' : 'Remove'} ${state.byId.get(id).name}`
    });
    const rows = [...state.cart].reverse().map(([id, quantity]) => {
      const product = state.byId.get(id);
      const pictureLink = link('', productPath(product), 'cart-drawer-image');
      const picture = productImage(product);
      picture.loading = 'eager';
      pictureLink.append(picture);
      return node('article', { class: `cart-drawer-item${id === recentlyAddedId ? ' is-added' : ''}`, 'data-cart-item': id }, [
        pictureLink,
        node('div', { class: 'cart-drawer-item-info' }, [
          node('span', { class: 'cart-drawer-brand', text: brandName(product.brand) }),
          node('h3', {}, [link(product.name, productPath(product))]),
          node('p', { class: 'cart-drawer-unit-price', text: `${money(product.price)} each` }),
          node('div', { class: 'cart-drawer-item-bottom' }, [
            node('div', { class: 'cart-drawer-quantity', role: 'group', 'aria-label': `Quantity for ${product.name}` }, [
              controls('−', 'decrease', id, quantity <= 1),
              node('span', { text: quantity, 'data-drawer-quantity': id }),
              controls('+', 'increase', id, quantity >= 99)
            ]),
            node('strong', { class: 'cart-drawer-line-total', text: money(cents(product.price) * quantity / 100) })
          ]),
          controls('Remove', 'remove', id, false)
        ])
      ]);
    });
    if (!rows.length) {
      rows.push(node('div', { class: 'cart-drawer-empty' }, [
        node('h3', { text: 'Your cart is empty' }),
        node('p', { text: 'Find the right format for your next project.' }),
        link('Browse products →', 'products.html', 'btn btn-primary')
      ]));
    }
    items.replaceChildren(...rows);
    $('[data-drawer-subtotal]', cartDrawer).textContent = money(cartTotals() / 100);
    $('.cart-drawer-view', cartDrawer).href = withState(localPath('cart.html')).href;
    $('.cart-drawer-footer', cartDrawer).hidden = !state.cart.size;
    if (focusKey && cartDrawer.open) {
      const replacement = $$('[data-drawer-action]', cartDrawer).find(button => button.dataset.id === focusKey.id && button.dataset.drawerAction === focusKey.action && !button.disabled);
      (replacement || $('.cart-drawer-close', cartDrawer)).focus({ preventScroll: true });
    }
  }

  function openCartDrawer(id) {
    const drawer = ensureCartDrawer();
    recentlyAddedId = id;
    if (!drawer.open) cartDrawerTrigger = document.activeElement;
    renderCartDrawer();
    const message = $('.cart-drawer-message', drawer);
    message.classList.remove('is-error');
    message.textContent = '✓ Added to cart';
    $('#site-status')?.classList.remove('is-visible');
    if (!drawer.open) {
      drawer.showModal();
      document.body.classList.add('cart-drawer-open');
      $('.cart-drawer-close', drawer).focus({ preventScroll: true });
    }
    const addedItem = $$('[data-cart-item]', drawer).find(item => item.dataset.cartItem === id);
    if (addedItem) $('.cart-drawer-items', drawer).scrollTop = addedItem.offsetTop - $('.cart-drawer-items', drawer).offsetTop;
  }

  function addToCart(id) {
    const product = state.byId.get(id);
    if (!product) {
      announce('This product is unavailable. Please reload the catalogue.',
        true);
      return false;
    }
    const quantity = state.cart.get(id) || 0;
    if (quantity >= 99) { announce('The maximum quantity is 99 per product.', true); return false; }
    state.cart.set(id, quantity + 1);
    updateStateURL();
    refresh('cart');
    openCartDrawer(id);
    return true;
  }

  function setQuantity(id, value) {
    if (!state.cart.has(id)) return false;
    if (!/^[1-9]\d?$/.test(String(value))) {
      announce('Enter a whole-number quantity from 1 to 99.',
        true);
      return false;
    }
    state.cart.set(id, Number(value));
    updateStateURL();
    refresh('cart');
    announce('Cart quantity updated.');
    return true;
  }

  function addToCompare(id) {
    const product = state.byId.get(id);
    if (!product) { announce('Select a product from this catalogue.', true); return false; }
    if (state.compare.includes(id)) {
      announce('That product is already selected. Choose a different product.',
        true);
      return false;
    }
    if (state.compare.length >= 2) {
      announce('Compare exactly two products. Remove or replace one first.',
        true);
      return false;
    }
    if (state.compare.length && state.byId.get(state.compare[0]).comparisonType !== product.comparisonType) {
      announce(`Choose another ${typeLabel(state.byId.get(state.compare[0]).comparisonType)} product for a compatible comparison.`,
        true);
      return false;
    }
    state.compare.push(id);
    updateStateURL();
    refresh('compare');
    announce(`${product.name} selected for comparison. ${state.compare.length} of 2 selected.`);
    return true;
  }

  function updateCompareTray() {
    let tray = $('#compare-tray');
    if (!tray) {
      tray = node('aside',
        {
          id: 'compare-tray',
          class: 'compare-tray',
          'aria-label': 'Selected comparison products'
        });
      document.body.append(tray);
    }
    tray.hidden = state.compare.length === 0 || pageName === 'compare';
    if (tray.hidden) return;
    tray.replaceChildren(node('span',
        {
          text: `${state.compare.length}/2 selected`
        }),
      ...state.compare.map(id => actionButton(`Remove ${state.byId.get(id).name}`,
          'compare-remove',
          id,
          'compare-chip')),
      link('Compare products →',
        'compare.html',
        'btn btn-primary'));
  }

  function populateSelect(select, records, placeholder, selected) {
    if (!select) return;
    select.replaceChildren(node('option',
        {
          value: '',
          text: placeholder
        }),
      ...records.map(record => node('option',
          {
            value: record.id,
            text: record.name
          })));
    select.value = selected || '';
  }

  function cartTotals(cart = state.cart, byId = state.byId) {
    return [...cart].reduce((total, [id, quantity]) => total + cents(byId.get(id).price) * quantity, 0);
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

  // These actions are available on any page with product cards or the tray.
  function setupActions() {
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        if (!state.loaded) {
          announce('The catalogue is still loading. Please try again shortly.', true);
          return;
        }
        const id = button.dataset.id;
        const action = button.dataset.action;
        switch (action) {
          case 'cart-add':
          addToCart(id);
          break;
          case 'compare-add':
          addToCompare(id);
          break;
          case 'compare-remove':
          state.compare = state.compare.filter(selected => selected !== id);
          updateStateURL();
          refresh('compare');
          announce('Product removed from comparison.');
          break;
          case 'compare-reset':
          state.compare = [];
          updateStateURL();
          refresh('compare');
          announce('Comparison cleared.');
          break;
          default:
          pageActions.get(action)?.(id);
        }
      });
  }

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

  // ---- Demo login session --------------------------------------------------------------------
  // A front-end demonstration only. The session lives in localStorage so it survives page
  // navigation; no password is stored and nothing is ever sent to a server.
  const SESSION_KEY = 'oceangate.session';
  const LOGIN_PAGE = 'login.html';

  // Visitors can block or edit localStorage, so anything unexpected simply means "logged out".
  function readSession() {
    try {
      const data = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!data || typeof data.name !== 'string' || typeof data.email !== 'string' || !data.name.trim()) return null;
      return { name: data.name.trim().slice(0, 60), email: data.email.trim().slice(0, 150) };
    } catch (error) {
      return null;
    }
  }

  // Only pages inside this site are accepted, so a crafted ?next= can never lead visitors elsewhere.
  function resolveNext(value) {
    if (typeof value !== 'string' || !value || value.length > 2000) return null;
    let url;
    try {
      url = new URL(value, root);
    } catch (error) {
      return null;
    }
    const inSite = url.origin === root.origin && url.pathname.startsWith(root.pathname);
    const isPage = url.pathname.endsWith('.html') || url.pathname.endsWith('/');
    if (!inSite || !isPage || url.pathname.endsWith(`/${LOGIN_PAGE}`)) return null;
    return url;
  }

  // The current page as a site-relative address, so the visitor can be returned to it after login.
  function currentTarget() {
    if (pageName === 'login') return new URLSearchParams(location.search).get('next') || 'index.html';
    const path = location.pathname.startsWith(root.pathname) ? location.pathname.slice(root.pathname.length) : '';
    return (path || 'index.html') + location.search + location.hash;
  }

  // Login page address. It also carries the bag and comparison, so their counts survive the visit.
  function loginURL(next = currentTarget()) {
    const url = new URL(localPath(LOGIN_PAGE));
    const here = new URLSearchParams(location.search);
    ['cart', 'compare'].forEach(key => { if (here.has(key)) url.searchParams.set(key, here.get(key)); });
    url.searchParams.set('next', next);
    return url.href;
  }

  function notifyAuthChange() {
    renderAuthNav();
    window.dispatchEvent(new CustomEvent('oceangate:authchange'));
  }

  const auth = {
    user: readSession,
    isLoggedIn: () => readSession() !== null,
    // Returns false when the browser refuses to keep the session, so callers never loop.
    login(user) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name, email: user.email, signedInAt: Date.now() }));
      } catch (error) {
        return false;
      }
      if (!readSession()) return false;
      notifyAuthChange();
      return true;
    },
    logout() {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch (error) {
        // Nothing could have been stored, so there is nothing to remove.
      }
      notifyAuthChange();
    },
    loginURL,
    resolveNext
  };

  function loginLink(className) {
    const link = node('a',
      {
        href: localPath(LOGIN_PAGE),
        class: className,
        text: 'Login'
      });
    if (pageName === 'login') link.setAttribute('aria-current', 'page');
    // Refreshed just before use so the visitor comes back to wherever they are, bag intact.
    const refresh = () => { link.href = loginURL(); };
    ['pointerdown', 'focus', 'click'].forEach(type => link.addEventListener(type, refresh));
    return link;
  }

  function logOut() {
    auth.logout();
    announce('You have been logged out.');
    // Hand focus to whichever Login link is visible at this screen size.
    [...document.querySelectorAll('.auth-login, .auth-menu-link')].find(link => link.offsetParent)?.focus();
  }

  function setAuthMenu(open) {
    const button = $('.auth-account');
    const menu = $('#auth-menu');
    if (!button || !menu) return;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  // Wide screens: an account button beside Bag that opens a small panel with the name and Log out.
  function accountControls(user) {
    const button = node('button',
      {
        type: 'button',
        class: 'auth-link auth-account',
        'aria-expanded': 'false',
        'aria-controls': 'auth-menu',
        'aria-label': `Account menu for ${user.name}`
      },
      [node('span',
          {
            class: 'auth-avatar',
            'aria-hidden': 'true',
            text: Array.from(user.name)[0].toUpperCase()
          }),
        node('span',
          {
            class: 'auth-name',
            text: user.name.split(/\s+/)[0]
          }),
        node('span',
          {
            class: 'auth-caret',
            'aria-hidden': 'true',
            text: '▾'
          })]);
    const logout = node('button', { type: 'button', class: 'btn btn-outline auth-logout', text: 'Log out' });
    const menu = node('div',
      {
        id: 'auth-menu',
        class: 'auth-menu',
        tabindex: '-1',
        hidden: true
      },
      [node('p', { class: 'auth-menu-label', text: 'Logged in as' }),
        node('p', { class: 'auth-menu-name', text: user.name }),
        node('p', { class: 'auth-menu-email', text: user.email }),
        logout]);
    button.addEventListener('click', () => setAuthMenu(menu.hidden));
    logout.addEventListener('click', logOut);
    return [button, menu];
  }

  // Narrow screens: the same state as the last items of the collapsible menu, so the header is unchanged.
  function menuControls(user) {
    if (!user) return [loginLink('auth-menu-link')];
    const logout = node('button', { type: 'button', class: 'auth-menu-logout', text: 'Log out' });
    logout.addEventListener('click', logOut);
    return [node('span', { class: 'auth-menu-who' }, ['Logged in as ', node('strong', { text: user.name })]), logout];
  }

  function renderAuthNav() {
    const tools = $('.nav-tools');
    if (!tools) return;
    const user = readSession();
    let holder = $('.auth-nav', tools);
    if (!holder) {
      holder = node('div', { class: 'auth-nav' });
      holder.addEventListener('focusout', event => {
          if (!holder.contains(event.relatedTarget)) setAuthMenu(false);
        });
      tools.insertBefore(holder, $('#menu-toggle', tools));
    }
    holder.replaceChildren(...(user ? accountControls(user) : [loginLink('auth-link auth-login')]));
    const menu = $('#site-nav');
    if (!menu) return;
    let items = $('.auth-nav-menu', menu);
    if (!items) {
      items = node('div', { class: 'auth-nav-menu' });
      menu.append(items);
    }
    items.replaceChildren(...menuControls(user));
  }

  function setupAuthNav() {
    renderAuthNav();
    document.addEventListener('click', event => {
        if (!event.target.closest('.auth-nav')) setAuthMenu(false);
      });
    document.addEventListener('keydown', event => {
        const menu = $('#auth-menu');
        if (event.key !== 'Escape' || !menu || menu.hidden) return;
        setAuthMenu(false);
        $('.auth-account')?.focus();
      });
    // Keeps other open tabs in step when the visitor logs in or out elsewhere.
    window.addEventListener('storage', event => {
        if (event.key === null || event.key === SESSION_KEY) notifyAuthChange();
      });
  }

  async function initialize(initializePage) {
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
      if (typeof initializePage === 'function') initializePage();
      $$('[data-product-count]').forEach(target => { target.textContent = state.products.length; });
      $$('[data-brand-count]').forEach(target => { target.textContent = state.brands.length; });
      $$('[data-category-count]').forEach(target => { target.textContent = state.categories.length; });
      if (loading) loading.hidden = true;
      if (cart.rejected || comparison.rejected) announce('Some invalid cart or comparison entries were ignored. Please review your selection.',
        true);
      return true;
    } catch (error) {
      const message = location.protocol === 'file:' ? 'Open this website through a local web server to load the catalogue.' : `${error.message || 'The catalogue could not be loaded.'} Please reload or try again later.`;
      if (loading) {
        loading.hidden = false;
        loading.textContent = message;
        loading.setAttribute('role',
          'alert');
      }
      announce(message, true);
      $$('[data-action]').forEach(button => { button.disabled = true; });
      return false;
    }
  }

  // The page's own entry file starts shared behavior once its modules are loaded.
  function start(initializePage) {
    if (!started) {
      started = true;
      window.OceanGate.ready = initialize(initializePage);
    }
    return window.OceanGate.ready;
  }

  window.OceanGate = {
    ready: null,
    start,
    pages: {},
    state: () => ({
        loaded: state.loaded,
        products: state.products.map(product => ({ ...product })),
        cart: [...state.cart],
        compare: [...state.compare],
        config: { ...state.config }
      }),
    tests: { parseCart, parseComparison, parseCatalogue, mapConfiguration, cartTotals, cents },
    addToCart,
    addToCompare,
    setQuantity,
    auth,
    shared: {
      state, root, pageName, $, $$, node, link, localPath, typeLabel,
      brandName, categoryName, productPath, cents, money, announce,
      productImage, actionButton, populateSelect, updateStateURL,
      cartTotals, mapConfiguration, setQuantity, onChange, onAction, auth
    }
  };

  // Scripts are deferred, so the navigation already exists; the check covers any other loading style.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupAuthNav);
  else setupAuthNav();
})();
