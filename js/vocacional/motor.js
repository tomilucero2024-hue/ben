// ============================================================================
// 🧠 MOTOR DEL TEST VOCACIONAL COMPLETO
// ============================================================================
//
// Calcula, SIN curación manual, tres cosas y las cruza:
//
//   1. El perfil del estudiante, a partir de sus respuestas (0-10 por dimensión).
//   2. El perfil de cada carrera (ya viene calculado en perfiles-carreras.json).
//   3. La afinidad entre ambos, en porcentaje, con una explicación en palabras.
//
// Dimensiones:
//   riasec: R Realista · I Investigador · A Artístico · S Social · E Emprendedor · C Convencional
//   apt:    lógico-matemática · verbal · espacial · interpersonal · corporal-kinestésica
//   val:    estabilidad · variedad · equipo · impacto · ingresos · movilidad
//   ctx:    presión externa (no entra en el match: se usa para las alertas)
//
// Cómo se calcula el perfil del estudiante (explicado simple):
//   Cada pregunta pesa hacia una o más dimensiones (ej: "Investigar en un
//   laboratorio" pesa 1.0 en Investigador y 0.3 en Realista). La respuesta va
//   de 1 a 5 y se convierte a 0-1. Para cada dimensión se hace el promedio de
//   las respuestas PONDERADO por esos pesos y se multiplica por 10. O sea: no
//   hay puntajes escritos a mano en ningún lado, todo sale de las respuestas.
//
// Cómo se calcula la afinidad (explicado simple):
//   1. Se arma un vector por bloque (RIASEC, aptitudes, valores) para el
//      estudiante y para la carrera, y cada bloque se multiplica por su peso
//      (por defecto 0.5 / 0.3 / 0.2, editable en config.json).
//   2. Se mide la distancia (L1) entre los dos vectores y se normaliza por el
//      máximo posible, así que 0 distancia = 100% de afinidad.
//   3. El porcentaje se topa en config.afinidad.techo_porcentaje (97%): dos
//      perfiles nunca son idénticos, y un 100% prometería de más. Se descartó
//      el coseno porque en vectores positivos amontonaba cientos de carreras
//      entre 90 y 95%: no discriminaba.
//
// Este archivo es un script clásico a propósito (igual que favoritos.js):
// expone window.Vocacional y no depende del sistema de módulos.
// ============================================================================

// Etiquetas legibles y descripciones cortas de cada dimensión.
const ETIQUETAS = {
  riasec: {
    R: { nombre: 'Realista', desc: 'Trabajo práctico, manual, con herramientas o máquinas' },
    I: { nombre: 'Investigador', desc: 'Entender, analizar e investigar cómo funcionan las cosas' },
    A: { nombre: 'Artístico', desc: 'Crear, expresar, diseñar, imaginar' },
    S: { nombre: 'Social', desc: 'Ayudar, enseñar, cuidar y acompañar a otras personas' },
    E: { nombre: 'Emprendedor', desc: 'Liderar, convencer, negociar y hacer crecer proyectos' },
    C: { nombre: 'Convencional', desc: 'Ordenar, organizar y trabajar con datos y procedimientos' }
  },
  apt: {
    logico_matematica: { nombre: 'lógico-matemática', desc: 'Resolver problemas con lógica y números' },
    verbal: { nombre: 'verbal', desc: 'Leer, escribir y explicar con palabras' },
    espacial: { nombre: 'espacial', desc: 'Imaginar formas, planos y espacios' },
    interpersonal: { nombre: 'interpersonal', desc: 'Entender y tratar con otras personas' },
    corporal: { nombre: 'corporal-kinestésica', desc: 'Coordinar el cuerpo y las manos' }
  },
  val: {
    estabilidad: { nombre: 'estabilidad', desc: 'Trabajo previsible e ingresos seguros' },
    variedad: { nombre: 'variedad', desc: 'Desafíos y proyectos que cambian' },
    equipo: { nombre: 'trabajo en equipo', desc: 'Decidir y lograr cosas con otras personas' },
    impacto: { nombre: 'impacto social', desc: 'Que el trabajo mejore algo de la sociedad' },
    ingresos: { nombre: 'buenos ingresos', desc: 'Ganar bien' },
    movilidad: { nombre: 'movilidad', desc: 'Mudarse, viajar o trabajar desde cualquier lugar' }
  }
};

