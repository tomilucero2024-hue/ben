// ============================================================================
// 🗺️  GENERADOR DE PÁGINAS ESTÁTICAS PARA BUSCADORES
// ============================================================================
//
// EL PROBLEMA QUE RESUELVE
// La app de BEN es una sola página que pinta las ~650 ofertas con JavaScript
// después de bajar data.json. Para una persona eso está perfecto; para Google
// significa que el sitio entero es UNA dirección con poco más de 400 palabras,
// y ninguna de esas palabras es "Tecnicatura en Enfermería en Mendoza", que es
// lo que la gente efectivamente escribe en el buscador.
//
// Este script arma, a partir de los MISMOS datos, un documento HTML por cada
// cosa que alguien puede buscar:
//
//     /carrera/<slug>/       una por carrera única        (~555)
//     /area/<slug>/          una por área temática        (13)
//     /institucion/<slug>/   una por institución          (~80)
//     /provincia/<slug>/     una por provincia con oferta suficiente
//     /carreras/  /instituciones/   índices para que el robot llegue a todas
//     404.html  sitemap.xml  robots.txt
//
// No son páginas de relleno: cada una lista datos reales (quién la dicta,
// cuánto dura, en qué modalidad, link al sitio oficial) y termina invitando a
// abrir la app ya filtrada. El HTML viene servido, así que se lee sin JS.
//
// PENSADO PARA CRECER A OTRAS PROVINCIAS
// Las rutas no llevan "mendoza" adentro: /carrera/enfermeria/ sirve igual
// cuando la misma carrera se dicte en Salta. La dimensión provincia es su
// propio eje (/provincia/<slug>/) y los textos se redactan a partir de las
// provincias que realmente aparecen en los datos, así que el día que entre
// otra jurisdicción las páginas se reescriben solas sin tocar este archivo.
//
// ⚠️ LAS CARPETAS DE SALIDA SE BORRAN Y SE REHACEN EN CADA CORRIDA.
// No edites a mano nada dentro de carrera/, area/, institucion/, provincia/,
// carreras/ ni instituciones/: se pierde. Tampoco 404.html, sitemap.xml ni
// robots.txt, que se reescriben enteros. Lo que se toca es este script.
//
// Se corre solo, encadenado desde scrapers/unir_todo.py, igual que
// los perfiles del test. A mano:  node generar-paginas.js
// ============================================================================

const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const DOMINIO = 'https://buscadoreducativo.com.ar';

const RUTA_DATA = path.join(RAIZ, 'data', 'data.json');
// Los perfiles de carrera del test vocacional (clave, nombre, categoria, area,
// formacion, instituciones). Antes salían de carreras-perfiles.json, el motor
// viejo: mismo nombre de campos, una sola fuente de verdad.
const RUTA_PERFILES = path.join(RAIZ, 'data', 'vocacional', 'perfiles-carreras.json');

// Carpetas que este script es dueño de reescribir enteras.
const SALIDAS = ['carrera', 'area', 'institucion', 'provincia', 'carreras', 'instituciones'];

// Provincias con menos oferta que esto no reciben página propia: una página con
// una sola institución no le sirve a nadie y a Google le huele a relleno. El
// umbral es lo que hace que hoy exista solo Mendoza y que mañana aparezcan las
// demás solas, sin tocar código.
const MINIMO_POR_PROVINCIA = 5;

const PROVINCIAS_AR = [
    'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
    'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza',
    'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis',
    'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego',
    'Tucumán'
];

const NOMBRES_FORMACION = {
    grado: 'Carrera de grado',
    tecnicaturas: 'Tecnicatura',
    profesorados: 'Profesorado',
    cursos: 'Curso o formación profesional'
};

const PLURALES_FORMACION = {
    grado: 'Carreras de grado',
    tecnicaturas: 'Tecnicaturas',
    profesorados: 'Profesorados',
    cursos: 'Cursos y formación profesional'
};

// Las etiquetas y descripciones de las dimensiones del test vocacional salen del
// propio motor (js/vocacional/motor.js expone module.exports para Node): una
// sola fuente de verdad para la app, las páginas y los tests.
const { ETIQUETAS: ETIQUETAS_VOCACIONAL } = require('./js/vocacional/motor.js');

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function normalizar(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

// El texto de data.json viene de scrapers: trae dobles espacios, saltos de
// línea y algún "  -  " suelto. Se limpia antes de meterlo en el HTML.
function limpiar(texto) {
    return String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim();
}

function esc(texto) {
    return limpiar(texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Solo http/https. Los links salen de scrapers y terminan en una página
// pública: un javascript: o un data: acá sería un agujero abierto.
function urlSegura(url) {
    const limpia = limpiar(url);
    if (!/^https?:\/\//i.test(limpia)) return '';
    return limpia;
}

// Slug sin recortar. Sirve como huella del nombre: dos textos que solo se
// diferencian en mayusculas, acentos o puntuacion dan el mismo.
function slugCompleto(texto) {
    return normalizar(texto)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'sin-nombre';
}

// El que va en la URL. 80 caracteres alcanzan de sobra y se corta en un guion
// para no partir una palabra al medio.
const LARGO_SLUG = 80;
function slug(texto) {
    const completo = slugCompleto(texto);
    if (completo.length <= LARGO_SLUG) return completo;
    const corte = completo.slice(0, LARGO_SLUG);
    const guion = corte.lastIndexOf('-');
    return (guion > 40 ? corte.slice(0, guion) : corte).replace(/-+$/g, '');
}

// Google recorta el title cerca de los 65 caracteres. Con nombres largos (hay
// uno de 118) lo que se corta es justo el final, que es donde vive lo que
// distingue una pagina de otra: el resultado son decenas de titulos que en el
// buscador se ven identicos. Se prueba primero la forma larga, despues la corta
// sin el complemento, y recien si el nombre solo tampoco entra se lo recorta en
// un espacio para no partir una palabra al medio.
const LARGO_TITULO = 65;
const MARCA = ' | BEN';
function tituloAcotado(nombre, complemento = '') {
    const largo = `${nombre}${complemento}${MARCA}`;
    if (largo.length <= LARGO_TITULO) return largo;

    // Si excede el largo pero tiene mención geográfica (ej. ": dónde estudiarla en Mendoza"),
    // intentamos mantener la provincia acortando a " (Mendoza)" antes de descartarla.
    if (/mendoza/i.test(complemento)) {
        const compacto = `${nombre} (Mendoza)${MARCA}`;
        if (compacto.length <= LARGO_TITULO) return compacto;
    }

    const corto = `${nombre}${MARCA}`;
    if (corto.length <= LARGO_TITULO) return corto;

    // Si el nombre solo también excede, acortamos en palabra y priorizamos retener la provincia si aplicaba
    const tieneMendoza = /mendoza/i.test(complemento);
    const sufijo = tieneMendoza ? `… (Mendoza)${MARCA}` : `…${MARCA}`;
    const maxBase = LARGO_TITULO - sufijo.length;
    const recortado = nombre.slice(0, maxBase);
    const espacio = recortado.lastIndexOf(' ');
    const base = espacio > 15 ? recortado.slice(0, espacio) : recortado;
    return `${base.replace(/[\s,.;:-]+$/, '')}${sufijo}`;
}

// Dos nombres LARGOS y distintos pueden chocar despues del recorte a 80
// caracteres. En ese caso se desempata con un numero, siguiendo el orden
// alfabetico: es estable entre corridas, asi que dos builds seguidas producen
// exactamente los mismos archivos.
// (Los nombres que chocan porque son el mismo texto con otra puntuacion no
// llegan hasta aca: se fusionan antes, en unificarDuplicadas.)
function asignarSlugs(items, obtenerNombre) {
    const usados = new Map();
    items.forEach(item => {
        const base = slug(obtenerNombre(item));
        const visto = usados.get(base) || 0;
        usados.set(base, visto + 1);
        item.slug = visto === 0 ? base : `${base}-${visto + 1}`;
    });
}

function provinciaCanonica(texto) {
    const n = normalizar(texto);
    let mejor = null;
    let mejorPos = Infinity;
    // Gana la que aparece primero: "Buenos Aires (con filial Mendoza)" es una
    // institución bonaerense, no mendocina.
    PROVINCIAS_AR.forEach(prov => {
        const pos = n.indexOf(normalizar(prov));
        if (pos !== -1 && pos < mejorPos) { mejor = prov; mejorPos = pos; }
    });
    return mejor;
}

function modalidadCanonica(texto) {
    const n = normalizar(texto);
    const tiene = [];
    if (/presencial/.test(n)) tiene.push('Presencial');
    if (/(distancia|virtual|online|remot)/.test(n)) tiene.push('A distancia');
    if (/(hibrid|semipresencial|mixta|combinada)/.test(n)) tiene.push('Semipresencial');
    return tiene;
}

// Devuelve los años que dura, o null si el texto no lo dice con claridad.
// Se usa solo para redactar el resumen; el dato crudo siempre se muestra igual.
// La duración se interpreta y se resume con las MISMAS funciones que usa la
// app (js/util.js). Antes había acá una copia propia (aniosDe) que no entendía
// los números escritos con letras —"cinco años" no contaba para nada— así que
// la app y estas páginas podían decir cosas distintas de la misma carrera.
// Se completan en main(), que es donde se puede await-ear el módulo ES.
let duracionCorta;
let formatearDuracionAnios;
let obtenerDuracionEnAnios;

function listaEnEspanol(items) {
    const l = items.filter(Boolean);
    if (l.length === 0) return '';
    if (l.length === 1) return l[0];
    return `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`;
}

function plural(n, singular, pluralForma) {
    return `${n} ${n === 1 ? singular : pluralForma}`;
}

// ---------------------------------------------------------------------------
// Plantilla común
// ---------------------------------------------------------------------------

// El sello de caché se lee de index.html en vez de repetirse acá. El README ya
// avisa que mantener el mismo número en dos lugares sale mal; en tres, peor.
function leerSello() {
    const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    const m = html.match(/style\.css\?v=([\w-]+)/);
    return m ? m[1] : '1';
}
const SELLO = leerSello();

// Google recorta la descripcion alrededor de los 155-160 caracteres. El texto
// completo se sigue mostrando en la pagina (ahi es contenido de verdad para
// quien lee); lo que se acota es solo lo que va en la etiqueta, para que en el
// resultado de busqueda no se corte a mitad de una palabra.
//
// Se prefiere cortar por oraciones completas: los resumenes se arman como una
// cadena de frases cerradas y quedarse con las primeras da un texto que se lee
// entero. Recien si ni la primera frase entra se corta por palabra.
const LARGO_META = 160;
function recortarMeta(texto, limite = LARGO_META) {
    if (texto.length <= limite) return texto;

    const oraciones = texto.match(/[^.]+\./g) || [];
    let acumulado = '';
    for (const oracion of oraciones) {
        if ((acumulado + oracion).trim().length > limite) break;
        acumulado += oracion;
    }
    acumulado = acumulado.trim();
    // Un umbral para no devolver un fragmento demasiado corto: si quedarse con
    // oraciones enteras da menos de la mitad del espacio disponible, se
    // desaprovecha, y conviene el corte por palabra.
    if (acumulado.length >= limite / 2) return acumulado;

    const corte = texto.slice(0, limite - 1);
    return corte.slice(0, corte.lastIndexOf(' ')).replace(/[\s,;:]+$/, '') + '…';
}

function jsonLd(objeto) {
    // El </script> de un dato escapado cerraría el bloque antes de tiempo.
    const texto = JSON.stringify(objeto).replace(/</g, '\\u003c');
    return `<script type="application/ld+json">${texto}</script>`;
}

function miga(pasos) {
    const html = pasos.map((p, i) => {
        const ultimo = i === pasos.length - 1;
        return ultimo
            ? `<span aria-current="page">${esc(p.nombre)}</span>`
            : `<a href="${esc(p.url)}">${esc(p.nombre)}</a>`;
    }).join(' <span aria-hidden="true">›</span> ');
    const ld = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: pasos.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: limpiar(p.nombre),
            item: DOMINIO + p.url
        }))
    };
    return { html: `<nav class="miga" aria-label="Ruta de navegación">${html}</nav>`, ld };
}

