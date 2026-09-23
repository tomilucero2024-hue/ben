// ==========================================
// 🧪 TEST DEL TUTORIAL DE PRIMERA VISITA
// ==========================================
// El tutorial se abre una sola vez, después de la portada de bienvenida y solo
// si la persona eligió "Mostrar ofertas". Acá se recorre el circuito completo:
// arranque, pasos, contador, anterior/siguiente, Escape, bandera de visto y
// relanzado desde el pie.
//
// OJO: jsdom no calcula layout, así que todos los rects miden 0. Como el
// tutorial decide qué pasos mostrar midiendo el objetivo, acá se stubea
// getBoundingClientRect con una caja fija: sin eso, los pasos con objetivo se
// saltearían solos y el test no probaría nada.
//
// Correr con:  node test_tutorial.js

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RAIZ = process.cwd();
let aserciones = 0;
let fallos = 0;
const ok = (cond, msg) => {
    if (cond) { aserciones++; console.log(`  ✓ ${msg}`); }
    else { fallos++; console.error(`  ✗ ${msg}`); }
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
const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
        window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
        window.scrollTo = () => {};
        window.requestIdleCallback = (fn) => setTimeout(fn, 10);
        window.HTMLElement.prototype.scrollIntoView = () => {};
        // Sin layout en jsdom: una caja fija y visible para cualquier elemento.
        window.Element.prototype.getBoundingClientRect = function () {
            return { top: 200, left: 100, width: 240, height: 60, right: 340, bottom: 260, x: 100, y: 200, toJSON() { return {}; } };
        };
        // A propósito NO se marca 'ben-tutorial-visto': este test corre la
        // primera visita de verdad.
    }
});
const win = dom.window;

win.fetch = async (url) => {
    const limpia = String(url).split('?')[0].replace(/^\//, '');
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

const esperar = ms => new Promise(r => setTimeout(r, ms));
const doc = win.document;
const tutorial = () => doc.getElementById('tutorial');
const tarjeta = () => doc.getElementById('tutorial-card');
const visible = nodo => nodo && !nodo.hidden;
const paso = () => doc.getElementById('tutorial-paso').textContent;
const titulo = () => doc.getElementById('tutorial-titulo').textContent;
const focoTop = () => doc.querySelector('.tutorial-foco').style.top;

(async () => {
    console.log('🧪 Iniciando test_tutorial...\n');
    await import('./js/main.js');
    await esperar(500);

    console.log('1. Antes de la portada');
    ok(errores.length === 0, `sin errores de arranque${errores.length ? ' → ' + errores[0] : ''}`);
    ok(!visible(tutorial()), 'el tutorial no se abre solo: primero está la portada');
    ok(Boolean(doc.getElementById('btnAbrirTutorial')), 'el pie tiene "¿Cómo funciona?"');

    console.log('2. La portada lleva al catálogo y arranca el tutorial');
    doc.getElementById('btnBienvenidaOfertas').click();
    await esperar(900);
    ok(visible(tutorial()), 'al elegir "Mostrar ofertas" arranca el tutorial');
    ok(tarjeta().getAttribute('role') === 'dialog' && tarjeta().getAttribute('aria-modal') === 'true', 'la tarjeta es un diálogo modal declarado');
    ok(Boolean(doc.getElementById(tarjeta().getAttribute('aria-labelledby'))), 'el diálogo tiene nombre accesible');
    ok(paso() === 'Paso 1 de 6', `el contador arranca en el paso 1 de 6 (${paso()})`);
    ok(/Buscá por carrera/.test(titulo()), 'el paso 1 es el buscador');
    ok(doc.activeElement === doc.getElementById('tutorial-titulo'), 'el foco entra al título del paso (se anuncia solo)');
    ok(doc.getElementById('tutorial-anterior').hidden, 'en el paso 1 no hay "Anterior"');
    ok(doc.querySelector('.hero').inert === true, 'el fondo queda inerte');
    ok(doc.documentElement.classList.contains('tutorial-abierto'), 'la página no scrollea mientras dura el tour');

    console.log('3. Navegación');
    doc.getElementById('tutorial-siguiente').click();
    await esperar(60);
    ok(paso() === 'Paso 2 de 6', 'Siguiente avanza al paso 2');
    ok(/Cinco tipos de oferta/.test(titulo()), 'el paso 2 son las pestañas');
    ok(!doc.getElementById('tutorial-anterior').hidden, 'ya se puede volver');
    ok(!doc.querySelector('.tutorial-foco').hidden && focoTop() !== '', 'el foco queda colocado sobre el objetivo');
    doc.getElementById('tutorial-anterior').click();
    await esperar(60);
    ok(paso() === 'Paso 1 de 6', 'Anterior vuelve al paso 1');

    console.log('4. El último paso cierra');
    for (let i = 0; i < 5; i++) { doc.getElementById('tutorial-siguiente').click(); await esperar(60); }
    ok(paso() === 'Paso 6 de 6', `llega al último paso (${paso()})`);
    ok(!doc.querySelector('.tutorial-foco').hidden && doc.querySelector('.tutorial-foco').style.width === '0px', 'el paso de cierre no ilumina nada pero mantiene el fondo oscurecido');
    ok(doc.getElementById('tutorial-siguiente').textContent === 'Terminar', 'el botón cambia a "Terminar"');
    doc.getElementById('tutorial-siguiente').click();
    await esperar(60);
    ok(!visible(tutorial()), 'Terminar cierra el tutorial');
    ok(!doc.querySelector('.hero').inert, 'el fondo vuelve a ser operable');
    ok(!doc.documentElement.classList.contains('tutorial-abierto'), 'la página vuelve a scrollear');
    ok(win.localStorage.getItem('ben-tutorial-visto') === '1', 'queda marcado como visto');

    console.log('5. No se repite solo');
    doc.getElementById('btnAbrirTutorial').click();
    await esperar(60);
    ok(visible(tutorial()), 'desde el pie se puede repetir a mano');
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await esperar(60);
    ok(!visible(tutorial()), 'Escape cierra');
    ok(doc.activeElement === doc.getElementById('btnAbrirTutorial'), 'el foco vuelve al botón que lo abrió');

    // Se simula el cierre de la portada con destino al catálogo: con la bandera
    // puesta, el tutorial ya no puede volver a arrancar solo.
    doc.dispatchEvent(new win.CustomEvent('ben:bienvenida-cerrada', { detail: { destino: 'catalogo' } }));
    await esperar(400);
    ok(!visible(tutorial()), 'con la bandera puesta, la portada ya no dispara el tutorial');

    console.log('6. Trampa de foco');
    doc.getElementById('btnAbrirTutorial').click();
    await esperar(60);
    const focales = [...tarjeta().querySelectorAll('button:not([hidden])')];
    focales[focales.length - 1].focus();
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    ok(doc.activeElement === focales[0], 'Tab desde el último control vuelve al primero');
    focales[0].focus();
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    ok(doc.activeElement === focales[focales.length - 1], 'Shift+Tab desde el primero salta al último');

    console.log(`\n${fallos === 0 ? '✅' : '❌'} test_tutorial.js ${fallos === 0 ? 'OK' : 'FALLÓ'} (${aserciones} aserciones)`);
    if (fallos) process.exit(1);
})().catch(error => {
    console.error('❌ test_tutorial.js falló:', error);
    process.exit(1);
});
