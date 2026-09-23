// ============================================================================
// TÍTULOS Y NIVELES — 12.ª suite
// ============================================================================
// Valida la guía de /titulos/ (data/titulos-formacion.json + la página
// generada) y el enlace contextual que cada ficha hace a ella:
//
//   1. Estructura del JSON: niveles, títulos, glosario y FAQ completos, con ids
//      únicos y sin referencias rotas entre niveles y títulos.
//   2. Página generada: existe, tiene H1, una sección por título (con su ancla),
//      tabla comparativa, glosario y FAQ con el JSON-LD FAQPage.
//   3. Anclas de las fichas: el valor de "Tipo de formación" de cada carrera
//      linkea a un ancla que existe en la página.
//   4. Enlaces internos de la página y link en el footer de las estáticas.
//
// Correr con:  node test_titulos.js
// ============================================================================
const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

let aserciones = 0;
let fallos = 0;
const ok = (cond, msg) => {
    if (cond) { aserciones++; console.log('  ✓ ' + msg); }
    else { fallos++; console.error('  ✗ ' + msg); }
};
const seccion = (n) => console.log(`\n${n}`);

seccion('1. Estructura de data/titulos-formacion.json');

const guia = JSON.parse(leer('data/titulos-formacion.json'));
const idsTitulos = guia.titulos.map(t => t.id);
const setIds = new Set(idsTitulos);

ok(guia.version >= 1, 'el archivo declara versión');
ok(Array.isArray(guia.intro) && guia.intro.length >= 2, `la intro trae ${guia.intro.length} párrafos`);
ok(guia.niveles.length === 3, `los tres niveles del sistema están (${guia.niveles.map(n => n.nombre).join(', ')})`);
ok(new Set(guia.niveles.map(n => n.id)).size === 3, 'no hay ids de nivel repetidos');
ok(new Set(idsTitulos).size === idsTitulos.length, `no hay ids de título repetidos (${idsTitulos.length} títulos)`);

const CAMPOS = ['nombre', 'nivel', 'etiqueta', 'duracion', 'donde', 'otorga', 'queEs', 'diferencia'];
const incompletos = guia.titulos.filter(t => CAMPOS.some(c => !t[c] || (Array.isArray(t[c]) && !t[c].length)));
ok(incompletos.length === 0,
    `todos los títulos traen los ${CAMPOS.length} campos${incompletos.length ? ' → faltan en: ' + incompletos.map(t => t.id).join(', ') : ''}`);

const refsRotas = guia.niveles.flatMap(n => n.titulos).filter(id => !setIds.has(id));
ok(refsRotas.length === 0,
    `cada nivel referencia títulos existentes${refsRotas.length ? ' → rotas: ' + refsRotas.join(', ') : ''}`);
ok(guia.niveles.every(n => n.titulos.length >= 2), 'cada nivel agrupa al menos dos títulos');
ok(guia.glosario.length >= 5, `el glosario trae ${guia.glosario.length} términos`);
ok(guia.glosario.every(g => g.termino && g.definicion), 'todos los términos del glosario están definidos');
ok(guia.faq.length >= 5, `la FAQ trae ${guia.faq.length} preguntas`);
ok(guia.faq.every(f => f.pregunta && f.respuesta), 'todas las preguntas de la FAQ están respondidas');

seccion('2. Página generada /titulos/');

const RUTA_PAGINA = 'titulos/index.html';
ok(fs.existsSync(path.join(RAIZ, RUTA_PAGINA)), `${RUTA_PAGINA} existe`);
const html = leer(RUTA_PAGINA);

ok(html.includes('<h1>Títulos y niveles: qué significa cada formación</h1>'), 'la página tiene su H1');
const sinAncla = idsTitulos.filter(id => !html.includes(`id="${id}"`));
ok(sinAncla.length === 0,
    `cada título tiene su sección con ancla${sinAncla.length ? ' → faltan: ' + sinAncla.join(', ') : ''}`);
ok(guia.niveles.every(n => html.includes(`id="nivel-${n.id}"`)), 'cada nivel tiene su tarjeta con ancla');
ok(html.includes('class="tabla-titulos"') && html.includes('<caption>'), 'la tabla comparativa está');
ok(html.includes('class="glosario"'), 'el glosario está');
ok(html.includes('"@type":"FAQPage"'), 'la FAQ lleva su JSON-LD FAQPage');
const preguntasFaltantes = guia.faq.filter(f => !html.includes(f.pregunta.replace(/&/g, '&amp;')));
ok(preguntasFaltantes.length === 0,
    `la FAQ publicada coincide con la del JSON${preguntasFaltantes.length ? ' → faltan ' + preguntasFaltantes.length : ''}`);

const anclasInternas = [...html.matchAll(/href="#([a-z-]+)"/g)].map(m => m[1]);
const anclasRotas = [...new Set(anclasInternas)].filter(a => !html.includes(`id="${a}"`) && !html.includes(`id="nivel-${a}"`));
ok(anclasRotas.length === 0,
    `los enlaces internos de la página resuelven${anclasRotas.length ? ' → rotos: ' + anclasRotas.join(', ') : ''}`);

seccion('3. Anclas de las fichas de carrera');

const fichas = fs.readdirSync(path.join(RAIZ, 'carrera'), { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(RAIZ, 'carrera', d.name, 'index.html')));
const sinLink = [];
const conAnclaRota = [];
for (const ficha of fichas) {
    const contenido = leer(path.join('carrera', ficha.name, 'index.html'));
    const match = contenido.match(/Tipo de formación<\/dt><dd><a href="\/titulos\/#([a-z-]+)"/);
    if (!match) { sinLink.push(ficha.name); continue; }
    if (!setIds.has(match[1])) conAnclaRota.push(`${ficha.name}→${match[1]}`);
}
ok(sinLink.length === 0,
    `las ${fichas.length} fichas linkean su "Tipo de formación" a la guía${sinLink.length ? ' → sin link: ' + sinLink.slice(0, 5).join(', ') : ''}`);
ok(conAnclaRota.length === 0,
    `todas las anclas usadas existen en el JSON${conAnclaRota.length ? ' → rotas: ' + conAnclaRota.slice(0, 5).join(', ') : ''}`);

seccion('4. Enlaces de entrada');

ok(html.includes('href="/">Ir al buscador</a>'), 'la página vuelve al buscador');
const estatica = leer('carreras/index.html');
ok(estatica.includes('<a href="/titulos/">Títulos y niveles</a>'), 'el footer de las estáticas enlaza la guía');
ok(leer('carrera/abogacia/index.html').includes('class="aviso-costos"'), 'la ficha avisa que los costos los define la institución');
const app = leer('index.html');
ok(app.includes('class="banner-titulos"') && app.includes('href="/titulos/"'), 'la app tiene el banner hacia la guía');
ok(/body\[data-seccion="formal"\] \.banner-titulos/.test(leer('style.css')), 'el banner solo se muestra en Educación Formal');
ok(!/data-filter="costo"/.test(app), 'la app ya no ofrece el filtro de costos');

console.log(`\n✅ test_titulos.js: ${aserciones} aserciones OK, ${fallos} fallidas`);
if (fallos) process.exit(1);
