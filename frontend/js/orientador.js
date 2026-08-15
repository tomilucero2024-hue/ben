// ==========================================
// 🎯 ORIENTADOR VOCACIONAL - Motor de Compatibilidad
// ==========================================
// Sistema de matching multidimensional basado en perfiles de carrera precalculados
// No usa IA externa - todo frontend, sin costo, compatible GitHub Pages
// ==========================================

const DIMENSIONES = [
  'analitico',
  'tecnologico',
  'practico',
  'social',
  'creativo',
  'terreno',
  'liderazgo',
  'teorico',
  'matematico',
  'movilidad'
];

const DIMENSION_LABELS = {
  analitico: 'Pensamiento analítico',
  tecnologico: 'Afinidad tecnológica',
  practico: 'Trabajo práctico',
  social: 'Interacción social',
  creativo: 'Creatividad',
  terreno: 'Trabajo en terreno/aire libre',
  liderazgo: 'Liderazgo y gestión',
  teorico: 'Base teórica/académica',
  matematico: 'Carga matemática',
  movilidad: 'Movilidad geográfica'
};

const DIMENSION_DESC = {
  analitico: 'Resolver problemas complejos, lógica, análisis de datos',
  tecnologico: 'Programación, sistemas, herramientas digitales, innovación tech',
  practico: 'Trabajo manual, técnico, experimental, "manos a la obra"',
  social: 'Trato con personas, trabajo en equipo, atención, docencia, cuidado',
  creativo: 'Diseño, innovación, arte, pensamiento lateral, creación de contenido',
  terreno: 'Salidas de campo, trabajo al aire libre, movilidad física, obra',
  liderazgo: 'Gestión de equipos, toma de decisiones, emprendimiento, coordinación',
  teorico: 'Estudio profundo, investigación, bases científicas, formación académica',
  matematico: 'Cálculo, estadística, modelado matemático, materias cuantitativas',
  movilidad: 'Trabajo remoto, itinerante, cambios de sede, libertad geográfica'
};

let perfilesCarreras = null;
let ofertasIndex = null;

async function cargarPerfilesCarreras() {
  if (perfilesCarreras) return perfilesCarreras;
  try {
    const resp = await fetch('../data/carreras-perfiles.json');
    if (!resp.ok) throw new Error('No se pudo cargar carreras-perfiles.json');
    const data = await resp.json();
    perfilesCarreras = data.carreras || [];
    console.log(`[Orientador] ${perfilesCarreras.length} perfiles de carrera cargados`);
    return perfilesCarreras;
  } catch (e) {
    console.error('[Orientador] Error cargando perfiles:', e);
    perfilesCarreras = [];
    return perfilesCarreras;
  }
}

