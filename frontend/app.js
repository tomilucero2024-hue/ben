// Carreras de instituciones formales (universidades, IES, terciarios).
const ofertas = [];
// Plataformas online: una entrada por plataforma, no por curso.
const plataformas = [];

const estado = {
    seccion: 'formal',
    texto: '', formacion: 'todos', institucion: 'todos', gestion: 'todos',
    modalidad: 'todos', costo: 'todos', duracion: 'todos', area: 'todos',
    duracionMin: null, duracionMax: null, orden: 'default', favoritos: false
};

// Favoritos y comparador, persistidos en localStorage (si el navegador lo permite).
const FAVORITOS_KEY = 'ben-favoritos';
const COMPARAR_KEY = 'ben-comparar';
function leerGuardado(clave) { try { return JSON.parse(localStorage.getItem(clave) || '[]'); } catch (e) { return []; } }
function escribirGuardado(clave, valor) { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {} }
const favoritos = new Set(leerGuardado(FAVORITOS_KEY));
const comparador = new Set(leerGuardado(COMPARAR_KEY));

// Paginación de resultados: mostramos de a tandas para no pintar las ~600
// tarjetas de una. El botón "Cargar más" revela la siguiente tanda.
const LIMITE_PAGINA = 24;
let resultadosActuales = [];
let visibles = LIMITE_PAGINA;

// ---- Persistencia del estado en la URL (para compartir y restaurar) ----
function sincronizarURL() {
    const p = new URLSearchParams();
    const seccion = estado.seccion;
    if (seccion !== 'formal') p.set('seccion', seccion);
    const q = document.getElementById('searchInput').value.trim();
    if (q) p.set('q', q);
    ['formacion', 'institucion', 'gestion', 'modalidad', 'costo', 'duracion', 'area', 'orden']
        .forEach(campo => { if (estado[campo] !== 'todos' && estado[campo] !== 'default') p.set(campo, estado[campo]); });
    if (estado.duracionMin !== null) p.set('dmin', estado.duracionMin);
    if (estado.duracionMax !== null) p.set('dmax', estado.duracionMax);
    if (estado.favoritos) p.set('favoritos', '1');
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function restaurarDesdeURL() {
    const p = new URLSearchParams(location.search);
    if (p.has('seccion')) estado.seccion = p.get('seccion');
    if (p.has('q')) { const q = p.get('q'); document.getElementById('searchInput').value = q; estado.texto = normalizarTexto(q); }
    ['formacion', 'institucion', 'gestion', 'modalidad', 'costo', 'duracion', 'area', 'orden']
        .forEach(campo => { if (p.has(campo)) estado[campo] = p.get(campo); });
    if (p.has('dmin')) estado.duracionMin = parseFloat(p.get('dmin'));
    if (p.has('dmax')) estado.duracionMax = parseFloat(p.get('dmax'));
    if (p.has('favoritos')) estado.favoritos = p.get('favoritos') === '1' || p.get('favoritos') === 'true';
    const sort = document.getElementById('sortSelect');
    if (sort) sort.value = estado.orden;
    const dMin = document.getElementById('durationMin');
    const dMax = document.getElementById('durationMax');
    if (dMin && estado.duracionMin !== null) dMin.value = estado.duracionMin;
    if (dMax && estado.duracionMax !== null) dMax.value = estado.duracionMax;
    sincronizarTabs();
}

function sincronizarTabs() {
    document.querySelectorAll('.section-tab').forEach(boton => {
        const activa = boton.dataset.seccion === estado.seccion;
        boton.classList.toggle('is-active', activa);
        boton.setAttribute('aria-pressed', String(activa));
    });
}

// Datos que no viven en data.json (su estructura no se toca): a dónde lleva cada
// plataforma y, opcionalmente, su logo.
//
// ▼▼▼ PARA AGREGAR LOS LOGOS ▼▼▼
// 1. Guardá cada imagen en  frontend/img/plataformas/  (ej: coderhouse.svg o .png).
// 2. Escribí el nombre del archivo en el campo "logo" de la plataforma:
//        'Coderhouse': { url: 'https://www.coderhouse.com/ar', logo: 'coderhouse.svg' },
// La tarjeta lo dibuja sola. Si "logo" queda vacío, no se muestra imagen y no se
// rompe nada: en su lugar aparece la inicial de la plataforma.
// ▲▲▲ ------------------------ ▲▲▲
//
// OJO: revisá que estas URLs sigan siendo las oficiales antes de publicar.
const PLATAFORMAS_INFO = {
    'Coderhouse':       { url: 'https://www.coderhouse.com/ar',    logo: '' },
    'Soy Henry':        { url: 'https://www.soyhenry.com',         logo: '' },
    'Educación IT':     { url: 'https://www.educacionit.com',      logo: '' },
    'Digital House':    { url: 'https://www.digitalhouse.com',     logo: '' },
    'Nucba':            { url: 'https://www.nucba.com.ar',         logo: '' },
    'Mindhub':          { url: 'https://www.mindhub.la',           logo: '' },
    'Image Campus':     { url: 'https://www.imagecampus.edu.ar',   logo: '' },
    'Escuela Da Vinci': { url: 'https://www.davinci.edu.ar',       logo: '' },
    'Teclab':           { url: 'https://www.teclab.edu.ar',        logo: '' },
    // Plataformas de acceso libre: se entra y se empieza cuando uno quiera, sin
    // convocatoria ni cupo por selección.
    'Fundación YPF':                    { url: 'https://lab.fundacionypf.org/formacion-digital',                  logo: '' },
    'Santander Open Academy':           { url: 'https://www.santanderopenacademy.com/es/index.html',              logo: '' },
    'ProgramON':                        { url: 'https://www.chicos.net/programon',                                logo: '' },
    'Microsoft Learn':                  { url: 'https://www.microsoft.com/es-ar/microsoft-learn',                 logo: '' },
    'Enlace 2.0 (Gobierno de Mendoza)': { url: 'https://www.mendoza.gov.ar/economia/entornodecapacitacion-enlace/', logo: '' }
};

const CARPETA_LOGOS = 'img/plataformas/';

// Grupos que viven en su propia clave de data.json y tienen vista propia. No se
// mezclan con las carreras de universidades ni con las plataformas, y NO pasan
// por getFormacion()/getArea(): esa clasificación es de la lista "instituciones"
// y acá metería un curso de piloto de drones junto a un profesorado.
const catalogosAparte = {
    'formaciones-alternativas': {
        clave: 'formaciones_alternativas',
        seccion: 'seccion-formaciones',
        contenedor: 'contenedor-formaciones',
        cursos: []
    },
    'oficios-tecnicos': {
        clave: 'oficios_tecnicos',
        seccion: 'seccion-oficios',
        contenedor: 'contenedor-oficios',
        cursos: []
    },
    'secundario': {
        clave: 'secundario',
        seccion: 'seccion-secundario',
        contenedor: 'contenedor-secundario',
        cursos: [],
        // Tarjeta simple: son cuatro puertas de entrada institucionales, no cursos
        // concretos. No tienen duración ni modalidad únicas (cada sede varía), así
        // que se muestran solo con nombre, descripción y link, y sin favorito ni
        // comparar: no hay nada que comparar entre "CENS" y "CEPAS" en una tabla.
        simple: true
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.body.dataset.seccion = estado.seccion;
    // Restaura filtros/sección/búsqueda desde la URL ANTES de arrancar, para que
    // el primer render ya respete un link compartido.
    restaurarDesdeURL();
    configurarTema();
    configurarEventos();
    configurarMedicionHeader();
    configurarHeaderScroll();
    cargarOfertas();
    inicializarOrientador();
    configurarChat();
    sincronizarInertFiltros();
    configurarBienvenida();
});

// ==========================================
// 🪄 HEADER COLAPSABLE AL HACER SCROLL
// ==========================================

// El progreso depende de la posición en la página: el header se despliega solo
// al volver al principio, no a mitad de página (expandido ocupa mucho lugar).
// Se mantiene compacto durante todo el resto del recorrido.
const UMBRAL = 170;

function calcularObjetivoHeader(y) {
    return Math.min(1, Math.max(0, y / UMBRAL));
}

function configurarHeaderScroll() {
    const hero = document.querySelector('.hero');
    let progreso = 0;
    let objetivo = 0;
    let animando = false;

    const aplicar = valor => {
        document.documentElement.style.setProperty('--scroll-progress', valor.toFixed(3));
        // El desenfoque se actualiza en escalones (6 valores) en vez de en cada
        // cuadro: recalcular el backdrop-filter 60 veces por segundo es lo más
        // caro para la GPU y era lo que trababa el scroll en celulares.
        document.documentElement.style.setProperty('--blur-progress', (Math.round(valor * 5) / 5).toFixed(1));
        hero.classList.toggle('hero--compacto', valor > 0.985);
    };

    function paso() {
        progreso += (objetivo - progreso) * 0.22;
        if (Math.abs(objetivo - progreso) < 0.002) progreso = objetivo;
        aplicar(progreso);

        if (progreso !== objetivo) {
            requestAnimationFrame(paso);
        } else {
            animando = false;
        }
    }

    function alHacerScroll() {
        objetivo = calcularObjetivoHeader(window.scrollY);

        if (!animando) {
            animando = true;
            requestAnimationFrame(paso);
        }
    }

    window.addEventListener('scroll', alHacerScroll, { passive: true });

    // Si la página carga con scroll ya restaurado (ej. al refrescar en mitad de
    // la página), sincroniza el header sin esperar al próximo scroll del usuario.
    if (window.scrollY > 0) {
        objetivo = calcularObjetivoHeader(window.scrollY);
        animando = true;
        requestAnimationFrame(paso);
    }
}

// El header pasa a position: fixed, así que su alto ya no empuja al contenido.
// Medimos cuánto mide expandido y lo guardamos para reservar ese espacio arriba:
// de lo contrario, achicarlo en cada cuadro reflotaría toda la página (632 tarjetas),
// que era la otra causa de que el scroll se sintiera trabado en celulares.
function medirAltoHeader() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const raiz = document.documentElement;
    const progresoActual = raiz.style.getPropertyValue('--scroll-progress');
    raiz.style.setProperty('--scroll-progress', '0');
    const alto = hero.offsetHeight;
    raiz.style.setProperty('--scroll-progress', progresoActual || '0');
    raiz.style.setProperty('--hero-alto', `${alto}px`);
}

function configurarMedicionHeader() {
    medirAltoHeader();
    window.addEventListener('load', medirAltoHeader);
    let temporizador;
    window.addEventListener('resize', () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => {
            medirAltoHeader();
            // Respaldo del listener de matchMedia: si el cambio de breakpoint no
            // dispara 'change', el panel quedaría inert en escritorio y sin
            // acceso por teclado a los filtros.
            sincronizarInertFiltros();
        }, 150);
    });
}


function configurarTema() {
    const boton = document.getElementById('themeToggle');

    const logo = document.getElementById('brandLogo');

    const actualizarControl = () => {
        const esOscuro = document.documentElement.dataset.theme === 'dark';
        boton.setAttribute('aria-pressed', String(esOscuro));
        boton.setAttribute('aria-label', esOscuro ? 'Activar modo claro' : 'Activar modo oscuro');
        boton.title = esOscuro ? 'Activar modo claro' : 'Activar modo oscuro';
        // Un solo <img> que cambia de fuente: así se baja un logo y no dos.
        if (logo) logo.src = esOscuro ? 'logo-ben-dark.png' : 'logo-ben-light.png';
        // El logo de la pantalla de bienvenida sigue el mismo tema.
        const logoBienvenida = document.getElementById('bienvenidaLogo');
        if (logoBienvenida) logoBienvenida.src = esOscuro ? 'logo-ben-dark.png' : 'logo-ben-light.png';
    };

    boton.addEventListener('click', () => {
        const siguiente = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = siguiente;
        document.documentElement.style.colorScheme = siguiente;
        localStorage.setItem('ben-theme', siguiente);
        actualizarControl();
    });

    actualizarControl();
}

async function cargarOfertas() {
    try {
        const respuesta = await fetch('../data/data.json');
        if (!respuesta.ok) throw new Error('No se pudo cargar data.json');
        const data = await respuesta.json();

        (data.instituciones || []).forEach(institucion => {
            (institucion.carreras || []).forEach(carrera => ofertas.push(crearOferta(carrera, institucion)));
        });
        // Las plataformas van por separado: son su propia sección, no carreras sueltas.
        (data.plataformas || []).forEach(plataforma => plataformas.push(crearPlataforma(plataforma)));
        // Ídem los catálogos aparte: cada uno lee su propia clave de data.json.
        Object.values(catalogosAparte).forEach(catalogo => {
            (data[catalogo.clave] || []).forEach(institucion => {
                (institucion.carreras || []).forEach(carrera =>
                    catalogo.cursos.push(crearCursoAparte(carrera, institucion)));
            });
        });
        actualizarVista();
    } catch (error) {
        console.error(error);
        document.getElementById('cardContainer').innerHTML = '<p class="empty-state">No se pudieron cargar las ofertas. Probá abrir la página con Live Server.</p>';
    }
}
// Inicializar Orientador con perfiles de carreras y ofertas
async function inicializarOrientador() {
    try {
        await Orientador.cargarPerfilesCarreras();
        Orientador.setOfertasIndex(ofertas);
        console.log('Orientador inicializado correctamente');
    } catch (e) {
        console.warn('No se pudo inicializar Orientador:', e);
    }
}


