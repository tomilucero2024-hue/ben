// ============================================================================
// Test del Test Vocacional Completo: datos, perfiles y motor de matching.
// ============================================================================
const fs = require('fs');
const path = require('path');
const Vocacional = require('./js/vocacional/motor.js');

let aserciones = 0;
let fallos = 0;
function ok(cond, msg) {
    if (cond) { aserciones++; console.log('  ✓ ' + msg); }
    else { fallos++; console.error('  ✗ ' + msg); }
}
function seccion(titulo) { console.log('\n' + titulo); }

const DIR = path.join(__dirname, 'data', 'vocacional');
const leer = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

// ---------------------------------------------------------------------------
seccion('1. Banco de preguntas');
const banco = leer('preguntas.json');
const config = leer('config.json');
const areasBase = leer('areas-base.json').areas;
const perfilesFile = leer('perfiles-carreras.json');

ok(banco.preguntas.length === 65, `hay 65 preguntas (${banco.preguntas.length})`);
ok(banco.secciones.length === 4, 'hay 4 secciones (intereses, aptitudes, valores, contexto)');

const ids = banco.preguntas.map(p => p.id);
ok(new Set(ids).size === ids.length, 'los ids de pregunta no se repiten');

const porSeccion = {};
banco.preguntas.forEach(p => { porSeccion[p.seccion] = (porSeccion[p.seccion] || 0) + 1; });
ok(porSeccion.intereses === 36, `36 preguntas de intereses (${porSeccion.intereses})`);
ok(porSeccion.aptitudes === 15, `15 de aptitudes (${porSeccion.aptitudes})`);
ok(porSeccion.valores === 12, `12 de valores (${porSeccion.valores})`);
ok(porSeccion.contexto === 2, `2 de contexto/presión (${porSeccion.contexto})`);

// Cada dimensión de RIASEC tiene 6 preguntas y cada aptitud/valor al menos 1.
const cuentaR = {};
banco.preguntas.forEach(p => Object.keys(p.dims).forEach(d => { cuentaR[d] = (cuentaR[d] || 0) + 1; }));
['R', 'I', 'A', 'S', 'E', 'C'].forEach(l => {
    ok(cuentaR[`riasec.${l}`] >= 6, `RIASEC ${l} aparece en 6+ preguntas (${cuentaR[`riasec.${l}`]})`);
});
const bloques = ['logico_matematica', 'verbal', 'espacial', 'interpersonal', 'corporal'];
bloques.forEach(d => ok((cuentaR[`apt.${d}`] || 0) >= 3, `aptitud ${d} con 3+ preguntas`));

// Ninguna pregunta sin peso y ningún peso inválido.
ok(banco.preguntas.every(p => Object.keys(p.dims).length > 0), 'todas las preguntas tienen al menos un peso');
ok(banco.preguntas.every(p => Object.values(p.dims).every(w => w > 0 && w <= 1)), 'los pesos están entre 0 y 1');
ok(banco.preguntas.every(p => Object.keys(p.dims).every(d => /^(riasec|apt|val|ctx)\./.test(d))), 'las dimensiones usan el prefijo correcto');

// ---------------------------------------------------------------------------
seccion('2. Áreas base');
const AREAS = ['Tecnología', 'Ingeniería', 'Salud', 'Negocios', 'Diseño', 'Educación', 'Ciencias sociales', 'Ambiente', 'Turismo', 'Gastronomía', 'Oficios', 'Arte', 'Idiomas'];
AREAS.forEach(a => ok(Boolean(areasBase[a]), `área base definida: ${a}`));
const dimsValidas = new Set([
    ...['R', 'I', 'A', 'S', 'E', 'C'].map(d => `riasec.${d}`),
    ...bloques.map(d => `apt.${d}`),
    ...['estabilidad', 'variedad', 'equipo', 'impacto', 'ingresos', 'movilidad'].map(d => `val.${d}`)
]);
const areasOk = Object.values(areasBase).every(base =>
    ['riasec', 'apt', 'val'].every(b => Object.keys(base[b]).every(d => dimsValidas.has(`${b}.${d}`))) &&
    ['riasec', 'apt', 'val'].every(b => Object.values(base[b]).every(v => v >= 0 && v <= 10))
);
ok(areasOk, 'todos los perfiles de área tienen dimensiones válidas y valores 0-10');

// ---------------------------------------------------------------------------
seccion('3. Perfiles de carrera generados');
ok(perfilesFile.carreras.length === 651, `perfiles para las 651 carreras (${perfilesFile.carreras.length})`);
const perfilesOk = perfilesFile.carreras.every(c =>
    c.clave && c.nombre && c.area && c.formacion && Array.isArray(c.instituciones) &&
    ['riasec', 'apt', 'val'].every(b => Object.values(c.perfil[b] || {}).every(v => v >= 0 && v <= 10))
);
ok(perfilesOk, 'todas las carreras tienen clave, área, formación y perfil 0-10');

