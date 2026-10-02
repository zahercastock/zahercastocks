// ==========================================
// ZAHERCASTOCKS - JAVASCRIPT PRINCIPAL (MODO NOCTURNO)
// ZAHERCA CONSTRUCCIONES (RIF J-30015660-5)
// ==========================================

// --- UTILIDADES GLOBALES (TOAST Y MODALES) ---
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    const icons = {
        success: '<i class="fa-solid fa-circle-check text-emerald-400 text-lg"></i>',
        error: '<i class="fa-solid fa-circle-xmark text-rose-400 text-lg"></i>',
        warning: '<i class="fa-solid fa-triangle-exclamation text-amber-400 text-lg"></i>',
        info: '<i class="fa-solid fa-circle-info text-red-400 text-lg"></i>'
    };

    const borders = {
        success: 'border-emerald-700/60 bg-[#111827]',
        error: 'border-rose-700/60 bg-[#111827]',
        warning: 'border-amber-700/60 bg-[#111827]',
        info: 'border-red-700/60 bg-[#111827]'
    };

    toast.className = `p-4 rounded-2xl shadow-2xl border ${borders[type] || borders.info} text-white flex items-center gap-3 animate-in slide-in-from-top-2 duration-200 pointer-events-auto`;
    toast.innerHTML = `
        <div class="shrink-0">${icons[type] || icons.info}</div>
        <div class="text-xs font-semibold flex-1 leading-snug text-slate-100">${message}</div>
        <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white text-sm shrink-0">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("opacity-0", "transition-opacity", "duration-300");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");

        // Si es el modal de salida, poblar selectores
        if (id === "modal-checkout") {
            loadEquipmentDropdown();
            loadEmployeeDropdown();
        }
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    }
}

// Cerrar modal al presionar ESC o clic afuera
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        document.querySelectorAll("[id^='modal-']:not(.hidden)").forEach(m => closeModal(m.id));
    }
});

// --- CONECTAR CELULAR MODAL ---
async function openConnectMobileModal() {
    openModal("modal-connect-mobile");
    const linkEl = document.getElementById("connect-mobile-link-text");
    const qrImg = document.getElementById("connect-mobile-qr-img");
    
    if (qrImg) qrImg.src = "/api/tunnel-qr?t=" + Date.now();
    if (linkEl) linkEl.textContent = "Obteniendo enlace seguro HTTPS...";

    try {
        const res = await fetch("/api/tunnel-info");
        const data = await res.json();
        if (data.url && linkEl) {
            linkEl.textContent = data.url;
        } else if (linkEl) {
            linkEl.textContent = "http://" + window.location.host;
        }
    } catch (e) {
        if (linkEl) linkEl.textContent = "http://" + window.location.host;
    }
}

// --- POBLAR SELECTORES DEL FORMULARIO DE SALIDA ---
async function loadEquipmentDropdown(selectedCode = null) {
    const select = document.getElementById("checkout-equipment-code");
    if (!select) return;

    select.innerHTML = '<option value="">Cargando herramientas...</option>';

    try {
        const res = await fetch("/api/equipment");
        const equipments = await res.json();

        if (equipments.length === 0) {
            select.innerHTML = '<option value="">No hay herramientas registradas</option>';
            return;
        }

        const avail = equipments.filter(e => e.status === "DISPONIBLE");
        const unavail = equipments.filter(e => e.status !== "DISPONIBLE");

        let html = '<option value="">-- Selecciona una herramienta --</option>';

        if (avail.length > 0) {
            html += '<optgroup label="🟢 HERRAMIENTAS DISPONIBLES">';
            avail.forEach(e => {
                const isSel = selectedCode && selectedCode.toUpperCase() === e.code.toUpperCase() ? 'selected' : '';
                html += `<option value="${e.code}" ${isSel}>${e.code} - ${e.name} (${e.category})</option>`;
            });
            html += '</optgroup>';
        }

        if (unavail.length > 0) {
            html += '<optgroup label="🔴 NO DISPONIBLES (En uso / Taller)">';
            unavail.forEach(e => {
                const statusTxt = e.status === 'EN_USO' ? 'EN USO' : e.status;
                html += `<option value="${e.code}" disabled>${e.code} - ${e.name} [${statusTxt}]</option>`;
            });
            html += '</optgroup>';
        }

        select.innerHTML = html;

        if (selectedCode) {
            select.value = selectedCode;
        }

    } catch (e) {
        select.innerHTML = '<option value="">Error al cargar herramientas</option>';
    }
}

async function loadEmployeeDropdown() {
    const select = document.getElementById("checkout-employee-id");
    if (!select) return;

    try {
        const res = await fetch("/api/employees");
        const employees = await res.json();

        if (employees.length === 0) {
            select.innerHTML = '<option value="">No hay empleados registrados</option>';
            return;
        }

        select.innerHTML = '<option value="">-- Selecciona el empleado responsable --</option>' +
            employees.map(emp => `
                <option value="${emp.id}">${emp.full_name} (${emp.doc_id}) - ${emp.role}</option>
            `).join('');

    } catch (e) {
        select.innerHTML = '<option value="">Error al cargar empleados</option>';
    }
}

// --- ESCÁNER RÁPIDO PARA VENTANA DE SALIDA ---
let quickScannerInstance = null;

async function openQuickCheckoutScanner() {
    openModal("modal-quick-scan");
    try {
        quickScannerInstance = new Html5Qrcode("quick-reader");
        await quickScannerInstance.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 190, height: 190 } },
            (decodedText) => {
                playBeepSound();
                closeQuickCheckoutScanner();

                const select = document.getElementById("checkout-equipment-code");
                if (select) {
                    const cleanCode = decodedText.trim().toUpperCase();
                    let found = false;
                    for (let opt of select.options) {
                        if (opt.value.toUpperCase() === cleanCode) {
                            select.value = opt.value;
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        loadEquipmentDropdown(cleanCode);
                    }
                    showToast(`Herramienta detectada: ${cleanCode}`, "success");
                }
            },
            () => {}
        );
    } catch (e) {
        showToast("No se pudo iniciar la cámara para el escaneo rápido", "error");
    }
}

function closeQuickCheckoutScanner() {
    if (quickScannerInstance) {
        try {
            quickScannerInstance.stop().then(() => {
                quickScannerInstance = null;
                closeModal("modal-quick-scan");
            });
        } catch(e) {
            closeModal("modal-quick-scan");
        }
    } else {
        closeModal("modal-quick-scan");
    }
}

function playBeepSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 900;
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
}


// --- DASHBOARD LOGIC ---
async function loadDashboardStats() {
    try {
        const res = await fetch("/api/stats");
        const data = await res.json();

        // Contadores
        const totalEl = document.getElementById("stat-total");
        const availEl = document.getElementById("stat-available");
        const inUseEl = document.getElementById("stat-in-use");
        const overdueEl = document.getElementById("stat-overdue");
        const maintEl = document.getElementById("stat-maintenance");

        if (totalEl) totalEl.textContent = data.total_equipment;
        if (availEl) availEl.textContent = data.available;
        if (inUseEl) inUseEl.textContent = data.in_use;
        if (overdueEl) overdueEl.textContent = data.overdue_loans;
        if (maintEl) maintEl.textContent = data.maintenance;

        // Renderizar Préstamos Activos
        const loansContainer = document.getElementById("active-loans-container");
        if (loansContainer) {
            if (data.active_loans.length === 0) {
                loansContainer.innerHTML = `
                    <div class="text-center py-10 bg-[#182235] rounded-xl border border-dashed border-slate-700">
                        <i class="fa-solid fa-circle-check text-emerald-400 text-3xl mb-2"></i>
                        <p class="text-sm font-semibold text-white">No hay salidas activas en este momento.</p>
                        <p class="text-xs text-slate-400">Todas las herramientas están disponibles en depósito.</p>
                    </div>
                `;
            } else {
                loansContainer.innerHTML = data.active_loans.map(loan => {
                    const isOverdue = loan.status === "ATRASADO";
                    const isMaint = loan.movement_type === "MANTENIMIENTO";

                    return `
                        <div class="p-4 rounded-xl border ${isOverdue ? 'border-red-600/80 bg-red-950/30' : (isMaint ? 'border-amber-700/60 bg-amber-950/20' : 'border-slate-800 bg-[#182235]')} flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-slate-700">
                            <div class="space-y-1">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-black uppercase px-2 py-0.5 rounded ${isOverdue ? 'bg-red-950 text-red-300 border border-red-800' : (isMaint ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-red-950 text-red-300 border border-red-800/60')}">${loan.equipment_code}</span>
                                    <span class="font-bold text-sm text-white">${loan.equipment_name}</span>
                                </div>
                                <div class="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span><i class="fa-solid fa-user text-red-400 mr-1"></i><b>${loan.employee_name}</b></span>
                                    <span><i class="fa-solid fa-location-dot text-red-400 mr-1"></i>${loan.destination_project || 'General'}</span>
                                    <span class="${isOverdue ? 'text-red-400 font-bold' : 'text-slate-400'}">
                                        <i class="fa-solid fa-calendar-day mr-1"></i>Límite: ${loan.expected_return_date || 'No especificada'}
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 self-end sm:self-center">
                                ${isOverdue ? '<span class="text-xs font-black text-red-400 bg-red-950 border border-red-700 px-2 py-1 rounded-lg animate-pulse">¡ATRASADO!</span>' : ''}
                                ${isMaint ? '<span class="text-xs font-black text-amber-400 bg-amber-950 border border-amber-800 px-2 py-1 rounded-lg">TALLER</span>' : ''}
                                <button onclick="openCheckinModal(${loan.id})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95">
                                    <i class="fa-solid fa-arrow-down-left-and-up-right-to-center"></i> Devolver
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Renderizar Categorías
        const catContainer = document.getElementById("categories-container");
        if (catContainer) {
            const maxCount = Math.max(...data.categories.map(c => c.count), 1);
            catContainer.innerHTML = data.categories.map(cat => {
                const pct = Math.round((cat.count / maxCount) * 100);
                return `
                    <div class="space-y-1">
                        <div class="flex justify-between text-xs font-semibold">
                            <span class="text-slate-300">${cat.category}</span>
                            <span class="text-white font-bold">${cat.count}</span>
                        </div>
                        <div class="w-full bg-[#182235] rounded-full h-2 overflow-hidden border border-slate-700">
                            <div class="bg-red-600 h-2 rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Renderizar actividad reciente
        const activityContainer = document.getElementById("recent-activity-container");
        if (activityContainer) {
            if (data.recent_movements.length === 0) {
                activityContainer.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs">Aún no hay movimientos registrados.</div>`;
            } else {
                activityContainer.innerHTML = data.recent_movements.map(m => {
                    const isCheckout = m.status === "ACTIVO" || m.status === "ATRASADO";
                    const isMaint = m.movement_type === "MANTENIMIENTO";
                    const isAlta = m.movement_type === "ALTA_INVENTARIO";
                    const isBaja = m.movement_type === "BAJA_INVENTARIO";

                    let iconClass = "fa-arrow-up-right-from-square";
                    let badgeColor = "bg-red-950 text-red-400 border border-red-800";
                    let actionText = "";

                    if (isAlta) {
                        iconClass = "fa-plus";
                        badgeColor = "bg-emerald-950 text-emerald-400 border border-emerald-800";
                        actionText = `registró en inventario <span class="font-semibold text-emerald-400">${m.equipment_name}</span> (${m.equipment_code})`;
                    } else if (isBaja) {
                        iconClass = "fa-trash";
                        badgeColor = "bg-slate-900 text-slate-400 border border-slate-700";
                        actionText = `desincorporó / eliminó <span class="font-semibold text-slate-300">${m.equipment_name}</span> (${m.equipment_code})`;
                    } else if (isMaint) {
                        iconClass = isCheckout ? "fa-wrench" : "fa-circle-check";
                        badgeColor = isCheckout ? "bg-amber-950 text-amber-400 border border-amber-800" : "bg-emerald-950 text-emerald-400 border border-emerald-800";
                        actionText = isCheckout 
                            ? `envió a taller <span class="font-semibold text-amber-400">${m.equipment_name}</span> (${m.equipment_code})`
                            : `recibió de taller <span class="font-semibold text-emerald-400">${m.equipment_name}</span> (${m.equipment_code})`;
                    } else {
                        iconClass = isCheckout ? "fa-arrow-up-right-from-square" : "fa-arrow-down-left-and-up-right-to-center";
                        badgeColor = isCheckout ? "bg-red-950 text-red-400 border border-red-800" : "bg-emerald-950 text-emerald-400 border border-emerald-800";
                        actionText = isCheckout 
                            ? `retiró en préstamo <span class="font-semibold text-red-400">${m.equipment_name}</span> (${m.equipment_code})`
                            : `devolvió <span class="font-semibold text-emerald-400">${m.equipment_name}</span> (${m.equipment_code})`;
                    }

                    return `
                        <div class="flex items-start gap-3 text-xs py-2 border-b border-slate-800 last:border-0">
                            <div class="w-7 h-7 rounded-lg ${badgeColor} flex items-center justify-center font-bold shrink-0">
                                <i class="fa-solid ${iconClass}"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-slate-200">
                                    <span class="font-bold text-white">${m.employee_name}</span> ${actionText}
                                </p>
                                <p class="text-[11px] text-slate-400 mt-0.5">
                                    ${(isAlta || isBaja) ? 'Fecha: ' + m.checkout_date : (isCheckout ? 'Salida: ' + m.checkout_date : 'Devuelto: ' + m.return_date)} · Destino: ${m.destination_project}
                                </p>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

    } catch (e) {
        console.error("Error al cargar dashboard:", e);
    }
}


// --- INVENTORY LOGIC ---
async function loadInventoryDynamicFilters() {
    const catSelect = document.getElementById("inv-filter-category");
    const locSelect = document.getElementById("inv-filter-location");

    const currentCat = catSelect ? catSelect.value : "TODAS";
    const currentLoc = locSelect ? locSelect.value : "TODAS";

    try {
        const [catsRes, locsRes] = await Promise.all([
            fetch("/api/equipment/categories"),
            fetch("/api/equipment/locations")
        ]);

        if (catSelect && catsRes.ok) {
            const categories = await catsRes.json();
            let html = '<option value="TODAS">📁 Todas las Categorías</option>';
            categories.forEach(cat => {
                const isSel = currentCat === cat ? 'selected' : '';
                html += `<option value="${cat}" ${isSel}>📁 ${cat}</option>`;
            });
            catSelect.innerHTML = html;
        }

        if (locSelect && locsRes.ok) {
            const locations = await locsRes.json();
            let html = '<option value="TODAS">📍 Todas las Ubicaciones</option>';
            locations.forEach(loc => {
                const isSel = currentLoc === loc ? 'selected' : '';
                html += `<option value="${loc}" ${isSel}>📍 ${loc}</option>`;
            });
            locSelect.innerHTML = html;
        }
    } catch (e) {
        console.error("Error al cargar filtros dinámicos:", e);
    }
}

// Alias para compatibilidad
const loadInventoryLocations = loadInventoryDynamicFilters;

function resetInventoryFilters() {
    const searchInput = document.getElementById("inv-search");
    const catSelect = document.getElementById("inv-filter-category");
    const statusSelect = document.getElementById("inv-filter-status");
    const locSelect = document.getElementById("inv-filter-location");

    if (searchInput) searchInput.value = "";
    if (catSelect) catSelect.value = "TODAS";
    if (statusSelect) statusSelect.value = "TODOS";
    if (locSelect) locSelect.value = "TODAS";

    loadInventory();
}

async function loadInventory() {
    const tbody = document.getElementById("inventory-table-body");
    if (!tbody) return;

    const q = document.getElementById("inv-search")?.value || "";
    const category = document.getElementById("inv-filter-category")?.value || "TODAS";
    const status = document.getElementById("inv-filter-status")?.value || "TODOS";
    const location = document.getElementById("inv-filter-location")?.value || "TODAS";

    const params = new URLSearchParams();
    if (q.trim()) params.append("search", q.trim());
    if (category && category !== "TODAS") params.append("category", category);
    if (status && status !== "TODOS") params.append("status", status);
    if (location && location !== "TODAS") params.append("location", location);

    try {
        const res = await fetch(`/api/equipment?${params.toString()}`);
        const equipments = await res.json();

        if (equipments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-12 text-center text-slate-500">
                        <i class="fa-solid fa-filter-circle-xmark text-2xl text-slate-600 mb-2 block"></i>
                        <p class="font-semibold text-slate-400">No se encontraron herramientas con los filtros seleccionados.</p>
                        <button onclick="resetInventoryFilters()" class="mt-2 text-xs text-red-400 hover:text-red-300 font-bold underline">Limpiar filtros de búsqueda</button>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = equipments.map(eq => {
            let statusBadge = "";
            if (eq.status === "DISPONIBLE") {
                statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Disponible</span>';
            } else if (eq.status === "EN_USO") {
                statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-950 text-blue-300 border border-blue-800/60"><span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>En Uso</span>';
            } else if (eq.status === "MANTENIMIENTO") {
                statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800/60"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Mantenimiento</span>';
            } else if (eq.status === "DANADO") {
                statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800/60"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>Dañado</span>';
            } else if (eq.status === "BAJA") {
                statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-slate-400 border border-slate-800"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>De Baja</span>';
            } else {
                statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300">${eq.status}</span>`;
            }

            return `
                <tr class="hover:bg-[#182235]/60 transition-colors">
                    <td class="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                        <button onclick="viewQR(${eq.id})" class="inline-flex items-center gap-1.5 hover:text-red-400 text-white group" title="Ver código QR">
                            <i class="fa-solid fa-qrcode text-red-500 text-base group-hover:scale-110 transition-transform"></i>
                            <span class="underline decoration-slate-600 underline-offset-2 font-mono">${eq.code}</span>
                        </button>
                    </td>
                    <td class="py-3.5 px-4">
                        <div class="font-bold text-white">${eq.name}</div>
                        <div class="text-xs text-slate-400">${eq.brand || ''} ${eq.model ? '· ' + eq.model : ''} ${eq.serial_number ? '· SN: ' + eq.serial_number : ''}</div>
                    </td>
                    <td class="py-3.5 px-4 text-xs font-medium text-slate-300">${eq.category}</td>
                    <td class="py-3.5 px-4 text-xs text-slate-300">
                        <span class="inline-flex items-center gap-1 text-slate-300">
                            <i class="fa-solid fa-location-dot text-red-400/80 text-[11px]"></i>
                            ${eq.location}
                        </span>
                    </td>
                    <td class="py-3.5 px-4">${statusBadge}</td>
                    <td class="py-3.5 px-4 text-xs text-slate-300">${eq.condition}</td>
                    <td class="py-3.5 px-4 text-right whitespace-nowrap">
                        <div class="inline-flex items-center gap-1">
                            ${eq.status === 'DISPONIBLE' ? `
                                <button onclick="openCheckoutForCode('${eq.code}')" class="p-1.5 text-red-400 hover:bg-red-950/60 rounded-lg transition-all" title="Prestar">
                                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                </button>
                            ` : ''}
                            <button onclick="openEditEquipmentModal(${eq.id})" class="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="Editar">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="deleteEquipment(${eq.id})" class="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded-lg transition-all" title="Eliminar">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-rose-400">Error al cargar inventario.</td></tr>`;
    }
}

// --- CREAR / EDITAR EQUIPO ---
function openCreateEquipmentModal() {
    document.getElementById("modal-equipment-title").textContent = "Nuevo Equipo / Herramienta";
    document.getElementById("eq-edit-id").value = "";
    document.getElementById("form-equipment").reset();
    document.getElementById("eq-code").readOnly = false;
    openModal("modal-equipment");
}

async function openEditEquipmentModal(id) {
    try {
        const res = await fetch(`/api/equipment/${id}`);
        const eq = await res.json();

        document.getElementById("modal-equipment-title").textContent = "Editar Equipo";
        document.getElementById("eq-edit-id").value = eq.id;
        document.getElementById("eq-code").value = eq.code;
        document.getElementById("eq-code").readOnly = true;
        document.getElementById("eq-name").value = eq.name;
        document.getElementById("eq-category").value = eq.category;
        document.getElementById("eq-brand").value = eq.brand || "";
        document.getElementById("eq-model").value = eq.model || "";
        document.getElementById("eq-serial").value = eq.serial_number || "";
        document.getElementById("eq-location").value = eq.location;
        document.getElementById("eq-status").value = eq.status;
        document.getElementById("eq-condition").value = eq.condition;
        document.getElementById("eq-notes").value = eq.notes || "";

        openModal("modal-equipment");
    } catch (e) {
        showToast("Error al cargar datos del equipo", "error");
    }
}

async function submitEquipmentForm(e) {
    e.preventDefault();
    const editId = document.getElementById("eq-edit-id").value;

    const payload = {
        code: document.getElementById("eq-code").value.trim(),
        name: document.getElementById("eq-name").value.trim(),
        category: document.getElementById("eq-category").value,
        brand: document.getElementById("eq-brand").value.trim(),
        model: document.getElementById("eq-model").value.trim(),
        serial_number: document.getElementById("eq-serial").value.trim(),
        location: document.getElementById("eq-location").value.trim(),
        status: document.getElementById("eq-status").value,
        condition: document.getElementById("eq-condition").value,
        notes: document.getElementById("eq-notes").value.trim()
    };

    try {
        let url = "/api/equipment";
        let method = "POST";

        if (editId) {
            url = `/api/equipment/${editId}`;
            method = "PUT";
        }

        const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.detail || "Error al guardar el equipo", "error");
            return;
        }

        showToast(data.message, "success");
        closeModal("modal-equipment");
        loadInventory();
        loadInventoryLocations();
        loadDashboardStats();
    } catch (e) {
        showToast("Error de conexión al servidor", "error");
    }
}

async function deleteEquipment(id) {
    if (!confirm("¿Estás seguro de eliminar este equipo? El historial de movimientos quedará preservado de forma permanente.")) return;

    try {
        const res = await fetch(`/api/equipment/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, "success");
            loadInventory();
            loadInventoryLocations();
            loadDashboardStats();
        } else {
            showToast(data.detail || "No se pudo eliminar", "error");
        }
    } catch (e) {
        showToast("Error de red", "error");
    }
}

// --- VER / IMPRIMIR QR ---
async function viewQR(id) {
    openModal("modal-qr");
    const codeEl = document.getElementById("modal-qr-code");
    const nameEl = document.getElementById("modal-qr-name");
    const imgEl = document.getElementById("modal-qr-img");
    
    if (codeEl) codeEl.textContent = "Cargando código...";
    if (nameEl) nameEl.textContent = "";
    if (imgEl) imgEl.src = "";

    try {
        const res = await fetch(`/api/equipment/${id}`);
        if (res.ok) {
            const eq = await res.json();
            if (codeEl) codeEl.textContent = eq.code;
            if (nameEl) nameEl.textContent = eq.name;
            if (imgEl) imgEl.src = `/api/equipment/${id}/qr?t=` + Date.now();
        } else {
            if (imgEl) imgEl.src = `/api/equipment/${id}/qr?t=` + Date.now();
            if (codeEl) codeEl.textContent = `ID #${id}`;
        }
    } catch (e) {
        if (imgEl) imgEl.src = `/api/equipment/${id}/qr?t=` + Date.now();
    }
}

function printSingleQR() {
    const img = document.getElementById("modal-qr-img");
    if (img && img.src) {
        const code = document.getElementById("modal-qr-code")?.textContent || "";
        const name = document.getElementById("modal-qr-name")?.textContent || "";
        const win = window.open("", "_blank");
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Etiqueta QR - ${code}</title>
                <style>
                    body { display: flex; align-items: center; justify-content: center; height: 95vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; }
                    .badge { border: 2px solid #0f172a; padding: 24px; border-radius: 16px; text-align: center; width: 260px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                    .sub { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #dc2626; margin-bottom: 8px; }
                    img { width: 190px; height: 190px; object-fit: contain; }
                    .code { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: 1px; margin-top: 8px; }
                    .name { font-size: 13px; font-weight: 700; color: #334155; margin-top: 4px; }
                </style>
            </head>
            <body>
                <div class="badge">
                    <div class="sub">ZAHERCA CONSTRUCCIONES</div>
                    <img src="${img.src}" />
                    <div class="code">${code}</div>
                    <div class="name">${name}</div>
                </div>
                <script>window.onload = function() { window.print(); }<\/script>
            </body>
            </html>
        `);
        win.document.close();
    }
}


// --- MOVEMENTS (CHECKOUT & CHECKIN) ---
function handleCheckoutTypeChange() {
    const isMaintenance = document.querySelector('input[name="checkout-type"]:checked')?.value === "MANTENIMIENTO";
    
    const labelEmp = document.getElementById("checkout-employee-label");
    const labelDate = document.getElementById("checkout-return-date-label");
    const labelProj = document.getElementById("checkout-project-label");
    const inputProj = document.getElementById("checkout-project");
    const labelNotes = document.getElementById("checkout-notes-label");
    const inputNotes = document.getElementById("checkout-notes");
    
    const cardPrestamo = document.getElementById("label-type-prestamo");
    const cardMantenimiento = document.getElementById("label-type-mantenimiento");

    if (isMaintenance) {
        if (cardMantenimiento) cardMantenimiento.className = "flex items-center gap-2.5 p-3 rounded-xl border-2 border-amber-500 bg-amber-950/40 cursor-pointer transition-all";
        if (cardPrestamo) cardPrestamo.className = "flex items-center gap-2.5 p-3 rounded-xl border border-slate-700 bg-slate-900 cursor-pointer hover:bg-slate-800 transition-all";

        if (labelEmp) labelEmp.textContent = "Encargado de Entrega / Supervisor *";
        if (labelDate) labelDate.textContent = "Fecha Estimada de Regreso del Taller";
        if (labelProj) labelProj.textContent = "Taller / Proveedor / Servicio";
        if (inputProj) inputProj.placeholder = "Ej. Taller Bosch Autorizado, Tornería Central, Calibración";
        if (labelNotes) labelNotes.textContent = "Motivo del Mantenimiento / Falla a Reparar";
        if (inputNotes) inputNotes.placeholder = "Describe el problema, mantenimiento preventivo o piezas a cambiar...";
    } else {
        if (cardPrestamo) cardPrestamo.className = "flex items-center gap-2.5 p-3 rounded-xl border-2 border-red-500 bg-red-950/40 cursor-pointer transition-all";
        if (cardMantenimiento) cardMantenimiento.className = "flex items-center gap-2.5 p-3 rounded-xl border border-slate-700 bg-slate-900 cursor-pointer hover:bg-slate-800 transition-all";

        if (labelEmp) labelEmp.textContent = "Empleado Responsable *";
        if (labelDate) labelDate.textContent = "Fecha Estimada Devolución";
        if (labelProj) labelProj.textContent = "Proyecto / Ubicación de Uso";
        if (inputProj) inputProj.placeholder = "Ej. Obra Torre Central, Planta Norte, Taller 2";
        if (labelNotes) labelNotes.textContent = "Notas / Observaciones";
        if (inputNotes) inputNotes.placeholder = "Accesorios incluidos, estado inicial, etc.";
    }
}

function openCheckoutForCode(code) {
    openModal("modal-checkout");
    loadEquipmentDropdown(code);
}

async function submitCheckout(e) {
    e.preventDefault();

    const movementType = document.querySelector('input[name="checkout-type"]:checked')?.value || "PRESTAMO";

    const payload = {
        equipment_code: document.getElementById("checkout-equipment-code").value.trim(),
        employee_id: parseInt(document.getElementById("checkout-employee-id").value),
        movement_type: movementType,
        destination_project: document.getElementById("checkout-project").value.trim() || (movementType === "MANTENIMIENTO" ? "Taller / Mantenimiento" : "General"),
        expected_return_date: document.getElementById("checkout-return-date").value || null,
        checkout_condition: document.getElementById("checkout-condition").value,
        checkout_notes: document.getElementById("checkout-notes").value.trim()
    };

    try {
        const res = await fetch("/api/movements/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.detail || "No se pudo registrar la salida", "error");
            return;
        }

        showToast(data.message, "success");
        closeModal("modal-checkout");
        document.getElementById("form-checkout").reset();
        handleCheckoutTypeChange();
        
        loadDashboardStats();
        loadInventory();
        loadMovements("ACTIVO");
    } catch (e) {
        showToast("Error al procesar salida", "error");
    }
}

async function openCheckinModal(movementId) {
    openModal("modal-checkin");
    document.getElementById("checkin-movement-id").value = movementId;
    document.getElementById("checkin-info-equipment").textContent = "Cargando información del equipo...";
    document.getElementById("checkin-info-employee").textContent = "Cargando responsable...";
    document.getElementById("checkin-condition").value = "Bueno";
    document.getElementById("checkin-status").value = "DISPONIBLE";
    document.getElementById("checkin-notes").value = "";

    try {
        const res = await fetch(`/api/movements/${movementId}`);
        if (res.ok) {
            const mov = await res.json();
            const isMaint = mov.movement_type === "MANTENIMIENTO";
            
            const header = document.getElementById("modal-checkin-header");
            const title = document.getElementById("modal-checkin-title");
            const typeLabel = document.getElementById("checkin-info-type");
            
            if (header) header.className = isMaint ? "bg-gradient-to-r from-amber-700 to-amber-600 px-6 py-4 text-white flex items-center justify-between shadow-md" : "bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-4 text-white flex items-center justify-between shadow-md";
            if (title) title.textContent = isMaint ? "Retorno de Taller / Mantenimiento" : "Registrar Devolución de Préstamo";
            if (typeLabel) typeLabel.textContent = isMaint ? "Equipo que regresa de taller" : "Equipo a devolver";

            document.getElementById("checkin-info-equipment").textContent = `${mov.equipment_name} (${mov.equipment_code})`;
            document.getElementById("checkin-info-employee").textContent = isMaint 
                ? `Enviado por: ${mov.employee_name} · Taller / Proveedor: ${mov.destination_project || 'Taller Central'}`
                : `Retirado por: ${mov.employee_name} (${mov.employee_doc || ''}) · Proyecto: ${mov.destination_project || 'General'}`;
        }
    } catch (e) {
        console.error("Error al cargar detalles de préstamo:", e);
    }
}

function handleReturnConditionChange() {
    const cond = document.getElementById("checkin-condition").value;
    const statusSelect = document.getElementById("checkin-status");
    if (cond === "Requiere Revisión") {
        statusSelect.value = "MANTENIMIENTO";
    } else if (cond === "Dañado") {
        statusSelect.value = "DANADO";
    } else {
        statusSelect.value = "DISPONIBLE";
    }
}

async function submitCheckin(e) {
    e.preventDefault();
    const movId = document.getElementById("checkin-movement-id").value;

    const payload = {
        return_condition: document.getElementById("checkin-condition").value,
        return_notes: document.getElementById("checkin-notes").value.trim(),
        new_equipment_status: document.getElementById("checkin-status").value
    };

    try {
        const res = await fetch(`/api/movements/checkin/${movId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.detail || "Error al procesar devolución", "error");
            return;
        }

        showToast(data.message, "success");
        closeModal("modal-checkin");

        loadDashboardStats();
        loadInventory();
        loadMovements("ACTIVO");
    } catch (e) {
        showToast("Error al procesar devolución", "error");
    }
}

// --- MOVEMENTS VIEW TABS ---
let currentMovementsTab = "ACTIVO";
function switchMovementsTab(tab) {
    currentMovementsTab = tab;
    ["ACTIVO", "ATRASADO", "ALL"].forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        if (btn) {
            if (t === tab) {
                btn.className = "px-4 py-3 text-xs sm:text-sm font-bold border-b-2 border-red-500 text-red-400 flex items-center gap-2 whitespace-nowrap transition-all";
            } else {
                btn.className = "px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2 whitespace-nowrap transition-all";
            }
        }
    });
    loadMovements(tab);
}

async function loadMovements(statusTab = "ACTIVO") {
    const tbody = document.getElementById("movements-table-body");
    if (!tbody) return;

    try {
        let url = "/api/movements";
        if (statusTab !== "ALL") {
            url += `?status=${statusTab}`;
        }

        const res = await fetch(url);
        const movements = await res.json();

        if (movements.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-500">No hay registros para mostrar en esta pestaña.</td></tr>`;
            return;
        }

        tbody.innerHTML = movements.map(m => {
            let statusBadge = "";
            let actionBtn = "";

            if (m.movement_type === "ALTA_INVENTARIO") {
                statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/80"><i class="fa-solid fa-plus-circle text-emerald-400"></i>Alta / Registro</span>';
                actionBtn = '<span class="text-xs text-emerald-400/80 font-bold"><i class="fa-solid fa-check mr-1"></i>Incorporado</span>';
            } else if (m.movement_type === "BAJA_INVENTARIO") {
                statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-slate-400 border border-slate-700"><i class="fa-solid fa-box-archive text-slate-400"></i>Desincorporado</span>';
                actionBtn = '<span class="text-xs text-slate-500 font-bold"><i class="fa-solid fa-trash-can mr-1"></i>Baja de Catálogo</span>';
            } else if (m.status === "ACTIVO") {
                statusBadge = m.movement_type === "MANTENIMIENTO" 
                    ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800"><i class="fa-solid fa-wrench text-amber-400"></i>En Taller</span>'
                    : '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-950 text-blue-300 border border-blue-800"><i class="fa-solid fa-hammer text-blue-400"></i>En Uso (Obra)</span>';
                
                actionBtn = `
                    <button onclick="openCheckinModal(${m.id})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg shadow-md transition-all active:scale-95">
                        Devolver
                    </button>
                `;
            } else if (m.status === "ATRASADO") {
                statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-700 animate-pulse"><i class="fa-solid fa-triangle-exclamation text-red-400"></i>¡Atrasado!</span>';
                actionBtn = `
                    <button onclick="openCheckinModal(${m.id})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg shadow-md transition-all active:scale-95">
                        Devolver
                    </button>
                `;
            } else {
                statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800"><i class="fa-solid fa-check text-emerald-400"></i>Devuelto</span>';
                actionBtn = '<span class="text-xs text-slate-500 font-medium">Completado</span>';
            }

            const isDeleted = m.is_equipment_deleted;
            const codeBadge = isDeleted
                ? `<span class="text-xs uppercase bg-slate-900 text-slate-400 border border-slate-700 px-2 py-0.5 rounded font-bold mr-1 font-mono">${m.equipment_code}</span>`
                : `<span class="text-xs uppercase bg-red-950 text-red-300 border border-red-800/60 px-2 py-0.5 rounded font-black mr-1 font-mono">${m.equipment_code}</span>`;

            return `
                <tr class="hover:bg-[#182235]/60 transition-colors">
                    <td class="py-3.5 px-4 font-bold text-white">
                        <div class="flex items-center flex-wrap gap-1">
                            ${codeBadge}
                            <span class="${isDeleted ? 'text-slate-300' : 'text-white'}">${m.equipment_name}</span>
                        </div>
                        ${isDeleted ? '<span class="text-[10px] text-slate-500 italic block mt-0.5"><i class="fa-solid fa-shield-halved text-slate-600 mr-1"></i>Herramienta eliminada (Registro permanente)</span>' : ''}
                    </td>
                    <td class="py-3.5 px-4 text-xs font-semibold text-slate-200">
                        ${m.employee_name} ${m.employee_doc ? `<span class="text-slate-400 font-normal">(${m.employee_doc})</span>` : ''}
                    </td>
                    <td class="py-3.5 px-4 text-xs text-slate-300">${m.destination_project}</td>
                    <td class="py-3.5 px-4 text-xs text-slate-400">${m.checkout_date}</td>
                    <td class="py-3.5 px-4 text-xs font-semibold ${m.is_overdue ? 'text-red-400 font-bold' : 'text-slate-300'}">
                        ${m.status === 'DEVUELTO' ? (m.return_date || m.checkout_date) : (m.expected_return_date || 'No especificada')}
                    </td>
                    <td class="py-3.5 px-4">${statusBadge}</td>
                    <td class="py-3.5 px-4 text-right">${actionBtn}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-rose-400">Error al cargar movimientos.</td></tr>`;
    }
}


// --- EMPLOYEES LOGIC ---
async function loadEmployeesList() {
    const container = document.getElementById("employees-container");
    if (!container) return;

    try {
        const res = await fetch("/api/employees");
        const employees = await res.json();

        if (employees.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500">No hay personal registrado.</div>`;
            return;
        }

        container.innerHTML = employees.map(emp => `
            <div class="bg-[#111827] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3 flex flex-col justify-between hover:border-slate-700 transition-all">
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-red-950 text-red-300 border border-red-800/60 font-mono">${emp.doc_id}</span>
                        <div class="flex items-center gap-1">
                            <button onclick="openEditEmployeeModal(${emp.id})" class="text-slate-400 hover:text-white text-xs font-semibold p-1 hover:bg-slate-800 rounded transition-all" title="Editar">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="deleteEmployee(${emp.id}, '${emp.full_name}')" class="text-rose-400 hover:text-rose-300 text-xs font-semibold p-1 hover:bg-rose-950/50 rounded transition-all" title="Eliminar Personal">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div>
                        <h4 class="font-black text-base text-white brand-font">${emp.full_name}</h4>
                        <p class="text-xs font-semibold text-slate-400">${emp.role} · ${emp.department}</p>
                    </div>
                </div>

                <div class="pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1">
                    ${emp.phone ? `<div><i class="fa-solid fa-phone text-red-400 mr-1.5 w-3.5"></i>${emp.phone}</div>` : ''}
                    ${emp.email ? `<div><i class="fa-solid fa-envelope text-red-400 mr-1.5 w-3.5"></i>${emp.email}</div>` : ''}
                </div>
            </div>
        `).join('');

    } catch (e) {
        container.innerHTML = `<div class="col-span-full text-center py-8 text-rose-400">Error al cargar empleados.</div>`;
    }
}

function openEmployeeModal() {
    document.getElementById("modal-employee-title").textContent = "Registrar Empleado";
    document.getElementById("employee-edit-id").value = "";
    document.getElementById("form-employee").reset();
    document.getElementById("emp-doc").readOnly = false;
    openModal("modal-employee");
}

async function openEditEmployeeModal(id) {
    try {
        const res = await fetch("/api/employees");
        const list = await res.json();
        const emp = list.find(e => e.id === id);
        if (!emp) return;

        document.getElementById("modal-employee-title").textContent = "Editar Empleado";
        document.getElementById("employee-edit-id").value = emp.id;
        document.getElementById("emp-doc").value = emp.doc_id;
        document.getElementById("emp-doc").readOnly = false;
        document.getElementById("emp-name").value = emp.full_name;
        document.getElementById("emp-role").value = emp.role;
        document.getElementById("emp-dept").value = emp.department;
        document.getElementById("emp-phone").value = emp.phone;
        document.getElementById("emp-email").value = emp.email;

        openModal("modal-employee");
    } catch (e) {}
}

async function submitEmployeeForm(e) {
    e.preventDefault();
    const editId = document.getElementById("employee-edit-id").value;

    const payload = {
        doc_id: document.getElementById("emp-doc").value.trim(),
        full_name: document.getElementById("emp-name").value.trim(),
        role: document.getElementById("emp-role").value.trim(),
        department: document.getElementById("emp-dept").value.trim(),
        phone: document.getElementById("emp-phone").value.trim(),
        email: document.getElementById("emp-email").value.trim()
    };

    try {
        let url = "/api/employees";
        let method = "POST";

        if (editId) {
            url = `/api/employees/${editId}`;
            method = "PUT";
        }

        const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.detail || "Error al guardar el empleado", "error");
            return;
        }

        showToast(data.message, "success");
        closeModal("modal-employee");
        loadEmployeesList();
        loadEmployeeDropdown();
    } catch (e) {
        showToast("Error de conexión al servidor", "error");
    }
}

async function deleteEmployee(id, fullName) {
    if (!confirm(`¿Estás seguro de eliminar a '${fullName}'? Su historial de préstamos y movimientos pasados quedará preservado de forma permanente.`)) return;

    try {
        const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, "success");
            loadEmployeesList();
            loadEmployeeDropdown();
        } else {
            showToast(data.detail || "No se pudo eliminar el personal", "error");
        }
    } catch (e) {
        showToast("Error de red", "error");
    }
}



