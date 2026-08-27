// ==========================================
// Todo lo que pinta HTML: tarjetas, secciones, paginacion y el modal de
// comparar. Cada dato que entra a un innerHTML pasa por el escapado de util.js.
// ==========================================

import { etiquetaCompatibilidad } from './copiloto.js';
import { ETIQUETAS_FUENTE, buscarPorClave, catalogosAparte, enlacesBEN, ofertas, plataformas } from './datos.js';
import { LIMITE_PAGINA, comparador, enComparador, estaEnFavoritos, estado, favoritos, sincronizarURL } from './estado.js';
import { FILTROS_SOLO_FORMALES, cumpleFiltros, filtrarYOrdenar, obtenerRelacionadas } from './filtros.js';
import { capSeguro, escaparHTML, normalizarTexto, urlSegura } from './util.js';

// Enlace interno a la ficha que BEN tiene de esa carrera. Va antes que el del
// sitio oficial porque es el que mantiene a la persona adentro y el unico que
// reparte autoridad hacia las paginas propias: hasta ahora la portada, que es
// la pagina con mas peso del sitio, no enlazaba ni una sola de las suyas.
// Devuelve '' cuando esa formacion no tiene pagina generada.
function enlaceFichaBEN(nombre) {
    const slug = enlacesBEN.carreras[normalizarTexto(nombre)];
    return slug
        ? `<a class="card-link card-link-ben" href="/carrera/${slug}/">Ver dónde se estudia →</a>`
        : '';
}

function enlaceInstitucionBEN(nombre) {
    if (!nombre) return '';
    const slug = enlacesBEN.instituciones && enlacesBEN.instituciones[normalizarTexto(nombre)];
    return slug
        ? `<a href="/institucion/${slug}/" class="link-institucion">${escaparHTML(capSeguro(nombre))}</a>`
        : escaparHTML(capSeguro(nombre));
}

let resultadosActuales = [];
export let visibles = LIMITE_PAGINA;

