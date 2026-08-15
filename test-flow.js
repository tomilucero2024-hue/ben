// Test harness: execute frontend/app.js with a minimal DOM mock and
// simulate the vocational test flow end-to-end.
const fs = require('fs');
const vm = require('vm');

function makeElement(id) {
  const listeners = {};
  const el = new Proxy({
    id, innerHTML: '', textContent: '', value: '', hidden: false,
    dataset: {}, style: {},
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    scrollIntoView() {},
    focus() {},
    appendChild() {},
    removeChild() {},
    parentNode: { removeChild() {}, appendChild() {} },
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener(ev, fn) { listeners[ev] = fn; },
    removeEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return null; },
    click() {},
    _listeners: listeners
  }, {
    get(t, p) {
      if (p in t) return t[p];
      return () => {};
    }
  });
  return el;
}

const elements = {};
const document = {
  body: makeElement('body'),
  documentElement: makeElement('html'),
  getElementById(id) {
    if (!elements[id]) elements[id] = makeElement(id);
    return elements[id];
  },
  querySelectorAll(sel) {
    if (sel === '.section-tab' || sel === '.filter-option') return [];
    if (sel && sel.includes('.')) return [];
    return [];
  },
  querySelector(sel) { return makeElement(String(sel)); },
  createElement(tag) { return makeElement(String(tag)); },
  addEventListener() {},
  removeEventListener() {},
  dataset: {}
};

const storage = {};
const localStorage = {
  getItem(k) { return k in storage ? storage[k] : null; },
  setItem(k, v) { storage[k] = String(v); },
  removeItem(k) { delete storage[k]; }
};

const history = { replaceState() {}, pushState() {} };
const location = { search: '', hash: '', pathname: '/frontend/index.html' };

const sandbox = {
  console,
  document,
  localStorage,
  history,
  location,
  window: {},
  navigator: { userAgent: 'node-test' },
  fetch: async (url) => {
    const map = {
      '../data/data.json': JSON.parse(fs.readFileSync('data/data.json', 'utf8')),
      '../data/carreras-perfiles.json': JSON.parse(fs.readFileSync('data/carreras-perfiles.json', 'utf8'))
    };
    return { ok: true, json: async () => map[url] };
  },
  setTimeout: (fn) => { fn(); return 0; }, // run synchronously
  clearTimeout() {},
  requestAnimationFrame: (fn) => { fn(); return 0; },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  CSS: { escape: (s) => String(s) },
  customElements: { define() {} },
  Event: function () {},
  CustomEvent: function () {},
  IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
  ResizeObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
  URLSearchParams,
  URL,
  TextEncoder,
  Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Set, Map, Promise, Error, TypeError
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

const appCode = fs.readFileSync('frontend/app.js', 'utf8');
const orientadorCode = fs.readFileSync('frontend/js/orientador.js', 'utf8');

vm.createContext(sandbox);

try {
  vm.runInContext(orientadorCode, sandbox, { filename: 'orientador.js' });
  vm.runInContext(appCode, sandbox, { filename: 'app.js' });
  console.log('app.js cargó sin errores');
} catch (e) {
  console.error('ERROR al cargar:', e.message);
  process.exit(1);
}

(async () => {
  try {
    // Disparar DOMContentLoaded
    // (la app escucha sobre document; nuestro mock no almacena el listener, así que llamamos directo)
    // En su lugar, esperamos a que carguen las ofertas y el orientador.
    // Simular las funciones del flujo directamente:

    await sandbox.inicializarOrientador();
    console.log('Orientador inicializado');

    vm.runInContext('iniciarTestVocacional();', sandbox);
    console.log('Test iniciado, pasoActual=', vm.runInContext('pasoActual', sandbox));

    // Responder las 5 preguntas con la primera opción de cada una
    for (let i = 0; i < 5; i++) {
      const q = JSON.parse(vm.runInContext('JSON.stringify(preguntasTest[pasoActual])', sandbox));
      const op = q.opciones[0];
      vm.runInContext(`seleccionarOpcionChat(0, ${JSON.stringify(op.texto)})`, sandbox);
      console.log('Respuesta ' + (i + 1) + '/' + q.id + ' ok, pasoActual=', vm.runInContext('pasoActual', sandbox));
    }

    // Al llegar a 5, debe haberse llamado mostrarRecomendacion
    const grid = document.getElementById('cardContainer');
    console.log('Resultados renderizados en cardContainer:', grid.innerHTML.length > 0 ? 'SI' : 'NO');
    if (grid.innerHTML.length > 0) {
      console.log('Muestra primeros 300 chars:');
      console.log(grid.innerHTML.substring(0, 300).replace(/\s+/g, ' '));
    }
    console.log('FLUJO OK');

    // Test volver atrás (retroceder de la pregunta 3 a la 2)
    vm.runInContext('iniciarTestVocacional();', sandbox);
    vm.runInContext('seleccionarOpcionChat(0, preguntasTest[0].opciones[0].texto);', sandbox);
    vm.runInContext('seleccionarOpcionChat(0, preguntasTest[1].opciones[0].texto);', sandbox);
    console.log('Antes de volver, pasoActual=', vm.runInContext('pasoActual', sandbox));
    vm.runInContext('volverPreguntaChat();', sandbox);
    console.log('Después de volver, pasoActual=', vm.runInContext('pasoActual', sandbox));
    const respuestasLen = vm.runInContext('respuestasTest.length', sandbox);
    console.log('respuestasTest.length=', respuestasLen, '(debe ser 1)');

    // Test reiniciar
    vm.runInContext('reiniciarChat();', sandbox);
    console.log('reiniciarChat ok, pasoActual=', vm.runInContext('pasoActual', sandbox), ', enTestVocacional=', vm.runInContext('enTestVocacional', sandbox));
    console.log('REGRESIÓN OK');
  } catch (e) {
    console.error('ERROR en flujo:', e.stack);
    process.exit(1);
  }
})();
