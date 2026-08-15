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
  if (tienePalabra(n, 'program', 'sistema', 'informat', 'comput', 'software', 'datos', 'data', 'inteligencia artificial', 'ciberseguridad', 'robotica', 'videojuego', 'web', 'cloud')) return 'Tecnología';
  if (tienePalabra(n, 'medicin', 'enfermer', 'kinesi', 'nutric', 'odont', 'farmac', 'fonoaudi', 'obstetric', 'terapia', 'radiolog', 'bioquim', 'salud', 'anestesia', 'instrumentacion quirurg')) return 'Salud';
  if (tienePalabra(n, 'administracion', 'contador', 'contad', 'marketing', 'comercio', 'negocio', 'finanza', 'econom', 'recursos humanos', 'logistica', 'secretariado', 'gestion empresarial')) return 'Negocios';
  if (tienePalabra(n, 'diseno', 'arquitect', 'multimedia', 'interiorismo', 'indumentaria', 'animacion')) return 'Diseño';
  if (tienePalabra(n, 'profesorado', 'educacion', 'pedagog', 'didact')) return 'Educación';
  if (tienePalabra(n, 'turismo', 'hoteler', 'guia de turismo')) return 'Turismo';
  if (tienePalabra(n, 'gastronom', 'cocina', 'pasteler', 'panader')) return 'Gastronomía';
  if (tienePalabra(n, 'ingles', 'idioma', 'portugues', 'frances', 'traduccion', 'interpretacion', 'italiano', 'chino', 'coreano', 'aleman', 'japones')) return 'Idiomas';
  if (tienePalabra(n, 'arte', 'musica', 'teatro', 'escenograf', 'danza', 'cine', 'fotograf', 'audiovisual', 'ilustracion', 'canto', 'coral', 'organo', 'instrumento', 'ceramica artistica')) return 'Arte';
  if (tienePalabra(n, 'diagnostico por imagenes', 'quirofano', 'podolog')) return 'Salud';
  if (tienePalabra(n, 'ambient', 'agronom', 'biolog', 'geolog', 'forestal', 'veterin', 'quimic', 'hidric')) return 'Ambiente';
  if (tienePalabra(n, 'mecanic', 'electric', 'carpinter', 'refrigeracion', 'soldadur', 'construccion', 'automotor', 'gasista', 'plomer')) return 'Oficios';
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
    'Salud':            { analitico: 3, tecnologico: 2, practico: 5, social: 5, creativo: 1, terreno: 1, liderazgo: 2, teorico: 3, matematico: 2, movilidad: 2 },
    'Negocios':         { analitico: 3, tecnologico: 2, practico: 3, social: 4, creativo: 2, terreno: 1, liderazgo: 4, teorico: 3, matematico: 3, movilidad: 3 },
    'Diseño':           { analitico: 2, tecnologico: 3, practico: 4, social: 2, creativo: 5, terreno: 1, liderazgo: 2, teorico: 2, matematico: 1, movilidad: 2 },
    'Educación':        { analitico: 2, tecnologico: 1, practico: 3, social: 5, creativo: 3, terreno: 1, liderazgo: 3, teorico: 3, matematico: 1, movilidad: 2 },
    'Turismo':          { analitico: 2, tecnologico: 1, practico: 3, social: 4, creativo: 2, terreno: 3, liderazgo: 2, teorico: 2, matematico: 1, movilidad: 4 },
    'Gastronomía':      { analitico: 1, tecnologico: 1, practico: 5, social: 3, creativo: 4, terreno: 1, liderazgo: 2, teorico: 1, matematico: 1, movilidad: 2 },
    'Idiomas':          { analitico: 2, tecnologico: 1, practico: 2, social: 4, creativo: 3, terreno: 1, liderazgo: 1, teorico: 3, matematico: 1, movilidad: 3 },
    'Arte':             { analitico: 1, tecnologico: 1, practico: 3, social: 3, creativo: 5, terreno: 1, liderazgo: 2, teorico: 2, matematico: 1, movilidad: 2 },
    'Ambiente':         { analitico: 3, tecnologico: 2, practico: 4, social: 2, creativo: 2, terreno: 4, liderazgo: 2, teorico: 3, matematico: 2, movilidad: 3 },
    'Oficios':          { analitico: 2, tecnologico: 2, practico: 5, social: 1, creativo: 2, terreno: 3, liderazgo: 2, teorico: 1, matematico: 2, movilidad: 3 },
    'Ciencias sociales': { analitico: 3, tecnologico: 1, practico: 2, social: 4, creativo: 2, terreno: 1, liderazgo: 2, teorico: 4, matematico: 1, movilidad: 2 }
  };

  const base = basePorArea[area] || basePorArea['Ciencias sociales'];
  Object.keys(perfil).forEach(k => perfil[k] = base[k]);

  const ajustesPorPalabra = [
    { palabras: ['matematica', 'calculo', 'estadistica', 'fisica', 'quimica', 'matematic'], dims: { matematico: +1, analitico: +1, teorico: +1 } },
    { palabras: ['programacion', 'software', 'desarrollo', 'codigo', 'algoritmo', 'base de datos', 'redes', 'ciberseguridad', 'program', 'sistema', 'informatic', 'comput', 'data', 'inteligencia artificial', 'robotica', 'videojuego', 'web', 'cloud', 'analista'], dims: { tecnologico: +2, analitico: +1, practico: +1 } },
    { palabras: ['diseño', 'creativo', 'artist', 'grafic', 'multimedia', 'animacion', 'ux', 'ui', 'diseno', 'arquitect', 'indumentaria', 'interiorismo'], dims: { creativo: +2, practico: +1 } },
    { palabras: ['gestion', 'direccion', 'liderazgo', 'gerencia', 'jefe', 'coordinador', 'emprendedor', 'administracion', 'negocio', 'empresa'], dims: { liderazgo: +1, social: +1, analitico: +1 } },
    { palabras: ['terreno', 'campo', 'obra', 'construccion', 'agronom', 'mineria', 'petroleo', 'topograf', 'ambiental', 'montaña', 'guia', 'trekking', 'forestal', 'veterin', 'hidric'], dims: { terreno: +2, practico: +1, movilidad: +1 } },
    { palabras: ['docencia', 'profesor', 'ensenan', 'pedagog', 'educacion', 'capacitacion', 'enseñanza', 'inicial', 'primaria', 'secundaria', 'especial'], dims: { social: +2, liderazgo: +1, practico: +1 } },
    { palabras: ['investigacion', 'cientifico', 'laboratorio', 'analisis', 'tesis', 'metodologia', 'ciencia', 'fisica', 'quimica', 'biolog', 'geolog'], dims: { analitico: +1, teorico: +1, matematico: +1 } },
    { palabras: ['clinica', 'hospital', 'paciente', 'atencion', 'cuidado', 'terapia', 'rehabilitacion', 'enfermer', 'kinesi', 'nutric', 'odont', 'farmac', 'fonoaudi', 'obstetric', 'instrumentacion', 'quirurg', 'anestesia', 'radiolog', 'bioquim', 'medicin'], dims: { social: +1, practico: +1, analitico: +1, terreno: -1 } },
    { palabras: ['online', 'virtual', 'distancia', 'remoto', 'asincronico', 'hibrida', 'hibrido'], dims: { movilidad: +1, terreno: -1 } },
    { palabras: ['intensivo', 'corto', 'meses', 'taller', 'certificacion', 'curso', 'diplomatura'], dims: { teorico: -1, practico: +1 } },
    { palabras: ['marketing', 'publicidad', 'ventas', 'comercial', 'comunicacion', 'relaciones publicas'], dims: { creativo: +1, social: +1, liderazgo: +1 } },
    { palabras: ['logistica', 'transporte', 'cadena', 'suministro', 'operaciones'], dims: { analitico: +1, practico: +1, organizacion: +1 } },
    { palabras: ['finanzas', 'contabilidad', 'contador', 'economia', 'auditoria', 'tributaria', 'impositiva'], dims: { matematico: +2, analitico: +1, teorico: +1 } },
    { palabras: ['derecho', 'leyes', 'abogac', 'procuracion', 'escriban', 'notari', 'juridic', 'legal', 'penal', 'civil', 'laboral'], dims: { analitico: +1, teorico: +2, social: +1 } },
    { palabras: ['psicolog', 'terapia', 'clinica', 'social', 'comportamiento', 'salud mental'], dims: { social: +2, analitico: +1, teorico: +1 } },
    { palabras: ['arquitect', 'urbanism', 'construccion', 'obra', 'estructuras', 'edific'], dims: { creativo: +1, tecnologico: +1, analitico: +1, practico: +1, terreno: +1 } },
    { palabras: ['enolog', 'viticult', 'vino', 'bodega', 'sommelier', 'catador'], dims: { practico: +1, terreno: +1, social: +1, tecnologico: +1 } },
    { palabras: ['gastronom', 'cocina', 'cocinar', 'pasteleria', 'panader', 'chef', 'aliment'], dims: { practico: +2, creativo: +1, social: +1 } },
    { palabras: ['turismo', 'hoteler', 'guia', 'viaje', 'hotel', 'hospitalidad', 'recreacion'], dims: { social: +2, movilidad: +2, terreno: +1, practico: +1 } },
    { palabras: ['idioma', 'ingles', 'portugues', 'frances', 'italiano', 'chino', 'coreano', 'aleman', 'japones', 'traduccion', 'interpretacion', 'lengua', 'filologia', 'letras'], dims: { social: +1, creativo: +1, teorico: +1, movilidad: +1 } },
    { palabras: ['arte', 'musica', 'teatro', 'escenograf', 'danza', 'cine', 'fotograf', 'audiovisual', 'ilustracion', 'canto', 'coral', 'organo', 'instrumento', 'ceramica', 'literatura', 'dramatic', 'visual'], dims: { creativo: +2, social: +1, practico: +1 } },
    { palabras: ['ambient', 'sustentab', 'ecologia', 'energias renovables', 'clima', 'residuos', 'agua'], dims: { analitico: +1, terreno: +2, tecnologico: +1, practico: +1 } },
    { palabras: ['mecanic', 'electric', 'carpinter', 'refrigeracion', 'soldadur', 'automotor', 'gasista', 'plomer', 'pintor', 'torner', 'herreria', 'oficio'], dims: { practico: +2, terreno: +1, tecnologico: +1, analitico: +1 } },
    { palabras: ['seguridad', 'penitenciaria', 'publica', 'ciudadana', 'policia', 'bomber', 'emergenc', 'prevencion', 'riesgo', 'higiene', 'proteccion'], dims: { liderazgo: +1, social: +1, practico: +1, analitico: +1, terreno: +1 } },
    { palabras: ['deporte', 'educacion fisica', 'kinesi', 'fisioter', 'entrenam', 'preparacion fisica', 'actividad fisica'], dims: { practico: +2, social: +1, terreno: +1, liderazgo: +1 } },
    { palabras: ['periodismo', 'comunicacion', 'locucion', 'radio', 'television', 'audiovisual', 'medios', 'prensa', 'redaccion'], dims: { social: +2, creativo: +2, comunicacion: +1, tecnologico: +1 } }
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

  if (formacion === 'curso') {
    perfil.teorico = Math.max(0, perfil.teorico - 1);
    perfil.practico = Math.min(5, perfil.practico + 1);
  } else if (formacion === 'grado') {
    perfil.teorico = Math.min(5, perfil.teorico + 1);
    perfil.analitico = Math.min(5, perfil.analitico + 1);
  } else if (formacion === 'tecnicatura') {
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

  Object.values(data.catalogosAparte || {}).forEach(catalogo => {
    (catalogo.cursos || []).forEach(c => {
      const key = normalizar(c.nombre_carrera || c.nombre);
      if (!carrerasMap.has(key)) {
        carrerasMap.set(key, {
          nombre: c.nombre_carrera || c.nombre,
          categoria: c.categoria,
          area: getArea(c.nombre_carrera || c.nombre),
          formacion: 'cursos',
          instituciones: []
        });
      }
      const entry = carrerasMap.get(key);
      const instName = catalogo.nombre || 'Desconocido';
      if (!entry.instituciones.includes(instName)) {
        entry.instituciones.push(instName);
      }
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