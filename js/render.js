// ==========================================
// Todo lo que pinta HTML: tarjetas, secciones y paginacion. Cada dato que entra
// a un innerHTML pasa por el escapado de util.js.
// ==========================================

import { ETIQUETAS_FUENTE, catalogosAparte, enlacesBEN, ofertas, plataformas } from './datos.js';
import { estado, sincronizarURL } from './estado.js';
import { FILTROS_SOLO_FORMALES, cumpleFiltros, filtrarYOrdenar, obtenerRelacionadas } from './filtros.js';
import { capSeguro, duracionCorta, escaparHTML, etiquetaCompatibilidad, limpiarTexto, nombreSeguro, normalizarTexto, urlSegura } from './util.js';

export const LIMITE_PAGINA = 24;

function slugFicha(nombre) {
    return enlacesBEN.carreras[normalizarTexto(nombre)] || '';
}

// Enlace interno a la ficha que BEN tiene de esa carrera. Va antes que el del
// sitio oficial porque es el que mantiene a la persona adentro y el unico que
// reparte autoridad hacia las paginas propias: hasta ahora la portada, que es
// la pagina con mas peso del sitio, no enlazaba ni una sola de las suyas.
// Devuelve '' cuando esa formacion no tiene pagina generada.
function enlaceFichaBEN(nombre) {
    const slug = slugFicha(nombre);
    return slug
        ? `<a class="card-link card-link-ben" href="/carrera/${slug}/">Ver más información →</a>`
        : '';
}

