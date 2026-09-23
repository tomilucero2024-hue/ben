// ==========================================
// 🧪 TEST GENERAL DEL SITIO
// ==========================================
// Valida que todo el sitio funcione: coherencia de imports/exports de los
// módulos ES (un import mal nombrado rompe la app ENTERA en el navegador y
// acá lo detectamos sin abrir el browser), pantalla de bienvenida, sello de
// caché (index.html vs sw.js vs páginas generadas), los tres catálogos de
// data.json, el render de tarjetas con sede, los archivos que precachea el
// service worker y un smoke test HTTP.
//
// Correr con:  node test_general.js

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { renderizarCursosAparte } from './js/render.js';
import { getArea } from './js/util.js';

const RAIZ = process.cwd();
let aprobadas = 0;
const fallidas = [];

function check(condicion, nombre) {
    if (condicion) { aprobadas++; console.log(`  ✓ ${nombre}`); }
    else { fallidas.push(nombre); console.log(`  ✗ ${nombre}`); }
}

function leer(ruta) { return fs.readFileSync(path.join(RAIZ, ruta), 'utf8'); }
function existe(ruta) { return fs.existsSync(path.join(RAIZ, ruta)); }

// Recorre un directorio y devuelve los .html (para el escaneo de sellos).
function paginasHtml(dir) {
    const salida = [];
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, entrada.name);
        if (entrada.isDirectory()) salida.push(...paginasHtml(ruta));
        else if (entrada.name.endsWith('.html')) salida.push(ruta);
    }
    return salida;
}

// ==========================================
// 1. IMPORTS/EXPORTS DE LOS MÓDULOS ES
// ==========================================
// Un import de un nombre que el módulo destino no exporta lanza un
// SyntaxError en el navegador ANTES de ejecutar nada: pantalla en blanco.
// node --check no lo detecta porque valida archivo por archivo.
console.log('\n1. Coherencia de imports/exports (js/*.js)');

function exportesDe(codigo) {
    const nombres = new Set();
    for (const m of codigo.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g)) nombres.add(m[1]);
    for (const m of codigo.matchAll(/export\s*\{([^}]*)\}/g)) {
        m[1].split(',').forEach(parte => {
            const nombre = parte.split(/\s+as\s+/).pop().trim();
            if (nombre) nombres.add(nombre);
        });
    }
    if (/export\s+default/.test(codigo)) nombres.add('default');
    return nombres;
}

const codigosJs = {};
function recorrerJs(dir, prefijo) {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entrada.isDirectory()) recorrerJs(path.join(dir, entrada.name), `${prefijo}${entrada.name}/`);
        else if (entrada.name.endsWith('.js')) codigosJs[`${prefijo}${entrada.name}`] = leer(`js/${prefijo}${entrada.name}`);
    }
}
recorrerJs(path.join(RAIZ, 'js'), '');
const exportes = {};
for (const [archivo, codigo] of Object.entries(codigosJs)) exportes[archivo] = exportesDe(codigo);

let importsRevisados = 0, importsRotos = [];
for (const [archivo, codigo] of Object.entries(codigosJs)) {
    for (const m of codigo.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
        // Las rutas son relativas al archivo que importa, no a js/: se resuelven
        // con path.posix para que los submódulos (js/vocacional/...) funcionen.
        const destino = path.posix.normalize(path.posix.join(path.posix.dirname(archivo), m[2]));
        if (!exportes[destino]) { importsRotos.push(`${archivo} importa de ${m[2]} que no existe`); continue; }
        for (const parte of m[1].split(',')) {
            const original = parte.split(/\s+as\s+/)[0].trim();
            if (!original) continue;
            importsRevisados++;
            if (!exportes[destino].has(original)) importsRotos.push(`${archivo} importa '${original}' pero js/${destino} no lo exporta`);
        }
    }
}
check(importsRotos.length === 0, `los ${importsRevisados} imports nombrados entre módulos se resuelven${importsRotos.length ? ' → ' + importsRotos.slice(0, 3).join(' | ') : ''}`);