function documento({ ruta, titulo, descripcion, h1, cuerpo, contenido = '', pasos, ldExtra = [], noindex = false, lateral = '' }) {
    const canonica = DOMINIO + ruta;
    const meta = recortarMeta(descripcion);
    const { html: migaHtml, ld: migaLd } = miga(pasos);
    const esquemas = noindex ? ldExtra : [migaLd, ...ldExtra];
    const bloques = esquemas.map(jsonLd).join('\n');
    const contenidoPagina = lateral
        ? `<div class="pagina-layout">
    <div class="principal">
        ${migaHtml}
        <h1>${esc(h1)}</h1>
${cuerpo}
    </div>
    <aside class="lateral">
${lateral}
    </aside>
    <div class="contenido-pagina">
${contenido}
    </div>
</div>`
        : `${migaHtml}
    <h1>${esc(h1)}</h1>
${cuerpo}`;

    return `<!DOCTYPE html>
<html lang="es-AR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(meta)}">
${noindex ? '<meta name="robots" content="noindex, follow">' : `<link rel="canonical" href="${esc(canonica)}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="BEN — Buscador Educativo Nacional">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(meta)}">
<meta property="og:url" content="${esc(canonica)}">
<meta property="og:image" content="${DOMINIO}/og-ben.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="BEN — Buscador Educativo Nacional">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titulo)}">
<meta name="twitter:description" content="${esc(meta)}">
<meta name="twitter:image" content="${DOMINIO}/og-ben.png">
<meta name="theme-color" content="#1d4ed8">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<script>
    // Mismo tema que la app: si alguien la dejó en oscuro, estas páginas
    // abren en oscuro. Va inline y antes del CSS para que no parpadee.
    (() => {
        let t = 'light';
        try {
            const g = localStorage.getItem('ben-theme');
            t = g || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.dataset.theme = t;
            document.documentElement.style.colorScheme = t;

            // Mantener la escala tipográfica de accesibilidad de la app también
            // en las páginas estáticas, antes de que cargue la hoja de estilos.
            const a11y = JSON.parse(localStorage.getItem('ben-a11y') || '{}');
            const escala = Number(a11y.fontScale);
            if (Number.isFinite(escala) && escala > 0) {
                document.documentElement.style.setProperty('--font-scale', escala);
            }
        } catch (e) {}
        // El logo se elige acá, antes de que el parser vea el <img>: antes venía
        // el claro en el src y se cambiaba al oscuro después, con lo cual en
        // tema oscuro se bajaban los dos archivos (~150 KB en vez de 75).
        window.LOGO_BEN = t === 'dark' ? '/logo-ben-dark.png' : '/logo-ben-light.png';
        const pre = document.createElement('link');
        pre.rel = 'preload';
        pre.as = 'image';
        pre.href = window.LOGO_BEN;
        document.head.appendChild(pre);
    })();
</script>
<link rel="stylesheet" href="/paginas.css?v=${SELLO}">
${bloques}
</head>
<body>
<a class="skip-link" href="#contenido">Saltar al contenido</a>
<header class="cabecera">
    <div class="envoltorio">
        <a class="marca" href="/" aria-label="BEN, Buscador Educativo Nacional — ir al buscador">
            <img id="marcaLogo" width="1120" height="299" alt="BEN — Buscador Educativo Nacional">
            <script>document.getElementById('marcaLogo').src = window.LOGO_BEN;</script>
        </a>
        <button id="temaStatico" class="tema-statico" type="button" aria-label="Cambiar tema de color" aria-pressed="false" title="Cambiar tema de color">
            <svg class="tema-icono tema-sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            <svg class="tema-icono tema-luna" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        </button>
        <form class="buscador-mini" action="/" method="get" role="search">
            <input id="q" name="q" type="search" placeholder="Buscar una carrera…" aria-label="Buscar carreras" autocomplete="off">
            <button type="submit">Buscar</button>
            <div id="miniDropdown" class="mini-search-dropdown" role="listbox" hidden></div>
        </form>
    </div>
    <script>
        // Mismo tema que la app, con su mismo botón: alterna claro/oscuro,
        // persiste en localStorage (ben-theme, que la app y estas páginas ya
        // leen) y cambia el logo por la variante del tema.
        (() => {
            const boton = document.getElementById('temaStatico');
            if (!boton) return;
            const logo = document.getElementById('marcaLogo');
            const pintar = () => {
                const oscuro = document.documentElement.dataset.theme === 'dark';
                boton.setAttribute('aria-pressed', String(oscuro));
                boton.setAttribute('aria-label', oscuro ? 'Activar modo claro' : 'Activar modo oscuro');
                boton.title = oscuro ? 'Activar modo claro' : 'Activar modo oscuro';
                if (logo) logo.src = oscuro ? '/logo-ben-dark.png' : '/logo-ben-light.png';
            };
            boton.addEventListener('click', () => {
                const siguiente = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                document.documentElement.dataset.theme = siguiente;
                document.documentElement.style.colorScheme = siguiente;
                try { localStorage.setItem('ben-theme', siguiente); } catch (e) {}
                pintar();
            });
            pintar();
        })();
    </script>
</header>

<!-- WCAG 2.1 - 2.4.1: destino del skip link, enfocable para que el foco viaje. -->
<main class="envoltorio" id="contenido" tabindex="-1">
    ${contenidoPagina}
</main>

<footer class="pie">
    <div class="envoltorio">
        <p>BEN es una iniciativa independiente que reúne la oferta educativa en un solo lugar. Los datos se toman de sitios públicos con fines orientativos e informativos; antes de inscribirte, confirmá siempre los datos vigentes con la institución emisora.</p>
        <nav aria-label="Secciones del sitio">
            <a href="/">Buscador</a>
            <a href="/carreras/">Todas las carreras</a>
            <a href="/instituciones/">Todas las instituciones</a>
        </nav>
    </div>
</footer>
<script>
    // Autocompletado en vivo en la barra de búsqueda estática
    (() => {
        const inp = document.getElementById('q');
        const drop = document.getElementById('miniDropdown');
        if (!inp || !drop) return;
        let dataIndex = null;

        async function cargarIndex() {
            if (dataIndex) return dataIndex;
            try {
                const res = await fetch('/data/autocompletado-ben.json');
                if (res.ok) dataIndex = await res.json();
            } catch (e) {}
            return dataIndex;
        }

        inp.addEventListener('input', async () => {
            const val = inp.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (val.length < 2) { drop.hidden = true; drop.innerHTML = ''; return; }
            const idx = await cargarIndex();
            if (!idx) return;

            const matchesCarreras = Object.entries(idx.carreras || {})
                .filter(([nombre]) => nombre.includes(val))
                .slice(0, 5);
            const matchesInst = Object.entries(idx.instituciones || {})
                .filter(([nombre]) => nombre.includes(val))
                .slice(0, 3);

            if (!matchesCarreras.length && !matchesInst.length) {
                drop.hidden = true;
                drop.innerHTML = '';
                return;
            }

            // El indice guarda [slug, nombre]: la clave sirve para buscar y el
            // nombre es el que se muestra, con sus tildes y mayusculas.
            const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            let html = '';
            matchesCarreras.forEach(([, [slug, titulo]]) => {
                html += '<a class="mini-search-item" href="/carrera/' + slug + '/"><span class="mini-search-item-title">🎓 ' + esc(titulo) + '</span><span class="mini-search-item-badge">Carrera</span></a>';
            });
            matchesInst.forEach(([, [slug, titulo]]) => {
                html += '<a class="mini-search-item" href="/institucion/' + slug + '/"><span class="mini-search-item-title">🏛️ ' + esc(titulo) + '</span><span class="mini-search-item-badge">Institución</span></a>';
            });

            drop.innerHTML = html;
            drop.hidden = false;
        });

        document.addEventListener('click', (e) => {
            if (!inp.contains(e.target) && !drop.contains(e.target)) {
                drop.hidden = true;
            }
        });
    })();
</script>
<script src="/js/favoritos.js?v=${SELLO}"></script>
</body>
</html>
`;
}

function escribir(ruta, contenido) {
    const destino = path.join(RAIZ, ruta.replace(/^\//, '').replace(/\//g, path.sep));
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    if (destino.endsWith('.html')) {
        // Los placeholders vacios de la plantilla dejan lineas de solo espacios.
        contenido = contenido.replace(/[ \t]+(?=\n)/g, '');
    }
    fs.writeFileSync(destino, contenido);
}

function escribirPagina(ruta, contenido) {
    escribir(path.posix.join(ruta, 'index.html'), contenido);
}

// Misma carrera cargada dos veces con distinta puntuacion. Pasa de verdad:
// "Profesorado ... Tecnico Profesional en Concurrencia con el Titulo de Base" y
// "Profesorado ... Tecnico Profesional, en concurrencia con el Titulo de Base"
// son dos entradas de los perfiles de carrera porque su normalizacion conserva
// las comas, pero son la misma carrera. Emitirlas como dos paginas casi
// identicas es exactamente el contenido duplicado que Google castiga, asi que
// se fusionan en una sola con las ofertas de las dos.
//
// El criterio es el slug COMPLETO, no el recortado: dos nombres largos que solo
// chocan por el recorte a 80 caracteres pueden ser cosas distintas y esos si
// conservan su pagina propia (con sufijo numerico).
// Huella para unificar duplicadas y títulos homólogos que se canibalizan
// (ej. "Profesorado de Historia" vs "Profesorado en Historia", o
// "discapacidad intelect-ual" que traía un guion de corte de línea).
function huellaCarrera(nombre) {
    let s = slugCompleto(nombre)
        .replace(/intelect-ual/g, 'intelectual');
    s = s.replace(/^profesorado-(de|en)-/, 'profesorado-')
         .replace(/^profesorado-(para-la|de)-educacion-secundaria-(de-la-modalidad-tecnico-profesional-)?(en-conc-)?(en-)?/, 'profesorado-educacion-secundaria-');

    // Unificación de títulos homólogos para evitar canibalización y contenido duplicado:
    // "Carrera de Medicina" -> "medicina"
    // "Licenciado en Turismo" -> "licenciatura-en-turismo"
    // "Técnico Superior en..." -> "tecnicatura-superior-en-..."
    s = s.replace(/^carrera-de-/, '')
         .replace(/^licenciado-en-/, 'licenciatura-en-')
         .replace(/^lic-en-/, 'licenciatura-en-')
         .replace(/^tec-en-/, 'tecnicatura-en-')
         .replace(/^tecnico-superior-en-/, 'tecnicatura-superior-en-')
         .replace(/^tecnico-universitario-en-/, 'tecnicatura-universitaria-en-')
         .replace(/^tecnico-en-/, 'tecnicatura-en-');

    return s;
}

function unificarDuplicadas(carreras) {
    const porHuella = new Map();
    const tieneGritos = n => /[A-Z]{4,}/.test(n);

    // Sistema de puntuación para elegir el nombre más estándar y canónico
    const scoreNombre = n => {
        let sc = 0;
        if (/^Licenciatura/i.test(n)) sc += 3;
        if (/^Tecnicatura/i.test(n)) sc += 3;
        if (/^Profesorado/i.test(n)) sc += 2;
        if (/^Carrera de/i.test(n)) sc -= 4;
        if (/^Licenciado/i.test(n)) sc -= 2;
        if (/^Técnico/i.test(n)) sc -= 2;
        return sc;
    };

    carreras.forEach(c => {
        const huella = huellaCarrera(c.nombre);
        const yaEsta = porHuella.get(huella);
        if (!yaEsta) {
            porHuella.set(huella, { ...c });
            return;
        }

        const sNuevo = scoreNombre(c.nombre);
        const sActual = scoreNombre(yaEsta.nombre);

        // Preferir nombres sin mayúsculas sostenidas de scraping y títulos formales estándar
        if (tieneGritos(yaEsta.nombre) && !tieneGritos(c.nombre)) {
            yaEsta.nombre = c.nombre;
        } else if (!tieneGritos(yaEsta.nombre) && tieneGritos(c.nombre)) {
            // Mantener el actual sin gritos
        } else if (sNuevo > sActual) {
            yaEsta.nombre = c.nombre;
        } else if (sNuevo === sActual && c.ofertas.length > yaEsta.ofertas.length) {
            yaEsta.nombre = c.nombre;
        }

        yaEsta.ofertas = yaEsta.ofertas.concat(c.ofertas);
        yaEsta.clavesFusionadas = (yaEsta.clavesFusionadas || [yaEsta.clave]).concat(c.clave);
        yaEsta.perfil = yaEsta.perfil || c.perfil;
    });
    return [...porHuella.values()];
}

// ---------------------------------------------------------------------------
// Lectura y armado del modelo
// ---------------------------------------------------------------------------

const TERMINOS_IGNORAR = [
    /^entradas anteriores$/i,
    /^entradas siguientes$/i,
    /^siguiente$/i,
    /^anterior$/i,
    /^p[aá]gina \d+$/i,
    /^ver m[aá]s$/i,
    /^inicio$/i,
    /^contacto$/i
];

function esNombreValido(nombre) {
    const t = limpiar(nombre);
    if (!t || t.length < 3) return false;
    return !TERMINOS_IGNORAR.some(rx => rx.test(t));
}

function construirModelo() {
    const data = JSON.parse(fs.readFileSync(RUTA_DATA, 'utf8'));
    const perfiles = JSON.parse(fs.readFileSync(RUTA_PERFILES, 'utf8')).carreras || [];

    // Solo la educación formal genera páginas. Las formaciones alternativas,
    // los oficios técnicos y la terminalidad (secundario) se muestran en la app
    // con su tab correspondiente y la tarjeta va directo al sitio oficial: no
    // tienen ficha estática, no aparecen en /carreras/ ni en el sitemap.
    const GRUPOS = [
        { clave: 'instituciones', fuente: 'Educación formal' }
    ];

    const instituciones = [];
    const ofertas = [];

    GRUPOS.forEach(grupo => {
        (data[grupo.clave] || []).forEach(inst => {
            const institucion = {
                nombre: limpiar(inst.nombre),
                nivel: limpiar(inst.nivel),
                gestion: limpiar(inst.gestion) || (/utn/i.test(inst.nombre) ? 'Pública' : ''),
                provinciaCruda: limpiar(inst.provincia),
                provincia: provinciaCanonica(inst.provincia),
                contacto: inst.contacto || {},
                fuente: grupo.fuente,
                ofertas: []
            };
            (inst.carreras || []).forEach(c => {
                const nombreLimpio = limpiar(c.nombre_carrera || c.nombre);
                if (!esNombreValido(nombreLimpio)) return;

                const oferta = {
                    nombre: nombreLimpio,
                    nombreCompleto: limpiar(c.nombre_completo),
                    descripcion: limpiar(c.descripcion),
                    categoria: limpiar(c.categoria),
                    duracion: limpiar(c.duracion),
                    modalidad: limpiar(c.modalidad),
                    turno: limpiar(c.turno),
                    link: urlSegura(c.link_oficial),
                    plan_estudio: Array.isArray(c.plan_estudio) ? c.plan_estudio : null,
                    plan_fuente: urlSegura(c.plan_fuente),
                    institucion
                };
                if (!oferta.nombre) return;
                institucion.ofertas.push(oferta);
                ofertas.push(oferta);
            });
            if (institucion.nombre) instituciones.push(institucion);
        });
    });

    // Índice nombre normalizado -> ofertas, para pegar cada carrera del archivo
    // de perfiles con las ofertas concretas que la dictan.
    const porNombre = new Map();
    ofertas.forEach(o => {
        const k = normalizar(o.nombre);
        if (!porNombre.has(k)) porNombre.set(k, []);
        porNombre.get(k).push(o);
    });

    const carreras = unificarDuplicadas(perfiles
        .filter(p => esNombreValido(p.nombre))
        .map(p => ({
            clave: p.clave,
            nombre: limpiar(p.nombre),
            categoria: limpiar(p.categoria),
            area: limpiar(p.area),
            formacion: p.formacion,
            perfil: p.perfil || null,
            ofertas: (porNombre.get(p.clave) || [])
        })).filter(c => c.ofertas.length > 0));

    // Áreas y provincias salen de los datos, no de una lista fija.
    const areas = new Map();
    carreras.forEach(c => {
        if (!areas.has(c.area)) areas.set(c.area, { nombre: c.area, carreras: [] });
        areas.get(c.area).carreras.push(c);
    });

    const provincias = new Map();
    instituciones.forEach(i => {
        if (!i.provincia) return;
        if (!provincias.has(i.provincia)) provincias.set(i.provincia, { nombre: i.provincia, instituciones: [] });
        provincias.get(i.provincia).instituciones.push(i);
    });

    const listaCarreras = [...carreras].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const listaAreas = [...areas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const listaInstituciones = [...instituciones].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const listaProvincias = [...provincias.values()]
        .filter(p => p.instituciones.length >= MINIMO_POR_PROVINCIA)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    asignarSlugs(listaCarreras, c => c.nombre);
    asignarSlugs(listaAreas, a => a.nombre);
    asignarSlugs(listaInstituciones, i => i.nombre);
    asignarSlugs(listaProvincias, p => p.nombre);

    // Con los slugs ya puestos, cada oferta sabe a qué carrera enlazar y cada
    // carrera a qué área, para poder cruzar las páginas entre sí.
    const carreraPorClave = new Map();
    listaCarreras.forEach(c => (c.clavesFusionadas || [c.clave]).forEach(k => carreraPorClave.set(k, c)));
    const areaPorNombre = new Map(listaAreas.map(a => [a.nombre, a]));
    // Solo las provincias que superan el minimo tienen pagina propia; el resto
    // se queda sin ref y la ficha las muestra como texto suelto.
    const provinciaPorNombre = new Map(listaProvincias.map(p => [p.nombre, p]));
    instituciones.forEach(i => { i.provinciaRef = provinciaPorNombre.get(i.provincia) || null; });
    ofertas.forEach(o => { o.carrera = carreraPorClave.get(normalizar(o.nombre)) || null; });
    listaCarreras.forEach(c => { c.areaRef = areaPorNombre.get(c.area) || null; });

    return {
        carreras: listaCarreras,
        areas: listaAreas,
        instituciones: listaInstituciones,
        provincias: listaProvincias,
        totalOfertas: ofertas.length
    };
}

// ---------------------------------------------------------------------------
// Redacción de los resúmenes (a partir de datos, no de plantillas vacías)
// ---------------------------------------------------------------------------

function resumenCarrera(carrera) {
    const partes = [];
    const n = carrera.ofertas.length;
    const publicas = carrera.ofertas.filter(o => /publica/.test(normalizar(o.institucion.gestion))).length;
    const privadas = n - publicas;

    const provincias = [...new Set(carrera.ofertas.map(o => o.institucion.provincia).filter(Boolean))].sort();
    const donde = provincias.length === 0 ? ''
        : provincias.length === 1 ? ` en ${provincias[0]}`
        : ` en ${listaEnEspanol(provincias)}`;

    const tipoFormacion = (NOMBRES_FORMACION[carrera.formacion] || 'carrera').toLowerCase();
    const instituciones = new Set(carrera.ofertas.map(o => o.institucion.nombre));
    const cuantasInst = plural(instituciones.size, 'institución', 'instituciones');

    const mezcla = [];
    if (publicas) mezcla.push(`${publicas} pública${publicas > 1 ? 's' : ''}`);
    if (privadas) mezcla.push(`${privadas} privada${privadas > 1 ? 's' : ''}`);
    const detalleGestion = mezcla.length ? ` (${listaEnEspanol(mezcla)})` : '';

    // Primera frase directa y optimizada para el fragmento de Google (CTR)
    partes.push(`Dónde estudiar ${carrera.nombre}${donde}: ${tipoFormacion} del área ${carrera.area}, dictada por ${cuantasInst}${detalleGestion}.`);

    const anios = carrera.ofertas.map(o => obtenerDuracionEnAnios(o.duracion)).filter(a => a && a > 0);
    if (anios.length) {
        const min = Math.min(...anios);
        const max = Math.max(...anios);
        const fmt = a => formatearDuracionAnios(a);
        const mismaUnidad = (min >= 1) === (max >= 1);
        // En "Dura de 2 a 4 años" el extremo inferior pierde la unidad; si el
        // texto trae una duración compuesta ("1 año y 3 meses") se deja entera.
        const sinUnidad = t => (t.includes(' y ') ? t : t.replace(/ (años?|meses)$/, ''));
        const desde = mismaUnidad ? sinUnidad(fmt(min)) : fmt(min);
        partes.push(min === max
            ? `Dura ${fmt(min)}.`
            : `Dura de ${desde} a ${fmt(max)} según la institución.`);
    }

    const modalidades = [...new Set(carrera.ofertas.flatMap(o => modalidadCanonica(o.modalidad)))];
    if (modalidades.length) {
        partes.push(`Modalidades disponibles: ${listaEnEspanol(modalidades.map(m => m.toLowerCase()))}.`);
    }

    return partes.join(' ');
}

// A que direccion de la app manda el boton de una carrera.
//
// No alcanza con /?q=<nombre>: el buscador de la app da por buena una oferta si
// coincide CUALQUIERA de las palabras escritas, asi que "Licenciatura en
// Enfermeria" devuelve casi el catalogo entero (la palabra "en" esta en todos
// lados). El orden por relevancia pone las correctas arriba, pero el contador
// dice 581 y quien llega desde Google siente que el link no funciono.
//
// Agregandole el area y el tipo de formacion, los mismos filtros que la persona
// pondria a mano, el resultado queda acotado a lo que la pagina prometia.
//
// Las carreras que solo existen en los catalogos aparte (oficios, formaciones
// alternativas, terminalidad) viven en OTRA seccion de la app: a esas hay que
// mandarlas con ?seccion=..., porque en Educacion Formal no estan y el link
// terminaria en una grilla vacia.
const SECCION_POR_FUENTE = {
    'Oficio técnico': 'oficios-tecnicos',
    'Formación alternativa': 'formaciones-alternativas',
    'Terminalidad educativa': 'secundario'
};

// ---------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------

// Rotula el acordeón según el tramo real del plan: los ciclos de complementación
// y varias carreras a distancia vienen por semestre/cuatrimestre, no por año.
function resumenPlan(plan) {
    const etiquetas = plan.map(a => String(a.anio || ''));
    if (etiquetas.length === 1) {
        return /plan de estudios/i.test(etiquetas[0])
            ? 'Plan de estudio'
            : `Plan de estudio — ${etiquetas[0]}`;
    }
    // Contamos años distintos: un plan puede traer tramos extra ("Materias
    // adicionales", "Condición final de egreso") o un subperíodo por año
    // ("1er año — Primer semestre"), y no queremos que inflen el total.
    const anios = etiquetas.filter(e => /a[nñ]o/i.test(e));
    if (anios.length) {
        const unicos = new Set(anios.map(e => e.toLowerCase()
            .replace(/[—–-].*$/, '').trim()));
        return `Plan de estudio — ${unicos.size} año${unicos.size === 1 ? '' : 's'}`;
    }
    const unidades = [
        ['semestre', 'semestre'], ['cuatrimestre', 'cuatrimestre'],
        ['trimestre', 'trimestre'], ['módulo', 'módulo'],
    ];
    for (const [clave, nombre] of unidades) {
        const elegidos = etiquetas.filter(e => e.toLowerCase().includes(clave));
        if (elegidos.length) {
            const unicos = new Set(elegidos.map(e => e.toLowerCase().trim()));
            return `Plan de estudio — ${unicos.size} ${nombre}${unicos.size === 1 ? '' : 's'}`;
        }
    }
    return `Plan de estudio — ${plan.length} año${plan.length === 1 ? '' : 's'}`;
}

function tarjetaOferta(oferta, { mostrarInstitucion = true, id = null } = {}) {
    const inst = oferta.institucion;
    const titulo = mostrarInstitucion
        ? `<a href="/institucion/${inst.slug}/">${esc(inst.nombre)}</a>`
        : (oferta.carrera ? `<a href="/carrera/${oferta.carrera.slug}/">${esc(oferta.nombre)}</a>` : esc(oferta.nombre));

    const datos = [];
    if (oferta.duracion) datos.push(`Duración: ${esc(duracionCorta(oferta.duracion))}`);
    if (oferta.modalidad) datos.push(`Modalidad: ${esc(oferta.modalidad)}`);
    if (oferta.turno) datos.push(`Turno: ${esc(oferta.turno)}`);
    if (mostrarInstitucion && inst.provincia) datos.push(esc(inst.provincia));
    if (!mostrarInstitucion && oferta.categoria) datos.push(esc(oferta.categoria));

    const gestion = normalizar(inst.gestion);
    const etiqueta = mostrarInstitucion && gestion
        ? `<span class="etiqueta ${/publica/.test(gestion) ? 'publica' : 'privada'}">${esc(inst.gestion)}</span> `
        : '';

    const oficial = oferta.link
        ? `<a class="oficial" href="${esc(oferta.link)}" rel="noopener nofollow" target="_blank">Ver en el sitio oficial ↗</a>`
        : '';

    const descripcion = oferta.descripcion ? `<p>${esc(oferta.descripcion)}</p>` : '';
    const idAttr = id ? ` id="${esc(id)}"` : '';

    const plan = Array.isArray(oferta.plan_estudio) ? oferta.plan_estudio : null;
    const seccionPlan = plan && plan.length
        ? `<details class="plan-de-estudio">
    <summary>${esc(resumenPlan(plan))}</summary>
    <div class="plan-contenido">
${plan.map(a => `        <div class="plan-anio">
            <h4>${esc(a.anio)}</h4>
            <ul>${(a.materias || []).map(m => `<li>${esc(m)}</li>`).join('')}</ul>
        </div>`).join('\n')}
${oferta.plan_fuente ? `        <p class="plan-fuente">Fuente: <a href="${esc(oferta.plan_fuente)}" rel="noopener nofollow" target="_blank">plan oficial ↗</a></p>` : ''}
    </div>
</details>` : '';

    return `        <li class="oferta"${idAttr}>
            <h3>${etiqueta}${titulo}</h3>
            ${descripcion}<ul class="oferta-datos">${datos.map(d => `<li>${d}</li>`).join('')}</ul>
            ${seccionPlan}
            ${oficial}
        </li>`;
}

// Botón "Me interesa" de las páginas estáticas. Emite solo los data-attributes
// del contrato de js/favoritos.js: ese script (que estas páginas cargan) le
// inyecta el ícono y el texto, sincroniza el estado guardado y maneja el clic.
// Así hay una sola definición del botón para la app y para el HTML generado.
function botonFavorito(item) {
    const atr = (t) => String(t == null ? '' : t)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // data-fav-solo-icono: en las fichas estáticas el corazón va solo (sin
    // "Me interesa" al lado); js/favoritos.js lo hidrata respetando el modo.
    return `<button type="button" class="btn-favorito" data-favorito="${atr(JSON.stringify(item))}"` +
        ` data-fav-clave="${atr(item.clave)}" data-fav-nombre="${atr(item.nombre)}"` +
        ` data-fav-solo-icono title="Guardar en Mi lista" aria-pressed="false"></button>`;
}

function paginaCarrera(carrera) {
    const ruta = `/carrera/${carrera.slug}/`;
    const descripcion = resumenCarrera(carrera);
    const instituciones = [...new Set(carrera.ofertas.map(o => o.institucion.nombre))];
    const modalidades = [...new Set(carrera.ofertas.flatMap(o => modalidadCanonica(o.modalidad)))];
    // "A confirmar" / "No especificada" son ausencia de dato, no una duracion.
    // En la lista de cada institucion se muestran igual (ahi decir "no sabemos"
    // es informacion), pero en el resumen de arriba solo ensucian.
    // Se resume cada duracion antes de deduplicar. Con los textos crudos, "4
    // años" y "La carrera se cursa en cuatro años." contaban como dos valores
    // distintos y la ficha terminaba mostrando la oracion entera al lado del
    // numero, separadas por un punto medio.
    const duraciones = [...new Set(carrera.ofertas
        .map(o => duracionCorta(o.duracion))
        .filter(d => d && normalizar(d) !== 'a confirmar'))];

    const relacionadas = (carrera.areaRef ? carrera.areaRef.carreras : [])
        .filter(c => c.clave !== carrera.clave)
        .sort((a, b) => b.ofertas.length - a.ofertas.length || a.nombre.localeCompare(b.nombre, 'es'))
        .slice(0, 12);

    const ficha = [
        ['Área', esc(carrera.area)],
        ['Tipo de formación', esc(NOMBRES_FORMACION[carrera.formacion] || carrera.categoria)],
        ['Dónde se dicta', plural(instituciones.length, 'institución', 'instituciones')],
        modalidades.length ? ['Modalidad', esc(listaEnEspanol(modalidades))] : null,
        duraciones.length ? ['Duración', esc(duraciones.slice(0, 4).join(' · '))] : null
    ].filter(Boolean);

    // El perfil viene del Test Vocacional Completo: intereses RIASEC (0-10) +
    // aptitudes + valores. Para la ficha alcanza con los intereses más altos,
    // que son los que explican "por qué esta carrera".
    const riasec = (carrera.perfil && carrera.perfil.riasec) || null;
    const dimensionesTop = riasec
        ? Object.entries(riasec)
            .filter(([, score]) => score >= 5)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([dim, score]) => ({
                dim,
                score,
                nombre: (ETIQUETAS_VOCACIONAL.riasec[dim] || {}).nombre || dim,
                desc: (ETIQUETAS_VOCACIONAL.riasec[dim] || {}).desc || ''
            }))
        : [];

    const seccionPerfil = dimensionesTop.length ? `
    <h2>Perfil de intereses de ${esc(carrera.nombre)}</h2>
    <p>El perfil de esta carrera, según el Test Vocacional de BEN, se inclina por estos intereses (escala 0 a 10):</p>
    <ul class="lista-aptitudes">
${dimensionesTop.map(d => `        <li class="aptitud-item">
            <div class="aptitud-encabezado">
                <strong>${esc(d.nombre)}</strong>
                <span class="aptitud-score">Nivel ${d.score}/10</span>
            </div>
            <p class="aptitud-desc">${esc(d.desc)}</p>
        </li>`).join('\n')}
    </ul>
    <div class="nota-test">
        <p>¿Querés saber qué tan compatible sos con esta carrera? <a href="/?test=1">Hacé el Test Vocacional Completo de BEN</a> (4-6 min) y compará tu perfil con las 651 formaciones del catálogo.</p>
    </div>` : '';

    // Generación dinámica de Preguntas Frecuentes para Google y usuarios
    const nombresInst = [...new Set(carrera.ofertas.map(o => o.institucion.nombre))];
    const provs = [...new Set(carrera.ofertas.map(o => o.institucion.provincia).filter(Boolean))];
    const ubicacionStr = provs.length ? (provs.length === 1 ? `en ${provs[0]}` : `en ${listaEnEspanol(provs)}`) : 'en Argentina';
    const listaInstTxt = listaEnEspanol(nombresInst);

    const cuantasInstTxt = nombresInst.length === 1 ? 'la siguiente institución' : `${nombresInst.length} instituciones`;
    const respDonde = `Podés estudiar ${carrera.nombre} ${ubicacionStr} en ${cuantasInstTxt}: ${listaInstTxt}. En la parte superior de esta página encontrás las sedes y enlaces a los sitios oficiales de cada una.`;

    const anios = carrera.ofertas.map(o => obtenerDuracionEnAnios(o.duracion)).filter(a => a && a > 0);
    let duracionesTxt = '';
    if (anios.length) {
        const min = Math.min(...anios);
        const max = Math.max(...anios);
        const fmt = a => a >= 1
            ? `${Number.isInteger(a) ? a : a.toFixed(1)} ${a === 1 ? 'año' : 'años'}`
            : `${Math.round(a * 12)} meses`;
        const mismaUnidad = (min >= 1) === (max >= 1);
        const desde = mismaUnidad ? fmt(min).replace(/ (años?|meses)$/, '') : fmt(min);
        duracionesTxt = min === max
            ? `La carrera tiene una duración estimada de ${fmt(min)}.`
            : `La duración de la carrera varía de ${desde} a ${fmt(max)} según el plan de estudio de la institución elegida.`;
    } else {
        duracionesTxt = `La duración estimada depende de la institución y modalidad elegida (típicamente entre 4 y 5 años para carreras de grado, o de 2 a 3 años para tecnicaturas).`;
    }

    const modsTxt = modalidades.length
        ? `Actualmente se puede cursar en modalidad ${listaEnEspanol(modalidades.map(m => m.toLowerCase()))}, según la institución que elijas.`
        : `Las modalidades típicas son presencial o a distancia según la institución educativa.`;

    const tipoTxt = NOMBRES_FORMACION[carrera.formacion] || carrera.categoria || 'carrera';
    const afinesTxt = dimensionesTop.length
        ? ` Entre sus aptitudes más afines se destacan: ${listaEnEspanol(dimensionesTop.map(d => d.nombre.toLowerCase()))}.`
        : '';
    const respTitulo = `${carrera.nombre} es una ${tipoTxt.toLowerCase()} perteneciente al área de ${carrera.area}.${afinesTxt}`;

    const faqs = [
        {
            pregunta: `¿Dónde estudiar ${carrera.nombre} ${ubicacionStr}?`,
            respuesta: respDonde
        },
        {
            pregunta: `¿Cuánto dura la carrera de ${carrera.nombre}?`,
            respuesta: duracionesTxt
        },
        {
            pregunta: `¿Qué modalidades de cursado hay para ${carrera.nombre}?`,
            respuesta: modsTxt
        },
        {
            pregunta: `¿Qué perfil y habilidades se recomiendan para ${carrera.nombre}?`,
            respuesta: respTitulo
        }
    ];

    const seccionFaq = `
    <h2>Preguntas frecuentes sobre ${esc(carrera.nombre)}</h2>
    <div class="faq-lista">
${faqs.map(f => `        <details class="faq-item">
            <summary class="faq-pregunta"><strong>${esc(f.pregunta)}</strong></summary>
            <div class="faq-respuesta">
                <p>${esc(f.respuesta)}</p>
            </div>
        </details>`).join('\n')}
    </div>`;

    // Guardar la carrera y compararla después. En las páginas estáticas la
    // clave es la de la carrera agrupada, que Mi lista sabe resolver.
    const cuerpo = `    <p class="entrada">${esc(descripcion)}</p>
    <div class="acciones-ficha">
        ${botonFavorito({
            clave: carrera.clave,
            tipo: 'carrera',
            claveCarrera: carrera.clave,
            nombre: carrera.nombre,
            institucion: '',
            area: carrera.area,
            formacion: carrera.formacion,
            ficha: carrera.slug,
            link: ''
        })}
        <a class="btn-ver-mi-lista" href="/?lista=1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
            Ver Mi lista
        </a>
    </div>`;

    const contenido = `    <h2>Dónde estudiar ${esc(carrera.nombre)}</h2>
    <ul class="ofertas">
${carrera.ofertas.map((o, i) => tarjetaOferta(o, { id: `oferta-${i + 1}` })).join('\n')}
    </ul>
${seccionPerfil}
${seccionFaq}
${relacionadas.length ? `
    <section class="relacionadas">
    <h2>Otras carreras del área ${esc(carrera.area)}</h2>
    <ul class="enlaces">
${relacionadas.map(c => `        <li><a href="/carrera/${c.slug}/">${esc(c.nombre)}</a> <span class="cuantas">(${c.ofertas.length})</span></li>`).join('\n')}
    </ul>
    <p><a href="/area/${carrera.areaRef.slug}/">Ver las ${carrera.areaRef.carreras.length} carreras del área ${esc(carrera.area)} →</a></p>
    </section>` : ''}`;

    const lateral = `    <dl class="ficha">
${ficha.map(([k, v]) => `        <dt>${k}</dt><dd>${v}</dd>`).join('\n')}
    </dl>`;

    const ld = carrera.ofertas.length >= 3
        ? {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `Dónde estudiar ${carrera.nombre}`,
            numberOfItems: carrera.ofertas.length,
            itemListElement: carrera.ofertas.map((o, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${DOMINIO}${ruta}#oferta-${i + 1}`,
                item: {
                    '@type': 'Course',
                    name: `${carrera.nombre} — ${o.institucion.nombre}`,
                    description: `${carrera.nombre} en ${o.institucion.nombre}.${o.duracion ? ` Duración: ${duracionCorta(o.duracion)}.` : ''}${o.modalidad ? ` Modalidad: ${o.modalidad}.` : ''}`,
                    url: `${DOMINIO}${ruta}#oferta-${i + 1}`,
                    ...(o.link ? { sameAs: o.link } : {}),
                    provider: {
                        '@type': 'EducationalOrganization',
                        name: o.institucion.nombre,
                        url: `${DOMINIO}/institucion/${o.institucion.slug}/`
                    }
                }
            }))
        }
        : {
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: carrera.nombre,
            description: descripcion,
            url: DOMINIO + ruta,
            provider: carrera.ofertas.length === 1
                ? {
                    '@type': 'EducationalOrganization',
                    name: carrera.ofertas[0].institucion.nombre,
                    url: `${DOMINIO}/institucion/${carrera.ofertas[0].institucion.slug}/`
                }
                : carrera.ofertas.map(o => ({
                    '@type': 'EducationalOrganization',
                    name: o.institucion.nombre,
                    url: `${DOMINIO}/institucion/${o.institucion.slug}/`
                }))
        };

    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({
            '@type': 'Question',
            name: f.pregunta,
            acceptedAnswer: {
                '@type': 'Answer',
                text: f.respuesta
            }
        }))
    };

    const provincias = [...new Set(carrera.ofertas.map(o => o.institucion.provincia).filter(Boolean))].sort();
    const complementoTitulo = provincias.length === 1
        ? `: dónde estudiarla en ${provincias[0]}`
        : ': dónde estudiarla';

    return {
        ruta,
        html: documento({
            ruta,
            titulo: tituloAcotado(carrera.nombre, complementoTitulo),
            descripcion,
            h1: carrera.nombre,
            cuerpo,
            contenido,
            lateral,
            pasos: [
                { nombre: 'Inicio', url: '/' },
                { nombre: 'Carreras', url: '/carreras/' },
                { nombre: carrera.area, url: `/area/${carrera.areaRef ? carrera.areaRef.slug : ''}/` },
                { nombre: carrera.nombre, url: ruta }
            ],
            ldExtra: [ld, faqSchema]
        })
    };
}

