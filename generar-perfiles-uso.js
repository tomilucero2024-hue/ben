// ============================================================================
// 📈 GENERADOR DE PERFILES POR USO (Fase B, sin intervención manual)
// ============================================================================
//
// Toma los eventos de uso real (clicks de estudiantes desde los resultados del
// test) y calcula, para cada carrera, el PROMEDIO de los perfiles de los
// estudiantes que interactuaron con ella.
//
// Entrada (por defecto data/vocacional/eventos.json, o el path que se pase):
//   {
//     "eventos": [
//       { "claveCarrera": "tecnicatura en enfermeria profesional",
//         "tipo": "ver-ficha", "fecha": "2026-09-21T...",
//         "perfil": { "riasec": {...}, "apt": {...}, "val": {...}, "codigo": "SIE" } },
//       ...
//     ]
//   }
//
// Salida: data/vocacional/perfiles-uso.json
//   { "generado": "...", "total_eventos": N,
//     "carreras": { "<clave>": { "n": 12, "perfil_uso": { "riasec": {...}, ... } } } }
//
// Después, generar-perfiles-vocacional.js mezcla ese promedio con el perfil
// inicial usando peso_uso = min(n / 50, 0.8) (constantes en config.json).
//
// Uso:  node generar-perfiles-uso.js [ruta-eventos.json]
// Cron: se puede correr cuando haya eventos nuevos; no necesita ser en vivo.
// ============================================================================

const fs = require('fs');
const path = require('path');

const DIR_VOC = path.join(__dirname, 'data', 'vocacional');
const ENTRADA = process.argv[2] ? path.resolve(process.argv[2]) : path.join(DIR_VOC, 'eventos.json');
const SALIDA = path.join(DIR_VOC, 'perfiles-uso.json');

const BLOQUES = ['riasec', 'apt', 'val'];

function redondear(n) {
  return Math.round(n * 10) / 10;
}

function main() {
  if (!fs.existsSync(ENTRADA)) {
    console.log(`⚠️  No hay eventos en ${ENTRADA}. Se genera un archivo vacío (todas las carreras usan su perfil inicial).`);
  }

  const eventos = fs.existsSync(ENTRADA)
    ? (JSON.parse(fs.readFileSync(ENTRADA, 'utf8')).eventos || [])
    : [];

  const acumulado = {};
  let validos = 0;

  eventos.forEach(evento => {
    const clave = evento && evento.claveCarrera;
    const perfil = evento && evento.perfil;
    if (!clave || !perfil) return;
    if (!acumulado[clave]) acumulado[clave] = { n: 0, suma: {} };
    const registro = acumulado[clave];
    registro.n++;
    validos++;
    BLOQUES.forEach(bloque => {
      const valores = perfil[bloque] || {};
      Object.entries(valores).forEach(([dim, valor]) => {
        const ruta = `${bloque}.${dim}`;
        if (!registro.suma[ruta]) registro.suma[ruta] = 0;
        registro.suma[ruta] += Number(valor) || 0;
      });
    });
  });

  const carreras = {};
  Object.entries(acumulado).forEach(([clave, registro]) => {
    const perfilUso = { riasec: {}, apt: {}, val: {} };
    BLOQUES.forEach(bloque => {
      Object.keys(acumulado[clave].suma).filter(r => r.startsWith(`${bloque}.`)).forEach(ruta => {
        const dim = ruta.split('.')[1];
        perfilUso[bloque][dim] = redondear(registro.suma[ruta] / registro.n);
      });
    });
    carreras[clave] = { n: registro.n, perfil_uso: perfilUso };
  });

  fs.writeFileSync(SALIDA, JSON.stringify({
    version: 1,
    generado: new Date().toISOString(),
    total_eventos: validos,
    carreras
  }, null, 2));

  console.log(`✅ ${validos} evento(s) procesados · ${Object.keys(carreras).length} carrera(s) con perfil por uso`);
  console.log(`📄 Salida: ${SALIDA}`);
}

main();