// --- GESTIÓN DE USUARIOS (SOLO ADMINISTRADOR) ---

async function loadUsersList() {
    const tbody = document.getElementById("users-table-body");
    if (!tbody) return;

    try {
        const res = await fetch("/api/users");
        if (!res.ok) {
            if (res.status === 403) {
                tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-rose-400 font-bold">Acceso denegado. Solo la cuenta de Administrador puede ver esta sección.</td></tr>`;
                return;
            }
            tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-rose-400">Error al cargar usuarios.</td></tr>`;
            return;
        }

        const users = await res.json();
        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-slate-500">No hay usuarios registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(u => {
            const isAdmin = u.role === "admin";
            const roleBadge = isAdmin
                ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800"><i class="fa-solid fa-crown text-amber-400"></i> Administrador</span>'
                : '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-950 text-blue-300 border border-blue-800"><i class="fa-solid fa-user-gear text-blue-400"></i> Operador</span>';

            const statusBadge = u.is_active
                ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Activo</span>'
                : '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-slate-400 border border-slate-700"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>Inactivo</span>';

            const isMainAdmin = u.username === "adminzaher";

            return `
                <tr class="hover:bg-[#182235]/60 transition-colors">
                    <td class="py-3.5 px-4 font-bold text-white font-mono">
                        <div class="flex items-center gap-2">
                            <span class="text-xs uppercase px-2 py-0.5 rounded font-black ${isAdmin ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-red-950 text-red-300 border border-red-800/60'}">
                                ${u.username}
                            </span>
                            ${isMainAdmin ? '<span class="text-[10px] text-amber-400 font-bold">(Principal)</span>' : ''}
                        </div>
                    </td>
                    <td class="py-3.5 px-4 text-xs font-semibold text-slate-200">
                        ${u.full_name || 'Sin nombre'}
                    </td>
                    <td class="py-3.5 px-4">${roleBadge}</td>
                    <td class="py-3.5 px-4">${statusBadge}</td>
                    <td class="py-3.5 px-4 text-xs text-slate-400">${u.created_at || 'N/D'}</td>
                    <td class="py-3.5 px-4 text-right whitespace-nowrap">
                        <div class="inline-flex items-center gap-1">
                            <button onclick="openEditUserModal(${u.id})" class="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all" title="Editar / Cambiar Clave">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            ${!isMainAdmin ? `
                                <button onclick="deleteUser(${u.id}, '${u.username}')" class="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded-lg transition-all" title="Eliminar Usuario">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            ` : '<span class="p-1.5 text-slate-600 text-xs" title="Cuenta protegida"><i class="fa-solid fa-lock"></i></span>'}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-rose-400">Error al cargar usuarios.</td></tr>`;
    }
}