function paginaArea(area) {
    const ruta = `/area/${area.slug}/`;
    const instituciones = new Set(area.carreras.flatMap(c => c.ofertas.map(o => o.institucion.nombre)));
    const descripcion = `${plural(area.carreras.length, 'carrera', 'carreras')} del área ${area.nombre} en BEN, dictadas por ${plural(instituciones.size, 'institución', 'instituciones')}. Mirá cuáles son, cuánto duran y dónde se cursan.`;

    const porFormacion = ['grado', 'tecnicaturas', 'profesorados', 'cursos']
        .map(f => ({ f, lista: area.carreras.filter(c => c.formacion === f).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) }))
        .filter(g => g.lista.length);

    const cuerpo = `    <p class="entrada">${esc(descripcion)}</p>

    <a class="cta" href="/?area=${encodeURIComponent(area.nombre)}">Filtrar ${esc(area.nombre)} en el buscador →</a>
${porFormacion.map(g => `
    <h2>${esc(PLURALES_FORMACION[g.f])} (${g.lista.length})</h2>
    <ul class="enlaces">
${g.lista.map(c => `        <li><a href="/carrera/${c.slug}/">${esc(c.nombre)}</a> <span class="cuantas">(${c.ofertas.length})</span></li>`).join('\n')}
    </ul>`).join('\n')}
`;

    const ld = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `Carreras del área ${area.nombre}`,
        description: descripcion,
        url: DOMINIO + ruta
    };

    return {
        ruta,
        html: documento({
            ruta,
            titulo: tituloAcotado(`Qué estudiar en ${area.nombre}`),
            descripcion,
            h1: `Qué estudiar en ${area.nombre}`,
            cuerpo,
            pasos: [
                { nombre: 'Inicio', url: '/' },
                { nombre: 'Carreras', url: '/carreras/' },
                { nombre: area.nombre, url: ruta }
            ],
            ldExtra: [ld]
        })
    };
}

