/* Catalogue controls shared by the products, category and brand pages. */
(() => {
  'use strict';

  const app = window.OceanGate;
  const {
    state,
    $,
    node,
    link,
    localPath,
    typeLabel,
    brandName,
    categoryName,
    productPath,
    money,
    productImage,
    actionButton,
    populateSelect,
    updateStateURL
  } = app.shared;

  let cataloguePage = 1;
  const PAGE_SIZE = 12;

  function productCard(product) {
    const imageLink = link('', productPath(product), 'product-image');
    imageLink.append(productImage(product));
    const content = node('div', { class: 'product-content' }, [
        node('p',
          {
            class: 'product-meta',
            text: `${brandName(product.brand)} / ${typeLabel(product.comparisonType)}`
          }),
        node('h3', {}, [link(product.name, productPath(product))]),
        node('ul',
          {
            class: 'product-features'
          },
          product.features.slice(0,
            2).map(feature => node('li',
              {
                text: feature
              }))),
        node('p',
          {
            class: 'product-price'
          },
          [node('span',
              {
                text: money(product.price)
              }),
            node('small',
              {
                text: 'Demo price'
              })]),
        node('div', { class: 'product-actions' }, [
            link('View details', productPath(product), 'btn btn-outline'),
            actionButton('Add to cart', 'cart-add', product.id, 'btn btn-primary'),
            actionButton('Compare +', 'compare-add', product.id, 'text-action'),
            node('a',
              {
                href: localPath(product.download),
                download: '',
                class: 'text-action',
                text: 'Specifications .docx'
              })
          ])
      ]);
    return node('article', { class: 'product-card', 'data-product': product.id }, [imageLink, content]);
  }

  function setupCatalogue() {
    if (!$('#product-grid')) return;
    $('#catalogue-controls')?.addEventListener('submit',
      event => {
        event.preventDefault();
        cataloguePage = 1;
        renderCatalogue();
      });
    const params = new URLSearchParams(location.search);
    populateSelect($('#category-filter'),
      state.categories,
      'All categories',
      params.has('category') ? params.get('category') : document.body.dataset.category || '');
    populateSelect($('#brand-filter'),
      state.brands,
      'All brands',
      params.has('brand') ? params.get('brand') : document.body.dataset.brand || '');
    populateSelect($('#type-filter'),
      [...new Set(state.products.map(product => product.comparisonType))].sort().map(type => ({
            id: type,
            name: typeLabel(type)
          })),
      'All product types',
      params.get('type'));
    if ($('#search')) $('#search').value = (params.get('q') || '').slice(0, 200);
    if ($('#sort')) $('#sort').value = ['name-asc',
      'price-asc',
      'price-desc'].includes(params.get('sort')) ? params.get('sort') : 'name-asc';
    const requestedPage = Number(params.get('page'));
    cataloguePage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    ['#search', '#category-filter', '#brand-filter', '#type-filter', '#sort'].forEach(selector => {
        $(selector)?.addEventListener(selector === '#search' ? 'input' : 'change',
          () => {
            cataloguePage = 1;
            renderCatalogue();
          });
      });
    $('#clear-filters')?.addEventListener('click', () => {
        ['#search',
          '#category-filter',
          '#brand-filter',
          '#type-filter'].forEach(selector => {
            if ($(selector)) $(selector).value = '';
          });
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
    const filtered = state.products.filter(product => (!category || product.category === category) && (!brand || product.brand === brand) && (!type || product.comparisonType === type) && (!query || [product.name,
          product.model,
          brandName(product.brand),
          categoryName(product.category),
          product.description,
          ...product.features,
          ...product.specifications.map(spec => `${spec.name} ${spec.value}`)].join(' ').toLocaleLowerCase().includes(query)));
    filtered.sort((a,
        b) => sort === 'price-asc' ? a.price - b.price || a.name.localeCompare(b.name) : sort === 'price-desc' ? b.price - a.price || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
    return filtered;
  }

  function renderCatalogue() {
    const grid = $('#product-grid');
    if (!grid) return;
    const filtered = filteredProducts();
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    cataloguePage = Math.min(cataloguePage, pages);
    const current = filtered.slice((cataloguePage - 1) * PAGE_SIZE, cataloguePage * PAGE_SIZE);
    grid.replaceChildren(...(current.length ? current.map(productCard) : [node('div',
            {
              class: 'empty-state'
            },
            [node('h2',
                {
                  text: 'No products match these filters'
                }),
              node('p',
                {
                  text: 'Try a broader search, another product type, or clear the filters.'
                })])]));
    if ($('#results-count')) $('#results-count').textContent = `${filtered.length} products · Showing ${filtered.length ? (cataloguePage - 1) * PAGE_SIZE + 1 : 0}–${Math.min(cataloguePage * PAGE_SIZE, filtered.length)}`;
    const pagination = $('#pagination');
    if (pagination) {
      pagination.replaceChildren();
      if (pages > 1) for (let index = 1; index <= pages; index += 1) {
        const button = node('button',
          {
            type: 'button',
            class: `page-button ${index === cataloguePage ? 'active' : ''}`,
            text: index,
            'aria-label': `Page ${index}`,
            'aria-current': index === cataloguePage ? 'page' : null
          });
        button.addEventListener('click',
          () => {
            cataloguePage = index;
            renderCatalogue();
            grid.scrollIntoView({
                block: 'start',
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
              });
          });
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
    const values = {
      q: $('#search')?.value.trim(),
      category: filterValue('#category-filter',
        document.body.dataset.category),
      brand: filterValue('#brand-filter',
        document.body.dataset.brand),
      type: $('#type-filter')?.value,
      sort: $('#sort')?.value === 'name-asc' ? '' : $('#sort')?.value,
      page: cataloguePage === 1 ? '' : cataloguePage
    };
    Object.entries(values).forEach(([key,
          value]) => value ? next.searchParams.set(key,
        value) : next.searchParams.delete(key));
    history.replaceState(null, '', next);
    updateStateURL();
  }

  app.pages.catalogue = setupCatalogue;

  // Read category/brand presets from the HTML and start this shared catalogue.
  app.start(setupCatalogue);
})();