function openCreateUserModal() {
    document.getElementById("modal-user-title").textContent = "Nuevo Usuario";
    document.getElementById("user-edit-id").value = "";
    document.getElementById("form-user").reset();
    
    const userInp = document.getElementById("user-username");
    userInp.readOnly = false;
    userInp.classList.remove("opacity-60");
    
    const pwInp = document.getElementById("user-password");
    pwInp.required = true;
    pwInp.placeholder = "Mínimo 4 caracteres";
    
    const pwHint = document.getElementById("user-password-hint");
    if (pwHint) pwHint.classList.add("hidden");

    const statusContainer = document.getElementById("user-status-container");
    if (statusContainer) statusContainer.classList.add("hidden");

    openModal("modal-user");
}

async function openEditUserModal(id) {
    try {
        const res = await fetch("/api/users");
        const list = await res.json();
        const user = list.find(u => u.id === id);
        if (!user) return;

        document.getElementById("modal-user-title").textContent = `Editar Usuario (${user.username})`;
        document.getElementById("user-edit-id").value = user.id;
        
        const userInp = document.getElementById("user-username");
        userInp.value = user.username;
        userInp.readOnly = true;
        userInp.classList.add("opacity-60");

        document.getElementById("user-fullname").value = user.full_name || "";
        document.getElementById("user-role").value = user.role;

        const pwInp = document.getElementById("user-password");
        pwInp.value = "";
        pwInp.required = false;
        pwInp.placeholder = "Dejar en blanco para no cambiar";

        const pwHint = document.getElementById("user-password-hint");
        if (pwHint) pwHint.classList.remove("hidden");

        const statusContainer = document.getElementById("user-status-container");
        const activeCheck = document.getElementById("user-active");
        if (statusContainer && activeCheck) {
            statusContainer.classList.remove("hidden");
            statusContainer.classList.add("flex");
            activeCheck.checked = user.is_active;
            
            // Si es adminzaher, deshabilitar cambio de estado
            if (user.username === "adminzaher") {
                activeCheck.disabled = true;
                document.getElementById("user-role").disabled = true;
            } else {
                activeCheck.disabled = false;
                document.getElementById("user-role").disabled = false;
            }
        }

        openModal("modal-user");
    } catch (e) {
        showToast("Error al cargar datos del usuario", "error");
    }
}

