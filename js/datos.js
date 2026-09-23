// ==========================================
// Carga de data.json y construccion de las estructuras que consume la vista:
// ofertas, plataformas y los catalogos aparte.
// ==========================================

import { actualizarVista } from './render.js';
import { estado } from './estado.js';
import { escaparHTML, getArea, getFormacion, inferirGestion, inferirTipoInstitucion, limpiarTexto, normalizarTexto, obtenerDuracionEnAnios, obtenerModalidades } from './util.js';

// Carreras de instituciones formales (universidades, IES, terciarios).
export const ofertas = [];
// Sectores de aplicación laboral (data/sectores.json): lista cerrada que
// alimenta el filtro del panel. Los chips se inyectan desde acá, no van
// hardcodeados en index.html.
export const SECTORES = [];
// Sectores de aplicación laboral por carrera (data/sectores-carreras.json,
// generado por generar-paginas.js): clave normalizada -> [ids]. Es un mapa
// liviano a propósito: las descripciones completas viven en
// data/contenido-carreras.json, que solo leen las páginas estáticas al
// generarse. Acá las claves fusionadas ya vienen resueltas por el generador.
const SECTORES_CARRERAS = {};
// Diccionario nombre-normalizado -> slug que escribe generar-paginas.js. Es lo
// que le permite a cada tarjeta enlazar la pagina propia de esa carrera en vez
// de mandar a la persona (y al credito que reparte Google) derecho afuera del
// sitio. Si el archivo falta, las tarjetas siguen andando sin ese enlace.
export const enlacesBEN = { carreras: {}, instituciones: {} };
// Plataformas online: una entrada por plataforma, no por curso.
export const plataformas = [];

