// ==========================================
// Punto de entrada: arranca la app, configura el header, el tema y toda la
// delegacion de eventos.
// ==========================================

import { cerrarChat, configurarBienvenida, configurarChat, salirDelTest } from './copiloto.js';
import { cargarOfertas, catalogosAparte, inicializarOrientador } from './datos.js';
import { COMPARAR_KEY, actualizarBarraComparar, comparador, escribirGuardado, estado, favoritos, restaurarDesdeURL, sincronizarURL, toggleComparar, toggleFavorito } from './estado.js';
import { abrirComparar, actualizarBotonesActivos, cambiarPanelFiltros, cambiarSeccion, cargarMas, cerrarComparar, limpiarRecomendacion, mostrarCatalogoAparte, mostrarPlataformas, mostrarResultados, sincronizarInertFiltros } from './render.js';
import { normalizarTexto } from './util.js';

function arrancar() {
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
}

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

    // Antes era onclick="cerrarComparar()" en el HTML. Como modulo, las
    // funciones ya no son globales: el boton se cablea aca como los demas.
    const chapaCerrar = document.getElementById('chapaRecomendacionCerrar');
    if (chapaCerrar) chapaCerrar.addEventListener('click', limpiarRecomendacion);

    const compararCerrar = document.getElementById('compararCerrar');
    if (compararCerrar) compararCerrar.addEventListener('click', cerrarComparar);

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
