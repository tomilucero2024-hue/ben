// ==========================================
// Filtrado, busqueda difusa y ordenamiento del catalogo formal.
// ==========================================

import { ofertas } from './datos.js';
import { estado, favoritos } from './estado.js';
import { distanciaLevenshtein, getGrupoDuracion, normalizarTexto } from './util.js';

function puntuacionRelacion(oferta) {
    let score = 0;
    const texto = estado.texto;
    if (texto) {
        const hay = normalizarTexto(`${oferta.nombre} ${oferta.institucion} ${oferta.facultad} ${oferta.area}`);
        const palabras = texto.split(/\s+/).filter(Boolean);
        if (palabras.length) {
            const presentes = palabras.filter(p => hay.includes(p)).length;
            score += (presentes / palabras.length) * 100;
        }
    }
    if (estado.area !== 'todos' && oferta.area === estado.area) score += 30;
    if (estado.formacion !== 'todos' && oferta.formacion === estado.formacion) score += 20;
    if (estado.gestion !== 'todos' && oferta.gestion === estado.gestion) score += 15;
    if (estado.modalidad !== 'todos' && oferta.modalidades.includes(estado.modalidad)) score += 15;
    if (estado.institucion !== 'todos' && oferta.tipoInstitucion === estado.institucion) score += 15;
    if (estado.costo !== 'todos' && (oferta.costo || (oferta.gestion === 'pública' ? 'gratuito' : 'arancelado')) === estado.costo) score += 10;
    if (estado.duracion !== 'todos') {
        const grupo = getGrupoDuracion(oferta.duracionAnios);
        if (grupo === estado.duracion) score += 10;
    }
    return score;
}

export function obtenerRelacionadas(limite = 6) {
    const puntuadas = ofertas
        .map(oferta => ({ oferta, score: puntuacionRelacion(oferta) }))
        .sort((a, b) => b.score - a.score);
    // Si hay algo de texto o filtros, priorizamos las que sumaron puntos; si todo
    // dio 0 (filtros imposibles entre sí), igual devolvemos las primeras para no
    // dejar la pantalla vacía.
    const conPuntos = puntuadas.filter(p => p.score > 0);
    const elegidas = (conPuntos.length ? conPuntos : puntuadas).slice(0, limite);
    return elegidas.map(p => p.oferta);
}

// Si el usuario busca texto dentro de Educación Formal, las plataformas que
// coincidan aparecen igual, en su propio bloque y con el color de su sección.
const CONECTORES = new Set(['de', 'del', 'en', 'la', 'el', 'los', 'las', 'y', 'e', 'o', 'u', 'a', 'para', 'con']);

function puntuarPar(palabra, token) {
    if (!token || !palabra) return 0;
    if (palabra === token) return 100;
    // Prefijo: el usuario escribe el comienzo de la palabra (ej: 'ciber' -> 'ciberdefensa')
    if (palabra.startsWith(token)) return 85;
    // Raíz común: el catálogo tiene la raíz y el usuario escribió un derivado (ej: 'abogac' -> 'abogacia')
    if (palabra.length >= 4 && token.startsWith(palabra)) return 80;
    // Subcadena: el token está dentro de una palabra compuesta (ej: 'defensa' en 'ciberdefensa')
    if (token.length >= 3 && palabra.includes(token)) return 65;
    // Distancia difusa: solo entre palabras de longitud similar para corregir tipeos menores
    if (Math.min(palabra.length, token.length) >= 3 && Math.abs(palabra.length - token.length) <= 3) {
        const d = distanciaLevenshtein(palabra, token);
        const maxLen = Math.max(palabra.length, token.length, 1);
        const tolerancia = Math.max(1, Math.floor(maxLen * 0.28));
        if (d <= tolerancia) return Math.round(45 * (1 - d / (tolerancia + 1)));
    }
    return 0;
}

// Score total de una oferta frente a la búsqueda actual (0 si no hay texto).
function puntuacionBusqueda(oferta) {
    const texto = estado.texto;
    if (!texto) return 0;
    const hay = normalizarTexto(`${oferta.nombre} ${oferta.institucion} ${oferta.facultad} ${oferta.area} ${oferta.categoria}`);
    const palabras = hay.split(/\s+/).filter(Boolean);
    const tokens = texto.split(/\s+/).filter(Boolean);
    let score = 0;
    for (const token of tokens) {
        if (CONECTORES.has(token) && tokens.length > 1) continue;
        let mejor = 0;
        if (token.length >= 2) {
            for (const pal of palabras) mejor = Math.max(mejor, puntuarPar(pal, token));
        } else {
            mejor = palabras.includes(token) ? 100 : 0;
        }
        if (hay.includes(token)) mejor = Math.max(mejor, 70);
        score += mejor;
    }
    // Bonificación si el nombre de la carrera contiene exactamente la frase buscada
    if (normalizarTexto(oferta.nombre).includes(texto)) score += 150;
    return score;
}

