// ============================================================
// APX Character Sheet — Roster & Save/Load
// ============================================================
        let activeCharId = null;
        let charToDelete = null;
        let localRoster = {};

        window.renderLocalRoster = function() {
            let html = '';
            const chars = Object.values(localRoster).sort((a, b) => (b.updatedAt||0) - (a.updatedAt||0));
            chars.forEach(c => {
                let activeClass = activeCharId === c.id ? 'active-char' : '';
                html += `
                    <div class="char-list-item ${activeClass}" onclick="window.loadCharacter('${c.id}')">
                        <span class="font-bold text-slate-200 truncate pr-2">${c.name || 'Unnamed Hero'}</span>
                        <button onclick="event.stopPropagation(); window.promptDeleteCharacter('${c.id}', '${String(c.name || 'Unnamed Hero').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" class="text-slate-500 hover:text-red-500 transition px-1">&times;</button>
                    </div>
                `;
            });
            if(chars.length === 0) html = `<div class="text-xs text-slate-500 text-center py-4">Roster is empty.</div>`;
            document.getElementById('characterList').innerHTML = html;
        };

        window.loadCharacter = async function(id) {
            if (localRoster[id]) {
                window.state = { ...getInitialState(), ...window.apxPrepareLoadedState({ ...localRoster[id] }) };
                activeCharId = id;
                window.recalculateMath();
                window.renderLocalRoster();
                window.toggleSidebar();
            }
        }

        window.promptDeleteCharacter = function(id, name) {
            charToDelete = id;
            document.getElementById('deleteConfirmInput').value = '';
            document.getElementById('btnTypeDeleteConfirm').disabled = true;
            document.getElementById('btnTypeDeleteConfirm').className = "px-6 py-2 rounded bg-red-600/50 text-white/50 font-bold transition shadow-lg cursor-not-allowed";
            window.openModal('typeDeleteModal');
        }

        window.checkDeleteInput = function(val) {
            let btn = document.getElementById('btnTypeDeleteConfirm');
            if(val === 'DELETE') {
                btn.disabled = false;
                btn.className = "px-6 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-bold transition shadow-lg";
            } else {
                btn.disabled = true;
                btn.className = "px-6 py-2 rounded bg-red-600/50 text-white/50 font-bold transition shadow-lg cursor-not-allowed";
            }
        }

        window.confirmDeleteCharacter = async function() {
            if(!charToDelete) return;
            
            delete localRoster[charToDelete];
            if(activeCharId === charToDelete) {
                activeCharId = null;
                window.state = getInitialState();
                window.recalculateMath();
            }
            window.renderLocalRoster();
            window.closeModal('typeDeleteModal');
        }

        window.toggleSidebar = function() {
            document.getElementById('sidebar').classList.toggle('active');
            document.getElementById('sidebarOverlay').classList.toggle('active');
            let mc = document.getElementById('mainContent');
            if(document.getElementById('sidebar').classList.contains('active')) {
                mc.classList.add('lg:ml-[300px]');
            } else {
                mc.classList.remove('lg:ml-[300px]');
            }
        }