// Frases para el resumen humano (evitan mostrar el código RIASEC pelado).
const FRASES_RIASEC = {
  R: 'te gusta trabajar con las manos y resolver cosas concretas',
  I: 'te motiva entender cómo funcionan las cosas',
  A: 'te expresás creando',
  S: 'te motiva ayudar a las personas',
  E: 'te gusta liderar y emprender',
  C: 'te gusta el orden y el trabajo bien hecho'
};

let config = null;
let preguntas = null;
let secciones = null;
let perfiles = null;
let promesaCarga = null;

// Carga config + preguntas + perfiles una sola vez.
async function cargarDatos() {
  if (promesaCarga) return promesaCarga;
  promesaCarga = (async () => {
    try {
      const [rConfig, rPreguntas, rPerfiles] = await Promise.all([
        fetch('/data/vocacional/config.json'),
        fetch('/data/vocacional/preguntas.json'),
        fetch('/data/vocacional/perfiles-carreras.json')
      ]);
      if (!rConfig.ok || !rPreguntas.ok || !rPerfiles.ok) throw new Error('No se pudieron cargar los datos del test vocacional');
      config = await rConfig.json();
      const banco = await rPreguntas.json();
      preguntas = banco.preguntas;
      secciones = banco.secciones || [];
      perfiles = (await rPerfiles.json()).carreras;
      return { config, preguntas, secciones, perfiles };
    } catch (e) {
      promesaCarga = null;
      throw e;
    }
  })();
  return promesaCarga;
}

function setDatos({ config: c, preguntas: p, secciones: s, perfiles: pf }) {
  if (c) config = c;
  if (p) preguntas = p;
  if (s) secciones = s;
  if (pf) perfiles = pf;
}

// Bloques de dimensiones del match, con su clave en config.pesos_match.
const BLOQUES = [
  { id: 'riasec', pesoConfig: 'riasec', dims: ['R', 'I', 'A', 'S', 'E', 'C'] },
  { id: 'apt', pesoConfig: 'aptitudes', dims: ['logico_matematica', 'verbal', 'espacial', 'interpersonal', 'corporal'] },
  { id: 'val', pesoConfig: 'valores', dims: ['estabilidad', 'variedad', 'equipo', 'impacto', 'ingresos', 'movilidad'] }
];

