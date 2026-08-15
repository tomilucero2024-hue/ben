const fs = require('fs');
const O = require('./frontend/js/orientador.js');

(async () => {
  // Simulate loading profiles like the browser does
  const data = JSON.parse(fs.readFileSync('data/carreras-perfiles.json', 'utf8'));

  // Mock fetch since Node doesn't have it
  global.fetch = async () => ({ ok: true, json: async () => data });
  const perfiles = await O.cargarPerfilesCarreras();
  console.log('Perfiles cargados:', perfiles.length);

  // Simulate a user answering all 5 questions (picking option index 0 each time)
  const respuestas = O.PREGUNTAS_TEST.map(p => {
    const opcion = p.opciones[0];
    return { preguntaId: p.id, opcionTexto: opcion.texto, dimensionScores: opcion.dimensionScores };
  });

  const perfil = O.generarPerfilUsuarioDesdeRespuestas(respuestas);
  console.log('Perfil usuario:', JSON.stringify(perfil));

  const ranking = O.generarRanking(perfil, { limite: 12 });
  console.log('Ranking keys:', Object.keys(ranking));
  console.log('grados:', ranking.grados.length, 'tecnicaturas:', ranking.tecnicaturas.length, 'cursos:', ranking.cursos.length, 'todas:', ranking.todas.length);

  const mejor = ranking.todas[0];
  console.log('Mejor match:', mejor.nombre, mejor.compatibilidad + '%', '| formacion:', mejor.formacion);
  console.log('Coincidencias:', mejor.coincidencias.map(c => c.label).join(', '));
  console.log('Alertas:', mejor.alertas.length, '| Instituciones:', mejor.instituciones.length);

  // Verify every item in todas has required fields
  const faltantes = ranking.todas.filter(r => !r.nombre || typeof r.compatibilidad !== 'number');
  console.log('Items incompletos:', faltantes.length);
  console.log('OK');
})();