function paginaInstitucion(institucion) {
    const ruta = `/institucion/${institucion.slug}/`;
    const contacto = institucion.contacto || {};
    const dato = v => {
        const t = limpiar(v);
        return t && !/^a confirmar$/i.test(t) ? t : '';
    };

    const areas = new Map();
    institucion.ofertas.forEach(o => {
        const area = o.carrera ? o.carrera.area : 'Otras formaciones';
        if (!areas.has(area)) areas.set(area, []);
        areas.get(area).push(o);
    });
    const grupos = [...areas.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'es'));

    const descripcion = `${institucion.nombre}: ${plural(institucion.ofertas.length, 'carrera', 'carreras')}${institucion.provincia ? ` en ${institucion.provincia}` : ''}${institucion.gestion ? `, gestión ${institucion.gestion}` : ''}. Duración, modalidad y links oficiales de cada una.`;

    const ficha = [
        institucion.gestion ? ['Gestión', esc(institucion.gestion)] : null,
        institucion.nivel ? ['Nivel', esc(institucion.nivel)] : null,
        institucion.provinciaCruda ? ['Provincia', institucion.provinciaRef
            ? `<a href="/provincia/${institucion.provinciaRef.slug}/">${esc(institucion.provinciaCruda)}</a>`
            : esc(institucion.provinciaCruda)] : null,
        ['Oferta en BEN', plural(institucion.ofertas.length, 'carrera', 'carreras')],
        dato(contacto.direccion) ? ['Dirección', esc(contacto.direccion)] : null,
        dato(contacto.telefono) ? ['Teléfono', esc(contacto.telefono)] : null,
        dato(contacto.email) ? ['Email', esc(contacto.email)] : null
    ].filter(Boolean);

    const cuerpo = `    <p class="entrada">${esc(descripcion)}</p>`;

    const contenido = `${grupos.map(([area, lista]) => `
    <h2>${esc(area)} (${lista.length})</h2>
    <ul class="ofertas">
