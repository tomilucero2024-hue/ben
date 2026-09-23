// ==========================================
// 🧪 TEST DE RUBROS DE LOS CATÁLOGOS APARTE
// ==========================================
// data/rubros-aparte.json es contenido curado: clasifica los cursos de
// Formaciones Alternativas y Oficios Técnicos en rubros para que cada sección
// se muestre agrupada (con encabezado y contador) en vez de una grilla plana
// donde la primera institución copa la primera pantalla.
//
// Este test cuida las dos puntas:
//   1. Que la clasificación esté completa y sincronizada con los catálogos. Si
//      un scraper renombra un curso o una institución, la clave del mapa queda
//      huérfana y el curso sin rubro: acá falla con el nombre exacto.
//   2. Que el render agrupado arme los grupos en el orden de la lista cerrada,
//      con sus contadores, encabezados h3 y tarjetas h4, y que la búsqueda
//      deje solo los grupos con coincidencias.
//
// Correr con:  node test_rubros.js

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { pathToFileURL } = require('url');

const RAIZ = process.cwd();
let aserciones = 0;
const fallidas = [];

function ok(cond, msg) {
    if (!cond) fallidas.push(msg);
    else aserciones++;
    console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
}

function leerJson(ruta) {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, ruta), 'utf8'));
}

const CATALOGOS = ['formaciones_alternativas', 'oficios_tecnicos'];

// ==========================================
// 1. EL MAPA CONTRA LOS CATÁLOGOS REALES
// ==========================================
console.log('\n1. Cobertura y sincronía de data/rubros-aparte.json');
const rubrosAparte = leerJson('data/rubros-aparte.json');
const data = leerJson('data/data.json');

