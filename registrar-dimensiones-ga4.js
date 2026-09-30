// ============================================================================
// 📊 REGISTRAR LAS DIMENSIONES PERSONALIZADAS DE GA4
// ============================================================================
//
// De una sola vez: crea en la propiedad de GA4 todas las "definiciones
// personalizadas" que necesita el informe para poder leer los parámetros que
// manda el sitio. Sin esto, GA4 recibe los eventos pero descarta sus datos: se
// ve que hubo 128 search_sin_resultado, sin saber cuáles fueron esas 128.
//
// Se corre UNA vez (y de nuevo cada vez que se agregue un evento nuevo). Es
// idempotente: si una dimensión ya existe, la saltea en vez de duplicarla.
//
// USO
//   1. Generar la credencial (una sola vez, en Google Cloud):
//      - Crear un proyecto en https://console.cloud.google.com
//      - APIs y servicios → Biblioteca → habilitar "Google Analytics Admin API"
//      - APIs y servicios → Credenciales → Crear credencial → Cuenta de servicio
//      - A esa cuenta, crearle una clave → JSON → descargar
//      - Copiar el email de la cuenta de servicio (algo@proyecto.iam.gserviceaccount.com)
//   2. Darle acceso en GA4: Administrar → Acceso a la propiedad → agregar ese
//      email con el rol "Editor" (sin esto la API responde 403).
//   3. Correr:
//
//        node registrar-dimensiones-ga4.js <id-numérico-de-propiedad> <ruta-al-json>
//
//      El ID numérico no es el G-JCNCMH202B: está en Administrar →
//      Configuración de la propiedad → "ID de la propiedad".
//
// La credencial es una llave privada: queda en .gitignore y no se versiona.
// ============================================================================

'use strict';

const fs = require('fs');
const crypto = require('crypto');

// El catálogo de lo que se registra, en el mismo orden que la tabla de
// docs/GUIA_GA4.md. `parametro` es el nombre que sale en el evento (tiene que
// coincidir letra por letra); `nombre` es lo que se lee en la columna del
// informe. Los que son números van como MÉTRICA: agrupar por una dimensión
// numérica funciona igual, pero no se puede promediar ni sumar.
const DIMENSIONES = [
  ['search_term', 'Búsqueda', 'Lo que se escribió en el buscador o se le preguntó al Copiloto'],
  ['origen', 'Por qué no encontró', 'texto / filtros / texto_y_filtros: qué hizo fallar la búsqueda'],
  ['via', 'Desde dónde buscó', 'buscador / autocompletado / cabecera_estatica'],
  ['seccion', 'Sección', 'Pestaña del sitio donde pasó'],
  ['filtro', 'Filtro tocado', 'Qué filtro se usó (área, modalidad, duración, orden…)'],
  ['valor', 'Valor del filtro', 'Qué eligió en ese filtro'],
  ['accion', 'Acción', 'Qué hizo: agregado, completar, abrir, empezar…'],
  ['item', 'Tipo de ficha', 'carrera / institución / oficio / curso'],
  ['nombre', 'Carrera', 'Nombre de la carrera marcada o recomendada'],
  ['area', 'Área', 'Área de esa carrera (Salud, Ingeniería…)'],
  ['formacion', 'Formación', 'grado / tecnicatura / curso'],
  ['codigo', 'Perfil del test', 'El resultado del test en 3 letras (SIE, AIN…)'],
  ['driver_riasec', 'Orientación RIASEC', 'Por dónde calzó el resultado, ej. Social-Emprendedor'],
  ['driver_apt', 'Orientación aptitud', 'Ej. interpersonal, espacial'],
  ['driver_val', 'Orientación valor', 'Ej. impacto social, estabilidad'],
  ['host', 'Sitio de destino', 'A qué institución se fue (ej. uncuyo.edu.ar)'],
  ['pagina', 'Página de salida', 'Desde qué página hizo clic para irse'],
  ['pantalla', 'Pantalla', 'Pantalla de Mi lista donde estaba'],
  ['avance', 'Avance del test', 'Cuántas preguntas llevaba al abandonar'],
  ['texto', 'Consulta al Copiloto', 'Lo que le escribió al chat'],
  ['donde', 'Dónde falló', 'test / motor / datos / nombre del archivo'],
  ['tipo', 'Tipo de falla', 'js / rechazo / recurso'],
  ['mensaje', 'Mensaje del error', 'Detalle técnico del error, ya sin datos personales'],
  ['motivo', 'Motivo', 'Por qué falló un evento de falla']
];

const METRICAS = [
  ['sugerencias', 'Sugerencias mostradas', 'Cuántas parecidas se mostraron cuando no hubo resultados exactos'],
  ['candidatas', 'Carreras recomendadas', 'Cuántas carreras le salieron en el resultado del test'],
  ['preguntadas', 'Preguntas contestadas', 'Cuántas preguntas contestó al completar el test'],
  ['preguntas', 'Preguntas del test', 'Total de preguntas del test al empezarlo'],
  ['total', 'Total de la lista', 'Cuántas fichas había cuando usó Mi lista']
];