${lista.map(o => tarjetaOferta(o, { mostrarInstitucion: false })).join('\n')}
    </ul>`).join('\n')}`;

    const lateral = `    <dl class="ficha">
${ficha.map(([k, v]) => `        <dt>${k}</dt><dd>${v}</dd>`).join('\n')}
    </dl>`;

    const ld = {
        '@context': 'https://schema.org',
        '@type': 'EducationalOrganization',
        name: institucion.nombre,
        url: DOMINIO + ruta,
        ...(dato(contacto.email) ? { email: dato(contacto.email) } : {}),
        ...(dato(contacto.telefono) ? { telephone: dato(contacto.telefono) } : {}),
        ...(dato(contacto.direccion) || institucion.provincia ? {
            address: {
                '@type': 'PostalAddress',
                ...(dato(contacto.direccion) ? { streetAddress: dato(contacto.direccion) } : {}),
                ...(institucion.provincia ? { addressRegion: institucion.provincia } : {}),
                addressCountry: 'AR'
            }
        } : {})
    };

    return {
        ruta,
        html: documento({
            ruta,
            titulo: tituloAcotado(institucion.nombre, ': carreras y oferta'),
            descripcion,
            h1: institucion.nombre,
            cuerpo,
            contenido,
            lateral,
            pasos: [
                { nombre: 'Inicio', url: '/' },
                { nombre: 'Instituciones', url: '/instituciones/' },
                ...(institucion.provinciaRef
                    ? [{ nombre: institucion.provinciaRef.nombre, url: `/provincia/${institucion.provinciaRef.slug}/` }]
                    : []),
                { nombre: institucion.nombre, url: ruta }
            ],
            ldExtra: [ld]
        })
    };
}