const porClave = new Map(perfilesFile.carreras.map(c => [c.clave, c]));
const enfermeria = porClave.get('tecnicatura superior en enfermeria profesional') || porClave.get('enfermeria profesional');
ok(Boolean(enfermeria), 'existe el perfil de Enfermería');
ok(enfermeria.perfil.riasec.S >= 9, `Enfermería tiene S alto (${enfermeria.perfil.riasec.S})`);
ok(enfermeria.origen.ajustes.includes('enfermer'), 'Enfermería recibió el ajuste de palabra clave "enfermer"');

const ingCivil = porClave.get('ingenieria civil');
ok(Boolean(ingCivil), 'existe el perfil de Ingeniería Civil');
ok(ingCivil.perfil.apt.logico_matematica >= 8, `Ingeniería Civil tiene lógico-matemática alta (${ingCivil.perfil.apt.logico_matematica})`);
ok(!ingCivil.origen.ajustes.includes('derecho'), 'Ingeniería Civil NO recibió el ajuste de derecho (el bug de "civil")');

const cerveza = porClave.get('curso de cerveza artesanal');
ok(cerveza.area === 'Gastronomía', `Cerveza Artesanal quedó en Gastronomía (${cerveza.area})`);

// ---------------------------------------------------------------------------
seccion('4. Cálculo del perfil del estudiante');
Vocacional.setDatos({
    config,
    preguntas: banco.preguntas,
    secciones: banco.secciones,
    perfiles: perfilesFile.carreras
});

const todoCinco = {};
banco.preguntas.forEach(p => { todoCinco[p.id] = 5; });
const perfilMax = Vocacional.calcularPerfil(todoCinco);
ok(Object.values(perfilMax.riasec).every(v => v === 10), 'responder todo 5 da RIASEC en 10');
ok(Object.values(perfilMax.apt).every(v => v === 10), 'responder todo 5 da aptitudes en 10');
ok(perfilMax.codigo.length === 3, 'el código RIASEC tiene 3 letras');

const todoUno = {};
banco.preguntas.forEach(p => { todoUno[p.id] = 1; });
const perfilMin = Vocacional.calcularPerfil(todoUno);
ok(Object.values(perfilMin.riasec).every(v => v === 0), 'responder todo 1 da RIASEC en 0');

// Estudiante ficticia "Camila": social, verbal e interpersonal altos; poca
// matemática; prioriza impacto y estabilidad; no quiere mudarse.
function respuestaPorDims(p) {
    const dominante = Object.entries(p.dims).sort((a, b) => b[1] - a[1])[0][0];
    const mapa = {
        'riasec.S': 5, 'riasec.I': 4, 'riasec.R': 3, 'riasec.E': 3, 'riasec.C': 2, 'riasec.A': 2,
        'apt.interpersonal': 5, 'apt.verbal': 5, 'apt.espacial': 3, 'apt.corporal': 2, 'apt.logico_matematica': 1,
        'val.impacto': 5, 'val.estabilidad': 5, 'val.equipo': 4, 'val.variedad': 3, 'val.ingresos': 3, 'val.movilidad': 1,
        'ctx.presion': 4
    };
    return mapa[dominante] || 3;
}
const respuestasCamila = {};
banco.preguntas.forEach(p => { respuestasCamila[p.id] = respuestaPorDims(p); });
const camila = Vocacional.calcularPerfil(respuestasCamila);
ok(camila.riasec.S >= 6 && camila.riasec.I >= 6, `Camila tiene S e I altos (S ${camila.riasec.S}, I ${camila.riasec.I})`);
ok(camila.apt.logico_matematica <= 4, `Camila tiene poca lógico-matemática (${camila.apt.logico_matematica})`);

// ---------------------------------------------------------------------------
seccion('5. Afinidad y ranking');
const afinidadIgual = Vocacional.calcularAfinidad(perfilMax, {
    riasec: perfilMax.riasec, apt: perfilMax.apt, val: perfilMax.val
});
ok(afinidadIgual.porcentaje === config.afinidad.techo_porcentaje, `perfil idéntico da el techo (${afinidadIgual.porcentaje}%)`);

const ranking = Vocacional.generarRanking(camila, perfilesFile.carreras, config, { limite: perfilesFile.carreras.length });
ok(Array.isArray(ranking.grados) && Array.isArray(ranking.tecnicaturas) && Array.isArray(ranking.cursos), 'el ranking trae los 3 grupos que espera la grilla');
ok(ranking.porClave instanceof Map, 'el ranking expone porClave');
ok(ranking.total === perfilesFile.carreras.length, `total = todas las carreras (${ranking.total})`);
ok(ranking.todas.every(r => r.compatibilidad >= 0 && r.compatibilidad <= 100), 'todas las afinidades están entre 0 y 100');
ok(ranking.todas.every(r => Array.isArray(r.coincidencias) && r.coincidencias.every(c => c.label && c.desc)), 'las coincidencias traen label y desc (contrato de la tarjeta)');
ok(ranking.todas.every(r => Array.isArray(r.alertas) && r.alertas.every(a => a.mensaje)), 'las alertas traen mensaje (contrato de la tarjeta)');