// Datos que no viven en data.json (su estructura no se toca): a dónde lleva cada
// plataforma y, opcionalmente, su logo.
//
// ▼▼▼ PARA AGREGAR LOS LOGOS ▼▼▼
// 1. Guardá cada imagen en  img/plataformas/  (ej: coderhouse.svg o .png).
// 2. Escribí el nombre del archivo en el campo "logo" de la plataforma:
//        'Coderhouse': { url: 'https://www.coderhouse.com/ar', logo: 'coderhouse.svg' },
// La tarjeta lo dibuja sola. Si "logo" queda vacío, no se muestra imagen y no se
// rompe nada: en su lugar aparece la inicial de la plataforma.
// ▲▲▲ ------------------------ ▲▲▲
//
// OJO: revisá que estas URLs sigan siendo las oficiales antes de publicar.
const PLATAFORMAS_INFO = {
    'Coderhouse':       { url: 'https://www.coderhouse.com/ar',    logo: '' },
    'Soy Henry':        { url: 'https://www.soyhenry.com',         logo: '' },
    'Educación IT':     { url: 'https://www.educacionit.com',      logo: '' },
    'Digital House':    { url: 'https://www.digitalhouse.com',     logo: '' },
    'Nucba':            { url: 'https://www.nucba.com.ar',         logo: '' },
    'Mindhub':          { url: 'https://www.mindhub.la',           logo: '' },
    'Image Campus':     { url: 'https://www.imagecampus.edu.ar',   logo: '' },
    'Escuela Da Vinci': { url: 'https://www.davinci.edu.ar',       logo: '' },
    'Teclab':           { url: 'https://www.teclab.edu.ar',        logo: '' },
    // Plataformas de acceso libre: se entra y se empieza cuando uno quiera, sin
    // convocatoria ni cupo por selección.
    'Fundación YPF':                    { url: 'https://lab.fundacionypf.org/formacion-digital',                  logo: '' },
    'Santander Open Academy':           { url: 'https://www.santanderopenacademy.com/es/index.html',              logo: '' },
    'ProgramON':                        { url: 'https://www.chicos.net/programon',                                logo: '' },
    'Microsoft Learn':                  { url: 'https://www.microsoft.com/es-ar/microsoft-learn',                 logo: '' },
    'Enlace 2.0 (Gobierno de Mendoza)': { url: 'https://www.mendoza.gov.ar/economia/entornodecapacitacion-enlace/', logo: '' },
    // --- Nacionales / LatAm ---
    'Platzi':                           { url: 'https://platzi.com',        logo: '' },
    'Domestika':                        { url: 'https://www.domestika.org/es', logo: '' },
    'Crehana':                          { url: 'https://www.crehana.com',    logo: '' },
    'Open English':                     { url: 'https://www.openenglish.com', logo: '' },
    'Capacitarte':                      { url: 'https://capacitarte.org',    logo: '' },
    'Centro de e-Learning UTN BA':      { url: 'https://utnba.centrodeelearning.com', logo: '' },
    'Google Actívate (Crece con Google)': { url: 'https://crece.withgoogle.com', logo: '' },
    'Fundación Telefónica - Conecta Empleo': { url: 'https://conectaempleo-formacion.fundaciontelefonica.com', logo: '' },
    // --- Internacionales gratuitas (con certificado) ---
    'Coursera':                         { url: 'https://www.coursera.org',   logo: '' },
    'edX':                              { url: 'https://www.edx.org',         logo: '' },
    'freeCodeCamp':                     { url: 'https://www.freecodecamp.org', logo: '' },
    'Khan Academy (español)':           { url: 'https://es.khanacademy.org', logo: '' },
    'IBM SkillsBuild':                  { url: 'https://skillsbuild.org',    logo: '' },
    'Cisco Networking Academy':         { url: 'https://www.netacad.com',    logo: '' },
    'AWS Skill Builder':                { url: 'https://aws.amazon.com/training', logo: '' },
    'Google Cloud Skills Boost':        { url: 'https://www.skills.google',  logo: '' },
    'MIT OpenCourseWare':               { url: 'https://ocw.mit.edu',        logo: '' },
    'OpenLearn (Open University)':      { url: 'https://www.open.edu/openlearn', logo: '' },
    // --- Internacionales de pago ---
    'Udemy':                            { url: 'https://www.udemy.com',      logo: '' },
    'Udacity':                          { url: 'https://www.udacity.com',    logo: '' },
    'FutureLearn':                      { url: 'https://www.futurelearn.com', logo: '' },
    'Codecademy':                       { url: 'https://www.codecademy.com', logo: '' },
    'DataCamp':                         { url: 'https://www.datacamp.com',   logo: '' },
    'LinkedIn Learning':                { url: 'https://www.linkedin.com/learning', logo: '' }
};

const CARPETA_LOGOS = '/img/plataformas/';

// Grupos que viven en su propia clave de data.json y tienen vista propia. No se
// mezclan con las carreras de universidades ni con las plataformas, y NO pasan
// por getFormacion()/getArea(): esa clasificación es de la lista "instituciones"
// y acá metería un curso de piloto de drones junto a un profesorado.
export const catalogosAparte = {
    'formaciones-alternativas': {
        clave: 'formaciones_alternativas',
        seccion: 'seccion-formaciones',
        contenedor: 'contenedor-formaciones',
        cursos: []
    },
    'oficios-tecnicos': {
        clave: 'oficios_tecnicos',
        seccion: 'seccion-oficios',
        contenedor: 'contenedor-oficios',
        cursos: []
    },
    'secundario': {
        clave: 'secundario',
        seccion: 'seccion-secundario',
        contenedor: 'contenedor-secundario',
        cursos: [],
        // Tarjeta simple: son cuatro puertas de entrada institucionales, no cursos
        // concretos. No tienen duración ni modalidad únicas (cada sede varía), así
        // que se muestran solo con nombre, descripción y link.
        simple: true
    }
};

