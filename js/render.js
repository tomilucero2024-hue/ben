// ==========================================
// Todo lo que pinta HTML: tarjetas, secciones y paginacion. Cada dato que entra
// a un innerHTML pasa por el escapado de util.js.
// ==========================================

import { etiquetaCompatibilidad } from './copiloto.js';
import { ETIQUETAS_FUENTE, catalogosAparte, enlacesBEN, ofertas, plataformas } from './datos.js';
import { estado, sincronizarURL } from './estado.js';
import { FILTROS_SOLO_FORMALES, cumpleFiltros, filtrarYOrdenar, obtenerRelacionadas } from './filtros.js';
import { capSeguro, duracionCorta, escaparHTML, formatearDuracionAnios, limpiarTexto, nombreSeguro, normalizarTexto, urlSegura } from './util.js';

export const LIMITE_PAGINA = 24;

// Enlace interno a la ficha que BEN tiene de esa carrera. Va antes que el del
// sitio oficial porque es el que mantiene a la persona adentro y el unico que
// reparte autoridad hacia las paginas propias: hasta ahora la portada, que es
// la pagina con mas peso del sitio, no enlazaba ni una sola de las suyas.
// Devuelve '' cuando esa formacion no tiene pagina generada.
function enlaceFichaBEN(nombre) {
    const slug = enlacesBEN.carreras[normalizarTexto(nombre)];
    return slug
        ? `<a class="card-link card-link-ben" href="/carrera/${slug}/">Ver más información →</a>`
        : '';
}

function enlaceInstitucionBEN(nombre) {
    if (!nombre) return '';
    const slug = enlacesBEN.instituciones && enlacesBEN.instituciones[normalizarTexto(nombre)];
    return slug
        ? `<a href="/institucion/${slug}/" class="link-institucion">${nombreSeguro(nombre)}</a>`
        : nombreSeguro(nombre);
}

