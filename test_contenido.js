// ============================================================================
// CONTENIDO DE CARRERAS — 11.ª suite
// ============================================================================
// Valida data/contenido-carreras.json y data/sectores.json, el contenido
// generado por IA (descripción + sectores) que se muestra en las fichas:
//
//   1. Cobertura: toda carrera con página estática (claves de enlaces-ben.json)
//      resuelve una entrada, directa o por alias de clave fusionada.
//   2. Estructura: solo se permiten {descripcion, sectores, revisado}; nada de
//      campos de salida laboral, ingresos ni comparaciones económicas (fuera de
//      alcance de esta etapa).
//   3. Sectores: ids existentes en sectores.json, sin repetidos y sin huérfanos.
//   4. Redacción: largos razonables, sin signos de copy publicitario.
//
// Correr con:  node test_contenido.js
// ============================================================================
const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

let aserciones = 0;
let fallos = 0;
const ok = (cond, msg) => {
    if (cond) { aserciones++; console.log('  ✓ ' + msg); }
    else { fallos++; console.error('  ✗ ' + msg); }
};
const seccion = (n) => console.log(`\n${n}`);

seccion('1. Estructura de los archivos');

const sectoresJson = JSON.parse(leer('data/sectores.json'));
const contenido = JSON.parse(leer('data/contenido-carreras.json'));

ok(Array.isArray(sectoresJson.sectores) && sectoresJson.sectores.length >= 20,
    `sectores.json trae la lista cerrada (${sectoresJson.sectores.length} sectores)`);
const idsSectores = sectoresJson.sectores.map(s => s.id);
ok(new Set(idsSectores).size === idsSectores.length, 'no hay ids de sector repetidos');
ok(sectoresJson.sectores.every(s => s.id && s.nombre && s.alcance),
    'cada sector tiene id, nombre y una línea de alcance para revisarlo a mano');

ok(contenido.carreras && typeof contenido.carreras === 'object', 'contenido-carreras.json trae el mapa de carreras');
ok(typeof contenido.metodo === 'string' && contenido.metodo.length > 100,
    'el archivo documenta el método de generación (campo "metodo")');
ok(contenido.alias && typeof contenido.alias === 'object', 'trae el mapa de alias para claves fusionadas');

seccion('2. Cobertura de las carreras con página');

const enlaces = JSON.parse(leer('data/enlaces-ben.json'));
const clavesEnlaces = Object.keys(enlaces.carreras || {});
ok(clavesEnlaces.length > 400, `enlaces-ben.json tiene ${clavesEnlaces.length} claves de carrera`);

const entradaDe = (clave) => contenido.carreras[clave]
    || (contenido.alias[clave] ? contenido.carreras[contenido.alias[clave]] : null);

const sinContenido = clavesEnlaces.filter(k => !entradaDe(k));
ok(sinContenido.length === 0,
    `las ${clavesEnlaces.length} claves resuelven descripción y sectores${sinContenido.length ? ' → faltan: ' + sinContenido.slice(0, 8).join(', ') : ''}`);

const sinDescripcion = clavesEnlaces.filter(k => {
    const e = entradaDe(k);
    return !e || typeof e.descripcion !== 'string' || !e.descripcion.trim();
});
ok(sinDescripcion.length === 0, 'ninguna carrera quedó sin descripción');

const sinSectores = clavesEnlaces.filter(k => {
    const e = entradaDe(k);
    return !e || !Array.isArray(e.sectores) || e.sectores.length === 0;
});
ok(sinSectores.length === 0, 'ninguna carrera quedó sin al menos un sector');

// Toda clave fusionada apunta a una entrada real.
const aliasRotas = Object.entries(contenido.alias).filter(([, destino]) => !contenido.carreras[destino]);
ok(aliasRotas.length === 0, 'todos los alias apuntan a una entrada existente');

// Y no hay entradas huérfanas (de carreras que ya no tienen página).
const clavesValidas = new Set(clavesEnlaces.map(k => contenido.alias[k] || k));
const huerfanas = Object.keys(contenido.carreras).filter(k => !clavesValidas.has(k));
ok(huerfanas.length === 0,
    `no hay entradas huérfanas${huerfanas.length ? ' → ' + huerfanas.slice(0, 8).join(', ') : ''}`);

seccion('3. Alcance de esta etapa (sin datos de salida laboral ni ingresos)');

const CAMPOS_PERMITIDOS = new Set(['descripcion', 'sectores', 'revisado']);
const camposExtra = [];
const prohibidos = /(salida laboral|inserci[oó]n laboral|sueldo|salario|ingreso(s)? esperado|remuneraci[oó]n|cu[aá]nto (se )?gana|rentabilidad|mercado laboral)/i;
const terminosProhibidos = [];
for (const [clave, entrada] of Object.entries(contenido.carreras)) {
    Object.keys(entrada).forEach(campo => {
        if (!CAMPOS_PERMITIDOS.has(campo)) camposExtra.push(`${clave}.${campo}`);
    });
    if (prohibidos.test(entrada.descripcion)) terminosProhibidos.push(clave);
}
ok(camposExtra.length === 0,
    `las entradas solo usan {descripcion, sectores, revisado}${camposExtra.length ? ' → ' + camposExtra.slice(0, 5).join(', ') : ''}`);