const posEnfermeria = ranking.todas.findIndex(r => r.clave === 'tecnicatura superior en enfermeria profesional');
const posPsicologia = ranking.todas.findIndex(r => r.clave === 'licenciatura en psicologia');
const posIngenieria = ranking.todas.findIndex(r => r.clave === 'ingenieria civil');
ok(posEnfermeria >= 0 && posPsicologia >= 0 && posIngenieria >= 0, 'las 3 carreras de prueba tienen perfil');
ok(posEnfermeria < posIngenieria, `Enfermería (puesto ${posEnfermeria + 1}) queda arriba de Ingeniería Civil (puesto ${posIngenieria + 1})`);
ok(posPsicologia < posIngenieria, `Psicología (puesto ${posPsicologia + 1}) queda arriba de Ingeniería Civil (puesto ${posIngenieria + 1})`);
ok(posEnfermeria <= 250 && posPsicologia <= 250, 'Enfermería y Psicología quedan entre las primeras 250 de 651');
ok(ranking.todas[0].compatibilidad > ranking.todas[ranking.todas.length - 1].compatibilidad, 'el ranking está ordenado de mayor a menor');

// Un perfil técnico no debe recomendar carreras artísticas y viceversa.
const perfilTecnico = Vocacional.calcularPerfil(Object.fromEntries(banco.preguntas.map(p => {
    const d = Object.entries(p.dims).sort((a, b) => b[1] - a[1])[0][0];
    const mapa = {
        'riasec.R': 5, 'riasec.I': 5, 'riasec.C': 4, 'riasec.E': 3, 'riasec.A': 2, 'riasec.S': 2,
        'apt.logico_matematica': 5, 'apt.espacial': 5, 'apt.verbal': 2, 'apt.interpersonal': 2, 'apt.corporal': 3,
        'val.ingresos': 5, 'val.estabilidad': 4, 'val.variedad': 4, 'val.impacto': 3, 'val.equipo': 3, 'val.movilidad': 3,
        'ctx.presion': 2
    };
    return [p.id, mapa[d] || 3];
})));
const rankTecnico = Vocacional.generarRanking(perfilTecnico, perfilesFile.carreras, config, { limite: perfilesFile.carreras.length });
const posIngTec = rankTecnico.todas.findIndex(r => r.clave === 'ingenieria civil');
const posEnfTec = rankTecnico.todas.findIndex(r => r.clave === 'tecnicatura superior en enfermeria profesional');
ok(posIngTec < posEnfTec, `para un perfil técnico, Ingeniería (${posIngTec + 1}) queda arriba de Enfermería (${posEnfTec + 1})`);
ok(rankTecnico.todas[0].area === 'Ingeniería' || rankTecnico.todas[0].area === 'Tecnología', `el top de un perfil técnico es Ingeniería/Tecnología (${rankTecnico.todas[0].area})`);

// ---------------------------------------------------------------------------
seccion('6. Resumen, alertas y explicaciones');
const resumen = Vocacional.resumenPerfil(camila);
ok(typeof resumen === 'string' && resumen.includes('perfil'), 'el resumen es texto humano (' + resumen.slice(0, 70) + '…)');
ok(!/^[RIASEC]{3}$/.test(resumen.trim()), 'el resumen no muestra el código pelado');

const alertas = Vocacional.alertasTension(camila);
ok(Array.isArray(alertas) && alertas.length > 0, `Camila recibe ${alertas.length} alerta(s) de tensión`);
ok(alertas.some(a => /mudarte|movilidad|prácticas/.test(a)), 'detecta la tensión interés social + poca movilidad');

const conPresion = Vocacional.calcularPerfil({ ...respuestasCamila, ctx_01: 5, ctx_02: 5 });
ok(Vocacional.alertasTension(conPresion).some(a => /aprueben/.test(a)), 'detecta la presión externa alta');

const explicacion = Vocacional.explicarMatch(camila, enfermeria.perfil, Vocacional.calcularCoincidencias(camila, enfermeria.perfil));
ok(typeof explicacion === 'string' && explicacion.length > 10, 'la explicación del match es una frase (' + explicacion.slice(0, 60) + '…)');
ok(Vocacional.etiquetasCodigo(camila.codigo).includes('·'), 'el código se muestra con etiquetas legibles');

// ---------------------------------------------------------------------------
seccion('7. Soporte de la Fase B (perfiles por uso)');
const uso = leer('perfiles-uso.json');
ok(uso && typeof uso.carreras === 'object', 'existe perfiles-uso.json con estructura de carreras');
ok(fs.existsSync(path.join(__dirname, 'generar-perfiles-uso.js')), 'existe el job generar-perfiles-uso.js');

console.log(`\n${fallos === 0 ? '✅' : '❌'} test_vocacional.js: ${aserciones} aserciones, ${fallos} fallo(s)`);
process.exit(fallos ? 1 : 0);
