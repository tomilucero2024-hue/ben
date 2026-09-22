// ============================================================================
// 🧾 EVENTOS DE USO DEL TEST VOCACIONAL COMPLETO
// ============================================================================
//
// Registra qué carreras despiertan interés real después de un test. Ese registro
// es la materia prima de la Fase B: el perfil de cada carrera se va afinando
// con el promedio de los perfiles de los estudiantes que interactuaron con ella.
//
// Cómo funciona hoy (sitio estático, sin backend):
//   - Los eventos se guardan en localStorage del dispositivo (se conservan los
//     últimos 500 para no crecer sin control).
//   - Si en config.json hay un "endpoint", además se intenta enviar por POST
//     (sin bloquear la navegación: si falla, no pasa nada).
//   - El operador del sitio puede exportarlos con descargarEventos() (tipeando
//     EventosVocacional.descargar() en la consola) y procesarlos con:
//         node generar-perfiles-uso.js [ruta-al-json]
//
// Formato de cada evento:
//   { claveCarrera, tipo, fecha, perfil: { riasec, apt, val, codigo } }
//
// Script clásico: expone window.EventosVocacional.
// ============================================================================

(function () {
  const CLAVE = 'ben-vocacional-eventos';
  let config = { endpoint: '', max_local: 500 };

  function configurar(cfg) {
    config = Object.assign({}, config, cfg || {});
  }

  function leer() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      const lista = crudo ? JSON.parse(crudo) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      return [];
    }
  }

  function guardar(lista) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch (e) {
      // Si el almacenamiento está lleno o bloqueado, no rompemos la navegación.
    }
  }

  // Registra una interacción. "tipo" distingue la acción: 'ver-ficha',
  // 'me-interesa', 'click-resultado', 'ver-en-buscador'.
  function registrarEvento({ claveCarrera, tipo, perfil }) {
    if (!claveCarrera || !perfil) return;
    const evento = {
      claveCarrera,
      tipo: tipo || 'interaccion',
      fecha: new Date().toISOString(),
      perfil: {
        riasec: perfil.riasec || {},
        apt: perfil.apt || {},
        val: perfil.val || {},
        codigo: perfil.codigo || ''
      }
    };

    const lista = leer();
    lista.push(evento);
    if (lista.length > config.max_local) lista.splice(0, lista.length - config.max_local);
    guardar(lista);

    if (config.endpoint) {
      try {
        fetch(config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(evento),
          keepalive: true
        }).catch(() => {});
      } catch (e) {
        // Sin conexión o endpoint caído: el evento local ya quedó guardado.
      }
    }
  }

  function obtenerEventos() {
    return leer();
  }

  function limpiar() {
    try { localStorage.removeItem(CLAVE); } catch (e) {}
  }

  // Descarga los eventos como JSON para procesarlos con el job de Node.
  function descargar() {
    const contenido = JSON.stringify({ eventos: leer() }, null, 2);
    const blob = new Blob([contenido], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eventos-vocacional.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  window.EventosVocacional = { configurar, registrarEvento, obtenerEventos, limpiar, descargar };
})();
