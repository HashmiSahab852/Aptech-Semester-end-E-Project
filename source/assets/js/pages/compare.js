/* Comparison page: compatible selections and specification differences. */
(() => {
  'use strict';

  const app = window.OceanGate;
  const {
    state,
    $,
    node,
    link,
    typeLabel,
    brandName,
    productPath,
    money,
    announce,
    productImage,
    actionButton,
    updateStateURL,
    onChange
  } = app.shared;

  function comparisonSlot(index) {
    const id = state.compare[index];
    const product = state.byId.get(id);
    const reference = state.byId.get(state.compare[index === 0 ? 1 : 0]);
    const options = state.products.filter(item => !reference || (item.id !== reference.id && item.comparisonType === reference.comparisonType));
    const select = node('select',
      {
        id: `compare-slot-${index}`,
        class: 'form-select',
        'aria-label': `Select product ${index + 1}`
      },
      [node('option',
          {
            value: '',
            text: index === 1 && !state.compare[0] ? 'Select product one first' : 'Choose or replace a product'
          }),
        ...options.map(item => node('option',
            {
              value: item.id,
              text: `${brandName(item.brand)} — ${item.name}`
            }))]);
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
    const slot = node('section',
      {
        class: 'compare-slot'
      },
      [node('label',
          {
            for: `compare-slot-${index}`,
            text: `Product ${index + 1}`
          }),
        select]);
    if (product) slot.append(productImage(product),
      node('h2',
        {
          text: product.name
        }),
      node('p',
        {
          text: `${brandName(product.brand)} · ${money(product.price)} demo price`
        }),
      link('View details',
        productPath(product)),
      actionButton('Remove',
        'compare-remove',
        id,
        'text-action'));
    else slot.append(node('div',
        {
          class: 'slot-empty',
          text: index === 0 ? 'Start with a product you want to explore.' : 'Then choose a different product of the same type.'
        }));
    return slot;
  }

  function renderCompare() {
    const target = $('#compare-app');
    if (!target) return;
    const differencesOnly = $('#differences-only')?.checked || false;
    const highlightDifferences = $('#highlight-differences')?.checked ?? true;
    target.replaceChildren(node('div', { class: 'compare-slots' }, [comparisonSlot(0), comparisonSlot(1)]));
    if (state.compare.length) target.append(actionButton('Reset comparison',
        'compare-reset',
        '',
        'btn btn-outline'));
    if (state.compare.length < 2) {
      target.append(node('p',
          {
            class: 'empty-state',
            text: state.compare.length ? 'One product selected. Choose one compatible product above to compare specifications.' : 'Select exactly two different products of the same type. Same-brand and cross-brand comparisons are both welcome.'
          }));
      return;
    }
    const products = state.compare.map(id => state.byId.get(id));
    const diffInput = node('input', { type: 'checkbox', id: 'differences-only', checked: differencesOnly });
    const highlightInput = node('input',
      {
        type: 'checkbox',
        id: 'highlight-differences',
        checked: highlightDifferences
      });
    diffInput.addEventListener('change', renderCompare);
    highlightInput.addEventListener('change', renderCompare);
    target.append(node('div',
        {
          class: 'comparison-options'
        },
        [node('label',
            {
              for: 'differences-only'
            },
            [diffInput,
              document.createTextNode(' Show differences only')]),
          node('label',
            {
              for: 'highlight-differences'
            },
            [highlightInput,
              document.createTextNode(' Highlight differences')])]));
    const names = [...new Set(products.flatMap(product => product.specifications.map(spec => spec.name)))];
    const rows = [['Brand',
        ...products.map(product => brandName(product.brand))],
      ['Demo price',
        ...products.map(product => money(product.price))],
      ...names.map(name => [name,
          ...products.map(product => product.specifications.find(spec => spec.name === name)?.value || 'Not provided')]),
      ['Compatibility',
        ...products.map(product => product.compatibility)]];
    const body = node('tbody',
      {},
      rows.filter(row => !differencesOnly || row[1] !== row[2]).map(row => node('tr',
          {
            class: row[1] !== row[2] && highlightDifferences ? 'is-different' : ''
          },
          [node('th',
              {
                scope: 'row',
                text: row[0]
              }),
            node('td',
              {
                text: row[1]
              }),
            node('td',
              {
                text: row[2]
              })])));
    const table = node('table',
      {
        class: 'comparison-table table'
      },
      [node('caption',
          {
            text: `${typeLabel(products[0].comparisonType)} comparison · Educational specifications`
          }),
        node('thead',
          {},
          [node('tr',
              {},
              [node('th',
                  {
                    scope: 'col',
                    text: 'Specification'
                  }),
                ...products.map(product => node('th',
                    {
                      scope: 'col',
                      text: product.name
                    }))])]),
        body]);
    target.append(node('div',
        {
          class: 'comparison-scroll',
          tabindex: '0',
          role: 'region',
          'aria-label': 'Product comparison table; scroll horizontally if needed'
        },
        [table]));
    if (!body.children.length) target.append(node('p', { text: 'No specification differences to show.' }));
  }

  function initializeComparison() {
    onChange('compare', renderCompare);
    renderCompare();
  }

  app.start(initializeComparison);
})();
