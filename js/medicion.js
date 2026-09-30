// ==========================================
// Aviso de eventos de uso (analítica).
// ==========================================
//
// Un módulo no debería saber que existe Google Analytics: anuncia lo que pasó
// con un CustomEvent y quien escucha decide si se mide, con qué nombre y a
// dónde se manda (hoy, js/analitica.js → GA4). El día que se sume otra
// herramienta, o que la analítica se apague, este archivo no se toca.
//
// El evento es UNO solo, 'ben:evento', con el nombre del evento GA4 en `tipo`:
//     registrarEvento('search', { search_term: 'enfermería', seccion: 'formal' });
//
// Por qué un CustomEvent y no window.benTrack() directamente: los scripts
// clásicos (favoritos.js) y los <script> inline de las páginas generadas
// también necesitan avisar, y no pueden importar nada. Con un evento en
// window, ninguno de los dos caminos depende de que otro archivo se haya
// cargado: si js/analitica.js no está (por ejemplo, sin conexión y sin copia
// en caché), el aviso se pierde y no se rompe nada.
//
// ⚠️ No confundir con js/vocacional/eventos.js, que es otra cosa: el registro
// de interés post-test que alimenta la Fase B del orientador
// (generar-perfiles-uso.js) y que se guarda en localStorage.

const NOMBRE_EVENTO = 'ben:evento';

export function registrarEvento(tipo, datos) {
    if (typeof window === 'undefined' || !tipo) return;
    try {
        window.dispatchEvent(new CustomEvent(NOMBRE_EVENTO, { detail: { tipo, ...(datos || {}) } }));
    } catch (e) {
        // Medir nunca puede romper la app: si el navegador no construye el
        // evento o algún parámetro no es clonable, se sigue igual con lo que sea.
    }
}
