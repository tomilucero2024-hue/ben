// ============================================================================
// ⚖️ MI LISTA + COMPARADOR
// ============================================================================
//
// Dos pantallas dentro del overlay #miLista:
//
//   1. LISTA: las fichas guardadas con el corazón (js/favoritos.js), agrupadas
//      por tipo, con selección múltiple (hasta 3) para comparar.
//   2. COMPARACIÓN: una columna por ficha seleccionada, con las filas que
//      importan para decidir (afinidad, duración, costo, dónde se cursa, plan)
//      y un resumen automático de "en qué se diferencian".
//
// Cada columna es una ficha concreta, no una "carrera abstracta": en la grilla
// formal el corazón guarda la oferta puntual (carrera + institución), así que
// se pueden comparar dos instituciones de la misma carrera ("¿dónde la
// estudio?") o dos carreras distintas ("¿qué estudio?").
//
// Los datos se resuelven contra el catálogo vivo en cada apertura: si una
// carrera guardada ya no está (la dieron de baja entre builds), la fila se
// muestra como "ya no está en el catálogo" con la opción de quitarla.
// ============================================================================

import { enlacesBEN, ofertas, plataformas, catalogosAparte } from './datos.js';
import { ofertasDeCarrera } from './render.js';
import { capSeguro, escaparHTML, formatearDuracionAnios, limpiarTexto, normalizarTexto, urlSegura } from './util.js';

const MAX_COMPARAR = 3;
const CLAVE_PERFIL = 'ben-vocacional-perfil';
const ETIQUETAS_TIPO = {
    carrera: 'Carreras',
    curso: 'Cursos y formaciones',
    oficio: 'Oficios',
    secundario: 'Terminá el secundario',
    plataforma: 'Plataformas online'
};

let raiz = null;
let cuerpo = null;
let pie = null;
let contador = null;
let focoPrevio = null;
let seleccion = new Set();
let pantalla = 'lista';
let confirmandoVaciar = false;
let comparadas = [];
let inicializado = false;

// ---------------------------------------------------------------------------
// Apertura y cierre
// ---------------------------------------------------------------------------

function elementosDetras() {
    return [
        document.querySelector('.hero'),
        document.querySelector('.catalog-layout'),
        document.getElementById('copilotoPanel'),
        document.getElementById('testCompleto'),
        document.querySelector('header.header'),
        document.querySelector('.site-footer'),
        document.querySelector('.a11y-widget')
    ];
}

function alternarDetras(inert) {
    elementosDetras().forEach(el => { if (el) el.inert = inert; });
    document.documentElement.classList.toggle('mi-lista-abierta', inert);
}

export function inicializarMiLista() {
    if (inicializado) return;
    raiz = document.getElementById('miLista');
    if (!raiz) return;
    inicializado = true;
    cuerpo = document.getElementById('ml-cuerpo');
    pie = document.getElementById('ml-pie');
    contador = document.getElementById('miListaContador');

    document.getElementById('ml-cerrar').addEventListener('click', cerrarMiLista);
    raiz.addEventListener('click', event => { if (event.target === raiz) cerrarMiLista(); });

    // Un solo listener cubre el botón de la barra de resultados y el enlace del
    // aviso "Guardada en Mi lista". En las páginas estáticas no existe este
    // módulo: ahí el enlace navega a /?lista=1 y se abre solo al cargar la app.
    document.addEventListener('click', event => {
        const abridor = event.target.closest('[data-abrir-mi-lista]');
        if (!abridor) return;
        event.preventDefault();
        abrirMiLista();
    });

    raiz.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const focos = [...raiz.querySelectorAll('button, a[href], input, select, textarea')]
            .filter(el => !el.hidden && el.offsetParent !== null);
        if (!focos.length) return;
        const primero = focos[0];
        const ultimo = focos[focos.length - 1];
        if (event.shiftKey && document.activeElement === primero) { ultimo.focus(); event.preventDefault(); }
        else if (!event.shiftKey && document.activeElement === ultimo) { primero.focus(); event.preventDefault(); }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && raiz && !raiz.hidden) cerrarMiLista();
    });

    if (window.Favoritos) {
        window.Favoritos.suscribir(lista => {
            actualizarContador(lista);
            seleccion = new Set([...seleccion].filter(clave => lista.some(f => f.clave === clave)));
            if (!raiz.hidden && pantalla === 'lista') pintarLista();
        });
    }

    // Enlace directo: /?lista=1 abre el apartado. Se limpia el parámetro para
    // que un refresh no vuelva a abrirlo solo.
    const url = new URL(window.location.href);
    if (url.searchParams.get('lista') === '1') {
        abrirMiLista();
        url.searchParams.delete('lista');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
    }

    configurarEventosMiLista();
    vigilarBreakpoint();
}

