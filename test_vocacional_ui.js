// ============================================================================
// Smoke test de la ventana del Test Vocacional Completo (jsdom).
// Valida el recorrido completo: abrir → responder → resultados → grilla.
// ============================================================================
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RAIZ = __dirname;
let aserciones = 0;
let fallos = 0;
const ok = (cond, msg) => {
    if (cond) { aserciones++; console.log('  ✓ ' + msg); }
    else { fallos++; console.error('  ✗ ' + msg); }
};

// El DOM mínimo que la app necesita para arrancar (mismos ids que index.html).
const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body data-seccion="formal">
  <div class="hero"></div><div class="catalog-layout"></div>
  <aside id="copilotoPanel"></aside>
  <header class="header"></header><footer class="site-footer"></footer><aside class="a11y-widget"></aside>
  <div id="resultsToolbar"><span id="resultsCount"></span><span id="chapaRecomendacion" hidden></span><nav id="vistasSwitcher"></nav><div class="toolbar-actions"></div></div>
  <div id="filtersSidebar"></div><button id="mobileFilterButton"></button><div id="filtersOverlay"></div>
  <div id="cardContainer"></div><button id="cargarMas"></button>
  <div id="seccion-plataformas"></div><div id="plataformas-coincidentes"></div>
  <div id="seccion-formaciones"><div id="contenedor-formaciones"></div></div>
  <div id="seccion-oficios"><div id="contenedor-oficios"></div></div>
  <div id="seccion-secundario"><div id="contenedor-secundario"></div></div>
  <div class="filter-options"><button class="filter-option active" data-filter="area" data-value="todos">Todos</button></div>
  <aside id="testCompleto" hidden><div class="tc-ventana">
    <button id="tc-cerrar"></button>
    <div id="tc-progreso" hidden><span id="tc-progreso-relleno"></span><p id="tc-progreso-texto"></p></div>
    <div id="tc-cuerpo"></div><footer id="tc-pie"></footer>
  </div></aside>
</body></html>`, { url: 'http://localhost/' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.location = dom.window.location;
global.history = dom.window.history;
global.URL = dom.window.URL;
global.Blob = dom.window.Blob;
global.CustomEvent = dom.window.CustomEvent;
global.Element = dom.window.Element;

// fetch sobre archivos locales: el motor y la app piden los JSON por ruta.
global.fetch = async (url) => {
    const p = path.join(RAIZ, String(url).replace(/^\//, ''));
    if (!fs.existsSync(p)) return { ok: false, status: 404 };
    const texto = fs.readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(texto), text: async () => texto };
};

dom.window.eval(fs.readFileSync(path.join(RAIZ, 'js/vocacional/motor.js'), 'utf8'));
dom.window.eval(fs.readFileSync(path.join(RAIZ, 'js/vocacional/eventos.js'), 'utf8'));

(async () => {
    console.log('🧪 Iniciando test_vocacional_ui...\n');
    const mod = await import('./js/vocacional/test-completo.js');
    const { estado } = await import('./js/estado.js');
    mod.inicializarTestCompleto();

    const cuerpo = document.getElementById('tc-cuerpo');
    const pie = document.getElementById('tc-pie');

    await mod.abrirTestCompleto();
    ok(!document.getElementById('testCompleto').hidden, 'la ventana se abre');
    ok(/Un diagnóstico más profundo/.test(cuerpo.innerHTML), 'muestra la intro');
    ok(/65 preguntas/.test(cuerpo.innerHTML), 'la intro dice cuántas preguntas son');

    pie.querySelector('[data-tc-accion="empezar"]').click();
    ok(document.querySelectorAll('.tc-pregunta').length === 9, `la primera tanda trae 9 preguntas (${document.querySelectorAll('.tc-pregunta').length})`);

    // Responder eligiendo siempre el valor 3, tanda por tanda.
    let vueltas = 0;
    while (vueltas++ < 40) {
        const sinResponder = [...document.querySelectorAll('.tc-pregunta')].filter(f => !f.querySelector('input:checked'));
        sinResponder.forEach(f => {
            const input = f.querySelector('input[value="3"]');
            input.checked = true;
            input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
        });
        const siguiente = pie.querySelector('[data-tc-accion="siguiente"]');
        if (!siguiente || siguiente.disabled) break;
        const ultima = /Ver mi resultado/.test(siguiente.textContent);
        siguiente.click();
        if (ultima) break;
    }
    await new Promise(r => setTimeout(r, 300));

    ok(/Tus \d+ carreras más afines/.test(cuerpo.innerHTML), 'muestra la pantalla de resultados');
    ok(document.querySelectorAll('.tc-card').length === 8, `muestra 8 carreras (${document.querySelectorAll('.tc-card').length})`);
    ok(/\d+%/.test(cuerpo.innerHTML), 'las tarjetas traen porcentaje');
    ok(/Tenés un perfil/.test(cuerpo.innerHTML), 'hay resumen del perfil en lenguaje simple');
    ok(Boolean(localStorage.getItem('ben-vocacional-perfil')), 'guarda el perfil en localStorage');

    document.querySelector('[data-tc-evento="me-interesa"]').click();
    const eventos = JSON.parse(localStorage.getItem('ben-vocacional-eventos') || '[]');
    ok(eventos.length === 1 && eventos[0].claveCarrera && eventos[0].perfil.riasec, 'registra el evento con el perfil del estudiante');

    cuerpo.querySelector('[data-tc-accion="ver-en-buscador"]').click();
    await new Promise(r => setTimeout(r, 100));
    ok(Boolean(estado.recomendacion && estado.recomendacion.carreras.length), `la grilla entra en modo recomendación (${estado.recomendacion ? estado.recomendacion.total : 0} carreras)`);
    ok(document.querySelectorAll('#cardContainer .carrera-card').length > 0, 'la grilla pinta tarjetas con compatibilidad');
    ok(document.getElementById('testCompleto').hidden, 'la ventana se cierra al ir al buscador');

    console.log(`\n${fallos === 0 ? '✅' : '❌'} test_vocacional_ui.js: ${aserciones} aserciones, ${fallos} fallo(s)`);
    process.exit(fallos ? 1 : 0);
})().catch(error => {
    console.error('❌ test_vocacional_ui.js falló:', error);
    process.exit(1);
});