// Iconos vectoriales limpios (SVG) para evitar emojis del sistema
const SVG_INSTITUCION = `<svg class="meta-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 10.5 12 5l9 5.5"/><path d="M5 10.5V19M9 10.5V19M15 10.5V19M19 10.5V19"/><path d="M3 19h18M2 22h20"/></svg>`;
const SVG_FACULTAD = `<svg class="meta-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M16 10h4a2 2 0 0 1 2 2v10"/><path d="M8 6h2M8 10h2M8 14h2M8 18h2M18 14h2M18 18h2"/></svg>`;
const SVG_MODALIDAD = `<svg class="meta-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/></svg>`;
const SVG_DURACION = `<svg class="meta-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>`;
const ICONO_ESCUCHAR = `<svg class="btn-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

const ICONOS_AREAS = {
    'Tecnología': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    'Ingeniería': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    'Salud': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    'Negocios': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    'Diseño': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/><path d="M14.5 17.5 4.5 15"/></svg>',
    'Educación': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    'Ciencias sociales': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    'Ambiente': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
    'Turismo': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    'Gastronomía': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>',
    'Oficios': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    'Arte': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    'Idiomas': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
};

// Ejemplos curados para el listado de áreas: cuando un área tiene términos que
// quedan mezclados (Ambiente junta física, química y agronomía), conviene elegir
// a mano qué 3 carreras mostrar. El valor es una lista de términos que se buscan
// dentro de los nombres reales agrupados de esa área.
const AREAS_EJEMPLOS_CURADOS = {
    'Ambiente': ['Gestión Ambiental', 'Física', 'Química'],
    'Arte': ['Canto', 'Instrumento', 'Danza'],
    'Diseño': ['Diseño Gráfico', 'Arquitectura', 'Publicidad'],
    'Educación': ['Profesorados', 'Psicopedagogía', 'Educación social'],
    'Gastronomía': ['Enología', 'Gastronomía', 'Bromatología'],
    'Idiomas': ['Inglés', 'Italiano', 'Francés'],
    'Ingeniería': ['Civil', 'Bioingeniería', 'Informática'],
    'Negocios': ['Comercio Internacional', 'Contador Público', 'Administración'],
    'Oficios': ['Metalmecánica', 'Construcciones', 'Mantenimiento'],
    'Salud': ['Medicina', 'Farmacia', 'Psicología'],
    'Tecnología': ['Ciberdefensa', 'Programación', 'Videojuegos'],
    'Turismo': ['Hotelería', 'Turismo', 'Empresas hoteleras']
};

const SVG_ESCUCHAR = ICONO_ESCUCHAR;

let resultadosActuales = [];
export let visibles = LIMITE_PAGINA;

// ---- Persistencia del estado en la URL (para compartir y restaurar) ----
export function actualizarVista() {
    actualizarBotonesActivos();
    mostrarResultados();
}

// ==========================================
// 🔀 VISTAS DEL CATÁLOGO FORMAL
// ==========================================

// Las tres formas de explorar la Educación Formal. Es la misma fuente de verdad
// que usan los botones de la bienvenida: entrar a una vista siempre cae en su
// raíz (lista de áreas, grupos de instituciones), nunca en un drilldown viejo.
export function cambiarVista(vista) {
    if (vista !== 'carreras' && vista !== 'instituciones' && vista !== 'areas') return;
    estado.vista = vista;
    estado.tipoInstitucion = null;
    if (vista === 'areas') {
        estado.area = 'todos';
        document.querySelectorAll('.filter-option[data-filter="area"]').forEach(btnFiltro => {
            btnFiltro.classList.toggle('active', btnFiltro.dataset.value === 'todos');
        });
    }
    actualizarVista();
    sincronizarURL();
}

// Cablea los botones del selector persistente (una sola vez). Vive arriba de la
// grilla, dentro de la toolbar, así desaparece junto con ella en las secciones
// que no son Educación Formal.
export function configurarSwitcherVistas() {
    const switcher = document.getElementById('vistasSwitcher');
    if (!switcher || switcher.dataset.listos) return;
    switcher.dataset.listos = '1';
    switcher.querySelectorAll('button').forEach(boton => {
        boton.addEventListener('click', () => cambiarVista(boton.dataset.vista));
    });
}

// Pinta cuál de las tres vistas está activa; se llama desde mostrarResultados()
// para que acompañe a cualquier re-render (drilldowns incluidos).
function actualizarSwitcherVistas() {
    const switcher = document.getElementById('vistasSwitcher');
    if (!switcher) return;
    switcher.querySelectorAll('button').forEach(boton => {
        const activo = boton.dataset.vista === estado.vista;
        boton.classList.toggle('is-active', activo);
        boton.setAttribute('aria-pressed', String(activo));
    });
}

// ==========================================
// 🎓 / 💻 SECCIONES PRINCIPALES
// ==========================================

export function cambiarSeccion(seccion) {
    ocultarCargarMas();
    estado.seccion = seccion;
    document.body.dataset.seccion = seccion;
    document.querySelectorAll('.section-tab').forEach(boton => {
        const activa = boton.dataset.seccion === seccion;
        boton.classList.toggle('is-active', activa);
        boton.setAttribute('aria-pressed', String(activa));
    });
    cambiarPanelFiltros(false);
    if (seccion === 'plataformas') mostrarPlataformas();
    else if (catalogosAparte[seccion]) mostrarCatalogoAparte(seccion);
    else mostrarResultados();
    sincronizarURL();
}

// ==========================================
// 🧭 / 🔧 CATÁLOGOS APARTE (formaciones alternativas y oficios técnicos)
// ==========================================

export function mostrarCatalogoAparte(seccion) {
    const catalogo = catalogosAparte[seccion];
    document.getElementById('seccion-plataformas').hidden = true;
    document.getElementById('plataformas-coincidentes').hidden = true;
    document.getElementById('cardContainer').hidden = true;
    document.getElementById('resultsToolbar').hidden = true;
    // Estas listas no usan los filtros de carreras de universidades.
    document.getElementById('filtersSidebar').hidden = true;
    document.getElementById('mobileFilterButton').hidden = true;
    // Solo se ve la sección elegida; la otra del mismo tipo se oculta.
    Object.entries(catalogosAparte).forEach(([nombre, otro]) => {
        document.getElementById(otro.seccion).hidden = nombre !== seccion;
    });

    const visibles = estado.texto
        ? catalogo.cursos.filter(c => c.busqueda.includes(estado.texto))
        : catalogo.cursos;
    renderizarCursosAparte(document.getElementById(catalogo.contenedor), visibles, catalogo.simple);
}

export function renderizarCursosAparte(contenedor, lista, simple = false) {
    if (!lista.length) {
        contenedor.innerHTML = '<p class="empty-state">No hay formaciones que coincidan con esa búsqueda.</p>';
        return;
    }
    if (simple) { renderizarCursosSimples(contenedor, lista); return; }
    contenedor.innerHTML = lista.map(curso => `
        <article class="curso-card">
            <div class="card-badges">
                <span class="badge badge-seccion">${capSeguro(curso.categoria)}</span>
                <span class="badge badge-modalidad">${capSeguro(curso.modalidad)}</span>
            </div>
            <h3 class="curso-title">${capSeguro(curso.nombre)}</h3>
            <div class="card-info">
                <p class="card-institucion-row">${SVG_INSTITUCION} <strong>${enlaceInstitucionBEN(curso.institucion)}</strong></p>
                ${curso.provincia ? `<p class="card-meta-row">${SVG_MODALIDAD} <span>${capSeguro(curso.provincia)}</span></p>` : ''}
                ${curso.sede ? `<p class="card-meta-row">${SVG_MODALIDAD} <span>${capSeguro(curso.sede)}</span></p>` : ''}
                <p class="card-meta-row">${SVG_DURACION} <span>${capSeguro(curso.duracion)}</span></p>
            </div>
            ${urlSegura(curso.link)
                ? `<a class="card-link" href="${escaparHTML(urlSegura(curso.link))}" target="_blank" rel="noopener nofollow" referrerpolicy="no-referrer">Ir al sitio oficial ↗</a>`
                : '<span class="card-link card-link-muted">Sin link oficial</span>'}
            <div class="card-actions">
                <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(curso._clave)}" aria-label="Escuchar formación">${ICONO_ESCUCHAR} <span>Escuchar</span></button>
            </div>
        </article>`).join('');
}

// Variante simple de tarjeta: mismo diseño (.curso-card, con el borde y el tinte
// de la sección) pero solo nombre, descripción y link. Sin badges, sin duración
// ni modalidad, y sin botones.
// Ojo: acá NO se usa capitalizar(), que pasa todo a minúscula después de la
// primera letra y convertiría "CEBJA" en "Cebja".
function renderizarCursosSimples(contenedor, lista) {
    contenedor.innerHTML = lista.map(curso => `
        <article class="curso-card curso-card-simple">
            <h3 class="curso-title">${escaparHTML(curso.nombre)}</h3>
            ${curso.nombreCompleto
                ? `<p class="curso-subtitulo">${escaparHTML(curso.nombreCompleto)}</p>`
                : ''}
            ${curso.descripcion
                ? `<p class="curso-descripcion">${escaparHTML(curso.descripcion)}</p>`
                : ''}
            ${urlSegura(curso.link)
                ? `<a class="card-link" href="${escaparHTML(urlSegura(curso.link))}" target="_blank" rel="noopener nofollow" referrerpolicy="no-referrer">Ver más en mendoza.edu.ar ↗</a>`
                : '<span class="card-link card-link-muted">Sin link oficial</span>'}
        </article>`).join('');
}

function ocultarCatalogosAparte() {
    Object.values(catalogosAparte).forEach(catalogo => {
        document.getElementById(catalogo.seccion).hidden = true;
    });
}

export function mostrarPlataformas() {
    document.getElementById('plataformas-coincidentes').hidden = true;
    ocultarCatalogosAparte();
    document.getElementById('cardContainer').hidden = true;
    document.getElementById('resultsToolbar').hidden = true;
    // Las plataformas no se filtran: son pocas tarjetas simples.
    document.getElementById('filtersSidebar').hidden = true;
    document.getElementById('mobileFilterButton').hidden = true;
    document.getElementById('seccion-plataformas').hidden = false;

    const visibles = estado.texto
        ? plataformas.filter(p => p.busqueda.includes(estado.texto))
        : plataformas;
    renderizarPlataformas(document.getElementById('contenedor-plataformas'), visibles);
}

export function renderizarPlataformas(contenedor, lista) {
    if (!lista.length) {
        contenedor.innerHTML = '<p class="empty-state">No hay plataformas que coincidan con esa búsqueda.</p>';
        return;
    }
    contenedor.innerHTML = lista.map(plataforma => `
        <article class="platform-card">
            <div class="platform-head">
                ${plataforma.logo
                    ? `<img class="platform-logo" src="${escaparHTML(CARPETA_LOGOS + plataforma.logo)}" alt="Logo de ${escaparHTML(plataforma.nombre)}" loading="lazy">`
                    : `<span class="platform-logo platform-logo-vacio" aria-hidden="true">${escaparHTML(String(plataforma.nombre).charAt(0))}</span>`}
                <h3 class="platform-name">${nombreSeguro(plataforma.nombre)}</h3>
            </div>
            <p class="platform-summary">${capSeguro(plataforma.resumen)}</p>
            <div class="platform-meta">
                <span class="badge badge-modalidad">${SVG_MODALIDAD} ${capSeguro(plataforma.modalidad)}</span>
                <span class="badge">${SVG_DURACION} ${capSeguro(plataforma.duracion)}</span>
            </div>
            ${urlSegura(plataforma.url)
                ? `<a class="platform-link" href="${escaparHTML(urlSegura(plataforma.url))}" target="_blank" rel="noopener nofollow" referrerpolicy="no-referrer">Ver oferta en ${nombreSeguro(plataforma.nombre)} ↗</a>`
                : '<span class="platform-link platform-link-muted">Sitio oficial no disponible</span>'}
            <div class="card-actions">
                <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(plataforma._clave)}" aria-label="Escuchar plataforma">${ICONO_ESCUCHAR} <span>Escuchar</span></button>
            </div>
        </article>`).join('');
}

export // ==========================================
// 🧭 RECOMENDACIONES DEL COPILOTO
// ==========================================

// Índice nombre-normalizado -> ofertas formales con ese nombre. Las carreras que
// devuelve el Orientador son "carreras" abstractas (de carreras-perfiles.json),
// no ofertas de una institución concreta, así que para poder filtrarlas por
// gestión, modalidad o duración hay que volver a las ofertas que las dictan.
let indiceOfertasPorNombre = null;

function ofertasDeCarrera(carrera) {
    if (!indiceOfertasPorNombre || indiceOfertasPorNombre.size !== ofertas.length) {
        indiceOfertasPorNombre = new Map();
        ofertas.forEach(oferta => {
            const clave = normalizarTexto(oferta.nombre);
            if (!indiceOfertasPorNombre.has(clave)) indiceOfertasPorNombre.set(clave, []);
            indiceOfertasPorNombre.get(clave).push(oferta);
        });
    }
    return indiceOfertasPorNombre.get(carrera.clave || normalizarTexto(carrera.nombre)) || [];
}

// Una carrera recomendada pasa los filtros si al menos una de las ofertas que la
// dictan los pasa. Las que solo viven en los catálogos aparte (oficios,
// formaciones alternativas) no tienen oferta formal: a esas se les aplican solo
// los filtros que tienen sentido para ellas.
function recomendacionCoincide(carrera) {
    const suyas = ofertasDeCarrera(carrera);
    if (suyas.length) return suyas.some(cumpleFiltros);

    const texto = estado.texto;
    const coincideNombre = !texto
        || normalizarTexto(`${carrera.nombre} ${carrera.area} ${carrera.categoria || ''}`).includes(texto);
    return coincideNombre
        && (estado.area === 'todos' || carrera.area === estado.area)
        && (estado.formacion === 'todos' || carrera.formacion === estado.formacion)
        && FILTROS_SOLO_FORMALES.every(f => estado[f] === 'todos')
        && estado.duracionMin === null && estado.duracionMax === null;
}

export function mostrarRecomendaciones() {
    document.getElementById('seccion-plataformas').hidden = true;
    ocultarCatalogosAparte();
    document.getElementById('filtersSidebar').hidden = false;
    document.getElementById('mobileFilterButton').hidden = false;
    document.getElementById('cardContainer').hidden = false;
    document.getElementById('resultsToolbar').hidden = false;
    ocultarCargarMas();

    const { carreras, rankings, total } = estado.recomendacion;
    // El orden por compatibilidad se respeta siempre: filtrar saca elementos,
    // nunca los reordena. Es justamente lo que antes se perdía.
    const visibles = carreras.filter(recomendacionCoincide);

    const contador = document.getElementById('resultsCount');
    if (contador) {
        if (!visibles.length) {
            contador.textContent = 'Ninguna de tus recomendaciones pasa esos filtros';
        } else if (visibles.length === carreras.length) {
            const extra = total > carreras.length ? ` (de ${total.toLocaleString('es-AR')} compatibles)` : '';
            contador.textContent = `${visibles.length} ${visibles.length === 1 ? 'carrera recomendada' : 'carreras recomendadas para vos'}${extra}`;
        } else {
            contador.textContent = `${visibles.length} de tus ${carreras.length} recomendaciones pasan los filtros`;
        }
    }

    if (!visibles.length) {
        document.getElementById('cardContainer').innerHTML =
            '<p class="empty-state">Ninguna de las carreras que te recomendé entra en esos filtros. ' +
            'Probá aflojar alguno, o volvé al catálogo completo con la chapita de arriba.</p>';
    } else {
        renderizarTarjetasConCompatibilidad(visibles, rankings);
    }

    actualizarChapaRecomendacion();
}

// Chapita en la barra de resultados que avisa que la grilla está mostrando las
// recomendaciones del test, con una salida al catálogo completo.
export function actualizarChapaRecomendacion() {
    const chapa = document.getElementById('chapaRecomendacion');
    if (!chapa) return;
    chapa.hidden = !estado.recomendacion;
}

// Vuelve del modo recomendación al catálogo completo, conservando los filtros
// que el usuario haya puesto.
export function limpiarRecomendacion() {
    estado.recomendacion = null;
    actualizarChapaRecomendacion();
    mostrarResultados();
}

export function mostrarResultados() {
    // Si estamos en otra sección, enrutamos a su vista propia (esto permite
    // restaurar la sección desde la URL sin forzar siempre Educación Formal).
    if (estado.seccion === 'plataformas') { mostrarPlataformas(); return; }
    if (catalogosAparte[estado.seccion]) { mostrarCatalogoAparte(estado.seccion); return; }
    // Con el test hecho, la grilla es la lista de recomendaciones. Antes esto no
    // existía: cualquier filtro llamaba a filtrarYOrdenar() sobre el catálogo
    // entero y el ranking del Copiloto se perdía sin aviso.
    if (estado.recomendacion) { mostrarRecomendaciones(); return; }

    document.getElementById('seccion-plataformas').hidden = true;
    ocultarCatalogosAparte();
    document.getElementById('cardContainer').hidden = false;
    document.getElementById('resultsToolbar').hidden = false;
    actualizarSwitcherVistas();
    const accionesToolbar = document.querySelector('#resultsToolbar .toolbar-actions');
    if (accionesToolbar) accionesToolbar.hidden = false;

    const hayOtrosFiltros = estado.texto || 
        estado.formacion !== 'todos' || 
        estado.institucion !== 'todos' || 
        estado.departamento !== 'todos' || 
        estado.gestion !== 'todos' || 
        estado.modalidad !== 'todos' || 
        estado.costo !== 'todos' || 
        estado.duracion !== 'todos';

    // Vista de instituciones: solo cuando se eligió explícitamente y no hay
    // búsqueda ni filtros. Si la persona escribe o filtra, eso manda a la
    // grilla de carreras, no a la lista de instituciones. Muestra TODAS las
    // instituciones de una, agrupadas por tipo bajo su h2, sin drilldown.
    if (estado.vista === 'instituciones' && !hayOtrosFiltros) {
        document.getElementById('filtersSidebar').hidden = true;
        document.getElementById('mobileFilterButton').hidden = true;
        const accionesInst = document.querySelector('#resultsToolbar .toolbar-actions');
        if (accionesInst) accionesInst.hidden = true;
        renderizarListadoInstituciones();
        return;
    }

    // Drilldown por Áreas solo cuando ese es la vista elegida y no hay filtros
    // ni búsqueda. "Mostrar todas las carreras" (vista 'carreras') cae directo a
    // la grilla completa con filtros.
    if (estado.vista !== 'carreras' && !hayOtrosFiltros) {
        document.getElementById('filtersSidebar').hidden = true;
        document.getElementById('mobileFilterButton').hidden = true;
        if (estado.area === 'todos') {
            renderizarListadoAreas();
            return;
        } else {
            renderizarCarrerasDeArea(estado.area);
            return;
        }
    }

    document.getElementById('filtersSidebar').hidden = false;
    document.getElementById('mobileFilterButton').hidden = false;

    // Restaurar clases de grilla por defecto
    const contenedorGlobal = document.getElementById('cardContainer');
    if (contenedorGlobal) {
        contenedorGlobal.classList.remove('areas-grid', 'career-group-grid');
        contenedorGlobal.classList.add('results-grid');
    }

    resultadosActuales = filtrarYOrdenar();
    visibles = LIMITE_PAGINA;
    const contador = document.getElementById('resultsCount');

    // Sin coincidencias exactas: mejor mostrar lo más parecido a lo que buscó el
    // usuario que dejar la pantalla vacía.
    if (!resultadosActuales.length) {
        const btnMas = document.getElementById('cargarMas');
        if (btnMas) btnMas.hidden = true;
        const contenedor = document.getElementById('cardContainer');
        const relacionadas = obtenerRelacionadas();
        if (relacionadas.length) {
            const n = relacionadas.length;
            if (contador) contador.textContent = `0 resultados exactos · ${n} ${n === 1 ? 'sugerencia parecida' : 'sugerencias parecidas'}`;
            // El texto se adapta a lo que el usuario hizo: hablar de "tu
            // búsqueda" cuando solo tocó filtros, o de "esos filtros" cuando
            // solo escribió, sonaba a mensaje puesto de apuro.
            const hayTexto = Boolean(estado.texto);
            renderizarTarjetas(relacionadas, {
                encabezado: hayTexto
                    ? '<p class="results-suggest">No encontramos coincidencias exactas. <strong>Lo más parecido a lo que buscaste:</strong></p>'
                    : '<p class="results-suggest">No hay ofertas que cumplan todos esos filtros. <strong>Lo que más se acerca:</strong></p>'
            });
        } else {
            // Nada exacto y nada parecido. Antes acá se listaba el principio
            // del catálogo como si fueran sugerencias; ahora se dice lo que
            // pasa, y con la palabra buscada a la vista para que se note si
            // el problema es un tipeo.
            const escrito = (document.getElementById('searchInput')?.value || '').trim();
            if (contenedor) {
                contenedor.innerHTML = escrito
                    ? `<p class="empty-state">No encontramos nada parecido a <strong>«${escaparHTML(escrito)}»</strong>. Probá con otra palabra o revisá los filtros que tenés puestos.</p>`
                    : '<p class="empty-state">No hay ofertas que cumplan todos esos filtros a la vez. Probá quitar alguno.</p>';
            }
            if (contador) contador.textContent = '0 resultados encontrados';
        }
    } else {
        renderizarPagina();
    }

    mostrarPlataformasCoincidentes();
}

// Pinta solo la tanda actual de resultados y actualiza el contador y el botón
// "Cargar más". Deja el resto de la lógica de mostrarResultados intacta.
function renderizarPagina() {
    const contador = document.getElementById('resultsCount');
    const total = resultadosActuales.length;
    const mostradas = Math.min(visibles, total);
    const subtitulo = total > LIMITE_PAGINA ? ` (mostrando ${mostradas.toLocaleString('es-AR')} de ${total.toLocaleString('es-AR')})` : '';
    if (contador) contador.textContent = `${total.toLocaleString('es-AR')} ${total === 1 ? 'resultado encontrado' : 'resultados encontrados'}${subtitulo}`;
    renderizarTarjetas(resultadosActuales.slice(0, visibles));
    const btnMas = document.getElementById('cargarMas');
    if (btnMas) btnMas.hidden = visibles >= total;
}

export function cargarMas() {
    visibles += LIMITE_PAGINA;
    renderizarPagina();
}

function ocultarCargarMas() {
    const btn = document.getElementById('cargarMas');
    if (btn) btn.hidden = true;
}

// Puntúa cada carrera según cuánto se acerca a los filtros/búsqueda actuales.
// Sirve para, cuando no hay coincidencias exactas, mostrar las más cercanas.
function mostrarPlataformasCoincidentes() {
    const bloque = document.getElementById('plataformas-coincidentes');
    const coincidencias = estado.texto
        ? plataformas.filter(p => p.busqueda.includes(estado.texto))
        : [];
    bloque.hidden = !coincidencias.length;
    if (coincidencias.length) {
        renderizarPlataformas(document.getElementById('contenedor-plataformas-busqueda'), coincidencias);
    }
}

// El chip de duración de las tarjetas del catálogo formal. Muestra la duración
// ya interpretada ("4 años") en vez del texto crudo, que en 149 de 658 carreras
// era una oración entera y desbordaba la tarjeta. Cuando el original decía algo
// más, queda accesible en el title.
//
// Ojo: esto es solo para el catálogo formal. En plataformas y formaciones
// alternativas la duración es descriptiva y suele ser un rango ("De 2 a 6
// meses", "A ritmo propio"): ahí resumir a un número tergiversa el dato, así que
// esas tarjetas siguen mostrando el texto tal cual.
function chipDuracion(duracion) {
    const corta = duracionCorta(duracion);
    const original = limpiarTexto(duracion);
    const titulo = original && original !== corta ? ` title="${escaparHTML(original)}"` : '';
    return `<span${titulo}>${SVG_DURACION} ${escaparHTML(corta)}</span>`;
}

export function renderizarTarjetas(resultados, { mostrarMatch = false, encabezado = '' } = {}) {
    const contenedor = document.getElementById('cardContainer');
    if (!resultados.length) {
        contenedor.innerHTML = '<p class="empty-state">No encontramos ofertas con esos filtros. Probá ampliar tu búsqueda.</p>';
        return;
    }
    contenedor.innerHTML = encabezado + resultados.map(oferta => `
        <article class="card">
            <div class="card-badges">
                ${mostrarMatch ? `<span class="badge badge-match">${etiquetaCompatibilidad(oferta.score)}</span>` : ''}
                <span class="badge badge-categoria">${capSeguro(oferta.categoria)}</span>
                ${!oferta.fuente || oferta.fuente === 'formal' ? `<span class="badge badge-${oferta.gestion === 'pública' ? 'publica' : 'privada'}">${oferta.gestion === 'pública' ? (oferta.costo === 'arancelado' ? 'Pública · Aranc.' : 'Pública') : 'Privada'}</span>` : ''}
            </div>
            <h3 class="card-title">${capSeguro(oferta.nombre)}</h3>
            <div class="card-info">
                <p class="card-institucion-row">${SVG_INSTITUCION} <strong>${enlaceInstitucionBEN(oferta.institucion)}</strong></p>
                ${oferta.facultad ? `<p class="card-facultad-row">${SVG_FACULTAD} <span>${nombreSeguro(oferta.facultad)}</span></p>` : ''}
                <p class="card-meta-row"><span>${SVG_MODALIDAD} ${capSeguro(oferta.modalidad)}</span> <span class="card-meta-sep">·</span> ${chipDuracion(oferta.duracion)}</p>
            </div>
            <div class="card-cta-group">
                ${enlaceFichaBEN(oferta.nombre)}
                ${urlSegura(oferta.link) ? `<a class="card-link-oficial" href="${escaparHTML(urlSegura(oferta.link))}" target="_blank" rel="noopener nofollow" referrerpolicy="no-referrer">Sitio oficial ↗</a>` : ''}
            </div>
            <div class="card-actions">
                <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(oferta._clave)}" aria-label="Escuchar carrera">${ICONO_ESCUCHAR} <span>Escuchar</span></button>
            </div>
        </article>`).join('');
}
export function renderizarTarjetasConCompatibilidad(resultados, rankings) {
    const contenedor = document.getElementById('cardContainer');
    if (!resultados.length) {
        contenedor.innerHTML = '<p class="empty-state">No encontramos carreras compatibles con ese perfil. Probá rehacer el test.</p>';
        return;
    }
    
    contenedor.innerHTML = resultados.map(carrera => {
        const compat = carrera.compatibilidad || 0;
        const matchClass = compat >= 75 ? 'match-alto' : (compat >= 50 ? 'match-medio' : 'match-bajo');
        const coincidencias = carrera.coincidencias || [];
        const alertas = carrera.alertas || [];
        const instituciones = carrera.instituciones || [];
        const clave = carrera.clave || carrera.nombre;
        
        // Determinar badge de tipo de formación
        let tipoBadge = '';
        if (rankings.grados.some(r => r.clave === carrera.clave)) tipoBadge = '<span class="tipo-badge grado">Grado</span>';
        else if (rankings.tecnicaturas.some(r => r.clave === carrera.clave)) tipoBadge = '<span class="tipo-badge tecnica">Tecnicatura</span>';
        else if (rankings.cursos.some(r => r.clave === carrera.clave)) tipoBadge = '<span class="tipo-badge curso">Curso</span>';
        
        return `
        <article class="carrera-card ${matchClass}" data-carrera-id="${escaparHTML(clave)}">
            <div class="card-header">
                <h3>${capSeguro(carrera.nombre)}</h3>
                <div class="compatibilidad-badge ${matchClass}">${compat}% match</div>
            </div>
            ${tipoBadge || carrera.area ? `<div class="tipo-badges">${tipoBadge}${carrera.area ? '<span class="tipo-badge area">' + capSeguro(carrera.area) + '</span>' : ''}</div>` : ''}
            ${coincidencias.length ? `
            <div class="card-match-motivos">
                <strong>Por qué coincide:</strong>
                <ul class="motivos-list">
                    ${coincidencias.map(c => '<li>' + escaparHTML(c.label) + ': <em>' + escaparHTML(c.desc) + '</em></li>').join('')}
                </ul>
            </div>` : ''}
            ${alertas.length ? `
            <div class="card-alertas">
                <strong>⚠ Alertas:</strong>
                <ul class="alertas-list">
                    ${alertas.map(a => '<li>' + escaparHTML(a.mensaje) + '</li>').join('')}
                </ul>
            </div>` : ''}
            ${instituciones.length ? `
            <div class="card-instituciones">
                <strong>Instituciones:</strong>
                <ul class="instituciones-list">
                    ${instituciones.map(i => '<li>' + enlaceInstitucionBEN(i) + '</li>').join('')}
                </ul>
            </div>` : ''}
            ${enlaceFichaBEN(carrera.nombre)}
