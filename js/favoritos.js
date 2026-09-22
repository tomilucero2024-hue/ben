// ============================================================================
// ❤️ FAVORITOS ("Me interesa") + MI LISTA
// ============================================================================
//
// Guarda las carreras, cursos y oficios que el estudiante marca con el corazón,
// para después verlos en "Mi lista" y compararlos de a tres (comparador en
// js/mi-lista.js).
//
// Por qué es un script clásico (window.Favoritos) y no un módulo ES:
//   - Lo usan la app (módulos ES) y las páginas estáticas de carrera
//     (/carrera/<slug>/), que no cargan ningún módulo. Mismo patrón que
//     motor.js y eventos.js.
//   - Se autoinstala: delega el click de cualquier [data-favorito] en TODO el
//     documento, así ni la app ni las páginas generadas tienen que cablear nada.
//
// Cómo se guarda (contrato de storage, compartido con las páginas estáticas):
//   localStorage['ben-favoritos'] = [ {clave, tipo, claveCarrera, nombre,
//     institucion, area, formacion, ficha, link, fecha}, ... ]
//   - "clave" identifica la ficha guardada. En la grilla formal es la oferta
//     puntual (institucion:<institución>:<carrera>): así se puede guardar la
//     misma carrera en dos instituciones y comparar dónde estudiarla.
//   - "claveCarrera" es el nombre normalizado de la carrera (sin institución) y
//     es lo que alimenta la Fase B del test (generar-perfiles-uso.js).
//   - El snapshot (nombre, institución, etc.) permite dibujar "Mi lista" sin
//     depender de data.json; al abrir el comparador se refresca contra el
//     catálogo real y, si una carrera ya no existe, se avisa.
//
// Si el estudiante hizo el test completo, marcar "Me interesa" también registra
// el evento de uso (Fase B) con su perfil, igual que el botón dentro del test.
// ============================================================================

