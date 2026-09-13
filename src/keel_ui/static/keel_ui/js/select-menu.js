/* Select menu: a styled, accessible dropdown that progressively enhances a native
 * <select data-keel-select>.
 *
 * The native element is kept, visually hidden, so it still submits with its form, its
 * `change` listeners keep firing, and code that reads or writes `select.value` keeps
 * working. A button with the select-only combobox role (WAI-ARIA APG) mirrors its
 * state, and the options open in a popover, so the panel sits in the top layer where no
 * `overflow: hidden` ancestor or modal <dialog> can clip it.
 *
 * Nothing about the look lives here: keel_ui/css/select-menu.css draws it from
 * `--keel-select-*` custom properties a host points at its own tokens.
 *
 * A browser without the Popover API keeps the native select untouched, which is a
 * working control rather than a half-built one.
 *
 *   <label>Account size <select data-keel-select>...</select></label>
 *   <label for="size">Account size</label> <select id="size" data-keel-select>...</select>
 *
 * A host that inserts selects after load calls window.keelSelectMenu.enhance(root).
 */
(function () {
  'use strict';

  var SELECTOR = 'select[data-keel-select]';
  var TYPEAHEAD_MS = 600;
  var PANEL_GAP = 6;
  var VIEWPORT_MARGIN = 8;
  var MIN_PANEL_HEIGHT = 120;
  // A press on the button closes an open panel through light dismiss before the click
  // arrives; a click this soon after a close is that same press, not a request to reopen.
  var REOPEN_GUARD_MS = 300;
  var uid = 0;

  var supportsPopover = typeof HTMLElement !== 'undefined' &&
    Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover');

  function el(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function build(select) {
    if (select.dataset.keelSelectReady) { return; }
    select.dataset.keelSelectReady = '1';
    uid += 1;

    var base = (select.id || 'keel-select') + '-' + uid;
    var wrap = el('span', 'keel-select');
    var trigger = el('button', 'keel-select__trigger', {
      type: 'button',
      role: 'combobox',
      id: base + '-combobox',
      'aria-haspopup': 'listbox',
      'aria-expanded': 'false',
      'aria-controls': base + '-listbox'
    });
    var valueBox = el('span', 'keel-select__value-box');
    var value = el('span', 'keel-select__value');
    var list = el('ul', 'keel-select__list', { role: 'listbox', id: base + '-listbox', tabindex: '-1', popover: 'auto' });

    valueBox.appendChild(value);
    trigger.appendChild(valueBox);
    trigger.appendChild(el('span', 'keel-select__chevron', { 'aria-hidden': 'true' }));

    select.parentNode.insertBefore(wrap, select);
    // The button comes first, so a <label> wrapping the pair labels the button and not
    // the hidden select: a label's control is its first labelable descendant.
    wrap.appendChild(trigger);
    wrap.appendChild(select);
    wrap.appendChild(list);

    select.classList.add('keel-select__native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    var outerLabel = select.id ? document.querySelector('label[for="' + select.id + '"]') : null;
    var ownLabel = select.closest('label');
    if (outerLabel) {
      outerLabel.htmlFor = trigger.id;
      if (!outerLabel.id) { outerLabel.id = base + '-label'; }
      list.setAttribute('aria-labelledby', outerLabel.id);
    } else if (select.getAttribute('aria-label')) {
      trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
      list.setAttribute('aria-label', select.getAttribute('aria-label'));
    } else if (ownLabel) {
      if (!ownLabel.id) { ownLabel.id = base + '-label'; }
      list.setAttribute('aria-labelledby', ownLabel.id);
    } else {
      list.setAttribute('aria-labelledby', trigger.id);
    }

    var items = [];
    var active = -1;
    var opened = false;
    var closedAt = -Infinity;
    var typed = '';
    var typedAt = 0;

    function options() { return Array.prototype.slice.call(select.options); }

    function enabled() {
      var out = [];
      options().forEach(function (option, i) { if (!option.disabled) { out.push(i); } });
      return out;
    }

    function render() {
      items = [];
      list.replaceChildren();
      // Every label is laid into the value box invisibly, so the button is as wide as its
      // longest option and does not change width when the choice changes.
      valueBox.querySelectorAll('.keel-select__sizer').forEach(function (node) { node.remove(); });
      options().forEach(function (option, i) {
        var item = el('li', 'keel-select__option', { role: 'option', id: base + '-option-' + i });
        var label = el('span', 'keel-select__option-label');
        label.textContent = option.textContent;
        item.appendChild(label);
        item.appendChild(el('span', 'keel-select__check', { 'aria-hidden': 'true' }));
        if (option.disabled) { item.setAttribute('aria-disabled', 'true'); }
        list.appendChild(item);
        items.push(item);

        var sizer = el('span', 'keel-select__sizer', { 'aria-hidden': 'true' });
        sizer.textContent = option.textContent;
        valueBox.appendChild(sizer);
      });
      sync();
    }

    function sync() {
      var index = select.selectedIndex;
      var current = select.options[index];
      value.textContent = current ? current.textContent : '';
      items.forEach(function (item, i) { item.setAttribute('aria-selected', i === index ? 'true' : 'false'); });
      trigger.disabled = select.disabled;
      wrap.classList.toggle('keel-select--disabled', select.disabled);
    }

    function setActive(index, scroll) {
      if (items[active]) { items[active].classList.remove('is-active'); }
      active = items[index] ? index : -1;
      if (active === -1) {
        trigger.removeAttribute('aria-activedescendant');
        return;
      }
      items[active].classList.add('is-active');
      trigger.setAttribute('aria-activedescendant', items[active].id);
      if (scroll) { items[active].scrollIntoView({ block: 'nearest' }); }
    }

    function place() {
      var box = trigger.getBoundingClientRect();
      var vw = document.documentElement.clientWidth;
      var vh = window.innerHeight;
      list.style.minWidth = box.width + 'px';
      list.style.maxHeight = '';
      var below = vh - box.bottom - VIEWPORT_MARGIN - PANEL_GAP;
      var above = box.top - VIEWPORT_MARGIN - PANEL_GAP;
      var height = list.offsetHeight;
      var up = height > below && above > below;
      var room = Math.max(MIN_PANEL_HEIGHT, up ? above : below);
      list.style.maxHeight = room + 'px';
      height = Math.min(height, room);
      var top = up ? box.top - PANEL_GAP - height : box.bottom + PANEL_GAP;
      var left = Math.min(box.left, vw - VIEWPORT_MARGIN - list.offsetWidth);
      list.style.top = Math.max(VIEWPORT_MARGIN, top) + 'px';
      list.style.left = Math.max(VIEWPORT_MARGIN, left) + 'px';
      wrap.classList.toggle('keel-select--up', up);
    }

    function onViewportChange() { if (opened) { place(); } }

    function markOpen(open) {
      if (open === opened) { return; }
      opened = open;
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      wrap.classList.toggle('keel-select--open', open);
      if (open) {
        place();
        setActive(select.selectedIndex > -1 ? select.selectedIndex : enabled()[0], true);
        window.addEventListener('scroll', onViewportChange, true);
        window.addEventListener('resize', onViewportChange);
      } else {
        closedAt = performance.now();
        setActive(-1);
        window.removeEventListener('scroll', onViewportChange, true);
        window.removeEventListener('resize', onViewportChange);
      }
    }

    function open() {
      if (opened || select.disabled) { return; }
      if (!list.matches(':popover-open')) { list.showPopover(); }
      markOpen(true);
    }

    function close() {
      if (list.matches(':popover-open')) { list.hidePopover(); }
      markOpen(false);
    }

    function commit(index) {
      var option = select.options[index];
      if (!option || option.disabled) { return; }
      var changed = select.selectedIndex !== index;
      select.selectedIndex = index;
      if (changed) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    function step(from, delta) {
      var pool = enabled();
      if (!pool.length) { return -1; }
      var at = pool.indexOf(from);
      if (at === -1) { return delta > 0 ? pool[0] : pool[pool.length - 1]; }
      return pool[Math.max(0, Math.min(pool.length - 1, at + delta))];
    }

    function edge(last) {
      var pool = enabled();
      return last ? pool[pool.length - 1] : pool[0];
    }

    function match(char) {
      var now = performance.now();
      typed = now - typedAt > TYPEAHEAD_MS ? char : typed + char;
      typedAt = now;
      var opts = options();
      var start = opened ? active : select.selectedIndex;
      var needle = typed.toLowerCase();
      for (var k = 0; k < opts.length; k += 1) {
        // One letter pressed again moves on to the next option starting with it.
        var i = (start + k + (typed.length === 1 ? 1 : 0) + opts.length) % opts.length;
        if (!opts[i].disabled && opts[i].textContent.trim().toLowerCase().indexOf(needle) === 0) { return i; }
      }
      return -1;
    }

    list.addEventListener('toggle', function (event) { markOpen(event.newState === 'open'); });

    trigger.addEventListener('click', function () {
      if (opened) { close(); return; }
      if (performance.now() - closedAt < REOPEN_GUARD_MS) { return; }
      open();
    });

    trigger.addEventListener('keydown', function (event) {
      var key = event.key;
      var printable = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (!opened) {
        if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
          event.preventDefault();
          open();
        } else if (key === 'Home' || key === 'End') {
          event.preventDefault();
          open();
          setActive(edge(key === 'End'), true);
        } else if (printable) {
          var hit = match(key);
          if (hit > -1) { commit(hit); }
        }
        return;
      }
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault();
        if (event.altKey && key === 'ArrowUp') {
          commit(active);
          close();
          return;
        }
        setActive(step(active, key === 'ArrowDown' ? 1 : -1), true);
      } else if (key === 'PageDown' || key === 'PageUp') {
        event.preventDefault();
        setActive(step(active, key === 'PageDown' ? 10 : -10), true);
      } else if (key === 'Home' || key === 'End') {
        event.preventDefault();
        setActive(edge(key === 'End'), true);
      } else if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        commit(active);
        close();
      } else if (key === 'Escape') {
        event.preventDefault();
        close();
      } else if (key === 'Tab') {
        commit(active);
        close();
      } else if (printable) {
        var found = match(key);
        if (found > -1) { setActive(found, true); }
      }
    });

    // A press on an option must not take focus off the combobox.
    list.addEventListener('mousedown', function (event) { event.preventDefault(); });
    list.addEventListener('click', function (event) {
      var item = event.target.closest('.keel-select__option');
      if (!item || item.getAttribute('aria-disabled') === 'true') { return; }
      commit(items.indexOf(item));
      close();
      trigger.focus();
    });
    list.addEventListener('mousemove', function (event) {
      var item = event.target.closest('.keel-select__option');
      var index = items.indexOf(item);
      if (index > -1 && index !== active && item.getAttribute('aria-disabled') !== 'true') { setActive(index, false); }
    });

    // Code that writes select.value or selectedIndex fires no event, so both are wrapped
    // on this one element to repaint the button whenever either is written.
    ['value', 'selectedIndex'].forEach(function (prop) {
      var native = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
      if (!native || !native.set) { return; }
      Object.defineProperty(select, prop, {
        configurable: true,
        get: function () { return native.get.call(this); },
        set: function (next) {
          native.set.call(this, next);
          sync();
        }
      });
    });
    select.addEventListener('change', sync);
    if (select.form) {
      select.form.addEventListener('reset', function () { window.setTimeout(sync, 0); });
    }
    new MutationObserver(render).observe(select, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['disabled', 'label']
    });

    render();
  }

  function enhance(root) {
    if (!supportsPopover) { return; }
    Array.prototype.forEach.call((root || document).querySelectorAll(SELECTOR), build);
  }

  window.keelSelectMenu = { enhance: enhance };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { enhance(document); });
  } else {
    enhance(document);
  }
})();