// Los <script> de index.html tienen que apuntar a archivos reales.
const htmlIndex = leer('index.html');
const scriptsIndex = [...htmlIndex.matchAll(/src="(\/js\/[^"?]+)/g)].map(m => m[1].slice(1));
check(scriptsIndex.length > 0 && scriptsIndex.every(s => existe(s)), `los ${scriptsIndex.length} <script> de index.html existen en js/`);

// ==========================================
// 2. PANTALLA DE BIENVENIDA
// ==========================================
console.log('\n2. Pantalla de bienvenida');
check(/id="btnBienvenidaOfertas"/.test(htmlIndex) && /Mostrar ofertas/.test(htmlIndex), 'index.html tiene el botón "Mostrar ofertas"');
check(!/btnBienvenidaCarreras|btnBienvenidaInstituciones|btnBienvenidaAreas/.test(htmlIndex), 'no quedan los 3 botones viejos de la bienvenida');
const sinColgadosBienvenida = Object.values(codigosJs).every(c => !/btnBienvenidaCarreras|btnBienvenidaInstituciones|btnBienvenidaAreas/.test(c));
check(sinColgadosBienvenida, 'ningún JS referencia los botones eliminados');
check(/id="btnBienvenidaCopiloto"/.test(htmlIndex) && /Orientador vocacional/.test(htmlIndex), 'la bienvenida ofrece el orientador vocacional (copiloto)');
check(/id="btnBienvenidaOfertas"/.test(htmlIndex) && /Mostrar ofertas/.test(htmlIndex), 'y "Mostrar ofertas" para el catálogo');
check(!/btnBienvenidaTestCompleto/.test(htmlIndex), 'la bienvenida no tiene una tarjeta aparte para el test');
check(Object.values(codigosJs).every(c => !/btnBienvenidaTestCompleto/.test(c)), 'ningún JS referencia la tarjeta eliminada');
const bloqueBienvenida = (htmlIndex.match(/id="pantallaBienvenida"([\s\S]*?)<\/section>/) || [])[1] || '';
check(!/65 preguntas/.test(bloqueBienvenida), 'la portada (texto visible) no menciona las 65 preguntas');

// ==========================================
// 2b. MI LISTA (favoritos + comparador)
// ==========================================
console.log('\n2b. Mi lista');
check(/id="btnMiLista"/.test(htmlIndex) && /id="miLista"/.test(htmlIndex), 'index.html tiene el botón y la ventana de Mi lista');
check(scriptsIndex.includes('js/favoritos.js'), 'index.html carga js/favoritos.js (script clásico)');
check(!/orientador\.js/.test(htmlIndex), 'index.html ya no carga el motor viejo (orientador.js)');
const rutasShell2 = [...((leer('sw.js').match(/const SHELL = \[([^\]]+)\]/) || [])[1] || '').matchAll(/'([^']+)'/g)].map(m => m[1]);
for (const ruta of ['js/favoritos.js', 'js/mi-lista.js']) {
    check(rutasShell2.includes(ruta), `el shell del SW incluye ${ruta}`);
}
for (const ruta of ['js/orientador.js', 'data/carreras-perfiles.json']) {
    check(!rutasShell2.includes(ruta), `el shell del SW ya no incluye ${ruta}`);
}
check(!existe('js/orientador.js') && !existe('data/carreras-perfiles.json'), 'los archivos del test viejo ya no están en el repo');
const fichaEstatica = leer('carrera/abogacia/index.html');
check(/data-fav-clave=/.test(fichaEstatica), 'las páginas estáticas generadas traen el botón "Me interesa"');
check(/data-fav-solo-icono/.test(fichaEstatica), 'en las estáticas el corazón va solo (sin texto)');
check(/class="btn-ver-mi-lista"/.test(fichaEstatica), 'y "Ver Mi lista" como botón propio');
check(/--fav-rojo/.test(leer('style.css')) && /--fav-rojo/.test(leer('paginas.css')), 'el corazón marcado es rojo en la app y en las estáticas');