// Si el teléfono gira o se agranda la ventana con la comparación abierta, se
// vuelve a pintar con el layout que corresponde (tabla ↔ tarjetas apiladas).
function vigilarBreakpoint() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(MQ_ANGOSTA);
    const alCambiar = () => {
        if (pantalla === 'comparacion' && raiz && !raiz.hidden) pintar();
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', alCambiar);
    else if (typeof mq.addListener === 'function') mq.addListener(alCambiar);
}

export function abrirMiLista(pantallaInicial = 'lista') {
    if (!inicializado) inicializarMiLista();
    if (!raiz) return;
    pantalla = pantallaInicial;
    focoPrevio = document.activeElement;
    raiz.hidden = false;
    alternarDetras(true);
    pintar();
    const foco = cuerpo.querySelector('button, a[href], input') || document.getElementById('ml-cerrar');
    if (foco) foco.focus();
    cargarDatosVocacional();
}

// La afinidad y las barras de intereses necesitan los perfiles del test
// vocacional (data/vocacional/perfiles-carreras.json). Se cargan a demanda la
// primera vez que se abre Mi lista: si el estudiante ya hizo el test, el motor
// los tiene en memoria y esto no hace nada.
let datosVocacionalListos = false;
async function cargarDatosVocacional() {
    if (datosVocacionalListos || !window.Vocacional) return;
    try {
        await window.Vocacional.cargarDatos();
        datosVocacionalListos = true;
        if (!raiz.hidden) {
            pintar();
            if (document.activeElement === document.body) {
                const foco = cuerpo.querySelector('button, a[href], input') || document.getElementById('ml-cerrar');
                if (foco) foco.focus();
            }
        }
    } catch (e) {
        // Sin perfiles la lista igual funciona: solo no se muestra afinidad.
    }
}

export function cerrarMiLista() {
    if (!raiz || raiz.hidden) return;
    raiz.hidden = true;
    alternarDetras(false);
    pantalla = 'lista';
    if (focoPrevio && typeof focoPrevio.focus === 'function') focoPrevio.focus();
}

function actualizarContador(lista) {
    if (!contador) return;
    const total = lista.length;
    contador.textContent = String(total);
    contador.hidden = total === 0;
    const boton = document.getElementById('btnMiLista');
    if (boton) boton.setAttribute('aria-label', total ? `Mi lista: ${total} carreras guardadas` : 'Mi lista, vacía');
}

// ---------------------------------------------------------------------------
// Resolución de fichas contra el catálogo vivo
// ---------------------------------------------------------------------------

function perfilesVocacionales() {
    return (window.Vocacional && window.Vocacional.perfiles) || [];
}

function perfilDeCarrera(nombreOClave) {
    const clave = normalizarTexto(nombreOClave);
    return perfilesVocacionales().find(p => p.clave === clave) || null;
}

function perfilEstudiante() {
    try {
        const crudo = localStorage.getItem(CLAVE_PERFIL);
        if (!crudo) return null;
        const perfil = JSON.parse(crudo);
        return perfil && perfil.riasec ? perfil : null;
    } catch (e) {
        return null;
    }
}

function institucionesUnicas(lista) {
    const vistas = new Set();
    return lista.filter(n => n && !vistas.has(n) && vistas.add(n));
}

// Une los datos de las ofertas que dictan una carrera: qué duraciones,
// modalidades, costos y planes aparecen entre todas las instituciones.
function resumenDeOfertas(suyas) {
    const duraciones = institucionesUnicas(suyas.map(o => limpiarTexto(o.duracion)).filter(Boolean));
    const anios = suyas.map(o => o.duracionAnios).filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
    const modalidades = institucionesUnicas(suyas.flatMap(o => o.modalidades && o.modalidades.length ? o.modalidades : [o.modalidad]).filter(Boolean));
    const instituciones = institucionesUnicas(suyas.map(o => o.institucion).filter(Boolean));
    const gratuitas = suyas.filter(o => o.costo === 'gratuito').length;
    const planes = suyas
        .filter(o => o.plan_estudio && o.plan_estudio.length)
        .map(o => ({ institucion: o.institucion, fuente: urlSegura(o.plan_fuente) || '' }));

    let duracion = duraciones.join(' · ');
    if (anios.length) {
        const min = formatearDuracionAnios(anios[0]);
        const max = formatearDuracionAnios(anios[anios.length - 1]);
        duracion = min === max ? min : `${min} a ${max}`;
    }

    return {
        duracion,
        modalidades,
        instituciones,
        planes,
        costo: !suyas.length ? '' : (gratuitas === suyas.length ? 'gratuito' : (gratuitas === 0 ? 'arancelado' : 'mixto'))
    };
}

