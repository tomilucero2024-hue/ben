// ============================================================================
// Posición del scroll al volver con Atrás
// ============================================================================
// La app renderiza las tarjetas recién cuando baja data.json: el navegador
// intenta restaurar el scroll con la página todavía corta y termina arriba de
// todo. Acá se guarda la posición de cada página al salir y se repone una sola
// vez cuando el contenido está listo: en la app espera el evento
// 'ben:datos-listos' (primer render con datos); en las estáticas, el HTML ya
// viene armado y alcanza con el DOM listo.
(() => {
    const CLAVE = 'ben-scroll';

    // Un mapa por URL (no un solo valor): al ir y volver entre páginas, cada una
    // conserva su propia posición. sessionStorage es por pestaña.
    function leerMapa() {
        try { return JSON.parse(sessionStorage.getItem(CLAVE) || '{}') || {}; } catch (e) { return {}; }
    }

    function guardar() {
        try {
            const mapa = leerMapa();
            mapa[location.href] = Math.round(window.scrollY);
            sessionStorage.setItem(CLAVE, JSON.stringify(mapa));
        } catch (e) { /* modo privado */ }
    }

    window.addEventListener('pagehide', guardar);

    let hecho = false;
    function restaurar() {
        if (hecho) return;
        hecho = true;
        const y = leerMapa()[location.href];
        if (!(y > 0)) return;
        requestAnimationFrame(() => window.scrollTo(0, y));
    }

    // La app avisa cuando terminó el primer render con datos. El elemento
    // #cardContainer solo existe ahí: las estáticas restauran al DOM listo.
    const esApp = Boolean(document.getElementById('cardContainer'));
    if (esApp) {
        document.addEventListener('ben:datos-listos', restaurar, { once: true });
    } else {
        const alListo = () => setTimeout(restaurar, 0);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alListo, { once: true });
        else alListo();
    }
})();