async function submitUserForm(e) {
    e.preventDefault();
    const editId = document.getElementById("user-edit-id").value;
    const isEdit = Boolean(editId);

    const payload = {
        full_name: document.getElementById("user-fullname").value.trim(),
        role: document.getElementById("user-role").value
    };

    const password = document.getElementById("user-password").value;
    if (password && password.trim()) {
        payload.password = password.trim();
    }

    if (!isEdit) {
        payload.username = document.getElementById("user-username").value.trim();
        payload.password = password.trim();
    } else {
        const activeCheck = document.getElementById("user-active");
        if (activeCheck) payload.is_active = activeCheck.checked;
    }

    try {
        let url = "/api/users";
        let method = "POST";

        if (isEdit) {
            url = `/api/users/${editId}`;
            method = "PUT";
        }

        const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.detail || "Error al guardar usuario", "error");
            return;
        }

        showToast(data.message, "success");
        closeModal("modal-user");
        loadUsersList();
    } catch (e) {
        showToast("Error de conexión al servidor", "error");
    }
}

async function deleteUser(id, username) {
    if (!confirm(`¿Estás seguro de eliminar al usuario '${username}'? Esta acción no se puede deshacer.`)) return;

    try {
        const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, "success");
            loadUsersList();
        } else {
            showToast(data.detail || "No se pudo eliminar el usuario", "error");
        }
    } catch (e) {
        showToast("Error de conexión", "error");
    }
}

