// ==========================================
// 🧭 TUTORIAL DE PRIMERA VISITA
// ==========================================
// Recorre las partes de la página con un foco sobre el elemento real (el resto
// queda oscurecido) y una tarjeta que explica cada una. Son seis pasos cortos:
// buscador, pestañas, filtros, una tarjeta, el copiloto y el cierre.
//
// Se muestra UNA vez, después de la portada de bienvenida, y solo si la persona
// eligió "Mostrar ofertas". Si eligió el orientador no se muestra (no tiene
// sentido encima del chat) y tampoco se marca como visto: queda para la próxima.
// Si entró por un link compartido (?q=…), la portada no aparece y el tutorial
// tampoco. Desde el pie ("¿Cómo funciona?") se puede repetir cuando quieran.
//
// Reglas que respeta:
//   - El fondo queda inerte (misma lista que usa la portada) y el scroll se
//     bloquea: el tour centra cada objetivo por su cuenta.
//   - Foco atrapado en la tarjeta, Escape cierra y el foco vuelve a donde estaba.
//   - Con prefers-reduced-motion no hay transición ni scroll suave.

import { cambiarSeccion, cambiarVista } from './render.js';
import { estado } from './estado.js';

// Clave y versión: si algún día cambia la interfaz de forma grande, subir la
// versión hace que el tutorial vuelva a mostrarse una vez.
const CLAVE = 'ben-tutorial-visto';
const VERSION_TUTORIAL = '1';

// Elementos que quedan inertes mientras el tutorial está abierto. Es la misma
// lista que usa la portada de bienvenida (ver copiloto.js).
const ZONAS_INERTES = ['.hero', '.catalog-layout', '#copilotoPanel', '.site-footer'];

// En celular el panel de filtros vive detrás del botón "Filtrar" y la sidebar
// está oculta: el paso apunta al botón que lo abre.
const ES_ANGOSTO = () => typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 820px)').matches;

// Los pasos. `objetivo` es un selector; null = tarjeta centrada sin foco.
// `colocar` decide dónde va la tarjeta respecto del objetivo ('auto' prueba
// abajo y si no entra, arriba).
const PASOS = [
    {
        objetivo: '#searchInput',
        titulo: 'Buscá por carrera, área o institución',
        texto: 'Te muestro lo esencial en 30 segundos. Escribí acá y mientras escribís te va sugiriendo resultados.'
    },
    {
        objetivo: '.section-tabs',
        titulo: 'Cinco tipos de oferta',
        texto: 'Educación formal es el catálogo de universidades e institutos. Las otras cuatro pestañas son plataformas online, formaciones alternativas, oficios y terminar el secundario.'
    },
    {
        objetivo: () => (ES_ANGOSTO() ? '#mobileFilterButton' : '#filtersSidebar'),
        titulo: ES_ANGOSTO() ? 'Acá abrís los filtros' : 'Filtrá lo que te interesa',
        texto: 'Tipo de formación, área, sector, gestión, modalidad, duración y departamento. Se combinan entre sí y el contador te dice cuántas carreras quedan.'
    },
    {
        objetivo: () => '#cardContainer li.card',
        titulo: 'Cada tarjeta es una carrera',
        texto: 'Con su institución, duración y modalidad. El corazón la guarda en Mi lista, "Ver más información" abre la ficha con el plan de estudios y "Escuchar" te la lee en voz alta.'
    },
    {
        objetivo: '#btn-toggle-chat',
        titulo: 'Si no sabés por dónde empezar',
        texto: 'Este botón abre el orientador vocacional: te hace unas preguntas y te recomienda carreras que van con vos.'
    },
    {
        objetivo: null,
        titulo: 'Eso es todo',
        texto: 'Podés repetir este tutorial cuando quieras desde el pie, en "¿Cómo funciona?". Buen viaje.'
    }
];

let abierto = false;
let indice = 0;
let disparador = null;
let pasosActivos = [];

const el = id => document.getElementById(id);

