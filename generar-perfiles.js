const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data', 'data.json');
const OUTPUT_PATH = path.join(__dirname, 'data', 'carreras-perfiles.json');

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

// Claves de data.json que NO son la lista "instituciones" pero igual tienen
// carreras que el Copiloto tiene que poder recomendar.
// Queda AFUERA 'secundario' a propósito: sus cuatro entradas (CEBJA, CENS,
// CEPAS, Terminalidad Educativa) son terminalidad educativa, no cursos con
// contenido. No tienen duración ni temática, así que puntuarlas contra un
// perfil de intereses daría un "80% de match" que no significa nada.
const CATALOGOS_APARTE = [
  'formaciones_alternativas',
  'oficios_tecnicos'
];

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tienePalabra(texto, ...palabras) {
  const t = normalizar(texto);
  return palabras.some(p => t.includes(normalizar(p)));
}

function getArea(nombre) {
  const n = normalizar(nombre);
  if (tienePalabra(n, 'ingenier')) return 'Ingeniería';
  if (tienePalabra(n, 'program', 'sistema', 'informat', 'comput', 'software', 'datos', 'data', 'inteligencia artificial', 'ciberseguridad', 'robotica', 'videojuego', 'web', 'cloud', 'telecomunicacion', 'ia desde cero', 'desarrollo de software', 'seguridad informatica')) return 'Tecnología';
  if (tienePalabra(n, 'medicin', 'enfermer', 'kinesi', 'nutric', 'odont', 'farmac', 'fonoaudi', 'obstetric', 'terapia', 'radiolog', 'bioquim', 'salud', 'anestesia', 'instrumentacion quirurg', 'diagnostico por imagenes', 'quirofano', 'podolog', 'terapeutico', 'anatomia patologica', 'bioimagenes', 'gerontolog', 'primeros auxilios', 'salud mental', 'psicologia')) return 'Salud';
  if (tienePalabra(n, 'administracion', 'contador', 'contad', 'marketing', 'comercio', 'negocio', 'finanza', 'econom', 'recursos humanos', 'logistica', 'secretariado', 'gestion empresarial', 'ventas', 'seguros', 'banc', 'comercializacion', 'community manager', 'martillero', 'corredor inmobiliario', 'inmobiliari', 'aduan', 'despachante de aduana', 'gestion aeroportuaria', 'siniestro', 'emprendimiento', 'gestion del liderazgo')) return 'Negocios';
  if (tienePalabra(n, 'diseno', 'arquitect', 'multimedia', 'interiorismo', 'indumentaria', 'animacion', 'fotograf', 'grafic', 'audiovisual', 'publicidad')) return 'Diseño';
  if (tienePalabra(n, 'profesorado', 'educacion', 'pedagog', 'didact', 'docencia', 'ensenanza')) return 'Educación';
  if (tienePalabra(n, 'turismo', 'hoteler', 'guia de turismo', 'hospitalidad', 'viajes', 'recreacion', 'guia de alta montana', 'trekking', 'gestion de recursos turisticos', 'gestion turistica')) return 'Turismo';
  if (tienePalabra(n, 'gastronom', 'cocina', 'pasteler', 'panader', 'chef', 'sommelier', 'enolog', 'vino', 'cocteler', 'bartender', 'sensorial de vinos', 'cata de vinos', 'finca vitivinicola', 'vitivinicola', 'laboratorio vitivinicola', 'bromatolog')) return 'Gastronomía';
  if (tienePalabra(n, 'ingles', 'idioma', 'portugues', 'frances', 'traduccion', 'interpretacion', 'italiano', 'chino', 'coreano', 'aleman', 'japones', 'lengua de senas', 'lengua extranjera')) return 'Idiomas';
  if (tienePalabra(n, 'arte', 'musica', 'teatro', 'escenograf', 'danza', 'cine', 'ilustracion', 'canto', 'coral', 'organo', 'instrumento', 'ceramica artistica', 'actor', 'actriz', 'artes visuales', 'artes plasticas', 'piano', 'guitarra', 'composicion musical', 'bellas artes')) return 'Arte';
  if (tienePalabra(n, 'ambient', 'agronom', 'biolog', 'geolog', 'forestal', 'veterin', 'quimic', 'hidric', 'ecolog', 'apicultur', 'paisajis', 'agro', 'recursos naturales', 'botanica', 'zoolog', 'ciencias de la tierra', 'geografia', 'geografo', 'fisica', 'matematica')) return 'Ambiente';
  if (tienePalabra(n, 'mecanic', 'electric', 'carpinter', 'refrigeracion', 'soldadur', 'construccion', 'automotor', 'gasista', 'plomer', 'cerrajeri', 'torner', 'herreri', 'pintur', 'albanil', 'mantenimiento', 'instalacion', 'oficio', 'pilot', 'buceo', 'drone', 'drones', 'aeronaut', 'chofer', 'conductor', 'barberia', 'peluqueri', 'electricista', 'ceramica industrial')) return 'Oficios';
  return 'Ciencias sociales';
}

