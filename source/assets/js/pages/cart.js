/* Cart page: line items, quantity controls, totals and order review. */
(() => {
  'use strict';

  const app = window.OceanGate;
  const {
    state,
    $,
    node,
    link,
    localPath,
    brandName,
    productPath,
    cents,
    money,
    announce,
    productImage,
    actionButton,
    cartTotals,
    setQuantity,
    updateStateURL,
    onChange,
    onAction
  } = app.shared;

  function renderCart() {
    const target = $('#cart-app');
    if (!target) return;
    if (!state.cart.size) {
      target.replaceChildren(node('div',
          {
            class: 'empty-state'
          },
          [node('h2',
              {
                text: 'Your cart is ready for a first pick'
              }),
            node('p',
              {
                text: 'Explore the catalogue and add the storage products that fit your needs.'
              }),
            link('Continue shopping',
              'products.html',
              'btn btn-primary')]));
      return;
    }
    const items = node('div', { class: 'cart-items' }, [...state.cart].map(([id, quantity]) => {
          const product = state.byId.get(id);
          const input = node('input',
            {
              type: 'number',
              inputmode: 'numeric',
              min: 1,
              max: 99,
              step: 1,
              value: quantity,
              'aria-label': `Quantity for ${product.name}`,
              'data-quantity-id': id
            });
          input.addEventListener('change',
            () => {
              if (!setQuantity(id,
                  input.value)) {
                input.value = state.cart.get(id);
                input.focus();
              }
            });
          return node('article',
            {
              class: 'cart-row'
            },
            [productImage(product),
              node('div',
                {
                  class: 'cart-product-info'
                },
                [node('h2',
                    {},
                    [link(product.name,
                        productPath(product))]),
                  node('p',
                    {
                      text: `${brandName(product.brand)} · ${money(product.price)} each`
                    }),
                  actionButton('Remove',
                    'cart-remove',
                    id,
                    'text-action')]),
              node('div',
                {
                  class: 'quantity-control'
                },
                [actionButton('−',
                    'cart-decrease',
                    id,
                    'quantity-button'),
                  input,
                  actionButton('+',
                    'cart-increase',
                    id,
                    'quantity-button')]),
              node('strong',
                {
                  class: 'line-total',
                  text: money(cents(product.price) * quantity / 100)
                })]);
        }));
    const total = cartTotals() / 100;
    const summary = node('aside',
      {
        class: 'cart-summary'
      },
      [node('h2',
          {
            text: 'Order summary'
          }),
        node('dl',
          {},
          [node('dt',
              {
                text: 'Subtotal'
              }),
            node('dd',
              {
                text: money(total),
                'data-subtotal': ''
              }),
            node('dt',
              {
                text: 'Total'
              }),
            node('dd',
              {
                text: money(total),
                'data-total': ''
              })]),
        node('p',
          {
            text: 'Shipping and product availability are confirmed on enquiry.'
          }),
        actionButton('Review order',
          'cart-checkout',
          '',
          'btn btn-primary'),
        actionButton('Clear cart',
          'cart-clear',
          '',
          'btn btn-outline'),
        link('Continue shopping →',
          'products.html'),
        node('p',
          {
            class: 'demo-note',
            text: 'Check your quantities and specifications before sending a product enquiry.'
          })]);
    target.replaceChildren(node('div', { class: 'cart-layout' }, [items, summary]));
  }

  function showCheckout() {
    if (!state.cart.size) return;
    const dialog = node('dialog',
      {
        class: 'checkout-dialog',
        'aria-labelledby': 'checkout-title'
      },
      [node('h2',
          {
            id: 'checkout-title',
            text: 'Review your order'
          }),
        node('p',
          {
            text: 'Review your selection, then contact us to confirm availability and delivery details.'
          }),
        node('ul',
          {},
          [...state.cart].map(([id,
                quantity]) => node('li',
              {
                text: `${state.byId.get(id).name} × ${quantity} — ${money(cents(state.byId.get(id).price) * quantity / 100)}`
              }))),
        node('p',
          {
            class: 'product-price',
            text: `Subtotal: ${money(cartTotals() / 100)}`
          })]);
    const close = node('button', { type: 'button', class: 'btn btn-primary', text: 'Back to cart' });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.append(link('Enquire about these items →', 'contact.html', 'btn btn-primary'), close);
    close.className = 'btn btn-outline';
    document.body.append(dialog);
    dialog.showModal();
    close.focus();
  }

  function initializeCart() {
    onChange('cart', renderCart);
    onAction('cart-remove', id => {
        state.cart.delete(id);
        updateStateURL();
        renderCart();
        announce('Product removed from cart.');
      });
    onAction('cart-clear', () => {
        state.cart.clear();
        updateStateURL();
        renderCart();
        announce('Cart cleared.');
      });
    onAction('cart-increase', id => setQuantity(id, (state.cart.get(id) || 0) + 1));
    onAction('cart-decrease', id => setQuantity(id, (state.cart.get(id) || 0) - 1));
    onAction('cart-checkout', showCheckout);
    renderCart();
  }

  app.start(initializeCart);
})();