<div class="card-actions">
            <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(clave)}" aria-label="Escuchar carrera">${ICONO_ESCUCHAR} <span>Escuchar</span></button>
        </div>
        </article>`;
    }).join('');
}

export function actualizarBotonesActivos() {
    document.querySelectorAll('.filter-option').forEach(boton => {
        boton.classList.toggle('active', estado[boton.dataset.filter] === boton.dataset.value);
    });
}

// El cajón de filtros se esconde con translateX, que lo saca de la vista pero no
// del orden de tabulación: sin esto, en celular se tabulaba por ~35 botones
// invisibles antes de llegar a los resultados. Solo aplica en modo cajón; en
// escritorio el panel está a la vista y tiene que seguir siendo navegable.
const mqCajonFiltros = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 820px)')
    : { matches: false, addEventListener() {}, removeEventListener() {} };

export function sincronizarInertFiltros() {
    if (typeof document === 'undefined') return;
    const panel = document.getElementById('filtersSidebar');
    if (!panel) return;
    panel.inert = mqCajonFiltros.matches && !document.body.classList.contains('filters-open');
}

if (mqCajonFiltros && mqCajonFiltros.addEventListener) {
    mqCajonFiltros.addEventListener('change', sincronizarInertFiltros);
}

export function cambiarPanelFiltros(abrir) {
    document.body.classList.toggle('filters-open', abrir);
    document.getElementById('mobileFilterButton').setAttribute('aria-expanded', String(abrir));
    document.getElementById('filtersOverlay').setAttribute('aria-hidden', String(!abrir));
    sincronizarInertFiltros();
    // El foco sigue al panel al abrir y vuelve al botón al cerrar.
    const destino = document.getElementById(abrir ? 'closeFiltersButton' : 'mobileFilterButton');
    if (destino && mqCajonFiltros.matches) destino.focus();
}

// Comparador reutilizado por las vistas de drilldown (lista de áreas y carreras
// de un área) para respetar el "Ordenar por:" de la toolbar. Recibe tanto
// strings (nombres de área) como objetos de carrera agrupada.
function compararPorOrden(a, b) {
    const na = typeof a === 'string' ? a : a.nombre;
    const nb = typeof b === 'string' ? b : b.nombre;
    if (estado.orden === 'nombre-za') return nb.localeCompare(na, 'es');
    if (estado.orden === 'publica-primero' || estado.orden === 'privada-primero') {
        const ga = typeof a === 'string' ? null : a.gestiones;
        const gb = typeof b === 'string' ? null : b.gestiones;
        const target = estado.orden === 'publica-primero' ? 'pública' : 'privada';
        const pa = ga ? Number(ga.has(target)) : 0;
        const pb = gb ? Number(gb.has(target)) : 0;
        return (pb - pa) || na.localeCompare(nb, 'es');
    }
    return na.localeCompare(nb, 'es');
}

function renderizarListadoAreas() {
    const contador = document.getElementById('resultsCount');
    if (contador) contador.textContent = 'Seleccioná un área para ver las carreras';
    // En la vista de tarjetas de áreas el "Ordenar por" no aporta nada: no hay
    // carreras que ordenar. Aparece recién adentro de cada área.
    const accionesToolbar = document.querySelector('#resultsToolbar .toolbar-actions');
    if (accionesToolbar) accionesToolbar.hidden = true;
    const btnMas = document.getElementById('cargarMas');
    if (btnMas) btnMas.hidden = true;

    const areasObj = {};
    ofertas.forEach(o => {
        if (!areasObj[o.area]) {
            areasObj[o.area] = { count: 0, carreras: {} };
        }
        areasObj[o.area].count++;
        const nom = normalizarTexto(o.nombre);
        if (!areasObj[o.area].carreras[nom]) {
            areasObj[o.area].carreras[nom] = { nombre: o.nombre, count: 0 };
        }
        areasObj[o.area].carreras[nom].count++;
    });
    
    const areas = Object.keys(areasObj).sort(compararPorOrden);

    const contenedor = document.getElementById('cardContainer');
    contenedor.classList.remove('results-grid'); // Opcional, pero mejor usar la clase existente
    contenedor.classList.add('areas-grid');      // O agregar la nueva

    contenedor.innerHTML = areas.map(area => {
        const info = areasObj[area];
        const count = Object.keys(info.carreras).length;
        
        const curados = AREAS_EJEMPLOS_CURADOS[area];
        const topCarrerasHTML = ((curados ? curados : Object.values(info.carreras)
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
                .map(c => c.nombre)))
            .map(c => {
                let nombre = c;
                if (nombre === nombre.toUpperCase()) {
                    nombre = nombre.toLowerCase();
                }
                return `<li class="area-ejemplo-item">• ${escaparHTML(capSeguro(nombre))}</li>`;
            })
            .join('');

        return `
            <article class="card area-card" data-area="${escaparHTML(area)}">
                <div class="area-icon" aria-hidden="true">
                    ${ICONOS_AREAS[area] || ''}
                </div>
                <h3 class="card-title area-title">${escaparHTML(area)}</h3>
                <span class="area-count">${count} ${count === 1 ? 'carrera agrupada' : 'carreras agrupadas'}</span>
                <ul class="area-ejemplos-list">
                    ${topCarrerasHTML}
                </ul>
            </article>
        `;
    }).join('');

    contenedor.querySelectorAll('.area-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const area = e.currentTarget.dataset.area;
            estado.area = area;
            document.querySelectorAll('.filter-option[data-filter="area"]').forEach(btnFiltro => {
                if (btnFiltro.dataset.value === area) {
                    btnFiltro.classList.add('active');
                } else {
                    btnFiltro.classList.remove('active');
                }
            });
            actualizarVista();
            sincronizarURL();
            document.getElementById('cardContainer').scrollIntoView({ behavior: 'smooth' });
        });
    });
}

function renderizarCarrerasDeArea(area) {
    const btnMas = document.getElementById('cargarMas');
    if (btnMas) btnMas.hidden = true;

    const carrerasUnicas = {};
    ofertas.forEach(o => {
        if (o.area === area) {
            const nomNorm = normalizarTexto(o.nombre);
            if (!carrerasUnicas[nomNorm]) {
                carrerasUnicas[nomNorm] = {
                    nombre: o.nombre,
                    instituciones: 1,
                    modalidades: new Set(o.modalidades),
                    gestiones: new Set([o.gestion]),
                    duraciones: [o.duracionAnios]
                };
            } else {
                carrerasUnicas[nomNorm].instituciones++;
                if (o.modalidades) o.modalidades.forEach(m => carrerasUnicas[nomNorm].modalidades.add(m));
                carrerasUnicas[nomNorm].gestiones.add(o.gestion);
                carrerasUnicas[nomNorm].duraciones.push(o.duracionAnios);
            }
        }
    });

    const listado = Object.values(carrerasUnicas).sort(compararPorOrden);

    const contador = document.getElementById('resultsCount');
    if (contador) contador.textContent = `${listado.length} carreras en ${area}`;

    const contenedor = document.getElementById('cardContainer');
    
    // Configurar clases para la grilla
    contenedor.classList.remove('results-grid', 'areas-grid');
    contenedor.classList.add('career-group-grid');

    // Aquí no podemos poner el header y los cards al mismo nivel en una grilla si queremos que el header ocupe todo el ancho.
    // O bien usamos grid-column: 1 / -1 para el header, o volvemos a usar results-grid como contenedor global.
    // Usar grid-column: 1 / -1 en el CSS es mejor.
    
    contenedor.innerHTML = `
        <div class="area-header" style="grid-column: 1 / -1;">
            <button type="button" class="btn-volver-areas" id="btnVolverAreas">← Volver a todas las áreas</button>
            <h2 class="area-header-title">Área: ${escaparHTML(area)}</h2>
        </div>
        ${listado.map(c => {
            const slug = enlacesBEN.carreras[normalizarTexto(c.nombre)];
            const enlace = slug ? '/carrera/' + slug + '/' : '';
            const nInst = c.instituciones;
            
            const mods = Array.from(c.modalidades).map(m => capSeguro(m)).join(', ');
            
            const esPub = c.gestiones.has('pública');
            const esPriv = c.gestiones.has('privada');
            let badgeGestion = '';
            if (esPub && esPriv) badgeGestion = '<span class="badge badge-publica">Pública y Privada</span>';
            else if (esPub) badgeGestion = '<span class="badge badge-publica">Pública</span>';
            else if (esPriv) badgeGestion = '<span class="badge badge-privada">Privada</span>';
            
            const durs = c.duraciones.filter(d => typeof d === 'number' && !isNaN(d) && d > 0);
            let durText = "Duración variable";
            if (durs.length) {
                const min = Math.min(...durs);
                const max = Math.max(...durs);
                if (min === max) durText = formatearDuracionAnios(min);
                else durText = `De ${formatearDuracionAnios(min)} a ${formatearDuracionAnios(max)}`;
            }

            return `
                <article class="card career-group-card">
                    <div class="card-badges">
                        <span class="badge badge-area">${escaparHTML(area)}</span>
                        ${badgeGestion}
                    </div>
                    <h3 class="card-title career-group-title">${escaparHTML(c.nombre)}</h3>
                    <div class="card-info">
                        <p class="card-institucion-row">${SVG_INSTITUCION} <strong>${nInst} ${nInst === 1 ? 'institución' : 'instituciones'}</strong></p>
                        <p class="card-meta-row"><span>${SVG_MODALIDAD} ${escaparHTML(mods)}</span> <span class="card-meta-sep">·</span> <span>${SVG_DURACION} ${escaparHTML(durText)}</span></p>
                    </div>
                    ${enlace ? `<a class="card-link card-link-ben career-group-link" href="${escaparHTML(enlace)}">Ver lugares, info y plan de estudio →</a>` : '<span class="card-link card-link-muted">No hay ficha técnica</span>'}
                </article>
            `;
        }).join('')}
    `;

    document.getElementById('btnVolverAreas').addEventListener('click', () => {
        estado.area = 'todos';
        document.querySelectorAll('.filter-option[data-filter="area"]').forEach(btnFiltro => {
            if (btnFiltro.dataset.value === 'todos') {
                btnFiltro.classList.add('active');
            } else {
                btnFiltro.classList.remove('active');
            }
        });
        actualizarVista();
        sincronizarURL();
    });
}

// ==========================================
// 🏛️ VISTA DE INSTITUCIONES (por tipo)
// ==========================================

const TIPOS_INSTITUCION = [
    { tipo: 'universidades', etiqueta: 'Universidades' },
    { tipo: 'ies', etiqueta: 'Institutos de Educación Superior' },
    { tipo: 'centros', etiqueta: 'Centros de Formación y otros' }
];

// Instituciones únicas (con su tipo, departamento, gestión y cantidad de
// carreras) sacadas de las ofertas formales.
function institucionesUnicas() {
    const mapa = {};
    ofertas.forEach(o => {
        const nombre = o.institucion;
        if (!nombre) return;
        const k = normalizarTexto(nombre);
        if (!mapa[k]) {
            mapa[k] = {
                nombre,
                slug: enlacesBEN.instituciones ? enlacesBEN.instituciones[k] : undefined,
                tipo: o.tipoInstitucion || 'centros',
                departamento: o.departamento,
                gestion: o.gestion,
                carreras: new Set()
            };
        }
        mapa[k].carreras.add(normalizarTexto(o.nombre));
    });
    return Object.values(mapa).map(inst => Object.assign(inst, { nCarreras: inst.carreras.size }));
}

function tarjetaInstitucion(inst) {
    const slug = inst.slug;
    const badgeGestion = inst.gestion === 'pública'
        ? '<span class="badge badge-publica">Pública</span>'
        : (inst.gestion === 'privada' ? '<span class="badge badge-privada">Privada</span>' : '');
    const cta = slug
        ? `<a class="card-link card-link-ben career-group-link" href="/institucion/${escaparHTML(slug)}/">Ver carreras y planes de estudio →</a>`
        : '<span class="card-link card-link-muted">Sin ficha en BEN</span>';
    // El nombre de la institución es texto plano, sin link: el único punto de
    // navegación es el CTA "Ver carreras y planes de estudio →", así el título
    // no se ve azul/subrayado en la tarjeta. El tipo no se repite (el h2 del
    // grupo que lo agrupa ya lo dice): solo queda el badge de gestión.
    return `
        <article class="card career-group-card">
            <div class="card-badges">
                ${badgeGestion}
            </div>
            <h3 class="card-title career-group-title">${escaparHTML(nombreSeguro(inst.nombre))}</h3>
            <div class="card-info">
                <p class="card-institucion-row">${SVG_INSTITUCION} <strong>${escaparHTML(inst.departamento || 'Mendoza')}</strong></p>
                <p class="card-meta-row">${SVG_DURACION} <span>${inst.nCarreras} ${inst.nCarreras === 1 ? 'carrera' : 'carreras'}</span></p>
            </div>
            ${cta}
        </article>`;
}

function renderizarListadoInstituciones() {
    const instituciones = institucionesUnicas();
    const contador = document.getElementById('resultsCount');
    if (contador) contador.textContent = `${instituciones.length} instituciones · por tipo`;
    const btnMas = document.getElementById('cargarMas');
    if (btnMas) btnMas.hidden = true;

    const porTipo = {};
    instituciones.forEach(i => { (porTipo[i.tipo] = porTipo[i.tipo] || []).push(i); });

    const contenedor = document.getElementById('cardContainer');
    contenedor.classList.remove('results-grid', 'areas-grid', 'career-group-grid');

    contenedor.innerHTML = TIPOS_INSTITUCION.filter(g => porTipo[g.tipo]).map((g, indice) => {
        const lista = porTipo[g.tipo]
            .slice()
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        return `
            <section class="grupo-instituciones${indice > 0 ? ' grupo-instituciones-separado' : ''}">
                <div class="area-header">
                    <h2 class="area-header-title" id="tipo-${escaparHTML(g.tipo)}">${escaparHTML(g.etiqueta)}</h2>
                    <span class="grupo-instituciones-count">${lista.length} ${lista.length === 1 ? 'institución' : 'instituciones'}</span>
                </div>
                <div class="career-group-grid">
                    ${lista.map(tarjetaInstitucion).join('')}
                </div>
            </section>`;
    }).join('');
}