function clasificarInstitucion(inst) {
    const n = normalizar(inst.nombre);
    const niv = normalizar(inst.nivel);
    const f = inst.fuente;

    if (f === 'Terminalidad educativa' || /cens|cebja|cepas|fines/.test(n)) {
        return 'Terminalidad educativa';
    }
    // Primero el nivel de la institución, después el origen de los datos: una
    // IES que llegó por un catálogo "aparté" (Ej. IES 9016 "Dr. Jorge Col", IES
    // 9-005 "Fidela Amparán") es educación superior, no un centro de oficios.
    if (/^terciario|superior/.test(niv) || /^ies\b|instituto de educacion fisica|instituto superior|instituto de arte|instituto maipu|instituto juan|instituto santisima|insutec|instituto fabian calle/i.test(n)) {
        return 'Institutos Superiores y Terciarios (IES)';
    }
    if (f === 'Oficio técnico' || f === 'Formación alternativa') {
        return 'Centros de Formación Profesional y Oficios';
    }
    // Dentro de Educación formal:
    if (/universidad|facultad|\binstituto univ|\binstituto tecnologico universitario\b|\bitu\b/.test(n) || niv === 'universidad') {
        return 'Universidades';
    }
    if (/ies |iesvu|instituto superior|terciario|profesorado|instituto/i.test(n) || /superior|terciari/i.test(niv)) {
        return 'Institutos Superiores y Terciarios (IES)';
    }
    return 'Centros de Formación Profesional y Oficios';
}