// ---- Persistencia del estado en la URL (para compartir y restaurar) ----
export function actualizarVista() {
    actualizarBotonesActivos();
    mostrarResultados();
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
                <p>🏛️ <strong>${enlaceInstitucionBEN(curso.institucion)}</strong></p>
                ${curso.provincia ? `<p>📍 ${capSeguro(curso.provincia)}</p>` : ''}
                <p>⏳ ${capSeguro(curso.duracion)}</p>
            </div>
            ${enlaceFichaBEN(curso.nombre)}
            ${urlSegura(curso.link)
                ? `<a class="card-link" href="${escaparHTML(urlSegura(curso.link))}" target="_blank" rel="noopener nofollow" referrerpolicy="no-referrer">Ir al sitio oficial ↗</a>`
                : '<span class="card-link card-link-muted">Sin link oficial</span>'}
            <div class="card-actions">
                <button type="button" class="btn-comparar${enComparador(curso._clave) ? ' is-active' : ''}" data-clave="${escaparHTML(curso._clave)}" aria-pressed="${enComparador(curso._clave)}" title="Agregar a comparar">${enComparador(curso._clave) ? '✓' : '+'} <span>Comparar</span></button>
                <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(curso._clave)}" aria-label="Escuchar formación"><span aria-hidden="true">🔊</span> <span>Escuchar</span></button>
            </div>
        </article>`).join('');
}

// Variante simple de tarjeta: mismo diseño (.curso-card, con el borde y el tinte
// de la sección) pero solo nombre, descripción y link. Sin badges, sin duración
// ni modalidad, y sin favorito/comparar.
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
                <h3 class="platform-name">${capSeguro(plataforma.nombre)}</h3>
            </div>
            <p class="platform-summary">${capSeguro(plataforma.resumen)}</p>
            <div class="platform-meta">
                <span class="badge badge-modalidad">${capSeguro(plataforma.modalidad)}</span>
                <span class="badge">⏳ ${capSeguro(plataforma.duracion)}</span>
            </div>
            ${urlSegura(plataforma.url)
                ? `<a class="platform-link" href="${escaparHTML(urlSegura(plataforma.url))}" target="_blank" rel="noopener nofollow" referrerpolicy="no-referrer">Ver oferta en ${capSeguro(plataforma.nombre)} ↗</a>`
                : '<span class="platform-link platform-link-muted">Sitio oficial no disponible</span>'}
            <div class="card-actions">
                <button type="button" class="btn-comparar${enComparador(plataforma._clave) ? ' is-active' : ''}" data-clave="${escaparHTML(plataforma._clave)}" aria-pressed="${enComparador(plataforma._clave)}" title="Agregar a comparar">${enComparador(plataforma._clave) ? '✓' : '+'} <span>Comparar</span></button>
                <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(plataforma._clave)}" aria-label="Escuchar plataforma"><span aria-hidden="true">🔊</span> <span>Escuchar</span></button>
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
        && estado.duracionMin === null && estado.duracionMax === null
        && (estado.favoritos === false || favoritos.has(carrera.clave || carrera.nombre));
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

    const btnFav = document.getElementById('btnFavoritos');
    if (btnFav) btnFav.classList.toggle('active', estado.favoritos);
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
    document.getElementById('filtersSidebar').hidden = false;
    document.getElementById('mobileFilterButton').hidden = false;
    document.getElementById('cardContainer').hidden = false;
    document.getElementById('resultsToolbar').hidden = false;

    resultadosActuales = filtrarYOrdenar();
    visibles = LIMITE_PAGINA;
    const contador = document.getElementById('resultsCount');

    // Sin coincidencias exactas: mejor mostrar lo más parecido a lo que buscó el
    // usuario que dejar la pantalla vacía. (El filtro "solo favoritos" sin
    // favoritos es el único caso en el que no tiene sentido sugerir nada.)
    if (!resultadosActuales.length) {
        const btnMas = document.getElementById('cargarMas');
        if (btnMas) btnMas.hidden = true;
        const contenedor = document.getElementById('cardContainer');
        if (estado.favoritos) {
            if (contenedor) contenedor.innerHTML = '<p class="empty-state empty-favoritos">Aún no guardaste ninguna carrera en favoritos. <strong>Tocá la estrella ★</strong> en las tarjetas que te interesen para guardarlas acá.</p>';
            if (contador) contador.textContent = '0 favoritos guardados';
        } else {
            const relacionadas = obtenerRelacionadas();
            if (relacionadas.length) {
                if (contador) contador.textContent = `0 resultados exactos · ${relacionadas.length} sugerencias parecidas`;
                renderizarTarjetas(relacionadas, {
                    encabezado: '<p class="results-suggest">No encontramos coincidencias exactas con esos filtros. <strong>Lo más parecido a tu búsqueda:</strong></p>'
                });
            } else {
                renderizarTarjetas([]);
                if (contador) contador.textContent = '0 resultados encontrados';
            }
        }
    } else {
        renderizarPagina();
    }

    const btnFav = document.getElementById('btnFavoritos');
    if (btnFav) btnFav.classList.toggle('active', estado.favoritos);
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

// --- Búsqueda difusa + orden por relevancia ---
// Distancia de edición (Levenshtein) para tolerar errores de tipeo.
export function abrirComparar() { abrirCompararModal(); }

function abrirCompararModal() {
    const modal = document.getElementById('compararModal');
    if (!modal) return;
    const items = [...comparador].map(buscarPorClave).filter(Boolean);
    const cuerpo = document.getElementById('compararCuerpo');
    if (cuerpo) cuerpo.innerHTML = items.length ? construirTablaComparar(items) : '<p class="empty-state">No hay nada para comparar todavía.</p>';
    modal.hidden = false;
    modal.classList.add('abierto');
}

export function cerrarComparar() {
    const modal = document.getElementById('compararModal');
    if (modal) { modal.hidden = true; modal.classList.remove('abierto'); }
}

function construirTablaComparar(items) {
    const filas = [
        ['Institución', i => capSeguro(i.institucion || '—')],
        ['Categoría / Área', i => capSeguro(i.categoria || i.area || '—')],
        ['Modalidad', i => capSeguro(i.modalidad || '—')],
        ['Duración', i => capSeguro(i.duracion || '—')],
        ['Gestión / Costo', i => i.costo ? `${i.gestion === 'pública' ? 'Pública' : 'Privada'} · ${i.costo === 'arancelado' ? 'Arancelada' : 'Gratuita'}` : (i.gestion ? (i.gestion === 'pública' ? 'Pública (gratuita)' : 'Privada (arancelada)') : '—')],
        ['Sitio oficial', i => urlSegura(i.link || i.url) ? `<a href="${escaparHTML(urlSegura(i.link || i.url))}" target="_blank" rel="noopener nofollow" referrerpolicy="no-referrer">Ir ↗</a>` : '—']
    ];
    const encabezado = `<tr><th></th>${items.map(i => `<th>${escaparHTML(i.nombre)}</th>`).join('')}</tr>`;
    const cuerpo = filas.map(([etiqueta, fn]) => `<tr><th scope="row">${etiqueta}</th>${items.map(i => `<td>${fn(i)}</td>`).join('')}</tr>`).join('');
    const tabla = `<table class="tabla-comparar"><thead>${encabezado}</thead><tbody>${cuerpo}</tbody></table>`;
    // En móvil la tabla ancha no sirve: generamos una tarjeta por ítem, con cada
    // atributo como fila etiqueta/valor, y el CSS muestra una u otra según ancho.
    const movil = items.map(i => `
        <div class="comparar-item">
            <h3 class="comparar-item-titulo">${escaparHTML(i.nombre)}</h3>
            <dl class="comparar-item-lista">
                ${filas.map(([etiqueta, fn]) => `<div class="comparar-fila"><dt>${etiqueta}</dt><dd>${fn(i)}</dd></div>`).join('')}
            </dl>
        </div>`).join('');
    return `<div class="comparar-responsive">${tabla}<div class="comparar-movil">${movil}</div></div>`;
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
                ${oferta.fuente ? `<span class="badge badge-fuente">${escaparHTML(ETIQUETAS_FUENTE[oferta.fuente] || oferta.fuente)}</span>` : ''}
                <span class="badge">${capSeguro(oferta.categoria)}</span>
                <span class="badge badge-area">${capSeguro(oferta.area)}</span>
                ${!oferta.fuente || oferta.fuente === 'formal' ? `<span class="badge badge-${oferta.gestion === 'pública' ? 'publica' : 'privada'}">${oferta.gestion === 'pública' ? 'Pública' : 'Privada'}</span>` : ''}
                ${oferta.gestion === 'pública' && oferta.costo === 'arancelado' ? '<span class="badge badge-arancelada">Arancelada</span>' : ''}
                <span class="badge badge-modalidad">${capSeguro(oferta.modalidad)}</span>
            </div>
            <h3 class="card-title">${capSeguro(oferta.nombre)}</h3>
            <div class="card-info">
                <p>🏛️ <strong>${enlaceInstitucionBEN(oferta.institucion)}</strong></p>
                ${oferta.facultad ? `<p>🏫 ${capSeguro(oferta.facultad)}</p>` : ''}
                <p>📍 ${capSeguro(oferta.modalidad)}</p>
                <p>⏳ ${capSeguro(oferta.duracion)}</p>
            </div>
            ${enlaceFichaBEN(oferta.nombre)}
            ${urlSegura(oferta.link) ? `<a class="card-link" href="${escaparHTML(urlSegura(oferta.link))}" target="_blank" rel="noopener nofollow" referrerpolicy="no-referrer">Ir al sitio oficial ↗</a>` : '<span class="card-link card-link-muted">Formación online</span>'}
            <div class="card-actions">
                <button type="button" class="btn-favorito${estaEnFavoritos(oferta._clave) ? ' is-active' : ''}" data-clave="${escaparHTML(oferta._clave)}" aria-pressed="${estaEnFavoritos(oferta._clave)}" title="Guardar en favoritos">${estaEnFavoritos(oferta._clave) ? '★' : '☆'} <span>Favorito</span></button>
                <button type="button" class="btn-comparar${enComparador(oferta._clave) ? ' is-active' : ''}" data-clave="${escaparHTML(oferta._clave)}" aria-pressed="${enComparador(oferta._clave)}" title="Agregar a comparar">${enComparador(oferta._clave) ? '✓' : '+'} <span>Comparar</span></button>
                <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(oferta._clave)}" aria-label="Escuchar carrera"><span aria-hidden="true">🔊</span> <span>Escuchar</span></button>
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
                <button type="button" class="btn-favorito${estaEnFavoritos(clave) ? ' is-active' : ''}" data-clave="${escaparHTML(clave)}" aria-pressed="${estaEnFavoritos(clave)}" title="Guardar en favoritos">${estaEnFavoritos(clave) ? '★' : '☆'} <span>Favorito</span></button>
                <button type="button" class="btn-comparar${enComparador(clave) ? ' is-active' : ''}" data-clave="${escaparHTML(clave)}" aria-pressed="${enComparador(clave)}" title="Agregar a comparar">${enComparador(clave) ? '✓' : '+'} <span>Comparar</span></button>
                <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(clave)}" aria-label="Escuchar carrera"><span aria-hidden="true">🔊</span> <span>Escuchar</span></button>
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
const mqCajonFiltros = window.matchMedia('(max-width: 820px)');

export function sincronizarInertFiltros() {
    const panel = document.getElementById('filtersSidebar');
    if (!panel) return;
    panel.inert = mqCajonFiltros.matches && !document.body.classList.contains('filters-open');
}

mqCajonFiltros.addEventListener('change', sincronizarInertFiltros);

export function cambiarPanelFiltros(abrir) {
    document.body.classList.toggle('filters-open', abrir);
    document.getElementById('mobileFilterButton').setAttribute('aria-expanded', String(abrir));
    document.getElementById('filtersOverlay').setAttribute('aria-hidden', String(!abrir));
    sincronizarInertFiltros();
    // El foco sigue al panel al abrir y vuelve al botón al cerrar.
    const destino = document.getElementById(abrir ? 'closeFiltersButton' : 'mobileFilterButton');
    if (destino && mqCajonFiltros.matches) destino.focus();
}

