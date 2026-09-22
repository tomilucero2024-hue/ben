// ============================================================================
// 🧭 GENERADOR DE PERFILES DEL TEST VOCACIONAL COMPLETO
// ============================================================================
//
// Arma data/vocacional/perfiles-carreras.json: el perfil de CADA carrera del
// catálogo (RIASEC + aptitudes + valores) en el mismo espacio de dimensiones
// que responde el estudiante, para poder cruzarlos después.
//
// FASE A — Perfil inicial automático (no requiere trabajo humano):
//   perfil = areas-base[area]  +  ajustes por palabras clave del nombre
//           +  ajustes por tipo de formación
//   Todo recortado a 0-10. Una carrera nueva queda perfilada el mismo día que
//   se scrapea: no hay que tocar este archivo.
//
// FASE B — Afinado por uso real (opcional, sin intervención manual):
//   Si existe data/vocacional/perfiles-uso.json (lo genera
//   generar-perfiles-uso.js a partir de los eventos de los estudiantes), se
//   mezcla el perfil inicial con el promedio de los estudiantes que
//   interactuaron con esa carrera:
//
//     peso_uso = min(interacciones / interacciones_tope, peso_maximo)
//     perfil   = inicial * (1 - peso_uso) + uso * peso_uso
//
//   Las constantes (50 y 0.8) viven en data/vocacional/config.json. El techo
//   del 0.8 existe para que un pico de uso anómalo nunca reemplace el perfil.
//
// Este script es el único generador de perfiles del sitio: usa
// las MISMAS carreras y la MISMA clasificación de área/formación, pero en el
// espacio de dimensiones nuevo.
// ============================================================================

const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const DIR_DATA = path.join(RAIZ, 'data');
const DIR_VOC = path.join(DIR_DATA, 'vocacional');
const SALIDA = path.join(DIR_VOC, 'perfiles-carreras.json');

// Claves de data.json que NO son "instituciones" pero igual tienen carreras
// recomendables. 'secundario' queda afuera a propósito (es terminalidad
// educativa, no tiene temática sobre la que opinar).
const CATALOGOS_APARTE = ['formaciones_alternativas', 'oficios_tecnicos'];

