// ==========================================
// Estado de filtros/busqueda, favoritos y comparador, con su persistencia en
// localStorage y en la URL.
// ==========================================

import { buscarPorClave, ofertas } from './datos.js';
import { mostrarResultados } from './render.js';
import { normalizarTexto } from './util.js';

export const estado = {
    seccion: 'formal',
    texto: '', formacion: 'todos', institucion: 'todos', gestion: 'todos',
    modalidad: 'todos', costo: 'todos', duracion: 'todos', area: 'todos',
    duracionMin: null, duracionMax: null, orden: 'default', favoritos: false,
    // Resultados del test vocacional, cuando hay: { carreras, rankings, total }.
    // Mientras esté seteado la grilla muestra las recomendaciones (ordenadas por
    // compatibilidad) en vez del catálogo entero, y los filtros se aplican
    // SOBRE ellas en lugar de descartarlas.
    recomendacion: null
};

// Favoritos y comparador, persistidos en localStorage (si el navegador lo permite).
const FAVORITOS_KEY = 'ben-favoritos';
export const COMPARAR_KEY = 'ben-comparar';
function leerGuardado(clave) { try { return JSON.parse(localStorage.getItem(clave) || '[]'); } catch (e) { return []; } }
export function escribirGuardado(clave, valor) { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {} }
export const favoritos = new Set(leerGuardado(FAVORITOS_KEY));
export const comparador = new Set(leerGuardado(COMPARAR_KEY));

// Paginación de resultados: mostramos de a tandas para no pintar las ~600
// tarjetas de una. El botón "Cargar más" revela la siguiente tanda.
export const LIMITE_PAGINA = 24;
export function sincronizarURL() {
    const p = new URLSearchParams();
    const seccion = estado.seccion;
    if (seccion !== 'formal') p.set('seccion', seccion);
    const q = document.getElementById('searchInput').value.trim();
    if (q) p.set('q', q);
    ['formacion', 'institucion', 'gestion', 'modalidad', 'costo', 'duracion', 'area', 'orden']
        .forEach(campo => { if (estado[campo] !== 'todos' && estado[campo] !== 'default') p.set(campo, estado[campo]); });
    if (estado.duracionMin !== null) p.set('dmin', estado.duracionMin);
    if (estado.duracionMax !== null) p.set('dmax', estado.duracionMax);
    if (estado.favoritos) p.set('favoritos', '1');
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

export function restaurarDesdeURL() {
    const p = new URLSearchParams(location.search);
    if (p.has('seccion')) estado.seccion = p.get('seccion');
    if (p.has('q')) { const q = p.get('q'); document.getElementById('searchInput').value = q; estado.texto = normalizarTexto(q); }
    ['formacion', 'institucion', 'gestion', 'modalidad', 'costo', 'duracion', 'area', 'orden']
        .forEach(campo => { if (p.has(campo)) estado[campo] = p.get(campo); });
    if (p.has('dmin')) estado.duracionMin = parseFloat(p.get('dmin'));
    if (p.has('dmax')) estado.duracionMax = parseFloat(p.get('dmax'));
    if (p.has('favoritos')) estado.favoritos = p.get('favoritos') === '1' || p.get('favoritos') === 'true';
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
function clavesDeCarrera(clave) {
    if (buscarPorClave(clave)) return [clave];
    const carrera = (Orientador.perfilesCarreras || []).find(c => c.clave === clave);
    if (!carrera) return [];
    const nombreNorm = normalizarTexto(carrera.nombre);
    return ofertas.filter(o => normalizarTexto(o.nombre) === nombreNorm).map(o => o._clave);
}

export function estaEnFavoritos(clave) {
    if (favoritos.has(clave)) return true;
    const claves = clavesDeCarrera(clave);
    return claves.length > 0 && claves.every(c => favoritos.has(c));
}

export function toggleFavorito(clave) {
    const claves = clavesDeCarrera(clave);
    if (!claves.length) return;
    // Si la carrera ya está guardada completa se saca entera; si no, se guarda
    // con todas sus instituciones (para que "Solo favoritos" la encuentre).
    const completo = claves.every(c => favoritos.has(c));
    claves.forEach(c => { if (completo) favoritos.delete(c); else favoritos.add(c); });
    escribirGuardado(FAVORITOS_KEY, [...favoritos]);
    // Se actualizan todos los botones de esa clave (grilla y tarjetas del chat),
    // no solo el primero que encuentre.
    document.querySelectorAll(`.btn-favorito[data-clave="${CSS.escape(clave)}"]`).forEach(boton => {
        boton.classList.toggle('is-active', !completo);
        boton.setAttribute('aria-pressed', String(!completo));
    });
    if (estado.favoritos) mostrarResultados();
}

export function enComparador(clave) {
    if (comparador.has(clave)) return true;
    const claves = clavesDeCarrera(clave);
    return claves.length > 0 && claves.every(c => comparador.has(c));
}
function cantidadComparador() { return comparador.size; }

export function toggleComparar(clave) {
    const claves = clavesDeCarrera(clave);
    if (!claves.length) return;
    const completo = claves.every(c => comparador.has(c));
    claves.forEach(c => { if (completo) comparador.delete(c); else comparador.add(c); });
    escribirGuardado(COMPARAR_KEY, [...comparador]);
    // Se actualizan todos los botones de esa clave (grilla y tarjetas del chat).
    document.querySelectorAll(`.btn-comparar[data-clave="${CSS.escape(clave)}"]`).forEach(boton => {
        boton.classList.toggle('is-active', !completo);
        boton.setAttribute('aria-pressed', String(!completo));
    });
    actualizarBarraComparar();
}

export function actualizarBarraComparar() {
    const barra = document.getElementById('compararBar');
    if (!barra) return;
    const cantidad = comparador.size;
    barra.hidden = cantidad === 0;
    const contador = document.getElementById('compararCount');
    if (contador) contador.textContent = String(cantidad);
}

