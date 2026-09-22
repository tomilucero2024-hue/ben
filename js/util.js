// ==========================================
// Helpers puros: limpieza y normalizacion de texto, clasificadores de
// carrera y el escapado de HTML. No tocan el DOM ni el estado.
// ==========================================

export function distanciaLevenshtein(a, b) {
    a = a || ''; b = b || '';
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let curr = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const costo = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + costo);
        }
        [prev, curr] = [curr, prev];
    }
    return prev[n];
}

// Cuánto se parece una palabra del índice a un token de la búsqueda.
export function limpiarTexto(texto) { return String(texto || '').replace(/\s+/g, ' ').trim(); }
export function normalizarTexto(texto) { return limpiarTexto(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
// Uniforma el texto de las tarjetas SIN destruir las mayúsculas que el dato ya
// traía bien. Bajar todo a minúscula a ciegas convertía "UTN Facultad Regional
// Mendoza" en "Utn facultad regional mendoza" y "Técnico Superior en IA" en
// "...en ia": las siglas del catálogo son parte del nombre, no ruido.
//
// Solo se aplana el texto que viene GRITADO entero (sin una sola minúscula),
// que es el caso real que había que arreglar: las 8 carreras de la UTN cargadas
// como "INGENIERÍA CIVIL". Si el texto ya mezcla mayúsculas y minúsculas, el
// scraper lo trajo con su capitalización propia y se respeta tal cual.
function capitalizar(texto) {
    const t = limpiarTexto(texto);
    if (!t) return t;
    const gritado = t === t.toUpperCase() && t !== t.toLowerCase();
    const base = gritado ? t.toLowerCase() : t;
    return base.charAt(0).toUpperCase() + base.slice(1);
}
export function inferirGestion(institucion) { const gestion = normalizarTexto(institucion.gestion); return gestion.includes('public') || normalizarTexto(institucion.nombre).includes('utn') ? 'pública' : 'privada'; }
// Las carreras de la UTN que no son ingenierías se dictan con arancel
// (licenciaturas, tecnicaturas, cursos); las ingenierías son gratuitas.
export function esCarreraArancelada(institucion, nombre) {
    const esUtn = normalizarTexto(institucion.nombre || '').includes('utn');
    return esUtn && !normalizarTexto(nombre).includes('ingenieria');
}
export function inferirTipoInstitucion(institucion) {
    const nombre = normalizarTexto(institucion.nombre);
    const nivel = normalizarTexto(institucion.nivel || '');
    if (nivel === 'universidad' || nombre.includes('universidad') || nombre.includes('universitario') || nombre.includes('utn')) return 'universidades';
    // La categoría sale del nivel, no del nombre: un terciario que no se llame
    // "instituto superior" (Ej. "Instituto Fabián Calle", "EPD", "San Agustín")
    // sigue siendo una institución de educación superior, no un centro de cursos.
    if (nivel === 'terciario' || nombre.includes('ies') || nombre.includes('instituto superior')) return 'ies';
    return 'centros';
}
export function getFormacion(carrera, nombreOpcional = '') {
    const raw = typeof carrera === 'object' && carrera !== null
        ? `${carrera.categoria || ''} ${carrera.nombre_carrera || carrera.nombre || ''}`
        : `${carrera || ''} ${nombreOpcional || ''}`;
    const texto = normalizarTexto(raw);
    const tiene = (...terminos) => terminos.some(termino => texto.includes(normalizarTexto(termino)));
    if (tiene('profesorado')) return 'profesorados';
    if (tiene('tecnicatura', 'tecnico', 'pregrado')) return 'tecnicaturas';
    const sinRecursos = texto.replace(/\brecursos\b/g, '');
    if (tiene('curso', 'formacion profesional', 'capacitacion', 'taller', 'diplomatura') || sinRecursos.includes('curso')) return 'cursos';
    return 'grado';
}
function getCategoryGroup(carrera) { const formacion = getFormacion(carrera); return formacion === 'tecnicaturas' ? 'pregrado' : (formacion === 'cursos' ? 'cursos' : 'grado'); }
export function getArea(carrera) {
    const raw = typeof carrera === 'object' && carrera !== null
        ? (carrera.nombre_carrera || carrera.nombre || '')
        : (carrera || '');
    const nombre = normalizarTexto(raw);
    // El stemming matchea de más acá ("bibliotecoLOGía" contra el término
    // "ecolog"), así que estas excepciones van primero y no se discuten.
    if (nombre.includes('bibliotecologia')) return 'Ciencias sociales';
    const tiene = (...terminos) => terminos.some(termino => nombre.includes(normalizarTexto(termino)));
    // Excepciones que términos más genéricos robarían más abajo: "Instalador de
    // Sistemas Solares..." matchea "sistema" (Tecnología) y "Peluquería Canina e
    // Introducción a Auxiliar Veterinario" matchea "veterin" (Ambiente).
    if (tiene('fotovoltaic', 'solar termic', 'energias renovables')) return 'Ambiente';
    if (tiene('peluquer')) return 'Oficios';
    if (tiene('ingenier', 'mecatronic', 'miner', 'petroleo', 'hidrocarburo')) return 'Ingeniería';
    if (tiene('programacion', 'programador', 'sistema', 'informat', 'comput', 'software', 'datos', 'data', 'inteligencia artificial', 'ciberseguridad', 'ciberdefensa', 'ciber', 'robotica', 'videojuego', 'web', 'cloud', 'telecomunicacion', 'ia desde cero', 'desarrollo de software', 'seguridad informatica')) return 'Tecnología';
    if (tiene('medicin', 'enfermer', 'kinesi', 'nutric', 'odont', 'farmac', 'fonoaudi', 'obstetric', 'terapia', 'radiolog', 'bioquim', 'salud', 'anestesia', 'anestesiolog', 'preparacion fisica', 'dialisis', 'esteriliz', 'optica', 'cosmetolog', 'emergenci', 'emergentolog', 'analisis clinicos', 'instrumentacion quirurg', 'diagnostico por imagenes', 'quirofano', 'podolog', 'terapeutico', 'anatomia patologica', 'bioimagenes', 'gerontolog', 'primeros auxilios', 'salud mental', 'psicologia', 'guardavid', 'salvamento')) return 'Salud';
    if (tiene('turismo', 'hoteler', 'turist', 'guia de turismo', 'hospitalidad', 'viajes', 'recreacion', 'guia de alta montana', 'actividades de montana', 'trekking', 'gestion de recursos turisticos', 'gestion turistica', 'astronom', 'esqui', 'snowboard')) return 'Turismo';
    if (tiene('administracion', 'administrat', 'contador', 'contad', 'contabilidad', 'contable', 'marketing', 'comercio', 'negocio', 'finanza', 'econom', 'recursos humanos', 'logistica', 'secretariado', 'gestion empresarial', 'gestion de empresas', 'direccion de empresas', 'ventas', 'seguros', 'banc', 'comercializacion', 'community manager', 'martillero', 'corredor inmobiliario', 'inmobiliari', 'aduan', 'despachante de aduana', 'gestion aeroportuaria', 'siniestro', 'emprendimiento', 'gestion del liderazgo')) return 'Negocios';
    if (tiene('diseno', 'arquitect', 'multimedia', 'interiorismo', 'indumentaria', 'animacion', 'fotograf', 'grafic', 'audiovisual', 'publicidad', 'gestion de moda')) return 'Diseño';
    if (tiene('profesorado', 'educacion', 'pedagog', 'didact', 'docencia', 'ensenanza', 'preceptoria')) return 'Educación';
    if (tiene('gastronom', 'cocina', 'pasteler', 'panader', 'chef', 'sommelier', 'enolog', 'vino', 'cocteler', 'bartender', 'sensorial de vinos', 'cata de vinos', 'finca vitivinicola', 'vitivinicola', 'laboratorio vitivinicola', 'bromatolog', 'barista', 'cerveza', 'destila', 'whisky', 'vermut', 'queso', 'aceite de oliva')) return 'Gastronomía';
    if (tiene('ingles', 'idioma', 'portugues', 'frances', 'traduccion', 'interpretacion', 'italiano', 'chino', 'coreano', 'aleman', 'japones', 'lengua de senas', 'lengua extranjera')) return 'Idiomas';
    if (tiene('arte', 'musica', 'teatro', 'escenograf', 'danza', 'cine', 'ilustracion', 'canto', 'coral', 'organo', 'instrumento', 'ceramica artistica', 'actor', 'actriz', 'artes visuales', 'artes plasticas', 'piano', 'guitarra', 'composicion musical', 'bellas artes')) return 'Arte';
    if (tiene('ambient', 'agronom', 'biolog', 'biotecnolog', 'geolog', 'forestal', 'veterin', 'quimic', 'hidric', 'ecolog', 'apicultur', 'paisajis', 'agro', 'recursos naturales', 'botanica', 'zoolog', 'ciencias de la tierra', 'geografia', 'geografo', 'fisica', 'matematica', 'higiene y seguridad', 'geotecnolog', 'conservacion de la naturaleza', 'energias renovables', 'solar', 'fotovoltaic', 'riego', 'agricultur', 'cannabis', 'guardaparque')) return 'Ambiente';
    if (tiene('mecanic', 'electric', 'carpinter', 'refrigeracion', 'soldadur', 'construccion', 'automotor', 'gasista', 'plomer', 'cerrajeri', 'torner', 'herreri', 'pintur', 'albanil', 'mantenimiento', 'instalacion', 'oficio', 'pilot', 'buceo', 'drone', 'drones', 'aeronaut', 'chofer', 'conductor', 'barberia', 'peluqueri', 'electricista', 'ceramica industrial', 'ferroviari', 'automatizacion', 'autoelevador', 'topograf', 'agrimensur', 'joy', 'orfebr', 'parapente', 'nautic', 'yate', 'timonel')) return 'Oficios';
    return 'Ciencias sociales';
}
export function obtenerModalidades(modalidad) { const texto = normalizarTexto(modalidad); const valores = []; if (texto.includes('presencial')) valores.push('presencial'); if (texto.includes('online') || texto.includes('virtual') || texto.includes('distancia')) valores.push('online'); if (texto.includes('hibrid')) valores.push('híbrida'); return valores.length ? valores : ['presencial']; }
// El campo "duracion" del catálogo es texto libre escrapeado: conviven "4 años",
// "4 año", "Cuatro (4) años", "2 años y 1/2" y oraciones enteras como "La carrera
// tiene una duración de tres años, con una carga horaria total de 3000 hs.".
//
// La versión anterior agarraba el PRIMER número del texto, así que esa última
// devolvía 3000 años y la carrera terminaba clasificada en "4+ años". Acá el
// número tiene que estar pegado a una unidad de tiempo: una carga horaria en
// "hs" no matchea con nada y queda ignorada, que es lo correcto.
const NUMEROS_ESCRITOS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
// Las alternativas van de la palabra más larga a la más corta: con "un" primero,
// la alternancia cortaría ahí y "uno" nunca llegaría a matchear.
const ORDEN_NUMEROS = Object.keys(NUMEROS_ESCRITOS).sort((a, b) => b.length - a.length);
// String.raw en todos los fragmentos de regex: son patrones, no texto, y así la
// barra invertida se lee igual acá que dentro de un /.../ .
const NUMERO = String.raw`(\d+(?:[.,]\d+)?|${ORDEN_NUMEROS.join('|')})`;
// "Un medio" se escribe de varias formas y cae antes o después de la unidad:
// "4 años y medio", "2 años y 1/2", "5 1/2 años".
const MEDIO = String.raw`(?:\s*y)?\s*(?:medio|media|1/2)`;

function valorNumerico(bruto) {
    if (bruto in NUMEROS_ESCRITOS) return NUMEROS_ESCRITOS[bruto];
    const n = Number(bruto.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

// Cada unidad con cuánto vale en años. El orden importa: se prueba de la más
// específica y confiable a la menos, y gana la primera que aparezca.
const UNIDADES_DURACION = [
    { patron: 'anos?', factor: 1 },
    { patron: 'cuatrimestres?', factor: 1 / 3 },
    { patron: 'semestres?', factor: 1 / 2 },
    { patron: 'mes(?:es)?', factor: 1 / 12 },
    { patron: 'semanas?', factor: 1 / 52 },
    { patron: 'dias?', factor: 1 / 365 }
];

export function obtenerDuracionEnAnios(duracion) {
    // Lo que va entre paréntesis solo repite el número en letras o en dígitos
    // ("Cuatro (4) años", "3 (tres) años") y corta la vecindad número-unidad.
    const texto = normalizarTexto(duracion).replace(/\([^)]*\)/g, ' ');
    if (!texto) return null;
    for (const { patron, factor } of UNIDADES_DURACION) {
        const re = new RegExp(String.raw`${NUMERO}(${MEDIO})?\s*(?:${patron})\b(${MEDIO})?`);
        const m = texto.match(re);
        if (!m) continue;
        const valor = valorNumerico(m[1]);
        if (valor === null) continue;
        return (valor + (m[2] || m[3] ? 0.5 : 0)) * factor;
    }
    return null;
}
export function getGrupoDuracion(anios) { if (anios === null) return 'sin-definir'; if (anios < 0.5) return 'corta'; if (anios <= 1) return 'hasta-1'; if (anios < 4) return '2-3'; return '4-mas'; }

// Las cuatro maneras en que el catálogo dice "no sabemos". Son ausencia de dato,
// no una duración, y conviene que se lean todas igual.
const DURACION_SIN_DATO = /^(a confirmar|no especificad[ao]|sin especificar|sin datos?|verificar en (la )?(web|pagina)( oficial)?|consultar en (la )?(web|pagina)|consultar|variable|-+)\.?$/;

// La etiqueta breve que va en la tarjeta. El dato crudo es texto libre y en 149
// de 658 carreras es una oración entera ("La carrera se cursa en cuatro años.",
// "El ciclo tiene una carga horaria de 840 horas reloj, distribuidas en seis
// espacios curriculares. El cursado de estos es de 1 año y medio."), que en un
// chip de tarjeta no se puede leer. Se muestra la duración ya interpretada y el
// texto completo queda en el title; el detalle fino vive en la ficha de la
// carrera y en el sitio oficial, que la tarjeta ya enlaza.
// Convierte un número de años a texto legible. Existe porque un dato como
// "10 meses" se interpreta como 0.8333… años y no se puede mostrar el decimal
// crudo ("0.8333333333333334 años"): se vuelve a la unidad chica.
export function formatearDuracionAnios(anios) {
    if (anios === null || anios === undefined || !Number.isFinite(anios) || anios <= 0) return '';
    if (anios < 1) {
        const meses = Math.max(1, Math.round(anios * 12));
        return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }
    const enteros = Math.floor(anios);
    const resto = anios - enteros;
    const base = `${enteros} ${enteros === 1 ? 'año' : 'años'}`;
    if (resto === 0) return base;
    if (Math.abs(resto - 0.5) < 0.01) return `${base} y medio`;
    const meses = Math.round(resto * 12);
    return meses ? `${base} y ${meses} ${meses === 1 ? 'mes' : 'meses'}` : base;
}

export function duracionCorta(duracion) {
    const texto = limpiarTexto(duracion);
    if (!texto) return 'A confirmar';
    if (DURACION_SIN_DATO.test(normalizarTexto(texto))) return 'A confirmar';
    const anios = obtenerDuracionEnAnios(texto);
    // Sin poder interpretarlo no se inventa nada: se devuelve lo que vino.
    if (anios === null) return texto;
    return formatearDuracionAnios(anios);
}

// ==========================================
// 🤖 BOT ORIENTADOR VOCACIONAL - Nuevo Sistema Multidimensional
// ==========================================

export function escaparHTML(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Atajo para el caso más común en las tarjetas: capitalizar y escapar de una.
export function capSeguro(texto) {
    return escaparHTML(capitalizar(texto));
}

// Nombres propios (instituciones y facultades): se escapan pero NO se tocan las
// mayúsculas. Acá capitalizar() no sirve ni con la regla de "gritado": hay
// nombres legítimos sin ninguna minúscula ("IES 9-005", "CEBJA", "UTN FRM") que
// aplanaría a "Ies 9-005", "Cebja" y "Utn frm". El dato ya viene bien escrito.
export function nombreSeguro(texto) {
    return escaparHTML(limpiarTexto(texto));
}

// Escapar no alcanza para href/src: "javascript:alert(1)" no tiene ningún
// caracter especial y aun así ejecuta código al hacer clic. Solo dejamos pasar
// http(s); cualquier otro esquema devuelve '' y la tarjeta muestra el estado
// "sin link", que ya estaba contemplado en todos los renders.
export function urlSegura(url) {
    const limpia = limpiarTexto(url);
    if (!/^https?:\/\//i.test(limpia)) return '';
    return limpia;
}


// Etiqueta legible del match de la búsqueda libre del copiloto (escala 0-10).
// Vivía en copiloto.js, pero render.js la necesita para pintar el badge y así se
// evita que render.js dependa del copiloto (import circular).
export function etiquetaCompatibilidad(score) {
    if (score >= 9) return '🎯 Muy compatible';
    if (score >= 5) return '✔️ Compatible';
    return '🔎 Podría interesarte';
}
