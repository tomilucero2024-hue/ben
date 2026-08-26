# Funciones dormidas

Acá viven las piezas de dos funciones que **el sitio no muestra**: el feed de
novedades y la vista de centros deportivos. No están borradas porque los datos
costaron scrapearse, pero tampoco están en el pipeline ni en el frontend.

| Archivo | Qué es | Estado |
|---|---|---|
| `noticias.py` | Scraper del feed de novedades. Genera `noticias.json`. | Sin consumidor: nada en `frontend/` lee ese archivo. |
| `noticias.json` | 240 noticias ya scrapeadas. | Datos, sin uso. |
| `deporte.json` | 18 centros deportivos (clave `centros_deportivos`). | Datos, sin uso **y sin scraper que los genere**. |

El CSS que acompañaba a estas vistas (`.news-*`, `.sports-*`) también se sacó de
`frontend/style.css`, así que reactivarlas implica reescribirlo.

## Por qué están acá y no en el sitio

El criterio del README manda: *"Interfaz limpia. Menos elementos en pantalla, no
más. Si algo no ayuda a decidir, sobra."* Un feed de novedades y un listado de
gimnasios no acercan a nadie a elegir qué estudiar, que es el fin declarado de la
aplicación. Mientras tanto el README las describía como si existieran, lo que
mandaba a cualquiera que leyera el proyecto a buscar código que no estaba.

## Para reactivar alguna

1. Mover el `.json` de vuelta a `data/` (y el `.py` a `scrapers/`, si aplica).
2. Sumarlo a `unir_todo.py`: como tupla en `ARCHIVOS_SIMPLES` si su forma es
   `{"instituciones": [...]}`, o en `GRUPOS_APARTE` si es una clave propia.
   Ojo: `noticias.json` y `deporte.json` **no** tienen forma de institución, así
   que van con clave propia y necesitan su vista aparte en el frontend.
3. Agregar la sección en `frontend/index.html`, su render en
   `frontend/js/render.js` y su entrada en `catalogosAparte` (`js/datos.js`).
4. Reescribir los estilos que se sacaron.

> `depor.py` NO está acá: sigue activo en `scrapers/`. A pesar del nombre no tiene
> nada que ver con `deporte.json` — genera `epd.json`, la Escuela de Periodismo
> Deportivo, que sí entra al catálogo.
