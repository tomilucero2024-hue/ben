// Test suite for BEN core modules: util, filtros, estado, autocompletado, orientador.
const fs = require('fs');
const path = require('path');
const O = require('./js/orientador.js');

(async () => {
  console.log('🧪 Iniciando test-flow...');
  let asserts = 0;
  function assert(cond, msg) {
    if (!cond) {
      console.error(`❌ Falló la aserción: ${msg}`);
      process.exit(1);
    }
    asserts++;
  }

  // 1. Test util.js
  console.log('1. Probando js/util.js (clasificadores)...');
  const util = await import('./js/util.js');
  
  assert(util.getArea('Licenciatura en Psicología') === 'Salud', 'Psicología debe ser Salud');
  assert(util.getArea('Bioingeniería') === 'Ingeniería', 'Bioingeniería debe ser Ingeniería');
  assert(util.getArea('Tecnicatura en Programación') === 'Tecnología', 'Programación debe ser Tecnología');
  assert(util.getArea('Cursos de Electricidad') === 'Oficios', 'Electricidad debe ser Oficios');
  assert(util.getArea('Licenciatura en Administración') === 'Negocios', 'Administración debe ser Negocios');
  
  assert(util.getFormacion({ categoria: 'Grado', nombre_carrera: 'Medicina' }) === 'grado', 'Medicina debe ser grado');
  assert(util.getFormacion({ categoria: 'Tecnicatura', nombre_carrera: 'Desarrollo Web' }) === 'tecnicaturas', 'Desarrollo Web debe ser tecnicatura');
  assert(util.getFormacion({ categoria: 'Curso', nombre_carrera: 'Taller de Drones' }) === 'cursos', 'Taller de Drones debe ser curso');
  assert(util.getFormacion({ categoria: 'Profesorado', nombre_carrera: 'Profesorado de Historia' }) === 'profesorados', 'Profesorado de Historia debe ser profesorado');

  assert(Math.abs(util.obtenerDuracionEnAnios('10 meses') - 10 / 12) < 1e-9, '10 meses debe interpretarse como 10/12 años');
  assert(util.formatearDuracionAnios(10 / 12) === '10 meses', '0.8333 años no debe mostrarse como decimal');
  assert(util.formatearDuracionAnios(4.5) === '4 años y medio', '4.5 años debe ser "4 años y medio"');
  assert(util.duracionCorta('10 meses') === '10 meses', 'duracionCorta de 10 meses debe volver a meses');

  // 2. Test estado.js
  console.log('2. Probando js/estado.js...');
  const estadoModule = await import('./js/estado.js');
  assert(estadoModule.estado && typeof estadoModule.estado.orden === 'string', 'estado debe exportar objeto estado');
  assert(estadoModule.LIMITE_PAGINA === 24, 'LIMITE_PAGINA debe ser 24');

  // 3. Test orientador.js
  console.log('3. Probando js/orientador.js (compatibilidad vocacional)...');
  const dataPerfiles = JSON.parse(fs.readFileSync('data/carreras-perfiles.json', 'utf8'));
  global.fetch = async () => ({ ok: true, json: async () => dataPerfiles });
  
  const perfiles = await O.cargarPerfilesCarreras();
  assert(perfiles.length > 500, `Debe haber más de 500 perfiles cargados (hay ${perfiles.length})`);
  
  const respuestas = O.PREGUNTAS_TEST.map(p => ({
    preguntaId: p.id,
    opcionTexto: p.opciones[0].texto,
    dimensionScores: p.opciones[0].dimensionScores
  }));
  const perfil = O.generarPerfilUsuarioDesdeRespuestas(respuestas);
  assert(typeof perfil === 'object' && perfil !== null, 'Perfil de usuario generado correctamente');
  
  const ranking = O.generarRanking(perfil, { limite: 12 });
  assert(ranking.todas && ranking.todas.length > 0, 'El ranking debe contener recomendaciones');
  assert(typeof ranking.todas[0].compatibilidad === 'number', 'La compatibilidad debe ser numérica');

  // 4. Test autocompletado.js
  console.log('4. Probando js/autocompletado.js (búsqueda de sugerencias)...');
  const autocompletado = await import('./js/autocompletado.js');
  assert(typeof autocompletado.buscarSugerencias === 'function', 'buscarSugerencias debe ser una función');

  console.log(`✅ ¡Todos los tests pasaron exitosamente! (${asserts} aserciones verificadas)`);
})().catch(err => {
  console.error('❌ Error no controlado en test-flow:', err);
  process.exit(1);
});
