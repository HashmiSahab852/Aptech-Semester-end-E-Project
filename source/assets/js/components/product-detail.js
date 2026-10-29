/* Product information shared by the unique product pages and lookup page. */
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
    actionButton
  } = app.shared;

  function specificationTable(product) {
    return node('table',
      {
        class: 'spec-table table'
      },
      [node('caption',
          {
            class: 'visually-hidden',
            text: `${product.name} specifications`
          }),
        node('tbody',
          {},
          product.specifications.map(spec => node('tr',
              {},
              [node('th',
                  {
                    scope: 'row',
                    text: spec.name
                  }),
                node('td',
                  {
                    text: spec.value || 'Not provided'
                  })])))]);
  }

  function renderDetail() {
    const target = $('#product-detail');
    if (!target) return;
    const id = document.body.dataset.productId || new URLSearchParams(location.search).get('id');
    const product = state.byId.get(id);
    if (!product) {
      target.replaceChildren(node('div',
          {
            class: 'empty-state'
          },
          [node('h1',
              {
                text: id ? 'Product not found' : 'Choose a product to view'
              }),
            node('p',
              {
                text: 'This product link is missing or no longer matches the catalogue.'
              }),
            link('Browse all products',
              'products.html',
              'btn btn-primary')]));
      return;
    }
    const image = productImage(product);
    image.loading = 'eager';
    const info = node('div', { class: 'detail-info' }, [
        node('div', { class: 'eyebrow detail-brand' }, [
          node('img', { class: `manufacturer-logo brand-${product.brand}`, src: localPath(`assets/brand/brand-${product.brand}.svg`), alt: brandName(product.brand), width: 110, height: 36, loading: 'lazy' }),
          node('span', { text: typeLabel(product.comparisonType) })
        ]),
        node('h1', { text: product.name }), node('p', { class: 'lead', text: product.description }),
        node('p', { class: 'model', text: `SKU: ${product.model}` }),
        node('p', { class: 'product-price', text: `${money(product.price)}` }),
        node('ul',
          {
            class: 'detail-features'
          },
          product.features.map(feature => node('li',
              {
                text: feature
              }))),
        node('div',
          {
            class: 'detail-actions'
          },
          [actionButton('Add to cart',
              'cart-add',
              product.id,
              'btn btn-primary'),
            actionButton('Add to compare',
              'compare-add',
              product.id),
            node('a',
              {
                href: localPath(product.download),
                download: '',
                class: 'btn btn-outline',
                text: 'Download specifications .docx'
              })]),
        node('p',
          {
            class: 'context-links'
          },
          [link(`Explore ${categoryName(product.category)}`,
              `categories/category-${product.category}.html`),
            document.createTextNode(' · '),
            link(`More from ${brandName(product.brand)}`,
              `brands/brand-${product.brand}.html`)])
      ]);
    const lower = node('div', { class: 'detail-sections row g-4' }, [
        node('section',
          {
            class: 'col-lg-7'
          },
          [node('h2',
              {
                text: 'Specifications'
              }),
            specificationTable(product)]),
        node('section',
          {
            class: 'col-lg-5'
          },
          [node('h2',
              {
                text: 'Compatibility & care'
              }),
            node('p',
              {
                text: product.compatibility
              }),
            node('h3',
              {
                text: 'Made for these uses'
              }),
            node('ul',
              {},
              product.useCases.map(useCase => node('li',
                  {
                    text: useCase
                  }))),
            link('Get product support →', 'support.html')])
      ]);
    target.replaceChildren(node('div',
        {
          class: 'detail-grid'
        },
        [node('div',
            {
              class: 'detail-image'
            },
            [image,
              node('p',
                {
                  class: 'image-caption',
                  text: product.name
                })]),
          info]),
      lower);
  }

  app.pages.detail = renderDetail;

  // Every product page supplies its ID through data-product-id or the URL.
  // This shared file starts the detail page directly; no per-product wrapper is needed.
  app.start(renderDetail);
})();
