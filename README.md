# BEN — Buscador Educativo Nacional

Sitio estático (HTML/CSS/JavaScript vanilla, sin frameworks ni build) que funciona como
buscador/catálogo de oferta educativa de Mendoza: universidades, IES/institutos superiores,
centros de formación y plataformas online. Su pieza central es el "Copiloto Vocacional": un
test de orientación que puntúa cada carrera contra el perfil de intereses de quien lo hace y
deja el resultado en la grilla, ordenado por compatibilidad y filtrable sin perder ese orden.

## Propósito

El fin de la aplicación es **facilitar que cada persona encuentre la carrera que más se adapta
a ella**. No es un catálogo para explorar por curiosidad: es una herramienta que tiene que
llevar a alguien que no sabe qué estudiar hasta una recomendación concreta.

De eso se desprenden tres criterios que mandan sobre cualquier decisión de diseño:

- **Interfaz limpia.** Menos elementos en pantalla, no más. Si algo no ayuda a decidir, sobra.
- **Fácil de usar y de entender.** Sin vocabulario técnico ni educativo que el visitante tenga
  que descifrar; que se entienda de una leída.
- **Paso a paso hasta la recomendación.** El recorrido ideal es guiado: una cosa a la vez,
  cada paso angosta el universo, y el final es una recomendación — no una grilla de resultados
  para que el usuario se arregle solo.

Ante la duda entre agregar una función y simplificar el camino a la recomendación, gana lo
segundo.

## Estructura

```
frontend/    el sitio: index.html, style.css, logos e íconos
  js/                la aplicación, en módulos ES (main.js es el punto de entrada)
    util.js            texto, clasificadores y escapado de HTML
    datos.js           carga de data.json y armado de ofertas/plataformas/catálogos
    estado.js          filtros, favoritos y comparador (localStorage + URL)
    filtros.js         búsqueda difusa, filtrado y orden
    render.js          todo lo que pinta HTML
    copiloto.js        chat, test vocacional y búsqueda por texto libre
    main.js            arranque y delegación de eventos
    orientador.js      motor de compatibilidad (script clásico, expone window.Orientador)
    accesibilidad.js   panel de accesibilidad (script clásico, autónomo)
    feedback.js        modal de sugerencias (script clásico, autónomo)
data/        los JSON generados (uno por institución) + los dos que consume el sitio:
             data.json (catálogo) y carreras-perfiles.json (perfiles del Copiloto)
scrapers/    los scripts Python que generan esos JSON
  scraper_utils.py   funciones compartidas por todos los scrapers
  unir_todo.py       consolida todo y encadena el resto del build
  plataforma.py      agrega las plataformas online a data.json
  fuentes/           páginas guardadas que algún scraper usa como entrada offline
  inactivos/         funciones dormidas (feed de novedades, centros deportivos).
                     Ver scrapers/inactivos/LEEME.md
generar-perfiles.js  calcula carreras-perfiles.json a partir de data.json
```

## Cómo levantar el sitio

El sitio usa `fetch()` para leer los JSON de `data/`, así que **no funciona abriendo
`index.html` con doble clic** (el navegador bloquea `fetch` sobre `file://`). Hay que servirlo
por HTTP, **desde la carpeta raíz del proyecto** (no desde dentro de `frontend/`, porque las
rutas suben a `../data/`):

```bash
python -m http.server 8000
```

y abrir `http://localhost:8000/frontend/`.

## Regenerar los datos

1. (Opcional) Correr los scrapers de las instituciones que quieras actualizar, por ejemplo
   `python scrapers/utn.py`. Requiere `pip install -r requirements.txt`.
2. Correr `python scrapers/unir_todo.py`. Es **el único comando que hace falta**: lee los
   JSON individuales que ya estén en `data/` (no hace falta volver a scrapear todo) y, en una
   sola pasada,

   1. regenera `data.json`,
   2. encadena `plataforma.py` para la sección `plataformas`,
   3. encadena `generar-perfiles.js` para regenerar `carreras-perfiles.json` (los perfiles
      del Copiloto Vocacional), y
   4. verifica que toda carrera con perfil exista en `data.json`.

   El paso 3 necesita Node.js en el PATH. Si no lo encuentra, avisa y sigue: `data.json` queda
   actualizado igual y los perfiles se regeneran después con `node generar-perfiles.js`.

   > Los perfiles se calculan **a partir de** `data.json`. Regenerar uno sin el otro deja al
   > Copiloto recomendando carreras viejas o ignorando las nuevas, y por eso van encadenados.

Los scripts resuelven sus rutas a partir de su propia ubicación, así que se pueden ejecutar
desde cualquier carpeta.

## Funciona sin conexión (PWA)

Hay un service worker en `sw.js` (en la **raíz**, no en `frontend/`) que precachea el
esqueleto del sitio y los dos JSON que consume, así que una vez visitado el sitio abre y
funciona completo sin internet: catálogo, filtros, favoritos y el test vocacional.

Vive en la raíz porque un service worker solo intercepta pedidos dentro de su scope, y el
scope no puede ser más ancho que la carpeta donde está el archivo. El sitio se sirve desde
`/frontend/` pero lee `../data/`: un `sw.js` dentro de `frontend/` dejaría los datos afuera,
que es justamente lo único sin lo cual la página no sirve.

Estrategias por tipo de pedido:

| Pedido | Estrategia | Por qué |
|---|---|---|
| Navegación (el HTML) | Red primero, caché de respaldo | Que nadie quede clavado en una versión vieja |
| `data/*.json` | Stale-while-revalidate | Se ve al instante y se refresca por detrás |
| CSS, JS, imágenes | Caché primero, revalida atrás | Llevan `?v=` y cambian solo con un deploy |
| Otros orígenes (tipografías) | Sin tocar | Cachearlos solo dejaría respuestas opacas |

> ⚠️ **Al hacer un cambio hay que mover DOS sellos, y tienen que quedar iguales:** el
> `const VERSION` de `sw.js` y los `?v=...` de `frontend/index.html`. Cambiar el nombre del
> caché es lo que dispara el borrado del anterior; si se actualiza el HTML y no el service
> worker, el usuario sigue recibiendo la versión vieja.

## Cómo está organizado un scraper

Cada institución tiene su propio script porque cada web es distinta, pero todo lo repetido vive
en `scrapers/scraper_utils.py`:

- `pedir_sopa(url)` — descarga una página y devuelve su BeautifulSoup (o `None` si falla).
- `carreras_guardadas("archivo.json")` — recupera lo ya guardado, para no perder datos si el
  sitio de la institución se cae.
- `guardar_json(datos, "archivo.json")` — **limpia todos los textos** y escribe el JSON en
  `data/`.
- `limpiar_texto(valor)` — saca tabulaciones, saltos de línea, espacios dobles, espacios duros
  y etiquetas pegadas del scraping (`"DURACIÓN\t\t\n 5 años"` → `"5 años"`).

La limpieza se aplica sola al guardar, así que cualquier scraper nuevo hereda ese comportamiento
con solo usar `guardar_json()`.

## Forma de `data.json`

Es lo que consume el frontend; si cambia, hay que tocar `frontend/js/datos.js`:

```json
{
  "instituciones": [
    { "id": 1, "nombre": "...", "carreras": [
        { "id": 1, "nombre_carrera": "...", "categoria": "...", "duracion": "...",
          "modalidad": "...", "facultad": "...", "link_oficial": "..." } ] } ],
  "plataformas": [ { "institucion": "...", "modalidad": "...", "oferta": "...", "duracion": "..." } ]
}
```