(function () {
  const CLAVE = 'ben-favoritos';
  const CLAVE_PERFIL = 'ben-vocacional-perfil';
  // Tope defensivo: la lista es para comparar, no un archivo. 60 fichas son
  // muchísimas para una persona y dejan el localStorage lejos de su límite.
  const MAX = 60;

  const suscriptores = new Set();

  // --------------------------------------------------------------------------
  // LECTURA / ESCRITURA
  // --------------------------------------------------------------------------

  function leer() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      const lista = crudo ? JSON.parse(crudo) : [];
      if (!Array.isArray(lista)) return [];
      // Descarta entradas rotas (por ejemplo de una versión anterior del sitio)
      // en vez de romper todo el render más adelante.
      return lista.filter(f => f && typeof f === 'object' && f.clave && f.nombre);
    } catch (e) {
      return [];
    }
  }

  function guardar(lista) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch (e) {
      // Storage lleno o bloqueado: la navegación sigue, el favorito no se guarda.
    }
  }

  function notificar() {
    const lista = leer();
    suscriptores.forEach(fn => {
      try { fn(lista); } catch (e) { /* un suscriptor roto no frena a los demás */ }
    });
    try {
      window.dispatchEvent(new CustomEvent('ben:favoritos', { detail: { lista } }));
    } catch (e) { /* navegadores viejos sin CustomEvent: los suscriptores ya corrieron */ }
  }

  function suscribir(fn) {
    if (typeof fn !== 'function') return () => {};
    suscriptores.add(fn);
    fn(leer());
    return () => suscriptores.delete(fn);
  }

  // --------------------------------------------------------------------------
  // API DE LA LISTA
  // --------------------------------------------------------------------------

  function tiene(clave) {
    return leer().some(f => f.clave === clave);
  }

  function contar() {
    return leer().length;
  }

  function normalizarItem(item) {
    const clave = String(item.clave || '').trim();
    if (!clave) return null;
    return {
      clave,
      tipo: item.tipo || 'carrera',
      claveCarrera: item.claveCarrera || '',
      nombre: String(item.nombre || '').trim(),
      institucion: item.institucion || '',
      area: item.area || '',
      formacion: item.formacion || '',
      ficha: item.ficha || '',
      link: item.link || '',
      fecha: new Date().toISOString()
    };
  }

  // Agrega o saca según el estado actual. Devuelve 'agregado', 'quitado' o null
  // si el ítem no tenía clave.
  function toggle(item) {
    const ficha = normalizarItem(item);
    if (!ficha) return null;
    const lista = leer();
    const indice = lista.findIndex(f => f.clave === ficha.clave);
    let accion;
    if (indice === -1) {
      lista.unshift(ficha); // lo último guardado queda arriba en Mi lista
      if (lista.length > MAX) lista.length = MAX;
      accion = 'agregado';
    } else {
      lista.splice(indice, 1);
      accion = 'quitado';
    }
    guardar(lista);
    notificar();
    if (accion === 'agregado') registrarInteres(ficha);
    return accion;
  }

  function quitar(clave) {
    const lista = leer();
    const siguientes = lista.filter(f => f.clave !== clave);
    if (siguientes.length === lista.length) return false;
    guardar(siguientes);
    notificar();
    return true;
  }

  function vaciar() {
    if (!leer().length) return false;
    guardar([]);
    notificar();
    return true;
  }

  // --------------------------------------------------------------------------
  // FASE B: el "me interesa" también es una señal de uso
  // --------------------------------------------------------------------------

  // Sin test hecho no hay perfil que registrar (y no tiene sentido inventarlo).
  function perfilGuardado() {
    try {
      const crudo = localStorage.getItem(CLAVE_PERFIL);
      if (!crudo) return null;
      const perfil = JSON.parse(crudo);
      return perfil && perfil.riasec ? perfil : null;
    } catch (e) {
      return null;
    }
  }

  function registrarInteres(ficha) {
    if (typeof window.EventosVocacional === 'undefined') return;
    const perfil = perfilGuardado();
    const claveCarrera = ficha.claveCarrera || (ficha.tipo === 'carrera' ? ficha.clave : '');
    if (!perfil || !claveCarrera) return;
    window.EventosVocacional.registrarEvento({ claveCarrera, tipo: 'me-interesa', perfil });
  }

  // --------------------------------------------------------------------------
  // BOTONES
  // --------------------------------------------------------------------------

  const ICONO_CORAZON =
    '<svg class="fav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';

  // El HTML del botón vive acá (y no en render.js) para que las páginas
  // estáticas generadas y la app produzcan exactamente el mismo botón.
  function botonHTML(item) {
    const ficha = normalizarItem(item) || {};
    return `<button type="button" class="btn-favorito" data-favorito="${escaparJSON(ficha)}"` +
      ` data-fav-clave="${escaparTexto(ficha.clave || '')}" data-fav-nombre="${escaparTexto(ficha.nombre || '')}"` +
      ` aria-pressed="false"` +
      ` aria-label="Guardar ${escaparTexto(ficha.nombre || 'en Mi lista')}">${ICONO_CORAZON}<span class="fav-texto">Me interesa</span></button>`;
  }

  // Escapa un objeto para meterlo en un data-attribute: JSON + entidades HTML.
  function escaparJSON(objeto) {
    return escaparTexto(JSON.stringify(objeto));
  }

  // Escapa texto suelto que va a innerHTML (aviso, labels).
  function escaparTexto(texto) {
    return String(texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Hidrata los botones que vienen "vacíos" del HTML generado (páginas
  // estáticas): les inyecta el ícono y, salvo en el modo solo-ícono, el texto.
  // Así existe una sola definición del botón para la app y para el HTML.
  function prepararBoton(btn) {
    if (btn.querySelector('.fav-svg')) return;
    btn.innerHTML = ICONO_CORAZON + (btn.hasAttribute('data-fav-solo-icono') ? '' : '<span class="fav-texto">Me interesa</span>');
  }

  function pintarBoton(btn, activo) {
    prepararBoton(btn);
    btn.classList.toggle('is-favorito', activo);
    btn.setAttribute('aria-pressed', String(activo));
    const texto = btn.querySelector('.fav-texto');
    if (texto) texto.textContent = activo ? 'Guardada' : 'Me interesa';
    const nombre = btn.dataset.favNombre || '';
    btn.setAttribute('aria-label', activo
      ? `Quitar${nombre ? ' ' + nombre : ''} de Mi lista`
      : `Guardar${nombre ? ' ' + nombre : ''} en Mi lista`);
  }

  // Sincroniza TODOS los botones visibles (la misma carrera puede estar en la
  // grilla y en una recomendación a la vez).
  function sincronizarBotones() {
    document.querySelectorAll('[data-fav-clave]').forEach(btn => {
      pintarBoton(btn, tiene(btn.dataset.favClave));
    });
  }

  // --------------------------------------------------------------------------
  // AVISO ("toast")
  // --------------------------------------------------------------------------

  let toast = null;
  let temporizadorToast = 0;

  function mostrarToast(mensaje, { accion = null } = {}) {
    if (!document.body) return;
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'fav-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="fav-toast-texto">${escaparTexto(mensaje)}</span>`;
    if (accion) {
      const enlace = document.createElement('a');
      enlace.className = 'fav-toast-accion';
      enlace.href = accion.href;
      enlace.textContent = accion.texto;
      // En la app, mi-lista.js intercepta este click y abre el overlay sin
      // navegar. En las páginas estáticas no hay módulo y el link lleva a /.
      enlace.setAttribute('data-abrir-mi-lista', '');
      toast.appendChild(enlace);
    }
    toast.classList.add('is-visible');
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => toast.classList.remove('is-visible'), 4200);
  }

  // --------------------------------------------------------------------------
  // AUTOINSTALACIÓN
  // --------------------------------------------------------------------------

  // Delegación global: cubre las tarjetas que se pintan después (paginación,
  // cambio de filtros, resultados del test) sin que nadie tenga que reconectar.
  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-favorito]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();

    let ficha;
    try {
      ficha = JSON.parse(btn.dataset.favorito);
    } catch (e) {
      return;
    }

    const accion = toggle(ficha);
    if (!accion) return;

    // El dataset guarda el snapshot; el nombre para el aviso es el del payload.
    btn.dataset.favNombre = ficha.nombre || '';
    sincronizarBotones();

    if (accion === 'agregado') {
      mostrarToast(`❤ ${ficha.nombre || 'Guardada'} en Mi lista`, {
        accion: { href: '/?lista=1', texto: 'Ver mi lista' }
      });
    } else {
      mostrarToast('Quitada de Mi lista', {
        accion: { href: '/?lista=1', texto: 'Ver mi lista' }
      });
    }
  });

  // Estado inicial: los botones de las páginas estáticas nacen sin pintar.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sincronizarBotones);
  } else {
    sincronizarBotones();
  }

  // Otra pestaña del sitio cambió la lista: sincronizamos botones y contador.
  window.addEventListener('storage', event => {
    if (event.key !== CLAVE) return;
    sincronizarBotones();
    notificar();
  });

  window.Favoritos = {
    CLAVE,
    ICONO_CORAZON,
    botonHTML,
    leer,
    lista: leer,
    tiene,
    contar,
    toggle,
    quitar,
    vaciar,
    suscribir,
    sincronizarBotones,
    mostrarToast
  };
})();
