// ============================================================================
// 🧪 TEST VOCACIONAL COMPLETO — Interfaz
// ============================================================================
//
// Ventana flotante que desenfoca lo que hay detrás. El recorrido es:
//
//   intro → tandas de preguntas (con barra de progreso y "volver") → resultados
//
// Los resultados se muestran acá (resumen del perfil, alertas y las carreras
// más afines) y además se vuelcan a la grilla del sitio con el mismo mecanismo
// que ya usa el Copiloto corto (estado.recomendacion), así los filtros de
// siempre siguen funcionando sobre el ranking.
//
// Todo el cálculo vive en el motor (js/vocacional/motor.js). Este archivo solo
// pinta y conecta eventos.
// ============================================================================

import { estado } from '../estado.js';
import { cambiarSeccion, mostrarResultados } from '../render.js';
import { enlacesBEN } from '../datos.js';
import { escaparHTML } from '../util.js';

const CLAVE_PERFIL = 'ben-vocacional-perfil';
// WCAG 2.1 - 2.2.6 / fatiga cognitiva: el avance se guarda respuesta por
// respuesta para poder pausar y retomar donde se dejó. No hay límite de tiempo.
const CLAVE_PROGRESO = 'ben-vocacional-progreso';

let overlay = null;
let cuerpo = null;
let pie = null;
let progreso = null;
let progresoBarra = null;
let progresoTexto = null;
let botonCerrar = null;

let preguntas = [];
let secciones = [];
let paginas = [];
let paginaActual = 0;
let respuestas = {};
let perfil = null;
let ranking = null;
let focoPrevio = null;
let inicializado = false;
let cargando = false;

// ---------------------------------------------------------------------------
// Datos y estado
// ---------------------------------------------------------------------------

async function esperarDatos() {
  if (!window.Vocacional) throw new Error('El motor del test no está disponible');
  if (window.Vocacional.preguntas && window.Vocacional.preguntas.length) return;
  await window.Vocacional.cargarDatos();
}

// Arma las pantallas del test: cada sección se corta en tandas del tamaño
// configurado, así nunca se ven las 65 preguntas juntas.
function construirPaginas(porPantalla) {
  paginas = [];
  secciones.forEach(seccion => {
    const suyas = preguntas.filter(p => p.seccion === seccion.id);
    for (let i = 0; i < suyas.length; i += porPantalla) {
      paginas.push({ seccion, preguntas: suyas.slice(i, i + porPantalla) });
    }
  });
}

function escalaDe(seccionId) {
  const seccion = secciones.find(s => s.id === seccionId);
  return (seccion && seccion.escala) || ['Nada', 'Poco', 'Más o menos', 'Bastante', 'Mucho'];
}

function numeroDePregunta(id) {
  return preguntas.findIndex(p => p.id === id) + 1;
}

// WCAG 2.1 - 4.1.3: la barra de progreso no se anuncia sola. Este texto va a la
// región role="status" y se fuerza el re-anuncio borrando y reescribiendo.
// La barra se actualiza desde un solo lugar: así el ancho, el aria-valuenow y el
// texto en palabras nunca se desincronizan (p. ej. al retomar el test).
function actualizarBarraProgreso(pagina) {
  const total = preguntas.length || 65;
  const respondidas = Object.keys(respuestas).length;
  progresoBarra.style.width = `${Math.round((respondidas / total) * 100)}%`;
  progreso.setAttribute('aria-valuemin', '0');
  progreso.setAttribute('aria-valuemax', String(total));
  progreso.setAttribute('aria-valuenow', String(respondidas));
  progreso.setAttribute('aria-valuetext', `${respondidas} de ${total} respondidas`);
  if (pagina) {
    progresoTexto.textContent = `Parte ${pagina.seccion.parte} de 3 · ${pagina.seccion.titulo} · ${respondidas} de ${total} respondidas`;
  }
}

// WCAG 2.1 - 2.4.3 Orden del foco: cada pantalla del test reemplaza el DOM
// entero, así que el foco hay que devolverlo adentro. Sin esto, al pasar de
// tanda el control enfocado desaparecía, el foco caía al <body> y la siguiente
// tabulación volvía al principio de la página (afuera del diálogo).
function enfocarDentroDe(preferido, respaldo) {
  const destino = (preferido && preferido()) || (respaldo && respaldo()) || botonCerrar;
  if (destino && typeof destino.focus === 'function') destino.focus({ preventScroll: true });
}

