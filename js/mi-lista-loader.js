// ============================================================================
// Mi lista como ventana flotante en las páginas estáticas
// ============================================================================
// Las fichas no cargan la app: este loader (clásico y chico) intercepta el
// click de "Ver Mi lista" y del aviso del corazón, trae el módulo bajo demanda
// y abre el overlay sin salir de la página. Si el import falla, deja navegar
// al href (/?lista=1) como red de contención.
(() => {
    const propio = document.currentScript;
    let sello = '';
    try { sello = new URL(propio.src).searchParams.get('v') || ''; } catch (e) { /* sin sello */ }

    document.addEventListener('click', evento => {
        const abridor = evento.target.closest && evento.target.closest('[data-abrir-mi-lista]');
        if (!abridor || window.__benMiLista) return;
        evento.preventDefault();
        import(`/js/mi-lista.js${sello ? `?v=${sello}` : ''}`)
            .then(modulo => modulo.abrirMiLista())
            .catch(() => { window.location.href = abridor.getAttribute('href') || '/?lista=1'; });
    });
})();
