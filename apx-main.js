// ============================================================
// APX Character Sheet — Bootstrap (load this file LAST)
// ============================================================
        window.onload = () => {
            window.recalculateMath();
            if (!activeCharId) {
                activeCharId = crypto.randomUUID();
            }
        };