function anunciar(texto) {
  const region = document.getElementById('tc-anuncio');
  if (!region) return;
  region.textContent = '';
  window.setTimeout(() => { region.textContent = texto; }, 30);
}

function leerPerfilGuardado() {
  try {
    const crudo = localStorage.getItem(CLAVE_PERFIL);
    const datos = crudo ? JSON.parse(crudo) : null;
    return datos && datos.perfil ? datos : null;
  } catch (e) {
    return null;
  }
}

function leerProgresoGuardado() {
  try {
    const crudo = localStorage.getItem(CLAVE_PROGRESO);
    const datos = crudo ? JSON.parse(crudo) : null;
    if (!datos || !datos.respuestas || !Object.keys(datos.respuestas).length) return null;
    return datos;
  } catch (e) {
    return null;
  }
}

function guardarProgreso() {
  try {
    const total = preguntas.length || 65;
    const respondidas = Object.keys(respuestas).length;
    if (!respondidas) { localStorage.removeItem(CLAVE_PROGRESO); return; }
    localStorage.setItem(CLAVE_PROGRESO, JSON.stringify({
      version: 1,
      fecha: new Date().toISOString(),
      paginaActual,
      total,
      respuestas
    }));
  } catch (e) {
    // Sin almacenamiento el test funciona igual; solo no se puede retomar.
  }
}

function borrarProgreso() {
  try { localStorage.removeItem(CLAVE_PROGRESO); } catch (e) {}
}

function guardarPerfil(perfilCalculado) {
  try {
    localStorage.setItem(CLAVE_PERFIL, JSON.stringify({
      version: 1,
      fecha: new Date().toISOString(),
      perfil: perfilCalculado
    }));
  } catch (e) {
    // Si el navegador bloquea el almacenamiento, el test funciona igual.
  }
}

function registrarEvento(tipo, clave) {
  if (!clave || !window.EventosVocacional) return;
  window.EventosVocacional.registrarEvento({ claveCarrera: clave, tipo, perfil });
}

// ---------------------------------------------------------------------------
// Apertura y cierre de la ventana
// ---------------------------------------------------------------------------

function elementosDetras() {
  return [
    document.querySelector('.hero'),
    document.querySelector('.catalog-layout'),
    document.getElementById('copilotoPanel'),
    document.querySelector('header.header'),
    document.querySelector('.site-footer'),
    document.querySelector('.a11y-widget')
  ];
}

function alternarDetras(inert) {
  elementosDetras().forEach(el => { if (el) el.inert = inert; });
  document.documentElement.classList.toggle('test-completo-abierto', inert);
}

export async function abrirTestCompleto() {
  if (!inicializado) inicializarTestCompleto();
  if (!overlay) return;

  focoPrevio = document.activeElement;
  overlay.hidden = false;
  alternarDetras(true);
  renderIntro();

  try {
    await esperarDatos();
    if (window.Vocacional.config && window.EventosVocacional) {
      window.EventosVocacional.configurar(window.Vocacional.config.eventos || {});
    }
    preguntas = window.Vocacional.preguntas || [];
    secciones = window.Vocacional.secciones || [];
    construirPaginas((window.Vocacional.config.test || {}).preguntas_por_pantalla || 9);
    renderIntro(); // repinta por si tardó en cargar
  } catch (e) {
    console.error('[Test completo]', e);
    cuerpo.innerHTML = '<p class="empty-state">No se pudieron cargar las preguntas del test. Probá recargar la página.</p>';
  }
  // renderIntro() deja el foco adentro; si algo falló, este respaldo lo asegura.
  if (!overlay.contains(document.activeElement)) {
    const foco = cuerpo.querySelector('button, a, input') || botonCerrar;
    if (foco) foco.focus();
  }
}

export function cerrarTestCompleto() {
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  alternarDetras(false);
  if (focoPrevio && typeof focoPrevio.focus === 'function') focoPrevio.focus();
}

// ---------------------------------------------------------------------------
// Pantallas
// ---------------------------------------------------------------------------

