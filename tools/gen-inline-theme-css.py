# Usage: python3 tools/gen-inline-theme-css.py  → writes inline-theme.css; paste it over the
# "INLINE-STYLE THEMING" section at the end of css/apx-themes.css. Edit the BG / BORDER / COLOR tables to change mappings.
# Generates the "inline-style theming" section of css/apx-themes.css.
# Maps hard-coded inline hex colours (used by JS-built popups/windows) to theme variables.
def rgb(h):
    h=h.lstrip('#'); h=''.join(c*2 for c in h) if len(h)==3 else h
    return f"rgb({int(h[0:2],16)}, {int(h[2:4],16)}, {int(h[4:6],16)})"
MIX = lambda v: f"color-mix(in srgb, var({v}) 62%, var(--c-text))"   # light accent text → readable in every theme
BG = {  # background colours
 '#0f172a':'var(--c-surface2)', '#1e293b':'var(--c-surface)', '#334155':'var(--c-border)', '#475569':'var(--c-border2)',
 '#1e3a5f':'color-mix(in srgb, var(--c-blue) 24%, var(--c-surface))',
 '#1d4ed8':'var(--c-blue)', '#2563eb':'var(--c-blue)',
 '#059669':'var(--c-emerald)', '#065f46':'var(--c-emerald-dark)', '#064e3b':'var(--c-emerald-dark)',
 '#7f1d1d':'var(--c-red-dark)', '#991b1b':'var(--c-red-dark)', '#dc2626':'var(--c-red)',
 '#b45309':'var(--c-amber-dk)', '#78350f':'var(--c-amber-dark)',
 '#4f46e5':'var(--c-indigo)', '#312e81':'var(--c-indigo-dark)', '#1e1b4b':'var(--c-indigo-dark)',
 '#7c3aed':'var(--c-purple)', '#581c87':'var(--c-purple-dark)',
}
BORDER = {
 '#0f172a':'var(--c-surface2)', '#1e293b':'var(--c-surface)', '#334155':'var(--c-border)', '#475569':'var(--c-border2)',
 '#64748b':'var(--c-border3)', '#e2e8f0':'var(--c-border3)',
 '#2563eb':'var(--c-blue)', '#3b82f6':'var(--c-blue-lt)',
 '#10b981':'var(--c-emerald-lt)', '#059669':'var(--c-emerald)', '#065f46':'var(--c-emerald)',
 '#7f1d1d':'var(--c-red)', '#991b1b':'var(--c-red)', '#ef4444':'var(--c-red)',
 '#92400e':'var(--c-amber)', '#4f46e5':'var(--c-indigo)', '#6366f1':'var(--c-indigo-lt)',
 '#7c3aed':'var(--c-purple)', '#9333ea':'var(--c-purple)', '#581c87':'var(--c-purple-dark)', '#4c1d95':'var(--c-purple-dark)',
}
COLOR = {
 '#f8fafc':'var(--c-text)', '#e2e8f0':'var(--c-text)', '#cbd5e1':'var(--c-text-dimmer)',
 '#94a3b8':'var(--c-text-muted)', '#64748b':'var(--c-text-dim)', '#475569':'var(--c-text-dim)', '#334155':'var(--c-border2)',
 '#93c5fd':MIX('--c-blue-lt'),   # (#bfdbfe is only used ON solid blue buttons — stays light)
 '#6ee7b7':MIX('--c-emerald-lt'), '#34d399':MIX('--c-emerald-lt'), '#a3e635':MIX('--c-emerald-lt'), '#4ade80':MIX('--c-emerald-lt'),
 '#fca5a5':MIX('--c-red'), '#f87171':MIX('--c-red'), '#ef4444':'var(--c-red)', '#fecaca':MIX('--c-red'),
 '#fbbf24':MIX('--c-amber'), '#fde68a':MIX('--c-amber'), '#f59e0b':MIX('--c-amber'),
 '#a5b4fc':MIX('--c-indigo-lt'), '#818cf8':MIX('--c-indigo-lt'), '#c7d2fe':MIX('--c-indigo-lt'), '#e0e7ff':MIX('--c-indigo-lt'), '#6366f1':'var(--c-indigo-lt)',
 '#c4b5fd':MIX('--c-purple-lt'), '#c084fc':MIX('--c-purple-lt'),
 '#22d3ee':'var(--c-cyan)',
}
NEUTRAL_BG = ['#0f172a','#1e293b','#334155','#475569']
out=[]
out.append("""
/* ════════════════════════════════════════════════════════════════════════════
   INLINE-STYLE THEMING  (generated from a colour → theme-variable table)
   Popups, floating windows, menus and overlays built in JavaScript use inline
   hex colours (e.g. style="background:#1e293b"). These rules recognise those
   colours in the style attribute — both as written and as the browser
   re-serialises them (rgb()) — and swap in the active theme's variable, the
   same way the [class*="bg-slate-800"] rules above theme Tailwind classes.
   Inline styles never use !important, so these always win.
   ════════════════════════════════════════════════════════════════════════════ */""")
def sels(forms): return ',\n'.join(forms)
for h,v in BG.items():
    f=[f'[style*="background:{h}" i]',f'[style*="background: {h}" i]',f'[style*="background-color:{h}" i]',f'[style*="background-color: {h}" i]',
       f'[style*="background: {rgb(h)}"]',f'[style*="background-color: {rgb(h)}"]']
    out.append(sels(f)+' { background-color: '+v+' !important; }')
for h,v in BORDER.items():
    f=[f'[style*="solid {h}" i]',f'[style*="border-color:{h}" i]',f'[style*="border-color: {h}" i]',
       f'[style*="solid {rgb(h)}"]',f'[style*="border-color: {rgb(h)}"]']
    out.append(sels(f)+' { border-color: '+v+' !important; }')
for h,v in COLOR.items():
    # "color:" is also a substring of background-color / border-color — exclude those
    base=[f'[style*="color:{h}" i]',f'[style*="color: {h}" i]',f'[style*="color: {rgb(h)}"]']
    nots=f':not([style*="background-color:{h}" i]):not([style*="border-color:{h}" i]):not([style*="background-color: {rgb(h)}"]):not([style*="border-color: {rgb(h)}"])'
    out.append(',\n'.join(b+nots for b in base)+' { color: '+v+' !important; }')
# White text sitting directly on a neutral surface → theme text colour (matters for light themes)
wf=[]
for b in NEUTRAL_BG:
    for w in ['#fff','#ffffff']:
        for bf in [f'background:{b}', f'background: {b}']:
            wf.append(f'[style*="{bf}" i][style*="color:{w}" i]')
out.append(',\n'.join(wf)+' { color: var(--c-text) !important; }')
open('inline-theme.css','w').write('\n'.join(out)+'\n')
print(len(out),'rule blocks')
