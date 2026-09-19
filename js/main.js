// ==========================================
// Punto de entrada: arranca la app, configura el header, el tema y toda la
// delegacion de eventos.
// ==========================================

import { cerrarChat, configurarBienvenida, configurarChat, salirDelTest } from './copiloto.js';
import { cargarOfertas, catalogosAparte, inicializarOrientadorDiferido } from './datos.js';
import { estado, restaurarDesdeURL, sincronizarURL } from './estado.js';
import { actualizarBotonesActivos, cambiarPanelFiltros, cambiarSeccion, cargarMas, configurarSwitcherVistas, limpiarRecomendacion, mostrarCatalogoAparte, mostrarPlataformas, mostrarResultados, sincronizarInertFiltros } from './render.js';
import { normalizarTexto } from './util.js';
import { inicializarAutocompletado } from './autocompletado.js';

async function arrancar() {
    document.body.dataset.seccion = estado.seccion;
    // Restaura filtros/sección/búsqueda desde la URL ANTES de arrancar, para que
    // el primer render ya respete un link compartido.
    restaurarDesdeURL();
    configurarTema();
    configurarEventos();
    configurarMedicionHeader();
    configurarHeaderScroll();
    await cargarOfertas();
    inicializarOrientadorDiferido();
    configurarChat();
    sincronizarInertFiltros();
    configurarSwitcherVistas();
    configurarBienvenida();
}

// ==========================================
// 🪄 HEADER COLAPSABLE AL HACER SCROLL
// ==========================================

// El encogido sigue al scroll de forma continua (relación 1:1: hace falta 170px
// para completar el pliegue), sin umbrales ni clases que flipen. Para que el
// scroll rápido no teletransporte el layout (logo/buscador), el progreso visual
// persigue al objetivo con un tope por frame: lento queda 1:1 con el dedo,
// rápido se reparte en ~3-4 frames en vez de saltar de golpe.
const RANGO_CONTRACCION = 170;
// Tope de avance del progreso visual por frame. Alto a propósito: si el tope es
// demasiado bajo, el header va atrás del dedo y se siente "trabado". Este valor
// solo frena los saltos brutos de un flick, no el scroll normal.
const PASO_VISUAL_MAX = 0.25;

function configurarHeaderScroll() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const raiz = document.documentElement;
    // `objetivo` es dónde está el scroll; `visual` es dónde está dibujado el
    // header. El paso visual converge a exacto cero y el loop se apaga cuando
    // no queda remanente ni nuevos eventos de scroll.
    let objetivo = Math.min(1, Math.max(0, window.scrollY / RANGO_CONTRACCION));
    let visual = objetivo;
    let raf = 0;

    const escribir = () => {
        raiz.style.setProperty('--scroll-progress', visual.toFixed(3));
        // El blur se mantiene escalonado: recalcular el backdrop-filter en cada
        // frame es lo más caro del header en iOS.
        raiz.style.setProperty('--blur-progress', (Math.round(visual * 5) / 5).toFixed(1));
        hero.classList.toggle('hero--compacto', visual > 0.985);
    };

    const ciclo = () => {
        raf = 0;
        const delta = objetivo - visual;
        if (delta !== 0) {
            visual += Math.max(-PASO_VISUAL_MAX, Math.min(PASO_VISUAL_MAX, delta));
            escribir();
        }
        if (Math.abs(objetivo - visual) > 0.0005) raf = requestAnimationFrame(ciclo);
    };

    const alHacerScroll = () => {
        objetivo = Math.min(1, Math.max(0, window.scrollY / RANGO_CONTRACCION));
        if (!raf) raf = requestAnimationFrame(ciclo);
    };

    window.addEventListener('scroll', alHacerScroll, { passive: true });

    // Estado inicial: si el navegador restaura el scroll, se dibuja directo sin
    // animar desde el principio.
    escribir();
    void hero.offsetHeight;
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
    // Medimos con el header expandido (progreso 0). Sin transición no hay
    // intermedio que dibujar durante la medición.
    raiz.style.transition = 'none';
    raiz.style.setProperty('--scroll-progress', '0');
    const alto = hero.offsetHeight;
    raiz.style.setProperty('--scroll-progress', progresoActual || '0');
    raiz.style.transition = '';
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
        if (logo) logo.src = esOscuro ? '/logo-ben-dark.png' : '/logo-ben-light.png';
        // El logo de la pantalla de bienvenida sigue el mismo tema.
        const logoBienvenida = document.getElementById('bienvenidaLogo');
        if (logoBienvenida) logoBienvenida.src = esOscuro ? '/logo-ben-dark.png' : '/logo-ben-light.png';
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