function renderIntro() {
  progreso.hidden = true;
  pie.innerHTML = '';
  const guardado = leerPerfilGuardado();
  const progresoGuardado = leerProgresoGuardado();
  const total = preguntas.length || 65;

  cuerpo.innerHTML = `
    <div class="tc-intro">
      <p class="tc-eyebrow">Test Vocacional Completo</p>
      <h3 class="tc-titulo-grande">Un diagnóstico más profundo de tu perfil</h3>
      <p class="tc-descripcion">Son <strong>${total} preguntas</strong> divididas en 3 partes, pensadas para
        entender qué te interesa, qué se te da bien y qué necesitás de tu futuro trabajo. Toma entre
        <strong>4 y 6 minutos</strong> y podés volver atrás en cualquier momento.</p>
      <ol class="tc-pasos">
        <li class="tc-paso"><span class="tc-paso-num">1</span><div><strong>Intereses.</strong> 36 afirmaciones sobre qué te imaginás haciendo (modelo RIASEC de Holland).</div></li>
        <li class="tc-paso"><span class="tc-paso-num">2</span><div><strong>Aptitudes.</strong> 15 preguntas sobre qué tan fácil te resulta cada tipo de tarea.</div></li>
        <li class="tc-paso"><span class="tc-paso-num">3</span><div><strong>Valores y contexto.</strong> 14 preguntas sobre lo que necesitás de tu trabajo y la presión que sentís hoy.</div></li>
      </ol>
      ${progresoGuardado ? `
      <div class="tc-ultimo tc-ultimo-progreso">
        <div>
          <strong>Tenés ${Object.keys(progresoGuardado.respuestas).length} de ${total} respuestas guardadas</strong>
          <p>Podés seguir donde quedaste, sin repetir lo que ya respondiste.</p>
        </div>
        <button type="button" class="tc-btn-secundario" data-tc-accion="seguir">Seguir donde quedé</button>
      </div>` : ''}
      ${guardado ? `
      <div class="tc-ultimo">
        <div>
          <strong>Ya tenés un resultado guardado</strong>
          <p>Lo calculamos con tus respuestas anteriores. Podés verlo o hacer el test de nuevo.</p>
        </div>
        <button type="button" class="tc-btn-secundario" data-tc-accion="ultimo">Ver mi último resultado</button>
      </div>` : ''}
      <p class="tc-aviso-legal"><small>Es una herramienta orientativa, no un diagnóstico psicológico. La decisión final
        es tuya: usá el resultado para explorar, no para descartar.</small></p>
    </div>`;

  pie.innerHTML = `
    <button type="button" class="tc-btn-secundario" data-tc-accion="cerrar">Cancelar</button>
    <button type="button" class="tc-btn-primario" data-tc-accion="empezar">Empezar el test</button>`;

  // Prioridad del foco al abrir: retomar > último resultado > empezar > cerrar.
  enfocarDentroDe(
    () => cuerpo.querySelector('[data-tc-accion="seguir"]') || cuerpo.querySelector('[data-tc-accion="ultimo"]'),
    () => pie.querySelector('[data-tc-accion="empezar"]')
  );
}

