// ==========================================
// Copiloto Vocacional: el chat que entiende texto libre y guía hacia el Test
// Vocacional Completo (el cuestionario vive en js/vocacional/).
// ==========================================

import { ETIQUETAS_FUENTE, catalogosAparte, ofertas, plataformas } from './datos.js';
import { cambiarSeccion, cambiarVista, renderizarCursosAparte, renderizarPlataformas, renderizarTarjetas } from './render.js';
import { capSeguro, escaparHTML, normalizarTexto, obtenerModalidades } from './util.js';
import { abrirTestCompleto } from './vocacional/test-completo.js';

// Historial de la conversación: cada entrada es { rol: 'bot'|'usuario', html }.
const historialChat = [];
let bubbleEscribiendo = null;

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

// Modo "pantalla completa" del copiloto: el panel se estira sobre el viewport,
// oscurece el sitio y centra la ventana de chat. Se entra desde la bienvenida.
function abrirCopilotoPantallaCompleta() {
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

// Salir del copiloto a pantalla completa: fade-out del panel y vuelta a la
// burbuja cerrada. Es la transición "copiloto → interfaz principal".
export function salirDelCopilotoPantallaCompleta() {
    const panel = document.getElementById('copilotoPanel');
    if (!panel || !panel.classList.contains('is-test-pantalla-completa')) return;
    panel.classList.add('is-saliendo-test');
    let terminado = false;
    const limpiar = () => {
        if (terminado) return;
        terminado = true;
        // Si un diálogo (el test, Mi lista) ya tomó el foco, la burbuja NO se lo
        // roba: el panel queda inerte detrás y devolverle el foco sería un salto
        // fuera del diálogo (WCAG 2.1 - 2.4.3 Orden del foco).
        const hayDialogoEncima = panel.inert === true;
        panel.classList.remove('is-test-pantalla-completa', 'is-saliendo-test', 'is-abierto');
        const ventana = document.getElementById('ventana-chat');
        if (ventana) ventana.hidden = true;
        const boton = document.getElementById('btn-toggle-chat');
        if (boton) {
            boton.setAttribute('aria-expanded', 'false');
            if (!hayDialogoEncima) boton.focus();
        }
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
        if (panel && panel.classList.contains('is-test-pantalla-completa')) salirDelCopilotoPantallaCompleta();
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
        // WCAG 2.1 - 2.4.3 Orden del foco: es un diálogo modal, así que el foco
        // arranca adentro (en la primera opción) y no en el pie que quedó detrás.
        setTimeout(() => {
            const primera = document.getElementById('btnBienvenidaCopiloto');
            if (primera && !pantalla.hidden) primera.focus({ preventScroll: true });
        }, 0);
    }

    // Las dos tarjetas de la portada: el orientador (que abre el chat y desde
    // el chat se llega al Test Vocacional Completo) y el catálogo completo.
    const btnCopiloto = document.getElementById('btnBienvenidaCopiloto');
    const btnOfertas = document.getElementById('btnBienvenidaOfertas');
    if (btnCopiloto) btnCopiloto.addEventListener('click', () => {
        salirDeBienvenida(() => {
            avisarBienvenidaCerrada('orientador');
            abrirCopilotoPantallaCompleta();
        });
    });
    if (btnOfertas) btnOfertas.addEventListener('click', () => {
        salirDeBienvenida(() => {
            avisarBienvenidaCerrada('catalogo');
            cambiarVista('carreras');
            // El botón que disparó esto queda oculto: sin esto el foco se pierde
            // en un elemento invisible y el teclado vuelve al principio.
            const buscador = document.getElementById('searchInput');
            if (buscador) buscador.focus({ preventScroll: true });
        });
    });
}

// El catálogo (y el header con su buscador) quedan inert mientras la bienvenida
// está encima: no hay nada visible con lo que interactuar. La burbuja del
// copiloto también: su botón de "Empezar" es el que está en la bienvenida.
function alternarInertDetrasDeBienvenida(activo) {
    // El pie también entra: es la otra zona interactiva visible detrás de la
    // portada (el botón de sugerencias quedaba alcanzable con Tab).
    [document.querySelector('.hero'), document.querySelector('.catalog-layout'),
     document.getElementById('copilotoPanel'), document.querySelector('.site-footer')]
        .forEach(el => { if (el) el.inert = activo; });
    // Y con el catálogo inert tampoco tiene sentido que se pueda scrollear:
    // la clase apaga el scroll de la página entera (ver style.css).
    document.documentElement.classList.toggle('bienvenida-abierta', activo);
    if (activo) window.scrollTo(0, 0);
}

// Avisa por dónde siguió la persona después de la portada. Lo escucha el
// tutorial de primera visita (js/tutorial.js): solo arranca si fue al catálogo,
// y con un link compartido ('url') no arranca ni se marca como visto.
function avisarBienvenidaCerrada(destino) {
    document.dispatchEvent(new CustomEvent('ben:bienvenida-cerrada', { detail: { destino } }));
}

function ocultarBienvenidaInstantanea() {
    const pantalla = document.getElementById('pantallaBienvenida');
    if (!pantalla) return;
    pantalla.hidden = true;
    pantalla.classList.remove('is-saliendo');
    alternarInertDetrasDeBienvenida(false);
    avisarBienvenidaCerrada('url');
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

function renderizarChat() {
    const chatCaja = document.getElementById('chat-caja');
    chatCaja.innerHTML = historialChat.map(m => m.rol === 'bot'
        ? `<div class="mensaje-bot">${m.html}</div>`
        : `<div class="mensaje-usuario">${m.html}</div>`).join('');
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

// El camino recomendado es el Test Vocacional Completo, así que es la acción
// destacada; la búsqueda libre queda para quien ya sabe qué busca.
function mensajeBienvenida() {
    return `<div class="copiloto-bienvenida">
            <div class="cb-header">
                <span class="cb-icono" aria-hidden="true">${iconoCopiloto('brujula')}</span>
                <span class="cb-titulos">
                    <h2 class="cb-titulo">Copiloto Vocacional <span class="badge-beta" title="Función en prueba: puede cambiar o fallar">Beta</span></h2>
                    <p class="cb-subtitulo">Tu guía por la oferta educativa de Mendoza</p>
                </span>
            </div>
            <ol class="cb-pasos">
                ${pasoCopiloto(1, 'lista', 'Respondés el test completo (65 preguntas)')}
                ${pasoCopiloto(2, 'analisis', 'Cruzamos tu perfil con 651 carreras')}
                ${pasoCopiloto(3, 'diana', 'Guardás las que te interesan y las comparás')}
            </ol>
            <p class="cb-tiempo">${iconoCopiloto('reloj')}<span>Toma 4-6 minutos</span></p>
            <button type="button" class="cb-cta" data-chat-accion="test-completo">
                <span>Hacer el test completo</span>${iconoCopiloto('flecha')}
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

// Abre el Test Vocacional Completo desde el chat: se pliega la ventanita
// primero para no dejar dos capas abiertas (el test ya desenfoca todo atrás).
function abrirTestVocacional() {
    const panel = document.getElementById('copilotoPanel');
    if (panel && panel.classList.contains('is-test-pantalla-completa')) {
        salirDelCopilotoPantallaCompleta();
    } else {
        cerrarChat();
    }
    abrirTestCompleto();
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
            abrirTestVocacional();
            return;
        }
        historialChat.push({ rol: 'bot', html: respuesta.html });
        renderizarChat();
        if (respuesta.resultados) renderResultadosChat(respuesta);
    }, 450);
};

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

        const accion = event.target.closest('[data-chat-accion]');
        if (!accion) return;
        switch (accion.dataset.chatAccion) {
            case 'test':
            case 'test-completo': abrirTestVocacional(); break;
            case 'cerrar': document.getElementById('btn-cerrar-chat')?.click(); break;
        }
    });
}
