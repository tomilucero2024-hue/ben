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

function leerPerfilGuardado() {
  try {
    const crudo = localStorage.getItem(CLAVE_PERFIL);
    const datos = crudo ? JSON.parse(crudo) : null;
    return datos && datos.perfil ? datos : null;
  } catch (e) {
    return null;
  }
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
  const foco = cuerpo.querySelector('button, a, input') || botonCerrar;
  if (foco) foco.focus();
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
}

function renderPagina() {
  const pagina = paginas[paginaActual];
  if (!pagina) return;
  const total = preguntas.length;
  const respondidas = Object.keys(respuestas).length;
  progreso.hidden = false;
  progresoBarra.style.width = `${Math.round((respondidas / total) * 100)}%`;
  progresoTexto.textContent = `Parte ${pagina.seccion.parte} de 3 · ${pagina.seccion.titulo} · ${respondidas} de ${total} respondidas`;

  const escala = escalaDe(pagina.seccion.id);
  const bloques = pagina.preguntas.map(p => {
    const opciones = [1, 2, 3, 4, 5].map(v => `
      <label class="tc-opcion">
        <input type="radio" name="${p.id}" value="${v}" ${respuestas[p.id] === v ? 'checked' : ''}
               aria-label="${escaparHTML(escala[v - 1])}">
        <span aria-hidden="true">${v}</span>
      </label>`).join('');
    return `
      <fieldset class="tc-pregunta">
        <legend class="tc-pregunta-texto"><span class="tc-numero">${numeroDePregunta(p.id)}</span>${escaparHTML(p.texto)}</legend>
        <div class="tc-likert">${opciones}</div>
      </fieldset>`;
  }).join('');

  cuerpo.innerHTML = `
    <div class="tc-pagina">
      <h3 class="tc-instruccion">${escaparHTML(pagina.seccion.instruccion)}</h3>
      <div class="tc-escala"><span>${escaparHTML(escala[0])}</span><span>${escaparHTML(escala[4])}</span></div>
      ${bloques}
    </div>`;

  pie.innerHTML = `
    <button type="button" class="tc-btn-secundario" data-tc-accion="atras" ${paginaActual === 0 ? 'disabled' : ''}>← Volver</button>
    <span class="tc-aviso" id="tc-aviso" hidden>Respondé todas para continuar</span>
    <button type="button" class="tc-btn-primario" data-tc-accion="siguiente" ${paginaCompleta() ? '' : 'disabled'}>
      ${paginaActual === paginas.length - 1 ? 'Ver mi resultado' : 'Siguiente →'}
    </button>`;

  cuerpo.scrollTop = 0;
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
      <h3 class="tc-resumen">${escaparHTML(resumen)}</h3>
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
      renderPagina();
      break;
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
      renderPagina();
      break;
    case 'borrar':
      try { localStorage.removeItem(CLAVE_PERFIL); } catch (e) {}
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
    const respondidas = Object.keys(respuestas).length;
    if (pagina) {
      progresoBarra.style.width = `${Math.round((respondidas / preguntas.length) * 100)}%`;
      progresoTexto.textContent = `Parte ${pagina.seccion.parte} de 3 · ${pagina.seccion.titulo} · ${respondidas} de ${preguntas.length} respondidas`;
    }
    actualizarControlesPagina();
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
