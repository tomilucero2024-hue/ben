// ==========================================
// Carga de data.json y construccion de las estructuras que consume la vista:
// ofertas, plataformas y los catalogos aparte.
// ==========================================

import { actualizarVista } from './render.js';
import { esCarreraArancelada, getArea, getFormacion, inferirGestion, inferirTipoInstitucion, limpiarTexto, normalizarTexto, obtenerDuracionEnAnios, obtenerModalidades } from './util.js';

// Carreras de instituciones formales (universidades, IES, terciarios).
export const ofertas = [];
// Diccionario nombre-normalizado -> slug que escribe generar-paginas.js. Es lo
// que le permite a cada tarjeta enlazar la pagina propia de esa carrera en vez
// de mandar a la persona (y al credito que reparte Google) derecho afuera del
// sitio. Si el archivo falta, las tarjetas siguen andando sin ese enlace.
export const enlacesBEN = { carreras: {}, instituciones: {} };
// Plataformas online: una entrada por plataforma, no por curso.
export const plataformas = [];

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
    'Enlace 2.0 (Gobierno de Mendoza)': { url: 'https://www.mendoza.gov.ar/economia/entornodecapacitacion-enlace/', logo: '' }
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
        // que se muestran solo con nombre, descripción y link, y sin favorito ni
        // comparar: no hay nada que comparar entre "CENS" y "CEPAS" en una tabla.
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
        actualizarVista();
    } catch (error) {
        console.error(error);
        document.getElementById('cardContainer').innerHTML = '<p class="empty-state">No se pudieron cargar las ofertas. Probá abrir la página con Live Server.</p>';
    }
}
// Inicializar Orientador con perfiles de carreras y ofertas
export async function inicializarOrientador() {
    try {
        await Orientador.cargarPerfilesCarreras();
        Orientador.setOfertasIndex(ofertas);
        console.log('Orientador inicializado correctamente');
    } catch (e) {
        console.warn('No se pudo inicializar Orientador:', e);
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
        esPlataforma: false,
        formacion: getFormacion(carrera), area: getArea({ nombre_carrera: nombre }),
        duracionAnios: obtenerDuracionEnAnios(carrera.duracion), modalidades: obtenerModalidades(modalidad),
        costo: esCarreraArancelada(institucion, nombre) ? 'arancelado' : (gestion === 'pública' ? 'gratuito' : 'arancelado'),
        _clave: `institucion:${limpiarTexto(institucion.nombre || '')}:${nombre}`
    };
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
    return {
        nombre,
        nombreCompleto,
        descripcion,
        institucion: nombreInstitucion,
        categoria,
        modalidad: limpiarTexto(carrera.modalidad || 'A confirmar'),
        duracion: limpiarTexto(carrera.duracion || 'A confirmar'),
        provincia: limpiarTexto(institucion.provincia || ''),
        link: carrera.link_oficial || '',
        busqueda: normalizarTexto(`${nombre} ${nombreCompleto} ${descripcion} ${nombreInstitucion} ${categoria}`),
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

