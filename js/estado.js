// ==========================================
// Estado de filtros/busqueda, con su persistencia en la URL.
// ==========================================

import { normalizarTexto } from './util.js';

export const estado = {
    seccion: 'formal',
    texto: '', formacion: 'todos', institucion: 'todos', departamento: 'todos', gestion: 'todos',
    modalidad: 'todos', costo: 'todos', duracion: 'todos', area: 'todos',
    duracionMin: null, duracionMax: null, orden: 'default',
    // Vista de entrada del catálogo formal: TODAS LAS CARRERAS (grilla con
    // filtros) por defecto; alternativas: instituciones (agrupadas por tipo)
    // o el drilldown por áreas.
    vista: 'carreras',
    // Dentro de la vista de instituciones, el tipo abierto (o null = grupos).
    tipoInstitucion: null,
    // Resultados del test vocacional, cuando hay: { carreras, rankings, total }.
    // Mientras esté seteado la grilla muestra las recomendaciones (ordenadas por
    // compatibilidad) en vez del catálogo entero, y los filtros se aplican
    // SOBRE ellas en lugar de descartarlas.
    recomendacion: null
};

const SECCIONES_PERMITIDAS = new Set(['formal', 'plataformas', 'formaciones-alternativas', 'oficios-tecnicos', 'secundario']);
const VISTAS_PERMITIDAS = new Set(['areas', 'carreras', 'instituciones']);
const GESTIONES_PERMITIDAS = new Set(['todos', 'pública', 'privada']);
const COSTOS_PERMITIDOS = new Set(['todos', 'gratuito', 'arancelado']);
const MODALIDADES_PERMITIDAS = new Set(['todos', 'presencial', 'online', 'híbrida']);
const ORDENES_PERMITIDOS = new Set(['default', 'relevancia', 'nombre-az', 'nombre-za', 'publica-primero', 'privada-primero']);
const FORMACIONES_PERMITIDAS = new Set(['todos', 'grado', 'tecnicaturas', 'profesorados', 'cursos']);
const INSTITUCIONES_PERMITIDAS = new Set(['todos', 'universidades', 'ies', 'centros']);
// Los 18 departamentos de Mendoza. La opción 'A distancia' cubre las
// instituciones sin sede fija en la provincia (hoy: UNDEF).
const DEPARTAMENTOS_PERMITIDOS = new Set(['todos', 'A distancia', 'Capital', 'Godoy Cruz', 'Guaymallén', 'Las Heras', 'Lavalle', 'Luján de Cuyo', 'Maipú', 'San Martín', 'Junín', 'La Paz', 'Rivadavia', 'Santa Rosa', 'San Carlos', 'San Rafael', 'General Alvear', 'Tunuyán', 'Tupungato', 'Malargüe']);
const DURACIONES_PERMITIDAS = new Set(['todos', 'corta', 'hasta-1', '2-3', '4-mas', 'sin-definir']);
// Las mismas áreas que devuelve getArea() y que ofrece el panel de filtros. Era
// el único filtro que se tomaba de la URL sin validar: con ?area=cualquier-cosa
// el chip "Todas las áreas" quedaba marcado pero la grilla salía vacía, sin que
// nada en pantalla explicara por qué.
const AREAS_PERMITIDAS = new Set(['todos', 'Tecnología', 'Ingeniería', 'Salud', 'Negocios', 'Diseño', 'Educación', 'Ciencias sociales', 'Ambiente', 'Turismo', 'Gastronomía', 'Oficios', 'Arte', 'Idiomas']);

