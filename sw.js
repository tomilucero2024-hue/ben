// ==========================================
// 🛰️ SERVICE WORKER DE BEN
// ==========================================
//
// Por qué vive en la raíz:
// un service worker solo puede interceptar pedidos que estén DENTRO de su
// scope, y el scope no puede ser más ancho que la carpeta donde está el
// archivo. Estando en la raíz cubre todo el sitio de una: la app, los JSON de
// data/ y las páginas estáticas de /carrera/, /area/ e /institucion/.
//
// Todas las rutas se resuelven contra self.registration.scope, así que esto
// anda igual servido desde la raíz de un dominio que desde un subdirectorio
// (por ejemplo GitHub Pages en /usuario.github.io/repo/).

// ⚠️ Este sello tiene que moverse junto con los ?v=... de index.html. Es lo que
// hace que un usuario con la versión vieja cacheada reciba la nueva: al cambiar
// el nombre del caché, el activate de abajo borra todo lo anterior. Si se
// actualiza el HTML y no esto, el service worker sigue sirviendo lo viejo.
const VERSION = '20260923_14';
const CACHE = `ben-${VERSION}`;

// El esqueleto mínimo para que la app abra sin red.
// copiloto-icono.png entra a pesar de sus 550 KB porque es el ícono del botón
// flotante del Copiloto, que está siempre en pantalla: sin precachearlo se veía
// roto offline. El resto de las imágenes se cachean solas al usarse.
const SHELL = [
    './',
    'index.html',
    'style.css',
    'paginas.css',
    'manifest.json',
    'js/vocacional/motor.js',
    'js/vocacional/eventos.js',
    'js/vocacional/test-completo.js',
    'js/favoritos.js',
    'js/mi-lista.js',
    'js/accesibilidad.js',
    'js/feedback.js',
    'js/util.js',
    'js/datos.js',
    'js/estado.js',
    'js/filtros.js',
    'js/render.js',
    'js/copiloto.js',
    'js/autocompletado.js',
    'js/tutorial.js',
    'js/main.js',
    'favicon.png',
    'icon-192.png',
    'icon-512.png',
    'logo-ben-dark.png',
    'logo-ben-light.png',
    'img/copiloto-icono.png',
    'data/data.json',
    'data/vocacional/config.json',
    'data/vocacional/preguntas.json',
    'data/vocacional/perfiles-carreras.json',
    'data/enlaces-ben.json',
    'data/sectores.json',
    'data/sectores-carreras.json',
    'data/rubros-aparte.json'
];

const url = ruta => new URL(ruta, self.registration.scope).toString();

// Las rutas de las páginas estáticas del catálogo. Si el fetch falla, para
// estas NUNCA conviene devolver el shell de la app (index.html): le parece al
// usuario que el enlace "a las carreras de la facultad" lo devuelve a la página
// principal. Mejor un error de conexión claro que un falso redireccionamiento.
const RUTAS_ESTATICAS = ['/carrera/', '/carreras/', '/institucion/', '/instituciones/', '/area/', '/provincia/'];
function esRutaEstatica(destino) {
    return RUTAS_ESTATICAS.some(pre => destino.pathname.startsWith(pre));
}

self.addEventListener('install', evento => {
    evento.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        // De a uno y tolerando fallas: con cache.addAll(), un solo 404 aborta la
        // instalación entera y el usuario se queda sin service worker.
        await Promise.all(SHELL.map(async ruta => {
            try {
                await cache.add(new Request(url(ruta), { cache: 'reload' }));
            } catch (e) {
                console.warn('[SW] no pude precachear', ruta, e);
            }
        }));
        // Sin esto la versión nueva espera a que se cierren todas las pestañas.
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', evento => {
    evento.waitUntil((async () => {
        const nombres = await caches.keys();
        await Promise.all(nombres
            .filter(n => n.startsWith('ben-') && n !== CACHE)
            .map(n => caches.delete(n)));
        await self.clients.claim();
    })());
});

