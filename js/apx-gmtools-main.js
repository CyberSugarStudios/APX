// ============================================================
// APX GM Tools — Bootstrap (load this file LAST)
// ============================================================

// Several shared modules (Weapon/Armor/Power Forge finalization, math
// inputs, etc.) call window.recalculateMath() as part of their normal
// flow -- that's the full character-sheet render pass from apx-engine.js,
// which isn't loaded here since GM Tools never displays a player sheet.
// The NPC Crafter's own rendering (ncRenderAll, renderGmNpcList) is
// entirely separate and handles everything this page actually shows.
window.recalculateMath = window.recalculateMath || function() {};

window.onload = () => {
    // A handful of shared modules (Weapon/Armor Forge perk checks via
    // apx-craft-shared.js, etc.) defensively read window.state.X even on
    // paths that never actually run for a GM-only NPC. This is never
    // shown or edited here -- it just keeps those reads from crashing.
    window.state = getInitialState();
    window.gmNpcs = window.gmNpcs || [];
    // The GM Screen (party + initiative tracker) is the page itself now,
    // not a modal to open -- just populate its pieces on load.
    window.renderGmScreen();
    window.renderInitiativeTracker();
};
