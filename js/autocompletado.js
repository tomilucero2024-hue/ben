// ============================================================================
// ⚡ AUTOCOMPLETADO EN VIVO PARA LA BARRA DE BÚSQUEDA
// ============================================================================
// Provee sugerencias instantáneas en un dropdown flotante al escribir (>= 2 caracteres)
// sin requerir recargar la página. Agrupa sugerencias por Carreras e Instituciones,
// soporta navegación accesible por teclado (Flechas, Enter, Escape) y clic táctil.
// ============================================================================

import { ofertas, enlacesBEN } from './datos.js';
import { normalizarTexto, escaparHTML } from './util.js';

let carrerasUnicas = null;
let institucionesUnicas = null;

function prepararIndices() {
    if (carrerasUnicas && institucionesUnicas) return;

    const carrerasMap = new Map();
    const instMap = new Map();

    ofertas.forEach(o => {
        const normCarrera = normalizarTexto(o.nombre);
        if (!carrerasMap.has(normCarrera)) {
            const slug = enlacesBEN.carreras ? enlacesBEN.carreras[normCarrera] : null;
            carrerasMap.set(normCarrera, {
                nombre: o.nombre,
                norm: normCarrera,
                area: o.area || '',
                categoria: o.categoria || '',
                slug: slug || null
            });
        }

        const normInst = normalizarTexto(o.institucion);
        if (!instMap.has(normInst)) {
            const slug = enlacesBEN.instituciones ? enlacesBEN.instituciones[normInst] : null;
            instMap.set(normInst, {
                nombre: o.institucion,
                norm: normInst,
                gestion: o.gestion || '',
                slug: slug || null
            });
        }
    });

    // Incorporar también las carreras que figuran en enlacesBEN
    if (enlacesBEN.carreras) {
        Object.entries(enlacesBEN.carreras).forEach(([norm, slug]) => {
            if (!carrerasMap.has(norm)) {
                const legible = norm.charAt(0).toUpperCase() + norm.slice(1);
                carrerasMap.set(norm, {
                    nombre: legible,
                    norm: norm,
                    area: '',
                    categoria: '',
                    slug: slug
                });
            }
        });
    }

    if (enlacesBEN.instituciones) {
        Object.entries(enlacesBEN.instituciones).forEach(([norm, slug]) => {
            if (!instMap.has(norm)) {
                const legible = norm.charAt(0).toUpperCase() + norm.slice(1);
                instMap.set(norm, {
                    nombre: legible,
                    norm: norm,
                    gestion: '',
                    slug: slug
                });
            }
        });
    }

    carrerasUnicas = [...carrerasMap.values()];
    institucionesUnicas = [...instMap.values()];
}

export function buscarSugerencias(query, limiteCarreras = 5, limiteInstituciones = 3) {
    prepararIndices();
    const q = normalizarTexto(query);
    if (!q || q.length < 2) return { carreras: [], instituciones: [] };

    function puntuar(item) {
        const n = item.norm;
        if (n.startsWith(q)) return 3;
        if (new RegExp(`\\b${q}`).test(n)) return 2;
        if (n.includes(q)) return 1;
        return 0;
    }

    const carreras = carrerasUnicas
        .map(item => ({ item, score: puntuar(item) }))
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score || a.item.nombre.localeCompare(b.item.nombre, 'es'))
        .slice(0, limiteCarreras)
        .map(r => r.item);

    const instituciones = institucionesUnicas
        .map(item => ({ item, score: puntuar(item) }))
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score || a.item.nombre.localeCompare(b.item.nombre, 'es'))
        .slice(0, limiteInstituciones)
        .map(r => r.item);

    return { carreras, instituciones };
}