// Botón "Me interesa" de una tarjeta. El HTML y el comportamiento (guardar,
// avisar, sincronizar) los pone js/favoritos.js, que también corre en las
// páginas estáticas; acá solo se arma la ficha que viaja en el data-attribute.
// "clave" es lo que se guarda (la oferta puntual en la grilla formal) y
// "claveCarrera" el nombre normalizado que alimenta la Fase B del test.
function botonFavorito(item) {
    if (typeof window === 'undefined' || !window.Favoritos) return '';
    return window.Favoritos.botonHTML(item);
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

// Las dos formas de explorar la Educación Formal: la grilla completa con
// filtros (carreras) y el listado de instituciones. Es la misma fuente de
// verdad que usan los botones de la bienvenida: entrar a una vista siempre cae
// en su raíz, nunca en un drilldown viejo.
export function cambiarVista(vista) {
    if (vista !== 'carreras' && vista !== 'instituciones') return;
    // La vista de instituciones no se filtra con texto ni con los filtros de la
    // grilla: si llega con búsqueda o filtros activos, se limpian y la vista
    // muestra su raíz (todos los grupos por tipo). Es el mismo principio que el
    // comentario de abajo, aplicado desde afuera en vez de depender de la URL.
    if (vista === 'instituciones') resetearFiltros();
    estado.vista = vista;
    estado.tipoInstitucion = null;
    actualizarVista();
    sincronizarURL();
}

// Deja el estado y los controles del panel como si se acabara de entrar al
// sitio, pero no pinta nada: cada quien decide con qué vista sigue. Lo usan el
// botón "Limpiar filtros", el logo de BEN y cambiarVista() al entrar a la vista
// de instituciones, que siempre cae limpia en su raíz.
export function resetearFiltros() {
    Object.assign(estado, {
        texto: '', formacion: 'todos', institucion: 'todos', departamentos: [], gestion: 'todos',
        modalidad: 'todos', duracion: 'todos', area: 'todos', sectores: [],
        duracionMin: null, duracionMax: null, orden: 'default'
    });
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    const dMin = document.getElementById('durationMin');
    const dMax = document.getElementById('durationMax');
    if (dMin) dMin.value = '';
    if (dMax) dMax.value = '';
    const sort = document.getElementById('sortSelect');
    if (sort) sort.value = 'default';
    actualizarBotonesActivos();
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

// Pinta cuál de las dos vistas está activa; se llama desde mostrarResultados()
// para que acompañe a cualquier re-render.
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
    const tipo = seccion === 'oficios-tecnicos' ? 'oficio' : 'curso';
    const contenedor = document.getElementById(catalogo.contenedor);
    // Con rubros cargados (data/rubros-aparte.json), la sección se agrupa; si el
    // archivo falta, cae a la grilla plana de siempre.
    if (catalogo.rubros && catalogo.rubros.length) {
        contenedor.classList.add('cursos-grid-agrupado');
        renderizarCursosPorRubro(contenedor, visibles, catalogo, tipo);
    } else {
        contenedor.classList.remove('cursos-grid-agrupado');
        renderizarCursosAparte(contenedor, visibles, catalogo.simple, tipo);
    }
}

// Etiqueta del grupo final: los cursos sin rubro válido (archivo incompleto o
// curso nuevo que todavía no se clasificó) no desaparecen de la vista.
const SIN_RUBRO = 'sin-rubro';

// Render agrupado por rubro: un <li> por rubro en el orden fijo de la lista
// cerrada, con su h3, el contador y la grilla de tarjetas adentro. Los rubros
// sin cursos no se pintan; al buscar, quedan solo los grupos con coincidencias.
// Los títulos de curso bajan a h4 para no competir con el h3 del rubro.
function renderizarCursosPorRubro(contenedor, lista, catalogo, tipo = 'curso') {
    if (!lista.length) {
        contenedor.innerHTML = avisoLista('No hay formaciones que coincidan con esa búsqueda.');
        return;
    }
    const idsValidos = new Set(catalogo.rubros.map(r => r.id));
    const porRubro = new Map();
    lista.forEach(curso => {
        const id = idsValidos.has(curso.rubro) ? curso.rubro : SIN_RUBRO;
        if (!porRubro.has(id)) porRubro.set(id, []);
        porRubro.get(id).push(curso);
    });
    const grupos = [...catalogo.rubros.map(r => [r.id, r.nombre]), [SIN_RUBRO, 'Otras formaciones']]
        .filter(([id]) => porRubro.has(id));

    contenedor.innerHTML = grupos.map(([id, nombre], indice) => {
        const cursos = porRubro.get(id).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        return `
        <li class="grupo-rubro${indice > 0 ? ' grupo-rubro-separado' : ''}">
            <div class="rubro-header">
                <h3 class="rubro-header-title" id="rubro-${escaparHTML(id)}">${escaparHTML(nombre)}</h3>
                <span class="rubro-count">${cursos.length} ${cursos.length === 1 ? 'curso' : 'cursos'}</span>
            </div>
            <ul class="cursos-grid" role="list">
                ${cursos.map(curso => tarjetaCursoAparte(curso, tipo, 'h4')).join('')}
            </ul>
        </li>`;
    }).join('');
}

export function renderizarCursosAparte(contenedor, lista, simple = false, tipo = 'curso') {
    if (!lista.length) {
        contenedor.innerHTML = avisoLista('No hay formaciones que coincidan con esa búsqueda.');
        return;
    }
    if (simple) { renderizarCursosSimples(contenedor, lista, tipo); return; }
    contenedor.innerHTML = lista.map(curso => tarjetaCursoAparte(curso, tipo, 'h3')).join('');
}

// Tarjeta de un curso de los catálogos aparte. El nivel del encabezado es un
// parámetro porque la misma tarjeta se usa en la grilla plana (h3, colgando del
// h2 de la sección) y dentro de un grupo por rubro (h4, colgando del h3).
function tarjetaCursoAparte(curso, tipo, etiquetaTitulo = 'h3') {
    // El badge muestra el rubro cuando existe (la categoría es casi siempre la
    // misma "Curso / Formación Profesional" y no informa nada).
    const badge = curso.rubroNombre ? curso.rubroNombre : curso.categoria;
    return `
        <li class="curso-card">
            <div class="card-badges">
                <span class="badge badge-seccion">${capSeguro(badge)}</span>
                <span class="badge badge-modalidad">${capSeguro(curso.modalidad)}</span>
            </div>
            <${etiquetaTitulo} class="curso-title">${capSeguro(curso.nombre)}</${etiquetaTitulo}>
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
                ${botonFavorito({
                    clave: curso._clave, tipo, claveCarrera: '',
                    nombre: curso.nombre, institucion: curso.institucion || '',
                    area: '', formacion: '', ficha: '', link: urlSegura(curso.link) || ''
                })}
                <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(curso._clave)}" aria-label="Escuchar formación">${ICONO_ESCUCHAR} <span>Escuchar</span></button>
            </div>
        </li>`;
}

// Variante simple de tarjeta: mismo diseño (.curso-card, con el borde y el tinte
// de la sección) pero solo nombre, descripción y link. Sin badges ni duración.
// Ojo: acá NO se usa capitalizar(), que pasa todo a minúscula después de la
// primera letra y convertiría "CEBJA" en "Cebja".
function renderizarCursosSimples(contenedor, lista, tipo = 'secundario') {
    contenedor.innerHTML = lista.map(curso => `
        <li class="curso-card curso-card-simple">
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
            <div class="card-actions">
                ${botonFavorito({
                    clave: curso._clave, tipo, claveCarrera: '',
                    nombre: curso.nombre, institucion: curso.institucion || '',
                    area: '', formacion: '', ficha: '', link: urlSegura(curso.link) || ''
                })}
            </div>
        </li>`).join('');
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
        contenedor.innerHTML = avisoLista('No hay plataformas que coincidan con esa búsqueda.');
        return;
    }
    contenedor.innerHTML = lista.map(plataforma => `
        <li class="platform-card">
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
                ${botonFavorito({
                    clave: plataforma._clave, tipo: 'plataforma', claveCarrera: '',
                    nombre: plataforma.nombre, institucion: plataforma.nombre,
                    area: '', formacion: '', ficha: '', link: urlSegura(plataforma.url) || ''
                })}
                <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(plataforma._clave)}" aria-label="Escuchar plataforma">${ICONO_ESCUCHAR} <span>Escuchar</span></button>
            </div>
        </li>`).join('');
}