function configurarEventos() {
    const inputBusqueda = document.getElementById('searchInput');
    const dropdownBusqueda = document.getElementById('searchDropdown');

    const brandHomeLink = document.getElementById('brandHomeLink');
    if (brandHomeLink) {
        brandHomeLink.addEventListener('click', (e) => {
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                limpiarRecomendacion();
                // Antes esto repetía a mano el cuerpo de limpiarFiltros() y se
                // olvidaba de actualizarBotonesActivos(): la grilla volvía a los
                // 658 resultados pero los chips seguían resaltados en "Grado" y
                // "Salud", así que el panel mostraba filtros que ya no estaban
                // aplicados. Ahora los dos caminos comparten resetearFiltros().
                resetearFiltros();
                // El logo es "ir al inicio", y el inicio es la vista de TODAS
                // las carreras: además de limpiar filtros y recomendación se
                // vuelve a esa vista (no a la última en la que estaba).
                estado.vista = 'carreras';
                estado.tipoInstitucion = null;
                // cambiarSeccion() ya repinta y llama a sincronizarURL(), que
                // deja la URL en "/" con replaceState. Un pushState acá encima
                // solo agregaba una entrada duplicada al historial: el botón
                // Atrás cambiaba la URL sin cambiar la vista (no hay popstate).
                cambiarSeccion('formal');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (inputBusqueda && dropdownBusqueda) {
        inicializarAutocompletado({
            inputElem: inputBusqueda,
            dropdownElem: dropdownBusqueda,
            onSeleccionar: (textoSeleccionado) => {
                estado.texto = normalizarTexto(textoSeleccionado);
                if (estado.seccion === 'plataformas') mostrarPlataformas();
                else if (catalogosAparte[estado.seccion]) mostrarCatalogoAparte(estado.seccion);
                else mostrarResultados();
                sincronizarURL();
            }
        });
    }

    let esperaBusqueda;
    inputBusqueda.addEventListener('input', event => {
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

    const btnCargarMas = document.getElementById('cargarMas');
    if (btnCargarMas) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !btnCargarMas.hidden) {
                cargarMas();
            }
        }, { rootMargin: '200px' });
        observer.observe(btnCargarMas);
        // Fallback click
        btnCargarMas.addEventListener('click', cargarMas);
    }

    // Antes era onclick="limpiarRecomendacion()" en el HTML. Como modulo, las
    // funciones ya no son globales: el boton se cablea aca como los demas.
    const chapaCerrar = document.getElementById('chapaRecomendacionCerrar');
    if (chapaCerrar) chapaCerrar.addEventListener('click', limpiarRecomendacion);

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        // De más superficial a más profundo: se cierra una capa por vez.
        if (document.body.classList.contains('filters-open')) { cambiarPanelFiltros(false); return; }
        const panel = document.getElementById('copilotoPanel');
        if (panel && panel.classList.contains('is-test-pantalla-completa')) { salirDelTest(); return; }
        const ventana = document.getElementById('ventana-chat');
        if (ventana && !ventana.hidden) { cerrarChat(); return; }
        // La bienvenida es la puerta de entrada del sitio y no se cierra con Escape.
    });
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

// Deja el estado y los controles del panel como si se acabara de entrar al
// sitio, pero no pinta nada: cada quien decide con qué vista sigue. Lo usan el
// botón "Limpiar filtros" y el logo de BEN, que antes duplicaban este bloque.
function resetearFiltros() {
    Object.assign(estado, {
        texto: '', formacion: 'todos', institucion: 'todos', departamento: 'todos', gestion: 'todos', modalidad: 'todos',
        costo: 'todos', duracion: 'todos', area: 'todos', duracionMin: null, duracionMax: null, orden: 'default'
    });
    document.getElementById('searchInput').value = '';
    document.getElementById('durationMin').value = '';
    document.getElementById('durationMax').value = '';
    document.getElementById('sortSelect').value = 'default';
    actualizarBotonesActivos();
}

function limpiarFiltros() {
    resetearFiltros();
    mostrarResultados();
    sincronizarURL();
}


// ==========================================
// 🚀 ARRANQUE
// ==========================================

// Este archivo se carga como <script type="module">, que es diferido: corre
// despues de que el HTML ya esta parseado, asi que DOMContentLoaded puede haber
// pasado y el listener no dispararia nunca (pagina en blanco). Por eso tambien
// se contempla readyState !== 'loading'.
//
// Y va al FINAL del archivo a proposito: en ese caso arrancar() se ejecuta en el
// acto, y todo lo que este modulo declara mas abajo estaria todavia en la zona
// muerta temporal ("Cannot access 'UMBRAL' before initialization"). En app.js no
// hacia falta porque el callback siempre corria despues de evaluar todo.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
} else {
    arrancar();
}
