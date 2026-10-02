// ============================================================
// APX Light-mode pass (Kawaii)
// ============================================================
// Kawaii is a light theme, but many windows (stat blocks, maps, loot,
// tracker rows, popups) are drawn with fixed dark-theme colours written
// straight into their HTML, which no stylesheet rule can reach. While a
// light theme is on, this pass looks at what's actually on screen:
//   • fixed dark, colourless backgrounds become the theme's own surfaces
//     (and their dark borders the theme's borders);
//   • any text that doesn't stand out from what's behind it (white or pale
//     text on a pale surface) is darkened: greys to the theme's text
//     colours, coloured text to a deep shade of its own hue.
// Text drawn over map images (and anything with a text-shadow) is left
// alone, and so is anything inside [data-apx-keep-colors]. Switching to a
// dark theme puts every original colour back.
// ============================================================
(function () {
    'use strict';
    const LIGHT_THEMES = new Set(['kawaii']);
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'IMG', 'CANVAS', 'VIDEO', 'svg', 'SVG', 'PATH', 'LINK', 'META', 'BR', 'HR', 'OPTION']);
    const MARK = 'apxLt';   // data-apx-lt holds the original inline values
    const isLight = () => LIGHT_THEMES.has(document.documentElement.getAttribute('data-theme'));

    function parse(c) {
        let m = String(c || '').match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
        if (!m) return null;
        let a = m[4] === undefined ? 1 : (String(m[4]).endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
        return { r: +m[1], g: +m[2], b: +m[3], a };
    }
    function lum(c) {
        let f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }
    function sat(c) { let mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return mx ? (mx - mn) / mx : 0; }
    function contrast(a, b) { let la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
    // The same hue, deep enough to read on a pale surface
    function deepen(c) {
        let r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, d = mx - mn;
        if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = Math.round(h * 60); if (h < 0) h += 360;
        return `hsl(${h}, 62%, 27%)`;
    }

    function pageBg() { return parse(getComputedStyle(document.body).backgroundColor) || { r: 250, g: 238, b: 244, a: 1 }; }
    // What the element's text is drawn on: the nearest solid background (null over an image)
    function effBg(el) {
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
            let cs = getComputedStyle(n);
            if (cs.backgroundImage && cs.backgroundImage !== 'none' && n !== document.body && !/gradient/.test(cs.backgroundImage)) return null;
            let c = parse(cs.backgroundColor);
            if (c && c.a >= 0.55) return c;
        }
        return pageBg();
    }
    function hasOwnText(el) {
        if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName)) return true;
        for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
        return false;
    }
    function remember(el, prop) {
        let o = {}; try { o = JSON.parse(el.dataset[MARK] || '{}'); } catch (e) { }
        if (!(prop in o)) { o[prop] = [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)]; el.dataset[MARK] = JSON.stringify(o); }
    }
    function set(el, prop, val) { remember(el, prop); el.style.setProperty(prop, val, 'important'); }

    function fixEl(el) {
        if (SKIP_TAGS.has(el.tagName) || el.closest('[data-apx-keep-colors], svg')) return;
        let cs = getComputedStyle(el);
        if (cs.display === 'none') return;
        let inline = el.getAttribute('style') || '';
        // 1. A fixed dark, colourless background → the theme's surfaces (borders likewise)
        if (/background/.test(inline)) {
            let bg = parse(cs.backgroundColor);
            if (bg && bg.a >= 0.85 && sat(bg) < 0.4 && lum(bg) < 0.09) set(el, 'background-color', lum(bg) < 0.02 ? 'var(--c-surface2)' : 'var(--c-surface)');
        }
        if (/border/.test(inline)) {
            let bc = parse(cs.borderTopColor);
            if (bc && cs.borderTopWidth !== '0px' && sat(bc) < 0.4 && lum(bc) < 0.12) set(el, 'border-color', 'var(--c-border2)');
        }
        // 2. Text that doesn't stand out from its surface
        if (!hasOwnText(el) || (cs.textShadow && cs.textShadow !== 'none')) return;
        let fg = parse(cs.color); if (!fg || fg.a < 0.3) return;
        let bg = effBg(el); if (!bg || lum(bg) < 0.35) return;   // dark surface: light text is right
        if (contrast(fg, bg) >= 3.2) return;
        set(el, 'color', sat(fg) < 0.25 ? (lum(fg) > 0.45 ? 'var(--c-text)' : 'var(--c-text-muted)') : deepen(fg));
    }
    function fixTree(root) {
        if (!root || root.nodeType !== 1) return;
        fixEl(root);
        let w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, { acceptNode: n => SKIP_TAGS.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
        let n; while ((n = w.nextNode())) fixEl(n);
    }
    function restoreAll() {
        document.querySelectorAll('[data-apx-lt]').forEach(el => {
            let o = {}; try { o = JSON.parse(el.dataset[MARK] || '{}'); } catch (e) { }
            Object.keys(o).forEach(p => { let [v, pr] = o[p]; if (v) el.style.setProperty(p, v, pr); else el.style.removeProperty(p); });
            delete el.dataset[MARK];
        });
    }

    // Batch the work: whatever was added since the last frame
    let pending = new Set(), raf = 0, active = false;
    function flush() {
        raf = 0;
        if (!active) { pending.clear(); return; }
        let roots = [...pending]; pending.clear();
        roots.filter(r => r.isConnected && !roots.some(o => o !== r && o.contains(r))).forEach(fixTree);
    }
    function queue(n) { if (n && n.nodeType === 1) { pending.add(n); if (!raf) raf = requestAnimationFrame(flush); } }
    const mo = new MutationObserver(list => {
        if (!active) return;
        list.forEach(m => {
            if (m.type === 'childList') m.addedNodes.forEach(n => queue(n.nodeType === 1 ? n : n.parentElement));
            else if (m.type === 'attributes' && m.target.nodeType === 1 && !(m.attributeName === 'style' && m.target.dataset[MARK])) queue(m.target);
            else if (m.type === 'characterData') queue(m.target.parentElement);
        });
    });
    function sync() {
        let want = isLight();
        if (want === active) return;
        active = want;
        if (active) {
            mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], characterData: true });
            queue(document.body);
        } else { mo.disconnect(); restoreAll(); }
    }
    function start() {
        sync();
        new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    window.apxLightPass = { refresh: () => { if (active) queue(document.body); } };
})();