// ==========================================
// 3. SELLO DE CACHÉ (index.html ↔ sw.js ↔ páginas)
// ==========================================
// sw.js advierte: el sello tiene que moverse junto con los ?v=. Si quedan
// desincronizados, visitantes con el SW instalado siguen viendo la versión
// vieja del catálogo.
console.log('\n3. Sello de caché');
const selloIndex = (htmlIndex.match(/style\.css\?v=([\w-]+)/) || [])[1];
const selloSW = (leer('sw.js').match(/const VERSION = '([\w-]+)'/) || [])[1];
check(Boolean(selloIndex), `index.html define sello (${selloIndex})`);
check(selloIndex === selloSW, `sw.js usa el mismo sello (${selloSW})`);

const desincronizadas = [];
for (const ruta of paginasHtml(RAIZ)) {
    const codigo = fs.readFileSync(ruta, 'utf8');
    for (const m of codigo.matchAll(/(?:style|paginas)\.css\?v=([\w-]+)/g)) {
        if (m[1] !== selloIndex) desincronizadas.push(`${path.relative(RAIZ, ruta)} (v=${m[1]})`);
    }
}
check(desincronizadas.length === 0, `las ${paginasHtml(RAIZ).length} páginas .html usan el mismo sello${desincronizadas.length ? ' → ' + desincronizadas.slice(0, 3).join(' | ') : ''}`);

// ==========================================
// 4. CATÁLOGOS DE data.json
// ==========================================
console.log('\n4. Catálogos de data.json');
const data = JSON.parse(leer('data/data.json'));

