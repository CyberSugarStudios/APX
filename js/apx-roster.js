// ============================================================
// APX Character Sheet — Roster & Save/Load
// ============================================================
        let activeCharId = null;
        let charToDelete = null;
        let dirHandle = null;
        let localRoster = {};

        window.loadRosterFolder = async function() {
            try {
                dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                localRoster = {};
                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                        const file = await entry.getFile();
                        const text = await file.text();
                        try {
                            const charData = JSON.parse(text);
                            if (!charData.id) charData.id = crypto.randomUUID();
                            localRoster[charData.id] = { ...charData, _fileHandle: entry };
                        } catch (e) {
                            console.warn("Skipping invalid JSON file:", entry.name);
                        }
                    }
                }
                // This only populates the roster list for browsing -- it
                // must never touch window.state on its own. Whatever
                // character is currently being edited (possibly with
                // unsaved changes) stays active until the user explicitly
                // clicks a character in the list to switch to it.
                window.renderLocalRoster();
            } catch (err) {
                console.error(err);
                window.showConfirm("Folder access was denied or is restricted in this browser. You can still use 'Export' and 'Import Single'.", null, true);
            }
        };

        window.renderLocalRoster = function() {
            let html = '';
            const chars = Object.values(localRoster).sort((a, b) => (b.updatedAt||0) - (a.updatedAt||0));
            chars.forEach(c => {
                let activeClass = activeCharId === c.id ? 'active-char' : '';
                html += `
                    <div class="char-list-item ${activeClass}" onclick="window.loadCharacter('${c.id}')">
                        <span class="font-bold text-slate-200 truncate pr-2">${c.name || 'Unnamed Hero'}</span>
                        <button onclick="event.stopPropagation(); window.promptDeleteCharacter('${c.id}', '${c.name || 'Unnamed Hero'}')" class="text-slate-500 hover:text-red-500 transition px-1">&times;</button>
                    </div>
                `;
            });
            if(chars.length === 0) html = `<div class="text-xs text-slate-500 text-center py-4">Roster is empty.</div>`;
            document.getElementById('characterList').innerHTML = html;
        };

        window.saveToRosterFolder = async function() {
            if (!dirHandle || !activeCharId) {
                window.showConfirm("No roster folder loaded. Use 'Export' to download.", null, true);
                return;
            }
            try {
                let charData = localRoster[activeCharId];
                let fileName = (window.state.name ? window.state.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : "apx_character_" + activeCharId) + ".json";
                
                let fileHandle;
                if (charData && charData._fileHandle && charData._fileHandle.name === fileName) {
                    fileHandle = charData._fileHandle;
                } else {
                    fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                }

                const writable = await fileHandle.createWritable();
                window.state.id = activeCharId;
                window.state.updatedAt = Date.now();
                
                const saveState = { ...window.state };
                
                await writable.write(JSON.stringify(saveState, null, 2));
                await writable.close();
                
                localRoster[activeCharId] = { ...saveState, _fileHandle: fileHandle };
                window.renderLocalRoster();
                
                let btn = document.getElementById('btnSaveRoster');
                let oldText = btn.innerText;
                btn.innerText = "✓ Saved!";
                setTimeout(() => btn.innerText = oldText, 2000);
            } catch (err) {
                console.error("Save to roster failed", err);
                window.showConfirm("Failed to save to folder. Check permissions or use Export.", null, true);
            }
        };

        window.createNewCharacter = function() {
            window.state = getInitialState();
            activeCharId = crypto.randomUUID();
            window.state.id = activeCharId;
            localRoster[activeCharId] = { ...window.state };
            window.recalculateMath();
            window.renderLocalRoster();
            window.toggleSidebar();
        }

        window.loadCharacter = async function(id) {
            if (localRoster[id]) {
                window.state = { ...getInitialState(), ...localRoster[id] };
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
            
            if (dirHandle && localRoster[charToDelete] && localRoster[charToDelete]._fileHandle) {
                try {
                    await dirHandle.removeEntry(localRoster[charToDelete]._fileHandle.name);
                } catch(e) {
                    console.warn("Could not delete file from disk", e);
                }
            }
            
            delete localRoster[charToDelete];
            if(activeCharId === charToDelete) {
                activeCharId = null;
                window.state = getInitialState();
                window.recalculateMath();
            }
            window.renderLocalRoster();
            window.closeModal('typeDeleteModal');
        }

        window.saveToLocal = function() {
            const saveState = { ...window.state };
            saveState.id = activeCharId;
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saveState, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            let fileName = window.state.name ? window.state.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : "apx_character";
            downloadAnchorNode.setAttribute("download", fileName + ".json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        };

        window.loadFromLocal = function(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedState = JSON.parse(e.target.result);
                    window.state = { ...getInitialState(), ...importedState };
                    activeCharId = window.state.id || crypto.randomUUID();
                    window.state.id = activeCharId;
                    localRoster[activeCharId] = { ...window.state };
                    
                    window.recalculateMath();
                    window.renderLocalRoster();
                    document.getElementById('importFile').value = ''; 
                    window.toggleSidebar();
                } catch (err) {
                    console.error("Failed to parse character file", err);
                    window.showConfirm("Invalid character file.", null, true);
                }
            };
            reader.readAsText(file);
        };

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