function crearOferta(carrera, institucion) {
    const nombre = limpiarTexto(carrera.nombre_carrera || 'Carrera sin nombre');
    const modalidad = carrera.modalidad || 'Presencial';
    const gestion = inferirGestion(institucion);
    return {
        nombre, categoria: limpiarTexto(carrera.categoria || 'General'), duracion: limpiarTexto(carrera.duracion || 'No especificada'),
        modalidad, facultad: limpiarTexto(carrera.facultad || ''), link: carrera.link_oficial || '',
        institucion: limpiarTexto(institucion.nombre || 'Institución'), gestion, tipoInstitucion: inferirTipoInstitucion(institucion),
        esPlataforma: false,
        formacion: getFormacion(carrera), area: getArea({ nombre_carrera: nombre }),
        duracionAnios: obtenerDuracionEnAnios(carrera.duracion), modalidades: obtenerModalidades(modalidad),
        costo: esCarreraArancelada(institucion, nombre) ? 'arancelado' : (gestion === 'pública' ? 'gratuito' : 'arancelado'),
        _clave: `institucion:${limpiarTexto(institucion.nombre || '')}:${nombre}`
    };
}

function crearPlataforma(plataforma) {
    const nombre = limpiarTexto(plataforma.institucion || 'Plataforma online');
    // La descripción sale del campo "oferta" de data.json, que ya resume qué enseña.
    const resumen = limpiarTexto(plataforma.oferta || 'Formación online');
    const info = PLATAFORMAS_INFO[nombre] || {};
    return {
        nombre,
        resumen,
        modalidad: limpiarTexto(plataforma.modalidad || 'Online'),
        duracion: limpiarTexto(plataforma.duracion || 'Variable'),
        url: info.url || '',
        logo: info.logo || '',
        // Texto sobre el que busca el buscador de arriba.
        busqueda: normalizarTexto(`${nombre} ${resumen}`),
        _clave: `plataforma:${nombre}`
    };
}

// Modelo de una formación de los catálogos aparte. Se queda con la "categoria"
// que ya trae el dato en vez de recalcular el tipo de formación.
function crearCursoAparte(carrera, institucion) {
    const nombre = limpiarTexto(carrera.nombre_carrera || 'Formación sin nombre');
    const nombreInstitucion = limpiarTexto(institucion.nombre || 'Institución');
    const categoria = limpiarTexto(carrera.categoria || 'Formación');
    // Opcionales: solo los traen los catálogos de tarjeta simple (ver `simple`).
    const descripcion = limpiarTexto(carrera.descripcion || '');
    const nombreCompleto = limpiarTexto(carrera.nombre_completo || '');
    return {
        nombre,
        nombreCompleto,
        descripcion,
        institucion: nombreInstitucion,
        categoria,
        modalidad: limpiarTexto(carrera.modalidad || 'A confirmar'),
        duracion: limpiarTexto(carrera.duracion || 'A confirmar'),
        provincia: limpiarTexto(institucion.provincia || ''),
        link: carrera.link_oficial || '',
        busqueda: normalizarTexto(`${nombre} ${nombreCompleto} ${descripcion} ${nombreInstitucion} ${categoria}`),
        _clave: `aparte:${nombreInstitucion}:${nombre}`
    };
}

function configurarEventos() {
    let esperaBusqueda;
    document.getElementById('searchInput').addEventListener('input', event => {
        clearTimeout(esperaBusqueda);
        esperaBusqueda = setTimeout(() => {
            estado.texto = normalizarTexto(event.target.value.trim());
            // Buscar dentro de la sección en la que está parado el usuario.
            if (estado.seccion === 'plataformas') mostrarPlataformas();
            else if (catalogosAparte[estado.seccion]) mostrarCatalogoAparte(estado.seccion);
            else mostrarResultados();
            sincronizarURL();
        }, 200);
    });

    document.querySelectorAll('.filter-option').forEach(boton => {
        boton.addEventListener('click', () => {
            estado[boton.dataset.filter] = boton.dataset.value;
            if (boton.dataset.filter === 'duracion') {
                estado.duracionMin = null;
                estado.duracionMax = null;
                document.getElementById('durationMin').value = '';
                document.getElementById('durationMax').value = '';
            }
            actualizarBotonesActivos();
            mostrarResultados();
            sincronizarURL();
        });
    });

    document.getElementById('applyDurationButton').addEventListener('click', aplicarRangoDuracion);
    ['durationMin', 'durationMax'].forEach(id => document.getElementById(id).addEventListener('keydown', event => {
        if (event.key === 'Enter') aplicarRangoDuracion();
    }));

    document.getElementById('sortSelect').addEventListener('change', event => {
        estado.orden = event.target.value;
        mostrarResultados();
        sincronizarURL();
    });
    document.getElementById('clearFiltersButton').addEventListener('click', limpiarFiltros);

    document.querySelectorAll('.section-tab').forEach(boton => {
        boton.addEventListener('click', () => cambiarSeccion(boton.dataset.seccion));
    });

    const abrir = () => cambiarPanelFiltros(true);
    document.getElementById('mobileFilterButton').addEventListener('click', abrir);
    document.getElementById('closeFiltersButton').addEventListener('click', () => cambiarPanelFiltros(false));
    document.getElementById('filtersOverlay').addEventListener('click', () => cambiarPanelFiltros(false));

    const btnFavoritos = document.getElementById('btnFavoritos');
    if (btnFavoritos) btnFavoritos.addEventListener('click', () => {
        estado.favoritos = !estado.favoritos;
        mostrarResultados();
        sincronizarURL();
    });

    const btnCargarMas = document.getElementById('cargarMas');
    if (btnCargarMas) btnCargarMas.addEventListener('click', cargarMas);

    // Delegación para los botones de las tarjetas (favorito / comparar), que se
    // re-renderizan con frecuencia: un solo listener en document alcanza para todas.
    document.addEventListener('click', event => {
        const botonFav = event.target.closest('.btn-favorito');
        if (botonFav) { toggleFavorito(botonFav.dataset.clave); return; }
        const botonCmp = event.target.closest('.btn-comparar');
        if (botonCmp) { toggleComparar(botonCmp.dataset.clave); return; }
    });

    const compararLimpiar = document.getElementById('compararLimpiar');
    if (compararLimpiar) compararLimpiar.addEventListener('click', () => {
        comparador.clear();
        escribirGuardado(COMPARAR_KEY, []);
        document.querySelectorAll('.btn-comparar').forEach(b => b.classList.remove('is-active'));
        actualizarBarraComparar();
    });

    const compararAbrir = document.getElementById('compararAbrir');
    if (compararAbrir) compararAbrir.addEventListener('click', abrirComparar);

    const modalComparar = document.getElementById('compararModal');
    if (modalComparar) {
        modalComparar.addEventListener('click', event => { if (event.target === modalComparar) cerrarComparar(); });
    }
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        // De más superficial a más profundo: se cierra una capa por vez.
        const m = document.getElementById('compararModal');
        if (m && !m.hidden) { cerrarComparar(); return; }
        if (document.body.classList.contains('filters-open')) { cambiarPanelFiltros(false); return; }
        const panel = document.getElementById('copilotoPanel');
        if (panel && panel.classList.contains('is-test-pantalla-completa')) { salirDelTest(); return; }
        const ventana = document.getElementById('ventana-chat');
        if (ventana && !ventana.hidden) { cerrarChat(); return; }
        // La bienvenida es la puerta de entrada del sitio y no se cierra con Escape.
    });

    actualizarBarraComparar();
    document.querySelectorAll('.btn-comparar').forEach(b => b.classList.toggle('is-active', comparador.has(b.dataset.clave)));
    document.querySelectorAll('.btn-favorito').forEach(b => b.classList.toggle('is-active', favoritos.has(b.dataset.clave)));
}

function aplicarRangoDuracion() {
    const minimo = parseFloat(document.getElementById('durationMin').value);
    const maximo = parseFloat(document.getElementById('durationMax').value);
    estado.duracionMin = Number.isFinite(minimo) ? minimo : null;
    estado.duracionMax = Number.isFinite(maximo) ? maximo : null;
    if (estado.duracionMin !== null && estado.duracionMax !== null && estado.duracionMin > estado.duracionMax) {
        [estado.duracionMin, estado.duracionMax] = [estado.duracionMax, estado.duracionMin];
        document.getElementById('durationMin').value = estado.duracionMin;
        document.getElementById('durationMax').value = estado.duracionMax;
    }
    estado.duracion = 'todos';
    actualizarBotonesActivos();
    mostrarResultados();
    sincronizarURL();
}

function limpiarFiltros() {
    Object.assign(estado, {
        texto: '', formacion: 'todos', institucion: 'todos', gestion: 'todos', modalidad: 'todos',
        costo: 'todos', duracion: 'todos', area: 'todos', duracionMin: null, duracionMax: null, orden: 'default'
    });
    document.getElementById('searchInput').value = '';
    document.getElementById('durationMin').value = '';
    document.getElementById('durationMax').value = '';
    document.getElementById('sortSelect').value = 'default';
    actualizarBotonesActivos();
    mostrarResultados();
    sincronizarURL();
}

function actualizarVista() {
    actualizarBotonesActivos();
    mostrarResultados();
}

// ==========================================
// 🎓 / 💻 SECCIONES PRINCIPALES
// ==========================================

