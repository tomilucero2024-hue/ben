// ==========================================
// Copiloto Vocacional: el chat, el test de orientacion y la busqueda por
// texto libre.
// ==========================================

import { ETIQUETAS_FUENTE, asegurarOrientadorListo, catalogosAparte, ofertas, plataformas } from './datos.js';
import { LIMITE_PAGINA, estado } from './estado.js';
import { cambiarSeccion, cambiarVista, mostrarResultados, renderizarCursosAparte, renderizarPlataformas, renderizarTarjetas, renderizarTarjetasConCompatibilidad } from './render.js';
import { capSeguro, escaparHTML, normalizarTexto, obtenerModalidades } from './util.js';

let pasoActual = 0;
let perfilUsuario = {}; // { analitico: 3, tecnologico: 2, ... } scores 0-5
let respuestasTest = []; // Array de { preguntaId, opcionTexto, dimensionScores }
let procesandoPasoChat = false;
let enTestVocacional = false;
// Historial de la conversación: cada entrada es { rol: 'bot'|'usuario', html }.
const historialChat = [];
let bubbleEscribiendo = null;
let orientadorListo = false;

// El copiloto es una burbuja flotante en la esquina inferior derecha, igual en
// todos los tamaños de pantalla. Comportamiento uniforme: abre y cierra por
// click; no hay modo "escritorio siempre abierto" ni "celular plegable".
function cambiarPanelCopiloto(abrir, { foco = true } = {}) {
    const ventana = document.getElementById('ventana-chat');
    const panel = document.getElementById('copilotoPanel');
    const boton = document.getElementById('btn-toggle-chat');
    if (!ventana) return;
    ventana.hidden = !abrir;
    if (panel) panel.classList.toggle('is-abierto', abrir);
    if (boton) boton.setAttribute('aria-expanded', String(abrir));
    if (!foco) return;
    // El foco no puede quedarse en un elemento que se acaba de ocultar. Sin
    // campo de texto, el foco va al primer control del chat (o a la ✕).
    if (abrir) setTimeout(() => {
        const cuerpo = document.getElementById('chat-caja');
        const primerControl = cuerpo && cuerpo.querySelector('button');
        const destino = primerControl || document.getElementById('btn-cerrar-chat');
        if (destino) destino.focus();
    }, 60);
    else if (boton && !(panel && panel.classList.contains('is-test-pantalla-completa'))) boton.focus();
}

// Cierra la burbuja y vuelve a dejar solo el botón circular. Durante el test a
// pantalla completa no aplica: ahí la ✕ (y Escape) salen del test, no pliegan.
export function cerrarChat() {
    const panel = document.getElementById('copilotoPanel');
    if (panel && panel.classList.contains('is-test-pantalla-completa')) return;
    cambiarPanelCopiloto(false);
}

// Modo "test a pantalla completa": el panel se estira sobre el viewport y se
// muestra la ventana de chat con el cuestionario guiado. Se entra desde la
// bienvenida.
function abrirTestPantallaCompleta() {
    const panel = document.getElementById('copilotoPanel');
    const ventana = document.getElementById('ventana-chat');
    if (!ventana || !panel) return;
    // La conversación se arma una sola vez (en configurarChat); acá solo se abre.
    if (historialChat.length === 0) {
        historialChat.push({ rol: 'bot', html: mensajeBienvenida() });
        renderizarChat();
    }
    panel.classList.add('is-test-pantalla-completa');
    cambiarPanelCopiloto(true, { foco: true });
}

