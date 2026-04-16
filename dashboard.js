/** 
 * BrickAPI Dashboard Logic
 * Handles endpoint organization, project management, and OpenAPI documentation generation.
 */

let currentFingerprint = null;
let currentProject = '';
let endpoints = {};
let projectsData = {};

// DOM Elements
const projectSelector = document.getElementById('project-selector');
const globalTitle = document.getElementById('global-title');
const globalDesc = document.getElementById('global-desc');
const unassignedList = document.getElementById('unassigned');
const groupsList = document.getElementById('groups-list');
const editor = document.getElementById('endpoint-editor');
const placeholder = document.getElementById('editor-placeholder');
const summaryInput = document.getElementById('edit-summary');
const descInput = document.getElementById('edit-description');
const pathInput = document.getElementById('edit-path');
const methodInput = document.getElementById('edit-method');
const envInput = document.getElementById('edit-environment');
const reqBodyInput = document.getElementById('edit-reqbody');
const resBodyInput = document.getElementById('edit-resbody');
const headersInput = document.getElementById('edit-headers');
const deleteEndpointBtn = document.getElementById('delete-endpoint-btn');
const deleteProjectBtn = document.getElementById('delete-project-btn');

// Initialize
/**
 * Loads project metadata and captured endpoints from local storage.
 */
async function load() {
    const data = await chrome.storage.local.get(null);
    const metas = Object.entries(data).filter(([k]) => k.startsWith('meta_'));

    // Reset internal state
    endpoints = {};
    projectsData = {};

    // Load available endpoints
    metas.forEach(([key, meta]) => {
        const fingerprint = key.replace('meta_', '');
        const host = meta.hostname || 'others';
        endpoints[fingerprint] = meta;
        if (!projectsData[host]) {
            projectsData[host] = { groupsData: { unassigned: [] }, global: { title: `${host} API`, desc: '' } };
        }
    });

    // Merge saved project structures
    const savedProjects = data.projectsData || {};
    Object.keys(savedProjects).forEach(host => {
        if (!projectsData[host]) {
            projectsData[host] = savedProjects[host];
        } else {
            // Keep current metadata but merge group structure
            projectsData[host].groupsData = savedProjects[host].groupsData || { unassigned: [] };
            projectsData[host].global = savedProjects[host].global || projectsData[host].global;
        }
    });

    const previousProject = currentProject;
    updateProjectSelector();

    if (previousProject && projectsData[previousProject]) {
        projectSelector.value = previousProject;
        currentProject = previousProject;
    } else if (Object.keys(projectsData).length > 0) {
        currentProject = projectSelector.value;
    }

    if (currentProject) {
        selectProject(currentProject);
    }

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// 3. Storage Auto-Sync Listener
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        const hasMetaChanges = Object.keys(changes).some(k => k.startsWith('meta_'));
        const hasProjectChanges = changes.projectsData;
        
        if (hasMetaChanges || hasProjectChanges) {
            console.log('Storage changed, reloading dashboard...');
            load();
        }
    }
});

document.getElementById('refresh-btn').onclick = () => {
    load();
    showToast('Dashboard refreshed', 'success');
};

function updateProjectSelector() {
    const hosts = Object.keys(projectsData);
    projectSelector.innerHTML = hosts.map(h => `<option value="${h}">${h}</option>`).join('');
}

projectSelector.onchange = () => {
    currentProject = projectSelector.value;
    selectProject(currentProject);
};