function recortar(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function redondear(n, decimales = 1) {
  const f = Math.pow(10, decimales);
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// 1) PERFIL DEL ESTUDIANTE
// ---------------------------------------------------------------------------
// respuestas: { idPregunta: 1..5 }. Devuelve los tres vectores (0-10), el
// código RIASEC de 3 letras y el contexto (presión externa).
function calcularPerfil(respuestas, bancoPreguntas) {
  const lista = bancoPreguntas || preguntas || [];
  const suma = {};
  const pesos = {};

  const acumular = (ruta, valor) => {
    suma[ruta] = (suma[ruta] || 0) + valor;
    pesos[ruta] = (pesos[ruta] || 0) + 1;
  };

  lista.forEach(p => {
    const respuesta = Number(respuestas ? respuestas[p.id] : NaN);
    if (!Number.isFinite(respuesta)) return;
    let raw = (recortar(respuesta, 1, 5) - 1) / 4; // 0 a 1
    if (p.invertida) raw = 1 - raw;
    Object.entries(p.dims || {}).forEach(([ruta, peso]) => {
      // Para el promedio ponderado guardamos el peso en "pesos" y el valor
      // ponderado por el peso en "suma": suma/pesos es el promedio correcto.
      suma[ruta] = (suma[ruta] || 0) + peso * raw;
      pesos[ruta] = (pesos[ruta] || 0) + peso;
    });
  });

  const valor = ruta => (pesos[ruta] > 0 ? redondear((suma[ruta] / pesos[ruta]) * 10) : 0);

  const perfil = {
    riasec: {}, apt: {}, val: {},
    contexto: { presion: 0 },
    respuestas: { ...(respuestas || {}) }
  };
  BLOQUES.forEach(bloque => {
    bloque.dims.forEach(dim => { perfil[bloque.id][dim] = valor(`${bloque.id}.${dim}`); });
  });
  perfil.contexto.presion = valor('ctx.presion');
  perfil.codigo = codigoRiasec(perfil.riasec);
  return perfil;
}

// Las 3 letras RIASEC más altas, en orden (ej: "SIA").
function codigoRiasec(riasec) {
  return Object.entries(riasec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([letra]) => letra)
    .join('');
}

// ---------------------------------------------------------------------------
// 2) AFINIDAD ESTUDIANTE ↔ CARRERA
// ---------------------------------------------------------------------------
// Se mide qué tan parecidos son los dos perfiles con una DISTANCIA
// NORMALIZADA: para cada dimensión se calcula la diferencia absoluta entre
// estudiante y carrera (0-10), se promedian las dimensiones de cada bloque y
// se combinan los bloques con sus pesos. El resultado 0-1 se convierte en
// porcentaje: 100% = perfiles idénticos, 0% = opuestos.
//
// ¿Por qué no coseno? Porque con vectores positivos el coseno casi nunca baja
// de 0.7 y amontona cientos de carreras en 90-95%, sin discriminar. La
// distancia normalizada aprovecha todo el espectro y hace legible el número.
function calcularAfinidad(perfilEstudiante, perfilCarrera, cfg) {
  const ajustes = cfg || config || {};
  const pesos = ajustes.pesos_match || { riasec: 0.5, aptitudes: 0.3, valores: 0.2 };
  const afinidadCfg = ajustes.afinidad || { techo_porcentaje: 97 };

  let distancia = 0;
  BLOQUES.forEach(bloque => {
    const peso = pesos[bloque.pesoConfig] !== undefined ? pesos[bloque.pesoConfig] : 0;
    const diferencia = bloque.dims.reduce((suma, dim) => {
      const u = (perfilEstudiante[bloque.id] || {})[dim] || 0;
      const c = (perfilCarrera[bloque.id] || {})[dim] || 0;
      return suma + Math.abs(u - c);
    }, 0) / bloque.dims.length / 10; // 0 a 1
    distancia += peso * diferencia;
  });

  const techo = afinidadCfg.techo_porcentaje !== undefined ? afinidadCfg.techo_porcentaje : 97;
  const porcentaje = Math.round(recortar((1 - distancia) * techo, 0, techo));
  return { porcentaje, distancia: redondear(distancia, 4) };
}

// Dimensiones donde estudiante y carrera coinciden en alto. Alimenta el
// "Por qué coincide" de las tarjetas.
function calcularCoincidencias(perfilEstudiante, perfilCarrera) {
  const coincidencias = [];
  BLOQUES.forEach(bloque => {
    bloque.dims.forEach(dim => {
      const u = (perfilEstudiante[bloque.id] || {})[dim] || 0;
      const c = (perfilCarrera[bloque.id] || {})[dim] || 0;
      if (u >= 6 && c >= 6) {
        coincidencias.push({
          dimension: `${bloque.id}.${dim}`,
          label: ETIQUETAS[bloque.id][dim].nombre,
          desc: ETIQUETAS[bloque.id][dim].desc,
          userScore: u,
          carreraScore: c,
          fuerza: u * c
        });
      }
    });
  });
  coincidencias.sort((a, b) => b.fuerza - a.fuerza);
  return coincidencias.slice(0, 4);
}

// Cosas que la carrera pide mucho y el estudiante muestra poco. Se muestran
// como alertas dentro de la tarjeta.
function calcularAlertasCarrera(perfilEstudiante, perfilCarrera) {
  const alertas = [];
  BLOQUES.forEach(bloque => {
    bloque.dims.forEach(dim => {
      const u = (perfilEstudiante[bloque.id] || {})[dim] || 0;
      const c = (perfilCarrera[bloque.id] || {})[dim] || 0;
      if (c >= 8 && u <= 3 && bloque.id !== 'val') {
        alertas.push({
          mensaje: `Esta carrera pide bastante ${ETIQUETAS[bloque.id][dim].nombre.toLowerCase()} y tus respuestas muestran poca afinidad ahí.`
        });
      }
    });
  });
  return alertas.slice(0, 2);
}

// Frase corta y humana que explica el match (la usa la tarjeta de resultado).
function explicarMatch(perfilEstudiante, perfilCarrera, coincidencias) {
  const topsR = coincidencias.filter(c => c.dimension.startsWith('riasec.'));
  const topsA = coincidencias.filter(c => c.dimension.startsWith('apt.'));
  const partes = [];
  if (topsR.length) {
    partes.push(`tu perfil ${topsR.slice(0, 2).map(c => c.label).join('-')}`);
  }
  if (topsA.length) {
    partes.push(`tu aptitud ${topsA[0].label} alta`);
  }
  if (!partes.length) return 'Aparece como una opción para explorar según tus respuestas.';
  return `Calza con ${partes.join(' y ')}.`;
}

// ---------------------------------------------------------------------------
// 3) ALERTAS DE TENSIÓN (intereses vs. valores vs. contexto)
// ---------------------------------------------------------------------------
// No son advertencias ni diagnósticos: son cosas para pensar. Por eso el texto
// es siempre en segunda persona y sin imperativos alarmantes.
function alertasTension(perfil) {
  const { riasec, val, contexto } = perfil;
  const alertas = [];
  const alta = (v) => v >= 7;
  const baja = (v) => v <= 3;

  if (alta(contexto.presion)) {
    alertas.push('Sentís que tenés que elegir algo que otros aprueben. Antes de descartar una opción, vale la pena preguntarte si la descartás por vos o por lo que esperan los demás.');
  }
  if (alta(riasec.A) && alta(val.ingresos)) {
    alertas.push('Te atrae lo artístico y también querés ingresos altos. Las carreras creativas no siempre pagan mucho al principio: hay opciones donde la creatividad se combina con una salida laboral más estable, y vale mirarlas.');
  }
  if (alta(riasec.A) && alta(val.estabilidad)) {
    alertas.push('Te gusta crear y a la vez valorás la estabilidad. Al comienzo, muchas carreras creativas tienen ingresos variables: preguntar por la salida laboral concreta ayuda a decidir con más calma.');
  }
  if ((alta(riasec.S) || alta(riasec.I)) && baja(val.movilidad)) {
    alertas.push('Tus intereses apuntan a carreras de salud, educación o investigación, y varias incluyen guardias, rotaciones o prácticas en distintos lugares. Con poca disposición a mudarte, conviene chequear dónde se cursan las prácticas.');
  }
  if (alta(riasec.E) && alta(val.estabilidad)) {
    alertas.push('Te gusta emprender y liderar, pero valorás mucho la estabilidad. Se pueden combinar: empezar en relación de dependencia y emprender después, o buscar organizaciones donde puedas liderar proyectos.');
  }
  if (alta(riasec.S) && baja(val.equipo)) {
    alertas.push('Te interesa ayudar a las personas pero preferís trabajar de forma autónoma. Hay carreras sociales con mucho trabajo individual (investigación, consultoría): buscar ese matiz te puede ayudar.');
  }
  return alertas.slice(0, 3);
}

// ---------------------------------------------------------------------------
// 4) RESUMEN DEL PERFIL EN LENGUAJE SIMPLE
// ---------------------------------------------------------------------------
function resumenPerfil(perfil) {
  const riasecOrden = Object.entries(perfil.riasec).sort((a, b) => b[1] - a[1]);
  const topR = riasecOrden.slice(0, 2).map(([letra]) => letra);
  const nombreR = topR.map(l => ETIQUETAS.riasec[l].nombre).join('-');
  const frases = topR.map(l => FRASES_RIASEC[l]).filter(Boolean);

  const aptOrden = Object.entries(perfil.apt).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const valOrden = Object.entries(perfil.val).sort((a, b) => b[1] - a[1]).slice(0, 2);

  let texto = `Tenés un perfil ${nombreR}: ${frases.join(' y ')}.`;
  if (aptOrden.length) {
    texto += ` Tus aptitudes más fuertes son la ${aptOrden.map(a => ETIQUETAS.apt[a[0]].nombre).join(' y la ')}.`;
  }
  if (valOrden.length) {
    texto += ` Valorás ${valOrden.map(v => ETIQUETAS.val[v[0]].nombre).join(' y ')}.`;
  }
  return texto;
}

// Etiquetas del código RIASEC para mostrar en pantalla (ej: "S · I · E").
function etiquetasCodigo(codigo) {
  return String(codigo || '').split('').map(l => `${l} · ${ETIQUETAS.riasec[l] ? ETIQUETAS.riasec[l].nombre : l}`).join(' · ');
}

// ---------------------------------------------------------------------------
// 5) RANKING DE TODAS LAS CARRERAS
// ---------------------------------------------------------------------------
// Devuelve la misma forma que ya usa la grilla del sitio:
// { todas, grados, tecnicaturas, cursos, total, porClave }
function generarRanking(perfilEstudiante, listaPerfiles, cfg, opciones = {}) {
  const lista = listaPerfiles || perfiles || [];
  const limite = opciones.limite || 30;

  const resultados = lista.map(carrera => {
    const { porcentaje } = calcularAfinidad(perfilEstudiante, carrera.perfil, cfg);
    const coincidencias = calcularCoincidencias(perfilEstudiante, carrera.perfil);
    return {
      clave: carrera.clave,
      nombre: carrera.nombre,
      categoria: carrera.categoria,
      area: carrera.area,
      formacion: carrera.formacion,
      instituciones: carrera.instituciones,
      compatibilidad: porcentaje,
      explicacion: explicarMatch(perfilEstudiante, carrera.perfil, coincidencias),
      coincidencias,
      alertas: calcularAlertasCarrera(perfilEstudiante, carrera.perfil)
    };
  });

  resultados.sort((a, b) => b.compatibilidad - a.compatibilidad);

  const porClave = new Map(resultados.map(r => [r.clave, r]));
  const grados = resultados.filter(r => r.formacion === 'grado' || r.formacion === 'profesorados');
  const tecnicaturas = resultados.filter(r => r.formacion === 'tecnicaturas');
  const cursos = resultados.filter(r => r.formacion === 'cursos');

  return {
    todas: resultados.slice(0, limite),
    grados,
    tecnicaturas,
    cursos,
    total: resultados.length,
    porClave
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ETIQUETAS, FRASES_RIASEC, BLOQUES,
    cargarDatos, setDatos, calcularPerfil, codigoRiasec, calcularAfinidad,
    calcularCoincidencias, calcularAlertasCarrera, explicarMatch, alertasTension,
    resumenPerfil, etiquetasCodigo, generarRanking,
    get config() { return config; },
    get preguntas() { return preguntas; },
    get secciones() { return secciones; },
    get perfiles() { return perfiles; }
  };
} else {
  window.Vocacional = {
    ETIQUETAS, FRASES_RIASEC, BLOQUES,
    cargarDatos, setDatos, calcularPerfil, codigoRiasec, calcularAfinidad,
    calcularCoincidencias, calcularAlertasCarrera, explicarMatch, alertasTension,
    resumenPerfil, etiquetasCodigo, generarRanking,
    get config() { return config; },
    get preguntas() { return preguntas; },
    get secciones() { return secciones; },
    get perfiles() { return perfiles; }
  };
}