function renderPagina() {
  const pagina = paginas[paginaActual];
  if (!pagina) return;
  const total = preguntas.length;
  progreso.hidden = false;
  actualizarBarraProgreso(pagina);

  const escala = escalaDe(pagina.seccion.id);
  const bloques = pagina.preguntas.map(p => {
    const opciones = [1, 2, 3, 4, 5].map(v => `
      <label class="tc-opcion">
        <input type="radio" name="${p.id}" value="${v}" ${respuestas[p.id] === v ? 'checked' : ''}
               aria-label="${escaparHTML(escala[v - 1])}">
        <span aria-hidden="true">${v}</span>
      </label>`).join('');
    // WCAG 2.1 - 1.3.1 / 4.1.2: la leyenda lleva la pregunta EN CONTEXTO
    // ("Pregunta N de total") y el fieldset describe la escala completa, así el
    // lector anuncia "Pregunta 24 de 65: <texto>. Escala de 1 a 5..." al entrar.
    return `
      <fieldset class="tc-pregunta" aria-describedby="tc-escala-${paginaActual}">
        <legend class="tc-pregunta-texto"><span class="sr-only">Pregunta ${numeroDePregunta(p.id)} de ${total}: </span><span class="tc-numero">${numeroDePregunta(p.id)}</span>${escaparHTML(p.texto)}</legend>
        <div class="tc-likert">${opciones}</div>
      </fieldset>`;
  }).join('');

  cuerpo.innerHTML = `
    <div class="tc-pagina">
      <p class="sr-only" id="tc-escala-${paginaActual}">Escala de 1 a 5: 1 es ${escaparHTML(escala[0])}, 2 ${escaparHTML(escala[1])}, 3 ${escaparHTML(escala[2])}, 4 ${escaparHTML(escala[3])} y 5 ${escaparHTML(escala[4])}.</p>
      <h3 class="tc-instruccion">${escaparHTML(pagina.seccion.instruccion)}</h3>
      <div class="tc-escala" aria-hidden="true"><span>${escaparHTML(escala[0])}</span><span>${escaparHTML(escala[4])}</span></div>
      ${bloques}
    </div>`;

  pie.innerHTML = `
    <button type="button" class="tc-btn-secundario" data-tc-accion="atras" ${paginaActual === 0 ? 'disabled' : ''}>← Volver</button>
    <span class="tc-aviso" id="tc-aviso" hidden>Respondé todas para continuar</span>
    <button type="button" class="tc-btn-primario" data-tc-accion="siguiente" ${paginaCompleta() ? '' : 'disabled'}>
      ${paginaActual === paginas.length - 1 ? 'Ver mi resultado' : 'Siguiente →'}
    </button>`;

  cuerpo.scrollTop = 0;
  const desdeN = numeroDePregunta(pagina.preguntas[0].id);
  const hastaN = numeroDePregunta(pagina.preguntas[pagina.preguntas.length - 1].id);
  const completa = paginaCompleta() ? ' Tanda completa, podés continuar.' : '';
  anunciar(`Parte ${pagina.seccion.parte} de 3, ${pagina.seccion.titulo}. Preguntas ${desdeN} a ${hastaN} de ${total}.${completa}`);
  guardarProgreso();
  // El foco arranca en la primera pregunta de la tanda nueva (o en la primera
  // sin responder, al volver atrás).
  enfocarDentroDe(
    () => cuerpo.querySelector(`fieldset:nth-of-type(${(pagina.preguntas.findIndex(p => !respuestas[p.id]) + 1) || 1}) input[type="radio"]`),
    () => cuerpo.querySelector('input[type="radio"], button, a')
  );
}

function paginaCompleta() {
  const pagina = paginas[paginaActual];
  return pagina ? pagina.preguntas.every(p => respuestas[p.id]) : false;
}

function actualizarControlesPagina() {
  const boton = pie.querySelector('[data-tc-accion="siguiente"]');
  const aviso = pie.querySelector('#tc-aviso');
  if (!boton) return;
  boton.disabled = !paginaCompleta();
  if (aviso) aviso.hidden = boton.disabled;
}

async function finalizarTest() {
  progreso.hidden = true;
  pie.innerHTML = '';
  cuerpo.innerHTML = '<div class="tc-cargando"><span class="tc-spinner" aria-hidden="true"></span><p>Analizando tus respuestas…</p></div>';
  try {
    await esperarDatos();
    perfil = window.Vocacional.calcularPerfil(respuestas);
    ranking = window.Vocacional.generarRanking(perfil, window.Vocacional.perfiles, window.Vocacional.config, { limite: 150 });
    guardarPerfil(perfil);
    borrarProgreso(); // el avance ya cumplió su función: queda el resultado
    renderResultados();
  } catch (e) {
    console.error('[Test completo]', e);
    cuerpo.innerHTML = '<p class="empty-state">No pudimos calcular tu resultado. Probá de nuevo.</p>';
    pie.innerHTML = '<button type="button" class="tc-btn-secundario" data-tc-accion="rehacer">Rehacer el test</button>';
  }
}

