const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// ==========================================
// 📊 ANALÍTICA (Google Analytics 4)
// ==========================================
//
// Lo que se verifica acá es lo que no se ve en la pantalla: que los eventos que
// anuncia el resto del sitio lleguen al dataLayer con el nombre y los
// parámetros que GA4 no descarta, y que con el ID sin configurar no salga ni un
// pedido a Google.
//
// Se corre el archivo REAL (js/analitica.js), no una copia: es un script
// clásico y se autoinstala, así que basta con evaluarlo dentro de una ventana.
// Para cada caso se crea una ventana nueva, porque el script solo se ejecuta
// una vez por página.

const RAIZ = __dirname;
const CODIGO = fs.readFileSync(path.join(RAIZ, 'js/analitica.js'), 'utf8');

let aserciones = 0;
let fallos = 0;
function check(condicion, mensaje) {
    if (condicion) {
        aserciones++;
        console.log('  ✓ ' + mensaje);
    } else {
        fallos++;
        console.log('  ✗ ' + mensaje);
    }
}

// Levanta una página con analitica.js ejecutado dentro. Devuelve la ventana, el
// dataLayer (con el gtag stub que la librería real reemplaza) y la lista de
// URLs que el <head> pidió (para ver si se intentó cargar gtag.js).
function pagina({ url = 'https://buscadoreducativo.com.ar/carrera/medicina/', id = 'G-TEST12345', dnt = null, html = '' } = {}) {
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`, {
        url,
        runScripts: 'outside-only'
    });
    const { window } = dom;
    window.navigator.doNotTrack = dnt === null ? '0' : dnt;
    if (dnt) window.doNotTrack = dnt;

    const pedidos = [];
    const original = window.document.head.appendChild.bind(window.document.head);
    window.document.head.appendChild = nodo => {
        if (nodo && nodo.tagName === 'SCRIPT' && nodo.src) pedidos.push(nodo.src);
        return original(nodo);
    };

    // El gtag real no está en Node: se reemplaza por uno que anota lo que se le
    // pide, que es exactamente lo que GA4 recibiría. El ID también se cambia
    // por uno de mentira para no mandar nada a la propiedad real al correr los
    // tests.
    window.eval(CODIGO.replace(/const MEDICION = '[^']*';/, `const MEDICION = '${id}';`));
    return { window, dataLayer: window.dataLayer || [], pedidos };
}

function eventos(dataLayer, tipo) {
    return dataLayer.filter(e => e[0] === 'event' && e[1] === tipo);
}

console.log('\n1. Con el ID configurado');
{
    const { window, dataLayer, pedidos } = pagina();

    check(pedidos.length === 1 && /googletagmanager\.com\/gtag\/js\?id=G-TEST12345/.test(pedidos[0]),
        'gtag.js se pide una sola vez, con el ID del archivo');
    check(dataLayer.some(e => e[0] === 'config' && e[1] === 'G-TEST12345' && e[2].send_page_view === true),
        'el pageview se encola apenas se ejecuta el archivo (send_page_view)');

    // El puente: lo que anuncia el resto del sitio con 'ben:evento'.
    window.dispatchEvent(new window.CustomEvent('ben:evento', {
        detail: { tipo: 'favorito', accion: 'agregado', nombre: 'Medicina', area: 'Salud' }
    }));
    const favorito = eventos(dataLayer, 'favorito');
    check(favorito.length === 1 && favorito[0][2].accion === 'agregado' && favorito[0][2].nombre === 'Medicina',
        'un evento ben:evento sale como evento de GA4 con sus parámetros');
    check(favorito[0][2].tipo === undefined, 'el nombre del evento no viaja como parámetro');

    // El evento con prefijo `search` es el que GA4 reconoce: tiene que llevar el
    // parámetro `search_term`, si no el informe de búsquedas queda vacío.
    window.dispatchEvent(new window.CustomEvent('ben:evento', {
        detail: { tipo: 'search', search_term: 'enfermería', seccion: 'formal', via: 'buscador' }
    }));
    check(eventos(dataLayer, 'search').length === 1, 'una búsqueda llega como evento search');

    // Escribir "enfer" dispara un evento por palabra tipeada (el buscador
    // espera 200 ms entre tecla y tecla). Al informe le interesa la búsqueda
    // terminada, no cada letra.
    window.dispatchEvent(new window.CustomEvent('ben:evento', { detail: { tipo: 'search', search_term: 'enfermería' } }));
    window.dispatchEvent(new window.CustomEvent('ben:evento', { detail: { tipo: 'search', search_term: 'enfermería ' } }));
    check(eventos(dataLayer, 'search').length === 1, 'la búsqueda repetida no se manda dos veces');
    window.dispatchEvent(new window.CustomEvent('ben:evento', { detail: { tipo: 'search', search_term: 'enfer' } }));
    check(eventos(dataLayer, 'search').length === 2, 'una búsqueda distinta sí se manda');
}

console.log('\n2. Salidas hacia el sitio de la institución');
{
    const { window, dataLayer } = pagina({
        html: '<a id="oficial" href="https://www.uncuyo.edu.ar/estudios/medicina">Sitio oficial</a>' +
              '<a id="propia" href="/carrera/medicina/">Ver ficha</a>' +
              '<a id="ancla" href="#plan">Plan</a>'
    });

    window.document.getElementById('oficial').click();
    const salidas = eventos(dataLayer, 'salir');
    check(salidas.length === 1 && salidas[0][2].host === 'www.uncuyo.edu.ar', 'el clic en un link externo se mide como salida');
    check(salidas[0][2].url === 'https://www.uncuyo.edu.ar/estudios/medicina', 'y se guarda la URL de destino');

    window.document.getElementById('propia').click();
    window.document.getElementById('ancla').click();
    check(eventos(dataLayer, 'salir').length === 1, 'los links internos (ficha propia, ancla) no cuentan como salida');
}

console.log('\n3. Parámetros que GA4 no acepta');
{
    const { window, dataLayer } = pagina();
    // Un nombre con guion o con tilde hace que GA4 descarte el parámetro
    // entero: mejor perder ese dato que perder el evento con todos los demás.
    window.benTrack('filtro', { 'departamento-selected': 'Godoy Cruz', área: 'Salud', valor: 'x'.repeat(300) });
    const filtro = eventos(dataLayer, 'filtro')[0][2];
    check(filtro['departamento-selected'] === undefined && filtro.area === undefined, 'los nombres de parámetro inválidos se descartan');
    check(filtro.valor.length === 100, 'los valores largos se cortan a 100 caracteres');

    window.benTrack('mi_lista', { total: 3, pantalla: 'lista', vacio: null, nada: undefined });
    const lista = eventos(dataLayer, 'mi_lista')[0][2];
    check(lista.total === 3 && lista.pantalla === 'lista', 'los números y las cadenas llegan tal cual');
    check(lista.vacio === undefined && lista.nada === undefined, 'los valores vacíos no viajan');
}

console.log('\n4. Fallas que nadie previó (listener global)');
{
    const { window, dataLayer } = pagina();
    const falla = eventos(dataLayer, 'error');

    // Un TypeError de verdad: es el caso más común y el que hay que poder leer.
    window.dispatchEvent(new window.ErrorEvent('error', {
        message: 'x is not a function', filename: 'https://buscadoreducativo.com.ar/js/render.js', lineno: 120
    }));
    check(eventos(dataLayer, 'error').length === 1, 'un error no atrapado sale como evento error');
    const primerError = eventos(dataLayer, 'error')[0][2];
    check(primerError.tipo === 'js' && primerError.donde === 'render', 'el evento dice qué tipo de fallo es y en qué archivo');
    check(primerError.mensaje === 'x is not a function', 'y trae el mensaje, que es lo único que sirve para arreglarlo');

    // Lo que no se puede mandar: un error de red puede llevar adentro la URL que
    // la persona estaba mirando, con lo que escribió en ella.
    window.dispatchEvent(new window.ErrorEvent('error', {
        message: 'Failed to fetch https://buscadoreducativo.com.ar/data/data.json?q=enfermeria&correo=ana@mail.com',
        filename: 'https://buscadoreducativo.com.ar/js/datos.js'
    }));
    const saneado = eventos(dataLayer, 'error')[1][2].mensaje;
    check(!saneado.includes('enfermeria') && !saneado.includes('ana@mail.com'),
        'al error se le saca el query string: lo que la persona escribió no sale');
    check(saneado.includes('data/data.json'), 'pero el archivo que falló sí se puede ver');

    // Un mismo error en bucle no puede inflar el informe.
    for (let i = 0; i < 40; i++) {
        window.dispatchEvent(new window.ErrorEvent('error', {
            message: 'x is not a function', filename: 'https://buscadoreducativo.com.ar/js/render.js'
        }));
    }
    check(eventos(dataLayer, 'error').length === 2, 'el mismo error repetido no se manda 40 veces');

    // Un rechazo de promesa sin catch es la forma más común de romperse en silencio.
    window.dispatchEvent(Object.assign(new window.Event('unhandledrejection'),
        { reason: new Error('No se pudo calcular') }));
    const tipos = eventos(dataLayer, 'error').map(e => e[2].tipo);
    check(tipos.includes('rechazo'), 'una promesa rechazada y sin catch también se mide');

    // Y el tope, para que una página rota no mande 200 eventos distintos.
    for (let i = 0; i < 20; i++) {
        window.dispatchEvent(new window.ErrorEvent('error', {
            message: 'fallo distinto ' + i, filename: 'https://buscadoreducativo.com.ar/js/main.js'
        }));
    }
    check(eventos(dataLayer, 'error').length <= 5, 'hay un tope de errores distintos por sesión');
}

console.log('\n5. Los dos errores que el sitio ya anticipa');
{
    // Van con nombre propio y no dentro del 'error' genérico: en GA4 cada
    // nombre de evento es una fila del informe, y hay que poder ver "hoy
    // salieron 3 test_falla" sin abrir Explorar.
    const test = fs.readFileSync(path.join(RAIZ, 'js/vocacional/test-completo.js'), 'utf8');
    check(/avisarEvento\('test_falla'/.test(test) || /registrarEvento\('test_falla'/.test(test),
        'el test avisa test_falla cuando no puede calcular el resultado');

    const datos = fs.readFileSync(path.join(RAIZ, 'js/datos.js'), 'utf8');
    check(/registrarEvento\('datos_no_cargan'/.test(datos), 'la carga de datos avisa datos_no_cargan si falla');
    check(/import \{ registrarEvento \} from '\.\/medicion\.js'/.test(datos), 'y datos.js importa el helper para poder avisar');
}

console.log('\n5b. Los drivers del test (hacia dónde se orienta la gente)');
{
    // La analítica no publica ni una respuesta: publica las 3 etiquetas que
    // resumen hacia dónde se orienta la persona, y que son las mismas que ve
    // en pantalla. El helper vive en el motor, que es donde está el match.
    const motor = fs.readFileSync(path.join(RAIZ, 'js/vocacional/motor.js'), 'utf8');
    check(/function driversDelMatch\(/.test(motor), 'el motor calcula los drivers del match');
    check(/driversDelMatch, alertasTension/.test(motor), 'y lo expone para que el test lo use');

    const test = fs.readFileSync(path.join(RAIZ, 'js/vocacional/test-completo.js'), 'utf8');
    check(/\.\.\.window\.Vocacional\.driversDelMatch\(ranking\)/.test(test),
        'el evento completar del test manda los drivers junto al código del perfil');
    check(!/driver[^\n]*perfil\.respuestas|respuestas[^\n]*driver/i.test(test),
        'y nunca manda las respuestas crudas');
}

console.log('\n6. Con el ID sin configurar (así se comporta el archivo antes de pegarlo)');
{
    // Se fuerza el placeholder para probar ese camino aunque el repo ya tenga el
    // ID real puesto: si algún día se borra, el sitio tiene que seguir
    // funcionando en silencio en vez de mandarle datos a un ID inexistente.
    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
        url: 'https://buscadoreducativo.com.ar/',
        runScripts: 'outside-only'
    });
    const pedidos = [];
    const original = dom.window.document.head.appendChild.bind(dom.window.document.head);
    dom.window.document.head.appendChild = nodo => {
        if (nodo && nodo.tagName === 'SCRIPT' && nodo.src) pedidos.push(nodo.src);
        return original(nodo);
    };
    dom.window.eval(CODIGO.replace(/const MEDICION = '[^']*';/, "const MEDICION = 'G-PORDEFINIR';"));

    check(pedidos.length === 0, 'con el placeholder no se pide gtag.js: el sitio no habla con Google');
    check(!dom.window.dataLayer, 'ni se crea el dataLayer');

    // La app y las páginas estáticas avisan igual, sin romperse.
    dom.window.dispatchEvent(new dom.window.CustomEvent('ben:evento', { detail: { tipo: 'favorito', accion: 'agregado' } }));
    dom.window.benTrack('search', { search_term: 'enfermería' });
    check(true, 'los avisos del sitio son inocuos con la analítica apagada');
    check(typeof dom.window.benTrack === 'function', 'window.benTrack existe igual, para que nadie tenga que preguntar si la analítica está viva');
}

console.log('\n7. El archivo del repo tiene un ID real');
{
    const id = (CODIGO.match(/const MEDICION = '([^']*)'/) || [])[1] || '';
    check(/^G-[A-Z0-9]{10}$/.test(id), `js/analitica.js tiene un ID de medición con formato G-XXXXXXXXXX (${id})`);
}

console.log('\n8. Respetar "No quiero ser rastreado" y el apagado manual');
{
    const { dataLayer, pedidos } = pagina({ dnt: '1' });
    check(pedidos.length === 0 && dataLayer.length === 0, 'con DNT activado no se mide nada');
}
{
    const { window, dataLayer } = pagina({ url: 'https://buscadoreducativo.com.ar/?sin-analitica' });
    check(dataLayer.length === 0, 'con ?sin-analitica en la URL no se mide nada');
    window.benTrack('salir', { host: 'ejemplo.com' });
    check(dataLayer.length === 0, 'y tampoco los eventos que llegan después');
}

console.log('\n9. El archivo está en todas las páginas');
{
    const index = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    check(/<script src="\/js\/analitica\.js\?v=[\w-]+"><\/script>/.test(index), 'index.html carga js/analitica.js');

    const ficha = fs.readFileSync(path.join(RAIZ, 'carrera/medicina/index.html'), 'utf8');
    check(/<script src="\/js\/analitica\.js\?v=[\w-]+"><\/script>/.test(ficha), 'las fichas estáticas generadas también');

    const error = fs.readFileSync(path.join(RAIZ, '404.html'), 'utf8');
    check(/js\/analitica\.js/.test(error), 'y el 404, que es donde se ve si alguien llega a una dirección vieja');

    const shell = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
    check(/'js\/analitica\.js'/.test(shell), 'el service worker lo precachea en el shell (igual que favoritos.js)');

    // El service worker no debe_cachear los pedidos a Google: si los guardara,
    // se seguirían mandando los datos de una visita anterior.
    check(/destino\.origin !== self\.location\.origin\) return;/.test(shell),
        'el service worker deja pasar los pedidos a otros orígenes (gtag.js)');
}

console.log(fallos ? `\n❌ test_analitica.js: ${fallos} fallo(s) de ${aserciones + fallos} aserciones` : `\n✅ test_analitica.js: ${aserciones} aserciones, 0 fallo(s)`);
process.exit(fallos ? 1 : 0);