function setOfertasIndex(ofertas) {
  ofertasIndex = ofertas;
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ==========================================
// 🔢 ALGORITMO DE COMPATIBILIDAD
// ==========================================
// Usa similitud del coseno ponderada + bonus/penalizaciones
// Devuelve porcentaje 0-100 + explicaciones detalladas
// ==========================================

function calcularCompatibilidad(perfilUsuario, carrera) {
  const perfilCarrera = carrera.perfil;
  if (!perfilCarrera) return { compatibilidad: 0, explicacion: '', coincidencias: [], alertas: [] };

  // 1. Similitud del coseno (0-1)
  let dot = 0, normU = 0, normC = 0;
  DIMENSIONES.forEach(d => {
    const u = perfilUsuario[d] || 0;
    const c = perfilCarrera[d] || 0;
    dot += u * c;
    normU += u * u;
    normC += c * c;
  });
  const coseno = (normU > 0 && normC > 0) ? dot / (Math.sqrt(normU) * Math.sqrt(normC)) : 0;

  // 2. Normalizar a porcentaje base (coseno 0-1 → 0-100)
  let compatibilidad = Math.round(coseno * 100);

  // 3. Bonus por dimensiones fuertes del usuario que la carrera satisface bien
  DIMENSIONES.forEach(d => {
    const u = perfilUsuario[d] || 0;
    const c = perfilCarrera[d] || 0;
    if (u >= 4 && c >= 4) compatibilidad += 3; // Match fuerte en dimensión importante
    else if (u >= 3 && c >= 3) compatibilidad += 1;
  });

  // 4. Penalización por incompatibilidades fuertes (usuario quiere evitar, carrera tiene alto)
  DIMENSIONES.forEach(d => {
    const u = perfilUsuario[d] || 0;
    const c = perfilCarrera[d] || 0;
    if (u <= 1 && c >= 4) compatibilidad -= 5; // Usuario rechaza lo que la carrera exige
    else if (u <= 2 && c >= 5) compatibilidad -= 3;
  });

  // 5. Clamp 0-100
  compatibilidad = Math.max(0, Math.min(100, compatibilidad));

  // 6. Generar explicaciones
  const coincidencias = [];
  const alertas = [];

  DIMENSIONES.forEach(d => {
    const u = perfilUsuario[d] || 0;
    const c = perfilCarrera[d] || 0;
    if (u >= 3 && c >= 3) {
      coincidencias.push({
        dimension: d,
        label: DIMENSION_LABELS[d],
        desc: DIMENSION_DESC[d],
        userScore: u,
        carreraScore: c
      });
    }
    if (u <= 2 && c >= 4) {
      alertas.push({
        dimension: d,
        label: DIMENSION_LABELS[d],
        desc: DIMENSION_DESC[d],
        userScore: u,
        carreraScore: c,
        mensaje: `Esta carrera tiene ${DIMENSION_LABELS[d].toLowerCase()} alta (${c}/5), pero tu perfil muestra poca afinidad (${u}/5).`
      });
    }
  });

  // Ordenar coincidencias por relevancia (producto de scores)
  coincidencias.sort((a, b) => (b.userScore * b.carreraScore) - (a.userScore * a.carreraScore));

  // Generar texto explicativo
  let explicacion = '';
  if (coincidencias.length > 0) {
    const top = coincidencias.slice(0, 3).map(c => c.label).join(', ');
    explicacion = `Tu perfil encaja bien por: <strong>${top}</strong>.`;
  } else {
    explicacion = 'Esta carrera aparece como opción alternativa basada en tus preferencias generales.';
  }

  return {
    compatibilidad,
    explicacion,
    coincidencias: coincidencias.slice(0, 4),
    alertas: alertas.slice(0, 3)
  };
}

function generarRanking(perfilUsuario, opciones = {}) {
  const { limite = 10, agruparPorFormacion = true } = opciones;
  
  if (!perfilesCarreras || !perfilesCarreras.length) {
    console.warn('[Orientador] Perfiles no cargados');
    return [];
  }

  const resultados = perfilesCarreras.map(carrera => {
    const calc = calcularCompatibilidad(perfilUsuario, carrera);
    return {
      ...carrera,
      compatibilidad: calc.compatibilidad,
      explicacion: calc.explicacion,
      coincidencias: calc.coincidencias,
      alertas: calc.alertas
    };
  });

  // Filtrar solo los que tienen cierta compatibilidad mínima
  const filtrados = resultados.filter(r => r.compatibilidad > 15);

  // Ordenar por compatibilidad descendente
  filtrados.sort((a, b) => b.compatibilidad - a.compatibilidad);

  const grupos = {
    grados: filtrados.filter(r => r.formacion === 'grado' || r.formacion === 'profesorados').slice(0, Math.ceil(limite / 3)),
    tecnicaturas: filtrados.filter(r => r.formacion === 'tecnicaturas').slice(0, Math.ceil(limite / 3)),
    cursos: filtrados.filter(r => r.formacion === 'cursos').slice(0, Math.ceil(limite / 3))
  };

  if (agruparPorFormacion) {
    // Intercalar para mostrar variedad
    const intercalados = [];
    const maxLen = Math.max(grupos.grados.length, grupos.tecnicaturas.length, grupos.cursos.length);
    for (let i = 0; i < maxLen; i++) {
      ['grados', 'tecnicaturas', 'cursos'].forEach(k => {
        if (grupos[k][i]) intercalados.push(grupos[k][i]);
      });
    }
    const todas = intercalados.slice(0, limite);
    return {
      grados: grupos.grados,
      tecnicaturas: grupos.tecnicaturas,
      cursos: grupos.cursos,
      todas
    };
  }

  const todas = filtrados.slice(0, limite);
  return {
    grados: grupos.grados,
    tecnicaturas: grupos.tecnicaturas,
    cursos: grupos.cursos,
    todas
  };
}

function getInstitucionesParaCarrera(nombreCarrera) {
  if (!ofertasIndex) return [];
  const nombreNorm = normalizar(nombreCarrera);
  const insts = new Set();
  ofertasIndex.forEach(o => {
    if (normalizar(o.nombre) === nombreNorm || normalizar(o.nombre).includes(nombreNorm)) {
      insts.add(o.institucion);
    }
  });
  return Array.from(insts).sort();
}

function generarPerfilUsuarioDesdeRespuestas(respuestas) {
  // respuestas: array de objetos { dimensionScores: { analitico: +3, tecnologico: +2, ... } }
  const perfil = {};
  DIMENSIONES.forEach(d => perfil[d] = 0);
  
  respuestas.forEach(r => {
    if (r.dimensionScores) {
      Object.entries(r.dimensionScores).forEach(([dim, val]) => {
        if (perfil[dim] !== undefined) {
          perfil[dim] += val;
        }
      });
    }
  });

  // Normalizar a escala 0-5 comparable con los perfiles de carrera.
  // Cada dimensión tiene un máximo alcanzable distinto según las preguntas;
  // escalamos contra ese máximo para que el perfil use todo el rango.
  const maxPosible = {};
  DIMENSIONES.forEach(d => maxPosible[d] = 0);
  PREGUNTAS_TEST.forEach(p => {
    DIMENSIONES.forEach(d => {
      let best = 0;
      p.opciones.forEach(op => {
        const v = op.dimensionScores[d] || 0;
        if (v > best) best = v;
      });
      maxPosible[d] += best;
    });
  });

  DIMENSIONES.forEach(d => {
    const max = maxPosible[d] || 15;
    perfil[d] = Math.max(0, Math.min(5, Math.round((perfil[d] / max) * 5)));
  });

  return perfil;
}

// Preguntas del test vocacional - cada opción aporta a MÚLTIPLES dimensiones
const PREGUNTAS_TEST = [
  {
    id: 'entorno',
    texto: 'Imaginá un lunes a la mañana en tu trabajo ideal. ¿Qué escenario te atrae más?',
    opciones: [
      {
        texto: 'Frente a una computadora, analizando datos, programando o resolviendo problemas técnicos.',
        dimensionScores: { analitico: 3, tecnologico: 3, teorico: 2, practico: 1 }
      },
      {
        texto: 'En un taller, laboratorio o espacio técnico, operando máquinas, equipos o sistemas.',
        dimensionScores: { practico: 3, tecnologico: 2, analitico: 2, terreno: 1 }
      },
      {
        texto: 'Al aire libre o en terreno, supervisando obras, haciendo relevamientos o trabajo de campo.',
        dimensionScores: { terreno: 3, movilidad: 3, practico: 2, liderazgo: 1 }
      },
      {
        texto: 'En contacto directo con personas: enseñando, cuidando, aseslando o atendiendo público.',
        dimensionScores: { social: 3, liderazgo: 2, creativo: 1, practico: 1 }
      },
      {
        texto: 'En un estudio creativo o espacio de diseño, generando ideas, prototipos o contenido visual.',
        dimensionScores: { creativo: 3, tecnologico: 1, practico: 1, analitico: 1 }
      }
    ]
  },
  {
    id: 'pensamiento',
    texto: '¿Cómo preferís abordar un problema nuevo?',
    opciones: [
      {
        texto: 'Lo desarmo en partes, busco datos, aplico lógica y encuentro la solución paso a paso.',
        dimensionScores: { analitico: 3, matematico: 2, teorico: 2 }
      },
      {
        texto: 'Pruebo soluciones prácticas, hago ensayo-error, me mancho las manos hasta que funciona.',
        dimensionScores: { practico: 3, terreno: 1, creativo: 1 }
      },
      {
        texto: 'Busco ideas originales, pienso fuera de lo convencional, diseño algo distinto.',
        dimensionScores: { creativo: 3, analitico: 1, tecnologico: 1 }
      },
      {
        texto: 'Consulto a otros, trabajo en equipo, busco consenso y reparto tareas.',
        dimensionScores: { social: 3, liderazgo: 2, practico: 1 }
      },
      {
        texto: 'Investigo la teoría, leo papers, entiendo los fundamentos antes de actuar.',
        dimensionScores: { teorico: 3, analitico: 2, matematico: 1 }
      }
    ]
  },
  {
    id: 'matematicas',
    texto: '¿Cómo te sentís con las matemáticas y la física en tu día a día de estudio/trabajo?',
    opciones: [
      {
        texto: 'Me gustan y se me dan bien: disfruto calcular, modelar, resolver ecuaciones.',
        dimensionScores: { matematico: 3, analitico: 2, teorico: 2 }
      },
      {
        texto: 'Las tolero si son necesarias, pero prefiero herramientas que las resuelvan por mí.',
        dimensionScores: { matematico: 1, tecnologico: 2, practico: 1 }
      },
      {
        texto: 'Me frustran: prefiero evitar materias con mucha carga matemática o física.',
        dimensionScores: { matematico: 0, analitico: 1, creativo: 1, social: 1 }
      },
      {
        texto: 'No me importan, pero mi fuerte está en otro lado (personas, diseño, gestión, campo).',
        dimensionScores: { matematico: 1, social: 1, creativo: 1, terreno: 1, liderazgo: 1 }
      }
    ]
  },
  {
    id: 'formacion',
    texto: 'Pensando en tu proyecto de vida a 3-5 años: ¿qué tipo de formación te proyectás?',
    opciones: [
      {
        texto: 'Carrera universitaria larga (4-6 años): título de grado, base sólida, más oportunidades.',
        dimensionScores: { teorico: 2, analitico: 1, liderazgo: 1, matematico: 1 }
      },
      {
        texto: 'Tecnicatura (2-3 años): entrada rápida al mercado, foco práctico, buena salida laboral.',
        dimensionScores: { practico: 2, tecnologico: 1, terreno: 1, movilidad: 1 }
      },
      {
        texto: 'Cursos cortos / certificaciones (meses): skill específico, aplicable ya, flexible.',
        dimensionScores: { practico: 2, tecnologico: 1, movilidad: 2, creativo: 1 }
      },
      {
        texto: 'Formación continua: combino trabajo y estudio, voy armando mi perfil a medida.',
        dimensionScores: { movilidad: 2, liderazgo: 1, social: 1, practico: 1 }
      }
    ]
  },
  {
    id: 'estilo_vida',
    texto: '¿Qué valorás MÁS en tu futuro laboral?',
    opciones: [
      {
        texto: 'Estabilidad, previsibilidad, horario fijo, crecimiento gradual en una organización.',
        dimensionScores: { teorico: 1, analitico: 1, liderazgo: 1, movilidad: 0 }
      },
      {
        texto: 'Variedad, desafíos nuevos, proyectos cambiantes, libertad para innovar.',
        dimensionScores: { creativo: 2, analitico: 1, tecnologico: 1, movilidad: 1 }
      },
      {
        texto: 'Autonomía, trabajo remoto o híbrido, manejar mis tiempos, equilibrio vida-trabajo.',
        dimensionScores: { movilidad: 3, tecnologico: 1, practico: 1 }
      },
      {
        texto: 'Impacto social directo: ayudar a otros, mejorar la comunidad, trabajo con sentido.',
        dimensionScores: { social: 3, liderazgo: 1, practico: 1, terreno: 1 }
      },
      {
        texto: 'Ingresos altos, progresión rápida, responsabilidades de gestión y decisión.',
        dimensionScores: { liderazgo: 3, analitico: 1, matematico: 1, social: 1 }
      }
    ]
  }
];

// Exportar para uso en browser (IIFE o module)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DIMENSIONES,
    DIMENSION_LABELS,
    DIMENSION_DESC,
    PREGUNTAS_TEST,
    cargarPerfilesCarreras,
    setOfertasIndex,
    calcularCompatibilidad,
    generarRanking,
    getInstitucionesParaCarrera,
    generarPerfilUsuarioDesdeRespuestas,
    normalizar,
    get perfilesCarreras() { return perfilesCarreras; }
  };
} else {
  window.Orientador = {
    DIMENSIONES,
    DIMENSION_LABELS,
    DIMENSION_DESC,
    PREGUNTAS_TEST,
    cargarPerfilesCarreras,
    setOfertasIndex,
    calcularCompatibilidad,
    generarRanking,
    getInstitucionesParaCarrera,
    generarPerfilUsuarioDesdeRespuestas,
    normalizar,
    get perfilesCarreras() { return perfilesCarreras; }
  };
}