// ============================================================================
// SMOKE MOBILE: arranca la app en viewport angosto (matchMedia de hasta 820px)
// por un link compartido a una sección no formal, con data.json demorado a
// propósito. Cubre los arreglos del chequeo mobile:
//
//   1. body[data-seccion] refleja la sección de la URL (link compartido): antes
//      quedaba en "formal" y la página salía con colores/estado equivocados.
//   2. La portada y el chrome se resuelven ANTES de que llegue data.json: en el
//      link compartido la portada ya está oculta, el panel de filtros (y su
//      guía de títulos) no asoma en Oficios, y la vista avisa "Cargando…".
//   3. El placeholder corto del buscador en pantallas angostas.
//   4. La pestaña activa del carrusel se acerca al centro (scrollIntoView).
//
// Correr con:  node test_mobile.js
// ============================================================================
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RAIZ = __dirname;
let aserciones = 0;
let fallos = 0;
const ok = (cond, msg) => {
    if (cond) { aserciones++; console.log('  ✓ ' + msg); }
    else { fallos++; console.error('  ✗ ' + msg); }
};

const errores = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => {
    const texto = String(e.message || e);
    if (/Could not parse CSS|not implemented|scrollTo/i.test(texto)) return;
    errores.push(texto);
});
['error', 'warn', 'log'].forEach(k => vc.on(k, () => {}));

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const scrolls = [];
const dom = new JSDOM(html, {
    url: 'http://localhost/?seccion=oficios-tecnicos',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
        // Viewport angosto: todo query con max-width matchea.
        window.matchMedia = (query) => ({
            matches: /max-width/.test(query),
            media: query,
            addEventListener() {},
            removeEventListener() {}
        });
        window.scrollTo = () => {};
        window.requestIdleCallback = (fn) => setTimeout(fn, 10);
        window.HTMLElement.prototype.scrollIntoView = function (opciones) {
            scrolls.push({ id: this.id, opciones });
        };
        window.localStorage.setItem('ben-tutorial-visto', '1');
    }
});
const win = dom.window;

// data.json queda retenido hasta liberarDatos(): así se puede mirar el estado
// intermedio (el que en 3G dura segundos).
let liberarDatos;
const esperaDatos = new Promise(resolver => { liberarDatos = resolver; });
win.fetch = async (url) => {
    const limpia = String(url).split('?')[0].replace(/^\//, '');
    if (limpia === 'data/data.json') await esperaDatos;
    const p = path.join(RAIZ, limpia);
    if (!fs.existsSync(p)) return { ok: false, status: 404 };
    const texto = fs.readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(texto), text: async () => texto };
};

win.eval(fs.readFileSync(path.join(RAIZ, 'js/vocacional/motor.js'), 'utf8'));
win.eval(fs.readFileSync(path.join(RAIZ, 'js/vocacional/eventos.js'), 'utf8'));
win.eval(fs.readFileSync(path.join(RAIZ, 'js/favoritos.js'), 'utf8'));
win.eval(fs.readFileSync(path.join(RAIZ, 'js/accesibilidad.js'), 'utf8'));

global.window = win;
global.document = win.document;
global.localStorage = win.localStorage;
global.location = win.location;
global.history = win.history;
global.navigator = win.navigator;
global.CustomEvent = win.CustomEvent;
global.Event = win.Event;
global.Node = win.Node;
global.Element = win.Element;
global.fetch = win.fetch;
global.URL = win.URL;
global.Blob = win.Blob;
global.IntersectionObserver = win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };

(async () => {
    console.log('🧪 Iniciando test_mobile...\n');
    await import('./js/main.js');

    console.log('1. Link compartido, con data.json todavía en camino');
    const doc = win.document;
    ok(doc.body.dataset.seccion === 'oficios-tecnicos', `el body toma la sección de la URL (${doc.body.dataset.seccion})`);
    ok(doc.getElementById('pantallaBienvenida').hidden === true, 'la portada ya está oculta sin esperar los datos');
    ok(doc.getElementById('searchInput').placeholder === 'Buscar carrera…', 'en pantalla angosta el placeholder es el corto');
    const tabOficios = doc.getElementById('tab-oficios');
    ok(tabOficios.classList.contains('is-active') && tabOficios.getAttribute('aria-pressed') === 'true', 'la pestaña de la sección queda activa');
    const scrollTab = scrolls.find(s => s.id === 'tab-oficios');
    ok(Boolean(scrollTab) && scrollTab.opciones && scrollTab.opciones.inline === 'center', 'la pestaña activa se acerca al centro del carrusel');
    ok(doc.getElementById('filtersSidebar').hidden === true, 'el panel de filtros no asoma en Oficios (solo Educación Formal)');
    ok(doc.getElementById('mobileFilterButton').hidden === true, 'la card de filtros tampoco asoma en Oficios');
    ok(/Cargando catálogo/.test(doc.getElementById('contenedor-oficios').textContent), 'la sección avisa que el catálogo está cargando');

    console.log('2. Al llegar data.json, la sección se pinta');
    liberarDatos();
    await new Promise(r => setTimeout(r, 700));
    ok(errores.length === 0, `sin errores de jsdom${errores.length ? ' → ' + errores[0] : ''}`);
    ok(doc.querySelectorAll('#contenedor-oficios .curso-card').length > 0, 'la grilla de Oficios queda con tarjetas');
    ok(!/Cargando catálogo/.test(doc.getElementById('resultsCount').textContent || ''), 'el aviso de carga desaparece');

    console.log(`\n${fallos === 0 ? '✅' : '❌'} test_mobile.js ${fallos === 0 ? 'OK' : 'FALLÓ'} (${aserciones} aserciones)`);
    if (fallos) process.exit(1);
})().catch(error => {
    console.error('❌ test_mobile.js falló:', error);
    process.exit(1);
});
