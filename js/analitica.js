// ============================================================================
// 📊 ANALÍTICA (Google Analytics 4)
// ============================================================================
//
// Qué se mide acá, y por qué:
//   - Pageviews de TODAS las páginas del sitio: la app (/) y las ~590 páginas
//     estáticas de /carrera/, /area/, /institucion/, /provincia/, /titulos/.
//     Las estátitas son la mayor parte del tráfico (llegan desde Google) y sin
//     esto se verían como cero visitas en los informes.
//   - Los eventos que después se van a querer comparar: búsquedas, filtros,
//     favoritos, Mi lista, el test vocacional y las salidas hacia el sitio de
//     cada institución (que es el resultado final: el estudiante que hace clic
//     en "donde estudiar" se va del sitio con la respuesta que buscaba).
//
// Por qué un script clásico (no un módulo ES) y por qué vive solo:
//   - El <head> lo carga index.html (la app) y generar-paginas.js → documento()
//     (las páginas estáticas), que no cargan ningún módulo. Mismo patrón que
//     favoritos.js.
//   - gtag.js se baja con async: no frena el render ni compite con las
//     preconnect de las tipografías. Los eventos se encolan en window.dataLayer
//     y se mandan solos, aunque la navegación se corte.
//   - Los módulos ES y las páginas estáticas NO hablan con GA: anuncian lo que
//     pasó con un CustomEvent 'ben:evento' (helper: registrarEvento() en
//     js/medicion.js) y este archivo decide si eso se manda y con qué nombre.
//     Así, cambiar de herramienta —o apagarla entera— no obliga a tocar la app.
//
// El ID de medición va en la constante MEDICION, más abajo. Todo lo que
// necesita el archivo está en esos dos valores: si MEDICION queda en
// 'G-PORDEFINIR', o la persona pidió no ser rastreada, el archivo se apaga solo
// (con un aviso en la consola) y no pide nada a Google.
//
// Lo que sí sale y lo que no: el texto que se busca o que se le pregunta al
// Copiloto sale (es el dato más útil del sitio y no identifica a nadie), pero
// las respuestas del test vocacional nunca, ni ningún dato de contacto. La IP
// la anonimiza GA4; queda dicho acá para que quede dicho si algún día se cambia
// de herramienta.
//
// FALLAS (ver la sección de abajo): los dos errores que el sitio ya anticipa
// (los datos no bajan, el test no calcula) avisan con su propio nombre de evento
// porque hay que poder distinguirlos de un vistazo. Cualquier otro error —el que
// nadie previó— lo escucha un listener global y sale como `error`.
// ============================================================================

