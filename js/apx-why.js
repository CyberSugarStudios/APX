// ============================================================
// APX Character Sheet: why each number is what it is (the breakdown tooltips)
// ============================================================
// The engine (js/apx-engine.js) records each part of a number as it adds it up: calc.why[key] = [[label, amount,
// base?], ...]. These turn that into the text a tooltip shows and put it on the element (data-tip: the sheet's
// instant tooltips, js/apx-state.js). A breakdown always adds up to the number shown: anything not itemised gets
// an "Other adjustments" line, so a tooltip never claims a total it can't explain.
// ============================================================
(function () {
    'use strict';
    const sg = n => (n >= 0 ? '+' : '−') + Math.abs(Math.round(n * 100) / 100);
    // The lines of a breakdown: the base first (no sign), then every part with its sign
    window.apxWhyLines = function (list, total) {
        list = (list || []).filter(x => x && (x[2] || Number(x[1])));
        let base = list.filter(x => x[2]), rest = list.filter(x => !x[2]);
        let sum = list.reduce((t, x) => t + (Number(x[1]) || 0), 0);
        let lines = base.map(x => `${x[1]}  ${x[0]}`).concat(rest.map(x => `${sg(Number(x[1]) || 0)}  ${x[0]}`));
        if (total != null && Math.abs(sum - total) > 1e-9) lines.push(`${sg(total - sum)}  Other adjustments`);
        return lines;
    };
    // "Title: total" and its breakdown, then any notes (each on its own line)
    window.apxWhyText = function (title, list, total, notes) {
        let out = [title + (total != null && total !== '' ? `: ${total}` : '')].concat(window.apxWhyLines(list, total));
        (notes || []).filter(Boolean).forEach(n => out.push(String(n)));
        return out.join('\n');
    };
    // Where a roll's Advantage, Disadvantage or automatic failure comes from
    window.apxWhyModeText = function (adv, dis, autoFail) {
        let out = [];
        if (autoFail && autoFail.length) out.push('Automatic failure: ' + autoFail.join(', '));
        if (dis && dis.length) out.push('Disadvantage: ' + dis.join(', '));
        if (adv && adv.length) out.push('Advantage: ' + adv.join(', '));
        if (adv && adv.length && dis && dis.length) out.push('(Advantage and Disadvantage cancel out.)');
        return out.join('\n');
    };
    // Put a tooltip on an element (by id or the element): the sheet's instant tooltip, never also the browser's own
    window.apxTip = function (el, text) {
        if (typeof el === 'string') el = document.getElementById(el);
        if (!el) return;
        if (text) { el.setAttribute('data-tip', text); el.removeAttribute('title'); }
        else el.removeAttribute('data-tip');
    };
    // The same, as an attribute for an HTML string (escaped)
    window.apxTipAttr = function (text) {
        if (!text) return '';
        return ` data-tip="${String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"`;
    };
})();
