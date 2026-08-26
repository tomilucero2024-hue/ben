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
// Primera letra en mayúscula y el resto en minúscula, para uniformar el texto
// de las tarjetas sin romper acentos ni palabras con tilde.
function capitalizar(texto) {
    const t = limpiarTexto(texto);
    if (!t) return t;
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
export function inferirGestion(institucion) { const gestion = normalizarTexto(institucion.gestion); return gestion.includes('public') || normalizarTexto(institucion.nombre).includes('utn') ? 'pública' : 'privada'; }
// Las carreras de la UTN que no son ingenierías se dictan con arancel
// (licenciaturas, tecnicaturas, cursos); las ingenierías son gratuitas.
export function esCarreraArancelada(institucion, nombre) {
    const esUtn = normalizarTexto(institucion.nombre || '').includes('utn');
    return esUtn && !normalizarTexto(nombre).includes('ingenieria');
}
export function inferirTipoInstitucion(institucion) { const nombre = normalizarTexto(institucion.nombre); return institucion.nivel === 'universidad' || nombre.includes('universidad') || nombre.includes('universitario') || nombre.includes('utn') ? 'universidades' : (nombre.includes('ies') || nombre.includes('instituto superior') ? 'ies' : 'centros'); }
export function getFormacion(carrera) { const texto = normalizarTexto(`${carrera.categoria} ${carrera.nombre_carrera}`); return texto.includes('profesorado') ? 'profesorados' : (texto.includes('tecnicatura') || texto.includes('tecnico') || texto.includes('pregrado') ? 'tecnicaturas' : (texto.includes('curso') || texto.includes('formacion profesional') ? 'cursos' : 'grado')); }
function getCategoryGroup(carrera) { const formacion = getFormacion(carrera); return formacion === 'tecnicaturas' ? 'pregrado' : (formacion === 'cursos' ? 'cursos' : 'grado'); }
export function getArea(carrera) {
    const nombre = normalizarTexto(carrera.nombre_carrera);
    const tiene = (...terminos) => terminos.some(termino => nombre.includes(termino));
    if (tiene('ingenier')) return 'Ingeniería';
    if (tiene('program', 'sistema', 'informat', 'comput', 'software', 'datos', 'data', 'inteligencia artificial', 'ciberseguridad', 'robotica', 'videojuego', 'web', 'cloud')) return 'Tecnología';
    if (tiene('medicin', 'enfermer', 'kinesi', 'nutric', 'odont', 'farmac', 'fonoaudi', 'obstetric', 'terapia', 'radiolog', 'bioquim', 'salud', 'anestesia', 'instrumentacion quirurg')) return 'Salud';
    if (tiene('administracion', 'contador', 'contad', 'marketing', 'comercio', 'negocio', 'finanza', 'econom', 'recursos humanos', 'logistica', 'secretariado', 'gestion empresarial')) return 'Negocios';
    if (tiene('diseno', 'arquitect', 'multimedia', 'interiorismo', 'indumentaria', 'animacion')) return 'Diseño';
    if (tiene('profesorado', 'educacion', 'pedagog', 'didact')) return 'Educación';
    if (tiene('turismo', 'hoteler', 'guia de turismo')) return 'Turismo';
    if (tiene('gastronom', 'cocina', 'pasteler', 'panader')) return 'Gastronomía';
    if (tiene('ingles', 'idioma', 'portugues', 'frances', 'traduccion', 'interpretacion', 'italiano', 'chino', 'coreano', 'aleman', 'japones')) return 'Idiomas';
    if (tiene('arte', 'musica', 'teatro', 'escenograf', 'danza', 'cine', 'fotograf', 'audiovisual', 'ilustracion', 'canto', 'coral', 'organo', 'instrumento', 'ceramica artistica')) return 'Arte';
    if (tiene('diagnostico por imagenes', 'quirofano', 'podolog')) return 'Salud';
    if (tiene('ambient', 'agronom', 'biolog', 'geolog', 'forestal', 'veterin', 'quimic', 'hidric')) return 'Ambiente';
    if (tiene('mecanic', 'electric', 'carpinter', 'refrigeracion', 'soldadur', 'construccion', 'automotor', 'gasista', 'plomer')) return 'Oficios';
    return 'Ciencias sociales';
}
export function obtenerModalidades(modalidad) { const texto = normalizarTexto(modalidad); const valores = []; if (texto.includes('presencial')) valores.push('presencial'); if (texto.includes('online') || texto.includes('virtual') || texto.includes('distancia')) valores.push('online'); if (texto.includes('hibrid')) valores.push('híbrida'); return valores.length ? valores : ['presencial']; }
export function obtenerDuracionEnAnios(duracion) { const texto = normalizarTexto(duracion); const numero = texto.match(/\d+(?:[.,]\d+)?/); const valor = numero ? Number(numero[0].replace(',', '.')) : ({ uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 }[Object.keys({ uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 }).find(p => new RegExp(`\\b${p}\\b`).test(texto))] || null); if (valor === null) return null; if (texto.includes('mes')) return valor / 12; if (texto.includes('semana') || texto.includes('dia')) return valor / 52; return texto.includes('medio') ? valor + .5 : valor; }
export function getGrupoDuracion(anios) { if (anios === null) return 'sin-definir'; if (anios < 0.5) return 'corta'; if (anios <= 1) return 'hasta-1'; if (anios < 4) return '2-3'; return '4-mas'; }

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

// Escapar no alcanza para href/src: "javascript:alert(1)" no tiene ningún
// caracter especial y aun así ejecuta código al hacer clic. Solo dejamos pasar
// http(s); cualquier otro esquema devuelve '' y la tarjeta muestra el estado
// "sin link", que ya estaba contemplado en todos los renders.
export function urlSegura(url) {
    const limpia = limpiarTexto(url);
    if (!limpia) return '';
    try {
        const protocolo = new URL(limpia, document.baseURI).protocol;
        return (protocolo === 'http:' || protocolo === 'https:') ? limpia : '';
    } catch (e) {
        return '';
    }
}