// Los ?v=... de index.html hacen que la URL pedida no sea igual a la
// precacheada. ignoreSearch hace que igual matcheen, así no hay que mantener
// los sellos duplicados en dos lugares.
const buscarEnCache = (cache, request) => cache.match(request, { ignoreSearch: true });

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE);
    const guardada = await buscarEnCache(cache, request);
    const red = fetch(request).then(respuesta => {
        if (respuesta && respuesta.ok) cache.put(request, respuesta.clone());
        return respuesta;
    }).catch(() => null);
    // Si hay copia, se devuelve al toque y la red se resuelve por detrás.
    return guardada || red.then(r => r || Response.error());
}

async function cachePrimero(request) {
    const cache = await caches.open(CACHE);
    const guardada = await buscarEnCache(cache, request);
    if (guardada) {
        fetch(request).then(r => { if (r && r.ok) cache.put(request, r.clone()); }).catch(() => {});
        return guardada;
    }
    try {
        const respuesta = await fetch(request);
        if (respuesta && respuesta.ok) cache.put(request, respuesta.clone());
        return respuesta;
    } catch (e) {
        return Response.error();
    }
}

async function redPrimero(request) {
    const cache = await caches.open(CACHE);
    try {
        const respuesta = await fetch(request);
        if (respuesta && respuesta.ok) {
            cache.put(request, respuesta.clone());
        }
        return respuesta;
    } catch (e) {
        const guardada = await buscarEnCache(cache, request);
        return guardada || Response.error();
    }
}

// Navegación con el comportamiento distinto según la ruta:
//  - app (/) o cualquier otra: red primero, con el shell cacheado como última
//    red de contención, para que la app siga abriendo sin conexión.
//  - páginas estáticas del catálogo: red primero CACHEANDO la ficha al visitarla,
//    y si la red falla se usa esa copia; sin copia, error del navegador en vez
//    del shell que parece "la página principal".
async function redPrimeroConFallback(request, destino) {
    const cache = await caches.open(CACHE);
    try {
        const respuesta = await fetch(request);
        if (respuesta && respuesta.ok) cache.put(request, respuesta.clone());
        return respuesta;
    } catch (e) {
        const guardada = await buscarEnCache(cache, request);
        if (guardada) return guardada;
        if (esRutaEstatica(destino)) return Response.error();
        return (await cache.match(url('index.html'))) || Response.error();
    }
}

self.addEventListener('fetch', evento => {
    const request = evento.request;
    if (request.method !== 'GET') return;

    const destino = new URL(request.url);
    // Lo de afuera (tipografías de Google) va derecho a la red: cachearlo acá
    // solo agregaría respuestas opacas que no se pueden inspeccionar.
    if (destino.origin !== self.location.origin) return;

    // Navegación: red primero para no dejar a nadie clavado en una versión
    // vieja, con index cacheado como red de contención si no hay conexión.
    // Para las rutas de las páginas estáticas el fallback NO es el shell:
    // ver esRutaEstatica. Al visitarlas en línea se cachean igual, así el
    // revisitar sin red sigue mostrando la ficha real.
    if (request.mode === 'navigate') {
        evento.respondWith(redPrimeroConFallback(request, destino));
        return;
    }

    // Los datos cambian cuando se vuelven a correr los scrapers: conviene
    // mostrar lo que hay al instante y refrescar por detrás.
    if (destino.pathname.includes('/data/') && destino.pathname.endsWith('.json')) {
        evento.respondWith(staleWhileRevalidate(request));
        return;
    }

    // CSS y JS con versionado (?v=...): red primero para ver cambios de código
    // de inmediato, con caché como respaldo offline.
    if (destino.pathname.endsWith('.css') || destino.pathname.endsWith('.js')) {
        evento.respondWith(redPrimero(request));
        return;
    }

    evento.respondWith(cachePrimero(request));
});