function tarjetaResultado(carrera) {
  const slug = enlacesBEN.carreras ? enlacesBEN.carreras[carrera.clave] : null;
  const matchClass = carrera.compatibilidad >= 75 ? 'match-alto' : (carrera.compatibilidad >= 50 ? 'match-medio' : 'match-bajo');
  const alertas = carrera.alertas || [];
  return `
    <article class="tc-card ${matchClass}" data-tc-clave="${escaparHTML(carrera.clave)}" data-tc-evento="click-resultado">
      <div class="tc-card-head">
        <h5>${escaparHTML(carrera.nombre)}</h5>
        <div class="compatibilidad-badge ${matchClass}">${carrera.compatibilidad}%</div>
      </div>
      <div class="tipo-badges">
        <span class="tipo-badge area">${escaparHTML(carrera.area)}</span>
      </div>
      <p class="tc-card-why">${escaparHTML(carrera.explicacion)}</p>
      ${alertas.length ? `<ul class="alertas-list">${alertas.map(a => `<li>${escaparHTML(a.mensaje)}</li>`).join('')}</ul>` : ''}
      <div class="tc-card-acciones">
        ${slug ? `<a class="tc-link" href="/carrera/${escaparHTML(slug)}/" data-tc-evento="ver-ficha" data-tc-clave="${escaparHTML(carrera.clave)}">Ver ficha y dónde estudiarla →</a>` : ''}
        <button type="button" class="tc-btn-chico" data-tc-evento="me-interesa" data-tc-clave="${escaparHTML(carrera.clave)}">Me interesa</button>
      </div>
    </article>`;
}

function renderResultados() {
  const cantidad = (window.Vocacional.config.test || {}).resultados || 8;
  const top = ranking.todas.slice(0, cantidad);
  const alertas = window.Vocacional.alertasTension(perfil);
  const resumen = window.Vocacional.resumenPerfil(perfil);
  const codigo = window.Vocacional.etiquetasCodigo(perfil.codigo);

  cuerpo.innerHTML = `
    <div class="tc-resultado">
      <p class="tc-eyebrow">Tu resultado</p>
      <h3 class="tc-resumen" tabindex="-1">${escaparHTML(resumen)}</h3>
      <p class="tc-codigo"><span>${escaparHTML(codigo)}</span> · presión externa ${perfil.contexto.presion}/10</p>

      ${alertas.length ? `
      <div class="tc-alertas">
        <strong>Para tener en cuenta</strong>
        <ul>${alertas.map(a => `<li>${escaparHTML(a)}</li>`).join('')}</ul>
      </div>` : ''}

      <h4 class="tc-subtitulo">Tus ${top.length} carreras más afines</h4>
      <div class="tc-cards">${top.map(tarjetaResultado).join('')}</div>

      <div class="tc-acciones">
        <button type="button" class="tc-btn-primario" data-tc-accion="ver-en-buscador">Ver todas en el buscador con filtros</button>
        <button type="button" class="tc-btn-secundario" data-tc-accion="rehacer">Rehacer el test</button>
        <button type="button" class="tc-btn-texto" data-tc-accion="borrar">Borrar mis datos</button>
      </div>

      <p class="tc-aviso-legal"><small>Resultado orientativo basado en tus respuestas, no en un diagnóstico profesional.
        BEN es una iniciativa independiente de acceso libre: confirmá siempre los datos de cada carrera con la
        institución antes de inscribirte. La decisión final es tuya.</small></p>
    </div>`;
  cuerpo.scrollTop = 0;
  // El resultado también se anuncia y recibe el foco: el resumen es lo primero
  // que hay que leer/escuchar.
  enfocarDentroDe(() => cuerpo.querySelector('.tc-resumen'), () => cuerpo.querySelector('button, a[href]'));
}

// ---------------------------------------------------------------------------
// Integración con la grilla del sitio
// ---------------------------------------------------------------------------