// rAF con respaldo: en un entorno sin requestAnimationFrame (jsdom sin
// pretendToBeVisual, navegadores viejos) el tutorial tiene que seguir andando.
const enFrame = fn => (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
    ? window.requestAnimationFrame(fn)
    : setTimeout(fn, 16);

function guardarVisto() {
    try { localStorage.setItem(CLAVE, VERSION_TUTORIAL); } catch (e) { /* modo privado */ }
}

function yaVisto() {
    try { return localStorage.getItem(CLAVE) === VERSION_TUTORIAL; } catch (e) { return false; }
}

// ---------- Foco, fondo y scroll ----------

function objetivoDe(paso) {
    const selector = typeof paso.objetivo === 'function' ? paso.objetivo() : paso.objetivo;
    if (!selector) return null;
    const nodo = document.querySelector(selector);
    if (!nodo || !nodo.isConnected) return null;
    // Un objetivo escondido (por ejemplo la sidebar en una sección sin filtros)
    // no se puede iluminar: ese paso se saltea solo al armar el recorrido.
    const rect = nodo.getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    return nodo;
}

function pasosDisponibles() {
    return PASOS.filter(paso => paso.objetivo === null || objetivoDe(paso));
}

function bloquearFondo(activo) {
    ZONAS_INERTES.forEach(selector => {
        const nodo = document.querySelector(selector);
        if (nodo) nodo.inert = activo;
    });
    // Mismo bloqueo de scroll que la portada: el tour scrollea por su cuenta.
    document.documentElement.classList.toggle('tutorial-abierto', activo);
}

// ---------- Posicionamiento ----------

function colocarFoco(nodo) {
    const foco = document.querySelector('.tutorial-foco');
    if (!foco) return;
    if (!nodo) {
        // Paso de cierre: no hay nada que iluminar, pero el fondo sigue
        // oscurecido (una caja de 0x0 con la misma sombra tapa todo).
        foco.hidden = false;
        foco.style.top = '0px';
        foco.style.left = '0px';
        foco.style.width = '0px';
        foco.style.height = '0px';
        return;
    }
    const margen = 8;
    const r = nodo.getBoundingClientRect();
    // Recorte al viewport: si el objetivo es más alto que la ventana (el panel de
    // filtros, por ejemplo), el foco no se sale de pantalla. Nada de recortar
    // contra el header: los objetivos que viven adentro del header (el buscador)
    // quedan tapados por cualquier recorte, y el resto lo centra el tour.
    const arriba = Math.max(margen, Math.min(r.top - margen, window.innerHeight - margen));
    const abajo = Math.min(window.innerHeight - margen, Math.max(r.bottom + margen, arriba + margen));
    foco.hidden = false;
    foco.style.top = `${Math.round(arriba)}px`;
    foco.style.left = `${Math.round(Math.max(margen, r.left - margen))}px`;
    foco.style.width = `${Math.round(Math.min(window.innerWidth - margen * 2, r.width + margen * 2))}px`;
    foco.style.height = `${Math.round(abajo - arriba)}px`;
}

function colocarTarjeta(nodo) {
    const tarjeta = el('tutorial-card');
    if (!tarjeta) return;
    // El paso de cierre no tiene objetivo: la tarjeta se centra (en celular
    // queda abajo, como el resto). En celular la posición la decide el CSS con
    // .tutorial-card-arriba; en escritorio se calcula acá.
    tarjeta.classList.toggle('tutorial-card-centrada', !nodo);
    tarjeta.classList.remove('tutorial-card-arriba');
    tarjeta.style.top = '';
    tarjeta.style.left = '';
    if (!nodo) return;

    const margen = 12;
    const r = nodo.getBoundingClientRect();
    const caja = tarjeta.getBoundingClientRect();
    const ancho = caja.width || 380;
    const alto = caja.height || 200;

    if (ES_ANGOSTO()) {
        // Si el objetivo está en la mitad de abajo de la pantalla, el mensaje va
        // arriba (y al revés): así nunca tapa lo que está explicando. Es el caso
        // de las tarjetas del catálogo y del botón del copiloto, los dos abajo.
        const centroY = r.top + r.height / 2;
        if (centroY > window.innerHeight / 2) tarjeta.classList.add('tutorial-card-arriba');
        return;
    }

    const centradoVertical = () => Math.round(Math.max(margen, Math.min(
        r.top + r.height / 2 - alto / 2, window.innerHeight - alto - margen)));

    // Un objetivo más alto que la tarjeta (el panel de filtros) no entra ni
    // arriba ni abajo sin taparse a sí mismo: si hay lugar al costado, va al
    // lado, centrado verticalmente.
    if (r.height > alto + 40) {
        const espacioDerecha = window.innerWidth - r.right - margen;
        const espacioIzquierda = r.left - margen;
        if (espacioDerecha >= ancho && r.left + r.width / 2 < window.innerWidth / 2) {
            tarjeta.style.left = `${Math.round(r.right + margen)}px`;
            tarjeta.style.top = `${centradoVertical()}px`;
            return;
        }
        if (espacioIzquierda >= ancho) {
            tarjeta.style.left = `${Math.round(r.left - margen - ancho)}px`;
            tarjeta.style.top = `${centradoVertical()}px`;
            return;
        }
    }

    let izquierda = r.left + r.width / 2 - ancho / 2;
    izquierda = Math.max(margen, Math.min(izquierda, window.innerWidth - ancho - margen));
    const abajo = r.bottom + margen;
    const arriba = r.top - alto - margen;
    const top = (abajo + alto <= window.innerHeight - margen) ? abajo : Math.max(margen, arriba);
    tarjeta.style.left = `${Math.round(izquierda)}px`;
    tarjeta.style.top = `${Math.round(top)}px`;
}

function centrarObjetivo(nodo) {
    if (!nodo) return;
    // Lo que vive en el header fijo (el buscador) ya está siempre a la vista:
    // scrollearlo no cambia nada y movía la página al pedo.
    const header = document.querySelector('.hero');
    if (header && header.contains(nodo)) return;
    const r = nodo.getBoundingClientRect();
    const altoHeader = header ? header.getBoundingClientRect().height : 0;
    const visible = r.top >= altoHeader && r.bottom <= window.innerHeight;
    if (visible) return;
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    nodo.scrollIntoView({ block: 'center', behavior: suave ? 'smooth' : 'auto' });
}

// ---------- Pintado de cada paso ----------

function pintar() {
    const paso = pasosActivos[indice];
    if (!paso) return;
    const nodo = objetivoDe(paso);

    el('tutorial-paso').textContent = `Paso ${indice + 1} de ${pasosActivos.length}`;
    el('tutorial-titulo').textContent = paso.titulo;
    el('tutorial-texto').textContent = paso.texto;
    el('tutorial-anterior').hidden = indice === 0;
    el('tutorial-siguiente').textContent = indice === pasosActivos.length - 1 ? 'Terminar' : 'Siguiente';

    centrarObjetivo(nodo);
    // Un frame para que el scroll (suave) arranque antes de medir: si se mide
    // enseguida, el foco queda en la posición vieja y después no acompaña.
    enFrame(() => {
        colocarFoco(objetivoDe(paso));
        colocarTarjeta(objetivoDe(paso));
    });

    // El foco va al título para que el lector de pantalla anuncie el paso nuevo.
    const titulo = el('tutorial-titulo');
    if (titulo) titulo.focus({ preventScroll: true });
}

// ---------- Abrir y cerrar ----------

function alTeclado(evento) {
    if (evento.key === 'Escape') { evento.preventDefault(); cerrarTutorial(); return; }
    if (evento.key !== 'Tab') return;
    // Trampa de foco: la tarjeta es lo único operable del tutorial.
    const tarjeta = el('tutorial-card');
    const focales = [...tarjeta.querySelectorAll('button:not([hidden])')];
    if (!focales.length) return;
    const primero = focales[0];
    const ultimo = focales[focales.length - 1];
    if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo.focus(); }
    else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus(); }
}