ok(terminosProhibidos.length === 0,
    `ninguna descripción habla de ingresos ni salida laboral${terminosProhibidos.length ? ' → ' + terminosProhibidos.slice(0, 5).join(', ') : ''}`);

const sinRevisar = Object.values(contenido.carreras).filter(e => typeof e.revisado !== 'boolean');
ok(sinRevisar.length === 0, 'todas las entradas marcan revisado (true/false) para la revisión humana futura');

const sinMarcar = Object.values(contenido.carreras).filter(e => e.revisado !== false);
ok(sinMarcar.length === 0,
    `las ${Object.keys(contenido.carreras).length} entradas están marcadas revisado=false (generadas por IA, pendientes de revisión)`);

seccion('4. Sectores asignados');

const idsValidos = new Set(idsSectores);
const idsInvalidos = [];
const sectoresUsados = new Set();
for (const [clave, entrada] of Object.entries(contenido.carreras)) {
    entrada.sectores.forEach(s => {
        if (!idsValidos.has(s)) idsInvalidos.push(`${clave} → ${s}`);
        sectoresUsados.add(s);
    });
}
ok(idsInvalidos.length === 0,
    `todos los sectores asignados existen en sectores.json${idsInvalidos.length ? ' → ' + idsInvalidos.slice(0, 5).join(', ') : ''}`);

const repetidos = Object.entries(contenido.carreras).filter(([, e]) => new Set(e.sectores).size !== e.sectores.length);
ok(repetidos.length === 0, 'ninguna carrera repite un sector');

const huerfanos = idsSectores.filter(s => !sectoresUsados.has(s));
ok(huerfanos.length === 0,
    `no quedan sectores sin usar${huerfanos.length ? ' → ' + huerfanos.join(', ') : ''}`);

const porCarrera = Object.values(contenido.carreras).map(e => e.sectores.length);
ok(Math.max(...porCarrera) <= 5,
    `criterio conservador: ningún listado pasa de 5 sectores (máximo ${Math.max(...porCarrera)})`);

seccion('5. Redacción');

// El objetivo acordado es de 700 a 1100 caracteres por descripción. Se valida
// con un margen chico para no romper por un carácter y para poder ajustar
// textos sin tocar el test en cada edición.
const largos = Object.values(contenido.carreras).map(e => e.descripcion.length);
const min = Math.min(...largos);
const max = Math.max(...largos);
ok(min >= 650 && max <= 1150, `descripciones extensas, dentro del objetivo de 700 a 1100 (${min} a ${max} caracteres)`);

const parrafos = Object.values(contenido.carreras).map(e => e.descripcion.split(/\n{2,}/).filter(p => p.trim()).length);
ok(Math.max(...parrafos) <= 2 && Math.min(...parrafos) >= 1,
    `todas las descripciones tienen uno o dos párrafos (máximo ${Math.max(...parrafos)})`);

const conSignos = Object.entries(contenido.carreras).filter(([, e]) => /[!¡]/.test(e.descripcion));
ok(conSignos.length === 0,
    `sin signos de copy publicitario${conSignos.length ? ' → ' + conSignos.slice(0, 5).map(([k]) => k).join(', ') : ''}`);

const minPalabras = Math.min(...Object.values(contenido.carreras).map(e => e.descripcion.split(/\s+/).length));
ok(minPalabras >= 90, `todas las descripciones desarrollan el tema (mínimo ${minPalabras} palabras)`);

seccion('6. Mapa liviano para la app');

// generar-paginas.js escribe data/sectores-carreras.json con las claves ya
// resueltas para el filtro del buscador: tiene que coincidir con el contenido.
const mapa = JSON.parse(leer('data/sectores-carreras.json')).carreras;
const enlacesCarreras = enlaces.carreras || {};
const desalineadas = Object.keys(enlacesCarreras).filter(k => {
    const entrada = entradaDe(k);
    const esperado = entrada ? entrada.sectores.join(',') : '';
    return (mapa[k] || []).join(',') !== esperado;
});
ok(Object.keys(mapa).length === Object.keys(enlacesCarreras).length,
    `el mapa liviano trae las ${Object.keys(enlacesCarreras).length} claves de carrera`);
ok(desalineadas.length === 0,
    `los sectores del mapa coinciden con el contenido${desalineadas.length ? ' → ' + desalineadas.slice(0, 5).join(', ') : ''}`);

console.log(`\n✅ test_contenido.js: ${aserciones} aserciones OK, ${fallos} fallidas`);
if (fallos) process.exit(1);