function aplicarAlBuscador() {
  if (!ranking || !perfil) return;
  estado.recomendacion = { carreras: ranking.todas, rankings: ranking, total: ranking.total };
  estado.vista = 'carreras';
  cambiarSeccion('formal');
  mostrarResultados();
  cerrarTestCompleto();
  const toolbar = document.getElementById('resultsToolbar');
  if (toolbar && typeof toolbar.scrollIntoView === 'function') {
    toolbar.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ---------------------------------------------------------------------------
// Eventos de la ventana
// ---------------------------------------------------------------------------

function manejarAccion(accion) {
  switch (accion) {
    case 'cerrar':
      cerrarTestCompleto();
      break;
    case 'empezar':
      respuestas = {};
      paginaActual = 0;
      borrarProgreso();
      renderPagina();
      break;
    case 'seguir': {
      const guardado = leerProgresoGuardado();
      if (!guardado) { renderIntro(); return; }
      respuestas = guardado.respuestas;
      paginaActual = Math.min(guardado.paginaActual || 0, Math.max(paginas.length - 1, 0));
      renderPagina();
      break;
    }
    case 'atras':
      if (paginaActual > 0) { paginaActual--; renderPagina(); }
      break;
    case 'siguiente':
      if (!paginaCompleta()) return;
      if (paginaActual === paginas.length - 1) finalizarTest();
      else { paginaActual++; renderPagina(); }
      break;
    case 'ultimo': {
      const guardado = leerPerfilGuardado();
      if (!guardado) return;
      perfil = guardado.perfil;
      try {
        ranking = window.Vocacional.generarRanking(perfil, window.Vocacional.perfiles, window.Vocacional.config, { limite: 150 });
        renderResultados();
      } catch (e) {
        console.error('[Test completo]', e);
      }
      break;
    }
    case 'ver-en-buscador':
      aplicarAlBuscador();
      break;
    case 'rehacer':
      respuestas = {};
      paginaActual = 0;
      perfil = null;
      ranking = null;
      borrarProgreso();
      renderPagina();
      break;
    case 'borrar':
      try { localStorage.removeItem(CLAVE_PERFIL); } catch (e) {}
      borrarProgreso();
      if (window.EventosVocacional) window.EventosVocacional.limpiar();
      respuestas = {};
      paginaActual = 0;
      perfil = null;
      ranking = null;
      renderIntro();
      break;
  }
}

export function inicializarTestCompleto() {
  overlay = document.getElementById('testCompleto');
  if (!overlay) return;
  cuerpo = document.getElementById('tc-cuerpo');
  pie = document.getElementById('tc-pie');
  progreso = document.getElementById('tc-progreso');
  progresoBarra = document.getElementById('tc-progreso-relleno');
  progresoTexto = document.getElementById('tc-progreso-texto');
  botonCerrar = document.getElementById('tc-cerrar');
  if (inicializado) return;
  inicializado = true;

  botonCerrar.addEventListener('click', cerrarTestCompleto);

  // Un solo listener por delegación: los botones se recrean en cada pantalla.
  overlay.addEventListener('click', event => {
    const accion = event.target.closest('[data-tc-accion]');
    if (accion) { manejarAccion(accion.dataset.tcAccion); return; }
    const conEvento = event.target.closest('[data-tc-evento]');
    if (conEvento) registrarEvento(conEvento.dataset.tcEvento, conEvento.dataset.tcClave);
  });

  overlay.addEventListener('change', event => {
    const input = event.target.closest('input[type="radio"][name]');
    if (!input) return;
    respuestas[input.name] = Number(input.value);
    const pagina = paginas[paginaActual];
    // WCAG 2.1 - 4.1.2: el progressbar expone el valor real, no solo el ancho.
    if (pagina) actualizarBarraProgreso(pagina);
    actualizarControlesPagina();
    if (pagina && paginaCompleta()) anunciar('Tanda completa. Podés continuar.');
    guardarProgreso();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay && !overlay.hidden) cerrarTestCompleto();
  });

  // Foco encerrado en la ventana mientras está abierta (accesibilidad).
  overlay.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const foco = [...overlay.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null);
    if (!foco.length) return;
    const primero = foco[0];
    const ultimo = foco[foco.length - 1];
    if (event.shiftKey && document.activeElement === primero) { ultimo.focus(); event.preventDefault(); }
    else if (!event.shiftKey && document.activeElement === ultimo) { primero.focus(); event.preventDefault(); }
  });

  // Enlace directo desde las páginas estáticas: /?test=1 abre el test solo.
  // Se limpia el parámetro para que un refresh no lo vuelva a abrir.
  const url = new URL(window.location.href);
  if (url.searchParams.get('test') === '1') {
    abrirTestCompleto();
    url.searchParams.delete('test');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
}