const API = 'https://analyticsadmin.googleapis.com/v1beta';

function morir(mensaje) {
  console.error('\n✗ ' + mensaje + '\n');
  process.exit(1);
}

// ── Credencial: JWT firmado que se canjea por un token de acceso ─────────────
// Se arma a mano (sin librerías) para que el repo no sume dependencias por un
// script que se corre una vez cada tanto.
function base64url(datos) {
  return Buffer.from(datos).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function tokenDeAcceso(cuentaServicio) {
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = base64url(JSON.stringify({
    iss: cuentaServicio.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.edit',
    aud: 'https://oauth2.googleapis.com/token',
    iat: ahora,
    exp: ahora + 3600
  }));
  const firma = base64url(crypto.createSign('RSA-SHA256')
    .update(cabecera + '.' + cuerpo)
    .sign(cuentaServicio.private_key));

  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecera}.${cuerpo}.${firma}`
    })
  });
  const datos = await respuesta.json();
  if (!datos.access_token) morir('Google no dio token: ' + JSON.stringify(datos));
  return datos.access_token;
}

// ── Llamadas a la API ───────────────────────────────────────────────────────
async function pedir(token, metodo, ruta, cuerpo) {
  const respuesta = await fetch(API + ruta, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const detalle = (datos.error && datos.error.message) || respuesta.status;
    throw new Error(`${respuesta.status}: ${detalle}`);
  }
  return datos;
}

// Lo que ya está registrado, para no duplicar. Se compara por `parameterName`,
// que es lo que tiene que ser único.
async function yaRegistrados(token, propiedad, tipo) {
  const registrados = new Set();
  let pagina = '';
  do {
    const datos = await pedir(token, 'GET',
      `/properties/${propiedad}/${tipo === 'dimension' ? 'customDimensions' : 'customMetrics'}?pageSize=200${pagina}`);
    (datos.customDimensions || datos.customMetrics || []).forEach(d => registrados.add(d.parameterName));
    pagina = datos.nextPageToken ? `&pageToken=${datos.nextPageToken}` : '';
  } while (pagina);
  return registrados;
}

async function main() {
  const [propiedad, rutaClave] = process.argv.slice(2);
  if (!propiedad || !rutaClave) {
    morir('Uso: node registrar-dimensiones-ga4.js <id-numérico-de-propiedad> <ruta-al-json>');
  }
  if (!/^\d+$/.test(propiedad)) {
    morir(`"${propiedad}" no parece un ID de propiedad.\n` +
      'Es el número de Administrar → Configuración de la propiedad, no el G-JCNCMH202B.');
  }
  if (!fs.existsSync(rutaClave)) morir('No existe el archivo de credencial: ' + rutaClave);

  const cuentaServicio = JSON.parse(fs.readFileSync(rutaClave, 'utf8'));
  if (!cuentaServicio.client_email || !cuentaServicio.private_key) {
    morir('El JSON no es de una cuenta de servicio (le falta client_email o private_key).');
  }

  console.log(`\nPropiedad ${propiedad} — cuenta ${cuentaServicio.client_email}\n`);
  const token = await tokenDeAcceso(cuentaServicio);

  const dimensionesExistentes = await yaRegistrados(token, propiedad, 'dimension');
  const metricasExistentes = await yaRegistrados(token, propiedad, 'metric');

  let creadas = 0;
  let salteadas = 0;

  console.log('Dimensions (para agrupar y filtrar)');
  for (const [parametro, nombre, descripcion] of DIMENSIONES) {
    if (dimensionesExistentes.has(parametro)) {
      salteadas++;
      console.log(`  · ${parametro.padEnd(18)} ya estaba`);
      continue;
    }
    await pedir(token, 'POST', `/properties/${propiedad}/customDimensions`, {
      parameterName: parametro, displayName: nombre, description: descripcion, scope: 'EVENT'
    });
    creadas++;
    console.log(`  ✓ ${parametro.padEnd(18)} ${nombre}`);
  }

  console.log('\nMétricas (para sumar y promediar)');
  for (const [parametro, nombre, descripcion] of METRICAS) {
    if (metricasExistentes.has(parametro)) {
      salteadas++;
      console.log(`  · ${parametro.padEnd(18)} ya estaba`);
      continue;
    }
    await pedir(token, 'POST', `/properties/${propiedad}/customMetrics`, {
      parameterName: parametro, displayName: nombre, description: descripcion,
      scope: 'EVENT', measurementUnit: 'STANDARD'
    });
    creadas++;
    console.log(`  ✓ ${parametro.padEnd(18)} ${nombre}`);
  }

  console.log(`\n✅ ${creadas} creada(s), ${salteadas} ya estaban.`);
  console.log('Tardan unas horas en aparecer en los informes; los datos empiezan a');
  console.log('juntarse desde ahora (lo anterior no se recupera).\n');
}

main().catch(error => morir(error.message));