const BLOQUES = ['riasec', 'apt', 'val'];

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function leerJSON(ruta) {
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

function recortar(n) {
  return Math.max(0, Math.min(10, n));
}

// Suma un ajuste expresado en claves con puntos ('riasec.I', 'apt.verbal') al
// perfil anidado. Devuelve el perfil modificado.
function aplicarDims(perfil, dims, factor = 1) {
  Object.entries(dims || {}).forEach(([ruta, delta]) => {
    const [bloque, dim] = ruta.split('.');
    if (!perfil[bloque] || perfil[bloque][dim] === undefined) return;
    perfil[bloque][dim] = recortar(perfil[bloque][dim] + delta * factor);
  });
  return perfil;
}

// ¿El nombre de la carrera matchea esta palabra clave? Por defecto alcanza con
// que la contenga (sirve para raíces: 'enfermer' encuentra 'Enfermería'). Si la
// palabra empieza con '=', se exige palabra completa: '=arte' NO matchea
// 'artesanal' ni '=moda' matchea 'modalidad'. Sin esto, palabras cortas rompían
// perfiles enteros (ej: 'ui' matcheaba 'Química', 'arte' matcheaba 'Cerveza
// Artesanal').
function coincideClave(nombreNormalizado, palabra) {
  const clave = normalizar(palabra);
  if (clave.startsWith('=')) {
    const buscado = clave.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${buscado}([^a-z0-9]|$)`).test(nombreNormalizado);
  }
  return nombreNormalizado.includes(clave);
}

function copiarPerfil(base) {
  return {
    riasec: { ...base.riasec },
    apt: { ...base.apt },
    val: { ...base.val }
  };
}

function main() {
  const areasBase = leerJSON(path.join(DIR_VOC, 'areas-base.json')).areas;
  const ajustes = leerJSON(path.join(DIR_VOC, 'ajustes-palabras.json')).ajustes;
  const config = leerJSON(path.join(DIR_VOC, 'config.json'));
  const data = leerJSON(path.join(DIR_DATA, 'data.json'));

  // Perfil por uso (Fase B). Es opcional: si no existe, todas las carreras
  // quedan con su perfil inicial y peso_uso = 0.
  const rutaUso = path.join(DIR_VOC, 'perfiles-uso.json');
  const uso = fs.existsSync(rutaUso) ? leerJSON(rutaUso).carreras || {} : {};
  const tope = (config.uso && config.uso.interacciones_tope) || 50;
  const pesoMax = (config.uso && config.uso.peso_maximo) || 0.8;

  let getArea, getFormacion;

  const carrerasMap = new Map();

  function agregarCarrera(nombre, categoria, institucion, forzarCursos = false) {
    if (!nombre) return;
    const clave = normalizar(nombre);
    if (!carrerasMap.has(clave)) {
      carrerasMap.set(clave, {
        clave,
        nombre,
        categoria,
        area: getArea(nombre),
        formacion: forzarCursos ? 'cursos' : getFormacion(categoria, nombre),
        instituciones: []
      });
    }
    const entry = carrerasMap.get(clave);
    const nombreInst = institucion || 'Desconocido';
    if (!entry.instituciones.includes(nombreInst)) entry.instituciones.push(nombreInst);
  }

  return import('./js/util.js').then(util => {
    getArea = util.getArea;
    getFormacion = util.getFormacion;

    (data.instituciones || []).forEach(inst => {
      (inst.carreras || []).forEach(c => agregarCarrera(c.nombre_carrera || c.nombre, c.categoria, inst.nombre));
    });
    CATALOGOS_APARTE.forEach(clave => {
      (data[clave] || []).forEach(inst => {
        (inst.carreras || []).forEach(c => agregarCarrera(c.nombre_carrera || c.nombre, c.categoria, inst.nombre, true));
      });
    });

    console.log(`🔍 Carreras únicas encontradas: ${carrerasMap.size}`);

    const resultado = [];
    let conUso = 0;

    carrerasMap.forEach(carrera => {
      const base = areasBase[carrera.area] || areasBase['Ciencias sociales'];
      const perfilInicial = copiarPerfil(base);

      const aplicadas = [];
      const nombreNorm = normalizar(carrera.nombre);
      ajustes.forEach(({ palabras, dims }) => {
        if (palabras.some(p => coincideClave(nombreNorm, p))) {
          aplicarDims(perfilInicial, dims);
          aplicadas.push(palabras[0]);
        }
      });

      const ajusteFormacion = (config.ajustes_formacion || {})[carrera.formacion];
      if (ajusteFormacion) {
        aplicarDims(perfilInicial, ajusteFormacion);
        aplicadas.push(`formacion:${carrera.formacion}`);
      }

      // Fase B: mezcla con el perfil por uso, con techo.
      const registroUso = uso[carrera.clave];
      const interacciones = registroUso ? registroUso.n || 0 : 0;
      const pesoUso = Math.min(interacciones / tope, pesoMax);
      const perfilFinal = copiarPerfil(perfilInicial);
      if (registroUso && registroUso.perfil_uso && pesoUso > 0) {
        conUso++;
        BLOQUES.forEach(bloque => {
          Object.keys(perfilFinal[bloque]).forEach(dim => {
            const inicial = perfilInicial[bloque][dim] || 0;
            const porUso = (registroUso.perfil_uso[bloque] || {})[dim];
            if (porUso === undefined) return;
            perfilFinal[bloque][dim] = Number((inicial * (1 - pesoUso) + porUso * pesoUso).toFixed(1));
          });
        });
      }

      resultado.push({
        clave: carrera.clave,
        nombre: carrera.nombre,
        categoria: carrera.categoria,
        area: carrera.area,
        formacion: carrera.formacion,
        instituciones: carrera.instituciones,
        perfil: {
          riasec: redondearBloque(perfilFinal.riasec),
          apt: redondearBloque(perfilFinal.apt),
          val: redondearBloque(perfilFinal.val)
        },
        origen: {
          area_base: carrera.area,
          ajustes: aplicadas,
          interacciones,
          peso_uso: Number(pesoUso.toFixed(3))
        }
      });
    });

    resultado.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    fs.writeFileSync(SALIDA, JSON.stringify({
      version: 1,
      generado: new Date().toISOString(),
      dimensiones: {
        riasec: ['R', 'I', 'A', 'S', 'E', 'C'],
        apt: ['logico_matematica', 'verbal', 'espacial', 'interpersonal', 'corporal'],
        val: ['estabilidad', 'variedad', 'equipo', 'impacto', 'ingresos', 'movilidad']
      },
      carreras: resultado
    }, null, 2));

    console.log(`✅ Generado: ${SALIDA} (${resultado.length} carreras)`);
    console.log(`📈 Perfiles afinados por uso: ${conUso}`);
    return resultado;
  });
}

function redondearBloque(bloque) {
  const salida = {};
  Object.keys(bloque).forEach(dim => { salida[dim] = Number(bloque[dim].toFixed(1)); });
  return salida;
}

main().catch(error => {
  console.error('❌ Error en generar-perfiles-vocacional:', error);
  process.exit(1);
});