function selectProject(host) {
    if (!host || !projectsData[host]) {
        console.warn('Project not found:', host);
        return;
    }
    const proj = projectsData[host];
    globalTitle.value = proj.global.title || '';
    globalDesc.value = proj.global.desc || '';
    renderAll();
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Auto-save project info
const autoSaveProjectInfo = debounce(async () => {
    if (!currentProject || !projectsData[currentProject]) return;
    projectsData[currentProject].global = {
        title: globalTitle.value,
        desc: globalDesc.value
    };
    await chrome.storage.local.set({ projectsData });
    showToast('Changes saved automatically', 'info');
}, 1000);

globalTitle.oninput = autoSaveProjectInfo;
globalDesc.oninput = autoSaveProjectInfo;

function renderAll() {
    unassignedList.innerHTML = '';
    groupsList.innerHTML = '';

    const proj = projectsData[currentProject];
    if (!proj) return;
    const gd = proj.groupsData || { unassigned: [] };

    // Get all endpoints for this project
    const projectFingerprints = Object.keys(endpoints).filter(id => endpoints[id].hostname === currentProject || (!endpoints[id].hostname && currentProject === 'others'));

    // 1. Render Unassigned (Column 1)
    // Find IDs that are NOT in any real group
    const assignedIds = new Set();
    Object.entries(gd).forEach(([name, list]) => {
        if (name !== 'unassigned') {
            list.forEach(id => assignedIds.add(id));
        }
    });

    const unassignedIds = projectFingerprints.filter(id => !assignedIds.has(id));
    document.getElementById('unassigned-count').innerText = unassignedIds.length;
    unassignedIds.forEach(id => renderCard(id, unassignedList, true));

    // 2. Render Groups (Column 2) - RESPECT ORDER
    const groupOrder = proj.groupOrder || Object.keys(gd).filter(k => k !== 'unassigned');

    const totalGroupsEl = document.getElementById('total-groups-count');
    const totalEndpointsEl = document.getElementById('total-endpoints-count');
    const storageUsageCountEl = document.getElementById('storage-usage-count');

    if (totalGroupsEl) totalGroupsEl.innerText = groupOrder.length;
    if (totalEndpointsEl) totalEndpointsEl.innerText = assignedIds.size;

    if (storageUsageCountEl) {
        chrome.storage.local.getBytesInUse(null).then(bytes => {
            const kb = (bytes / 1024).toFixed(2);
            if (kb > 1024) {
                storageUsageCountEl.innerText = (kb / 1024).toFixed(2) + ' MB';
            } else {
                storageUsageCountEl.innerText = kb + ' KB';
            }
        });
    }


    groupOrder.forEach(groupName => {
        const ids = gd[groupName];
        if (!ids) return;

        const container = createGroupContainer(groupName);
        const list = container.querySelector('.sortable-list');
        ids.forEach(id => {
            if (endpoints[id]) renderCard(id, list);
        });
    });

    initSortable();
    if (window.lucide) lucide.createIcons();
}

function renderCard(id, container, isUnassigned = false) {
    const data = endpoints[id];
    if (!data) return;
    const card = document.createElement('div');
    card.className = 'endpoint-card bg-slate-800 border border-slate-700 p-3 rounded-lg cursor-pointer shadow-sm hover:border-primary group';
    card.dataset.id = id;

    const method = data.method.toLowerCase();
    const methodClass = `method-${method}`;
    const autoTitle = data.summary || (data.normalizedPath.split('/').filter(Boolean).pop() || '/');

    let checkboxHTML = '';
    if (isUnassigned) {
        checkboxHTML = `<input type="checkbox" class="endpoint-checkbox w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-600 focus:ring-offset-slate-800 mr-2 mt-0.5 cursor-pointer" data-id="${id}" onclick="event.stopPropagation(); window.toggleCheckbox(event)">`;
    }

    card.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 overflow-hidden">
                ${checkboxHTML}
                <span class="font-bold text-xs px-2 py-0.5 rounded bg-slate-700/50 uppercase flex-shrink-0 ${methodClass}">${data.method}</span>
                <span class="text-sm font-medium text-slate-200 truncate ${isUnassigned ? 'max-w-[120px]' : 'max-w-[160px]'}" title="${data.normalizedPath}">${autoTitle}</span>
            </div>
            <div class="flex items-center gap-1.5 overflow-hidden flex-shrink-0">
                <svg class="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
        </div>
    `;

    card.onclick = () => openEditor(id);
    container.appendChild(card);
    if (window.lucide) lucide.createIcons();
}

function createGroupContainer(name) {
    const div = document.createElement('div');
    div.className = 'group-container bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg mb-4';
    div.dataset.groupName = name;

    div.innerHTML = `
        <div class="group-title flex items-center justify-between p-3 bg-slate-700/80 border-b border-slate-600 rounded-t-xl hover:bg-slate-700 transition-colors cursor-pointer select-none">
            <div class="flex items-center gap-3">
                <button class="btn-toggle flex items-center px-1.5 py-1 bg-slate-900 border border-slate-600 rounded hover:bg-slate-600 text-slate-200 transition-all">
                    <svg class="accordion-arrow w-4 h-4 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <span class="font-bold text-slate-100 text-sm uppercase tracking-wider">${name}</span>
            </div> 
            <div class="flex items-center gap-2">
                <!-- Group Edit Button -->
                <button class="btn-edit flex items-center px-3 py-1 bg-amber-900/30 border border-amber-600/50 rounded-md hover:bg-amber-600 hover:text-white text-amber-400 text-[10px] font-bold transition-all uppercase" title="Rename Group">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    <span class="ml-1.5">Rename</span>
                </button>
                <!-- Group Delete Button -->
                <button class="btn-delete flex items-center px-3 py-1 bg-red-900/30 border border-red-600/50 rounded-md hover:bg-red-600 hover:text-white text-red-300 text-[10px] font-bold transition-all uppercase" title="Delete Group">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    <span class="ml-1.5">Delete</span>
                </button>
            </div>
        </div>
        <div class="sortable-list p-3 space-y-2 min-h-[40px] bg-slate-800/10" data-name="${name}"></div>
    `;

    // Bind events
    const titleBar = div.querySelector('.group-title');
    const toggleBtn = div.querySelector('.btn-toggle');
    const editBtn = div.querySelector('.btn-edit');
    const deleteBtn = div.querySelector('.btn-delete');

    titleBar.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            toggleGroupAccordion(name);
        }
    });

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleGroupAccordion(name);
    });

    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.editGroupName(name);
    });

    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.deleteGroup(name);
    });

    groupsList.appendChild(div);
    return div;
}

// Custom Toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-amber-500'
    };

    const icons = {
        success: 'check-circle',
        error: 'alert-circle',
        info: 'info',
        warning: 'alert-triangle'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl text-white transform transition-all duration-300 translate-y-10 opacity-0 ${colors[type]}`;
    toast.innerHTML = `
        <i data-lucide="${icons[type]}" class="w-5 h-5"></i>
        <span class="text-sm font-medium">${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Toggles the collapsed state of a group's endpoint list.
 * @param {string} name - Internal group name.
 */
window.toggleGroupAccordion = function (name) {
    const container = document.querySelector(`.group-container[data-group-name="${name}"]`);
    if (!container) return;

    const list = container.querySelector('.sortable-list');
    const arrow = container.querySelector('.accordion-arrow');

    if (list.classList.contains('collapsed')) {
        list.classList.remove('collapsed');
        arrow.style.transform = 'rotate(0deg)';
    } else {
        list.classList.add('collapsed');
        arrow.style.transform = 'rotate(-90deg)';
    }
};

let groupSortable = null;
let endpointSortables = [];

function initSortable() {
    // Destroy existing instances to prevent duplicates
    endpointSortables.forEach(s => s.destroy());
    endpointSortables = [];

    if (groupSortable) {
        groupSortable.destroy();
        groupSortable = null;
    }

    // Common config for endpoint dragging
    const endpointConfig = {
        group: {
            name: 'endpoints',
            pull: true,
            put: true
        },
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onEnd: async (evt) => {
            console.log('Drag ended:', evt);
            await saveCurrentState();
        }
    };

    // Initialize Unassigned list
    if (unassignedList) {
        endpointSortables.push(new Sortable(unassignedList, endpointConfig));
    }

    // Initialize each group's sortable list
    document.querySelectorAll('#groups-list .sortable-list').forEach(list => {
        endpointSortables.push(new Sortable(list, endpointConfig));
    });

    // Initialize group reordering
    if (groupsList) {
        groupSortable = new Sortable(groupsList, {
            animation: 150,
            handle: '.group-title',
            ghostClass: 'sortable-ghost',
            onEnd: async () => {
                await saveCurrentState();
            }
        });
    }
}

async function saveCurrentState() {
    if (!currentProject || !projectsData[currentProject]) return;

    const gd = { unassigned: [] };

    // Get current IDs from Unassigned Col
    gd.unassigned = Array.from(unassignedList.children).map(c => c.dataset.id);

    const groupOrder = [];
    document.querySelectorAll('#groups-list .group-container').forEach(container => {
        const name = container.dataset.groupName;
        const list = container.querySelector('.sortable-list');
        if (name && list) {
            groupOrder.push(name);
            gd[name] = Array.from(list.children).map(c => c.dataset.id);
        }
    });

    projectsData[currentProject].groupsData = gd;
    projectsData[currentProject].groupOrder = groupOrder;
    await chrome.storage.local.set({ projectsData });
}

async function openEditor(id) {
    currentFingerprint = id;
    const meta = endpoints[id];
    if (!meta) {
        showToast('Endpoint metadata not found', 'error');
        return;
    }

    const fullData = await chrome.runtime.sendMessage({ action: 'GET_ENDPOINT', fingerprint: id });
    if (!fullData) {
        showToast('Failed to retrieve endpoint data', 'error');
        return;
    }

    placeholder.style.display = 'none';
    editor.style.display = 'block';
    editor.classList.remove('hidden');

    // Task: Auto-fill Title and Description if missing
    const defaultTitle = (meta.method.toUpperCase() + ' ' + (meta.normalizedPath.split('/').filter(Boolean).pop() || '/'));
    summaryInput.value = meta.summary || defaultTitle;

    // If it's a fresh detection, auto-suggest description
    if (!meta.description) {
        descInput.value = `Endpoint captured for ${meta.method.toUpperCase()} ${meta.normalizedPath}`;
    } else {
        descInput.value = meta.description;
    }

    pathInput.value = meta.normalizedPath;
    methodInput.value = meta.method;

    if (fullData.url) {
        try {
            envInput.value = new URL(fullData.url).origin;
        } catch(e) {
            envInput.value = "Unknown";
        }
    } else {
        envInput.value = meta.hostname || "Imported / Manual";
    }

    // Task: Handle Headers
    const capturedHeaders = fullData.reqHeaders || {};
    const savedHeaders = meta.overrides?.reqHeaders || capturedHeaders;
    headersInput.value = Object.keys(savedHeaders).length > 0 ? JSON.stringify(savedHeaders, null, 2) : '{}';

    let req;
    if (meta.overrides && meta.overrides.reqBody !== undefined) {
        req = meta.overrides.reqBody;
    } else {
        req = {
            query: fullData.queryParams || {},
            payload: fullData.reqBody || {}
        };
    }
    const res = meta.overrides?.resBody !== undefined ? meta.overrides.resBody : fullData.resBody;

    reqBodyInput.value = req ? JSON.stringify(req, null, 2) : '';
    resBodyInput.value = res ? JSON.stringify(res, null, 2) : '';
}

/**
 * Formats and validates JSON input in textareas.
 * @param {HTMLTextAreaElement} el - The textarea element.
 * @returns {boolean} - Returns true if valid JSON, false otherwise.
 */
function validateAndFormatJSON(el) {
    if (!el.value.trim()) {
        el.value = '{}';
        return true;
    }
    try {
        const obj = JSON.parse(el.value);
        el.value = JSON.stringify(obj, null, 2);
        el.classList.remove('border-red-500');
        el.classList.add('border-slate-700');
        return true;
    } catch (e) {
        el.classList.add('border-red-500');
        el.classList.remove('border-slate-700');
        return false;
    }
}

reqBodyInput.onblur = () => validateAndFormatJSON(reqBodyInput);
resBodyInput.onblur = () => validateAndFormatJSON(resBodyInput);

/**
 * Saves current endpoint changes to storage.
 */
headersInput.onblur = () => validateAndFormatJSON(headersInput);

/**
 * Saves current endpoint changes to storage.
 */
document.getElementById('save-endpoint-btn').onclick = async () => {
    if (!currentFingerprint) return;

    if (!validateAndFormatJSON(reqBodyInput) || !validateAndFormatJSON(resBodyInput) || !validateAndFormatJSON(headersInput)) {
        showToast('JSON format invalid. Please correct highlighting fields.', 'error');
        return;
    }

    try {
        const meta = endpoints[currentFingerprint];
        meta.summary = summaryInput.value;
        meta.description = descInput.value;

        const finalHeaders = JSON.parse(headersInput.value || '{}');

        meta.overrides = {
            reqBody: JSON.parse(reqBodyInput.value),
            resBody: JSON.parse(resBodyInput.value),
            reqHeaders: finalHeaders
        };
        await chrome.storage.local.set({ [`meta_${currentFingerprint}`]: meta });

        // Sync with UI
        renderAll();
        showToast('Endpoint saved successfully', 'success');
    } catch (e) {
        showToast('Failed to save: ' + e.message, 'error');
    }
};

async function performDeleteEndpoint(id, skipConfirmation = false) {
    if (!id) return;
    const meta = endpoints[id];
    if (!meta) return;

    if (!skipConfirmation && !confirm(`Delete endpoint: ${meta.method.toUpperCase()} ${meta.normalizedPath}?\nThis cannot be undone.`)) return;

    try {
        // 1. Storage Cleanup
        const keysToRemove = [`meta_${id}`];
        const res = await chrome.storage.local.get(`meta_${id}`);
        const actualMeta = res[`meta_${id}`];
        if (actualMeta && actualMeta.parts) {
            for (let i = 0; i < actualMeta.parts; i++) {
                keysToRemove.push(`${id}_part${i}`);
            }
        }
        await chrome.storage.local.remove(keysToRemove);

        // 2. State Cleanup
        delete endpoints[id];

        // 3. Project Structure Cleanup
        Object.keys(projectsData).forEach(host => {
            const proj = projectsData[host];
            if (proj.groupsData) {
                Object.keys(proj.groupsData).forEach(gn => {
                    proj.groupsData[gn] = proj.groupsData[gn].filter(fid => fid !== id);
                });
            }
        });

        if (currentFingerprint === id) {
            currentFingerprint = null;
            editor.classList.add('hidden');
            placeholder.style.display = 'flex';
        }
        return true;
    } catch (e) {
        console.error('Delete failed for ID:', id, e);
        return false;
    }
}

async function confirmDeleteEndpoint(id) {
    if (await performDeleteEndpoint(id)) {
        await chrome.storage.local.set({ projectsData });
        renderAll();
        showToast('Endpoint deleted', 'success');
    }
}

deleteEndpointBtn.onclick = () => confirmDeleteEndpoint(currentFingerprint);

document.getElementById('save-global-btn').onclick = async () => {
    if (!currentProject) return;
    projectsData[currentProject].global = {
        title: globalTitle.value,
        desc: globalDesc.value
    };
    await chrome.storage.local.set({ projectsData });
    showToast('Project configuration saved.', 'success');
};

deleteProjectBtn.onclick = async () => {
    if (!currentProject) {
        showToast('No site selected to delete', 'warning');
        return;
    }

    if (!confirm(`Are you sure you want to permanently delete the site "${currentProject}" and ALL its endpoints? This cannot be undone.`)) {
        return;
    }

    try {
        // Collect all fingerprints associated with this project
        const projectFingerprints = Object.keys(endpoints).filter(id => 
            endpoints[id].hostname === currentProject || (!endpoints[id].hostname && currentProject === 'others')
        );

        // Delete all associated endpoints
        for (const id of projectFingerprints) {
            await performDeleteEndpoint(id, true);
        }

        // Delete project metadata
        delete projectsData[currentProject];

        // Save state
        await chrome.storage.local.set({ projectsData });

        // Select next available project or reset
        const remaining = Object.keys(projectsData);
        if (remaining.length > 0) {
            currentProject = remaining[0];
            projectSelector.value = currentProject;
            updateProjectSelector();
            selectProject(currentProject);
        } else {
            currentProject = '';
            updateProjectSelector();
            globalTitle.value = '';
            globalDesc.value = '';
            renderAll();
        }

        showToast('Site deleted successfully', 'success');
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        showToast('Error deleting project: ' + e.message, 'error');
        console.error(e);
    }
};

// Debounce helper for group creation
let createGroupDebounce = false;

document.getElementById('create-group-btn').onclick = async () => {
    if (createGroupDebounce) return;
    if (!currentProject || !projectsData[currentProject]) return;

    createGroupDebounce = true;
    setTimeout(() => createGroupDebounce = false, 1000);

    const name = prompt('New Group Name: \n(e.g., Authentications, Users, Payment...)');
    if (name) {
        if (!projectsData[currentProject].groupsData) {
            projectsData[currentProject].groupsData = { unassigned: [] };
        }
        if (!projectsData[currentProject].groupsData[name]) {
            projectsData[currentProject].groupsData[name] = [];

            // Ensure groupOrder exists and append the new group
            if (!projectsData[currentProject].groupOrder) {
                projectsData[currentProject].groupOrder = Object.keys(projectsData[currentProject].groupsData).filter(k => k !== 'unassigned');
            } else if (!projectsData[currentProject].groupOrder.includes(name)) {
                projectsData[currentProject].groupOrder.push(name);
            }

            // Sync visual and storage
            renderAll();
            await saveCurrentState();
            showToast(`Group "${name}" created successfully`, 'success');
        } else {
            showToast('A group with this name already exists.', 'warning');
        }
    }
};

window.editGroupName = async (oldName) => {
    const newName = prompt('Rename Group:', oldName);
    if (newName && newName !== oldName) {
        const proj = projectsData[currentProject];
        
        if (proj.groupsData[newName]) {
            showToast('A group with this name already exists.', 'warning');
            return;
        }

        proj.groupsData[newName] = proj.groupsData[oldName];
        delete proj.groupsData[oldName];
        
        if (proj.groupOrder) {
            const idx = proj.groupOrder.indexOf(oldName);
            if (idx !== -1) {
                proj.groupOrder[idx] = newName;
            }
        }

        await chrome.storage.local.set({ projectsData });
        renderAll();
        showToast('Group renamed successfully', 'success');
    }
};

window.deleteGroup = async (name) => {
    if (!currentProject || !projectsData[currentProject]) {
        showToast('No project selected', 'warning');
        return;
    }

    if (name === 'unassigned') {
        showToast('Cannot delete Unassigned list', 'error');
        return;
    }

    if (!confirm(`Delete group "${name}"?\n(Confirm again to choose whether to delete endpoints inside)`)) {
        return;
    }

    const alsoDeleteEndpoints = confirm(`Also delete all endpoints inside "${name}" permanently?\n\n- [OK] Delete group AND its endpoints.\n- [Cancel] Delete group ONLY (move endpoints to Unassigned).`);

    try {
        const proj = projectsData[currentProject];
        const items = proj.groupsData[name] || [];

        if (alsoDeleteEndpoints) {
            // Option A: Cascade deletion
            for (const id of items) {
                await performDeleteEndpoint(id, true); // true = skip individual confirmation
            }
        } else {
            // Option B: Move to unassigned
            if (!proj.groupsData.unassigned) {
                proj.groupsData.unassigned = [];
            }
            proj.groupsData.unassigned.push(...items);
        }

        // Remove group from data
        delete proj.groupsData[name];

        // Final State Persistence
        await chrome.storage.local.set({ projectsData });
        renderAll();

        showToast(`Group "${name}" deleted successfully`, 'success');
    } catch (e) {
        showToast('Error deleting group: ' + e.message, 'error');
        console.error(e);
    }
};

function generateSchema(data) {
    if (data === null) return { type: "object", nullable: true };
    const type = typeof data;
    if (type === 'string') return { type: "string" };
    if (type === 'number') return { type: "number" };
    if (type === 'boolean') return { type: "boolean" };
    if (Array.isArray(data)) {
        return {
            type: "array",
            items: data.length > 0 ? generateSchema(data[0]) : {}
        };
    }
    if (type === 'object') {
        const properties = {};
        Object.entries(data).forEach(([key, value]) => {
            properties[key] = generateSchema(value);
        });
        return { type: "object", properties };
    }
    return {};
}

document.getElementById('export-btn').onclick = async () => {
    const proj = projectsData[currentProject];
    const spec = {
        openapi: "3.0.0",
        info: { 
            title: proj.global.title || "API Documentation", 
            description: proj.global.desc || "", 
            version: "1.0.0" 
        },
        paths: {}
    };

    const groupOrder = proj.groupOrder || Object.keys(proj.groupsData).filter(k => k !== 'unassigned');
    spec.tags = groupOrder.map(name => ({ name }));

    for (const groupName of groupOrder) {
        const ids = proj.groupsData[groupName] || [];
        for (const fingerprint of ids) {
            const meta = endpoints[fingerprint];
            if (!meta) continue;

            const fullData = await chrome.runtime.sendMessage({ action: 'GET_ENDPOINT', fingerprint });
            if (!fullData) {
                console.warn("Skipping corrupted endpoint data during export:", fingerprint);
                continue;
            }

            // Extract and sanitize hostname for variable naming
            let host = currentProject;
            let origin = `https://${currentProject}`;
            if (fullData.url) {
                try {
                    const u = new URL(fullData.url);
                    host = u.hostname;
                    origin = u.origin;
                } catch(e) {}
            }
            const envVarName = host.replace(/[^a-zA-Z0-9]/g, '_');

            const path = meta.normalizedPath.startsWith('/') ? meta.normalizedPath : '/' + meta.normalizedPath;
            const method = meta.method.toLowerCase();

            if (!spec.paths[path]) spec.paths[path] = {};

            const tag = groupName;

            // Security detection logic per hostname
            const finalHeaders = meta.overrides?.reqHeaders || fullData.reqHeaders || {};
            const endpointSecurity = [];
            Object.entries(finalHeaders).forEach(([h, v]) => {
                const key = h.toLowerCase();
                const val = String(v).toLowerCase();
                if (key === 'authorization' && val.startsWith('bearer ')) {
                    if (!spec.components) spec.components = { securitySchemes: {} };
                    const schemeId = `BearerAuth_${envVarName}`;
                    spec.components.securitySchemes[schemeId] = { type: 'http', scheme: 'bearer' };
                    endpointSecurity.push({ [schemeId]: [] });
                } else if (key === 'x-api-key' || key === 'apikey') {
                    if (!spec.components) spec.components = { securitySchemes: {} };
                    const baseSchemeName = key.replace(/[^a-zA-Z]/g, '') + 'Auth';
                    const schemeId = `${baseSchemeName}_${envVarName}`;
                    spec.components.securitySchemes[schemeId] = { type: 'apiKey', in: 'header', name: key };
                    endpointSecurity.push({ [schemeId]: [] });
                }
            });

            const finalReq = meta.overrides?.reqBody || { query: fullData.queryParams, payload: fullData.reqBody };
            const finalRes = meta.overrides?.resBody || fullData.resBody;

            const endpointSpec = {
                summary: meta.summary || (method.toUpperCase() + ' ' + (path.split('/').filter(Boolean).pop() || '/')),
                description: meta.description || '',
                tags: [tag],
                parameters: [],
                servers: [{
                    url: `{${envVarName}}`,
                    variables: {
                        [envVarName]: {
                            default: origin,
                            description: `Base URL for ${host}`
                        }
                    }
                }],
                responses: {
                    "200": {
                        description: "OK",
                        content: {
                            "application/json": {
                                schema: generateSchema(finalRes)
                            }
                        }
                    }
                }
            };

            if (endpointSecurity.length > 0) {
                endpointSpec.security = endpointSecurity;
            }

            // Add query parameters
            if (finalReq.query && typeof finalReq.query === 'object') {
                Object.keys(finalReq.query).forEach(name => {
                    endpointSpec.parameters.push({
                        name: name,
                        in: "query",
                        schema: generateSchema(finalReq.query[name])
                    });
                });
            }

            // Add request body for non-GET methods
            if (method !== 'get' && finalReq.payload) {
                endpointSpec.requestBody = {
                    content: {
                        "application/json": {
                            schema: generateSchema(finalReq.payload)
                        }
                    }
                };
            }

            spec.paths[path][method] = endpointSpec;
        }
    }

    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject}_api_docs.json`;
    a.click();
};

document.getElementById('import-btn').onclick = () => {
    document.getElementById('import-file-input').click();
};

document.getElementById('import-file-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const fileContent = await file.text();
        let spec;
        
        // Try to parse as JSON first, then YAML
        try {
            spec = JSON.parse(fileContent);
        } catch (e) {
            // If JSON fails, try YAML (simple parsing for basic YAML)
            showToast('JSON parsing successful. YAML support coming soon.', 'info');
            spec = JSON.parse(fileContent);
        }

        // Validate the spec
        const validation = validateOpenAPISpec(spec);
        if (!validation.valid) {
            showToast(`Import failed: ${validation.errors.join(', ')}`, 'error');
            return;
        }

        // Parse the OpenAPI spec
        const importedEndpoints = parseOpenAPISpec(spec);
        if (importedEndpoints.length === 0) {
            showToast('No endpoints found in the specification', 'warning');
            return;
        }

        // Get the project name from the spec or use current project
        const projectName = currentProject || spec.info?.title || 'Imported API';
        
        // Convert to storage format
        const { endpointsMap, groupsData } = convertToStorageFormat(importedEndpoints, projectName);

        // Get current data
        const currentData = await chrome.storage.local.get(null);
        
        // Merge with existing endpoints
        const mergedData = { ...currentData, ...endpointsMap };

        // Merge group data
        if (!projectsData[projectName]) {
            projectsData[projectName] = { 
                groupsData: { unassigned: [] }, 
                global: { title: spec.info?.title || projectName, desc: spec.info?.description || '' },
                groupOrder: []
            };
        }
        
        // Add new endpoints by group
        Object.keys(groupsData).forEach(groupName => {
            if (!projectsData[projectName].groupsData[groupName]) {
                projectsData[projectName].groupsData[groupName] = [];
            }
            
            const currentGroupEndpoints = projectsData[projectName].groupsData[groupName];
            projectsData[projectName].groupsData[groupName] = [...currentGroupEndpoints, ...groupsData[groupName]];
            
            // Update groupOrder for new groups
            if (groupName !== 'unassigned') {
                if (!projectsData[projectName].groupOrder) {
                    projectsData[projectName].groupOrder = Object.keys(projectsData[projectName].groupsData).filter(k => k !== 'unassigned');
                } else if (!projectsData[projectName].groupOrder.includes(groupName)) {
                    projectsData[projectName].groupOrder.push(groupName);
                }
            }
        });

        // Save to storage
        mergedData.projectsData = projectsData;
        await chrome.storage.local.set(mergedData);

        // Reload the dashboard
        await load();
        projectSelector.value = projectName;
        currentProject = projectName;
        selectProject(projectName);

        showToast(`Successfully imported ${importedEndpoints.length} endpoints!`, 'success');
    } catch (error) {
        console.error('Import error:', error);
        showToast(`Import failed: ${error.message}`, 'error');
    }

    // Reset the file input
    e.target.value = '';
};

document.getElementById('refresh-btn').onclick = async () => {
    await load();
    showToast('Dashboard data refreshed', 'success');
};

window.toggleCheckbox = function(event) {
    const checkedBoxes = document.querySelectorAll('.endpoint-checkbox:checked');
    const totalBoxes = document.querySelectorAll('.endpoint-checkbox');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    const masterCheckbox = document.getElementById('master-checkbox');
    
    // Update Delete Selected button visibility
    if (deleteSelectedBtn) {
        if (checkedBoxes.length > 0) {
            deleteSelectedBtn.classList.remove('hidden');
        } else {
            deleteSelectedBtn.classList.add('hidden');
        }
    }

    // Update Master Checkbox state
    if (masterCheckbox) {
        if (checkedBoxes.length === 0) {
            masterCheckbox.checked = false;
            masterCheckbox.indeterminate = false;
        } else if (checkedBoxes.length === totalBoxes.length) {
            masterCheckbox.checked = true;
            masterCheckbox.indeterminate = false;
        } else {
            masterCheckbox.checked = false;
            masterCheckbox.indeterminate = true;
        }
    }
};

// Master Checkbox Logic
const masterCheckbox = document.getElementById('master-checkbox');
if (masterCheckbox) {
    masterCheckbox.onchange = (e) => {
        const isChecked = e.target.checked;
        const allCheckboxes = document.querySelectorAll('.endpoint-checkbox');
        allCheckboxes.forEach(cb => cb.checked = isChecked);
        window.toggleCheckbox();
    };
}

// Delete Selected Button Logic
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
if (deleteSelectedBtn) {
    deleteSelectedBtn.onclick = async () => {
        const checkedBoxes = document.querySelectorAll('.endpoint-checkbox:checked');
        if (checkedBoxes.length === 0) return;
        
        if (!confirm(`Delete ${checkedBoxes.length} selected endpoints?\nThis cannot be undone.`)) return;
        
        let deletedCount = 0;
        for (const box of checkedBoxes) {
            const id = box.dataset.id;
            await performDeleteEndpoint(id, true);
            deletedCount++;
        }
        
        await chrome.storage.local.set({ projectsData });
        renderAll();
        showToast(`Deleted ${deletedCount} endpoints`, 'success');
        deleteSelectedBtn.classList.add('hidden');
        if (masterCheckbox) {
            masterCheckbox.checked = false;
            masterCheckbox.indeterminate = false;
        }
    };
}

// Delete All Button Logic
const deleteAllBtn = document.getElementById('delete-all-btn');
if (deleteAllBtn) {
    deleteAllBtn.onclick = async () => {
        if (!currentProject || !projectsData[currentProject]) return;
        
        const unassignedItems = projectsData[currentProject].groupsData.unassigned || [];
        if (unassignedItems.length === 0) {
            showToast('No unassigned endpoints to delete.', 'info');
            return;
        }
        
        if (!confirm(`Are you sure you want to permanently delete ALL ${unassignedItems.length} unassigned endpoints?`)) return;
        
        for(const id of unassignedItems) {
            await performDeleteEndpoint(id, true);
        }
        
        await chrome.storage.local.set({ projectsData });
        renderAll();
        showToast('All unassigned endpoints have been permanently deleted', 'success');
        if (deleteSelectedBtn) deleteSelectedBtn.classList.add('hidden');
        if (masterCheckbox) {
            masterCheckbox.checked = false;
            masterCheckbox.indeterminate = false;
        }
    };
}

load();
