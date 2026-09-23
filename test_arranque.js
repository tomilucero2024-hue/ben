// ============================================================================
// Smoke de ARRANQUE de la app real: carga index.html en jsdom, corre los
// scripts clásicos y main.js, y verifica que la app quede viva y cableada.
//
// Es el test que atrapa lo que los unitarios no ven: un id que ya no existe,
// un listener que quedó apuntando a un botón borrado, un módulo que no arranca.
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
    // jsdom no implementa scrollTo/print; el CSS de Google Fonts tampoco se parsea.
    if (/Could not parse CSS|not implemented|scrollTo/i.test(texto)) return;
    errores.push(texto);
});
vc.on('error', () => {});
vc.on('warn', () => {});
vc.on('log', () => {});

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
        // jsdom no trae matchMedia y el script de tema del <head> lo usa.
        window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
        window.scrollTo = () => {};
        window.requestIdleCallback = (fn) => setTimeout(fn, 10);
        window.HTMLElement.prototype.scrollIntoView = () => {};
        // Este test recorre la app como una persona que ya conoce la página: con
        // el tutorial de primera visita pendiente, se abriría encima del flujo
        // (portada → chat → test) y lo taparía. El tutorial se prueba en
        // test_tutorial.js, que arranca sin la bandera.
        window.localStorage.setItem('ben-tutorial-visto', '1');
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

(async () => {
    console.log('🧪 Iniciando test_arranque...\n');
    await import('./js/main.js');
    await new Promise(r => setTimeout(r, 500));

    console.log('1. La app arranca');
    ok(errores.length === 0, `sin errores de arranque${errores.length ? ' → ' + errores[0] : ''}`);
    ok(win.document.body.dataset.seccion === 'formal', 'la sección formal queda activa');

    console.log('2. Grilla y botones');
    const tarjetas = win.document.querySelectorAll('#cardContainer .card');
    ok(tarjetas.length > 0, `la grilla pinta tarjetas (${tarjetas.length})`);
    ok(win.document.querySelectorAll('#cardContainer .btn-favorito').length === tarjetas.length,
        'cada tarjeta trae "Me interesa"');

    console.log('3. Mi lista cableada');
    const botonLista = win.document.getElementById('btnMiLista');
    ok(Boolean(botonLista) && Boolean(win.document.getElementById('miLista')), 'el botón y la ventana existen');
    win.document.querySelector('#cardContainer .btn-favorito').click();
    await new Promise(r => setTimeout(r, 50));
    ok(win.Favoritos.contar() === 1, 'el corazón guarda la ficha');
    ok(win.document.getElementById('miListaContador').textContent === '1', 'el contador de la barra se actualiza');
    ok(Boolean(win.document.querySelector('.fav-toast.is-visible')), 'aparece el aviso de guardado');
    botonLista.click();
    await new Promise(r => setTimeout(r, 300));
    ok(!win.document.getElementById('miLista').hidden, 'el botón abre Mi lista');
    ok(win.document.querySelectorAll('.ml-item').length === 1, 'la ficha guardada aparece en la lista');
    win.document.getElementById('ml-cerrar').click();
    ok(win.document.getElementById('miLista').hidden, 'la ✕ la cierra');

    console.log('4. Bienvenida y copiloto');
    const bienvenida = win.document.getElementById('pantallaBienvenida');
    const tarjetaOrientador = win.document.getElementById('btnBienvenidaCopiloto');
    ok(win.document.querySelectorAll('#pantallaBienvenida .bienvenida-card').length === 2, 'la portada tiene exactamente dos tarjetas');
    ok(Boolean(tarjetaOrientador) && /Orientador vocacional/.test(tarjetaOrientador.textContent), 'la primera es el orientador vocacional');
    ok(/menos de 5 minutos/.test(tarjetaOrientador.textContent), 'con la promesa de menos de 5 minutos');
    ok(Boolean(win.document.getElementById('btnBienvenidaOfertas')), 'la segunda es "Mostrar ofertas"');
    ok(!/65 preguntas/.test(bienvenida.textContent), 'la portada no menciona las 65 preguntas');
    tarjetaOrientador.click();
    await new Promise(r => setTimeout(r, 600));
    ok(Boolean(win.document.querySelector('#chat-caja .cb-cta')), 'el chat abre con su mensaje de bienvenida');
    const cta = win.document.querySelector('#chat-caja [data-chat-accion="test-completo"]');
    ok(Boolean(cta), 'el chat ofrece el test completo');
    cta.click();
    await new Promise(r => setTimeout(r, 700));
    ok(!win.document.getElementById('testCompleto').hidden, 'el CTA del chat abre el test');
    ok(win.document.querySelectorAll('#tc-cuerpo .tc-opcion').length > 0 || /preguntas/.test(win.document.getElementById('tc-cuerpo').innerHTML),
        'el test arranca con su intro o su primera tanda');

    console.log(`\n${fallos === 0 ? '✅' : '❌'} test_arranque.js: ${aserciones} aserciones, ${fallos} fallo(s)`);
    process.exit(fallos ? 1 : 0);
})().catch(error => {
    console.error('❌ test_arranque.js falló:', error);
    process.exit(1);
});