function getFormacion(categoria, nombre) {
  const t = normalizar(`${categoria} ${nombre}`);
  if (tienePalabra(t, 'profesorado')) return 'profesorados';
  if (tienePalabra(t, 'tecnicatura', 'tecnico', 'pregrado')) return 'tecnicaturas';
  if (tienePalabra(t, 'curso', 'formacion profesional', 'capacitacion', 'taller', 'diplomatura')) return 'cursos';
  return 'grado';
}

function calcularPerfilCarrera(carrera) {
  const nombre = normalizar(carrera.nombre);
  const categoria = normalizar(carrera.categoria);
  const area = getArea(carrera.nombre);
  const formacion = getFormacion(carrera.categoria, carrera.nombre);

  const perfil = {
    analitico: 0,
    tecnologico: 0,
    practico: 0,
    social: 0,
    creativo: 0,
    terreno: 0,
    liderazgo: 0,
    teorico: 0,
    matematico: 0,
    movilidad: 0
  };

  const basePorArea = {
    'Ingeniería':       { analitico: 5, tecnologico: 4, practico: 3, matematico: 5, teorico: 4, terreno: 1, social: 1, creativo: 2, liderazgo: 2, movilidad: 2 },
    'Tecnología':       { analitico: 4, tecnologico: 5, practico: 3, matematico: 3, teorico: 3, terreno: 1, social: 1, creativo: 3, liderazgo: 2, movilidad: 2 },
    'Salud':            { analitico: 4, tecnologico: 2, practico: 5, social: 5, creativo: 1, terreno: 1, liderazgo: 2, teorico: 4, matematico: 2, movilidad: 2 },
    'Negocios':         { analitico: 4, tecnologico: 2, practico: 3, social: 4, creativo: 2, terreno: 1, liderazgo: 4, teorico: 3, matematico: 3, movilidad: 3 },
    'Diseño':           { analitico: 2, tecnologico: 3, practico: 4, social: 2, creativo: 5, terreno: 1, liderazgo: 2, teorico: 2, matematico: 1, movilidad: 2 },
    'Educación':        { analitico: 2, tecnologico: 1, practico: 3, social: 5, creativo: 3, terreno: 1, liderazgo: 3, teorico: 4, matematico: 1, movilidad: 2 },
    'Turismo':          { analitico: 2, tecnologico: 1, practico: 3, social: 5, creativo: 2, terreno: 3, liderazgo: 2, teorico: 2, matematico: 1, movilidad: 4 },
    'Gastronomía':      { analitico: 1, tecnologico: 1, practico: 5, social: 3, creativo: 4, terreno: 1, liderazgo: 2, teorico: 1, matematico: 1, movilidad: 2 },
    'Idiomas':          { analitico: 3, tecnologico: 1, practico: 2, social: 4, creativo: 3, terreno: 1, liderazgo: 1, teorico: 4, matematico: 1, movilidad: 3 },
    'Arte':             { analitico: 1, tecnologico: 1, practico: 4, social: 3, creativo: 5, terreno: 1, liderazgo: 2, teorico: 2, matematico: 1, movilidad: 2 },
    'Ambiente':         { analitico: 4, tecnologico: 2, practico: 4, social: 2, creativo: 2, terreno: 5, liderazgo: 2, teorico: 4, matematico: 2, movilidad: 3 },
    'Oficios':          { analitico: 2, tecnologico: 2, practico: 5, social: 1, creativo: 2, terreno: 4, liderazgo: 2, teorico: 1, matematico: 2, movilidad: 3 },
    'Ciencias sociales': { analitico: 4, tecnologico: 1, practico: 2, social: 5, creativo: 2, terreno: 1, liderazgo: 3, teorico: 5, matematico: 1, movilidad: 2 }
  };

  const base = basePorArea[area] || basePorArea['Ciencias sociales'];
  Object.keys(perfil).forEach(k => perfil[k] = base[k]);

  const ajustesPorPalabra = [
    { palabras: ['matematica', 'calculo', 'estadistica', 'fisica', 'quimica', 'matematic'], dims: { matematico: +2, analitico: +1, teorico: +1 } },
    { palabras: ['programacion', 'software', 'desarrollo', 'codigo', 'algoritmo', 'base de datos', 'redes', 'ciberseguridad', 'program', 'sistema', 'informatic', 'comput', 'data', 'inteligencia artificial', 'robotica', 'videojuego', 'web', 'cloud', 'analista', 'telecomunicacion'], dims: { tecnologico: +2, analitico: +1, practico: +1 } },
    { palabras: ['diseño', 'creativo', 'artist', 'grafic', 'multimedia', 'animacion', 'ux', 'ui', 'diseno', 'arquitect', 'indumentaria', 'interiorismo'], dims: { creativo: +2, practico: +1 } },
    { palabras: ['gestion', 'direccion', 'liderazgo', 'gerencia', 'jefe', 'coordinador', 'emprendedor', 'administracion', 'negocio', 'empresa'], dims: { liderazgo: +2, social: +1, analitico: +1 } },
    { palabras: ['terreno', 'campo', 'obra', 'construccion', 'agronom', 'mineria', 'petroleo', 'topograf', 'ambiental', 'montaña', 'guia', 'trekking', 'forestal', 'veterin', 'hidric', 'apicultur'], dims: { terreno: +2, practico: +1, movilidad: +1 } },
    { palabras: ['docencia', 'profesor', 'ensenan', 'pedagog', 'educacion', 'capacitacion', 'enseñanza', 'inicial', 'primaria', 'secundaria', 'especial'], dims: { social: +2, liderazgo: +1, practico: +1 } },
    { palabras: ['investigacion', 'cientifico', 'laboratorio', 'analisis', 'tesis', 'metodologia', 'ciencia', 'fisica', 'quimica', 'biolog', 'geolog'], dims: { analitico: +1, teorico: +2, matematico: +1 } },
    { palabras: ['clinica', 'hospital', 'paciente', 'atencion', 'cuidado', 'terapia', 'rehabilitacion', 'enfermer', 'kinesi', 'nutric', 'odont', 'farmac', 'fonoaudi', 'obstetric', 'instrumentacion', 'quirurg', 'anestesia', 'radiolog', 'bioquim', 'medicin', 'salud'], dims: { social: +2, practico: +1, analitico: +1, terreno: -1 } },
    { palabras: ['online', 'virtual', 'distancia', 'remoto', 'asincronico', 'hibrida', 'hibrido'], dims: { movilidad: +1, terreno: -1 } },
    { palabras: ['intensivo', 'corto', 'meses', 'taller', 'certificacion', 'curso', 'diplomatura'], dims: { teorico: -1, practico: +1 } },
    { palabras: ['marketing', 'publicidad', 'ventas', 'comercial', 'comunicacion', 'relaciones publicas'], dims: { creativo: +2, social: +2, liderazgo: +1 } },
    { palabras: ['logistica', 'transporte', 'cadena', 'suministro', 'operaciones'], dims: { analitico: +1, practico: +1 } },
    { palabras: ['finanzas', 'contabilidad', 'contador', 'economia', 'auditoria', 'tributaria', 'impositiva'], dims: { matematico: +2, analitico: +2, teorico: +1 } },
    { palabras: ['derecho', 'leyes', 'abogac', 'procuracion', 'escriban', 'notari', 'juridic', 'legal', 'penal', 'civil', 'laboral'], dims: { analitico: +2, teorico: +2, social: +1 } },
    { palabras: ['psicolog', 'terapia', 'clinica', 'social', 'comportamiento', 'salud mental'], dims: { social: +2, analitico: +1, teorico: +2 } },
    { palabras: ['arquitect', 'urbanism', 'construccion', 'obra', 'estructuras', 'edific'], dims: { creativo: +2, tecnologico: +1, analitico: +1, practico: +1, terreno: +1 } },
    { palabras: ['enolog', 'viticult', 'vino', 'bodega', 'sommelier', 'catador', 'vitivinicola'], dims: { practico: +2, terreno: +1, social: +1, tecnologico: +1 } },
    { palabras: ['gastronom', 'cocina', 'cocinar', 'pasteleria', 'panader', 'chef', 'aliment'], dims: { practico: +2, creativo: +2, social: +1 } },
    { palabras: ['turismo', 'hoteler', 'guia', 'viaje', 'hotel', 'hospitalidad', 'recreacion'], dims: { social: +2, movilidad: +2, terreno: +2, practico: +1 } },
    { palabras: ['idioma', 'ingles', 'portugues', 'frances', 'italiano', 'chino', 'coreano', 'aleman', 'japones', 'traduccion', 'interpretacion', 'lengua', 'filologia', 'letras'], dims: { social: +1, creativo: +1, teorico: +2, movilidad: +2 } },
    { palabras: ['arte', 'musica', 'teatro', 'escenograf', 'danza', 'cine', 'audiovisual', 'ilustracion', 'canto', 'coral', 'organo', 'instrumento', 'ceramica', 'literatura', 'dramatic', 'visual', 'piano', 'guitarra'], dims: { creativo: +2, social: +1, practico: +1 } },
    { palabras: ['ambient', 'sustentab', 'ecologia', 'energias renovables', 'clima', 'residuos', 'agua'], dims: { analitico: +1, terreno: +2, tecnologico: +1, practico: +1 } },
    { palabras: ['mecanic', 'electric', 'carpinter', 'refrigeracion', 'soldadur', 'automotor', 'gasista', 'plomer', 'pintor', 'torner', 'herreria', 'oficio'], dims: { practico: +2, terreno: +1, tecnologico: +1, analitico: +1 } },
    { palabras: ['pilot', 'aeronaut', 'avion', 'vuelo', 'drone', 'drones', 'rpa'], dims: { tecnologico: +2, practico: +2, terreno: +2, movilidad: +3, social: -2 } },
    { palabras: ['buceo', 'subacuatic'], dims: { practico: +3, terreno: +3, movilidad: +2, social: -1 } },
    { palabras: ['apicultur', 'apicola'], dims: { practico: +2, terreno: +3, social: -2 } },
    { palabras: ['seguridad', 'penitenciaria', 'publica', 'ciudadana', 'policia', 'bomber', 'emergenc', 'prevencion', 'riesgo', 'higiene', 'proteccion'], dims: { liderazgo: +1, social: +1, practico: +1, analitico: +1, terreno: +1 } },
    { palabras: ['deporte', 'educacion fisica', 'kinesi', 'fisioter', 'entrenam', 'preparacion fisica', 'actividad fisica'], dims: { practico: +2, social: +1, terreno: +1, liderazgo: +1 } },
    { palabras: ['periodismo', 'comunicacion', 'locucion', 'radio', 'television', 'medios', 'prensa', 'redaccion'], dims: { social: +2, creativo: +2, tecnologico: +1 } }
  ];

  ajustesPorPalabra.forEach(({ palabras, dims }) => {
    if (palabras.some(p => nombre.includes(normalizar(p)) || categoria.includes(normalizar(p)))) {
      Object.entries(dims).forEach(([dim, val]) => {
        if (perfil[dim] !== undefined) {
          perfil[dim] = Math.max(0, Math.min(5, perfil[dim] + val));
        }
      });
    }
  });

  // OJO con los nombres: getFormacion() devuelve PLURALES ('cursos',
  // 'tecnicaturas', 'profesorados') y ese es el contrato que consumen
  // orientador.js (generarRanking) y las tarjetas del frontend. Acá antes se
  // comparaba contra los singulares, así que estas ramas nunca se ejecutaban y
  // tecnicaturas y cursos quedaban sin su ajuste práctico/teórico.
  if (formacion === 'cursos') {
    perfil.teorico = Math.max(0, perfil.teorico - 1);
    perfil.practico = Math.min(5, perfil.practico + 1);
  } else if (formacion === 'grado' || formacion === 'profesorados') {
    // Los profesorados van con 'grado' porque son carreras largas y así los
    // agrupa también orientador.js (grupos.grados incluye 'profesorados').
    perfil.teorico = Math.min(5, perfil.teorico + 1);
    perfil.analitico = Math.min(5, perfil.analitico + 1);
  } else if (formacion === 'tecnicaturas') {
    perfil.practico = Math.min(5, perfil.practico + 1);
    perfil.teorico = Math.max(0, perfil.teorico - 1);
  }

  return perfil;
}