export async function cargarOfertas() {
    try {
        const respuesta = await fetch('/data/data.json');
        if (!respuesta.ok) throw new Error('No se pudo cargar data.json');
        const data = await respuesta.json();

        // Tolerante a fallas a proposito: es una mejora del enlazado interno,
        // no un dato del que dependa la grilla.
        try {
            const mapa = await fetch('/data/enlaces-ben.json');
            if (mapa.ok) Object.assign(enlacesBEN, await mapa.json());
        } catch (e) {
            console.warn('Sin mapa de enlaces internos:', e);
        }

        // Sectores de aplicación (lista cerrada + mapa por carrera). Tolerante a
        // fallas: sin esto, la grilla funciona igual y el filtro de sector
        // simplemente no aparece.
        try {
            const [respuestaSectores, respuestaMapa] = await Promise.all([
                fetch('/data/sectores.json'),
                fetch('/data/sectores-carreras.json')
            ]);
            if (respuestaSectores.ok) {
                const datos = await respuestaSectores.json();
                (datos.sectores || []).forEach(s => SECTORES.push({ id: s.id, nombre: s.nombre }));
            }
            if (respuestaMapa.ok) Object.assign(SECTORES_CARRERAS, (await respuestaMapa.json()).carreras || {});
        } catch (e) {
            console.warn('Sin lista de sectores ni mapa por carrera:', e);
        }

        (data.instituciones || []).forEach(institucion => {
            (institucion.carreras || []).forEach(carrera => ofertas.push(crearOferta(carrera, institucion)));
        });
        // Las plataformas van por separado: son su propia sección, no carreras sueltas.
        (data.plataformas || []).forEach(plataforma => plataformas.push(crearPlataforma(plataforma)));
        // Ídem los catálogos aparte: cada uno lee su propia clave de data.json.
        Object.values(catalogosAparte).forEach(catalogo => {
            (data[catalogo.clave] || []).forEach(institucion => {
                (institucion.carreras || []).forEach(carrera =>
                    catalogo.cursos.push(crearCursoAparte(carrera, institucion)));
            });
        });
        // Ids de sector que ya no existen en la lista cerrada se descartan (un
        // link viejo puede traer cualquier cosa). Los chips se pintan recién
        // ahora porque dependen de sectores.json.
        const idsValidos = new Set(SECTORES.map(s => s.id));
        estado.sectores = estado.sectores.filter(id => idsValidos.has(id));
        renderizarFiltroSectores();
        actualizarVista();
    } catch (error) {
        console.error(error);
        document.getElementById('cardContainer').innerHTML = '<p class="empty-state">No se pudieron cargar las ofertas. Probá abrir la página con Live Server.</p>';
    }
}
function crearOferta(carrera, institucion) {
    const nombre = limpiarTexto(carrera.nombre_carrera || 'Carrera sin nombre');
    const modalidad = carrera.modalidad || 'Presencial';
    const gestion = inferirGestion(institucion);
    return {
        nombre, categoria: limpiarTexto(carrera.categoria || 'General'), duracion: limpiarTexto(carrera.duracion || 'No especificada'),
        modalidad, facultad: limpiarTexto(carrera.facultad || ''), link: carrera.link_oficial || '',
        institucion: limpiarTexto(institucion.nombre || 'Institución'), gestion, tipoInstitucion: inferirTipoInstitucion(institucion),
        departamento: limpiarTexto(institucion.departamento || ''),
        esPlataforma: false,
        formacion: getFormacion(carrera), area: getArea({ nombre_carrera: nombre }),
        duracionAnios: obtenerDuracionEnAnios(carrera.duracion), modalidades: obtenerModalidades(modalidad),
        // Plan de estudios y su fuente oficial. Son la MISMA referencia que ya
        // vive en data.json (no se copia nada): el comparador de Mi lista los
        // muestra cuando la institución cargó el plan.
        plan_estudio: carrera.plan_estudio || null,
        plan_fuente: carrera.plan_fuente || '',
        // Sectores de aplicación laboral de la carrera (contenido generado por
        // IA). Vacío si esa carrera todavía no tiene entrada: el filtro de
        // sector simplemente la deja afuera cuando hay uno activo.
        sectores: sectoresDeCarrera(nombre),
        _clave: `institucion:${limpiarTexto(institucion.nombre || '')}:${nombre}`
    };
}

// Sectores de una carrera por nombre normalizado. El mapa que escribe el
// generador ya incluye las claves fusionadas, así que no hace falta resolver
// alias acá.
function sectoresDeCarrera(nombre) {
    return SECTORES_CARRERAS[normalizarTexto(nombre)] || [];
}

