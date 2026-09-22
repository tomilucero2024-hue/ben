// ============================================================================
// Suite de js/favoritos.js como script autónomo (el que corre en las páginas
// estáticas de carrera) + el contrato con el HTML que genera generar-paginas.js.
//
// Cubre: API de storage, hidratación del botón vacío que emite el generador,
// aria-estados, aviso, sincronización entre pestañas, tope de fichas, storage
// roto y el evento de Fase B solo cuando hay perfil del test.
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

// Página mínima con los dos botones que puede emitir el generador: uno lleno
// (como los de la app) y uno "vacío" (como los de /carrera/<slug>/).
function construirDOM() {
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
      <div class="acciones-ficha">
        <button type="button" class="btn-favorito" data-favorito="{&quot;clave&quot;:&quot;abogacia&quot;,&quot;tipo&quot;:&quot;carrera&quot;,&quot;claveCarrera&quot;:&quot;abogacia&quot;,&quot;nombre&quot;:&quot;Abogacía&quot;,&quot;institucion&quot;:&quot;&quot;,&quot;area&quot;:&quot;Ciencias sociales&quot;,&quot;formacion&quot;:&quot;grado&quot;,&quot;ficha&quot;:&quot;abogacia&quot;,&quot;link&quot;:&quot;&quot;}" data-fav-clave="abogacia" data-fav-nombre="Abogacía" aria-pressed="false"></button>
        <a class="btn-ver-mi-lista" href="/?lista=1">Ver Mi lista</a>
        <button type="button" class="btn-favorito" data-fav-solo-icono data-favorito="{&quot;clave&quot;:&quot;medicina&quot;,&quot;tipo&quot;:&quot;carrera&quot;,&quot;claveCarrera&quot;:&quot;medicina&quot;,&quot;nombre&quot;:&quot;Medicina&quot;,&quot;institucion&quot;:&quot;&quot;,&quot;area&quot;:&quot;Salud&quot;,&quot;formacion&quot;:&quot;grado&quot;,&quot;ficha&quot;:&quot;medicina&quot;,&quot;link&quot;:&quot;&quot;}" data-fav-clave="medicina" data-fav-nombre="Medicina" aria-pressed="false"></button>
      </div>
      <div class="card-actions"><span id="otro"></span></div>
    </body></html>`, { url: 'http://localhost/carrera/abogacia/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;
    global.CustomEvent = dom.window.CustomEvent;
    global.Event = dom.window.Event;
    return dom;
}

(async () => {
    console.log('🧪 Iniciando test_favoritos...\n');
    const dom = construirDOM();

    // Sin eventos.js cargado (como en las páginas estáticas): no debe romper.
    dom.window.eval(fs.readFileSync(path.join(RAIZ, 'js/favoritos.js'), 'utf8'));
    const Favoritos = dom.window.Favoritos;

    // ---- 1. Contrato con el HTML generado ----
    console.log('1. Contrato con las páginas estáticas');
    const generado = fs.readFileSync(path.join(RAIZ, 'carrera', 'abogacia', 'index.html'), 'utf8');
    const etiqueta = generado.match(/<button type="button" class="btn-favorito"[^>]*>/);
    ok(Boolean(etiqueta), 'la página generada trae el botón "Me interesa"');
    const payloadGenerado = etiqueta[0].match(/data-favorito="([^"]*)"/);
    ok(Boolean(payloadGenerado), 'el botón generado trae data-favorito');
    const decodificado = payloadGenerado[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    let parsed = null;
    try { parsed = JSON.parse(decodificado); } catch (e) {}
    ok(parsed && parsed.clave === 'abogacia' && parsed.tipo === 'carrera', 'data-favorito es JSON válido con la clave de la carrera');
    ok(parsed && parsed.claveCarrera === 'abogacia', 'trae claveCarrera para la Fase B');
    ok(/src="\/js\/favoritos\.js\?v=/.test(generado), 'la página carga favoritos.js');
    ok(/data-fav-solo-icono/.test(generado), 'el botón de las estáticas pide el modo solo-ícono');
    ok(/class="btn-ver-mi-lista"/.test(generado), 'y trae "Ver Mi lista" como botón');

    // ---- 2. Hidratación y click ----
    console.log('2. Hidratación del botón vacío');
    const boton = document.querySelector('[data-favorito]');
    ok(!boton.querySelector('.fav-texto'), 'el botón del HTML nace vacío (sin ícono ni texto)');
    ok(Favoritos.tiene('abogacia') === false, 'todavía no está guardado');
    // La hidratación real ocurre al cargar el documento; en el test ya cargó,
    // así que forzamos la sincronización como hace el script al arrancar.
    Favoritos.sincronizarBotones();
    ok(Boolean(boton.querySelector('.fav-texto')) && boton.textContent.includes('Me interesa'), 'se hidrata con texto "Me interesa"');
    ok(Boolean(boton.querySelector('svg.fav-svg')), 'se hidrata con el corazón SVG');

    boton.click();
    ok(Favoritos.tiene('abogacia'), 'el click guarda');
    ok(boton.getAttribute('aria-pressed') === 'true', 'aria-pressed pasa a true');
    ok(boton.textContent.includes('Guardada'), 'el texto pasa a "Guardada"');
    ok(boton.getAttribute('aria-label').startsWith('Quitar'), 'el aria-label cambia a "Quitar…"');
    ok(boton.classList.contains('is-favorito'), 'queda la clase visual');
    const aviso = document.querySelector('.fav-toast');
    ok(aviso && aviso.classList.contains('is-visible'), 'aparece el aviso');
    ok(aviso.querySelector('[data-abrir-mi-lista]').getAttribute('href') === '/?lista=1', 'el aviso linkea a /?lista=1');

    // ---- 2b. Corazón solo-ícono (páginas estáticas) ----
    console.log('2b. Corazón solo-ícono');
    const corazon = document.querySelector('[data-fav-solo-icono]');
    Favoritos.sincronizarBotones();
    ok(Boolean(corazon.querySelector('svg.fav-svg')), 'se hidrata con el corazón');
    ok(!corazon.querySelector('.fav-texto'), 'no le agrega texto');
    ok(corazon.getAttribute('aria-label') === 'Guardar Medicina en Mi lista', 'el aria-label dice qué guarda');
    corazon.click();
    ok(corazon.classList.contains('is-favorito'), 'al marcar queda el estado rojo (clase is-favorito)');
    ok(corazon.getAttribute('aria-label') === 'Quitar Medicina de Mi lista', 'y el aria-label pasa a quitar');
    ok(!/Me interesa|Guardada/.test(corazon.textContent), 'el corazón nunca muestra texto');
    corazon.click();
    ok(!corazon.classList.contains('is-favorito'), 'el segundo click lo apaga');

    boton.click();
    ok(!Favoritos.tiene('abogacia'), 'el segundo click quita');
    ok(boton.getAttribute('aria-pressed') === 'false' && boton.textContent.includes('Me interesa'), 'el botón vuelve al estado inicial');

    // ---- 3. Snapshot y tope ----
    console.log('3. Storage y tope');
    Favoritos.toggle({ clave: 'a', tipo: 'curso', nombre: 'Curso A' });
    const guardado = JSON.parse(localStorage.getItem('ben-favoritos'));
    ok(guardado[0].fecha && guardado[0].nombre === 'Curso A', 'guarda el snapshot con fecha');
    for (let i = 0; i < 70; i++) Favoritos.toggle({ clave: 'c' + i, tipo: 'curso', nombre: 'Curso ' + i });
    ok(Favoritos.contar() === 60, `respeta el tope de 60 fichas (${Favoritos.contar()})`);

    Favoritos.vaciar();
    ok(Favoritos.contar() === 0, 'vaciar deja la lista en cero');

    localStorage.setItem('ben-favoritos', '{esto no es json');
    ok(Favoritos.contar() === 0, 'storage roto no rompe la lectura');
    localStorage.setItem('ben-favoritos', JSON.stringify([{ sinClave: true }, { clave: 'ok', nombre: 'Válida' }]));
    ok(Favoritos.contar() === 1, 'descarta entradas sin clave');
    Favoritos.vaciar();

    // ---- 4. Sincronización entre pestañas ----
    console.log('4. Sincronización');
    let avisos = 0;
    Favoritos.suscribir(() => { avisos++; });
    const evento = new dom.window.StorageEvent('storage', { key: 'ben-favoritos', newValue: '[]' });
    dom.window.dispatchEvent(evento);
    ok(avisos >= 1, 'el evento storage avisa a los suscriptores');

    // ---- 5. Fase B con perfil del test ----
    console.log('5. Fase B');
    localStorage.setItem('ben-vocacional-perfil', JSON.stringify({ riasec: { I: 7 }, apt: {}, val: {}, codigo: 'I' }));
    Favoritos.toggle({ clave: 'abogacia', tipo: 'carrera', claveCarrera: 'abogacia', nombre: 'Abogacía' });
    const eventos = JSON.parse(localStorage.getItem('ben-vocacional-eventos') || '[]');
    ok(eventos.length === 0, 'sin eventos.js cargado no inventa el registro (página estática)');

    dom.window.eval(fs.readFileSync(path.join(RAIZ, 'js/vocacional/eventos.js'), 'utf8'));
    Favoritos.toggle({ clave: 'medicina', tipo: 'carrera', claveCarrera: 'medicina', nombre: 'Medicina' });
    const eventos2 = JSON.parse(localStorage.getItem('ben-vocacional-eventos') || '[]');
    ok(eventos2.length === 1 && eventos2[0].claveCarrera === 'medicina', 'con eventos.js y perfil, registra el interés');

    console.log(`\n${fallos === 0 ? '✅' : '❌'} test_favoritos.js: ${aserciones} aserciones, ${fallos} fallo(s)`);
    process.exit(fallos ? 1 : 0);
})().catch(error => {
    console.error('❌ test_favoritos.js falló:', error);
    process.exit(1);
});