// El tour scrollea solo (centra el objetivo), pero el scroll es suave: si se
// mide una sola vez, el foco y la tarjeta quedan donde estaba el objetivo antes
// de moverse. Con esto siguen al objetivo mientras la página se acomoda, y
// también si cambia el layout por otra razón (una imagen, la escala de fuente).
let framePosicion = 0;

function reposicionar() {
    if (!abierto || framePosicion) return;
    framePosicion = enFrame(() => {
        framePosicion = 0;
        const paso = pasosActivos[indice];
        if (!paso) return;
        const nodo = objetivoDe(paso);
        colocarFoco(nodo);
        colocarTarjeta(nodo);
    });
}

function alRedimensionar() { reposicionar(); }

export function cerrarTutorial() {
    if (!abierto) return;
    abierto = false;
    const contenedor = el('tutorial');
    if (contenedor) contenedor.hidden = true;
    document.removeEventListener('keydown', alTeclado, true);
    window.removeEventListener('resize', alRedimensionar);
    window.removeEventListener('scroll', reposicionar);
    bloquearFondo(false);
    // El foco vuelve a donde estaba: el buscador (donde lo deja la portada) o el
    // botón del pie si se relanzó desde ahí.
    const destino = disparador && disparador.isConnected ? disparador : el('searchInput');
    if (destino) destino.focus({ preventScroll: true });
    disparador = null;
}

