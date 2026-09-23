// ============================================================================
// Suite de Mi lista + comparador (js/favoritos.js, js/mi-lista.js) en jsdom.
// Cubre: guardar/quitar, contador, aviso, lista agrupada, selección tope 3,
// comparación con y sin test hecho, diferencias, ficha huérfana y Fase B.
// ============================================================================
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RAIZ = __dirname;
let aserciones = 0;
let fallos = 0;
const ok = (cond, msg) => {
    if (cond) { aserciones++; console.log('  ✓ ' + msg); }
    else { fallos++; console.error('  ✗ ' + msg); }
};

const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body data-seccion="formal">
  <div class="hero"></div><div class="catalog-layout"></div>
  <aside id="copilotoPanel"></aside><aside id="testCompleto" hidden></aside>
  <header class="header"></header><footer class="site-footer"></footer><aside class="a11y-widget"></aside>
  <div id="resultsToolbar"><span id="resultsCount"></span><span id="chapaRecomendacion" hidden></span>
    <nav id="vistasSwitcher"></nav>
    <div class="toolbar-actions"><button id="btnMiLista" data-abrir-mi-lista aria-controls="miLista">Mi lista <span id="miListaContador" hidden></span></button></div>
  </div>
  <div id="filtersSidebar"></div><button id="mobileFilterButton"></button><div id="filtersOverlay"></div>
  <div id="cardContainer"></div><button id="cargarMas"></button>
  <div id="seccion-plataformas"></div><div id="plataformas-coincidentes"></div>
  <div id="seccion-formaciones"><div id="contenedor-formaciones"></div></div>
  <div id="seccion-oficios"><div id="contenedor-oficios"></div></div>
  <div id="seccion-secundario"><div id="contenedor-secundario"></div></div>
  <aside id="miLista" hidden aria-label="Mi lista de carreras guardadas">
    <div class="ml-ventana" role="dialog" aria-modal="true" aria-labelledby="ml-titulo">
      <header class="ml-header"><h2 id="ml-titulo">Mi lista</h2><button id="ml-cerrar" type="button" aria-label="Cerrar Mi lista">✕</button></header>
      <div id="ml-cuerpo" class="ml-cuerpo"></div>
      <footer id="ml-pie" class="ml-pie"></footer>
    </div>
  </aside>