function fichaDeOferta(oferta) {
    return {
        clave: oferta._clave,
        tipo: 'carrera',
        nombre: oferta.nombre,
        subtitulo: oferta.institucion || '',
        area: oferta.area || '',
        formacion: oferta.formacion || '',
        duracion: limpiarTexto(oferta.duracion) || '',
        modalidades: oferta.modalidades && oferta.modalidades.length ? oferta.modalidades : [oferta.modalidad],
        costo: oferta.costo || '',
        instituciones: oferta.institucion ? [oferta.institucion] : [],
        planes: oferta.plan_estudio && oferta.plan_estudio.length
            ? [{ institucion: oferta.institucion, fuente: urlSegura(oferta.plan_fuente) || '' }]
            : [],
        fichaSlug: enlacesBEN.carreras[normalizarTexto(oferta.nombre)] || '',
        linkOficial: urlSegura(oferta.link) || '',
        perfil: perfilDeCarrera(oferta.nombre)
    };
}

function fichaDeCarrera(perfil, item) {
    const suyas = ofertasDeCarrera({ clave: perfil.clave, nombre: perfil.nombre });
    const resumen = resumenDeOfertas(suyas);
    const instituciones = resumen.instituciones.length ? resumen.instituciones : (perfil.instituciones || []);
    return {
        clave: item.clave,
        tipo: 'carrera',
        nombre: perfil.nombre,
        subtitulo: instituciones.length > 1 ? `${instituciones.length} instituciones` : (instituciones[0] || ''),
        area: perfil.area || '',
        formacion: perfil.formacion || '',
        duracion: resumen.duracion,
        modalidades: resumen.modalidades,
        costo: resumen.costo,
        instituciones,
        planes: resumen.planes,
        fichaSlug: enlacesBEN.carreras[perfil.clave] || '',
        linkOficial: '',
        perfil
    };
}

function fichaDeCurso(curso, item, tipo) {
    return {
        clave: item.clave,
        tipo,
        nombre: curso.nombre,
        subtitulo: curso.institucion || '',
        area: '',
        formacion: '',
        duracion: limpiarTexto(curso.duracion) || '',
        modalidades: curso.modalidad ? [curso.modalidad] : [],
        costo: '',
        instituciones: curso.institucion ? [curso.institucion] : [],
        planes: [],
        fichaSlug: '',
        linkOficial: urlSegura(curso.link) || '',
        perfil: null
    };
}

function fichaDePlataforma(plataforma, item) {
    return {
        clave: item.clave,
        tipo: 'plataforma',
        nombre: plataforma.nombre,
        subtitulo: 'Plataforma online',
        area: '',
        formacion: '',
        duracion: limpiarTexto(plataforma.duracion) || '',
        modalidades: [plataforma.modalidad || 'Online'],
        costo: '',
        instituciones: [plataforma.nombre],
        planes: [],
        fichaSlug: '',
        linkOficial: urlSegura(plataforma.url) || '',
        perfil: null
    };
}

// Devuelve la ficha resuelta contra el catálogo, o null si ya no existe.
function resolver(item) {
    const oferta = ofertas.find(o => o._clave === item.clave);
    if (oferta) return fichaDeOferta(oferta);

    const plataforma = plataformas.find(p => p._clave === item.clave);
    if (plataforma) return fichaDePlataforma(plataforma, item);

    for (const [seccion, catalogo] of Object.entries(catalogosAparte)) {
        const curso = catalogo.cursos.find(c => c._clave === item.clave);
        if (curso) return fichaDeCurso(curso, item, seccion === 'oficios-tecnicos' ? 'oficio' : (seccion === 'secundario' ? 'secundario' : 'curso'));
    }

    // Carreras "abstractas": las que se guardan desde las recomendaciones del
    // test o desde las páginas estáticas de carrera.
    const perfil = perfilesVocacionales().find(p => p.clave === item.clave);
    if (perfil) return fichaDeCarrera(perfil, item);

    return null;
}

// ---------------------------------------------------------------------------
// Pantalla 1: la lista
// ---------------------------------------------------------------------------