function cambiarSeccion(seccion) {
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

function mostrarCatalogoAparte(seccion) {
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

function renderizarCursosAparte(contenedor, lista, simple = false) {
    if (!lista.length) {
        contenedor.innerHTML = '<p class="empty-state">No hay formaciones que coincidan con esa búsqueda.</p>';
        return;
    }
    if (simple) { renderizarCursosSimples(contenedor, lista); return; }
    contenedor.innerHTML = lista.map(curso => `
        <article class="curso-card">
            <div class="card-badges">
                <span class="badge badge-seccion">${capitalizar(curso.categoria)}</span>
                <span class="badge badge-modalidad">${capitalizar(curso.modalidad)}</span>
            </div>
            <h3 class="curso-title">${capitalizar(curso.nombre)}</h3>
            <div class="card-info">
                <p>🏛️ <strong>${capitalizar(curso.institucion)}</strong></p>
                ${curso.provincia ? `<p>📍 ${capitalizar(curso.provincia)}</p>` : ''}
                <p>⏳ ${capitalizar(curso.duracion)}</p>
            </div>
            ${curso.link
                ? `<a class="card-link" href="${curso.link}" target="_blank" rel="noopener noreferrer">Ir al sitio oficial ↗</a>`
                : '<span class="card-link card-link-muted">Sin link oficial</span>'}
            <div class="card-actions">
                <button type="button" class="btn-favorito${estaEnFavoritos(curso._clave) ? ' is-active' : ''}" data-clave="${curso._clave}" aria-pressed="${estaEnFavoritos(curso._clave)}" title="Guardar en favoritos">${estaEnFavoritos(curso._clave) ? '★' : '☆'} <span>Favorito</span></button>
                <button type="button" class="btn-comparar${enComparador(curso._clave) ? ' is-active' : ''}" data-clave="${curso._clave}" aria-pressed="${enComparador(curso._clave)}" title="Agregar a comparar">${enComparador(curso._clave) ? '✓' : '+'} <span>Comparar</span></button>
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
            ${curso.link
                ? `<a class="card-link" href="${curso.link}" target="_blank" rel="noopener noreferrer">Ver más en mendoza.edu.ar ↗</a>`
                : '<span class="card-link card-link-muted">Sin link oficial</span>'}
        </article>`).join('');
}

function ocultarCatalogosAparte() {
    Object.values(catalogosAparte).forEach(catalogo => {
        document.getElementById(catalogo.seccion).hidden = true;
    });
}

function mostrarPlataformas() {
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

function renderizarPlataformas(contenedor, lista) {
    if (!lista.length) {
        contenedor.innerHTML = '<p class="empty-state">No hay plataformas que coincidan con esa búsqueda.</p>';
        return;
    }
    contenedor.innerHTML = lista.map(plataforma => `
        <article class="platform-card">
            <div class="platform-head">
                ${plataforma.logo
                    ? `<img class="platform-logo" src="${CARPETA_LOGOS}${plataforma.logo}" alt="Logo de ${plataforma.nombre}" loading="lazy">`
                    : `<span class="platform-logo platform-logo-vacio" aria-hidden="true">${plataforma.nombre.charAt(0)}</span>`}
                <h3 class="platform-name">${capitalizar(plataforma.nombre)}</h3>
            </div>
            <p class="platform-summary">${capitalizar(plataforma.resumen)}</p>
            <div class="platform-meta">
                <span class="badge badge-modalidad">${capitalizar(plataforma.modalidad)}</span>
                <span class="badge">⏳ ${capitalizar(plataforma.duracion)}</span>
            </div>
            ${plataforma.url
                ? `<a class="platform-link" href="${plataforma.url}" target="_blank" rel="noopener noreferrer">Ver oferta en ${capitalizar(plataforma.nombre)} ↗</a>`
                : '<span class="platform-link platform-link-muted">Sitio oficial no disponible</span>'}
            <div class="card-actions">
                <button type="button" class="btn-favorito${estaEnFavoritos(plataforma._clave) ? ' is-active' : ''}" data-clave="${plataforma._clave}" aria-pressed="${estaEnFavoritos(plataforma._clave)}" title="Guardar en favoritos">${estaEnFavoritos(plataforma._clave) ? '★' : '☆'} <span>Favorito</span></button>
                <button type="button" class="btn-comparar${enComparador(plataforma._clave) ? ' is-active' : ''}" data-clave="${plataforma._clave}" aria-pressed="${enComparador(plataforma._clave)}" title="Agregar a comparar">${enComparador(plataforma._clave) ? '✓' : '+'} <span>Comparar</span></button>
            </div>
        </article>`).join('');
}

function mostrarResultados() {
    // Si estamos en otra sección, enrutamos a su vista propia (esto permite
    // restaurar la sección desde la URL sin forzar siempre Educación Formal).
    if (estado.seccion === 'plataformas') { mostrarPlataformas(); return; }
    if (catalogosAparte[estado.seccion]) { mostrarCatalogoAparte(estado.seccion); return; }

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

function cargarMas() {
    visibles += LIMITE_PAGINA;
    renderizarPagina();
}

function ocultarCargarMas() {
    const btn = document.getElementById('cargarMas');
    if (btn) btn.hidden = true;
}

// Puntúa cada carrera según cuánto se acerca a los filtros/búsqueda actuales.
// Sirve para, cuando no hay coincidencias exactas, mostrar las más cercanas.
function puntuacionRelacion(oferta) {
    let score = 0;
    const texto = estado.texto;
    if (texto) {
        const hay = normalizarTexto(`${oferta.nombre} ${oferta.institucion} ${oferta.facultad} ${oferta.area}`);
        const palabras = texto.split(/\s+/).filter(Boolean);
        if (palabras.length) {
            const presentes = palabras.filter(p => hay.includes(p)).length;
            score += (presentes / palabras.length) * 100;
        }
    }
    if (estado.area !== 'todos' && oferta.area === estado.area) score += 30;
    if (estado.formacion !== 'todos' && oferta.formacion === estado.formacion) score += 20;
    if (estado.gestion !== 'todos' && oferta.gestion === estado.gestion) score += 15;
    if (estado.modalidad !== 'todos' && oferta.modalidades.includes(estado.modalidad)) score += 15;
    if (estado.institucion !== 'todos' && oferta.tipoInstitucion === estado.institucion) score += 15;
    if (estado.costo !== 'todos' && (oferta.costo || (oferta.gestion === 'pública' ? 'gratuito' : 'arancelado')) === estado.costo) score += 10;
    if (estado.duracion !== 'todos') {
        const grupo = getGrupoDuracion(oferta.duracionAnios);
        if (grupo === estado.duracion) score += 10;
    }
    return score;
}

function obtenerRelacionadas(limite = 6) {
    const puntuadas = ofertas
        .map(oferta => ({ oferta, score: puntuacionRelacion(oferta) }))
        .sort((a, b) => b.score - a.score);
    // Si hay algo de texto o filtros, priorizamos las que sumaron puntos; si todo
    // dio 0 (filtros imposibles entre sí), igual devolvemos las primeras para no
    // dejar la pantalla vacía.
    const conPuntos = puntuadas.filter(p => p.score > 0);
    const elegidas = (conPuntos.length ? conPuntos : puntuadas).slice(0, limite);
    return elegidas.map(p => p.oferta);
}

// Si el usuario busca texto dentro de Educación Formal, las plataformas que
// coincidan aparecen igual, en su propio bloque y con el color de su sección.
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
function distanciaLevenshtein(a, b) {
    a = a || ''; b = b || '';
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let curr = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const costo = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + costo);
        }
        [prev, curr] = [curr, prev];
    }
    return prev[n];
}

// Cuánto se parece una palabra del índice a un token de la búsqueda.
function puntuarPar(palabra, token) {
    if (!token) return 0;
    if (palabra === token) return 100;
    if (palabra.startsWith(token) || token.startsWith(palabra)) return 85;
    if (palabra.includes(token) || token.includes(palabra)) return 65;
    const d = distanciaLevenshtein(palabra, token);
    const maxLen = Math.max(palabra.length, token.length, 1);
    const tolerancia = Math.max(1, Math.round(maxLen * 0.34));
    if (d <= tolerancia) return Math.round(45 * (1 - d / (tolerancia + 1)));
    return 0;
}

// Score total de una oferta frente a la búsqueda actual (0 si no hay texto).
function puntuacionBusqueda(oferta) {
    const texto = estado.texto;
    if (!texto) return 0;
    const hay = normalizarTexto(`${oferta.nombre} ${oferta.institucion} ${oferta.facultad} ${oferta.area} ${oferta.categoria}`);
    const palabras = hay.split(/\s+/).filter(Boolean);
    const tokens = texto.split(/\s+/).filter(Boolean);
    let score = 0;
    for (const token of tokens) {
        let mejor = 0;
        if (token.length >= 2) {
            for (const pal of palabras) mejor = Math.max(mejor, puntuarPar(pal, token));
        } else {
            mejor = palabras.includes(token) ? 100 : 0;
        }
        if (hay.includes(token)) mejor = Math.max(mejor, 70);
        score += mejor;
    }
    return score;
}

// Filtro de texto tolerante: la oferta pasa si algún token de la búsqueda tiene
// alguna coincidencia (exacta, prefijo, subcadena o difusa) en su texto.
function coincideTexto(oferta) {
    const texto = estado.texto;
    if (!texto) return true;
    const hay = normalizarTexto(`${oferta.nombre} ${oferta.institucion} ${oferta.facultad} ${oferta.area} ${oferta.categoria}`);
    const palabras = hay.split(/\s+/).filter(Boolean);
    const tokens = texto.split(/\s+/).filter(Boolean);
    return tokens.some(token => {
        if (token.length < 2) return palabras.includes(token);
        return palabras.some(pal => puntuarPar(pal, token) > 0);
    });
}

function filtrarYOrdenar() {
    const coincide = oferta => {
        const tieneRango = estado.duracionMin !== null || estado.duracionMax !== null;
        const enRango = !tieneRango ? true : oferta.duracionAnios !== null
            && (estado.duracionMin === null || oferta.duracionAnios >= estado.duracionMin)
            && (estado.duracionMax === null || oferta.duracionAnios <= estado.duracionMax);
        return coincideTexto(oferta)
            && (estado.formacion === 'todos' || oferta.formacion === estado.formacion)
            && (estado.institucion === 'todos' || oferta.tipoInstitucion === estado.institucion)
            && (estado.gestion === 'todos' || oferta.gestion === estado.gestion)
            && (estado.modalidad === 'todos' || oferta.modalidades.includes(estado.modalidad))
            && (estado.costo === 'todos' || (oferta.costo || (oferta.gestion === 'pública' ? 'gratuito' : 'arancelado')) === estado.costo)
            && (estado.duracion === 'todos' || getGrupoDuracion(oferta.duracionAnios) === estado.duracion)
            && (estado.area === 'todos' || oferta.area === estado.area)
            && (estado.favoritos === false || favoritos.has(oferta._clave))
            && enRango;
    };
    const resultados = ofertas.filter(coincide);

    // Con búsqueda activa y orden por defecto, rankeamos por relevancia.
    const usarRelevancia = estado.orden === 'relevancia' || (estado.texto && estado.orden === 'default');
    if (usarRelevancia) {
        return resultados
            .map(o => ({ o, s: puntuacionBusqueda(o) }))
            .sort((a, b) => b.s - a.s)
            .map(x => x.o);
    }
    const comparadores = {
        'nombre-az': (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
        'nombre-za': (a, b) => b.nombre.localeCompare(a.nombre, 'es'),
        'publica-primero': (a, b) => Number(b.gestion === 'pública') - Number(a.gestion === 'pública'),
        'privada-primero': (a, b) => Number(b.gestion === 'privada') - Number(a.gestion === 'privada')
    };
    return comparadores[estado.orden] ? resultados.sort(comparadores[estado.orden]) : resultados;
}

// Resuelve una clave a las claves reales de oferta. Si la clave ya pertenece a
// una oferta/plataforma/catálogo aparte, es única. Si es una carrera del
// orientador (p.ej. "abogacia"), devuelve todas las ofertas que la dictan: así
// favorito y comparar guardan lo mismo que filtra y muestra el catálogo.
function clavesDeCarrera(clave) {
    if (buscarPorClave(clave)) return [clave];
    const carrera = (Orientador.perfilesCarreras || []).find(c => c.clave === clave);
    if (!carrera) return [];
    const nombreNorm = normalizarTexto(carrera.nombre);
    return ofertas.filter(o => normalizarTexto(o.nombre) === nombreNorm).map(o => o._clave);
}

function estaEnFavoritos(clave) {
    if (favoritos.has(clave)) return true;
    const claves = clavesDeCarrera(clave);
    return claves.length > 0 && claves.every(c => favoritos.has(c));
}

function toggleFavorito(clave) {
    const claves = clavesDeCarrera(clave);
    if (!claves.length) return;
    // Si la carrera ya está guardada completa se saca entera; si no, se guarda
    // con todas sus instituciones (para que "Solo favoritos" la encuentre).
    const completo = claves.every(c => favoritos.has(c));
    claves.forEach(c => { if (completo) favoritos.delete(c); else favoritos.add(c); });
    escribirGuardado(FAVORITOS_KEY, [...favoritos]);
    // Se actualizan todos los botones de esa clave (grilla y tarjetas del chat),
    // no solo el primero que encuentre.
    document.querySelectorAll(`.btn-favorito[data-clave="${CSS.escape(clave)}"]`).forEach(boton => {
        boton.classList.toggle('is-active', !completo);
        boton.setAttribute('aria-pressed', String(!completo));
    });
    if (estado.favoritos) mostrarResultados();
}

function enComparador(clave) {
    if (comparador.has(clave)) return true;
    const claves = clavesDeCarrera(clave);
    return claves.length > 0 && claves.every(c => comparador.has(c));
}
function cantidadComparador() { return comparador.size; }

function toggleComparar(clave) {
    const claves = clavesDeCarrera(clave);
    if (!claves.length) return;
    const completo = claves.every(c => comparador.has(c));
    claves.forEach(c => { if (completo) comparador.delete(c); else comparador.add(c); });
    escribirGuardado(COMPARAR_KEY, [...comparador]);
    // Se actualizan todos los botones de esa clave (grilla y tarjetas del chat).
    document.querySelectorAll(`.btn-comparar[data-clave="${CSS.escape(clave)}"]`).forEach(boton => {
        boton.classList.toggle('is-active', !completo);
        boton.setAttribute('aria-pressed', String(!completo));
    });
    actualizarBarraComparar();
}

function actualizarBarraComparar() {
    const barra = document.getElementById('compararBar');
    if (!barra) return;
    const cantidad = comparador.size;
    barra.hidden = cantidad === 0;
    const contador = document.getElementById('compararCount');
    if (contador) contador.textContent = String(cantidad);
}

function buscarPorClave(clave) {
    return ofertas.find(o => o._clave === clave)
        || plataformas.find(p => p._clave === clave)
        || Object.values(catalogosAparte).flatMap(c => c.cursos).find(c => c._clave === clave)
        || null;
}

function abrirComparar() { abrirCompararModal(); }

function abrirCompararModal() {
    const modal = document.getElementById('compararModal');
    if (!modal) return;
    const items = [...comparador].map(buscarPorClave).filter(Boolean);
    const cuerpo = document.getElementById('compararCuerpo');
    if (cuerpo) cuerpo.innerHTML = items.length ? construirTablaComparar(items) : '<p class="empty-state">No hay nada para comparar todavía.</p>';
    modal.hidden = false;
    modal.classList.add('abierto');
}

function cerrarComparar() {
    const modal = document.getElementById('compararModal');
    if (modal) { modal.hidden = true; modal.classList.remove('abierto'); }
}

function construirTablaComparar(items) {
    const filas = [
        ['Institución', i => capitalizar(i.institucion || '—')],
        ['Categoría / Área', i => capitalizar(i.categoria || i.area || '—')],
        ['Modalidad', i => capitalizar(i.modalidad || '—')],
        ['Duración', i => capitalizar(i.duracion || '—')],
        ['Gestión / Costo', i => i.costo ? `${i.gestion === 'pública' ? 'Pública' : 'Privada'} · ${i.costo === 'arancelado' ? 'Arancelada' : 'Gratuita'}` : (i.gestion ? (i.gestion === 'pública' ? 'Pública (gratuita)' : 'Privada (arancelada)') : '—')],
        ['Sitio oficial', i => (i.link || i.url) ? `<a href="${i.link || i.url}" target="_blank" rel="noopener noreferrer">Ir ↗</a>` : '—']
    ];
    const encabezado = `<tr><th></th>${items.map(i => `<th>${i.nombre}</th>`).join('')}</tr>`;
    const cuerpo = filas.map(([etiqueta, fn]) => `<tr><th scope="row">${etiqueta}</th>${items.map(i => `<td>${fn(i)}</td>`).join('')}</tr>`).join('');
    const tabla = `<table class="tabla-comparar"><thead>${encabezado}</thead><tbody>${cuerpo}</tbody></table>`;
    // En móvil la tabla ancha no sirve: generamos una tarjeta por ítem, con cada
    // atributo como fila etiqueta/valor, y el CSS muestra una u otra según ancho.
    const movil = items.map(i => `
        <div class="comparar-item">
            <h3 class="comparar-item-titulo">${i.nombre}</h3>
            <dl class="comparar-item-lista">
                ${filas.map(([etiqueta, fn]) => `<div class="comparar-fila"><dt>${etiqueta}</dt><dd>${fn(i)}</dd></div>`).join('')}
            </dl>
        </div>`).join('');
    return `<div class="comparar-responsive">${tabla}<div class="comparar-movil">${movil}</div></div>`;
}

function renderizarTarjetas(resultados, { mostrarMatch = false, encabezado = '' } = {}) {
    const contenedor = document.getElementById('cardContainer');
    if (!resultados.length) {
        contenedor.innerHTML = '<p class="empty-state">No encontramos ofertas con esos filtros. Probá ampliar tu búsqueda.</p>';
        return;
    }
    contenedor.innerHTML = encabezado + resultados.map(oferta => `
        <article class="card">
            <div class="card-badges">
                ${mostrarMatch ? `<span class="badge badge-match">${etiquetaCompatibilidad(oferta.score)}</span>` : ''}
                ${oferta.fuente ? `<span class="badge badge-fuente">${ETIQUETAS_FUENTE[oferta.fuente] || oferta.fuente}</span>` : ''}
                <span class="badge">${capitalizar(oferta.categoria)}</span>
                <span class="badge badge-area">${capitalizar(oferta.area)}</span>
                ${!oferta.fuente || oferta.fuente === 'formal' ? `<span class="badge badge-${oferta.gestion === 'pública' ? 'publica' : 'privada'}">${oferta.gestion === 'pública' ? 'Pública' : 'Privada'}</span>` : ''}
                ${oferta.gestion === 'pública' && oferta.costo === 'arancelado' ? '<span class="badge badge-arancelada">Arancelada</span>' : ''}
                <span class="badge badge-modalidad">${capitalizar(oferta.modalidad)}</span>
            </div>
            <h3 class="card-title">${capitalizar(oferta.nombre)}</h3>
            <div class="card-info">
                <p>🏛️ <strong>${capitalizar(oferta.institucion)}</strong></p>
                ${oferta.facultad ? `<p>🏫 ${capitalizar(oferta.facultad)}</p>` : ''}
                <p>📍 ${capitalizar(oferta.modalidad)}</p>
                <p>⏳ ${capitalizar(oferta.duracion)}</p>
            </div>
            ${oferta.link ? `<a class="card-link" href="${oferta.link}" target="_blank" rel="noopener noreferrer">Ir al sitio oficial ↗</a>` : '<span class="card-link card-link-muted">Formación online</span>'}
            <div class="card-actions">
                <button type="button" class="btn-favorito${estaEnFavoritos(oferta._clave) ? ' is-active' : ''}" data-clave="${oferta._clave}" aria-pressed="${estaEnFavoritos(oferta._clave)}" title="Guardar en favoritos">${estaEnFavoritos(oferta._clave) ? '★' : '☆'} <span>Favorito</span></button>
                <button type="button" class="btn-comparar${enComparador(oferta._clave) ? ' is-active' : ''}" data-clave="${oferta._clave}" aria-pressed="${enComparador(oferta._clave)}" title="Agregar a comparar">${enComparador(oferta._clave) ? '✓' : '+'} <span>Comparar</span></button>
            </div>
        </article>`).join('');
}
function renderizarTarjetasConCompatibilidad(resultados, rankings) {
    const contenedor = document.getElementById('cardContainer');
    if (!resultados.length) {
        contenedor.innerHTML = '<p class="empty-state">No encontramos carreras compatibles con ese perfil. Probá rehacer el test.</p>';
        return;
    }
    
    contenedor.innerHTML = resultados.map(carrera => {
        const compat = carrera.compatibilidad || 0;
        const matchClass = compat >= 80 ? 'match-alto' : (compat >= 60 ? 'match-medio' : 'match-bajo');
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
        <article class="carrera-card ${matchClass}" data-carrera-id="${clave}">
            <div class="card-header">
                <h3>${capitalizar(carrera.nombre)}</h3>
                <div class="compatibilidad-badge ${matchClass}">${compat}% match</div>
            </div>
            ${tipoBadge ? '<div class="tipo-badges">' + tipoBadge : ''}
            ${carrera.area ? '<span class="tipo-badge area">' + capitalizar(carrera.area) + '</span>' : ''}
            ${tipoBadge ? '</div>' : ''}
            ${coincidencias.length ? `
            <div class="card-match-motivos">
                <strong>Por qué coincide:</strong>
                <ul class="motivos-list">
                    ${coincidencias.map(c => '<li>' + c.label + ': <em>' + c.desc + '</em></li>').join('')}
                </ul>
            </div>` : ''}
            ${alertas.length ? `
            <div class="card-alertas">
                <strong>⚠ Alertas:</strong>
                <ul class="alertas-list">
                    ${alertas.map(a => '<li>' + a.mensaje + '</li>').join('')}
                </ul>
            </div>` : ''}
            ${instituciones.length ? `
            <div class="card-instituciones">
                <strong>Instituciones:</strong>
                <ul class="instituciones-list">
                    ${instituciones.map(i => '<li>' + i + '</li>').join('')}
                </ul>
            </div>` : ''}
            <div class="card-actions">
                <button type="button" class="btn-favorito${estaEnFavoritos(clave) ? ' is-active' : ''}" data-clave="${clave}" aria-pressed="${estaEnFavoritos(clave)}" title="Guardar en favoritos">${estaEnFavoritos(clave) ? '★' : '☆'} <span>Favorito</span></button>
                <button type="button" class="btn-comparar${enComparador(clave) ? ' is-active' : ''}" data-clave="${clave}" aria-pressed="${enComparador(clave)}" title="Agregar a comparar">${enComparador(clave) ? '✓' : '+'} <span>Comparar</span></button>
            </div>
        </article>`;
    }).join('');
}

function actualizarBotonesActivos() {
    document.querySelectorAll('.filter-option').forEach(boton => {
        boton.classList.toggle('active', estado[boton.dataset.filter] === boton.dataset.value);
    });
}

// El cajón de filtros se esconde con translateX, que lo saca de la vista pero no
// del orden de tabulación: sin esto, en celular se tabulaba por ~35 botones
// invisibles antes de llegar a los resultados. Solo aplica en modo cajón; en
// escritorio el panel está a la vista y tiene que seguir siendo navegable.
const mqCajonFiltros = window.matchMedia('(max-width: 820px)');

function sincronizarInertFiltros() {
    const panel = document.getElementById('filtersSidebar');
    if (!panel) return;
    panel.inert = mqCajonFiltros.matches && !document.body.classList.contains('filters-open');
}

mqCajonFiltros.addEventListener('change', sincronizarInertFiltros);

function cambiarPanelFiltros(abrir) {
    document.body.classList.toggle('filters-open', abrir);
    document.getElementById('mobileFilterButton').setAttribute('aria-expanded', String(abrir));
    document.getElementById('filtersOverlay').setAttribute('aria-hidden', String(!abrir));
    sincronizarInertFiltros();
    // El foco sigue al panel al abrir y vuelve al botón al cerrar.
    const destino = document.getElementById(abrir ? 'closeFiltersButton' : 'mobileFilterButton');
    if (destino && mqCajonFiltros.matches) destino.focus();
}

function limpiarTexto(texto) { return String(texto || '').replace(/\s+/g, ' ').trim(); }
function normalizarTexto(texto) { return limpiarTexto(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
// Primera letra en mayúscula y el resto en minúscula, para uniformar el texto
// de las tarjetas sin romper acentos ni palabras con tilde.
function capitalizar(texto) {
    const t = limpiarTexto(texto);
    if (!t) return t;
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
function inferirGestion(institucion) { const gestion = normalizarTexto(institucion.gestion); return gestion.includes('public') || normalizarTexto(institucion.nombre).includes('utn') ? 'pública' : 'privada'; }
// Las carreras de la UTN que no son ingenierías se dictan con arancel
// (licenciaturas, tecnicaturas, cursos); las ingenierías son gratuitas.
function esCarreraArancelada(institucion, nombre) {
    const esUtn = normalizarTexto(institucion.nombre || '').includes('utn');
    return esUtn && !normalizarTexto(nombre).includes('ingenieria');
}
function inferirTipoInstitucion(institucion) { const nombre = normalizarTexto(institucion.nombre); return institucion.nivel === 'universidad' || nombre.includes('universidad') || nombre.includes('universitario') || nombre.includes('utn') ? 'universidades' : (nombre.includes('ies') || nombre.includes('instituto superior') ? 'ies' : 'centros'); }
function getFormacion(carrera) { const texto = normalizarTexto(`${carrera.categoria} ${carrera.nombre_carrera}`); return texto.includes('profesorado') ? 'profesorados' : (texto.includes('tecnicatura') || texto.includes('tecnico') || texto.includes('pregrado') ? 'tecnicaturas' : (texto.includes('curso') || texto.includes('formacion profesional') ? 'cursos' : 'grado')); }
function getCategoryGroup(carrera) { const formacion = getFormacion(carrera); return formacion === 'tecnicaturas' ? 'pregrado' : (formacion === 'cursos' ? 'cursos' : 'grado'); }
function getArea(carrera) {
    const nombre = normalizarTexto(carrera.nombre_carrera);
    const tiene = (...terminos) => terminos.some(termino => nombre.includes(termino));
    if (tiene('ingenier')) return 'Ingeniería';
    if (tiene('program', 'sistema', 'informat', 'comput', 'software', 'datos', 'data', 'inteligencia artificial', 'ciberseguridad', 'robotica', 'videojuego', 'web', 'cloud')) return 'Tecnología';
    if (tiene('medicin', 'enfermer', 'kinesi', 'nutric', 'odont', 'farmac', 'fonoaudi', 'obstetric', 'terapia', 'radiolog', 'bioquim', 'salud', 'anestesia', 'instrumentacion quirurg')) return 'Salud';
    if (tiene('administracion', 'contador', 'contad', 'marketing', 'comercio', 'negocio', 'finanza', 'econom', 'recursos humanos', 'logistica', 'secretariado', 'gestion empresarial')) return 'Negocios';
    if (tiene('diseno', 'arquitect', 'multimedia', 'interiorismo', 'indumentaria', 'animacion')) return 'Diseño';
    if (tiene('profesorado', 'educacion', 'pedagog', 'didact')) return 'Educación';
    if (tiene('turismo', 'hoteler', 'guia de turismo')) return 'Turismo';
    if (tiene('gastronom', 'cocina', 'pasteler', 'panader')) return 'Gastronomía';
    if (tiene('ingles', 'idioma', 'portugues', 'frances', 'traduccion', 'interpretacion', 'italiano', 'chino', 'coreano', 'aleman', 'japones')) return 'Idiomas';
    if (tiene('arte', 'musica', 'teatro', 'escenograf', 'danza', 'cine', 'fotograf', 'audiovisual', 'ilustracion', 'canto', 'coral', 'organo', 'instrumento', 'ceramica artistica')) return 'Arte';
    if (tiene('diagnostico por imagenes', 'quirofano', 'podolog')) return 'Salud';
    if (tiene('ambient', 'agronom', 'biolog', 'geolog', 'forestal', 'veterin', 'quimic', 'hidric')) return 'Ambiente';
    if (tiene('mecanic', 'electric', 'carpinter', 'refrigeracion', 'soldadur', 'construccion', 'automotor', 'gasista', 'plomer')) return 'Oficios';
    return 'Ciencias sociales';
}
function obtenerModalidades(modalidad) { const texto = normalizarTexto(modalidad); const valores = []; if (texto.includes('presencial')) valores.push('presencial'); if (texto.includes('online') || texto.includes('virtual') || texto.includes('distancia')) valores.push('online'); if (texto.includes('hibrid')) valores.push('híbrida'); return valores.length ? valores : ['presencial']; }
function obtenerDuracionEnAnios(duracion) { const texto = normalizarTexto(duracion); const numero = texto.match(/\d+(?:[.,]\d+)?/); const valor = numero ? Number(numero[0].replace(',', '.')) : ({ uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 }[Object.keys({ uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 }).find(p => new RegExp(`\\b${p}\\b`).test(texto))] || null); if (valor === null) return null; if (texto.includes('mes')) return valor / 12; if (texto.includes('semana') || texto.includes('dia')) return valor / 52; return texto.includes('medio') ? valor + .5 : valor; }
function getGrupoDuracion(anios) { if (anios === null) return 'sin-definir'; if (anios < 0.5) return 'corta'; if (anios <= 1) return 'hasta-1'; if (anios < 4) return '2-3'; return '4-mas'; }

// ==========================================
// 🤖 BOT ORIENTADOR VOCACIONAL - Nuevo Sistema Multidimensional
// ==========================================

let pasoActual = 0;
let perfilUsuario = {}; // { analitico: 3, tecnologico: 2, ... } scores 0-5
let respuestasTest = []; // Array de { preguntaId, opcionTexto, dimensionScores }
let procesandoPasoChat = false;
let enTestVocacional = false;
// Historial de la conversación: cada entrada es { rol: 'bot'|'usuario', html }.
const historialChat = [];
let bubbleEscribiendo = null;
let orientadorListo = false;

// El copiloto es una burbuja flotante en la esquina inferior derecha, igual en
// todos los tamaños de pantalla. Comportamiento uniforme: abre y cierra por
// click; no hay modo "escritorio siempre abierto" ni "celular plegable".
function cambiarPanelCopiloto(abrir, { foco = true } = {}) {
    const ventana = document.getElementById('ventana-chat');
    const panel = document.getElementById('copilotoPanel');
    const boton = document.getElementById('btn-toggle-chat');
    if (!ventana) return;
    ventana.hidden = !abrir;
    if (panel) panel.classList.toggle('is-abierto', abrir);
    if (boton) boton.setAttribute('aria-expanded', String(abrir));
    if (!foco) return;
    // El foco no puede quedarse en un elemento que se acaba de ocultar. Sin
    // campo de texto, el foco va al primer control del chat (o a la ✕).
    if (abrir) setTimeout(() => {
        const cuerpo = document.getElementById('chat-caja');
        const primerControl = cuerpo && cuerpo.querySelector('button');
        const destino = primerControl || document.getElementById('btn-cerrar-chat');
        if (destino) destino.focus();
    }, 60);
    else if (boton && !(panel && panel.classList.contains('is-test-pantalla-completa'))) boton.focus();
}

// Cierra la burbuja y vuelve a dejar solo el botón circular. Durante el test a
// pantalla completa no aplica: ahí la ✕ (y Escape) salen del test, no pliegan.
function cerrarChat() {
    const panel = document.getElementById('copilotoPanel');
    if (panel && panel.classList.contains('is-test-pantalla-completa')) return;
    cambiarPanelCopiloto(false);
}

// Modo "test a pantalla completa": el panel se estira sobre el viewport y se
// muestra la ventana de chat con el cuestionario guiado. Se entra desde la
// bienvenida.
function abrirTestPantallaCompleta() {
    const panel = document.getElementById('copilotoPanel');
    const ventana = document.getElementById('ventana-chat');
    if (!ventana || !panel) return;
    // La conversación se arma una sola vez (en configurarChat); acá solo se abre.
    if (historialChat.length === 0) {
        historialChat.push({ rol: 'bot', html: mensajeBienvenida() });
        renderizarChat();
    }
    panel.classList.add('is-test-pantalla-completa');
    cambiarPanelCopiloto(true, { foco: true });
}

// Salir del test a pantalla completa: fade-out del panel y vuelta a la burbuja
// cerrada. Es la transición "test → interfaz principal".
function salirDelTest() {
    const panel = document.getElementById('copilotoPanel');
    if (!panel || !panel.classList.contains('is-test-pantalla-completa')) return;
    panel.classList.add('is-saliendo-test');
    let terminado = false;
    const limpiar = () => {
        if (terminado) return;
        terminado = true;
        panel.classList.remove('is-test-pantalla-completa', 'is-saliendo-test', 'is-abierto');
        const ventana = document.getElementById('ventana-chat');
        if (ventana) ventana.hidden = true;
        const boton = document.getElementById('btn-toggle-chat');
        if (boton) { boton.setAttribute('aria-expanded', 'false'); boton.focus(); }
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { limpiar(); return; }
    panel.addEventListener('transitionend', limpiar, { once: true });
    setTimeout(limpiar, 450);
}

function configurarChat() {
    const abrir = document.getElementById('btn-toggle-chat');
    const cerrar = document.getElementById('btn-cerrar-chat');
    const ventana = document.getElementById('ventana-chat');

    // La conversación se arma una sola vez y la burbuja arranca cerrada: el
    // contenido queda listo para el primer click.
    if (historialChat.length === 0) {
        historialChat.push({ rol: 'bot', html: mensajeBienvenida() });
    }
    renderizarChat();
    cambiarPanelCopiloto(false, { foco: false });

    abrir.addEventListener('click', () => cambiarPanelCopiloto(ventana.hidden));
    cerrar.addEventListener('click', () => {
        const panel = document.getElementById('copilotoPanel');
        if (panel && panel.classList.contains('is-test-pantalla-completa')) salirDelTest();
        else cerrarChat();
    });
}

// ==========================================
// 🚪 PANTALLA DE BIENVENIDA
// ==========================================

// Bienvenida: puerta de entrada del sitio. Se muestra siempre que se entra SIN
// filtros/búsqueda en la URL; un link compartido (con parámetros) va directo al
// catálogo con esos filtros aplicados.
function configurarBienvenida() {
    const pantalla = document.getElementById('pantallaBienvenida');
    if (!pantalla) return;

    if (location.search.length > 0) {
        // Link compartido: la bienvenida no se muestra ni se anima.
        ocultarBienvenidaInstantanea();
    } else {
        // El catálogo queda tapado detrás: que el teclado no tabule a lo invisible.
        alternarInertDetrasDeBienvenida(true);
    }

    const btnCopiloto = document.getElementById('btnBienvenidaCopiloto');
    const btnCatalogo = document.getElementById('btnBienvenidaCatalogo');
    if (btnCopiloto) btnCopiloto.addEventListener('click', () => {
        salirDeBienvenida(() => abrirTestPantallaCompleta());
    });
    if (btnCatalogo) btnCatalogo.addEventListener('click', () => {
        salirDeBienvenida();
    });
}

// El catálogo (y el header con su buscador) quedan inert mientras la bienvenida
// está encima: no hay nada visible con lo que interactuar. La burbuja del
// copiloto también: su botón de "Empezar" es el que está en la bienvenida.
function alternarInertDetrasDeBienvenida(activo) {
    [document.querySelector('.hero'), document.querySelector('.catalog-layout'), document.getElementById('copilotoPanel')]
        .forEach(el => { if (el) el.inert = activo; });
}

function ocultarBienvenidaInstantanea() {
    const pantalla = document.getElementById('pantallaBienvenida');
    if (!pantalla) return;
    pantalla.hidden = true;
    pantalla.classList.remove('is-saliendo');
    alternarInertDetrasDeBienvenida(false);
}

// Transición de salida de la bienvenida (fade + subida leve). Al terminar se
// oculta y se ejecuta lo que llegue en "despues" (p.ej. abrir el test).
function salirDeBienvenida(despues) {
    const pantalla = document.getElementById('pantallaBienvenida');
    if (!pantalla || pantalla.hidden) { if (despues) despues(); return; }
    if (pantalla.classList.contains('is-saliendo')) return;
    pantalla.classList.add('is-saliendo');
    alternarInertDetrasDeBienvenida(false);
    let terminado = false;
    const terminar = () => {
        if (terminado) return;
        terminado = true;
        pantalla.hidden = true;
        pantalla.classList.remove('is-saliendo');
        if (despues) despues();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { terminar(); return; }
    pantalla.addEventListener('transitionend', terminar, { once: true });
    setTimeout(terminar, 450);
}

function escaparHTML(texto) {
    return String(texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderizarChat() {
    const chatCaja = document.getElementById('chat-caja');
    chatCaja.innerHTML = historialChat.map(m => m.rol === 'bot'
        ? `<div class="mensaje-bot">${m.html}</div>`
        : `<div class="mensaje-usuario">${m.html}</div>`).join('');
    chatCaja.scrollTop = chatCaja.scrollHeight;

    // Se anuncia solo la última respuesta del bot, no el historial entero.
    const anuncio = document.getElementById('chat-anuncio');
    const ultimoBot = [...historialChat].reverse().find(m => m.rol === 'bot');
    if (anuncio && ultimoBot) {
        const tmp = document.createElement('div');
        tmp.innerHTML = ultimoBot.html;
        anuncio.textContent = tmp.textContent.replace(/\s+/g, ' ').trim();
    }
}

// La barra de progreso del test vive arriba del chat, fuera del scroll.
function actualizarProgresoChat() {
    const barra = document.getElementById('chat-progreso');
    if (!barra) return;
    if (!enTestVocacional) {
        barra.hidden = true;
        return;
    }
    barra.hidden = false;
    const total = Orientador.PREGUNTAS_TEST.length;
    const pasoVisible = Math.min(pasoActual + 1, total);
    const porcentaje = Math.round((pasoActual / total) * 100);
    barra.innerHTML = `
        <div class="chat-progreso" role="progressbar" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso del test">
            <span style="width: ${porcentaje}%"></span>
        </div>
        <p class="chat-progreso-texto">Pregunta ${pasoVisible} de ${total}</p>`;
}

function mostrarEscribiendo() {
    const chatCaja = document.getElementById('chat-caja');
    bubbleEscribiendo = document.createElement('div');
    bubbleEscribiendo.className = 'mensaje-bot mensaje-escribiendo';
    bubbleEscribiendo.setAttribute('aria-hidden', 'true');
    bubbleEscribiendo.innerHTML = '<span></span><span></span><span></span>';
    chatCaja.appendChild(bubbleEscribiendo);
    chatCaja.scrollTop = chatCaja.scrollHeight;
}

function quitarEscribiendo() {
    if (bubbleEscribiendo && bubbleEscribiendo.parentNode) {
        bubbleEscribiendo.parentNode.removeChild(bubbleEscribiendo);
    }
    bubbleEscribiendo = null;
}

function sugerenciasChips(lista) {
    return `<div class="chat-sugerencias">${lista.map(s =>
        `<button type="button" class="btn-chat-sugerencia" onclick='procesarEntradaUsuario(${JSON.stringify(s).replace(/'/g, "&#39;")})'>${s}</button>`
    ).join('')}</div>`;
}

// Pantalla de bienvenida del copiloto: en vez de explicar el test con un
// párrafo, lo muestra. Es la única burbuja del chat que no se ve como burbuja
// (el CSS le saca el fondo vía :has), porque hace de portada del modal.
// Los SVG son inline y de trazo: siguen a currentColor y al tema solos.
function iconoCopiloto(nombre) {
    const trazos = {
        // Brújula: "te ayudo a encontrar tu dirección".
        brujula: '<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.2 5-5 2.2 2.2-5z"/>',
        // Paso 1: lista de preguntas con un tilde.
        lista: '<path d="M10 7h9M10 12h9M10 17h5"/><path d="m4 7 1.4 1.4L8 5.8"/><path d="M4.5 12h1M4.5 17h1"/>',
        // Paso 2: análisis, barras que crecen más un destello.
        analisis: '<path d="M5 19V13M10 19V9M15 19v-4"/><path d="M19.5 4.5v4M17.5 6.5h4"/><path d="M4 21h16"/>',
        // Paso 3: la diana, el resultado.
        diana: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
        // Reloj del badge de tiempo.
        reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
        // Flecha del botón principal.
        flecha: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>'
    };
    return `<svg class="cb-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true" focusable="false">${trazos[nombre] || ''}</svg>`;
}

// Un paso del mini timeline. El número es decorativo: el <ol> ya numera para
// quien usa lector de pantalla.
function pasoCopiloto(n, icono, texto) {
    return `<li class="cb-paso">
            <span class="cb-paso-icono" aria-hidden="true">${iconoCopiloto(icono)}</span>
            <span class="cb-paso-cuerpo">
                <span class="cb-paso-num" aria-hidden="true">Paso ${n}</span>
                <span class="cb-paso-texto">${texto}</span>
            </span>
        </li>`;
}

// El camino recomendado es el test guiado, así que va primero y con el botón
// destacado. La búsqueda libre queda como atajo para quien ya sabe qué busca:
// el botón secundario delega en el ✕ del header, que ya sabe si hay que cerrar
// la ventanita o salir del modo pantalla completa.
function mensajeBienvenida() {
    return `<div class="copiloto-bienvenida">
            <div class="cb-header">
                <span class="cb-icono" aria-hidden="true">${iconoCopiloto('brujula')}</span>
                <span class="cb-titulos">
                    <h2 class="cb-titulo">Copiloto Vocacional</h2>
                    <p class="cb-subtitulo">Encontrá tu carrera ideal en 2 minutos</p>
                </span>
            </div>
            <ol class="cb-pasos">
                ${pasoCopiloto(1, 'lista', 'Respondés 5 preguntas cortas')}
                ${pasoCopiloto(2, 'analisis', 'Analizamos tus intereses')}
                ${pasoCopiloto(3, 'diana', 'Te mostramos las carreras que más encajan')}
            </ol>
            <p class="cb-tiempo">${iconoCopiloto('reloj')}<span>Toma menos de 2 minutos</span></p>
            <button type="button" class="cb-cta" onclick="iniciarTestVocacional()">
                <span>Empezar el test</span>${iconoCopiloto('flecha')}
            </button>
            <button type="button" class="cb-salida"
                onclick="document.getElementById('btn-cerrar-chat').click()">Prefiero buscar por mi cuenta</button>
        </div>`;
}

function mensajeAyuda() {
    return `<p>🤖 Puedo ayudarte con la <strong>oferta educativa de Mendoza</strong>. Por ejemplo:</p>
        <ul>
            <li>🎓 <strong>Carreras por tema:</strong> "carreras de informática", "algo de salud", "diseño"</li>
            <li>⏳ <strong>Dudas sobre una carrera:</strong> "¿cuánto dura medicina?", "¿enfermería es online?"</li>
            <li>🏛️ <strong>Por institución:</strong> "qué ofrece la UNCuyo", "carreras de la UTN"</li>
            <li>💻 <strong>Modalidad:</strong> "carreras online", "a distancia"</li>
            <li>🔧 <strong>Oficios y formaciones:</strong> "cursos de oficios", "formaciones cortas"</li>
        </ul>
        ${sugerenciasChips(['carreras de informática', '¿cuánto dura medicina?', 'qué ofrece la UNCuyo', 'hacer el test vocacional'])}`;
}

function iniciarTestVocacional() {
    pasoActual = 0;
    perfilUsuario = {};
    respuestasTest = [];
    enTestVocacional = true;
    procesandoPasoChat = false;
    historialChat.length = 0;
    historialChat.push({ rol: 'bot', html: '<p>🎯 Perfecto. Te hago <strong>5 preguntas</strong> para mapear tu perfil multidimensional. Respondé eligiendo una de las opciones.</p>' });
    actualizarProgresoChat();
    mostrarPregunta();
}

// Preguntas del test vocacional - Usando las del módulo Orientador
const preguntasTest = Orientador.PREGUNTAS_TEST;

function mostrarPregunta() {
    const preguntaObj = preguntasTest[pasoActual];
    const opciones = preguntaObj.opciones
        .map((opcion, idx) => `<button type="button" class="btn-chat-opcion" onclick='seleccionarOpcionChat(${idx}, ${JSON.stringify(opcion.texto).replace(/'/g, "&#39;")})'>${opcion.texto}</button>`)
        .join('');

    historialChat.push({ rol: 'bot', html: `
        <p>🤖 <strong>Orientador:</strong> ${preguntaObj.texto}</p>
        <div class="opciones-usuario">${opciones}</div>
        ${pasoActual > 0 ? '<button type="button" class="btn-chat-atras" onclick="volverPreguntaChat()">← Volver a la pregunta anterior</button>' : ''}` });
    actualizarProgresoChat();
    renderizarChat();



}
// Para que se pueda llamar desde los botones inyectados en el HTML
window.seleccionarOpcionChat = function(opcionIdx, textoOpcion) {
    if (procesandoPasoChat) return;
    procesandoPasoChat = true;

    const preguntaObj = preguntasTest[pasoActual];
    const opcion = preguntaObj.opciones[opcionIdx];
    
    // Acumular scores dimensionales
    if (opcion.dimensionScores) {
        Orientador.DIMENSIONES.forEach(d => {
            const val = opcion.dimensionScores[d] || 0;
            perfilUsuario[d] = (perfilUsuario[d] || 0) + val;
        });
    }
    
    respuestasTest.push({
        preguntaId: preguntaObj.id,
        opcionTexto: textoOpcion,
        dimensionScores: opcion.dimensionScores
    });
    
    pasoActual++;

    historialChat.push({ rol: 'usuario', html: '<p>' + escaparHTML(textoOpcion) + '</p>' });
    mostrarEscribiendo();

    setTimeout(() => {
        quitarEscribiendo();
        procesandoPasoChat = false;
        if (pasoActual >= preguntasTest.length) {
            mostrarRecomendacion();
        } else {
            mostrarPregunta();
        }
    }, 450);
};

window.volverPreguntaChat = function() {
    if (procesandoPasoChat || pasoActual === 0) return;
    // Descarta la respuesta del usuario y la pregunta actual del historial.
    historialChat.pop();
    historialChat.pop();
    pasoActual--;
    
    // Revertir scores dimensionales
    const ultimaRespuesta = respuestasTest.pop();
    if (ultimaRespuesta && ultimaRespuesta.dimensionScores) {
        Orientador.DIMENSIONES.forEach(d => {
            const val = ultimaRespuesta.dimensionScores[d] || 0;
            perfilUsuario[d] = Math.max(0, (perfilUsuario[d] || 0) - val);
        });
    }
    
    actualizarProgresoChat();
    mostrarPregunta();
};

window.reiniciarChat = function() {
    pasoActual = 0;
    perfilUsuario = {};
    respuestasTest = [];
    enTestVocacional = false;
    procesandoPasoChat = false;
    historialChat.length = 0;
    actualizarProgresoChat();
    historialChat.push({ rol: 'bot', html: mensajeBienvenida() });
    renderizarChat();
};

window.iniciarTestVocacional = iniciarTestVocacional;


// Preguntas del test vocacional - Usando las del módulo Orientador

const PALABRAS_VACIAS = new Set('a al algo alguna algunas algunos aunque asi bien como con contra cual cuales cuando cuanto cuantos de del desde donde el en entre eres es esa esas ese esos esta estas este esto estoy fue habia hay hasta la las lo los mas me mi mis muy ni no nos o para pero por porque que quien se segun ser si sin sobre su sus te tener todo todos tu tus un una uno unos va vos y ya quiero quiere necesito busco buscar encontrame mostrame estudiar estudio estudios carrera carreras algo tengo podrias podes puedo mejor tener queria gustaria otra tambien'.split(' '));

// Sinónimos por área, normalizados (sin acentos). El bot los usa para entender
// la intención del usuario y compararla con el campo `area` que ya calcula getArea().
const SINONIMOS_AREA = {
    'Tecnología': ['tecnolog', 'informatic', 'programacion', 'programar', 'programador', 'sistema', 'software', 'computacion', 'computador', 'datos', 'ciberseguridad', 'robotica', 'videojuego', 'inteligencia artificial', 'redes', 'cloud', 'desarroll', 'analista de sistemas', 'base de datos', 'web'],
    'Ingeniería': ['ingenier', 'industrial', 'electronica', 'electrica', 'civil', 'petroleo', 'mineria', 'minas', 'alimentos', 'agrimensor', 'biomedica'],
    'Salud': ['salud', 'medic', 'enfermer', 'kinesi', 'nutric', 'odontolog', 'farmac', 'fonoaudiolog', 'obstetric', 'terapia', 'bioquimic', 'radiolog', 'anestesia', 'instrumentacion quirurgica', 'veterinari', 'podolog', 'quirofano'],
    'Negocios': ['negocio', 'administrac', 'contador', 'contabilidad', 'marketing', 'comercio', 'comercial', 'finanza', 'economia', 'recursos humanos', 'logistica', 'secretariado', 'gestion', 'gerenci', 'ventas'],
    'Diseño': ['disen', 'arquitect', 'multimedia', 'interior', 'indumentaria', 'animacion', 'grafico', 'grafica', 'ux', 'diseno'],
    'Educación': ['educacion', 'docente', 'docencia', 'profesor', 'profesorado', 'pedagog', 'didact', 'ensenar', 'maestro', 'nivel inicial', 'nivel primario', 'nivel secundario'],
    'Turismo': ['turismo', 'hoteler', 'guia de turismo', 'viaje', 'hotel'],
    'Gastronomía': ['gastronom', 'cocina', 'cocinar', 'pasteleria', 'panaderia', 'chef'],
    'Idiomas': ['idioma', 'idiomas', 'ingles', 'portugues', 'frances', 'italiano', 'chino', 'coreano', 'aleman', 'japones', 'traduccion', 'interpretacion', 'lengua'],
    'Arte': ['arte', 'musica', 'teatro', 'escenograf', 'danza', 'cine', 'fotograf', 'audiovisual', 'ilustracion', 'canto', 'coral', 'organo', 'instrumento', 'ceramica', 'literatura'],
    'Ambiente': ['ambiente', 'ambiental', 'agronom', 'biolog', 'geolog', 'forestal', 'quimic', 'hidric', 'sustentabilidad', 'ecologia', 'energias renovables'],
    'Oficios': ['oficio', 'mecanic', 'electric', 'carpinter', 'refrigeracion', 'soldadur', 'construccion', 'automotor', 'gasista', 'plomer', 'pintor', 'torner', 'herreria'],
    'Ciencias sociales': ['social', 'derecho', 'leyes', 'abogac', 'comunicacion', 'periodismo', 'historia', 'sociologia', 'antropologia', 'filosofia', 'politicas', 'trabajo social', 'relaciones publicas', 'psicolog']
};

// Acrónimos y formas cortas de las instituciones. Las claves van sin acentos.
const ALIASES_INSTITUCION = {
    'uncuyo': 'Universidad Nacional de Cuyo (UNCuyo)',
    'nacional de cuyo': 'Universidad Nacional de Cuyo (UNCuyo)',
    'utn': 'UTN Facultad Regional Mendoza',
    'tecnologica nacional': 'UTN Facultad Regional Mendoza',
    'uda': 'Universidad del Aconcagua (UDA)',
    'aconcagua': 'Universidad del Aconcagua (UDA)',
    'umaza': 'Universidad Juan Agustín Maza (UMaza)',
    'maza': 'Universidad Juan Agustín Maza (UMaza)',
    'universidad de mendoza': 'Universidad de Mendoza (UM)',
    'uch': 'Universidad Champagnat (UCh)',
    'champagnat': 'Universidad Champagnat (UCh)',
    'uca': 'Universidad Católica Argentina (UCA)',
    'catolica': 'Universidad Católica Argentina (UCA)',
    'universidad de congreso': 'Universidad de Congreso (UC)',
    'congreso': 'Universidad de Congreso (UC)',
    'siglo 21': 'Universidad Siglo 21 (S21)',
    'iuce': 'Instituto Univ. de Ciencias Empresariales (IUCE)',
    'ciencias empresariales': 'Instituto Univ. de Ciencias Empresariales (IUCE)',
    'gutenberg': 'Instituto Juan Gutenberg',
    'chopin': 'Instituto de Arte Chopin',
    'imei': 'Instituto Maipú de Educación Integral (IMEI)',
    'trinidad': 'Instituto Santísima Trinidad',
    'rayuela': 'Fundación Rayuela',
    'intercultural': 'Intercultural Cursos de Idiomas',
    'malvinas': 'Escuela Internacional Islas Malvinas',
    'epd': 'Escuela de Periodismo Deportivo de Mendoza (EPD)',
    'periodismo deportivo': 'Escuela de Periodismo Deportivo de Mendoza (EPD)',
    'psicologia social': 'Escuela de Psicología Social',
    'fabian calle': 'Instituto Fabián Calle',
    'insutec': 'INSUTEC (Instituto Superior de Educación Tecnológica)',
    'isteec': 'ISTEEC (IES 9-013)',
    'iesvu': 'IESVU (IES 9-015 Valle de Uco)',
    'valle de uco': 'IESVU (IES 9-015 Valle de Uco)',
    'ief': 'IEF - Instituto de Educación Física (IES 9-016)',
    'educacion fisica': 'IEF - Instituto de Educación Física (IES 9-016)',
    'itu': 'ITU - Instituto Tecnológico Universitario (UNCuyo)',
    'godoy cruz': 'IES 9-002 Tomás Godoy Cruz',
    'san martin': 'IES 9-001 Gral. José de San Martín',
    'belgrano': 'IES 9-008 Manuel Belgrano',
    'san rafael': 'IES 9-003 Normal (San Rafael)',
    'luzuriaga': 'IES 9-004 Gral. Toribio de Luzuriaga',
    'tupungato': 'IES 9-009 (Tupungato)',
    'malargue': 'IES 9-018 (Malargüe)',
    'lavalle': 'IES 9-024 (Lavalle)',
    'santa rosa': 'IES 9-028 (Santa Rosa)',
    'lujan de cuyo': 'IES 9-029 (Luján de Cuyo)',
    'bicentenario': 'IES 9-030 (Instituto del Bicentenario)',
    'tolosa': 'IES 9-006 Francisco H. Tolosa',
    'atuel': 'IES 9-011 Del Atuel',
    'cine y video': 'Escuela Regional Cuyo de Cine y Video (IES 9-017)'
};

function incluyeFrase(texto, frase) {
    return /\s/.test(frase) ? texto.includes(frase) : new RegExp(`\\b${frase}`, 'i').test(texto);
}

function detectarAreas(texto) {
    const encontradas = new Set();
    for (const [area, sinonimos] of Object.entries(SINONIMOS_AREA)) {
        if (sinonimos.some(sinonimo => incluyeFrase(texto, sinonimo))) encontradas.add(area);
    }
    return [...encontradas];
}

function detectarFormacion(texto) {
    if (incluyeFrase(texto, 'profesorado') || incluyeFrase(texto, 'docencia') || incluyeFrase(texto, 'ensenar')) return 'profesorados';
    if (incluyeFrase(texto, 'tecnic') || incluyeFrase(texto, 'terciario')) return 'tecnicaturas';
    if (incluyeFrase(texto, 'curso') || incluyeFrase(texto, 'cursos') || incluyeFrase(texto, 'formacion profesional') || incluyeFrase(texto, 'capacitacion') || incluyeFrase(texto, 'taller')) return 'cursos';
    if (incluyeFrase(texto, 'grado') || incluyeFrase(texto, 'licenciatura') || incluyeFrase(texto, 'universitari')) return 'grado';
    return null;
}

function detectarModalidad(texto) {
    if (incluyeFrase(texto, 'presencial')) return 'presencial';
    if (incluyeFrase(texto, 'hibrido') || incluyeFrase(texto, 'hibrida') || incluyeFrase(texto, 'mixta')) return 'hibrida';
    if (incluyeFrase(texto, 'online') || incluyeFrase(texto, 'virtual') || incluyeFrase(texto, 'a distancia') || incluyeFrase(texto, 'distancia')) return 'online';
    return null;
}

function detectarInstitucion(texto) {
    // Primero el nombre completo, tal como figura en los datos.
    const porNombre = ofertas.find(oferta => texto.includes(normalizarTexto(oferta.institucion)));
    if (porNombre) return porNombre.institucion;
    // Después los acrónimos y formas cortas.
    for (const [alias, canonical] of Object.entries(ALIASES_INSTITUCION)) {
        if (incluyeFrase(texto, alias)) return canonical;
    }
    return null;
}

function obtenerTokens(texto) {
    const tokens = new Set();
    texto.split(/[^a-z0-9]+/).forEach(t => {
        if (t.length < 3 || PALABRAS_VACIAS.has(t)) return;
        tokens.add(t);
    });
    return [...tokens];
}

function buscarCarrerasPorNombre(texto) {
    const tokens = obtenerTokens(texto).filter(t => t.length >= 4);
    if (!tokens.length) return [];
    return ofertas.filter(oferta => {
        const nombre = normalizarTexto(oferta.nombre);
        return tokens.some(t => nombre.includes(t));
    });
}

function dedupePorNombre(lista) {
    const vistos = new Set();
    return lista.filter(item => {
        const clave = normalizarTexto(item.nombre);
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
    });
}

function puntuarOfertaLibre(oferta, contexto) {
    const texto = normalizarTexto(`${oferta.nombre} ${oferta.categoria} ${oferta.facultad} ${oferta.institucion}`);
    let score = 0;
    const motivos = [];

    if (contexto.areas.length && contexto.areas.includes(oferta.area)) {
        score += 5;
        motivos.push('encaja con el área que buscás');
    }
    if (contexto.formacion) {
        if (oferta.formacion === contexto.formacion) { score += 3; motivos.push('es el nivel de formación que buscás'); }
        else if (contexto.formacion === 'grado' && oferta.formacion === 'profesorados') { score += 2; }
    }
    if (contexto.modalidad && oferta.modalidades.includes(contexto.modalidad)) {
        score += 3;
        motivos.push(`se cursa ${contexto.modalidad}`);
    }
    if (contexto.institucion && oferta.institucion === contexto.institucion) {
        score += 6;
        motivos.push('la dicta la institución que mencionaste');
    }
    contexto.tokens.forEach(t => {
        if (t.length >= 3 && texto.includes(t)) {
            score += 2;
            motivos.push(`coincide con "${t}"`);
        }
    });
    contexto.excluir.forEach(area => {
        if (oferta.area === area) score -= 6;
    });

    return { score, motivos };
}

const ETIQUETAS_FUENTE = {
    'formal': 'Educación formal',
    'oficios-tecnicos': 'Oficio técnico',
    'formaciones-alternativas': 'Formación alternativa'
};

function detectarAreaPrincipal(texto) {
    const areas = detectarAreas(texto);
    return areas.length ? areas[0] : null;
}

// Convierte un curso de los catálogos aparte al mismo modelo que una oferta
// formal, para puntuarlo con el mismo motor y mostrarlo en la misma grilla.
function cursoComoOferta(curso, fuente) {
    const texto = normalizarTexto(`${curso.nombre} ${curso.institucion} ${curso.categoria}`);
    return {
        nombre: curso.nombre,
        categoria: curso.categoria,
        area: detectarAreaPrincipal(texto) || 'Formación',
        gestion: 'privada',
        modalidad: curso.modalidad,
        duracion: curso.duracion,
        facultad: curso.provincia || '',
        institucion: curso.institucion,
        link: curso.link || '',
        formacion: 'cursos',
        modalidades: obtenerModalidades(curso.modalidad),
        fuente
    };
}

// Búsqueda combinada: educación formal + oficios + formaciones alternativas.
function obtenerResultadosGlobales(texto, contexto) {
    const resultados = [];

    ofertas.forEach(oferta => {
        const p = puntuarOfertaLibre(oferta, contexto);
        if (p.score > 0) {
            // Clon: no tocamos el oferta original para no contaminar la búsqueda del sitio.
            resultados.push({ ...oferta, score: p.score, motivos: p.motivos, fuente: 'formal' });
        }
    });

    Object.entries(catalogosAparte).forEach(([clave, catalogo]) => {
        const esOficios = clave === 'oficios-tecnicos';
        const interesCatalogo = esOficios
            ? contexto.areas.includes('Oficios') || contexto.tokens.some(t => t.startsWith('ofici'))
            : contexto.tokens.some(t => t.startsWith('formacion') || t.startsWith('curso') || t.startsWith('capacitacion') || t.startsWith('taller'));
        const aportes = [];
        catalogo.cursos.forEach(curso => {
            const comoOferta = cursoComoOferta(curso, clave);
            const p = puntuarOfertaLibre(comoOferta, contexto);
            const matchea = p.score > 0;
            let score = p.score;
            if (interesCatalogo) {
                score = matchea ? score + 2 : 1;
            }
            if (score > 0) {
                comoOferta.score = score;
                comoOferta.motivos = matchea ? p.motivos : ['es del catálogo que mencionaste'];
                aportes.push(comoOferta);
            }
        });
        aportes.sort((a, b) => b.score - a.score);
        resultados.push(...aportes.slice(0, 25));
    });

    return resultados.sort((a, b) => b.score - a.score).slice(0, 60);
}

function responderTextoLibre(texto) {
    // Empezar el test guiado
    if (/test vocacional|hacer el test|empezar el test|orientacion/.test(texto)) {
        return { accion: 'test' };
    }

    // Saludos
    if (/^(hola|buenas|buen dia|buenas tardes|buenas noches|hey|que tal|buenas)/.test(texto)) {
        return { html: `<p>👋 ¡Hola! Soy el <strong>Copiloto Vocacional</strong>. Contame qué te gustaría estudiar o hacé el test para mapear tu perfil.</p>
            ${sugerenciasChips(['carreras de informática', '¿cuánto dura medicina?', 'qué ofrece la UNCuyo', 'carreras online'])}` };
    }

    // Ayuda / capacidades
    if (/ayuda|no entiendo|que podes hacer|que sabes hacer|que haces|como funciona|que es esto|que puedo preguntar|que puedo escribir|que preguntas/.test(texto)) {
        return { html: mensajeAyuda() };
    }

    const areas = detectarAreas(texto);
    const institucion = detectarInstitucion(texto);
    const formacion = detectarFormacion(texto);
    const modalidad = detectarModalidad(texto);
    const tokens = obtenerTokens(texto);
    const pideExcluir = /no (me gusta|quiero|me interesa|me copa)|odio|no me va|prefiero evitar|no quiero/.test(texto);
    const excluir = pideExcluir
        ? detectarAreas(texto.replace(/no (me gusta|quiero|me interesa|me copa)|odio|no me va|prefiero evitar|no quiero/g, ' '))
        : [];

    // "Qué ofrece X" / "carreras de X" (por institución)
    if (institucion) {
        let carreras = ofertas.filter(oferta => oferta.institucion === institucion);
        const tokensTema = tokens.filter(t => t.length >= 4 && !incluyeFrase(normalizarTexto(institucion), t));
        if (tokensTema.length) {
            const conMatch = carreras.filter(oferta =>
                tokensTema.some(t => normalizarTexto(`${oferta.nombre} ${oferta.categoria}`).includes(t)));
            if (conMatch.length) carreras = conMatch;
        }
        if (carreras.length) {
            const lista = carreras.slice(0, 8).map(c =>
                `<li><strong>${c.nombre}</strong> — ${c.categoria} · ${c.duracion}</li>`).join('');
            const mas = carreras.length > 8 ? `<li>… y ${carreras.length - 8} más.</li>` : '';
            return {
                html: `<p>🏛️ <strong>${institucion}</strong> ofrece <strong>${carreras.length} ${carreras.length === 1 ? 'carrera' : 'carreras'}</strong> en nuestra base. Algunas:</p><ul>${lista}${mas}</ul>`,
                resultados: carreras.slice(0, 40).map(c => { c.score = 6; c.motivos = ['la dicta la institución que mencionaste']; return c; }),
                seccion: 'formal'
            };
        }
    }

    // Preguntas concretas sobre una carrera (duración, modalidad, dónde)
    const pideDuracion = /cuanto dura|cuantos anios|cual es la duracion|cuanto tarda|que duracion/.test(texto);
    const pideModalidad = /como se cursa|modalidad|es presencial|es online|es a distancia/.test(texto);
    const pideLugar = /donde (se estudia|estudiar|puedo estudiar)|en que (instituto|universidad|institucion)|que instituciones|que universidades|donde lo dan|donde la dan/.test(texto);
    if (pideDuracion || pideModalidad || pideLugar) {
        const coincidencias = dedupePorNombre(buscarCarrerasPorNombre(texto));
        if (coincidencias.length) {
            const items = coincidencias.slice(0, 6).map(c => {
                let dato = '';
                if (pideDuracion) dato = `⏳ <strong>${c.duracion}</strong>`;
                if (pideModalidad) dato = `💬 ${c.modalidades.map(m => `<strong>${m}</strong>`).join(' / ')}`;
                if (pideLugar) dato = `🏛️ <strong>${c.institucion}</strong>${c.facultad ? ` (${c.facultad})` : ''}`;
                return `<li><strong>${c.nombre}</strong> — ${dato}</li>`;
            }).join('');
            return {
                html: `<p>🤖 Sobre eso encontré esto en nuestra base:</p><ul>${items}</ul><p class="mensaje-bot-nota">También te las dejo en la pantalla principal.</p>`,
                resultados: coincidencias.slice(0, 40).map(c => { c.score = 6; c.motivos = []; return c; }),
                seccion: 'formal'
            };
        }
    }

    // Plataformas online
    if (/plataforma|coderhouse|soy henry|digital house|nucba|educacion it|teclab|mindhub|image campus|da vinci|cursos online|curso online/.test(texto)) {
        const coincidencias = plataformas.filter(p => {
            const buscar = normalizarTexto(`${p.nombre} ${p.resumen}`);
            return tokens.some(t => t.length > 2 && buscar.includes(t)) || /plataforma|cursos online|curso online/.test(texto);
        });
        const lista = coincidencias.length ? coincidencias : plataformas;
        return {
            html: `<p>💻 Estas son las <strong>plataformas online</strong> de nuestra base${coincidencias.length ? ' que coinciden con lo que buscás' : ''}:</p>
                <ul>${lista.slice(0, 9).map(p => `<li><strong>${p.nombre}</strong> — ${p.resumen}</li>`).join('')}</ul>`,
            resultados: lista,
            seccion: 'plataformas'
        };
    }

    // Búsqueda global: educación formal + oficios + formaciones alternativas.
    const contexto = { areas, formacion, modalidad, institucion: null, tokens, excluir };
    const resultados = obtenerResultadosGlobales(texto, contexto);

    if (!resultados.length) {
        return { html: `<p>🤖 Hmm, no encontré coincidencias con "<strong>${escaparHTML(texto)}</strong>". Probá con palabras más generales (ej: <em>salud</em>, <em>tecnología</em>, <em>oficios</em>) o contame qué te gusta hacer.</p>
            ${sugerenciasChips(['quiero algo de salud', 'carreras de tecnología', 'cursos de oficios', 'hacer el test vocacional'])}` };
    }

    const resumen = [];
    if (contexto.areas.length) resumen.push(contexto.areas.join(' / '));
    if (contexto.formacion) resumen.push(contexto.formacion);
    if (contexto.modalidad) resumen.push(contexto.modalidad);
    const detalle = resumen.length ? ` buscando <strong>${resumen.join(', ')}</strong>` : '';
    const n = resultados.length;
    const top = resultados.slice(0, 5);
    const lista = top.map(r => `<li><strong>${r.nombre}</strong> — ${r.institucion}</li>`).join('');
    const fuentes = [...new Set(resultados.map(r => r.fuente))]
        .map(f => ETIQUETAS_FUENTE[f] || f).join(', ');

    return {
        html: `<p>🤖 Encontré <strong>${n} ${n === 1 ? 'opción' : 'opciones'}</strong>${detalle}, entre ${fuentes}. Las más destacadas:</p><ul>${lista}</ul><p class="mensaje-bot-nota">Te las dejé en la pantalla principal, ordenadas por compatibilidad y con su origen marcado.</p>`,
        resultados,
        seccion: 'formal'
    };
}

function renderResultadosChat(respuesta) {
    if (respuesta.seccion === 'formal') {
        cambiarSeccion('formal');
        const contadorElem = document.getElementById('resultsCount');
        if (contadorElem) {
            contadorElem.textContent = `${respuesta.resultados.length.toLocaleString('es-AR')} ${respuesta.resultados.length === 1 ? 'carrera encontrada' : 'carreras encontradas'}`;
        }
        renderizarTarjetas(respuesta.resultados, { mostrarMatch: true });
    } else if (respuesta.seccion === 'plataformas') {
        cambiarSeccion('plataformas');
        renderizarPlataformas(document.getElementById('contenedor-plataformas'), respuesta.resultados);
    } else {
        cambiarSeccion(respuesta.seccion);
        renderizarCursosAparte(document.getElementById(catalogosAparte[respuesta.seccion].contenedor), respuesta.resultados);
    }
}

// Punto de entrada del texto libre (también lo usan los botones de sugerencias).
window.procesarEntradaUsuario = function(texto) {
    const limpio = normalizarTexto(texto);
    if (!limpio) return;
    historialChat.push({ rol: 'usuario', html: `<p>${escaparHTML(texto)}</p>` });
    renderizarChat();
    mostrarEscribiendo();
    setTimeout(() => {
        quitarEscribiendo();
        const respuesta = responderTextoLibre(limpio);
        if (!respuesta) return;
        if (respuesta.accion === 'test') {
            iniciarTestVocacional();
            return;
        }
        historialChat.push({ rol: 'bot', html: respuesta.html });
        renderizarChat();
        if (respuesta.resultados) renderResultadosChat(respuesta);
    }, 450);
};

// --- Motor de recomendación --------------------------------------------
// En vez de buscar palabras sueltas en cualquier lado (lo que daba falsos
// positivos/negativos), usamos como señal principal el campo `area` que ya
// calcula getArea() para cada carrera, y sumamos palabras clave puntuales
// solo como desempate fino. Todo el matching es por palabra completa (\b)
// para no enganchar coincidencias parciales dentro de otra palabra.

const AREAS_POR_ENTORNO = {
    oficina: ['Tecnología', 'Negocios', 'Ingeniería'],
    terreno: ['Oficios', 'Turismo', 'Ambiente', 'Gastronomía'],
    social: ['Salud', 'Educación', 'Ciencias sociales']
};

const AREAS_POR_HABILIDAD = {
    analitico: ['Ingeniería', 'Tecnología', 'Salud', 'Negocios'],
    creativo: ['Diseño', 'Arte', 'Idiomas'],
    empatico: ['Salud', 'Educación', 'Ciencias sociales']
};

const PALABRAS_POR_ENTORNO = {
    oficina: ['sistema', 'programacion', 'administracion', 'gestion', 'dato', 'contad'],
    terreno: ['mecanic', 'turismo', 'agronom', 'ambiental', 'logistica', 'topograf', 'petroleo'],
    social: ['profesorado', 'educacion', 'psicolog', 'salud', 'enfermer', 'medicin']
};

const PALABRAS_POR_HABILIDAD = {
    analitico: ['ingenieria', 'dato', 'finanza', 'matematica', 'ciencia', 'software'],
    creativo: ['diseno', 'arte', 'arquitect', 'multimedia', 'marketing', 'animacion', 'comunicacion'],
    empatico: ['social', 'acompan', 'terapia', 'pedagog', 'psicolog', 'docencia']
};

const PALABRAS_DESCARTE = {
    duro: ['matematica', 'calculo', 'ingenieria', 'contador', 'derecho', 'leyes'],
    rutina: ['administracion', 'secretariado', 'archivo', 'contable'],
    publico: ['turismo', 'marketing', 'comercio', 'venta', 'relaciones publicas']
};

const LIMITE_RECOMENDACIONES = 40;

function contienePalabra(texto, palabra) {
    return new RegExp(`\\b${palabra}`, 'i').test(texto);
}

function obtenerRecomendaciones() {
    // Si el test ya se corrió antes en esta sesión, primero olvidamos esos puntajes.
    ofertas.forEach(o => { delete o.score; delete o.motivos; });

    // 1. Filtramos por el nivel de formación elegido (grado, tecnicatura o curso).
    let posibles = ofertas.filter(c => {
        if (perfilUsuario.nivel === 'grado') return c.formacion === 'grado' || c.formacion === 'profesorados';
        if (perfilUsuario.nivel === 'tecnicatura') return c.formacion === 'tecnicaturas';
        if (perfilUsuario.nivel === 'curso') return c.formacion === 'cursos';
        return true;
    });

    // 2. Puntuamos cada carrera y guardamos por qué la recomendamos.
    posibles.forEach(c => {
        c.score = 0;
        c.motivos = [];
        const texto = normalizarTexto(`${c.nombre} ${c.categoria}`);

        if ((AREAS_POR_ENTORNO[perfilUsuario.entorno] || []).includes(c.area)) {
            c.score += 4;
            c.motivos.push('encaja con el ambiente de trabajo que elegiste');
        }
        if ((AREAS_POR_HABILIDAD[perfilUsuario.habilidad] || []).includes(c.area)) {
            c.score += 4;
            c.motivos.push('aprovecha tu punto fuerte');
        }
        (PALABRAS_POR_ENTORNO[perfilUsuario.entorno] || []).forEach(p => { if (contienePalabra(texto, p)) c.score += 1; });
        (PALABRAS_POR_HABILIDAD[perfilUsuario.habilidad] || []).forEach(p => { if (contienePalabra(texto, p)) c.score += 1; });

        if (perfilUsuario.modalidad && perfilUsuario.modalidad !== 'cualquiera' && c.modalidades.includes(perfilUsuario.modalidad)) {
            c.score += 2;
            c.motivos.push(`es ${perfilUsuario.modalidad}, como preferís`);
        }

        (PALABRAS_DESCARTE[perfilUsuario.odio] || []).forEach(p => { if (contienePalabra(texto, p)) c.score -= 4; });
    });

    // 3. Nos quedamos solo con las que de verdad matchearon algo del perfil.
    let recomendadas = posibles.filter(c => c.score > 0).sort((a, b) => b.score - a.score);

    // 4. Si el cruce fue muy exigente y quedaron pocas opciones, relajamos el corte
    //    (mejor mostrar las más cercanas que dejar a alguien sin nada).
    if (recomendadas.length < 6 && posibles.length) {
        recomendadas = posibles.slice().sort((a, b) => b.score - a.score).slice(0, 12);
    }

    return recomendadas.slice(0, LIMITE_RECOMENDACIONES);
}

function etiquetaCompatibilidad(score) {
    if (score >= 9) return '🎯 Muy compatible';
    if (score >= 5) return '✔️ Compatible';
    return '🔎 Podría interesarte';
}

function mostrarRecomendacion() {
    enTestVocacional = false;
    actualizarProgresoChat();

    // Nos aseguramos de estar en la sección de Educación Formal (oculta plataformas)
    // antes de pisar la grilla con los resultados del test.
    cambiarSeccion('formal');

    // Generar perfil usuario normalizado (0-5 cada dimensión)
    const perfilNormalizado = Orientador.generarPerfilUsuarioDesdeRespuestas(respuestasTest);
    
    // Generar rankings agrupados por tipo de formación
    const rankings = Orientador.generarRanking(perfilNormalizado, { limite: 12 });
    const todas = rankings.todas;
    
    // Actualizar contador
    const contadorElem = document.getElementById('resultsCount');
    if (contadorElem) {
        contadorElem.textContent = todas.length
            ? `${todas.length.toLocaleString('es-AR')} ${todas.length === 1 ? 'carrera recomendada' : 'carreras compatibles con tu perfil'}`
            : '0 carreras compatibles con esa combinación';
    }
    
    // Renderizar tarjetas con datos de compatibilidad
    renderizarTarjetasConCompatibilidad(todas, rankings);

    let html;
    if (!todas.length) {
        html = `
            <p>🤖 <strong>Orientador:</strong> No encontré carreras que combinen con esa mezcla de respuestas. ¡Probemos de nuevo con otra combinación!</p>
            <button type="button" class="btn-chat-reset" onclick="reiniciarChat()">Empezar el test de nuevo</button>`;
    } else {
        const mejor = todas[0];
        const matchPct = mejor.compatibilidad ? ` (${mejor.compatibilidad}%)` : '';
        const visibles = todas.slice(0, 6);
        const tarjetas = visibles.map(c => tarjetaResultadoChat(c, rankings)).join('');
        const ocultas = todas.length - visibles.length;
        html = `
            <p>🤖 <strong>Orientador:</strong> ¡Mapeo completo! Encontré <strong>${todas.length} carreras compatibles</strong> con tu perfil.${matchPct ? ' Tu mejor match: <strong>' + mejor.nombre + '</strong> con ' + mejor.compatibilidad + '%.' : ''}</p>
            <p class="mensaje-bot-nota">Podés marcarlas como favoritas o sumarlas para comparar desde acá mismo.</p>
            <div class="chat-resultados">${tarjetas}</div>
            ${ocultas > 0 ? `<p class="mensaje-bot-nota">Mostré las primeras ${visibles.length} (las de mejor match). Cerrá esta ventana y vas a encontrar la grilla completa en la página de carreras.</p>` : ''}
            <button type="button" class="btn-chat-reset" onclick="reiniciarChat()">Empezar el test de nuevo</button>`;
    }

    historialChat.push({ rol: 'bot', html });
    renderizarChat();
}

// Tarjeta compacta de resultado para el chat. Los botones de favorito/comparar
// no llevan onclick: funcionan por delegación (configurarEventos) con data-clave,
// igual que las tarjetas de la grilla.
function tarjetaResultadoChat(carrera, rankings) {
    const compat = carrera.compatibilidad || 0;
    const matchClass = compat >= 80 ? 'match-alto' : (compat >= 60 ? 'match-medio' : 'match-bajo');
    const clave = carrera.clave || carrera.nombre;
    let tipoBadge = '';
    if (rankings.grados.some(r => r.clave === carrera.clave)) tipoBadge = '<span class="tipo-badge grado">Grado</span>';
    else if (rankings.tecnicaturas.some(r => r.clave === carrera.clave)) tipoBadge = '<span class="tipo-badge tecnica">Tecnicatura</span>';
    else if (rankings.cursos.some(r => r.clave === carrera.clave)) tipoBadge = '<span class="tipo-badge curso">Curso</span>';

    return `
        <div class="chat-resultado-card ${matchClass}">
            <div class="chat-resultado-head">
                <span class="chat-resultado-nombre">${capitalizar(carrera.nombre)}</span>
                <span class="compatibilidad-badge ${matchClass}">${compat}% match</span>
            </div>
            ${tipoBadge || carrera.area ? '<div class="tipo-badges">' + tipoBadge + (carrera.area ? '<span class="tipo-badge area">' + capitalizar(carrera.area) + '</span>' : '') + '</div>' : ''}
            <div class="chat-resultado-acciones">
                <button type="button" class="btn-favorito${estaEnFavoritos(clave) ? ' is-active' : ''}" data-clave="${clave}" aria-pressed="${estaEnFavoritos(clave)}" title="Guardar en favoritos">${estaEnFavoritos(clave) ? '★' : '☆'} <span>Favorito</span></button>
                <button type="button" class="btn-comparar${enComparador(clave) ? ' is-active' : ''}" data-clave="${clave}" aria-pressed="${enComparador(clave)}" title="Agregar a comparar">${enComparador(clave) ? '✓' : '+'} <span>Comparar</span></button>
            </div>
        </div>`;
}