function main() {
  console.log('📖 Leyendo data.json...');
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);

  const carrerasMap = new Map();

  (data.instituciones || []).forEach(inst => {
    (inst.carreras || []).forEach(c => {
      const key = normalizar(c.nombre_carrera);
      if (!carrerasMap.has(key)) {
        carrerasMap.set(key, {
          nombre: c.nombre_carrera,
          categoria: c.categoria,
          area: getArea(c.nombre_carrera),
          formacion: getFormacion(c.categoria, c.nombre_carrera),
          instituciones: []
        });
      }
      const entry = carrerasMap.get(key);
      if (!entry.instituciones.includes(inst.nombre)) {
        entry.instituciones.push(inst.nombre);
      }
    });
  });

  // Los catálogos aparte viven como claves propias en la raíz de data.json
  // (mismo nivel que "instituciones"), y cada uno es un ARRAY de instituciones
  // con su lista de "carreras". Antes esto leía data.catalogosAparte, una clave
  // que no existe, y el bloque entero era código muerto: ni un solo oficio,
  // formación alternativa ni opción de secundario llegaba al Copiloto.
  // La formación se fuerza a 'cursos' (no se pasa por getFormacion()) porque
  // esa clasificación es de la lista formal y acá metería un curso de drones
  // dentro de los profesorados.
  CATALOGOS_APARTE.forEach(clave => {
    (data[clave] || []).forEach(institucion => {
      (institucion.carreras || []).forEach(c => {
        const nombre = c.nombre_carrera || c.nombre;
        if (!nombre) return;
        const key = normalizar(nombre);
        if (!carrerasMap.has(key)) {
          carrerasMap.set(key, {
            nombre,
            categoria: c.categoria,
            area: getArea(nombre),
            formacion: 'cursos',
            instituciones: []
          });
        }
        const entry = carrerasMap.get(key);
        const instName = institucion.nombre || 'Desconocido';
        if (!entry.instituciones.includes(instName)) {
          entry.instituciones.push(instName);
        }
      });
    });
  });

  console.log(`🔍 Carreras únicas encontradas: ${carrerasMap.size}`);

  const resultado = [];
  let procesadas = 0;

  carrerasMap.forEach((carrera, key) => {
    const perfil = calcularPerfilCarrera(carrera);
    resultado.push({
      clave: key,
      nombre: carrera.nombre,
      categoria: carrera.categoria,
      area: carrera.area,
      formacion: carrera.formacion,
      instituciones: carrera.instituciones,
      perfil
    });
    procesadas++;
    if (procesadas % 100 === 0) console.log(`  Procesadas: ${procesadas}`);
  });

  resultado.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ carreras: resultado }, null, 2));
  console.log(`✅ Generado: ${OUTPUT_PATH} (${resultado.length} carreras)`);

  const stats = {};
  DIMENSIONES.forEach(d => { stats[d] = { min: 5, max: 0, sum: 0 }; });
  resultado.forEach(c => {
    DIMENSIONES.forEach(d => {
      const v = c.perfil[d];
      stats[d].min = Math.min(stats[d].min, v);
      stats[d].max = Math.max(stats[d].max, v);
      stats[d].sum += v;
    });
  });
  console.log('\n📊 Estadísticas de dimensiones:');
  DIMENSIONES.forEach(d => {
    console.log(`  ${d}: min=${stats[d].min}, max=${stats[d].max}, avg=${(stats[d].sum/resultado.length).toFixed(2)}`);
  });
}

main();