function etiquetaCosto(costo) {
    if (costo === 'gratuito') return 'Gratis';
    if (costo === 'arancelado') return 'Arancelada';
    if (costo === 'mixto') return 'Gratis y arancelada';
    return '';
}

function filaLista(item) {
    const ficha = resolver(item);
    const seleccionada = seleccion.has(item.clave);

    if (!ficha) {
        return `
        <li class="ml-item ml-item-huerfana">
            <div class="ml-item-check" aria-hidden="true">•</div>
            <div class="ml-item-info">
                <p class="ml-item-nombre">${escaparHTML(item.nombre)}</p>
                <p class="ml-item-meta">Ya no está en el catálogo (puede haber cambiado de nombre o haberse dado de baja).</p>
            </div>
            <button type="button" class="ml-item-quitar" data-ml-quitar="${escaparHTML(item.clave)}" aria-label="Quitar ${escaparHTML(item.nombre)} de Mi lista">✕</button>
        </li>`;
    }

    const meta = [
        ficha.subtitulo,
        ficha.area,
        [etiquetaCosto(ficha.costo), ficha.duracion].filter(Boolean).join(' · ')
    ].filter(Boolean).join(' · ');

    const fichaHTML = ficha.fichaSlug
        ? `<a class="ml-item-link" href="/carrera/${escaparHTML(ficha.fichaSlug)}/">Ficha →</a>`
        : (ficha.linkOficial ? `<a class="ml-item-link" href="${escaparHTML(ficha.linkOficial)}" target="_blank" rel="noopener nofollow" referrerpolicy="no-referrer">Sitio oficial ↗</a>` : '');

    const afinidad = afinidadDe(ficha);
    const marca = afinidad !== null ? `<span class="ml-item-afinidad">${afinidad}%</span>` : '';

    return `
    <li class="ml-item${seleccionada ? ' is-seleccionada' : ''}">
        <label class="ml-item-check">
            <input type="checkbox" data-ml-marcar="${escaparHTML(item.clave)}" ${seleccionada ? 'checked' : ''}
                aria-label="Comparar ${escaparHTML(ficha.nombre)}">
        </label>
        <div class="ml-item-info">
            <p class="ml-item-nombre">${escaparHTML(ficha.nombre)} ${marca}</p>
            ${meta ? `<p class="ml-item-meta">${escaparHTML(meta)}</p>` : ''}
        </div>
        ${fichaHTML}
        <button type="button" class="ml-item-quitar" data-ml-quitar="${escaparHTML(item.clave)}" aria-label="Quitar ${escaparHTML(ficha.nombre)} de Mi lista">✕</button>
    </li>`;
}

function pintarLista() {
    const lista = window.Favoritos ? window.Favoritos.leer() : [];
    if (!lista.length) {
        cuerpo.innerHTML = `
        <div class="ml-vacia">
            <p class="ml-vacia-titulo">Todavía no guardaste ninguna carrera</p>
            <p class="ml-vacia-texto">Tocá el corazón <strong>♡ Me interesa</strong> en cualquier tarjeta para guardarla acá.
            Podés guardar carreras, cursos y oficios, y comparar hasta ${MAX_COMPARAR} a la vez.</p>
            <button type="button" class="ml-btn-primario" data-ml-accion="cerrar-e-ir">Ver carreras</button>
        </div>`;
        pie.innerHTML = '';
        return;
    }

    // Agrupadas por tipo, conservando el orden de guardado dentro de cada grupo.
    const grupos = new Map();
    lista.forEach(item => {
        const tipo = item.tipo || 'carrera';
        if (!grupos.has(tipo)) grupos.set(tipo, []);
        grupos.get(tipo).push(item);
    });

    cuerpo.innerHTML = [...grupos.entries()].map(([tipo, items]) => `
        <section class="ml-grupo">
            <h3 class="ml-grupo-titulo">${escaparHTML(ETIQUETAS_TIPO[tipo] || 'Otros')} <span>${items.length}</span></h3>
            <ul class="ml-items">${items.map(filaLista).join('')}</ul>
        </section>`).join('');

    actualizarPieLista();
}