// Chips del filtro "Sector de aplicación" en el panel: "Todos" + un chip por
// sector de la lista cerrada, en orden alfabético (con 25 nombres largos, el
// orden curado del JSON era difícil de recorrer). Se inyectan acá porque
// index.html no puede hardcodear una lista que vive en data/sectores.json.
function renderizarFiltroSectores() {
    const contenedor = document.getElementById('sectorOptions');
    if (!contenedor || !SECTORES.length) return;
    const ordenados = [...SECTORES].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    contenedor.innerHTML = '<button class="filter-option" data-filter="sectores" data-value="todos" type="button">Todos</button>'
        + ordenados.map(s => `<button class="filter-option" data-filter="sectores" data-value="${escaparHTML(s.id)}" type="button">${escaparHTML(s.nombre)}</button>`).join('');
    // El grupo vive oculto en index.html hasta que exista la lista real.
    const grupo = contenedor.closest('.filter-group');
    if (grupo) grupo.hidden = false;
}

function crearPlataforma(plataforma) {
    const nombre = limpiarTexto(plataforma.institucion || 'Plataforma online');
    // La descripción sale del campo "oferta" de data.json, que ya resume qué enseña.
    const resumen = limpiarTexto(plataforma.oferta || 'Formación online');
    const info = PLATAFORMAS_INFO[nombre] || {};
    return {
        nombre,
        resumen,
        modalidad: limpiarTexto(plataforma.modalidad || 'Online'),
        duracion: limpiarTexto(plataforma.duracion || 'Variable'),
        url: info.url || '',
        logo: info.logo || '',
        // Texto sobre el que busca el buscador de arriba.
        busqueda: normalizarTexto(`${nombre} ${resumen}`),
        _clave: `plataforma:${nombre}`
    };
}

// Modelo de una formación de los catálogos aparte. Se queda con la "categoria"
// que ya trae el dato en vez de recalcular el tipo de formación.
function crearCursoAparte(carrera, institucion) {
    const nombre = limpiarTexto(carrera.nombre_carrera || 'Formación sin nombre');
    const nombreInstitucion = limpiarTexto(institucion.nombre || 'Institución');
    const categoria = limpiarTexto(carrera.categoria || 'Formación');
    // Opcionales: solo los traen los catálogos de tarjeta simple (ver `simple`).
    const descripcion = limpiarTexto(carrera.descripcion || '');
    const nombreCompleto = limpiarTexto(carrera.nombre_completo || '');
    // Sede/dirección del dato institucional. "A confirmar" no es una dirección:
    // se descarta para no pintar una fila inútil en la tarjeta.
    const direccionCruda = limpiarTexto((institucion.contacto && institucion.contacto.direccion) || '');
    const sede = (/^a confirmar/i.test(direccionCruda) || /^online$/i.test(direccionCruda)) ? '' : direccionCruda;
    return {
        nombre,
        nombreCompleto,
        descripcion,
        institucion: nombreInstitucion,
        categoria,
        modalidad: limpiarTexto(carrera.modalidad || 'A confirmar'),
        duracion: limpiarTexto(carrera.duracion || 'A confirmar'),
        provincia: limpiarTexto(institucion.provincia || ''),
        sede,
        link: carrera.link_oficial || '',
        busqueda: normalizarTexto(`${nombre} ${nombreCompleto} ${descripcion} ${nombreInstitucion} ${categoria} ${sede}`),
        _clave: `aparte:${nombreInstitucion}:${nombre}`
    };
}

export function buscarPorClave(clave) {
    return ofertas.find(o => o._clave === clave)
        || plataformas.find(p => p._clave === clave)
        || Object.values(catalogosAparte).flatMap(c => c.cursos).find(c => c._clave === clave)
        || null;
}

export const ETIQUETAS_FUENTE = {
    'formal': 'Educación formal',
    'oficios-tecnicos': 'Oficio técnico',
    'formaciones-alternativas': 'Formación alternativa'
};