function paginaProvincia(provincia) {
    const ruta = `/provincia/${provincia.slug}/`;
    const ofertas = provincia.instituciones.flatMap(i => i.ofertas);
    const carreras = new Set(ofertas.map(o => normalizar(o.nombre)));
    const descripcion = `Dónde estudiar en ${provincia.nombre}: ${plural(provincia.instituciones.length, 'institución', 'instituciones')} y ${plural(carreras.size, 'carrera distinta', 'carreras distintas')} entre universidades, terciarios, oficios y formación profesional.`;

    // Agrupamiento por tipo de institución para mejor UX y relevancia semántica
    const porNivel = new Map([
        ['Universidades', []],
        ['Institutos Superiores y Terciarios (IES)', []],
        ['Centros de Formación Profesional y Oficios', []],
        ['Terminalidad educativa', []]
    ]);

    provincia.instituciones.forEach(inst => {
        const cat = clasificarInstitucion(inst);
        if (!porNivel.has(cat)) porNivel.set(cat, []);
        porNivel.get(cat).push(inst);
    });

    const grupos = [...porNivel.entries()].filter(([, lista]) => lista.length);

    const cuerpo = `    <p class="entrada">${esc(descripcion)}</p>

    <div style="display: flex; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-7);">
        <a class="cta" href="/provincia/${provincia.slug}/universidades/">Ver sólo Universidades en ${esc(provincia.nombre)} →</a>
        <a class="cta" href="/provincia/${provincia.slug}/carreras/">Ver todas las Carreras en ${esc(provincia.nombre)} →</a>
    </div>
${grupos.map(([titulo, lista]) => `
    <h2>${esc(titulo)} (${lista.length})</h2>
    <ul class="enlaces">
${[...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(i => `        <li><a href="/institucion/${i.slug}/">${esc(i.nombre)}</a> <span class="cuantas">(${plural(i.ofertas.length, 'carrera', 'carreras')})</span></li>`).join('\n')}
    </ul>`).join('\n')}
`;

    return {
        ruta,
        html: documento({
            ruta,
            titulo: tituloAcotado(`Dónde estudiar en ${provincia.nombre}`),
            descripcion,
            h1: `Dónde estudiar en ${provincia.nombre}`,
            cuerpo,
            pasos: [
                { nombre: 'Inicio', url: '/' },
                { nombre: 'Instituciones', url: '/instituciones/' },
                { nombre: provincia.nombre, url: ruta }
            ],
            ldExtra: [{
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: `Dónde estudiar en ${provincia.nombre}`,
                description: descripcion,
                url: DOMINIO + ruta
            }]
        })
    };
}

function paginaProvinciaUniversidades(provincia) {
    const ruta = `/provincia/${provincia.slug}/universidades/`;
    const unis = provincia.instituciones.filter(i => clasificarInstitucion(i) === 'Universidades');
    const publicas = unis.filter(i => /publica/.test(normalizar(i.gestion)));
    const privadas = unis.filter(i => /privada/.test(normalizar(i.gestion)));

    const descripcion = `Universidades en ${provincia.nombre}: guía completa de las ${unis.length} universidades públicas y privadas. Carreras de grado, modalidades, sedes y links oficiales.`;

    const grupos = [
        ['Universidades públicas', publicas],
        ['Universidades privadas', privadas]
    ].filter(([, lista]) => lista.length);

    const cuerpo = `    <p class="entrada">${esc(descripcion)}</p>

    <div style="display: flex; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-7);">
        <a class="cta" href="/provincia/${provincia.slug}/">Todas las instituciones en ${esc(provincia.nombre)}</a>
        <a class="cta" href="/provincia/${provincia.slug}/carreras/">Ver carreras en ${esc(provincia.nombre)}</a>
    </div>
${grupos.map(([titulo, lista]) => `
    <h2>${esc(titulo)} (${lista.length})</h2>
    <ul class="enlaces">
${[...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(i => `        <li><a href="/institucion/${i.slug}/">${esc(i.nombre)}</a> <span class="cuantas">(${plural(i.ofertas.length, 'carrera', 'carreras')})</span></li>`).join('\n')}
    </ul>`).join('\n')}
`;

    return {
        ruta,
        html: documento({
            ruta,
            titulo: `Universidades en ${provincia.nombre} (Públicas y Privadas) | BEN`,
            descripcion,
            h1: `Universidades en ${provincia.nombre}`,
            cuerpo,
            pasos: [
                { nombre: 'Inicio', url: '/' },
                { nombre: 'Instituciones', url: '/instituciones/' },
                { nombre: provincia.nombre, url: `/provincia/${provincia.slug}/` },
                { nombre: 'Universidades', url: ruta }
            ],
            ldExtra: [{
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: `Universidades en ${provincia.nombre}`,
                description: descripcion,
                url: DOMINIO + ruta
            }]
        })
    };
}

function paginaProvinciaCarreras(provincia, modelo) {
    const ruta = `/provincia/${provincia.slug}/carreras/`;
    // Carreras que tienen al menos una oferta en esta provincia
    const carrerasProv = modelo.carreras.filter(c =>
        c.ofertas.some(o => o.institucion.provincia === provincia.nombre)
    );

    const porArea = new Map();
    carrerasProv.forEach(c => {
        if (!porArea.has(c.area)) porArea.set(c.area, []);
        porArea.get(c.area).push(c);
    });

    const descripcion = `Carreras en ${provincia.nombre}: listado completo de las ${carrerasProv.length} carreras universitarias, tecnicaturas y profesorados para estudiar en la provincia.`;

    const cuerpo = `    <p class="entrada">${esc(descripcion)}</p>

    <div style="display: flex; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-7);">
        <a class="cta" href="/provincia/${provincia.slug}/universidades/">Ver sólo universidades</a>
        <a class="cta" href="/provincia/${provincia.slug}/">Todas las instituciones</a>
    </div>
${[...porArea.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([area, lista]) => `
    <h2>${esc(area)} (${lista.length})</h2>
    <ul class="enlaces">
${[...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(c => `        <li><a href="/carrera/${c.slug}/">${esc(c.nombre)}</a> <span class="cuantas">(${c.ofertas.filter(o => o.institucion.provincia === provincia.nombre).length})</span></li>`).join('\n')}
    </ul>`).join('\n')}
`;

    return {
        ruta,
        html: documento({
            ruta,
            titulo: `Carreras en ${provincia.nombre}: oferta académica | BEN`,
            descripcion,
            h1: `Carreras en ${provincia.nombre}`,
            cuerpo,
            pasos: [
                { nombre: 'Inicio', url: '/' },
                { nombre: 'Carreras', url: '/carreras/' },
                { nombre: provincia.nombre, url: `/provincia/${provincia.slug}/` },
                { nombre: `Carreras en ${provincia.nombre}`, url: ruta }
            ],
            ldExtra: [{
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: `Carreras en ${provincia.nombre}`,
                description: descripcion,
                url: DOMINIO + ruta
            }]
        })
    };
}

function indiceCarreras(modelo) {
    const ruta = '/carreras/';
    const descripcion = `Listado completo de las ${modelo.carreras.length} carreras que reúne BEN, ordenadas por área: grado, tecnicaturas, profesorados, oficios y cursos.`;

    const cuerpo = `    <p class="entrada">${esc(descripcion)}</p>

    <a class="cta" href="/">Ir al buscador</a>
${modelo.areas.map(a => `
    <h2><a href="/area/${a.slug}/">${esc(a.nombre)}</a> (${a.carreras.length})</h2>
    <ul class="enlaces">
${[...a.carreras].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')).map(c => `        <li><a href="/carrera/${c.slug}/">${esc(c.nombre)}</a> <span class="cuantas">(${c.ofertas.length})</span></li>`).join('\n')}
    </ul>`).join('\n')}
`;

    return {
        ruta,
        html: documento({
            ruta,
            titulo: 'Todas las carreras | BEN',
            descripcion,
            h1: 'Todas las carreras',
            cuerpo,
            pasos: [{ nombre: 'Inicio', url: '/' }, { nombre: 'Carreras', url: ruta }],
            ldExtra: [{
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: 'Todas las carreras',
                description: descripcion,
                url: DOMINIO + ruta
            }]
        })
    };
}

function indiceInstituciones(modelo) {
    const ruta = '/instituciones/';
    const descripcion = `Las ${modelo.instituciones.length} instituciones que figuran en BEN: universidades, institutos superiores, centros de formación profesional y escuelas de oficios, con su oferta completa.`;

    const cuerpo = `    <p class="entrada">${esc(descripcion)}</p>

    <a class="cta" href="/">Ir al buscador</a>
${modelo.provincias.length ? `
    <h2>Por provincia</h2>
    <ul class="enlaces">
${modelo.provincias.map(p => `        <li><a href="/provincia/${p.slug}/">${esc(p.nombre)}</a> <span class="cuantas">(${p.instituciones.length})</span></li>`).join('\n')}
    </ul>` : ''}

    <h2>Todas las instituciones</h2>
    <ul class="enlaces">
${modelo.instituciones.map(i => `        <li><a href="/institucion/${i.slug}/">${esc(i.nombre)}</a> <span class="cuantas">(${i.ofertas.length})</span></li>`).join('\n')}
    </ul>
`;

    return {
        ruta,
        html: documento({
            ruta,
            titulo: 'Todas las instituciones | BEN',
            descripcion,
            h1: 'Todas las instituciones',
            cuerpo,
            pasos: [{ nombre: 'Inicio', url: '/' }, { nombre: 'Instituciones', url: ruta }],
            ldExtra: [{
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: 'Todas las instituciones',
                description: descripcion,
                url: DOMINIO + ruta
            }]
        })
    };
}

// GitHub Pages sirve /404.html, con el codigo HTTP 404 correcto, ante cualquier
// direccion que no existe. Sin este archivo muestra su pantalla generica: la
// persona que llego por un enlace viejo o un slug que cambio se va, y el robot
// se queda sin camino para seguir.
//
// Se genera desde aca, y no a mano, para que comparta cabecera, pie y estilos
// con las otras 650 paginas: si el dia de manana cambia el logo o el pie, esta
// cambia sola. Va con noindex (una pagina de error no se indexa) y sin canonica
// (no representa ningun contenido). Tampoco entra al sitemap.
function paginaError() {
    const cuerpo = `    <p class="entrada">La dirección a la que llegaste no existe o dejó de existir. Puede que el enlace esté viejo, que la carrera haya cambiado de nombre o que sobre una letra en la barra del navegador.</p>

    <a class="cta" href="/">Ir al buscador</a>

    <h2>O empezá por acá</h2>
    <ul class="enlaces">
        <li><a href="/carreras/">Todas las carreras</a> <span class="cuantas">(por área)</span></li>
        <li><a href="/instituciones/">Todas las instituciones</a> <span class="cuantas">(por provincia y gestión)</span></li>
    </ul>
`;

    return documento({
        ruta: '/404.html',
        titulo: 'Esta página no existe | BEN',
        descripcion: 'La dirección a la que llegaste no existe. Volvé al buscador de BEN o mirá el listado completo de carreras e instituciones.',
        h1: 'Esta página no existe',
        cuerpo,
        pasos: [{ nombre: 'Inicio', url: '/' }, { nombre: 'Página no encontrada', url: '/404.html' }],
        noindex: true
    });
}

// ---------------------------------------------------------------------------
// sitemap.xml y robots.txt
// ---------------------------------------------------------------------------

function sitemap(rutas) {
    // La fecha sale de data.json, no de "hoy": si los datos no cambiaron, el
    // sitemap tampoco, y dos builds seguidas dan archivos idénticos.
    const fecha = fs.statSync(RUTA_DATA).mtime.toISOString().slice(0, 10);
    const urls = rutas.map(({ ruta, prioridad }) => `  <url>
    <loc>${DOMINIO}${ruta}</loc>
    <lastmod>${fecha}</lastmod>
    <priority>${prioridad}</priority>
  </url>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function robots() {
    return `# BEN — Buscador Educativo Nacional
User-agent: *
Allow: /

# Insumos del proyecto, no contenido para lectores.
# data/ NO se bloquea a proposito: es de donde la app se dibuja, y taparsela al
# robot haria que vea la pagina principal vacia.
Disallow: /scrapers/
Disallow: /assets-originales/

Sitemap: ${DOMINIO}/sitemap.xml
`;
}

// ---------------------------------------------------------------------------
// Mapa de enlaces para la app
// ---------------------------------------------------------------------------

// La grilla de la portada la pinta JavaScript y hasta ahora cada tarjeta iba
// derecho al sitio de la institucion: la pagina con mas autoridad del sitio no
// enlazaba ni una sola pagina propia. La app no puede recalcular los slugs por
// su cuenta (se recortan a 80 caracteres y se desempatan con un numero cuando
// chocan), asi que el generador deja escrito el diccionario y render.js lo lee.
// La clave es el nombre normalizado igual que en normalizarTexto() de util.js.
function mapaEnlaces(modelo) {
    const carreras = {};
    modelo.carreras.forEach(c => (c.clavesFusionadas || [c.clave]).forEach(k => { carreras[k] = c.slug; }));
    const instituciones = {};
    modelo.instituciones.forEach(i => { instituciones[normalizar(i.nombre)] = i.slug; });
    return JSON.stringify({ carreras, instituciones }, null, 0);
}

// Índice del autocompletado de las páginas estáticas: clave de búsqueda -> [slug, nombre].
//
// Va en su propio archivo y no dentro de enlaces-ben.json a propósito. Ese lo
// carga la app en cada visita y solo necesita el slug; sumarle los nombres lo
// llevaba de 50 KB a 102 KB para todos. Acá los nombres los pagan únicamente
// las páginas estáticas, y recién cuando alguien escribe en el buscador chico.
//
// Hacen falta porque las claves de enlaces-ben.json están normalizadas (sin
// tildes, en minúscula) para poder buscar, y el autocompletado las estaba
// usando también como texto a mostrar: ofrecía "Enfermeria profesional" y
// "Universidad nacional de cuyo".
function mapaAutocompletado(modelo) {
    const carreras = {};
    modelo.carreras.forEach(c => (c.clavesFusionadas || [c.clave]).forEach(k => { carreras[k] = [c.slug, c.nombre]; }));
    const instituciones = {};
    modelo.instituciones.forEach(i => { instituciones[normalizar(i.nombre)] = [i.slug, i.nombre]; });
    return JSON.stringify({ carreras, instituciones }, null, 0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    // js/util.js es un modulo ES y este script es CommonJS, asi que el import
    // va aca adentro. Se resuelve antes de generar la primera pagina.
    ({ duracionCorta, formatearDuracionAnios, obtenerDuracionEnAnios } = await import('./js/util.js'));
    console.log('Generando paginas estaticas...');

    SALIDAS.forEach(dir => fs.rmSync(path.join(RAIZ, dir), { recursive: true, force: true }));

    const modelo = construirModelo();
    const fusionadas = modelo.carreras.filter(c => c.clavesFusionadas).length;
    console.log(`   ${modelo.carreras.length} carreras | ${modelo.areas.length} areas | ${modelo.instituciones.length} instituciones | ${modelo.provincias.length} provincias`);
    if (fusionadas) console.log(`   ${fusionadas} carrera(s) duplicada(s) en los datos, fusionadas en una sola pagina`);

    const rutas = [{ ruta: '/', prioridad: '1.0' }];

    const emitir = (paginas, prioridad) => paginas.forEach(p => {
        escribirPagina(p.ruta, p.html);
        rutas.push({ ruta: p.ruta, prioridad });
    });

    emitir([indiceCarreras(modelo), indiceInstituciones(modelo)], '0.9');
    emitir(modelo.areas.map(paginaArea), '0.8');
    emitir(modelo.provincias.map(paginaProvincia), '0.8');
    emitir(modelo.provincias.map(paginaProvinciaUniversidades), '0.8');
    emitir(modelo.provincias.map(p => paginaProvinciaCarreras(p, modelo)), '0.8');
    emitir(modelo.instituciones.map(paginaInstitucion), '0.7');
    emitir(modelo.carreras.map(paginaCarrera), '0.6');

    escribir('data/enlaces-ben.json', mapaEnlaces(modelo));
    escribir('data/autocompletado-ben.json', mapaAutocompletado(modelo));
    escribir('404.html', paginaError());
    escribir('sitemap.xml', sitemap(rutas));
    escribir('robots.txt', robots());

    const peso = rutas.slice(1).reduce((total, { ruta }) =>
        total + fs.statSync(path.join(RAIZ, ruta.replace(/^\//, ''), 'index.html')).size, 0);

    console.log(`OK: ${rutas.length - 1} paginas + 404.html + sitemap.xml + robots.txt + data/enlaces-ben.json + data/autocompletado-ben.json (${(peso / 1024 / 1024).toFixed(1)} MB)`);
}

main();