function ir(delta) {
    const siguiente = indice + delta;
    if (siguiente < 0) return;
    if (siguiente >= pasosActivos.length) { cerrarTutorial(); return; }
    indice = siguiente;
    pintar();
}

export function iniciarTutorial(origen) {
    if (abierto) return;
    // El recorrido se arma con los objetivos que existen AHORA (una sección sin
    // filtros, un catálogo vacío o una vista sin tarjetas saltean su paso).
    pasosActivos = pasosDisponibles();
    if (!pasosActivos.length) return;

    // Estado base del catálogo: las pestañas y los filtros solo tienen sentido
    // en Educación Formal. No se tocan los filtros de la persona.
    if (estado.seccion !== 'formal') cambiarSeccion('formal');
    if (estado.vista !== 'carreras') cambiarVista('carreras');

    disparador = origen || null;
    indice = 0;
    abierto = true;
    const contenedor = el('tutorial');
    if (contenedor) contenedor.hidden = false;
    bloquearFondo(true);
    document.addEventListener('keydown', alTeclado, true);
    window.addEventListener('resize', alRedimensionar);
    window.addEventListener('scroll', reposicionar, { passive: true });
    pintar();
}

// ---------- Cableado ----------

export function configurarTutorial() {
    const contenedor = el('tutorial');
    if (!contenedor) return;

    el('tutorial-siguiente').addEventListener('click', () => { guardarVisto(); ir(1); });
    el('tutorial-anterior').addEventListener('click', () => ir(-1));
    el('tutorial-saltear').addEventListener('click', () => { guardarVisto(); cerrarTutorial(); });

    // Repetición a mano desde el pie. Acá no importa si ya lo vio.
    const boton = el('btnAbrirTutorial');
    if (boton) boton.addEventListener('click', () => iniciarTutorial(boton));

    // Primera visita: la portada avisa cuál de los dos caminos eligió. El
    // tutorial solo arranca si fue al catálogo; si eligió el orientador, no se
    // marca como visto y queda pendiente para la próxima.
    document.addEventListener('ben:bienvenida-cerrada', evento => {
        const destino = evento.detail && evento.detail.destino;
        if (destino !== 'catalogo' || yaVisto()) return;
        // Un respiro para que termine la salida de la portada y el foco llegue
        // al buscador antes de que el tutorial se ponga encima.
        setTimeout(() => iniciarTutorial(el('searchInput')), 260);
    });
}