// Paginación de resultados: mostramos de a tandas para no pintar las ~600
// tarjetas de una. El botón "Cargar más" revela la siguiente tanda.
export const LIMITE_PAGINA = 24;
export function sincronizarURL() {
    if (typeof history === 'undefined' || typeof location === 'undefined') return;
    const p = new URLSearchParams();
    const seccion = estado.seccion;
    if (seccion !== 'formal') p.set('seccion', seccion);
    // La vista por defecto (todas las carreras) no se escribe en la URL: la
    // portada queda como "/" para que la bienvenida y los links limpios sigan
    // funcionando igual que siempre. "Por área" se escribe como vista=area
    // (singular, como pide la URL cuidada del sitio).
    if (estado.vista && estado.vista !== 'carreras') p.set('vista', estado.vista === 'areas' ? 'area' : estado.vista);
    const searchInput = typeof document !== 'undefined' ? document.getElementById('searchInput') : null;
    const q = searchInput ? searchInput.value.trim() : '';
    if (q) p.set('q', q);
    ['formacion', 'institucion', 'departamento', 'gestion', 'modalidad', 'costo', 'duracion', 'area', 'orden']
        .forEach(campo => { if (estado[campo] !== 'todos' && estado[campo] !== 'default') p.set(campo, estado[campo]); });
    if (estado.duracionMin !== null) p.set('dmin', estado.duracionMin);
    if (estado.duracionMax !== null) p.set('dmax', estado.duracionMax);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

export function restaurarDesdeURL() {
    if (typeof location === 'undefined') return;
    const p = new URLSearchParams(location.search);
    if (p.has('seccion')) {
        const s = p.get('seccion');
        if (SECCIONES_PERMITIDAS.has(s)) estado.seccion = s;
    }
    // El valor interno de la vista es 'areas' (plural, nombre del grupo); la
    // URL usa 'area' por legibilidad. Se aceptan las dos: links compartidos
    // viejos pueden traer 'areas'.
    if (p.has('vista')) {
        const v = p.get('vista') === 'area' ? 'areas' : p.get('vista');
        if (VISTAS_PERMITIDAS.has(v)) estado.vista = v;
    }
    if (p.has('q')) {
        const q = p.get('q');
        const input = document.getElementById('searchInput');
        if (input) input.value = q;
        estado.texto = normalizarTexto(q);
    }
    if (p.has('formacion') && FORMACIONES_PERMITIDAS.has(p.get('formacion'))) estado.formacion = p.get('formacion');
    if (p.has('institucion') && INSTITUCIONES_PERMITIDAS.has(p.get('institucion'))) estado.institucion = p.get('institucion');
    if (p.has('departamento') && DEPARTAMENTOS_PERMITIDOS.has(p.get('departamento'))) estado.departamento = p.get('departamento');
    if (p.has('gestion') && GESTIONES_PERMITIDAS.has(p.get('gestion'))) estado.gestion = p.get('gestion');
    if (p.has('modalidad') && MODALIDADES_PERMITIDAS.has(p.get('modalidad'))) estado.modalidad = p.get('modalidad');
    if (p.has('costo') && COSTOS_PERMITIDOS.has(p.get('costo'))) estado.costo = p.get('costo');
    if (p.has('duracion') && DURACIONES_PERMITIDAS.has(p.get('duracion'))) estado.duracion = p.get('duracion');
    if (p.has('area') && AREAS_PERMITIDAS.has(p.get('area'))) estado.area = p.get('area');
    if (p.has('orden') && ORDENES_PERMITIDOS.has(p.get('orden'))) estado.orden = p.get('orden');

    if (p.has('dmin')) {
        const minVal = parseFloat(p.get('dmin'));
        if (Number.isFinite(minVal) && minVal >= 0) estado.duracionMin = minVal;
    }
    if (p.has('dmax')) {
        const maxVal = parseFloat(p.get('dmax'));
        if (Number.isFinite(maxVal) && maxVal >= 0) estado.duracionMax = maxVal;
    }
    if (estado.duracionMin !== null && estado.duracionMax !== null && estado.duracionMin > estado.duracionMax) {
        [estado.duracionMin, estado.duracionMax] = [estado.duracionMax, estado.duracionMin];
    }

    const sort = document.getElementById('sortSelect');
    if (sort) sort.value = estado.orden;
    const dMin = document.getElementById('durationMin');
    const dMax = document.getElementById('durationMax');
    if (dMin && estado.duracionMin !== null) dMin.value = estado.duracionMin;
    if (dMax && estado.duracionMax !== null) dMax.value = estado.duracionMax;
    sincronizarTabs();
}

function sincronizarTabs() {
    document.querySelectorAll('.section-tab').forEach(boton => {
        const activa = boton.dataset.seccion === estado.seccion;
        boton.classList.toggle('is-active', activa);
        boton.setAttribute('aria-pressed', String(activa));
    });
}

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