// Salir del test a pantalla completa: fade-out del panel y vuelta a la burbuja
// cerrada. Es la transición "test → interfaz principal".
export function salirDelTest() {
    const panel = document.getElementById('copilotoPanel');
    if (!panel || !panel.classList.contains('is-test-pantalla-completa')) return;
    panel.classList.add('is-saliendo-test');
    let terminado = false;
    const limpiar = () => {
        if (terminado) return;
        terminado = true;
        panel.classList.remove('is-test-pantalla-completa', 'is-saliendo-test', 'is-abierto');
        const ventana = document.getElementById('ventana-chat');
        if (ventana) ventana.hidden = true;
        const boton = document.getElementById('btn-toggle-chat');
        if (boton) { boton.setAttribute('aria-expanded', 'false'); boton.focus(); }
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { limpiar(); return; }
    panel.addEventListener('transitionend', limpiar, { once: true });
    setTimeout(limpiar, 450);
}

export function configurarChat() {
    const abrir = document.getElementById('btn-toggle-chat');
    const cerrar = document.getElementById('btn-cerrar-chat');
    const ventana = document.getElementById('ventana-chat');

    // La conversación se arma una sola vez y la burbuja arranca cerrada: el
    // contenido queda listo para el primer click.
    if (historialChat.length === 0) {
        historialChat.push({ rol: 'bot', html: mensajeBienvenida() });
    }
    renderizarChat();
    cambiarPanelCopiloto(false, { foco: false });

    abrir.addEventListener('click', () => cambiarPanelCopiloto(ventana.hidden));
    cerrar.addEventListener('click', () => {
        const panel = document.getElementById('copilotoPanel');
        if (panel && panel.classList.contains('is-test-pantalla-completa')) salirDelTest();
        else cerrarChat();
    });
}

// ==========================================
// 🚪 PANTALLA DE BIENVENIDA
// ==========================================

// Bienvenida: puerta de entrada del sitio. Se muestra siempre que se entra SIN
// filtros/búsqueda en la URL; un link compartido (con parámetros) va directo al
// catálogo con esos filtros aplicados.
export function configurarBienvenida() {
    const pantalla = document.getElementById('pantallaBienvenida');
    if (!pantalla) return;

    // La bienvenida es la puerta de entrada del sitio y se muestra en CADA
    // visita, no solo en la primera. La unica excepcion es un link compartido o
    // una busqueda con parametros en la URL (?q=, ?area=…): ahi el visitante
    // quiere los resultados, no la portada.
    if (location.search.length > 0) {
        ocultarBienvenidaInstantanea();
    } else {
        alternarInertDetrasDeBienvenida(true);
    }

    const btnCopiloto = document.getElementById('btnBienvenidaCopiloto');
    const btnCarreras = document.getElementById('btnBienvenidaCarreras');
    const btnInstituciones = document.getElementById('btnBienvenidaInstituciones');
    const btnAreas = document.getElementById('btnBienvenidaAreas');
    if (btnCopiloto) btnCopiloto.addEventListener('click', () => {
        salirDeBienvenida(() => abrirTestPantallaCompleta());
    });
    if (btnCarreras) btnCarreras.addEventListener('click', () => {
        salirDeBienvenida(() => cambiarVista('carreras'));
    });
    if (btnInstituciones) btnInstituciones.addEventListener('click', () => {
        salirDeBienvenida(() => cambiarVista('instituciones'));
    });
    if (btnAreas) btnAreas.addEventListener('click', () => {
        salirDeBienvenida(() => cambiarVista('areas'));
    });
}

// El catálogo (y el header con su buscador) quedan inert mientras la bienvenida
// está encima: no hay nada visible con lo que interactuar. La burbuja del
// copiloto también: su botón de "Empezar" es el que está en la bienvenida.
function alternarInertDetrasDeBienvenida(activo) {
    [document.querySelector('.hero'), document.querySelector('.catalog-layout'), document.getElementById('copilotoPanel')]
        .forEach(el => { if (el) el.inert = activo; });
    // Y con el catálogo inert tampoco tiene sentido que se pueda scrollear:
    // la clase apaga el scroll de la página entera (ver style.css).
    document.documentElement.classList.toggle('bienvenida-abierta', activo);
    if (activo) window.scrollTo(0, 0);
}

function ocultarBienvenidaInstantanea() {
    const pantalla = document.getElementById('pantallaBienvenida');
    if (!pantalla) return;
    pantalla.hidden = true;
    pantalla.classList.remove('is-saliendo');
    alternarInertDetrasDeBienvenida(false);
}

// Transición de salida de la bienvenida (fade + subida leve). Al terminar se
// oculta y se ejecuta lo que llegue en "despues" (p.ej. abrir el test).
function salirDeBienvenida(despues) {
    const pantalla = document.getElementById('pantallaBienvenida');
    if (!pantalla || pantalla.hidden) { if (despues) despues(); return; }
    if (pantalla.classList.contains('is-saliendo')) return;
    pantalla.classList.add('is-saliendo');
    // Se entra al catálogo por arriba, siempre. El bloqueo de scroll ya evita
    // que el usuario se corra de lugar mientras mira la bienvenida, pero el
    // navegador puede restaurar una posición vieja al refrescar; sin esto se
    // aterriza a mitad de la grilla con el header todavía expandido.
    window.scrollTo(0, 0);
    alternarInertDetrasDeBienvenida(false);
    let terminado = false;
    const terminar = () => {
        if (terminado) return;
        terminado = true;
        pantalla.hidden = true;
        pantalla.classList.remove('is-saliendo');
        if (despues) despues();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { terminar(); return; }
    pantalla.addEventListener('transitionend', terminar, { once: true });
    setTimeout(terminar, 450);
}

// Todo lo que entra a un innerHTML pasa por acá. Los textos vienen de scrapear
// sitios de terceros, así que no son confiables: un nombre de carrera con un
// "<img onerror=...>" se ejecutaría como HTML. Escapa también las comillas, así
// que sirve igual para contenido de texto y para valores de atributo.
// Las preguntas ya contestadas siguen en el chat como transcripcion, con sus
// botones. Hay que dejarlos inertes: el handler aplica el INDICE del boton a la
// pregunta en curso, asi que tocar la 5a opcion de la pregunta 1 mientras se
// esta en la 2 contestaba la 2 con una opcion que el usuario nunca vio, y ademas
// guardaba en el historial el texto del boton viejo junto al puntaje de la
// pregunta nueva. Solo quedan vivos los controles del paso actual.
function apagarControlesViejos(chatCaja) {
    chatCaja.querySelectorAll('[data-chat-paso]').forEach(boton => {
        boton.disabled = !enTestVocacional || Number(boton.dataset.chatPaso) !== pasoActual;
    });
}

function renderizarChat() {
    const chatCaja = document.getElementById('chat-caja');
    chatCaja.innerHTML = historialChat.map(m => m.rol === 'bot'
        ? `<div class="mensaje-bot">${m.html}</div>`
        : `<div class="mensaje-usuario">${m.html}</div>`).join('');
    apagarControlesViejos(chatCaja);
    chatCaja.scrollTop = chatCaja.scrollHeight;

    // Se anuncia solo la última respuesta del bot, no el historial entero.
    const anuncio = document.getElementById('chat-anuncio');
    const ultimoBot = [...historialChat].reverse().find(m => m.rol === 'bot');
    if (anuncio && ultimoBot) {
        const tmp = document.createElement('div');
        tmp.innerHTML = ultimoBot.html;
        anuncio.textContent = tmp.textContent.replace(/\s+/g, ' ').trim();
    }
}

// La barra de progreso del test vive arriba del chat, fuera del scroll.
function actualizarProgresoChat() {
    const barra = document.getElementById('chat-progreso');
    if (!barra) return;
    if (!enTestVocacional) {
        barra.hidden = true;
        return;
    }
    barra.hidden = false;
    const preguntas = obtenerPreguntasTest();
    const total = preguntas.length || 5;
    const pasoVisible = Math.min(pasoActual + 1, total);
    const porcentaje = Math.round((pasoActual / total) * 100);
    barra.innerHTML = `
        <div class="chat-progreso" role="progressbar" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso del test">
            <span style="width: ${porcentaje}%"></span>
        </div>
        <p class="chat-progreso-texto">Pregunta ${pasoVisible} de ${total}</p>`;
}

function mostrarEscribiendo() {
    const chatCaja = document.getElementById('chat-caja');
    bubbleEscribiendo = document.createElement('div');
    bubbleEscribiendo.className = 'mensaje-bot mensaje-escribiendo';
    bubbleEscribiendo.setAttribute('aria-hidden', 'true');
    bubbleEscribiendo.innerHTML = '<span></span><span></span><span></span>';
    chatCaja.appendChild(bubbleEscribiendo);
    chatCaja.scrollTop = chatCaja.scrollHeight;
}

function quitarEscribiendo() {
    if (bubbleEscribiendo && bubbleEscribiendo.parentNode) {
        bubbleEscribiendo.parentNode.removeChild(bubbleEscribiendo);
    }
    bubbleEscribiendo = null;
}

function sugerenciasChips(lista) {
    return `<div class="chat-sugerencias">${lista.map(s =>
        `<button type="button" class="btn-chat-sugerencia" data-chat-enviar="${escaparHTML(s)}">${escaparHTML(s)}</button>`
    ).join('')}</div>`;
}

// Pantalla de bienvenida del copiloto: en vez de explicar el test con un
// párrafo, lo muestra. Es la única burbuja del chat que no se ve como burbuja
// (el CSS le saca el fondo vía :has), porque hace de portada del modal.
// Los SVG son inline y de trazo: siguen a currentColor y al tema solos.
function iconoCopiloto(nombre) {
    const trazos = {
        // Brújula: "te ayudo a encontrar tu dirección".
        brujula: '<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.2 5-5 2.2 2.2-5z"/>',
        // Paso 1: lista de preguntas con un tilde.
        lista: '<path d="M10 7h9M10 12h9M10 17h5"/><path d="m4 7 1.4 1.4L8 5.8"/><path d="M4.5 12h1M4.5 17h1"/>',
        // Paso 2: análisis, barras que crecen más un destello.
        analisis: '<path d="M5 19V13M10 19V9M15 19v-4"/><path d="M19.5 4.5v4M17.5 6.5h4"/><path d="M4 21h16"/>',
        // Paso 3: la diana, el resultado.
        diana: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
        // Reloj del badge de tiempo.
        reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
        // Flecha del botón principal.
        flecha: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>'
    };
    return `<svg class="cb-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true" focusable="false">${trazos[nombre] || ''}</svg>`;
}

// Un paso del mini timeline. El número es decorativo: el <ol> ya numera para
// quien usa lector de pantalla.
function pasoCopiloto(n, icono, texto) {
    return `<li class="cb-paso">
            <span class="cb-paso-icono" aria-hidden="true">${iconoCopiloto(icono)}</span>
            <span class="cb-paso-cuerpo">
                <span class="cb-paso-num" aria-hidden="true">Paso ${n}</span>
                <span class="cb-paso-texto">${texto}</span>
            </span>
        </li>`;
}

// El camino recomendado es el test guiado, así que va primero y con el botón
// destacado. La búsqueda libre queda como atajo para quien ya sabe qué busca:
// el botón secundario delega en el ✕ del header, que ya sabe si hay que cerrar
// la ventanita o salir del modo pantalla completa.
function mensajeBienvenida() {
    return `<div class="copiloto-bienvenida">
            <div class="cb-header">
                <span class="cb-icono" aria-hidden="true">${iconoCopiloto('brujula')}</span>
                <span class="cb-titulos">
                    <h2 class="cb-titulo">Copiloto Vocacional</h2>
                    <p class="cb-subtitulo">Encontrá tu carrera ideal en 2 minutos</p>
                </span>
            </div>
            <ol class="cb-pasos">
                ${pasoCopiloto(1, 'lista', 'Respondés 5 preguntas cortas')}
                ${pasoCopiloto(2, 'analisis', 'Analizamos tus intereses')}
                ${pasoCopiloto(3, 'diana', 'Te mostramos las carreras que más encajan')}
            </ol>
            <p class="cb-tiempo">${iconoCopiloto('reloj')}<span>Toma menos de 2 minutos</span></p>
            <button type="button" class="cb-cta" data-chat-accion="test">
                <span>Empezar el test</span>${iconoCopiloto('flecha')}
            </button>
            <button type="button" class="cb-salida"
                data-chat-accion="cerrar">Prefiero buscar por mi cuenta</button>
            <p class="cb-aviso-legal"><small>Herramienta orientativa de exploración. No constituye un diagnóstico psicopedagógico.</small></p>
        </div>`;
}

function mensajeAyuda() {
    return `<p><img class="chat-bot-icon" src="/img/copiloto-icono.png" alt="" width="16" height="16"> Puedo ayudarte con la <strong>oferta educativa de Mendoza</strong>. Por ejemplo:</p>
        <ul>
            <li>🎓 <strong>Carreras por tema:</strong> "carreras de informática", "algo de salud", "diseño"</li>
            <li>⏳ <strong>Dudas sobre una carrera:</strong> "¿cuánto dura medicina?", "¿enfermería es online?"</li>
            <li>🏛️ <strong>Por institución:</strong> "qué ofrece la UNCuyo", "carreras de la UTN"</li>
            <li>💻 <strong>Modalidad:</strong> "carreras online", "a distancia"</li>
            <li>🔧 <strong>Oficios y formaciones:</strong> "cursos de oficios", "formaciones cortas"</li>
        </ul>
        ${sugerenciasChips(['carreras de informática', '¿cuánto dura medicina?', 'qué ofrece la UNCuyo', 'hacer el test vocacional'])}`;
}

function obtenerPreguntasTest() {
    return (typeof Orientador !== 'undefined' && Orientador.PREGUNTAS_TEST) ? Orientador.PREGUNTAS_TEST : [];
}

async function iniciarTestVocacional() {
    pasoActual = 0;
    perfilUsuario = {};
    respuestasTest = [];
    enTestVocacional = true;
    procesandoPasoChat = false;
    historialChat.length = 0;
    historialChat.push({ rol: 'bot', html: '<p>🎯 Perfecto. Te hago <strong>5 preguntas</strong> para mapear tu perfil multidimensional. Respondé eligiendo una de las opciones.</p>' });
    
    // Asegurar que Orientador cargó los perfiles (lazy loading)
    mostrarEscribiendo();
    await asegurarOrientadorListo();
    quitarEscribiendo();

    actualizarProgresoChat();
    mostrarPregunta();
}

function mostrarPregunta() {
    const preguntasTest = obtenerPreguntasTest();
    const preguntaObj = preguntasTest[pasoActual];
    if (!preguntaObj) return;
    const opciones = (preguntaObj.opciones || [])
        .map((opcion, idx) => `<button type="button" class="btn-chat-opcion" data-chat-paso="${pasoActual}" data-chat-opcion="${idx}" data-chat-opcion-texto="${escaparHTML(opcion.texto)}">${escaparHTML(opcion.texto)}</button>`)
        .join('');

    historialChat.push({ rol: 'bot', html: `
        <p><img class="chat-bot-icon" src="/img/copiloto-icono.png" alt="" width="16" height="16"> <strong>Orientador:</strong> ${escaparHTML(preguntaObj.texto)}</p>
        <div class="opciones-usuario">${opciones}</div>
        ${pasoActual > 0 ? `<button type="button" class="btn-chat-atras" data-chat-paso="${pasoActual}" data-chat-accion="atras">← Volver a la pregunta anterior</button>` : ''}` });
    actualizarProgresoChat();
    renderizarChat();
}

// Para que se pueda llamar desde los botones inyectados en el HTML
function seleccionarOpcionChat(opcionIdx, textoOpcion, pasoOpcion) {
    if (procesandoPasoChat) return;

    // Las preguntas ya respondidas siguen en el historial del chat, con sus
    // botones intactos: si el usuario sube y toca uno cuando el test ya terminó,
    // preguntasTest[pasoActual] es undefined y reventaba con un TypeError.
    // Fuera del test esos botones simplemente no hacen nada.
    const preguntasTest = obtenerPreguntasTest();
    const preguntaObj = preguntasTest[pasoActual];
    if (!enTestVocacional || !preguntaObj) return;
    // Y con el test en curso hay que mirar de QUÉ pregunta salió el botón: el
    // índice de una opción solo significa algo dentro de su propia pregunta.
    // apagarControlesViejos() ya los deja disabled; esto cubre el caso de que
    // el clic llegue igual (por ejemplo si el bloque se pintó fuera de tiempo).
    if (Number.isFinite(pasoOpcion) && pasoOpcion !== pasoActual) return;
    const opcion = preguntaObj.opciones[opcionIdx];
    if (!opcion) return;

    procesandoPasoChat = true;
    
    // Acumular scores dimensionales
    if (opcion.dimensionScores && typeof Orientador !== 'undefined') {
        Orientador.DIMENSIONES.forEach(d => {
            const val = opcion.dimensionScores[d] || 0;
            perfilUsuario[d] = (perfilUsuario[d] || 0) + val;
        });
    }
    
    respuestasTest.push({
        preguntaId: preguntaObj.id,
        opcionTexto: textoOpcion,
        dimensionScores: opcion.dimensionScores
    });
    
    pasoActual++;

    historialChat.push({ rol: 'usuario', html: '<p>' + escaparHTML(textoOpcion) + '</p>' });
    mostrarEscribiendo();

    setTimeout(() => {
        quitarEscribiendo();
        procesandoPasoChat = false;
        if (pasoActual >= preguntasTest.length) {
            mostrarRecomendacion();
        } else {
            mostrarPregunta();
        }
    }, 450);
};

function volverPreguntaChat() {
    if (procesandoPasoChat || pasoActual === 0) return;
    // Descarta del historial la pregunta actual, la respuesta del usuario Y la
    // pregunta a la que se vuelve: mostrarPregunta() la vuelve a pintar al
    // final. Con solo dos pop() quedaba la vieja + la nueva y la pregunta se
    // veía repetida dos veces seguidas en el chat.
    historialChat.pop();
    historialChat.pop();
    historialChat.pop();
    pasoActual--;
    
    // Revertir scores dimensionales
    const ultimaRespuesta = respuestasTest.pop();
    if (ultimaRespuesta && ultimaRespuesta.dimensionScores) {
        Orientador.DIMENSIONES.forEach(d => {
            const val = ultimaRespuesta.dimensionScores[d] || 0;
            perfilUsuario[d] = Math.max(0, (perfilUsuario[d] || 0) - val);
        });
    }
    
    actualizarProgresoChat();
    mostrarPregunta();
};

function reiniciarChat() {
    pasoActual = 0;
    perfilUsuario = {};
    respuestasTest = [];
    enTestVocacional = false;
    procesandoPasoChat = false;
    historialChat.length = 0;
    actualizarProgresoChat();
    historialChat.push({ rol: 'bot', html: mensajeBienvenida() });
    renderizarChat();
};




// Preguntas del test vocacional - Usando las del módulo Orientador

const PALABRAS_VACIAS = new Set('a al algo alguna algunas algunos aunque asi bien como con contra cual cuales cuando cuanto cuantos de del desde donde el en entre eres es esa esas ese esos esta estas este esto estoy fue habia hay hasta la las lo los mas me mi mis muy ni no nos o para pero por porque que quien se segun ser si sin sobre su sus te tener todo todos tu tus un una uno unos va vos y ya quiero quiere necesito busco buscar encontrame mostrame estudiar estudio estudios carrera carreras algo tengo podrias podes puedo mejor tener queria gustaria otra tambien'.split(' '));

// Sinónimos por área, normalizados (sin acentos). El bot los usa para entender
// la intención del usuario y compararla con el campo `area` que ya calcula getArea().
const SINONIMOS_AREA = {
    'Tecnología': ['tecnolog', 'informatic', 'programacion', 'programar', 'programador', 'sistema', 'software', 'computacion', 'computador', 'datos', 'ciberseguridad', 'robotica', 'videojuego', 'inteligencia artificial', 'redes', 'cloud', 'desarroll', 'analista de sistemas', 'base de datos', 'web'],
    'Ingeniería': ['ingenier', 'industrial', 'electronica', 'electrica', 'civil', 'petroleo', 'mineria', 'minas', 'alimentos', 'agrimensor', 'biomedica'],
    'Salud': ['salud', 'medic', 'enfermer', 'kinesi', 'nutric', 'odontolog', 'farmac', 'fonoaudiolog', 'obstetric', 'terapia', 'bioquimic', 'radiolog', 'anestesia', 'instrumentacion quirurgica', 'veterinari', 'podolog', 'quirofano'],
    'Negocios': ['negocio', 'administrac', 'contador', 'contabilidad', 'marketing', 'comercio', 'comercial', 'finanza', 'economia', 'recursos humanos', 'logistica', 'secretariado', 'gestion', 'gerenci', 'ventas'],
    'Diseño': ['disen', 'arquitect', 'multimedia', 'interior', 'indumentaria', 'animacion', 'grafico', 'grafica', 'ux', 'diseno'],
    'Educación': ['educacion', 'docente', 'docencia', 'profesor', 'profesorado', 'pedagog', 'didact', 'ensenar', 'maestro', 'nivel inicial', 'nivel primario', 'nivel secundario'],
    'Turismo': ['turismo', 'hoteler', 'guia de turismo', 'viaje', 'hotel'],
    'Gastronomía': ['gastronom', 'cocina', 'cocinar', 'pasteleria', 'panaderia', 'chef'],
    'Idiomas': ['idioma', 'idiomas', 'ingles', 'portugues', 'frances', 'italiano', 'chino', 'coreano', 'aleman', 'japones', 'traduccion', 'interpretacion', 'lengua'],
    'Arte': ['arte', 'musica', 'teatro', 'escenograf', 'danza', 'cine', 'fotograf', 'audiovisual', 'ilustracion', 'canto', 'coral', 'organo', 'instrumento', 'ceramica', 'literatura'],
    'Ambiente': ['ambiente', 'ambiental', 'agronom', 'biolog', 'geolog', 'forestal', 'quimic', 'hidric', 'sustentabilidad', 'ecologia', 'energias renovables'],
    'Oficios': ['oficio', 'mecanic', 'electric', 'carpinter', 'refrigeracion', 'soldadur', 'construccion', 'automotor', 'gasista', 'plomer', 'pintor', 'torner', 'herreria'],
    'Ciencias sociales': ['social', 'derecho', 'leyes', 'abogac', 'comunicacion', 'periodismo', 'historia', 'sociologia', 'antropologia', 'filosofia', 'politicas', 'trabajo social', 'relaciones publicas', 'psicolog']
};

// Acrónimos y formas cortas de las instituciones. Las claves van sin acentos.
const ALIASES_INSTITUCION = {
    'uncuyo': 'Universidad Nacional de Cuyo (UNCuyo)',
    'nacional de cuyo': 'Universidad Nacional de Cuyo (UNCuyo)',
    'utn': 'UTN Facultad Regional Mendoza',
    'tecnologica nacional': 'UTN Facultad Regional Mendoza',
    'uda': 'Universidad del Aconcagua (UDA)',
    'aconcagua': 'Universidad del Aconcagua (UDA)',
    'umaza': 'Universidad Juan Agustín Maza (UMaza)',
    'maza': 'Universidad Juan Agustín Maza (UMaza)',
    'universidad de mendoza': 'Universidad de Mendoza (UM)',
    'uch': 'Universidad Champagnat (UCh)',
    'champagnat': 'Universidad Champagnat (UCh)',
    'uca': 'Universidad Católica Argentina (UCA)',
    'catolica': 'Universidad Católica Argentina (UCA)',
    'universidad de congreso': 'Universidad de Congreso (UC)',
    'congreso': 'Universidad de Congreso (UC)',
    'siglo 21': 'Universidad Siglo 21 (S21)',
    'iuce': 'Instituto Univ. de Ciencias Empresariales (IUCE)',
    'ciencias empresariales': 'Instituto Univ. de Ciencias Empresariales (IUCE)',
    'gutenberg': 'Instituto Juan Gutenberg',
    'chopin': 'Instituto de Arte Chopin',
    'imei': 'Instituto Maipú de Educación Integral (IMEI)',
    'trinidad': 'Instituto Santísima Trinidad',
    'rayuela': 'Fundación Rayuela',
    'intercultural': 'Intercultural Cursos de Idiomas',
    'malvinas': 'Escuela Internacional Islas Malvinas',
    'epd': 'Escuela de Periodismo Deportivo de Mendoza (EPD)',
    'periodismo deportivo': 'Escuela de Periodismo Deportivo de Mendoza (EPD)',
    'psicologia social': 'Escuela de Psicología Social',
    'fabian calle': 'Instituto Fabián Calle',
    'insutec': 'INSUTEC (Instituto Superior de Educación Tecnológica)',
    'isteec': 'ISTEEC (IES 9-013)',
    'iesvu': 'IESVU (IES 9-015 Valle de Uco)',
    'valle de uco': 'IESVU (IES 9-015 Valle de Uco)',
    'ief': 'IEF - Instituto de Educación Física (IES 9-016)',
    'educacion fisica': 'IEF - Instituto de Educación Física (IES 9-016)',
    'itu': 'ITU - Instituto Tecnológico Universitario (UNCuyo)',
    'godoy cruz': 'IES 9-002 Tomás Godoy Cruz',
    'san martin': 'IES 9-001 Gral. José de San Martín',
    'belgrano': 'IES 9-008 Manuel Belgrano',
    'san rafael': 'IES 9-003 Normal (San Rafael)',
    'luzuriaga': 'IES 9-004 Gral. Toribio de Luzuriaga',
    'tupungato': 'IES 9-009 (Tupungato)',
    'malargue': 'IES 9-018 (Malargüe)',
    'lavalle': 'IES 9-024 (Lavalle)',
    'santa rosa': 'IES 9-028 (Santa Rosa)',
    'lujan de cuyo': 'IES 9-029 (Luján de Cuyo)',
    'bicentenario': 'IES 9-030 (Instituto del Bicentenario)',
    'tolosa': 'IES 9-006 Francisco H. Tolosa',
    'atuel': 'IES 9-011 Del Atuel',
    'cine y video': 'Escuela Regional Cuyo de Cine y Video (IES 9-017)'
};

function incluyeFrase(texto, frase) {
    return /\s/.test(frase) ? texto.includes(frase) : new RegExp(`\\b${frase}`, 'i').test(texto);
}

function detectarAreas(texto) {
    const encontradas = new Set();
    for (const [area, sinonimos] of Object.entries(SINONIMOS_AREA)) {
        if (sinonimos.some(sinonimo => incluyeFrase(texto, sinonimo))) encontradas.add(area);
    }
    return [...encontradas];
}

function detectarFormacion(texto) {
    if (incluyeFrase(texto, 'profesorado') || incluyeFrase(texto, 'docencia') || incluyeFrase(texto, 'ensenar')) return 'profesorados';
    if (incluyeFrase(texto, 'tecnic') || incluyeFrase(texto, 'terciario')) return 'tecnicaturas';
    if (incluyeFrase(texto, 'curso') || incluyeFrase(texto, 'cursos') || incluyeFrase(texto, 'formacion profesional') || incluyeFrase(texto, 'capacitacion') || incluyeFrase(texto, 'taller')) return 'cursos';
    if (incluyeFrase(texto, 'grado') || incluyeFrase(texto, 'licenciatura') || incluyeFrase(texto, 'universitari')) return 'grado';
    return null;
}

function detectarModalidad(texto) {
    if (incluyeFrase(texto, 'presencial')) return 'presencial';
    if (incluyeFrase(texto, 'hibrido') || incluyeFrase(texto, 'hibrida') || incluyeFrase(texto, 'mixta')) return 'hibrida';
    if (incluyeFrase(texto, 'online') || incluyeFrase(texto, 'virtual') || incluyeFrase(texto, 'a distancia') || incluyeFrase(texto, 'distancia')) return 'online';
    return null;
}

function detectarInstitucion(texto) {
    // Primero el nombre completo, tal como figura en los datos.
    const porNombre = ofertas.find(oferta => texto.includes(normalizarTexto(oferta.institucion)));
    if (porNombre) return porNombre.institucion;
    // Después los acrónimos y formas cortas.
    for (const [alias, canonical] of Object.entries(ALIASES_INSTITUCION)) {
        if (incluyeFrase(texto, alias)) return canonical;
    }
    return null;
}

function obtenerTokens(texto) {
    const tokens = new Set();
    texto.split(/[^a-z0-9]+/).forEach(t => {
        if (t.length < 3 || PALABRAS_VACIAS.has(t)) return;
        tokens.add(t);
    });
    return [...tokens];
}

function buscarCarrerasPorNombre(texto) {
    const tokens = obtenerTokens(texto).filter(t => t.length >= 4);
    if (!tokens.length) return [];
    return ofertas.filter(oferta => {
        const nombre = normalizarTexto(oferta.nombre);
        return tokens.some(t => nombre.includes(t));
    });
}

function dedupePorNombre(lista) {
    const vistos = new Set();
    return lista.filter(item => {
        const clave = normalizarTexto(item.nombre);
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
    });
}

function puntuarOfertaLibre(oferta, contexto) {
    const texto = normalizarTexto(`${oferta.nombre} ${oferta.categoria} ${oferta.facultad} ${oferta.institucion}`);
    let score = 0;
    const motivos = [];

    if (contexto.areas.length && contexto.areas.includes(oferta.area)) {
        score += 5;
        motivos.push('encaja con el área que buscás');
    }
    if (contexto.formacion) {
        if (oferta.formacion === contexto.formacion) { score += 3; motivos.push('es el nivel de formación que buscás'); }
        else if (contexto.formacion === 'grado' && oferta.formacion === 'profesorados') { score += 2; }
    }
    if (contexto.modalidad && oferta.modalidades.includes(contexto.modalidad)) {
        score += 3;
        motivos.push(`se cursa ${contexto.modalidad}`);
    }
    if (contexto.institucion && oferta.institucion === contexto.institucion) {
        score += 6;
        motivos.push('la dicta la institución que mencionaste');
    }
    contexto.tokens.forEach(t => {
        if (t.length >= 3 && texto.includes(t)) {
            score += 2;
            motivos.push(`coincide con "${t}"`);
        }
    });
    contexto.excluir.forEach(area => {
        if (oferta.area === area) score -= 6;
    });

    return { score, motivos };
}

function detectarAreaPrincipal(texto) {
    const areas = detectarAreas(texto);
    return areas.length ? areas[0] : null;
}

// Convierte un curso de los catálogos aparte al mismo modelo que una oferta
// formal, para puntuarlo con el mismo motor y mostrarlo en la misma grilla.
function cursoComoOferta(curso, fuente) {
    const texto = normalizarTexto(`${curso.nombre} ${curso.institucion} ${curso.categoria}`);
    return {
        nombre: curso.nombre,
        categoria: curso.categoria,
        area: detectarAreaPrincipal(texto) || 'Formación',
        gestion: 'privada',
        modalidad: curso.modalidad,
        duracion: curso.duracion,
        facultad: curso.provincia || '',
        institucion: curso.institucion,
        link: curso.link || '',
        formacion: 'cursos',
        modalidades: obtenerModalidades(curso.modalidad),
        fuente
    };
}

// Búsqueda combinada: educación formal + oficios + formaciones alternativas.
function obtenerResultadosGlobales(texto, contexto) {
    const resultados = [];

    ofertas.forEach(oferta => {
        const p = puntuarOfertaLibre(oferta, contexto);
        if (p.score > 0) {
            // Clon: no tocamos el oferta original para no contaminar la búsqueda del sitio.
            resultados.push({ ...oferta, score: p.score, motivos: p.motivos, fuente: 'formal' });
        }
    });

    Object.entries(catalogosAparte).forEach(([clave, catalogo]) => {
        const esOficios = clave === 'oficios-tecnicos';
        const interesCatalogo = esOficios
            ? contexto.areas.includes('Oficios') || contexto.tokens.some(t => t.startsWith('ofici'))
            : contexto.tokens.some(t => t.startsWith('formacion') || t.startsWith('curso') || t.startsWith('capacitacion') || t.startsWith('taller'));
        const aportes = [];
        catalogo.cursos.forEach(curso => {
            const comoOferta = cursoComoOferta(curso, clave);
            const p = puntuarOfertaLibre(comoOferta, contexto);
            const matchea = p.score > 0;
            let score = p.score;
            if (interesCatalogo) {
                score = matchea ? score + 2 : 1;
            }
            if (score > 0) {
                comoOferta.score = score;
                comoOferta.motivos = matchea ? p.motivos : ['es del catálogo que mencionaste'];
                aportes.push(comoOferta);
            }
        });
        aportes.sort((a, b) => b.score - a.score);
        resultados.push(...aportes.slice(0, 25));
    });

    return resultados.sort((a, b) => b.score - a.score).slice(0, 60);
}

function responderTextoLibre(texto) {
    // Empezar el test guiado
    if (/test vocacional|hacer el test|empezar el test|orientacion/.test(texto)) {
        return { accion: 'test' };
    }

    // Saludos
    if (/^(hola|buenas|buen dia|buenas tardes|buenas noches|hey|que tal|buenas)/.test(texto)) {
        return { html: `<p>👋 ¡Hola! Soy el <strong>Copiloto Vocacional</strong>. Contame qué te gustaría estudiar o hacé el test para mapear tu perfil.</p>
            ${sugerenciasChips(['carreras de informática', '¿cuánto dura medicina?', 'qué ofrece la UNCuyo', 'carreras online'])}` };
    }

    // Ayuda / capacidades
    if (/ayuda|no entiendo|que podes hacer|que sabes hacer|que haces|como funciona|que es esto|que puedo preguntar|que puedo escribir|que preguntas/.test(texto)) {
        return { html: mensajeAyuda() };
    }

    const areas = detectarAreas(texto);
    const institucion = detectarInstitucion(texto);
    const formacion = detectarFormacion(texto);
    const modalidad = detectarModalidad(texto);
    const tokens = obtenerTokens(texto);
    const pideExcluir = /no (me gusta|quiero|me interesa|me copa)|odio|no me va|prefiero evitar|no quiero/.test(texto);
    const excluir = pideExcluir
        ? detectarAreas(texto.replace(/no (me gusta|quiero|me interesa|me copa)|odio|no me va|prefiero evitar|no quiero/g, ' '))
        : [];

    // "Qué ofrece X" / "carreras de X" (por institución)
    if (institucion) {
        let carreras = ofertas.filter(oferta => oferta.institucion === institucion);
        const tokensTema = tokens.filter(t => t.length >= 4 && !incluyeFrase(normalizarTexto(institucion), t));
        if (tokensTema.length) {
            const conMatch = carreras.filter(oferta =>
                tokensTema.some(t => normalizarTexto(`${oferta.nombre} ${oferta.categoria}`).includes(t)));
            if (conMatch.length) carreras = conMatch;
        }
        if (carreras.length) {
            const lista = carreras.slice(0, 8).map(c =>
                `<li><strong>${escaparHTML(c.nombre)}</strong> — ${escaparHTML(c.categoria)} · ${escaparHTML(c.duracion)}</li>`).join('');
            const mas = carreras.length > 8 ? `<li>… y ${carreras.length - 8} más.</li>` : '';
            return {
                html: `<p>🏛️ <strong>${escaparHTML(institucion)}</strong> ofrece <strong>${carreras.length} ${carreras.length === 1 ? 'carrera' : 'carreras'}</strong> en nuestra base. Algunas:</p><ul>${lista}${mas}</ul>`,
                resultados: carreras.slice(0, 40).map(c => { c.score = 6; c.motivos = ['la dicta la institución que mencionaste']; return c; }),
                seccion: 'formal'
            };
        }
    }

    // Preguntas concretas sobre una carrera (duración, modalidad, dónde)
    const pideDuracion = /cuanto dura|cuantos anios|cual es la duracion|cuanto tarda|que duracion/.test(texto);
    const pideModalidad = /como se cursa|modalidad|es presencial|es online|es a distancia/.test(texto);
    const pideLugar = /donde (se estudia|estudiar|puedo estudiar)|en que (instituto|universidad|institucion)|que instituciones|que universidades|donde lo dan|donde la dan/.test(texto);
    if (pideDuracion || pideModalidad || pideLugar) {
        const coincidencias = dedupePorNombre(buscarCarrerasPorNombre(texto));
        if (coincidencias.length) {
            const items = coincidencias.slice(0, 6).map(c => {
                let dato = '';
                if (pideDuracion) dato = `⏳ <strong>${escaparHTML(c.duracion)}</strong>`;
                if (pideModalidad) dato = `💬 ${c.modalidades.map(m => `<strong>${escaparHTML(m)}</strong>`).join(' / ')}`;
                if (pideLugar) dato = `🏛️ <strong>${escaparHTML(c.institucion)}</strong>${c.facultad ? ` (${escaparHTML(c.facultad)})` : ''}`;
                return `<li><strong>${escaparHTML(c.nombre)}</strong> — ${dato}</li>`;
            }).join('');
            return {
                html: `<p><img class="chat-bot-icon" src="/img/copiloto-icono.png" alt="" width="16" height="16"> Sobre eso encontré esto en nuestra base:</p><ul>${items}</ul><p class="mensaje-bot-nota">También te las dejo en la pantalla principal.</p>`,
                resultados: coincidencias.slice(0, 40).map(c => { c.score = 6; c.motivos = []; return c; }),
                seccion: 'formal'
            };
        }
    }

    // Plataformas online
    if (/plataforma|coderhouse|soy henry|digital house|nucba|educacion it|teclab|mindhub|image campus|da vinci|cursos online|curso online/.test(texto)) {
        const coincidencias = plataformas.filter(p => {
            const buscar = normalizarTexto(`${p.nombre} ${p.resumen}`);
            return tokens.some(t => t.length > 2 && buscar.includes(t)) || /plataforma|cursos online|curso online/.test(texto);
        });
        const lista = coincidencias.length ? coincidencias : plataformas;
        return {
            html: `<p>💻 Estas son las <strong>plataformas online</strong> de nuestra base${coincidencias.length ? ' que coinciden con lo que buscás' : ''}:</p>
                <ul>${lista.slice(0, 9).map(p => `<li><strong>${escaparHTML(p.nombre)}</strong> — ${escaparHTML(p.resumen)}</li>`).join('')}</ul>`,
            resultados: lista,
            seccion: 'plataformas'
        };
    }

    // Búsqueda global: educación formal + oficios + formaciones alternativas.
    const contexto = { areas, formacion, modalidad, institucion: null, tokens, excluir };
    const resultados = obtenerResultadosGlobales(texto, contexto);

    if (!resultados.length) {
        return { html: `<p><img class="chat-bot-icon" src="/img/copiloto-icono.png" alt="" width="16" height="16"> Hmm, no encontré coincidencias con "<strong>${escaparHTML(texto)}</strong>". Probá con palabras más generales (ej: <em>salud</em>, <em>tecnología</em>, <em>oficios</em>) o contame qué te gusta hacer.</p>
            ${sugerenciasChips(['quiero algo de salud', 'carreras de tecnología', 'cursos de oficios', 'hacer el test vocacional'])}` };
    }

    const resumen = [];
    if (contexto.areas.length) resumen.push(contexto.areas.join(' / '));
    if (contexto.formacion) resumen.push(contexto.formacion);
    if (contexto.modalidad) resumen.push(contexto.modalidad);
    const detalle = resumen.length ? ` buscando <strong>${escaparHTML(resumen.join(', '))}</strong>` : '';
    const n = resultados.length;
    const top = resultados.slice(0, 5);
    const lista = top.map(r => `<li><strong>${escaparHTML(r.nombre)}</strong> — ${escaparHTML(r.institucion)}</li>`).join('');
    const fuentes = escaparHTML([...new Set(resultados.map(r => r.fuente))]
        .map(f => ETIQUETAS_FUENTE[f] || f).join(', '));

    return {
        html: `<p><img class="chat-bot-icon" src="/img/copiloto-icono.png" alt="" width="16" height="16"> Encontré <strong>${n} ${n === 1 ? 'opción' : 'opciones'}</strong>${detalle}, entre ${fuentes}. Las más destacadas:</p><ul>${lista}</ul><p class="mensaje-bot-nota">Te las dejé en la pantalla principal, ordenadas por compatibilidad y con su origen marcado.</p>`,
        resultados,
        seccion: 'formal'
    };
}

function renderResultadosChat(respuesta) {
    if (respuesta.seccion === 'formal') {
        cambiarSeccion('formal');
        const contadorElem = document.getElementById('resultsCount');
        if (contadorElem) {
            contadorElem.textContent = `${respuesta.resultados.length.toLocaleString('es-AR')} ${respuesta.resultados.length === 1 ? 'carrera encontrada' : 'carreras encontradas'}`;
        }
        renderizarTarjetas(respuesta.resultados, { mostrarMatch: true });
    } else if (respuesta.seccion === 'plataformas') {
        cambiarSeccion('plataformas');
        renderizarPlataformas(document.getElementById('contenedor-plataformas'), respuesta.resultados);
    } else {
        cambiarSeccion(respuesta.seccion);
        renderizarCursosAparte(document.getElementById(catalogosAparte[respuesta.seccion].contenedor), respuesta.resultados);
    }
}

// Punto de entrada del texto libre (también lo usan los botones de sugerencias).
function procesarEntradaUsuario(texto) {
    const limpio = normalizarTexto(texto);
    if (!limpio) return;
    historialChat.push({ rol: 'usuario', html: `<p>${escaparHTML(texto)}</p>` });
    renderizarChat();
    mostrarEscribiendo();
    setTimeout(() => {
        quitarEscribiendo();
        const respuesta = responderTextoLibre(limpio);
        if (!respuesta) return;
        if (respuesta.accion === 'test') {
            iniciarTestVocacional();
            return;
        }
        historialChat.push({ rol: 'bot', html: respuesta.html });
        renderizarChat();
        if (respuesta.resultados) renderResultadosChat(respuesta);
    }, 450);
};

// --- Motor de recomendación --------------------------------------------
// En vez de buscar palabras sueltas en cualquier lado (lo que daba falsos
// positivos/negativos), usamos como señal principal el campo `area` que ya
// calcula getArea() para cada carrera, y sumamos palabras clave puntuales
// solo como desempate fino. Todo el matching es por palabra completa (\b)
// para no enganchar coincidencias parciales dentro de otra palabra.

const AREAS_POR_ENTORNO = {
    oficina: ['Tecnología', 'Negocios', 'Ingeniería'],
    terreno: ['Oficios', 'Turismo', 'Ambiente', 'Gastronomía'],
    social: ['Salud', 'Educación', 'Ciencias sociales']
};

const AREAS_POR_HABILIDAD = {
    analitico: ['Ingeniería', 'Tecnología', 'Salud', 'Negocios'],
    creativo: ['Diseño', 'Arte', 'Idiomas'],
    empatico: ['Salud', 'Educación', 'Ciencias sociales']
};

const PALABRAS_POR_ENTORNO = {
    oficina: ['sistema', 'programacion', 'administracion', 'gestion', 'dato', 'contad'],
    terreno: ['mecanic', 'turismo', 'agronom', 'ambiental', 'logistica', 'topograf', 'petroleo'],
    social: ['profesorado', 'educacion', 'psicolog', 'salud', 'enfermer', 'medicin']
};

const PALABRAS_POR_HABILIDAD = {
    analitico: ['ingenieria', 'dato', 'finanza', 'matematica', 'ciencia', 'software'],
    creativo: ['diseno', 'arte', 'arquitect', 'multimedia', 'marketing', 'animacion', 'comunicacion'],
    empatico: ['social', 'acompan', 'terapia', 'pedagog', 'psicolog', 'docencia']
};

const PALABRAS_DESCARTE = {
    duro: ['matematica', 'calculo', 'ingenieria', 'contador', 'derecho', 'leyes'],
    rutina: ['administracion', 'secretariado', 'archivo', 'contable'],
    publico: ['turismo', 'marketing', 'comercio', 'venta', 'relaciones publicas']
};

const LIMITE_RECOMENDACIONES = 40;

function contienePalabra(texto, palabra) {
    return new RegExp(`\\b${palabra}`, 'i').test(texto);
}

function obtenerRecomendaciones() {
    // Si el test ya se corrió antes en esta sesión, primero olvidamos esos puntajes.
    ofertas.forEach(o => { delete o.score; delete o.motivos; });

    // 1. Filtramos por el nivel de formación elegido (grado, tecnicatura o curso).
    let posibles = ofertas.filter(c => {
        if (perfilUsuario.nivel === 'grado') return c.formacion === 'grado' || c.formacion === 'profesorados';
        if (perfilUsuario.nivel === 'tecnicatura') return c.formacion === 'tecnicaturas';
        if (perfilUsuario.nivel === 'curso') return c.formacion === 'cursos';
        return true;
    });

    // 2. Puntuamos cada carrera y guardamos por qué la recomendamos.
    posibles.forEach(c => {
        c.score = 0;
        c.motivos = [];
        const texto = normalizarTexto(`${c.nombre} ${c.categoria}`);

        if ((AREAS_POR_ENTORNO[perfilUsuario.entorno] || []).includes(c.area)) {
            c.score += 4;
            c.motivos.push('encaja con el ambiente de trabajo que elegiste');
        }
        if ((AREAS_POR_HABILIDAD[perfilUsuario.habilidad] || []).includes(c.area)) {
            c.score += 4;
            c.motivos.push('aprovecha tu punto fuerte');
        }
        (PALABRAS_POR_ENTORNO[perfilUsuario.entorno] || []).forEach(p => { if (contienePalabra(texto, p)) c.score += 1; });
        (PALABRAS_POR_HABILIDAD[perfilUsuario.habilidad] || []).forEach(p => { if (contienePalabra(texto, p)) c.score += 1; });

        if (perfilUsuario.modalidad && perfilUsuario.modalidad !== 'cualquiera' && c.modalidades.includes(perfilUsuario.modalidad)) {
            c.score += 2;
            c.motivos.push(`es ${perfilUsuario.modalidad}, como preferís`);
        }

        (PALABRAS_DESCARTE[perfilUsuario.odio] || []).forEach(p => { if (contienePalabra(texto, p)) c.score -= 4; });
    });

    // 3. Nos quedamos solo con las que de verdad matchearon algo del perfil.
    let recomendadas = posibles.filter(c => c.score > 0).sort((a, b) => b.score - a.score);

    // 4. Si el cruce fue muy exigente y quedaron pocas opciones, relajamos el corte
    //    (mejor mostrar las más cercanas que dejar a alguien sin nada).
    if (recomendadas.length < 6 && posibles.length) {
        recomendadas = posibles.slice().sort((a, b) => b.score - a.score).slice(0, 12);
    }

    return recomendadas.slice(0, LIMITE_RECOMENDACIONES);
}

export function etiquetaCompatibilidad(score) {
    if (score >= 9) return '🎯 Muy compatible';
    if (score >= 5) return '✔️ Compatible';
    return '🔎 Podría interesarte';
}

function mostrarRecomendacion() {
    enTestVocacional = false;
    actualizarProgresoChat();

    // Nos aseguramos de estar en la sección de Educación Formal (oculta plataformas)
    // antes de pisar la grilla con los resultados del test.
    cambiarSeccion('formal');

    // Generar perfil usuario normalizado (0-5 cada dimensión)
    const perfilNormalizado = Orientador.generarPerfilUsuarioDesdeRespuestas(respuestasTest);
    
    // Generar rankings agrupados por tipo de formación.
    // El límite es una tanda (LIMITE_PAGINA) y no una docena: con 12 alcanzaba
    // para mostrar, pero al filtrar por gestión o modalidad quedaban dos o tres
    // tarjetas. Con una tanda entera los filtros tienen sobre qué trabajar.
    const rankings = Orientador.generarRanking(perfilNormalizado, { limite: LIMITE_PAGINA });
    const todas = rankings.todas;

    // La grilla pasa a "modo recomendación": mostrarResultados() se encarga del
    // contador y del pintado, y los filtros se aplican sobre estas carreras en
    // vez de tirar el ranking a la basura.
    estado.recomendacion = todas.length
        ? { carreras: todas, rankings, total: rankings.total || todas.length }
        : null;
    mostrarResultados();
    if (!todas.length) {
        const contadorElem = document.getElementById('resultsCount');
        if (contadorElem) contadorElem.textContent = '0 carreras compatibles con esa combinación';
    }

    let html;
    if (!todas.length) {
        html = `
            <p><img class="chat-bot-icon" src="/img/copiloto-icono.png" alt="" width="16" height="16"> <strong>Orientador:</strong> No encontré carreras que combinen con esa mezcla de respuestas. ¡Probemos de nuevo con otra combinación!</p>
            <button type="button" class="btn-chat-reset" data-chat-accion="reiniciar">Empezar el test de nuevo</button>`;
    } else {
        const mejor = todas[0];
        const matchPct = mejor.compatibilidad ? ` (${mejor.compatibilidad}%)` : '';
        const visibles = todas.slice(0, 6);
        const tarjetas = visibles.map(c => tarjetaResultadoChat(c, rankings)).join('');
        // Antes acá se decía "encontré N" con N = las que se muestran, que está
        // recortado por 'limite'. rankings.total es cuántas superaron el umbral
        // de compatibilidad de verdad.
        const compatibles = rankings.total || todas.length;
        html = `
            <p><img class="chat-bot-icon" src="/img/copiloto-icono.png" alt="" width="16" height="16"> <strong>Orientador:</strong> ¡Mapeo completo! Encontré <strong>${compatibles} carreras compatibles</strong> con tu perfil.${matchPct ? ' Tu mejor match: <strong>' + escaparHTML(mejor.nombre) + '</strong> con ' + mejor.compatibilidad + '%.' : ''}</p>
            <div class="chat-resultados">${tarjetas}</div>
            <p class="mensaje-bot-nota">Acá te muestro las ${visibles.length} de mejor match. Cerrá esta ventana y vas a encontrar ${todas.length} en la grilla, donde además podés filtrarlas sin perder el orden por compatibilidad.</p>
            <p class="mensaje-bot-nota"><small>⚖️ <em>Resultado de compatibilidad preliminar basado en intereses. Consultá siempre con un profesional de la orientación vocacional.</em></small></p>
            <button type="button" class="btn-chat-reset" data-chat-accion="reiniciar">Empezar el test de nuevo</button>`;
    }

    historialChat.push({ rol: 'bot', html });
    renderizarChat();
}

// Tarjeta compacta de resultado para el chat.
function tarjetaResultadoChat(carrera, rankings) {
    const compat = carrera.compatibilidad || 0;
    const matchClass = compat >= 75 ? 'match-alto' : (compat >= 50 ? 'match-medio' : 'match-bajo');
    const clave = carrera.clave || carrera.nombre;
    let tipoBadge = '';
    if (rankings.grados.some(r => r.clave === carrera.clave)) tipoBadge = '<span class="tipo-badge grado">Grado</span>';
    else if (rankings.tecnicaturas.some(r => r.clave === carrera.clave)) tipoBadge = '<span class="tipo-badge tecnica">Tecnicatura</span>';
    else if (rankings.cursos.some(r => r.clave === carrera.clave)) tipoBadge = '<span class="tipo-badge curso">Curso</span>';

    return `
        <div class="chat-resultado-card ${matchClass}">
            <div class="chat-resultado-head">
                <span class="chat-resultado-nombre">${capSeguro(carrera.nombre)}</span>
                <span class="compatibilidad-badge ${matchClass}">${compat}% match</span>
            </div>
            ${tipoBadge || carrera.area ? '<div class="tipo-badges">' + tipoBadge + (carrera.area ? '<span class="tipo-badge area">' + capSeguro(carrera.area) + '</span>' : '') + '</div>' : ''}
            <div class="chat-resultado-acciones">
                <button type="button" class="btn-escuchar-card" data-card-id="${escaparHTML(clave)}" aria-label="Escuchar carrera"><svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg> <span>Escuchar</span></button>
            </div>
        </div>`;
}


// ==========================================
// 🖱️ DELEGACIÓN DE EVENTOS DEL CHAT
// ==========================================

// Las burbujas del chat se pintan con innerHTML, así que sus botones no existen
// cuando se configura la página: no se les puede poner un listener directo.
// Antes eso se resolvía con onclick="..." inline, que obligaba a exponer las
// funciones en window (y a serializar argumentos dentro de un atributo). Con la
// app en módulos las funciones ya no son globales, así que un único listener en
// el contenedor del chat atiende todos los botones, presentes y futuros.
if (typeof document !== 'undefined') {
    document.addEventListener('click', event => {
        const enviar = event.target.closest('[data-chat-enviar]');
        if (enviar) { procesarEntradaUsuario(enviar.dataset.chatEnviar); return; }

        const opcion = event.target.closest('[data-chat-opcion]');
        if (opcion) {
            seleccionarOpcionChat(Number(opcion.dataset.chatOpcion), opcion.dataset.chatOpcionTexto, Number(opcion.dataset.chatPaso));
            return;
        }

        const accion = event.target.closest('[data-chat-accion]');
        if (!accion) return;
        switch (accion.dataset.chatAccion) {
            case 'test': iniciarTestVocacional(); break;
            case 'atras': volverPreguntaChat(); break;
            case 'reiniciar': reiniciarChat(); break;
            case 'cerrar': document.getElementById('btn-cerrar-chat')?.click(); break;
        }
    });
}
