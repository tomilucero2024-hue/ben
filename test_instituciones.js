const fs = require('fs');
const { JSDOM } = require('jsdom');

function strip(src) {
    return src.replace(/export /g, '').replace(/import .*;/g, '');
}

const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="resultsToolbar" class="results-toolbar">
        <div class="results-toolbar-top"><span id="resultsCount"></span><span id="chapaRecomendacion" hidden></span></div>
        <div class="results-toolbar-bottom"><nav id="vistasSwitcher" aria-label="Forma de explorar las carreras"></nav><div class="toolbar-actions"></div></div>
    </div>
    <div id="cardContainer"></div>
    <button id="cargarMas"></button>
    <div class="filter-options"><button class="filter-option active" data-filter="area" data-value="todos">Todos</button></div>
</body></html>`);
global.document = dom.window.document;
global.window = dom.window;

eval(strip(fs.readFileSync('js/util.js', 'utf8')));

const data = JSON.parse(fs.readFileSync('data/data.json', 'utf8'));
const enlaces = JSON.parse(fs.readFileSync('data/enlaces-ben.json', 'utf8'));

// Mismas ofertas que arma js/datos.js (solo los campos que usa la vista de
// instituciones): institucion, gestion, tipoInstitucion, departamento.
global.ofertas = [];
(data.instituciones || []).forEach(inst => {
    (inst.carreras || []).forEach(c => {
        global.ofertas.push({
            nombre: limpiarTexto(c.nombre_carrera || 'Carrera sin nombre'),
            institucion: limpiarTexto(inst.nombre || 'Institución'),
            gestion: inferirGestion(inst),
            tipoInstitucion: inferirTipoInstitucion(inst),
            departamento: limpiarTexto(inst.departamento || '')
        });
    });
});
global.plataformas = [];
global.catalogosAparte = {};
global.enlacesBEN = enlaces;
global.estado = { vista: 'instituciones', tipoInstitucion: null, area: 'todos' };
global.sincronizarURL = () => {};
global.actualizarVista = () => {};
global.etiquetaCompatibilidad = () => '';
global.ETIQUETAS_FUENTE = {};
global.FILTROS_SOLO_FORMALES = false;
global.cumpleFiltros = () => true;
global.filtrarYOrdenar = l => l;
global.obtenerRelacionadas = () => [];

eval(strip(fs.readFileSync('js/render.js', 'utf8')));

renderizarListadoInstituciones();

let aserciones = 0;
function ok(cond, msg) {
    if (!cond) throw new Error('FALLO: ' + msg);
    aserciones++;
    console.log('  ✓ ' + msg);
}

// 1. El contador resume total de instituciones, sin pedir click en un tipo.
ok(document.getElementById('resultsCount').textContent === '53 instituciones · por tipo',
    'el contador dice "53 instituciones · por tipo"');
ok(!document.querySelector('#cardContainer .area-card[data-tipo]'),
    'no hay tarjetas de "tipo" que exijan click (drilldown eliminado)');
ok(!document.getElementById('cardContainer').classList.contains('areas-grid'),
    'el contenedor no usa la grilla de tarjetas de tipo');

// 2. Tres grupos con su h2, en el orden del catálogo.
const h2s = [...document.querySelectorAll('#cardContainer h2.area-header-title')].map(h => h.textContent.trim());
ok(h2s.length === 3, 'hay 3 encabezados h2 de tipo');
ok(h2s[0] === 'Universidades' && h2s[1] === 'Institutos de Educación Superior' && h2s[2] === 'Centros de Formación y otros',
    'los h2 salen en orden: Universidades, IES, Centros');
ok(['tipo-universidades', 'tipo-ies', 'tipo-centros'].every(id => document.getElementById(id)),
    'cada h2 tiene un id ancla propio');

// 3. Todos visibles a la vez: los conteos por grupo y el total de tarjetas.
const grupos = [...document.querySelectorAll('#cardContainer .grupo-instituciones')];
const conteos = grupos.map(g => g.querySelectorAll('.card.career-group-card').length);
ok(JSON.stringify(conteos) === JSON.stringify([12, 39, 2]),
    '12 universidades + 39 IES + 2 centros, todos renderizados de una');
const totalTarjetas = document.querySelectorAll('#cardContainer .card.career-group-card').length;
ok(totalTarjetas === 53, 'total de 53 tarjetas de institución en el DOM');

// 4. Cada tarjeta tiene su único CTA, con href a una página estática real.
const ctaLinks = [...document.querySelectorAll('#cardContainer .card.career-group-card .card-link')];
ok(ctaLinks.length === 53, 'una sola acción por tarjeta (link o "Sin ficha en BEN")');
let hrefsNulos = 0;
ctaLinks.forEach(el => {
    const href = el.getAttribute('href');
    if (!el.classList.contains('card-link-muted')) {
        if (!/^\/institucion\/[\w-]+\/$/.test(href)) throw new Error('FALLO: href mal formado: ' + href);
        const slug = href.replace(/^\/institucion\//, '').replace(/\/$/, '');
        if (!fs.existsSync(`institucion/${slug}/index.html`)) throw new Error('FALLO: sin página estática: ' + href);
    } else {
        hrefsNulos++;
    }
});
ok(hrefsNulos === 0, 'ninguna institución quedó sin ficha (CTA siempre navega a su estática)');

// 5. El tipo no se repite en la tarjeta (el h2 ya lo dice): sin .badge-area.
ok(document.querySelectorAll('#cardContainer .card.career-group-card .badge-area').length === 0,
    'las tarjetas no repiten el tipo en un badge');

// 6. La separación entre grupos: solo a partir del segundo.
ok(!grupos[0].classList.contains('grupo-instituciones-separado') && grupos[1].classList.contains('grupo-instituciones-separado'),
    'los grupos siguientes se separan verticalmente');

console.log(`✅ test_instituciones.js OK (${aserciones} aserciones)`);