// El pie se actualiza aparte porque tildar un checkbox no re-pinta la lista
// entera (si no, el foco del teclado se perdería en cada tilde).
function actualizarPieLista() {
    if (confirmandoVaciar) {
        pie.innerHTML = `
        <p class="ml-pie-info">¿Vaciar Mi lista? Se van a quitar todas las fichas guardadas.</p>
        <div class="ml-pie-acciones">
            <button type="button" class="ml-btn-secundario" data-ml-accion="cancelar-vaciar">Cancelar</button>
            <button type="button" class="ml-btn-primario ml-btn-peligro" data-ml-accion="confirmar-vaciar">Sí, vaciar todo</button>
        </div>`;
        return;
    }
    const n = seleccion.size;
    pie.innerHTML = `
        <p class="ml-pie-info">${n ? `${n} de ${MAX_COMPARAR} seleccionadas` : `Elegí 2 o más para comparar (hasta ${MAX_COMPARAR})`}</p>
        <div class="ml-pie-acciones">
            <button type="button" class="ml-btn-secundario" data-ml-accion="vaciar">Vaciar lista</button>
            <button type="button" class="ml-btn-primario" data-ml-accion="comparar" ${n < 2 ? 'disabled' : ''}>Comparar ${n >= 2 ? `(${n})` : ''}</button>
        </div>`;
}

// ---------------------------------------------------------------------------
// Pantalla 2: la comparación
// ---------------------------------------------------------------------------

function afinidadDe(ficha) {
    const estudiante = perfilEstudiante();
    if (!estudiante || !ficha.perfil || !window.Vocacional) return null;
    try {
        const resultado = window.Vocacional.calcularAfinidad(estudiante, ficha.perfil, window.Vocacional.config);
        return Math.round(resultado.porcentaje);
    } catch (e) {
        return null;
    }
}

function barrasRiasec(ficha) {
    if (!ficha.perfil || !ficha.perfil.perfil || !window.Vocacional) return '';
    const etiquetas = (window.Vocacional.ETIQUETAS || {}).riasec || {};
    const riasec = ficha.perfil.perfil.riasec || {};
    const orden = ['R', 'I', 'A', 'S', 'E', 'C'].sort((a, b) => (riasec[b] || 0) - (riasec[a] || 0)).slice(0, 3);
    return `<ul class="ml-riasec">${orden.map(dim => {
        const valor = Math.round(riasec[dim] || 0);
        const nombre = (etiquetas[dim] || {}).nombre || dim;
        return `<li><span class="ml-riasec-nombre">${escaparHTML(nombre)}</span>
        <span class="ml-riasec-barra"><span style="width:${valor * 10}%"></span></span>
        <span class="ml-riasec-valor">${valor}</span></li>`;
    }).join('')}</ul>`;
}

function enlacesInstituciones(ficha) {
    if (!ficha.instituciones.length) return '';
    return `<ul class="ml-instituciones">${ficha.instituciones.map(nombre => {
        const slug = enlacesBEN.instituciones && enlacesBEN.instituciones[normalizarTexto(nombre)];
        return `<li>${slug ? `<a href="/institucion/${escaparHTML(slug)}/">${escaparHTML(nombre)}</a>` : escaparHTML(nombre)}</li>`;
    }).join('')}</ul>`;
}

function celdaPlan(ficha) {
    if (!ficha.planes.length) return '<span class="ml-vacio">Sin plan cargado</span>';
    return `<ul class="ml-planes">${ficha.planes.slice(0, 4).map(p => {
        const etiqueta = p.institucion ? `Plan de ${escaparHTML(p.institucion)}` : 'Ver plan de estudios';
        return `<li>${p.fuente ? `<a href="${escaparHTML(p.fuente)}" target="_blank" rel="noopener nofollow" referrerpolicy="no-referrer">${etiqueta} ↗</a>` : etiqueta}</li>`;
    }).join('')}</ul>`;
}