export // ==========================================
// 🧭 RECOMENDACIONES DEL COPILOTO
// ==========================================

// Índice nombre-normalizado -> ofertas formales con ese nombre. Las carreras del
// test vocacional son "carreras" abstractas (de perfiles-carreras.json), no
// ofertas de una institución concreta, así que para poder filtrarlas por
// gestión, modalidad o duración (y para compararlas en Mi lista) hay que volver
// a las ofertas que las dictan.
let indiceOfertasPorNombre = null;

export function ofertasDeCarrera(carrera) {
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

// Un filtro formal está "inactivo" si no aplica. Departamentos y sectores son
// multi-selección: inactivo = lista vacía. El resto son single-select: 'todos'.
function filtroInactivo(campo) {
    if (campo === 'departamento' || campo === 'sectores') return (estado[campo] || []).length === 0;
    return estado[campo] === 'todos';
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
        && FILTROS_SOLO_FORMALES.every(filtroInactivo)
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
        document.getElementById('cardContainer').innerHTML = avisoLista(
            'Ninguna de las carreras que te recomendé entra en esos filtros. ' +
            'Probá aflojar alguno, o volvé al catálogo completo con la chapita de arriba.');
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
        estado.departamentos.length > 0 ||
        estado.sectores.length > 0 ||
        estado.gestion !== 'todos' || 
        estado.modalidad !== 'todos' || 
        estado.duracion !== 'todos';

    // Vista de instituciones: muestra TODAS las instituciones de una, agrupadas
    // por tipo bajo su h2, sin drilldown. No admite los filtros de la grilla, así
    // que si hay búsqueda o filtros puestos (por ejemplo, al tipear estando
    // dentro de la vista) se pasa automáticamente a la grilla de carreras: el
    // buscador y el panel de filtros viven ahí.
    if (estado.vista === 'instituciones') {
        if (hayOtrosFiltros) {
            estado.vista = 'carreras';
        } else {
            document.getElementById('filtersSidebar').hidden = true;
            document.getElementById('mobileFilterButton').hidden = true;
            const accionesInst = document.querySelector('#resultsToolbar .toolbar-actions');
            if (accionesInst) accionesInst.hidden = true;
            renderizarListadoInstituciones();
            return;
        }
    }

    document.getElementById('filtersSidebar').hidden = false;
    document.getElementById('mobileFilterButton').hidden = false;

    // Restaurar clases de grilla por defecto
    const contenedorGlobal = document.getElementById('cardContainer');
    if (contenedorGlobal) {
        contenedorGlobal.classList.remove('career-group-grid');
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
                    ? avisoLista(`No encontramos nada parecido a <strong>«${escaparHTML(escrito)}»</strong>. Probá con otra palabra o revisá los filtros que tenés puestos.`)
                    : avisoLista('No hay ofertas que cumplan todos esos filtros a la vez. Probá quitar alguno.');
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

// WCAG 2.1 - 1.3.1: los contenedores de resultados ahora son <ul>, así que los
// avisos (sin resultados, encabezados de sugerencias) tienen que ser <li>.
function avisoLista(htmlInterior) {
    return `<li class="results-aviso"><p class="empty-state">${htmlInterior}</p></li>`;
}

export function renderizarTarjetas(resultados, { mostrarMatch = false, encabezado = '' } = {}) {
    const contenedor = document.getElementById('cardContainer');
    if (!resultados.length) {
        contenedor.innerHTML = avisoLista('No encontramos ofertas con esos filtros. Probá ampliar tu búsqueda.');
        return;
    }
    contenedor.innerHTML = (encabezado ? `<li class="results-aviso">${encabezado}</li>` : '') + resultados.map(oferta => `
        <li class="card">
            <div class="card-badges">
                ${mostrarMatch ? `<span class="badge badge-match">${etiquetaCompatibilidad(oferta.score)}</span>` : ''}
                <span class="badge badge-categoria">${capSeguro(oferta.categoria)}</span>
                ${!oferta.fuente || oferta.fuente === 'formal' ? `<span class="badge badge-${oferta.gestion === 'pública' ? 'publica' : 'privada'}">${oferta.gestion === 'pública' ? 'Pública' : 'Privada'}</span>` : ''}
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
                ${botonFavorito({
                    clave: oferta._clave, tipo: 'carrera', claveCarrera: normalizarTexto(oferta.nombre),
                    nombre: oferta.nombre, institucion: oferta.institucion,
                    area: oferta.area || '', formacion: oferta.formacion || '',
                    ficha: slugFicha(oferta.nombre), link: urlSegura(oferta.link) || ''
                })}
                <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(oferta._clave)}" aria-label="Escuchar carrera">${ICONO_ESCUCHAR} <span>Escuchar</span></button>
            </div>
        </li>`).join('');
}
export function renderizarTarjetasConCompatibilidad(resultados, rankings) {
    const contenedor = document.getElementById('cardContainer');
    if (!resultados.length) {
        contenedor.innerHTML = avisoLista('No encontramos carreras compatibles con ese perfil. Probá rehacer el test.');
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
        <li class="carrera-card ${matchClass}" data-carrera-id="${escaparHTML(clave)}">
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
            ${botonFavorito({
                clave: clave, tipo: 'carrera', claveCarrera: clave,
                nombre: carrera.nombre,
                institucion: instituciones.length === 1 ? instituciones[0] : (instituciones.length > 1 ? `${instituciones.length} instituciones` : ''),
                area: carrera.area || '', formacion: carrera.formacion || '',
                ficha: slugFicha(carrera.nombre), link: ''
            })}
            <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(clave)}" aria-label="Escuchar carrera">${ICONO_ESCUCHAR} <span>Escuchar</span></button>
        </div>
        </li>`;
    }).join('');
}

export function actualizarBotonesActivos() {
    document.querySelectorAll('.filter-option').forEach(boton => {
        const campo = boton.dataset.filter;
        const valor = boton.dataset.value;
        // Departamentos y sectores son multi-selección: un chip está activo si
        // su valor está en la lista, y "Todos" si la lista está vacía.
        const activo = (campo === 'departamento' || campo === 'sectores')
            ? (valor === 'todos'
                ? (estado[campo] || []).length === 0
                : (estado[campo] || []).includes(valor))
            : estado[campo] === valor;
        boton.classList.toggle('active', activo);
        // WCAG 2.1 - 4.1.2 Nombre, función, valor: sin aria-pressed el estado del
        // filtro viajaba solo en una clase CSS y un lector de pantalla leía
        // "Tecnicaturas, botón" sin saber si estaba aplicado.
        boton.setAttribute('aria-pressed', String(activo));
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
        <li class="card career-group-card">
            <div class="card-badges">
                ${badgeGestion}
            </div>
            <h3 class="card-title career-group-title">${escaparHTML(nombreSeguro(inst.nombre))}</h3>
            <div class="card-info">
                <p class="card-institucion-row">${SVG_INSTITUCION} <strong>${escaparHTML(inst.departamento || 'Mendoza')}</strong></p>
                <p class="card-meta-row">${SVG_DURACION} <span>${inst.nCarreras} ${inst.nCarreras === 1 ? 'carrera' : 'carreras'}</span></p>
            </div>
            ${cta}
        </li>`;
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
    contenedor.classList.remove('results-grid', 'career-group-grid');

    contenedor.innerHTML = TIPOS_INSTITUCION.filter(g => porTipo[g.tipo]).map((g, indice) => {
        const lista = porTipo[g.tipo]
            .slice()
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        return `
            <li class="grupo-instituciones${indice > 0 ? ' grupo-instituciones-separado' : ''}">
                <div class="area-header">
                    <h2 class="area-header-title" id="tipo-${escaparHTML(g.tipo)}">${escaparHTML(g.etiqueta)}</h2>
                    <span class="grupo-instituciones-count">${lista.length} ${lista.length === 1 ? 'institución' : 'instituciones'}</span>
                </div>
                <ul class="career-group-grid" role="list">
                    ${lista.map(tarjetaInstitucion).join('')}
                </ul>
            </li>`;
    }).join('');
}