// Filtro de texto: para una búsqueda multi-palabra (ej: "licenciatura ciberdefensa" o "undef logistica"),
// cada término significativo debe estar presente en los datos de la oferta.
function coincideTexto(oferta) {
    const texto = estado.texto;
    if (!texto) return true;
    const hay = normalizarTexto(`${oferta.nombre} ${oferta.institucion} ${oferta.facultad} ${oferta.area} ${oferta.categoria}`);
    const palabras = hay.split(/\s+/).filter(Boolean);
    const tokens = texto.split(/\s+/).filter(Boolean);
    const significativos = tokens.filter(t => !CONECTORES.has(t));
    const tokensAValidar = significativos.length ? significativos : tokens;

    return tokensAValidar.every(token => {
        if (token.length < 2) return palabras.includes(token);
        return palabras.some(pal => puntuarPar(pal, token) > 0);
    });
}

// Predicado unico de "esta oferta pasa los filtros activos". Vive aparte de
// filtrarYOrdenar porque tambien lo usan las recomendaciones del Copiloto, que
// filtran el mismo catalogo pero conservando su propio orden por compatibilidad.
export function cumpleFiltros(oferta) {
    const tieneRango = estado.duracionMin !== null || estado.duracionMax !== null;
    const enRango = !tieneRango ? true : oferta.duracionAnios !== null
        && (estado.duracionMin === null || oferta.duracionAnios >= estado.duracionMin)
        && (estado.duracionMax === null || oferta.duracionAnios <= estado.duracionMax);
    return coincideTexto(oferta)
        && (estado.formacion === 'todos' || oferta.formacion === estado.formacion)
        && (estado.institucion === 'todos' || oferta.tipoInstitucion === estado.institucion)
        && (estado.gestion === 'todos' || oferta.gestion === estado.gestion)
        && (estado.modalidad === 'todos' || oferta.modalidades.includes(estado.modalidad))
        && (estado.costo === 'todos' || (oferta.costo || (oferta.gestion === 'pública' ? 'gratuito' : 'arancelado')) === estado.costo)
        && (estado.duracion === 'todos' || getGrupoDuracion(oferta.duracionAnios) === estado.duracion)
        && (estado.area === 'todos' || oferta.area === estado.area)
        && (estado.favoritos === false || favoritos.has(oferta._clave))
        && enRango;
}

// Filtros que solo tienen sentido sobre una oferta formal (una carrera dictada
// por una institucion concreta). Una carrera que solo existe en los catalogos
// aparte no tiene gestion, costo ni duracion en años: si alguno de estos esta
// activo, simplemente no aplica.
export const FILTROS_SOLO_FORMALES = ['institucion', 'gestion', 'modalidad', 'costo', 'duracion'];

export function filtrarYOrdenar() {
    const resultados = ofertas.filter(cumpleFiltros);

    // Con búsqueda activa y orden por defecto, rankeamos por relevancia.
    const usarRelevancia = estado.orden === 'relevancia' || (estado.texto && estado.orden === 'default');
    if (usarRelevancia) {
        return resultados
            .map(o => ({ o, s: puntuacionBusqueda(o) }))
            .sort((a, b) => b.s - a.s)
            .map(x => x.o);
    }
    const comparadores = {
        'nombre-az': (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
        'nombre-za': (a, b) => b.nombre.localeCompare(a.nombre, 'es'),
        'publica-primero': (a, b) => Number(b.gestion === 'pública') - Number(a.gestion === 'pública'),
        'privada-primero': (a, b) => Number(b.gestion === 'privada') - Number(a.gestion === 'privada')
    };
    return comparadores[estado.orden] ? resultados.sort(comparadores[estado.orden]) : resultados;
}

// Resuelve una clave a las claves reales de oferta. Si la clave ya pertenece a
// una oferta/plataforma/catálogo aparte, es única. Si es una carrera del
// orientador (p.ej. "abogacia"), devuelve todas las ofertas que la dictan: así
// favorito y comparar guardan lo mismo que filtra y muestra el catálogo.
