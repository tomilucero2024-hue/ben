const fs = require('fs');

// We need a dummy DOM to test renderizarListadoAreas
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="cardContainer"></div><span id="resultsCount"></span><button id="cargarMas"></button></body></html>`);
global.document = dom.window.document;
global.window = dom.window;

// Mocks
global.ofertas = [
    { area: 'Tecnología', nombre: 'Ingeniería en Sistemas' },
    { area: 'Tecnología', nombre: 'Ingeniería en Sistemas' },
    { area: 'Tecnología', nombre: 'Programación' }
];

global.normalizarTexto = t => t.toLowerCase();
global.capSeguro = t => t;
global.escaparHTML = t => t;
global.estado = {};
global.actualizarVista = () => {};
global.sincronizarURL = () => {};

// Eval the functions from js/render.js
let code = fs.readFileSync('js/render.js', 'utf8');
// remove imports/exports
code = code.replace(/export /g, '');
code = code.replace(/import .*;/g, '');

try {
    eval(code);
    renderizarListadoAreas();
    console.log(document.getElementById('cardContainer').innerHTML);
} catch (e) {
    console.error(e);
}