(function () {
  // ───────────────────────────────────────────────────────────────────────────
  // CONFIGURACIÓN
  // ───────────────────────────────────────────────────────────────────────────

  // ID de medición de la propiedad de GA4 (Administración → Flujos de datos →
  // Web). Reemplazar por el G-XXXXXXXXXX de otra propiedad si algún día se
  // cambia. PLACEHOLDER es lo que permite apagar el archivo en silencio: si
  // MEDICION vuelve a valerse 'G-PORDEFINIR', no se pide nada a Google.
  const MEDICION = 'G-JCNCMH202B';
  const PLACEHOLDER = 'G-PORDEFINIR';

  // Motivos por los que no se mide nada. Con el primero ya se notifica al
  // operador desde la consola, para que "no llegan datos" no se confunda con
  // "no me llegan los datos".
  function motivoDeNoMedir() {
    if (MEDICION === PLACEHOLDER) return 'ID de medición sin configurar (js/analitica.js)';
    if (window.__BEN_SIN_ANALITICA) return 'apagado con window.__BEN_SIN_ANALITICA';
    // Quien activa "No quiero que me rastreen" en su navegador no entra. Es la
    // única palanca de privacidad que el sitio tiene hoy: en Argentina no hay
    // una ley de cookies que obligue a un banner de consentimiento, y medir de
    // más a un sitio público de orientación vocacional (con gente de 16 años
    // entre los usuarios) no vale el dato. Si algún día se quiere lo contrario,
    // sacar esta línea.
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return 'el navegador pidió no ser rastreado (DNT)';
    return null;
  }

  // Apagado por URL, para probar en producción sin tocar el código ni esperar
  // un deploy: /?sin-analitica (o cualquier ?sin-analitica=1 en las páginas
  // estáticas). Solo se mira el valor inicial de la URL: si la app reescribe los
  // parámetros con replaceState, el interruptor sigue en pie.
  const params = new URLSearchParams(window.location.search);
  if (params.has('sin-analitica')) {
    window.__BEN_SIN_ANALITICA = true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NORMALIZACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  // GA4 es-estricto con los parámetros: el nombre solo admite letras, números
  // y guion bajo (máx. 40 caracteres) y el valor se corta a 100. Un parámetro
  // mal formado se descarta entero, así que el evento llegaría sin un dato que
  // sí importa (el nombre de la carrera, por ejemplo). Por eso se limpia acá y
  // no en cada lugar que dispara el evento.
  const LARGO_MAX = 100;
  const NOMBRE_PARAM = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;

  function limpiarParametros(datos) {
    const limpio = {};
    Object.entries(datos || {}).forEach(([clave, valor]) => {
      if (valor === null || valor === undefined) return;
      if (!NOMBRE_PARAM.test(clave)) return;
      if (typeof valor === 'number') {
        limpio[clave] = Number.isFinite(valor) ? valor : String(valor).slice(0, LARGO_MAX);
        return;
      }
      if (typeof valor === 'boolean') { limpio[clave] = valor ? '1' : '0'; return; }
      // Los espacios de los bordes se van: "enfermería " y "enfermería" son la
      // misma búsqueda y en el informe de GA4 contarían como dos.
      const texto = String(valor).trim().slice(0, LARGO_MAX);
      if (texto) limpio[clave] = texto;
    });
    return limpio;
  }

  // Path sin query, para poder agrupar por página y no por cada ?q= distinto que
  // la app escribe con replaceState (miles de combinaciones sobre el mismo
  // catálogo).
  function paginaActual() {
    return location.pathname;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVÍO
  // ═══════════════════════════════════════════════════════════════════════════

  const motivo = motivoDeNoMedir();
  if (motivo) {
    // Sin ID, sin DNT o apagado a mano: las llamadas de benTrack() se siguen
    // haciendo (la app no tiene que preguntar si la analítica está viva) pero
    // no sale nada del dispositivo.
    window.benTrack = function () {};
    if (MEDICION === PLACEHOLDER) {
      console.info('[Analítica] sin medir: ' + motivo + '. Los datos empiezan a llegar al pegar el ID real en js/analitica.js.');
    }
  } else {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // send_page_view va explícito para que quede a la vista: el pageview sale
    // solo, sin que ningún código del sitio tenga que acordarse de pedirlo.
    window.gtag('config', MEDICION, { send_page_view: true });

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEDICION);
    document.head.appendChild(s);

    // Último término de búsqueda enviado: escribir "enfer" en el buscador pasa
    // por un evento por palabra tipeada. Solo sale el primero y el que cambió de
    // verdad, que es lo que después se quiere leer ("¿qué buscan?").
    //
    // Lo mismo vale para la búsqueda sin resultados: se vuelve a disparar en
    // cada letra que se agrega, y de un "no encontré nada" ya alcanza uno. Se
    // identifica por la firma completa (término + origen + sección), así que la
    // misma palabra fallando por texto y después por filtros sí sale dos veces:
    // son dos problemas distintos.
    const ANTIRREPETIDOS = {
      search: ['search_term'],
      search_sin_resultado: ['search_term', 'origen', 'seccion']
    };
    const ultimaFirma = {};

    window.benTrack = function (tipo, datos) {
      if (!tipo) return;
      const parametros = limpiarParametros(datos);

      const claves = ANTIRREPETIDOS[tipo];
      if (claves) {
        const firma = claves.map(clave => parametros[clave] || '').join('|');
        // Sin el dato que identifica al evento (una búsqueda vacía, por ejemplo)
        // se repetiría el anterior sin agregar nada.
        if (!firma.replace(/\|/g, '')) return;
        if (ultimaFirma[tipo] === firma) return;
        ultimaFirma[tipo] = firma;
      }

      window.gtag('event', tipo, parametros);
    };

    // ── Salidas hacia afuera ──────────────────────────────────────────────────
    // El dato que más vale del sitio: el clic en "donde estudiar" o en el link
    // oficial de la institución. Se mide por delegación, desde un solo lugar y
    // sin tocar las ~590 páginas generadas ni los módulos de la app: alcanza con
    // cualquier <a href="https://...">. Con Ctrl/Cmd/Shift o clic central NO se
    // manda nada, porque la persona no se va del sitio (la pestaña nueva se
    // abre y acá sigue todo).
    document.addEventListener('click', function (evento) {
      if (evento.defaultPrevented) return;
      if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
      const enlace = evento.target.closest && evento.target.closest('a[href]');
      if (!enlace) return;
      let destino;
      try { destino = new URL(enlace.href, location.href); } catch (e) { return; }
      if (destino.origin === location.origin) return;
      window.benTrack('salir', { url: destino.href, host: destino.hostname, pagina: paginaActual() });
    }, true);

    // ── Fallas que nadie previó ────────────────────────────────────────────────
    //
    // Los dos errores que el sitio ya anticipa (los datos no bajan, el test no
    // calcula) avisan con su propio nombre de evento desde el lugar que los
    // detecta, porque hay que poder distinguirlos de un vistazo en el informe.
    // Acá va el resto: lo que se rompe y nadie lo tiene controlado, que hoy
    // vive únicamente en la consola del visitante — donde nadie lo mira.
    //
    // Lo que sale es el tipo, el archivo y el mensaje saneado. El mensaje es lo
    // único que sirve para arreglar algo, pero un error de red puede traer
    // adentro justo lo que no queremos mandar: la URL que alguien estaba
    // mirando, con su ?q= adentro, o un email. Por eso `sanearError()` le saca
    // el query string a toda URL y tapa los emails antes de que el mensaje llegue
    // a Google.
    //
    // Un error puede repetirse miles de veces (un `catch` que reintenta en
    // bucle, un script que falla en cada frame). Mandar eso infla los números y
    // tapa el resto del informe, así que: un evento por error distinto en toda
    // la sesión, y con tope. El conteo real de veces que falló algo lo da el
    // navegador, no GA4.

    function sanearError(texto) {
      return String(texto == null ? '' : texto)
        // Una URL a la que se le quita el query string y el fragmento: ahí es
        // donde viaja lo que la persona escribió (/?q=..., /?area=...) y a
        // veces un email o un teléfono.
        .replace(/https?:\/\/[^\s'")\]>]+/gi, url => {
          try {
            const u = new URL(url);
            return u.origin + u.pathname;
          } catch (e) { return '[url]'; }
        })
        .replace(/[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/g, '[email]')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Qué archivo falló, sin la ruta: el error de un módulo llega con el path
    // completo y lo único útil es el nombre.
    function archivoDe(origen) {
      if (!origen || origen === location.href) return 'documento';
      try {
        const u = new URL(origen, location.href);
        const externo = u.origin !== location.origin;
        const nombre = u.pathname.split('/').pop() || 'raiz';
        return (externo ? 'externo/' : '') + nombre.replace(/\.\w+$/, '');
      } catch (e) { return 'desconocido'; }
    }

    const erroresVistos = new Set();
    const TOPE_ERRORES = 5;

    function avisarFalla(tipo, mensaje, archivo) {
      const limpio = sanearError(mensaje);
      if (!limpio) return;
      const clave = tipo + '|' + archivo + '|' + limpio;
      if (erroresVistos.has(clave)) return;
      if (erroresVistos.size >= TOPE_ERRORES) return;
      erroresVistos.add(clave);
      window.benTrack('error', { tipo, donde: archivo, mensaje: limpio });
    }

    // `error` también se dispara cuando falla un <script> o un <img>: en ese
    // caso no hay mensaje, sino un elemento con su src.
    window.addEventListener('error', function (evento) {
      if (evento.target && evento.target !== window) {
        const nodo = evento.target;
        avisarFalla('recurso', nodo.src || nodo.href || 'sin ruta',
            archivoDe(nodo.src || nodo.href));
        return;
      }
      avisarFalla('js', evento.message || 'error sin mensaje', archivoDe(evento.filename));
    });

    // Una promesa rechazada y sin catch: en la consola es un warnings que casi
    // nadie lee, pero es la forma más común de que algo se rompa en silencio.
    window.addEventListener('unhandledrejection', function (evento) {
      const razon = evento.reason;
      const texto = razon && razon.message ? razon.message : String(razon || 'rechazo sin motivo');
      avisarFalla('rechazo', texto, archivoDe(razon && razon.stack ? String(razon.stack).split('\n')[0] : ''));
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUENTE CON EL RESTO DEL SITIO
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Todo lo que quiere medirse se anuncia con un CustomEvent 'ben:evento' y lo
  // escucha esta función. Los módulos ES usan registrarEvento() de
  // js/eventos.js; los scripts clásicos y los inline de las páginas generadas
  // hacen:
  //     window.dispatchEvent(new CustomEvent('ben:evento', { detail: { tipo, ... } }));
  window.addEventListener('ben:evento', function (evento) {
    const detalle = evento && evento.detail;
    if (!detalle || !detalle.tipo) return;
    const { tipo, ...datos } = detalle;
    window.benTrack(tipo, datos);
  });
})();