export function inicializarAutocompletado({ inputElem, dropdownElem, onSeleccionar }) {
    if (!inputElem || !dropdownElem) return;

    let indiceSeleccionado = -1;
    let itemsVisibles = [];

    inputElem.setAttribute('autocomplete', 'off');
    // WCAG 2.1 - 4.1.2: patrón combobox: el input declara que controla el listbox
    // de sugerencias y que la navegación por flechas mueve el resaltado.
    inputElem.setAttribute('role', 'combobox');
    inputElem.setAttribute('aria-haspopup', 'listbox');
    inputElem.setAttribute('aria-autocomplete', 'list');
    inputElem.setAttribute('aria-expanded', 'false');
    if (dropdownElem.id) inputElem.setAttribute('aria-controls', dropdownElem.id);

    function cerrar() {
        dropdownElem.hidden = true;
        dropdownElem.innerHTML = '';
        indiceSeleccionado = -1;
        itemsVisibles = [];
        inputElem.removeAttribute('aria-activedescendant');
        inputElem.setAttribute('aria-expanded', 'false');
    }

    function renderizar(query) {
        const { carreras, instituciones } = buscarSugerencias(query);
        if (!carreras.length && !instituciones.length) {
            cerrar();
            return;
        }

        itemsVisibles = [];
        let html = '';

        // WCAG 2.1 - 4.1.2: los títulos de grupo eran hijos sueltos del listbox
        // (no permitido) y cada opción llevaba adentro un enlace "Ficha ↗"
        // (interacción anidada, tampoco válida para un role="option"). Ahora el
        // grupo es role="group" con nombre accesible desde su título visible y la
        // opción es solo texto: la ficha se sigue alcanzando desde la tarjeta del
        // resultado, que ya tiene "Ver ficha en BEN".
        if (carreras.length) {
            html += `<div class="search-dropdown-grupo" role="group" aria-labelledby="search-grupo-carreras">
                <div class="search-dropdown-group-title" id="search-grupo-carreras" role="presentation">Carreras</div>`;
            carreras.forEach(c => {
                const id = `search-opt-${itemsVisibles.length}`;
                itemsVisibles.push({ tipo: 'carrera', dato: c });
                html += `
                <div class="search-dropdown-item" role="option" id="${id}" aria-selected="false" data-idx="${itemsVisibles.length - 1}">
                    <div class="search-dropdown-item-info">
                        <span class="search-dropdown-item-title"><span aria-hidden="true">🎓</span> ${escaparHTML(c.nombre)}</span>
                        ${c.area ? `<span class="search-dropdown-item-sub">Área: ${escaparHTML(c.area)}</span>` : ''}
                    </div>
                </div>`;
            });
            html += '</div>';
        }

        if (instituciones.length) {
            html += `<div class="search-dropdown-grupo" role="group" aria-labelledby="search-grupo-instituciones">
                <div class="search-dropdown-group-title" id="search-grupo-instituciones" role="presentation">Instituciones</div>`;
            instituciones.forEach(i => {
                const id = `search-opt-${itemsVisibles.length}`;
                itemsVisibles.push({ tipo: 'institucion', dato: i });
                html += `
                <div class="search-dropdown-item" role="option" id="${id}" aria-selected="false" data-idx="${itemsVisibles.length - 1}">
                    <div class="search-dropdown-item-info">
                        <span class="search-dropdown-item-title"><span aria-hidden="true">🏛️</span> ${escaparHTML(i.nombre)}</span>
                        ${i.gestion ? `<span class="search-dropdown-item-sub">Gestión ${escaparHTML(i.gestion)}</span>` : ''}
                    </div>
                </div>`;
            });
            html += '</div>';
        }

        dropdownElem.innerHTML = html;
        dropdownElem.hidden = false;
        inputElem.setAttribute('aria-expanded', 'true');
        indiceSeleccionado = -1;

        dropdownElem.querySelectorAll('.search-dropdown-item').forEach(el => {
            el.addEventListener('mousedown', e => {
                e.preventDefault();
                const idx = parseInt(el.dataset.idx, 10);
                seleccionarItem(idx);
            });
        });
    }

    function seleccionarItem(idx) {
        const item = itemsVisibles[idx];
        if (!item) return;
        inputElem.value = item.dato.nombre;
        cerrar();
        if (onSeleccionar) {
            onSeleccionar(item.dato.nombre, item.tipo, item.dato);
        }
    }

    function actualizarResaltado() {
        const opciones = dropdownElem.querySelectorAll('.search-dropdown-item');
        opciones.forEach((opc, i) => {
            const activo = i === indiceSeleccionado;
            opc.classList.toggle('is-selected', activo);
            // WCAG 2.1 - 4.1.2: la opción resaltada tiene que estar marcada como
            // seleccionada, no solo pintada.
            opc.setAttribute('aria-selected', String(activo));
            if (activo) {
                inputElem.setAttribute('aria-activedescendant', opc.id);
                opc.scrollIntoView({ block: 'nearest' });
            }
        });
        if (indiceSeleccionado === -1) {
            inputElem.removeAttribute('aria-activedescendant');
        }
    }

    inputElem.addEventListener('input', () => {
        const val = inputElem.value.trim();
        if (val.length < 2) {
            cerrar();
            return;
        }
        renderizar(val);
    });

    inputElem.addEventListener('keydown', e => {
        if (dropdownElem.hidden) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            indiceSeleccionado = (indiceSeleccionado + 1) % itemsVisibles.length;
            actualizarResaltado();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            indiceSeleccionado = (indiceSeleccionado - 1 + itemsVisibles.length) % itemsVisibles.length;
            actualizarResaltado();
        } else if (e.key === 'Enter') {
            if (indiceSeleccionado >= 0 && itemsVisibles[indiceSeleccionado]) {
                e.preventDefault();
                seleccionarItem(indiceSeleccionado);
            }
        } else if (e.key === 'Escape') {
            cerrar();
        }
    });

    document.addEventListener('click', e => {
        if (!inputElem.contains(e.target) && !dropdownElem.contains(e.target)) {
            cerrar();
        }
    });
}