// Plataformas: una URL por cada una (viven en PLATAFORMAS_INFO, en datos.js).
const codigoDatos = codigosJs['datos.js'];
const urlsPlataformas = new Set([...codigoDatos.matchAll(/'([^']+)'\s*:\s*\{\s*url:/g)].map(m => m[1]));
const plataformas = data.plataformas || [];
const sinLink = plataformas.filter(p => !urlsPlataformas.has(p.institucion)).map(p => p.institucion);
check(plataformas.length >= 38, `data.json trae ${plataformas.length} plataformas`);
check(sinLink.length === 0, `todas las plataformas tienen URL en PLATAFORMAS_INFO${sinLink.length ? ' → faltan: ' + sinLink.join(', ') : ''}`);

// Oficios: presenciales de Mendoza primero, online al final; ids únicos.
const oficios = data.oficios_tecnicos || [];
const idsOficios = oficios.map(i => i.id);
check(new Set(idsOficios).size === idsOficios.length, 'ids de institución de oficios sin repetir');
const posOnline = oficios.map(i => i.id).indexOf(307);
const posPresencial = oficios.map(i => i.id).indexOf(316);
check(posOnline > posPresencial && posOnline === oficios.length - 2, 'el catálogo de oficios ordena: presencial Mendoza primero, online al final');
check(![304, 313, 315].some(id => idsOficios.includes(id)), 'los oficios semipresenciales de otras provincias (Tesla/CEJ/EPPA) no están');
const carrerasOficios = oficios.flatMap(i => i.carreras);
check(carrerasOficios.every(c => /^https?:\/\/|^A confirmar$/.test(c.link_oficial || '')), 'todos los links de oficios son URL válidas o "A confirmar"');

// Formaciones alternativas y secundario presentes, sin ids chocados.
const formaciones = data.formaciones_alternativas || [];
check(formaciones.length >= 37 && formaciones.flatMap(i => i.carreras).length >= 58, `formaciones alternativas: ${formaciones.length} instituciones / ${formaciones.flatMap(i => i.carreras).length} carreras`);
check(Array.isArray(data.secundario) && data.secundario.length > 0, `catálogo secundario presente (${data.secundario.length} entradas)`);

// El clasificador de áreas no puede devolver algo que la URL no acepta.
const permitidasEstado = new Set([...(codigosJs['estado.js'].match(/const AREAS_PERMITIDAS = new Set\(\[([^\]]*)\]/) || [])[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
const nombresTodos = [];
(data.instituciones || []).forEach(i => i.carreras.forEach(c => nombresTodos.push(c.nombre_carrera)));
['formaciones_alternativas', 'oficios_tecnicos'].forEach(k => (data[k] || []).forEach(i => i.carreras.forEach(c => nombresTodos.push(c.nombre_carrera))));
const areasPosibles = new Set(nombresTodos.map(getArea));
const areasFuera = [...areasPosibles].filter(a => !permitidasEstado.has(a));
check(areasFuera.length === 0, `las ${areasPosibles.size} áreas de getArea() son válidas para ?area= de la URL${areasFuera.length ? ' → ' + areasFuera.join(', ') : ''}`);

// ==========================================
// 5. RENDER DE TARJETAS DE OFICIOS (SEDE)
// ==========================================
console.log('\n5. Render de catálogos aparte');
const contenedorConSede = { innerHTML: '' };
renderizarCursosAparte(contenedorConSede, [{
    nombre: 'Gasista Matriculado (gratuito)', categoria: 'Oficio / Formación Profesional',
    modalidad: 'Presencial', institucion: 'CCT N° 6-057', provincia: 'Mendoza',
    sede: 'Chacabuco y Adolfo Calle, Rodeo de la Cruz, Guaymallén, Mendoza',
    duracion: 'A confirmar', link: 'https://example.com', _clave: 't1'
}]);
check(contenedorConSede.innerHTML.includes('Chacabuco y Adolfo Calle'), 'la tarjeta muestra la sede cuando existe');

const contenedorSinSede = { innerHTML: '' };
renderizarCursosAparte(contenedorSinSede, [{
    nombre: 'Curso sin sede', categoria: 'Oficio / Formación Profesional',
    modalidad: 'Online', institucion: 'Plataforma', provincia: '',
    sede: '', duracion: 'A confirmar', link: 'https://example.com', _clave: 't2'
}]);
check(!/card-meta-row[^>]*>\s*<svg[^>]*>?\s*<\/p>/.test(contenedorSinSede.innerHTML), 'la tarjeta no pinta una fila de sede vacía');

// ==========================================
// 6. SHELL DEL SERVICE WORKER
// ==========================================
// El SW precachea la lista SHELL: si un archivo de esa lista no existe, el
// usuario se queda sin él cuando no hay red.
console.log('\n6. Service worker');
const bloqueShell = (leer('sw.js').match(/const SHELL = \[([^\]]+)\]/) || [])[1] || '';
const rutasShell = [...bloqueShell.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(r => r !== './');
const faltantesShell = rutasShell.filter(r => !existe(r));
check(faltantesShell.length === 0, `los ${rutasShell.length} archivos del shell del SW existen${faltantesShell.length ? ' → faltan: ' + faltantesShell.join(', ') : ''}`);

// ==========================================
// 7. SMOKE TEST HTTP
// ==========================================
console.log('\n7. Smoke test HTTP');
const PUERTO_PROPIO = 8013;
let baseUrl = 'http://localhost:8010';
let servidorPropio = null;

async function probarHttp() {
    const rutas = ['/', '/data/data.json', '/js/main.js', '/sw.js', '/manifest.json', '/carrera/videojuegos/', '/titulos/'];
    const resultados = [];
    for (const ruta of rutas) {
        try {
            const respuesta = await fetch(baseUrl + ruta, { redirect: 'manual' });
            resultados.push([ruta, respuesta.status]);
        } catch (e) {
            resultados.push([ruta, 0]);
        }
    }
    return resultados;
}

let resultados = await probarHttp();
if (resultados.every(([, status]) => status === 0)) {
    // No había servidor corriendo: levantamos uno propio para el test.
    servidorPropio = spawn('python3', ['-m', 'http.server', String(PUERTO_PROPIO)], { cwd: RAIZ, stdio: 'ignore' });
    baseUrl = `http://localhost:${PUERTO_PROPIO}`;
    await new Promise(res => setTimeout(res, 1500));
    resultados = await probarHttp();
}
check(resultados.every(([, status]) => status === 200), `las ${resultados.length} rutas clave responden 200 (${resultados.map(([r, s]) => `${r}→${s}`).join(' ')})`);
if (servidorPropio) servidorPropio.kill();

// ==========================================
// RESUMEN
// ==========================================
console.log(`\n${fallidas.length === 0 ? '✅' : '❌'} test_general.js: ${aprobadas} aserciones OK, ${fallidas.length} fallidas`);
if (fallidas.length) {
    fallidas.forEach(f => console.log('   ✗ ' + f));
    process.exit(1);
}