// Definición de filas: agregar una fila nueva al comparador es agregar una
// entrada acá. "soloConPerfil" oculta la fila cuando el estudiante no hizo el
// test (no hay nada que comparar en esa dimensión).
const FILAS = [
    {
        etiqueta: 'Afinidad con tu perfil',
        soloConPerfil: true,
        valor: ficha => {
            const afinidad = afinidadDe(ficha);
            if (afinidad === null) return '<span class="ml-vacio">—</span>';
            const clase = afinidad >= 75 ? 'alta' : (afinidad >= 55 ? 'media' : 'baja');
            return `<div class="ml-afinidad ${clase}">
                <span class="ml-afinidad-valor">${afinidad}%</span>
                <span class="ml-afinidad-barra"><span style="width:${afinidad}%"></span></span>
            </div>`;
        }
    },
    { etiqueta: 'Intereses que pide', valor: ficha => barrasRiasec(ficha) || '<span class="ml-vacio">—</span>' },
    {
        etiqueta: 'Área y formación',
        valor: ficha => [ficha.area, ficha.formacion].filter(Boolean).map(capSeguro).join(' · ') || '<span class="ml-vacio">—</span>'
    },
    { etiqueta: 'Duración', valor: ficha => escaparHTML(ficha.duracion) || '<span class="ml-vacio">—</span>' },
    {
        etiqueta: 'Modalidad',
        valor: ficha => ficha.modalidades.length
            ? ficha.modalidades.map(m => capSeguro(m)).join(' · ')
            : '<span class="ml-vacio">—</span>'
    },
    {
        etiqueta: 'Costo',
        valor: ficha => {
            const etiqueta = etiquetaCosto(ficha.costo);
            if (!etiqueta) return '<span class="ml-vacio">—</span>';
            return `<span class="ml-costo ${ficha.costo}">${etiqueta}</span>`;
        }
    },
    {
        etiqueta: 'Instituciones',
        valor: ficha => ficha.instituciones.length ? enlacesInstituciones(ficha) : '<span class="ml-vacio">—</span>'
    },
    { etiqueta: 'Plan de estudios', valor: celdaPlan },
    {
        etiqueta: 'Más info',
        valor: ficha => [
            ficha.fichaSlug ? `<a class="ml-link" href="/carrera/${escaparHTML(ficha.fichaSlug)}/">Ficha completa →</a>` : '',
            ficha.linkOficial ? `<a class="ml-link" href="${escaparHTML(ficha.linkOficial)}" target="_blank" rel="noopener nofollow" referrerpolicy="no-referrer">Sitio oficial ↗</a>` : ''
        ].filter(Boolean).join('<br>') || '<span class="ml-vacio">—</span>'
    }
];

// Frases de "en qué se diferencian": solo los contrastes que importan para
// decidir. Si no hay ninguno, se dice explícitamente.
function diferencias(fichas) {
    const frases = [];
    const conPerfil = fichas.every(f => afinidadDe(f) !== null);
    if (conPerfil) {
        const pares = fichas.map(f => ({ f, a: afinidadDe(f) })).sort((x, y) => y.a - x.a);
        if (pares[0].a - pares[pares.length - 1].a >= 5) {
            frases.push(`La que mejor encaja con tu perfil es <strong>${escaparHTML(pares[0].f.nombre)}</strong> (${pares[0].a}%), ${pares[0].a - pares[pares.length - 1].a} puntos arriba de ${escaparHTML(pares[pares.length - 1].f.nombre)}.`);
        }
    }

    const costos = new Set(fichas.map(f => f.costo).filter(Boolean));
    if (costos.size > 1) {
        const gratis = fichas.filter(f => f.costo === 'gratuito').map(f => f.nombre);
        const pago = fichas.filter(f => f.costo === 'arancelado' || f.costo === 'mixto').map(f => f.nombre);
        frases.push(`El costo no es el mismo: ${gratis.length ? `<strong>${gratis.map(escaparHTML).join(', ')}</strong> ${gratis.length === 1 ? 'es gratis' : 'son gratis'}` : ''}${gratis.length && pago.length ? ' y ' : ''}${pago.length ? `<strong>${pago.map(escaparHTML).join(', ')}</strong> ${pago.length === 1 ? 'es arancelada' : 'son aranceladas'}` : ''}.`);
    }

    const duraciones = fichas.map(f => ({ nombre: f.nombre, anios: aniosDe(f) })).filter(x => x.anios);
    if (duraciones.length > 1 && new Set(duraciones.map(d => d.anios)).size > 1) {
        duraciones.sort((a, b) => a.anios - b.anios);
        frases.push(`La más corta es <strong>${escaparHTML(duraciones[0].nombre)}</strong> (${formatearDuracionAnios(duraciones[0].anios)}) y la más larga, <strong>${escaparHTML(duraciones[duraciones.length - 1].nombre)}</strong> (${formatearDuracionAnios(duraciones[duraciones.length - 1].anios)}).`);
    }

    const modalidades = new Set(fichas.map(f => f.modalidades.map(m => m.toLowerCase()).sort().join('+')).filter(Boolean));
    if (modalidades.size > 1) {
        frases.push(fichas.map(f => `<strong>${escaparHTML(f.nombre)}</strong>: ${f.modalidades.map(capSeguro).join(', ') || 'sin dato'}`).join(' · ') + '.');
    }

    const areas = new Set(fichas.map(f => f.area).filter(Boolean));
    if (areas.size > 1) {
        frases.push(fichas.map(f => `<strong>${escaparHTML(f.nombre)}</strong> es de ${escaparHTML(f.area || 'otra área')}`).join(' · ') + '.');
    }

    const puestos = fichas.map(f => ({ nombre: f.nombre, n: f.instituciones.length })).filter(x => x.n);
    if (puestos.length > 1 && new Set(puestos.map(p => p.n)).size > 1) {
        puestos.sort((a, b) => b.n - a.n);
        frases.push(`<strong>${escaparHTML(puestos[0].nombre)}</strong> se dicta en ${puestos[0].n} instituciones; <strong>${escaparHTML(puestos[puestos.length - 1].nombre)}</strong>, en ${puestos[puestos.length - 1].n}.`);
    }

    if (!frases.length) {
        return '<p class="ml-diferencias-vacio">Se parecen en casi todo: misma área, duración, modalidad y costo. La diferencia va a estar en el plan de estudios y en la institución.</p>';
    }
    return `<ul class="ml-diferencias-lista">${frases.slice(0, 4).map(f => `<li>${f}</li>`).join('')}</ul>`;
}

