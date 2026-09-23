const fs = require('fs');
const { JSDOM } = require('jsdom');

// DOM mínimo con la toolbar del sitio: contador, chapa (oculta), selector de
// vistas (Carreras/Instituciones) y los chips de "Área" del sidebar, que son
// los que actualizarBotonesActivos() pinta tras limpiar los filtros.
const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="resultsToolbar" class="results-toolbar">
        <div class="results-toolbar-top">
            <span id="resultsCount"></span>
            <span id="chapaRecomendacion" hidden></span>
        </div>
        <div class="results-toolbar-bottom">
            <nav id="vistasSwitcher" aria-label="Forma de explorar las carreras">
                <button type="button" class="vistas-switcher-btn" data-vista="carreras" aria-pressed="false">Carreras</button>
                <button type="button" class="vistas-switcher-btn" data-vista="instituciones" aria-pressed="false">Instituciones</button>
            </nav>
            <div class="toolbar-actions"></div>
        </div>
    </div>
    <div id="cardContainer"></div>
    <button id="cargarMas"></button>
    <div class="filter-options">
        <button class="filter-option active" data-filter="area" data-value="todos">Todas las áreas</button>
        <button class="filter-option" data-filter="area" data-value="Tecnología">Tecnología</button>
    </div>
</body></html>`);
global.document = dom.window.document;
global.window = dom.window;

// Mocks que las funciones de render.js esperan como globales al no poder
// importar (el test le pega al .js crudo y le quita import/export).
global.ofertas = [];
global.plataformas = [];
global.catalogosAparte = {};
global.enlacesBEN = {};
global.estado = { vista: 'carreras', tipoInstitucion: null, area: 'todos' };
global.sincronizarURL = () => {};
global.normalizarTexto = t => (t || '').toLowerCase();
global.capSeguro = t => t;
global.escaparHTML = t => t;
global.urlSegura = t => t;
global.formatearDuracionAnios = n => n + ' año(s)';
global.nombreSeguro = t => t;
global.SVG_INSTITUCION = '<svg></svg>';
global.SVG_DURACION = '<svg></svg>';
global.SVG_MODALIDAD = '<svg></svg>';

let code = fs.readFileSync('js/render.js', 'utf8');
code = code.replace(/export /g, '');
code = code.replace(/import .*;/g, '');

eval(code);

// CambiarVista invoca actualizarVista(); como stub hacemos que refresque el
// selector activo, que es justo lo que mostrarResultados() hace en el sitio.
actualizarVista = () => actualizarSwitcherVistas();
sincronizarURLHook = global.sincronizarURL;

let aserciones = 0;
function ok(cond, msg) {
    if (!cond) throw new Error('FALLO: ' + msg);
    aserciones++;
    console.log('  ✓ ' + msg);
}

// 1. El cableado arma el selector y deja activa la vista por defecto: TODAS
//    LAS CARRERAS (la página principal del sitio).
configurarSwitcherVistas();
ok(document.getElementById('vistasSwitcher').dataset.listos === '1', 'configurarSwitcherVistas cablea el selector una sola vez');
actualizarSwitcherVistas();
ok(document.querySelector('[data-vista="carreras"]').classList.contains('is-active'), 'Carreras nace activo (vista por defecto)');
ok(document.querySelector('[data-vista="carreras"]').getAttribute('aria-pressed') === 'true', 'aria-pressed=true en la vista activa');
ok(document.querySelector('[data-vista="instituciones"]').getAttribute('aria-pressed') === 'false', 'aria-pressed=false en las vistas inactivas');

// 2. Cambiar a instituciones resetea el drilldown de tipo.
estado.tipoInstitucion = 'universidades';
cambiarVista('instituciones');
ok(estado.vista === 'instituciones', 'cambiarVista(instituciones) actualiza estado.vista');
ok(estado.tipoInstitucion === null, 'cambiarVista resetea tipoInstitucion');
ok(document.querySelector('[data-vista="instituciones"]').classList.contains('is-active'), 'Instituciones queda activo tras el cambio');

// 3. Entrar a Instituciones con búsqueda o filtros activos limpia el estado:
//    la vista siempre cae en su raíz, sin filtros que no le aplican.
estado.texto = 'derecho';
estado.formacion = 'grado';
estado.departamentos = ['Capital', 'Godoy Cruz'];
estado.area = 'Tecnología';
document.querySelector('[data-filter="area"][data-value="Tecnología"]').classList.add('active');
cambiarVista('instituciones');
ok(estado.texto === '' && estado.formacion === 'todos', 'la búsqueda y los filtros formales se limpian al entrar');
ok(estado.departamentos.length === 0, 'la selección de departamentos se limpia');
ok(estado.area === 'todos', 'el área vuelve a "todas"');
ok(document.querySelector('[data-filter="area"][data-value="todos"]').classList.contains('active'), 'el chip "Todas las áreas" queda activo tras limpiar');
ok(!document.querySelector('[data-filter="area"][data-value="Tecnología"]').classList.contains('active'), 'el chip de área previo se desactiva');

// 4. Hacer click en un botón del selector cambia la vista (misma ruta que la
//    bienvenida, así las dos entradas comparten comportamiento).
document.querySelector('[data-vista="carreras"]').click();
ok(estado.vista === 'carreras', 'el click en "Carreras" del selector cambia la vista');

console.log('✅ test_switcher.js OK (' + aserciones + ' aserciones)');