(async () => {
    const { limpiarTexto, normalizarTexto } = await import(pathToFileURL(path.join(RAIZ, 'js/util.js')).href);
    const { catalogosAparte, crearCursoAparte } = await import(pathToFileURL(path.join(RAIZ, 'js/datos.js')).href);

    CATALOGOS.forEach(clave => {
        const entrada = rubrosAparte[clave];
        const instituciones = data[clave] || [];
        const cursos = instituciones.flatMap(i => i.carreras || []);

        ok(Boolean(entrada), `${clave}: el archivo trae su bloque`);
        const ids = (entrada.rubros || []).map(r => r.id);
        ok(ids.length > 0 && ids.every(Boolean), `${clave}: ${ids.length} rubros con id`);
        ok(new Set(ids).size === ids.length, `${clave}: ids de rubro sin repetir`);
        ok((entrada.rubros || []).every(r => r.nombre && r.nombre.trim()), `${clave}: todos los rubros tienen nombre visible`);
        ok((entrada.rubros || []).every(r => /^[a-z0-9-]+$/.test(r.id)), `${clave}: los ids son slugs simples (sirven de ancla)`);

        const mapa = entrada.cursos || {};
        const sinRubro = [];
        const fueraDeLista = [];
        const clavesUsadas = new Set();

        instituciones.forEach(institucion => {
            const nombreInstitucion = limpiarTexto(institucion.nombre || 'Institución');
            const porInstitucion = mapa[nombreInstitucion] || {};
            (institucion.carreras || []).forEach(carrera => {
                const nombre = limpiarTexto(carrera.nombre_carrera || 'Formación sin nombre');
                const rubro = porInstitucion[nombre];
                if (!rubro) sinRubro.push(`${nombreInstitucion} :: ${nombre}`);
                else if (!ids.includes(rubro)) fueraDeLista.push(`${nombre} → ${rubro}`);
                clavesUsadas.add(`${nombreInstitucion} :: ${nombre}`);
            });
        });

        ok(sinRubro.length === 0, `${clave}: los ${cursos.length} cursos tienen rubro${sinRubro.length ? ' → faltan ' + sinRubro.length + ': ' + sinRubro.slice(0, 3).join(' | ') : ''}`);
        ok(fueraDeLista.length === 0, `${clave}: todos los rubros asignados están en la lista cerrada${fueraDeLista.length ? ' → ' + fueraDeLista.slice(0, 3).join(' | ') : ''}`);

        const huerfanas = [];
        Object.entries(mapa).forEach(([institucion, cursosDeLaInst]) => {
            const existe = instituciones.some(i => limpiarTexto(i.nombre || 'Institución') === institucion);
            if (!existe) { huerfanas.push(`institución "${institucion}"`); return; }
            Object.keys(cursosDeLaInst).forEach(nombre => {
                if (!clavesUsadas.has(`${institucion} :: ${nombre}`)) huerfanas.push(`${institucion} :: ${nombre}`);
            });
        });
        ok(huerfanas.length === 0, `${clave}: sin claves huérfanas en el mapa (un renombre de scraper las deja al descubierto)${huerfanas.length ? ' → ' + huerfanas.slice(0, 3).join(' | ') : ''}`);

        const porRubro = {};
        Object.values(mapa).forEach(cursosDeLaInst => {
            Object.values(cursosDeLaInst).forEach(r => { porRubro[r] = (porRubro[r] || 0) + 1; });
        });
        const vacios = ids.filter(id => !porRubro[id]);
        ok(vacios.length === 0, `${clave}: ningún rubro de la lista queda vacío${vacios.length ? ' → ' + vacios.join(', ') : ''}`);
    });

    // ==========================================
    // 2. RENDER AGRUPADO (jsdom, con el render real)
    // ==========================================
    console.log('\n2. Render agrupado por rubro');
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <section id="seccion-plataformas" hidden></section>
        <section id="plataformas-coincidentes" hidden></section>
        <div id="cardContainer"></div>
        <div id="resultsToolbar"></div>
        <aside id="filtersSidebar"></aside>
        <button id="mobileFilterButton"></button>
        <section id="seccion-formaciones" hidden><ul id="contenedor-formaciones" class="cursos-grid" role="list"></ul></section>
        <section id="seccion-oficios" hidden><ul id="contenedor-oficios" class="cursos-grid" role="list"></ul></section>
        <section id="seccion-secundario" hidden><ul id="contenedor-secundario" class="cursos-grid" role="list"></ul></section>
    </body></html>`);
    global.document = dom.window.document;
    global.window = dom.window;

    const { estado } = await import(pathToFileURL(path.join(RAIZ, 'js/estado.js')).href);
    const { mostrarCatalogoAparte } = await import(pathToFileURL(path.join(RAIZ, 'js/render.js')).href);

    // Cursos reales del catálogo, armados con la misma función que usa la app.
    const catalogo = catalogosAparte['formaciones-alternativas'];
    catalogo.rubros = rubrosAparte.formaciones_alternativas.rubros;
    catalogo.rubrosCursos = rubrosAparte.formaciones_alternativas.cursos;
    data.formaciones_alternativas.forEach(institucion => {
        (institucion.carreras || []).forEach(carrera =>
            catalogo.cursos.push(crearCursoAparte(carrera, institucion, catalogo)));
    });
    const total = catalogo.cursos.length;

    ok(catalogo.cursos.every(c => c.rubro && c.rubroNombre), `los ${total} cursos llegan al render con rubro y nombre de rubro`);
    ok(catalogo.cursos.every(c => c.busqueda.includes(normalizarTexto(c.rubroNombre))), 'la búsqueda indexa el nombre del rubro');

    estado.texto = '';
    mostrarCatalogoAparte('formaciones-alternativas');
    const contenedor = document.getElementById('contenedor-formaciones');
    ok(contenedor.classList.contains('cursos-grid-agrupado'), 'el contenedor pasa a modo agrupado (deja de ser grilla)');

    const grupos = [...contenedor.children];
    ok(grupos.length === catalogo.rubros.length, `se pinta un grupo por rubro (${grupos.length})`);
    ok(grupos.every(g => g.tagName === 'LI' && g.querySelector(':scope > .rubro-header > h3')), 'cada grupo es un <li> con su h3 de encabezado');

    const idsPintados = grupos.map(g => g.querySelector('h3').id.replace('rubro-', ''));
    ok(JSON.stringify(idsPintados) === JSON.stringify(catalogo.rubros.map(r => r.id)), 'los grupos salen en el orden de la lista cerrada');
    ok(grupos.slice(1).every(g => g.classList.contains('grupo-rubro-separado')), 'los grupos siguientes al primero se separan');

    const tarjetas = grupos.flatMap(g => [...g.querySelectorAll('li.curso-card')]);
    ok(tarjetas.length === total, `la suma de tarjetas es el total del catálogo (${tarjetas.length})`);
    const sumaContadores = grupos.reduce((n, g) => n + Number(g.querySelector('.rubro-count').textContent.split(' ')[0]), 0);
    ok(sumaContadores === total, `los contadores suman el total (${sumaContadores})`);
    ok(tarjetas.every(t => t.querySelector('.curso-title').tagName === 'H4'), 'dentro de un grupo los títulos de curso son h4 (no compiten con el h3 del rubro)');
    ok(tarjetas.every(t => t.querySelector('.badge-seccion').textContent.trim().length > 0), 'cada tarjeta muestra su rubro como badge');
    const sinBadgeDeCategoria = tarjetas.filter(t => t.querySelector('.badge-seccion').textContent.trim() === 'Curso / Formación Profesional');
    ok(sinBadgeDeCategoria.length === 0, 'ninguna tarjeta muestra la categoría genérica como badge');

    // Búsqueda: quedan solo los grupos con coincidencias.
    estado.texto = 'buceo';
    mostrarCatalogoAparte('formaciones-alternativas');
    const gruposFiltrados = [...contenedor.children];
    ok(gruposFiltrados.length === 1 && gruposFiltrados[0].querySelector('h3').textContent.includes('Buceo'), 'al buscar "buceo" queda solo el grupo de buceo');
    // "buceo" es el nombre del rubro, así que el buscador devuelve el grupo
    // entero: los 4 cursos de buceo + los 2 náuticos de Prefectura.
    ok(gruposFiltrados[0].querySelectorAll('li.curso-card').length === 6, `el grupo filtrado trae todo su rubro, no solo el nombre que coincide (${gruposFiltrados[0].querySelectorAll('li.curso-card').length})`);

    // Un curso sin rubro válido no desaparece: cae al grupo final.
    catalogo.cursos[0].rubro = 'rubro-inexistente';
    estado.texto = normalizarTexto(catalogo.cursos[0].nombre);
    mostrarCatalogoAparte('formaciones-alternativas');
    const ultimoGrupo = contenedor.lastElementChild;
    ok(ultimoGrupo.querySelector('h3').textContent === 'Otras formaciones', 'un curso con rubro desconocido cae a "Otras formaciones"');
    ok(ultimoGrupo.querySelectorAll('li.curso-card').length === 1, 'el curso sin rubro no desaparece de la vista');

    // Sin rubros cargados (archivo ausente), vuelve la grilla plana de siempre.
    catalogo.cursos[0].rubro = catalogo.rubros[0].id;
    catalogo.rubros = [];
    catalogo.rubrosCursos = {};
    estado.texto = '';
    mostrarCatalogoAparte('formaciones-alternativas');
    ok(!contenedor.classList.contains('cursos-grid-agrupado'), 'sin rubros, el contenedor vuelve a ser grilla');
    ok(contenedor.querySelectorAll(':scope > li.curso-card').length === total, 'sin rubros, las tarjetas cuelgan directo del contenedor');
    ok(contenedor.querySelector('.curso-title').tagName === 'H3', 'en la grilla plana los títulos vuelven a ser h3');

    // ==========================================
    console.log(`\n${fallidas.length ? '❌' : '✅'} test_rubros.js ${fallidas.length ? 'FALLÓ' : 'OK'} (${aserciones} aserciones)`);
    if (fallidas.length) {
        fallidas.forEach(f => console.log('   ✗ ' + f));
        process.exit(1);
    }
})();