// Duración en años de una ficha, priorizando el rango agregado.
function aniosDe(ficha) {
    const numeros = [];
    for (const oferta of ofertasDeFicha(ficha)) {
        if (Number.isFinite(oferta.duracionAnios) && oferta.duracionAnios > 0) numeros.push(oferta.duracionAnios);
    }
    if (!numeros.length) return null;
    return Math.min(...numeros);
}

function ofertasDeFicha(ficha) {
    if (ficha.tipo !== 'carrera') return [];
    const propia = ofertas.find(o => o._clave === ficha.clave);
    if (propia) return [propia];
    return ofertasDeCarrera({ clave: ficha.clave, nombre: ficha.nombre });
}

// Layout de la comparación: la tabla alineada se lee bien en escritorio (mismo
// atributo en la misma fila) pero en celular obliga a un scroll horizontal que
// nadie usa. En pantalla angosta va la MISMA comparación en una sola lista
// vertical, agrupada por atributo.
const MQ_ANGOSTA = '(max-width: 640px)';

function esPantallaAngosta() {
    return typeof window.matchMedia === 'function' && window.matchMedia(MQ_ANGOSTA).matches;
}

function vistaTabla(fichas, filas) {
    return `<div class="ml-tabla-scroll">
        <table class="ml-tabla">
            <thead>
                <tr>
                    <th scope="col" class="ml-tabla-esquina">Comparando</th>
                    ${fichas.map(ficha => `<th scope="col">
                        <span class="ml-tabla-titulo">${escaparHTML(ficha.nombre)}</span>
                        ${ficha.subtitulo ? `<span class="ml-tabla-sub">${escaparHTML(ficha.subtitulo)}</span>` : ''}
                    </th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${filas.map(fila => `
                <tr>
                    <th scope="row">${escaparHTML(fila.etiqueta)}</th>
                    ${fichas.map(ficha => `<td>${fila.valor(ficha)}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
}

// La misma información que la tabla, pero en UNA sola lista vertical: cada
// atributo es un bloque y debajo van las carreras con su valor. Así se sigue
// comparando dato por dato (como en la tabla) sin scroll horizontal.
function vistaLista(fichas, filas) {
    return `<dl class="ml-lista">
        ${filas.map(fila => `<div class="ml-lista-grupo">
            <dt class="ml-lista-grupo-nombre">${escaparHTML(fila.etiqueta)}</dt>
            <dd class="ml-lista-valores">
                <ul>
                    ${fichas.map(ficha => `<li class="ml-lista-item">
                        <span class="ml-lista-item-nombre">${escaparHTML(ficha.nombre)}</span>
                        <div class="ml-lista-item-dato">${fila.valor(ficha)}</div>
                    </li>`).join('')}
                </ul>
            </dd>
        </div>`).join('')}
    </dl>`;
}

function pintarComparacion() {
    const fichas = comparadas;
    if (!fichas.length) { pantalla = 'lista'; pintarLista(); return; }

    const conPerfil = fichas.some(f => afinidadDe(f) !== null);
    const filas = FILAS.filter(fila => !fila.soloConPerfil || conPerfil);
    const comparacion = esPantallaAngosta() ? vistaLista(fichas, filas) : vistaTabla(fichas, filas);

    cuerpo.innerHTML = `
        <div class="ml-comparacion">
            <p class="ml-volver"><button type="button" class="ml-btn-volver" data-ml-accion="volver">← Volver a Mi lista</button></p>
            ${comparacion}
            <section class="ml-diferencias">
                <h3>En qué se diferencian</h3>
                ${diferencias(fichas)}
            </section>
        </div>`;

    pie.innerHTML = `
        <p class="ml-pie-info">${fichas.length} fichas comparadas</p>
        <div class="ml-pie-acciones">
            <button type="button" class="ml-btn-secundario" data-ml-accion="copiar">Copiar</button>
            <button type="button" class="ml-btn-secundario" data-ml-accion="imprimir">Imprimir / PDF</button>
            <button type="button" class="ml-btn-primario" data-ml-accion="volver">Volver a la lista</button>
        </div>`;
}

function pintar() {
    if (!cuerpo) return;
    if (pantalla === 'comparacion') pintarComparacion();
    else pintarLista();
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

function textoPlano() {
    const fichas = comparadas;
    const lineas = [fichas.map(f => f.nombre).join('  vs  '), ''];
    for (const fila of FILAS) {
        const valores = fichas.map(ficha => {
            const div = document.createElement('div');
            div.innerHTML = fila.valor(ficha);
            return (div.textContent || '').trim().replace(/\s+/g, ' ');
        });
        lineas.push(`${fila.etiqueta}: ${valores.join(' | ')}`);
    }
    const dif = document.createElement('div');
    dif.innerHTML = diferencias(fichas);
    lineas.push('', 'En qué se diferencian:', (dif.textContent || '').trim());
    lineas.push('', 'Comparado en BEN · Buscador Educativo Nacional · https://buscadoreducativo.com.ar');
    return lineas.join('\n');
}

async function copiarComparacion() {
    const texto = textoPlano();
    try {
        await navigator.clipboard.writeText(texto);
        window.Favoritos.mostrarToast('Comparación copiada al portapapeles');
    } catch (e) {
        // Sin permiso de portapapeles (o http): se ofrece el texto para copiar a mano.
        const area = document.createElement('textarea');
        area.value = texto;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try { document.execCommand('copy'); window.Favoritos.mostrarToast('Comparación copiada'); }
        catch (err) { window.Favoritos.mostrarToast('No se pudo copiar automáticamente'); }
        area.remove();
    }
}

function manejarClick(event) {
    const quitar = event.target.closest('[data-ml-quitar]');
    if (quitar) {
        window.Favoritos.quitar(quitar.dataset.mlQuitar);
        return;
    }

    const marcar = event.target.closest('[data-ml-marcar]');
    if (marcar) {
        const clave = marcar.dataset.mlMarcar;
        if (marcar.checked && seleccion.size >= MAX_COMPARAR) {
            marcar.checked = false;
            window.Favoritos.mostrarToast(`Podés comparar hasta ${MAX_COMPARAR} a la vez`);
            return;
        }
        if (marcar.checked) seleccion.add(clave);
        else seleccion.delete(clave);
        const item = marcar.closest('.ml-item');
        if (item) item.classList.toggle('is-seleccionada', marcar.checked);
        actualizarPieLista();
        return;
    }

    const accion = event.target.closest('[data-ml-accion]');
    if (!accion) return;
    switch (accion.dataset.mlAccion) {
        case 'comparar': {
            comparadas = [...seleccion]
                .map(clave => window.Favoritos.leer().find(f => f.clave === clave))
                .filter(Boolean)
                .map(item => resolver(item))
                .filter(Boolean);
            if (comparadas.length < 2) {
                window.Favoritos.mostrarToast('Alguna de las elegidas ya no está en el catálogo');
                pintarLista();
                return;
            }
            pantalla = 'comparacion';
            pintar();
            cuerpo.scrollTop = 0;
            break;
        }
        case 'volver':
            pantalla = 'lista';
            pintar();
            break;
        case 'copiar':
            copiarComparacion();
            break;
        case 'imprimir':
            window.print();
            break;
        case 'vaciar':
            confirmandoVaciar = true;
            actualizarPieLista();
            break;
        case 'cancelar-vaciar':
            confirmandoVaciar = false;
            actualizarPieLista();
            break;
        case 'confirmar-vaciar':
            confirmandoVaciar = false;
            seleccion.clear();
            window.Favoritos.vaciar();
            break;
        case 'cerrar-e-ir':
            cerrarMiLista();
            break;
    }
}

// El click se delega una sola vez sobre el overlay: la lista se re-pinta entera
// en cada cambio, así que cablear botón por botón sería re-cablear siempre.
function configurarEventosMiLista() {
    if (!raiz || raiz.dataset.eventos) return;
    raiz.dataset.eventos = '1';
    raiz.addEventListener('click', manejarClick);
}