</body></html>`, { url: 'http://localhost/' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.location = dom.window.location;
global.history = dom.window.history;
global.URL = dom.window.URL;
global.CustomEvent = dom.window.CustomEvent;
global.Event = dom.window.Event;
global.Blob = dom.window.Blob;
global.Node = dom.window.Node;

global.fetch = async (url) => {
    const limpia = String(url).split('?')[0].replace(/^\//, '');
    const p = path.join(RAIZ, limpia);
    if (!fs.existsSync(p)) return { ok: false, status: 404 };
    const texto = fs.readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(texto), text: async () => texto };
};

// Simula el breakpoint de celular: mi-lista.js decide el layout con esto.
let pantallaAngosta = false;
dom.window.matchMedia = (consulta) => ({
    matches: pantallaAngosta && /max-width:\s*640px/.test(consulta),
    media: consulta,
    addEventListener() {}, removeEventListener() {}
});

dom.window.eval(fs.readFileSync(path.join(RAIZ, 'js/vocacional/eventos.js'), 'utf8'));
dom.window.eval(fs.readFileSync(path.join(RAIZ, 'js/favoritos.js'), 'utf8'));
dom.window.eval(fs.readFileSync(path.join(RAIZ, 'js/vocacional/motor.js'), 'utf8'));

const PERFIL_PRUEBA = {
    riasec: { R: 2, I: 8, A: 6, S: 5, E: 2, C: 4 },
    apt: { logico_matematica: 8, verbal: 6, espacial: 6, interpersonal: 5, corporal: 2 },
    val: { estabilidad: 6, variedad: 7, equipo: 5, impacto: 7, ingresos: 5, movilidad: 5 },
    codigo: 'IA'
};

const ofertaClave = (nombre) => `institucion:Universidad Nacional de Cuyo (UNCuyo):${nombre}`;
const itemOferta = (nombre) => ({
    clave: ofertaClave(nombre), tipo: 'carrera', claveCarrera: nombre.toLowerCase(),
    nombre, institucion: 'Universidad Nacional de Cuyo (UNCuyo)', area: '', formacion: 'grado', ficha: '', link: ''
});

(async () => {
    console.log('🧪 Iniciando test_mi_lista...\n');

    // Carga el catálogo real (ofertas) y los datos del test.
    const { cargarOfertas, ofertas } = await import('./js/datos.js');
    await cargarOfertas();
    await dom.window.Vocacional.cargarDatos();
    const { abrirMiLista, cerrarMiLista, inicializarMiLista } = await import('./js/mi-lista.js');
    inicializarMiLista();

    const Favoritos = dom.window.Favoritos;
    const cuerpo = document.getElementById('ml-cuerpo');
    const pie = document.getElementById('ml-pie');
    const contador = document.getElementById('miListaContador');

    // ---- 1. API de favoritos ----
    console.log('1. API de favoritos');
    ok(Favoritos.contar() === 0, 'arranca vacía');
    ok(Favoritos.toggle(itemOferta('Ingeniería Civil')) === 'agregado', 'toggle agrega');
    ok(Favoritos.tiene(ofertaClave('Ingeniería Civil')), 'tiene() encuentra la clave');
    ok(Favoritos.contar() === 1, 'contar() refleja el alta');
    ok(Favoritos.toggle(itemOferta('Ingeniería Civil')) === 'quitado', 'toggle quita');
    ok(Favoritos.contar() === 0, 'contar() refleja la baja');

    let avisos = 0;
    const desuscribir = Favoritos.suscribir(() => { avisos++; });
    Favoritos.toggle(itemOferta('Ingeniería Civil'));
    ok(avisos >= 1, 'los suscriptores reciben el cambio');

    // ---- 2. Botón en la tarjeta (delegación global) ----
    console.log('2. Botón "Me interesa"');
    document.getElementById('cardContainer').innerHTML =
        `<article class="card"><div class="card-actions">${Favoritos.botonHTML(itemOferta('Abogacía'))}</div></article>`;
    const boton = document.querySelector('[data-favorito]');
    ok(boton && boton.getAttribute('aria-pressed') === 'false', 'el botón nace sin apretar');
    boton.click();
    ok(localStorage.getItem('ben-favoritos').includes('Abogacía'), 'el click guarda la ficha');
    ok(boton.getAttribute('aria-pressed') === 'true', 'el botón queda apretado');
    ok(boton.textContent.includes('Guardada'), 'el texto pasa a "Guardada"');
    ok(document.querySelector('.fav-toast.is-visible') !== null, 'aparece el aviso');
    ok(document.querySelector('.fav-toast-accion') !== null, 'el aviso invita a "Ver mi lista"');
    ok(contador && !contador.hidden && Number(contador.textContent) === 2, `el contador muestra 2 (${contador.textContent})`);
    boton.click();
    ok(!Favoritos.tiene(ofertaClave('Abogacía')), 'el segundo click la quita');

    // ---- 3. Fase B: el corazón alimenta el promedio de uso ----
    console.log('3. Fase B');
    localStorage.setItem('ben-vocacional-perfil', JSON.stringify(PERFIL_PRUEBA));
    Favoritos.toggle(itemOferta('Medicina'));
    const eventos = JSON.parse(localStorage.getItem('ben-vocacional-eventos') || '[]');
    ok(eventos.length === 1 && eventos[0].tipo === 'me-interesa', 'registra el evento de uso');
    ok(eventos[0].perfil && eventos[0].perfil.riasec.I === 8, 'el evento lleva el perfil del test');
    Favoritos.toggle(itemOferta('Medicina')); // se saca: solo servía para el evento

    // ---- 4. Lista agrupada ----
    console.log('4. Mi lista');
    const perfilAuto = dom.window.Vocacional.perfiles.find(p => p.clave === 'abogacia') || dom.window.Vocacional.perfiles[0];
    Favoritos.toggle({ clave: perfilAuto.clave, tipo: 'carrera', claveCarrera: perfilAuto.clave, nombre: perfilAuto.nombre, institucion: '', area: perfilAuto.area, formacion: perfilAuto.formacion, ficha: 'abogacia', link: '' });
    abrirMiLista();
    ok(!document.getElementById('miLista').hidden, 'la ventana se abre');
    ok(document.body.classList.contains === undefined || document.documentElement.classList.contains('mi-lista-abierta'), 'el fondo queda congelado');
    ok(/Ingeniería Civil/.test(cuerpo.innerHTML), 'lista la carrera guardada');
    ok(/Abogacía/.test(cuerpo.innerHTML), 'lista la carrera recomendada');
    ok(document.querySelectorAll('.ml-item').length === 2, `dos filas (${document.querySelectorAll('.ml-item').length})`);
    ok(/%\s*<\/span>/.test(cuerpo.innerHTML) || /ml-item-afinidad/.test(cuerpo.innerHTML), 'muestra afinidad (hay perfil de test)');
    ok(cuerpo.querySelectorAll('.ml-grupo').length === 1, 'agrupa por tipo');

    // ---- 5. Selección y tope de 3 ----
    console.log('5. Selección');
    Favoritos.toggle(itemOferta('Arquitectura'));
    Favoritos.toggle(itemOferta('Contador Público'));
    const checks = () => [...cuerpo.querySelectorAll('[data-ml-marcar]')];
    ok(checks().length === 4, `4 fichas para marcar (${checks().length})`);
    checks()[0].click();
    checks()[1].click();
    checks()[2].click();
    checks()[3].click();
    ok(pie.querySelector('[data-ml-accion="comparar"]').textContent.includes('(3)'), 'el botón de comparar cuenta 3');
    ok(!checks()[3].checked, 'la cuarta no queda marcada (tope 3)');

    // ---- 6. Comparación ----
    console.log('6. Comparación');
    pie.querySelector('[data-ml-accion="comparar"]').click();
    ok(/ml-tabla/.test(cuerpo.innerHTML), 'aparece la tabla comparativa');
    ok(cuerpo.querySelectorAll('thead th').length === 4, `encabezado + 3 columnas (${cuerpo.querySelectorAll('thead th').length})`);
    const etiquetas = [...cuerpo.querySelectorAll('tbody th')].map(th => th.textContent.trim());
    ok(etiquetas.includes('Afinidad con tu perfil'), 'compara afinidad');
    ok(etiquetas.includes('Duración'), 'compara duración');
    ok(!etiquetas.includes('Costo'), 'ya no compara costo (se quitó del sitio)');
    ok(etiquetas.includes('Plan de estudios'), 'compara plan de estudios');
    ok(!etiquetas.includes('Dónde se cursa'), 'no compara "Dónde se cursa" (se quitó de la lista)');
    ok(/En qué se diferencian/.test(cuerpo.innerHTML), 'trae el resumen de diferencias');
    ok(/<li>/.test(document.querySelector('.ml-diferencias').innerHTML), 'el resumen tiene al menos una diferencia');

    // ---- 6b. Layout vertical en celular ----
    console.log('6b. Comparación en lista (celular)');
    pantallaAngosta = true;
    pie.querySelector('[data-ml-accion="volver"]').click();
    checks().forEach(c => { if (c.checked) c.click(); });
    checks()[0].click();
    checks()[1].click();
    checks()[2].click();
    pie.querySelector('[data-ml-accion="comparar"]').click();
    const grupos = cuerpo.querySelectorAll('.ml-lista-grupo');
    ok(grupos.length > 5, `una sola lista con un bloque por atributo (${grupos.length})`);
    ok(!cuerpo.querySelector('.ml-tabla') && !cuerpo.querySelector('.ml-ficha'), 'sin tabla ni scroll horizontal en celular');
    ok(cuerpo.querySelectorAll('.ml-lista-item').length === grupos.length * 3, 'cada bloque lista las 3 carreras con su valor');
    ok(cuerpo.querySelector('.ml-lista-grupo .ml-lista-item-nombre').textContent.trim().length > 0, 'los valores dicen a qué carrera pertenecen');
    ok(/En qué se diferencian/.test(cuerpo.innerHTML), 'el resumen de diferencias sigue abajo');
    pantallaAngosta = false;
    pie.querySelector('[data-ml-accion="volver"]').click();
    checks().forEach(c => { if (c.checked) c.click(); });
    checks()[0].click();
    checks()[1].click();
    checks()[2].click();
    pie.querySelector('[data-ml-accion="comparar"]').click();
    ok(Boolean(cuerpo.querySelector('.ml-tabla')) && !cuerpo.querySelector('.ml-lista'), 'en escritorio vuelve la tabla alineada');

    // ---- 7. Vaciar en dos pasos ----
    console.log('7. Vaciar');
    pie.querySelector('[data-ml-accion="volver"]').click();
    ok(/ml-items/.test(cuerpo.innerHTML), 'vuelve a la lista');
    pie.querySelector('[data-ml-accion="vaciar"]').click();
    ok(/¿Vaciar Mi lista\?/.test(pie.innerHTML), 'pide confirmación en el pie');
    pie.querySelector('[data-ml-accion="cancelar-vaciar"]').click();
    ok(Favoritos.contar() >= 2, 'cancelar no borra');
    pie.querySelector('[data-ml-accion="vaciar"]').click();
    pie.querySelector('[data-ml-accion="confirmar-vaciar"]').click();
    ok(Favoritos.contar() === 0, 'confirmar vacía la lista');
    ok(/Todavía no guardaste/.test(cuerpo.innerHTML), 'muestra el estado vacío');
    ok(contador.hidden, 'el contador se esconde cuando está vacía');

    // ---- 8. Ficha que ya no está en el catálogo ----
    console.log('8. Ficha huérfana');
    Favoritos.toggle({ clave: 'institucion:Universidad Fantasma:Carrera Inexistente', tipo: 'carrera', nombre: 'Carrera Inexistente', institucion: 'Universidad Fantasma' });
    abrirMiLista();
    ok(/Ya no está en el catálogo/.test(cuerpo.innerHTML), 'la marca como fuera del catálogo');
    cuerpo.querySelector('[data-ml-quitar]').click();
    ok(Favoritos.contar() === 0, 'se puede quitar desde la lista');

    // ---- 9. Escape y cierre ----
    console.log('9. Cierre');
    const escape = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escape);
    ok(document.getElementById('miLista').hidden, 'Escape cierra la ventana');
    abrirMiLista();
    document.getElementById('ml-cerrar').click();
    ok(document.getElementById('miLista').hidden, 'la ✕ cierra la ventana');

    desuscribir();
    console.log(`\n${fallos === 0 ? '✅' : '❌'} test_mi_lista.js: ${aserciones} aserciones, ${fallos} fallo(s)`);
    process.exit(fallos ? 1 : 0);
})().catch(error => {
    console.error('❌ test_mi_lista.js falló:', error);
    process.exit(1);
});
