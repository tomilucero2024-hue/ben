# BEN — Buscador Educativo Nacional

Sitio estático (HTML/CSS/JavaScript vanilla, sin frameworks) que funciona como
buscador/catálogo de oferta educativa: universidades, IES/institutos superiores, centros de
formación y plataformas online. Hoy el catálogo es de Mendoza; el alcance previsto es
nacional, y por eso ni las rutas ni los textos se atan a una provincia. Su pieza central es el
"Test Vocacional Completo": 65 preguntas que arman el perfil de la persona (intereses RIASEC,
aptitudes y valores), lo cruzan contra las 651 carreras del catálogo y dejan el resultado en la
grilla, ordenado por afinidad y filtrable sin perder ese orden. Alrededor hay un "Copiloto"
(chat de búsqueda) y "Mi lista", el apartado donde se guardan las carreras que interesan y se
comparan de a tres.

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

El sitio se sirve **desde la raíz del repositorio**: `index.html` de la raíz *es* la
aplicación. (Antes vivía en `frontend/` y la raíz era un redirect; `frontend/` se
eliminó: era un puente para enlaces viejos que ya solo armaba rebotes.)

```
index.html   la aplicación
style.css    estilos de la aplicación
paginas.css  estilos de las páginas estáticas (mucho más liviano, ver más abajo)
  js/                la aplicación, en módulos ES (main.js es el punto de entrada)
    util.js            texto, clasificadores y escapado de HTML
    datos.js           carga de data.json y armado de ofertas/plataformas/catálogos
    estado.js          filtros, búsqueda y estado (persistido en la URL)
    filtros.js         búsqueda difusa, filtrado y orden
    render.js          todo lo que pinta HTML
    copiloto.js        chat de búsqueda por texto libre (deriva al test completo)
    autocompletado.js  sugerencias en vivo al escribir en el buscador
    main.js            arranque y delegación de eventos
    favoritos.js       "Me interesa" + Mi lista: storage y botones (script clásico,
                       también corre en las páginas estáticas)
    mi-lista.js        ventana de Mi lista y comparador de carreras
    vocacional/        Test Vocacional Completo
      motor.js           banco de preguntas → perfil (RIASEC + aptitudes + valores) → ranking
      test-completo.js   ventana flotante: intro, tandas de preguntas, resultados
      eventos.js         registro de uso (localStorage + endpoint opcional) para la Fase B
    accesibilidad.js   panel de accesibilidad (script clásico, autónomo)
    feedback.js        modal de sugerencias (script clásico, autónomo)
data/        los JSON generados (uno por institución) + los que consume el sitio:
             data.json (catálogo) y enlaces-ben.json (slugs de las fichas)
             rubros-aparte.json (curado a mano): rubros de Formaciones Alternativas
             y Oficios Técnicos, con el orden de los grupos y la clasificación de
             cada curso. Sin este archivo, esas secciones se ven en grilla plana.
  vocacional/  datos del Test Vocacional Completo (editables sin tocar código):
               preguntas.json (banco de 65), areas-base.json, ajustes-palabras.json,
               config.json, perfiles-carreras.json (generado), perfiles-uso.json (Fase B)
scrapers/    los scripts Python que generan esos JSON
  scraper_utils.py   funciones compartidas por todos los scrapers
  unir_todo.py       consolida todo y encadena el resto del build
  plataforma.py      agrega las plataformas online a data.json
  fuentes/           páginas guardadas que algún scraper usa como entrada offline
  inactivos/         funciones dormidas (feed de novedades, centros deportivos).
                     Ver scrapers/inactivos/LEEME.md
generar-perfiles-vocacional.js  calcula data/vocacional/perfiles-carreras.json
                                (área base + palabras clave + afinado por uso)
generar-perfiles-uso.js  job de la Fase B: convierte eventos de uso en perfiles-uso.json
generar-paginas.js   genera las ~650 páginas estáticas para buscadores

carrera/  area/  institucion/  provincia/  carreras/  instituciones/
             GENERADAS. Se borran y se rehacen enteras en cada build:
             no editar nada ahí adentro. Lo mismo sitemap.xml y robots.txt.
```

## Cómo levantar el sitio

El sitio usa `fetch()` para leer los JSON de `data/`, así que **no funciona abriendo
`index.html` con doble clic** (el navegador bloquea `fetch` sobre `file://`). Hay que servirlo
por HTTP **desde la carpeta raíz del proyecto**: todas las rutas del sitio (`/data/...`,
`/js/...`, `/carrera/...`) arrancan en la raíz del dominio.

```bash
python -m http.server 8010
```

y abrir `http://localhost:8010/`.

## Tests

La suite se corre con Node y no necesita nada más allá de `npm install` (jsdom):

```bash
node test_general.js          # salud general: imports/exports, sello de caché, catálogos, render, SW y smoke HTTP
node test_contenido.js        # contenido de las descripciones de carrera (largo, tono y términos excluidos)
node test_titulos.js          # guía de títulos y niveles (/titulos/): datos, anclas, banner y aviso de costos
node test_rubros.js           # rubros de los catálogos aparte: cobertura del mapa y render agrupado
node test_arranque.js         # smoke de arranque real: index.html + main.js en jsdom (grilla, Mi lista, copiloto)
node test-flow.js             # flujo completo de la app en jsdom (búsqueda, filtros, copiloto)
node test_instituciones.js    # vista de instituciones (agrupadas por tipo)
node test_switcher.js         # conmutador de vistas Carreras / Instituciones / Por área
node test_vocacional.js       # Test Vocacional Completo: datos, perfiles generados, match y asertividad
node test_vocacional_ui.js    # recorrido de la ventana del Test Completo en jsdom
node test_favoritos.js        # "Me interesa": storage, botones de las páginas estáticas y Fase B
node test_mi_lista.js         # Mi lista y comparador: altas, selección, tabla y diferencias
node test_accesibilidad.js    # WCAG 2.1 AA: estructura/ARIA, foco, contraste por tema y áreas táctiles
```

`test_general.js` detecta, entre otras cosas, **imports que no se resuelven** entre módulos
(rompen la app entera en el navegador y `node --check` no los ve porque valida archivo por
archivo) y que el **sello de caché** esté sincronizado entre `index.html`, `sw.js` y las
páginas generadas.

> Las rutas son absolutas a propósito. El service worker, cuando no hay red, contesta
> cualquier navegación con el `index.html` cacheado; si alguien está en `/carrera/medicina/`
> y se le corta la conexión, la app se dibuja en *esa* dirección y con rutas relativas iría a
> buscar `/carrera/medicina/js/main.js`, que no existe.

## Accesibilidad (WCAG 2.1 AA)

El sitio apunta a **WCAG 2.1 AA** en las cuatro capas: perceptible, operable,
comprensible y robusto. El panel flotante de accesibilidad cubre baja visión y
dificultad de lectura (tamaño de texto, alto contraste, lector por voz, lectura
fácil, destacar enlaces); el resto de los criterios se resolvió en el código:

- **Teclado**: skip links "Saltar a los filtros" y "Saltar a los resultados" en
  la app (el destino lleva `tabindex="-1"` para que el foco viaje de verdad) y
  "Saltar al contenido" en las 566 fichas estáticas. Anillo de foco visible en
  todo el sitio (`:focus-visible`, ≥3:1). Trampas de foco en los diálogos (test,
  Mi lista, sugerencias, panel de accesibilidad) con devolución del foco al
  control que los abrió.
- **Lector de pantalla**: HTML semántico (un `h1`, jerarquía sin saltos,
  `role="search"`, listas reales `<ul>/<li>` para las tarjetas), `aria-pressed`
  en los filtros y las vistas, grupos de filtros con nombre, combobox válido en
  el autocompletado (`aria-activedescendant` + `aria-selected`, sin controles
  anidados), `role="status"` en el contador de resultados y en el anuncio de
  cada tanda del test, `progressbar` con `aria-valuenow`/`valuetext`,
  `role="alert"` + `aria-describedby` en los errores del formulario.
- **Contraste**: los colores se miden con umbrales WCAG en los cuatro estados de
  tema (claro/oscuro × alto contraste). Los pares críticos (acción sólida,
  badges de compatibilidad y tipo, bordes de campos, tintes de pestaña activa)
  pasan 4.5:1 de texto y 3:1 de elementos no textuales. El token
  `--control-line` existe solo para la frontera de los campos de formulario.
- **Discapacidad motriz**: áreas táctiles ≥24px (44px en puntero grueso), sin
  gestos complejos, sin límites de tiempo.
- **Cognitivo**: el Test Vocacional guarda el avance respuesta por respuesta
  (`ben-vocacional-progreso`) y ofrece retomarlo desde la intro; los errores del
  formulario dicen qué pasó y cómo corregirlo.

`test_accesibilidad.js` es la red de seguridad: corre la app en jsdom y verifica
estructura, ARIA, foco, contraste calculado sobre los tokens y áreas táctiles,
además de auditar cuatro fichas estáticas generadas. Lo que **no** puede cubrir
un test automatizado (queda como guion manual): Tab real en el navegador, zoom
al 200%, y NVDA/JAWS/VoiceOver. Guion de 10 pasos:

1. Cargar `/`: el foco arranca en "Orientador vocacional"; Tab recorre solo la
   portada y el botón de accesibilidad (el catálogo y el pie están inert).
2. Tab hasta el primer skip link, Enter: el foco cae en el panel de filtros.
3. Segundo skip link, Enter: el foco cae en la grilla de resultados.
4. Buscar "abogacía" con el teclado; con flechas bajar por las sugerencias y
   elegir con Enter (Esc cierra el listbox).
5. Aplicar un filtro con Enter y oír/ver el resumen nuevo en el contador.
6. Abrir una ficha con Tab + Enter; volver con el botón Atrás del navegador.
7. Abrir "Mi lista" con el corazón de una tarjeta: el foco entra en la ventana y
   Escape la cierra devolviendo el foco a la tarjeta.
8. Abrir el test con el Copiloto, responder una tanda con Tab + Espacio y cerrar
   con Escape; volver a abrirlo y elegir "Seguir donde quedé".
9. Enviar el formulario de sugerencias vacío: el lector anuncia el error y el
   foco queda en el campo.
10. Zoom del navegador al 200%: nada se corta ni aparece scroll horizontal; con
    el panel de accesibilidad, "A++" y "Alto contraste" siguen funcionando.

## Test Vocacional Completo (beta)

Una ventana flotante con 65 preguntas en 3 partes
(36 de intereses RIASEC + 15 de aptitudes + 14 de valores y contexto), que calcula un perfil
numérico del estudiante y lo cruza contra el perfil de las 651 carreras del catálogo.

- **Nada se cura a mano.** El perfil del estudiante sale de las respuestas (cada pregunta
  pesa hacia una o más dimensiones, y ese peso vive en `data/vocacional/preguntas.json`).
  El perfil de cada carrera sale de `areas-base.json` (perfil típico del área) + los ajustes
  por palabra clave de `ajustes-palabras.json` + el tipo de formación. Una carrera nueva
  queda perfilada sola en el próximo build.
- **Match**: distancia normalizada entre perfiles (100% = idénticos, con techo de 97%).
  Se descartó el coseno porque amontonaba cientos de carreras en 90-95%. Los pesos de
  RIASEC / aptitudes / valores y el techo se ajustan en `config.json`.
- **Aprendizaje por uso (Fase B)**: cada interacción con una carrera desde los resultados
  registra el perfil del estudiante (`js/vocacional/eventos.js`, hoy en localStorage).
  Con `node generar-perfiles-uso.js [eventos.json]` se obtiene el promedio por carrera, y
  `generar-perfiles-vocacional.js` lo mezcla con
  `peso_uso = min(interacciones / 50, 0.8)` (constantes en `config.json`): cuanto más uso,
  más pesa el promedio real, pero nunca reemplaza del todo al perfil inicial.
- **Resultados**: 8 carreras con % y explicación, resumen del perfil en lenguaje simple,
  alertas de tensión (intereses vs. valores vs. presión externa) y un botón para volcar el
  ranking a la grilla del sitio, donde siguen funcionando los filtros de siempre.
- **Se entra** desde la tarjeta "Orientador vocacional" de la bienvenida (que abre el chat del
  Copiloto y desde ahí se arranca el test), desde el propio chat o con el enlace directo
  `/?test=1`, que es el que usan las páginas estáticas de carrera. La portada no menciona la
  cantidad de preguntas a propósito.

## Mi lista y comparador

El corazón **"Me interesa"** está en todas las tarjetas (grilla, recomendaciones del test,
cursos, oficios, plataformas y páginas estáticas de carrera) y guarda la ficha en
`localStorage['ben-favoritos']`. En la grilla formal se guarda **la oferta puntual** (carrera +
institución): así se puede guardar la misma carrera en dos instituciones y comparar dónde
estudiarla.

- **Dónde se ve**: botón "Mi lista (N)" en la barra de resultados (o `/?lista=1` desde las
  páginas estáticas). La ventana lista las fichas agrupadas por tipo, con ficha, quitar y
  selección múltiple.
- **Comparador**: hasta 3 fichas, en columnas, con afinidad al perfil del test (si lo hizo),
  intereses RIASEC, área, duración, modalidad, costo, dónde se cursa, instituciones con link,
  plan de estudios y links. Abajo, un resumen automático de **"en qué se diferencian"**, más
  "Copiar" e "Imprimir / PDF" para llevarlo a la familia o al colegio.
- **Una sola definición del botón**: `js/favoritos.js` es un script clásico que se autoinstala
  (delegación de clic en `[data-favorito]`) y lo cargan tanto la app como las ~650 páginas
  estáticas generadas, que emiten el botón "vacío" y dejan que el script lo hidrate y
  sincronice. Si una carrera guardada ya no está en el catálogo, Mi lista lo dice y ofrece
  quitarla en vez de romperse.
- **Fase B**: si la persona hizo el test, marcar "Me interesa" también registra el evento de
  uso (igual que el botón dentro del test), así el promedio real de interés alimenta los
  perfiles de carrera del próximo build.

## Regenerar los datos

1. (Opcional) Correr los scrapers de las instituciones que quieras actualizar, por ejemplo
   `python scrapers/utn.py`. Requiere `pip install -r requirements.txt`.
2. Correr `python scrapers/unir_todo.py`. Es **el único comando que hace falta**: lee los
   JSON individuales que ya estén en `data/` (no hace falta volver a scrapear todo) y, en una
   sola pasada,

   1. regenera `data.json`,
   2. encadena `plataforma.py` para la sección `plataformas`,
   3. encadena `generar-perfiles-vocacional.js` para regenerar
      `data/vocacional/perfiles-carreras.json` (los perfiles que usan el test y las
      páginas estáticas),
   4. verifica que toda carrera con perfil exista en `data.json`, y
   5. encadena `generar-paginas.js` para rehacer las ~650 páginas estáticas.

   Los pasos 3 y 5 necesitan Node.js en el PATH. Si no lo encuentra, avisa y sigue:
   `data.json` queda actualizado igual y después se corren a mano con
   `node generar-perfiles-vocacional.js` y `node generar-paginas.js`.

   El build es **idempotente**: correrlo dos veces seguidas produce archivos byte a byte
   idénticos, así que un `git status` limpio después de un build significa que no cambió nada
   de verdad.

   > Los perfiles se calculan **a partir de** `data.json`. Regenerar uno sin el otro deja al
   > test recomendando carreras viejas o ignorando las nuevas, y por eso van encadenados.

Los scripts resuelven sus rutas a partir de su propia ubicación, así que se pueden ejecutar
desde cualquier carpeta.

## Funciona sin conexión (PWA)

Hay un service worker en `sw.js` (en la **raíz**) que precachea el esqueleto del sitio y los
dos JSON que consume, así que una vez visitado el sitio abre y funciona completo sin internet:
catálogo, filtros y el test vocacional.

Vive en la raíz porque un service worker solo intercepta pedidos dentro de su scope, y el
scope no puede ser más ancho que la carpeta donde está el archivo. Desde la raíz cubre todo:
la app, los JSON de `data/` y las páginas estáticas.

Estrategias por tipo de pedido:

| Pedido | Estrategia | Por qué |
|---|---|---|
| Navegación (el HTML) | Red primero, caché de respaldo | Que nadie quede clavado en una versión vieja |
| `data/*.json` | Stale-while-revalidate | Se ve al instante y se refresca por detrás |
| CSS, JS, imágenes | Caché primero, revalida atrás | Llevan `?v=` y cambian solo con un deploy |
| Otros orígenes (tipografías) | Sin tocar | Cachearlos solo dejaría respuestas opacas |

> ⚠️ **Al hacer un cambio hay que mover DOS sellos, y tienen que quedar iguales:** el
> `const VERSION` de `sw.js` y los `?v=...` de `index.html`. Cambiar el nombre del caché es lo
> que dispara el borrado del anterior; si se actualiza el HTML y no el service worker, el
> usuario sigue recibiendo la versión vieja.
>
> El sello de `paginas.css` **no** es un tercer lugar que mantener: `generar-paginas.js` lo lee
> de `index.html`. Pero después de mover los sellos hay que volver a correr
> `node generar-paginas.js` para que las páginas queden con el nuevo.

## Páginas para buscadores (SEO)

La app pinta el catálogo con JavaScript después de bajar `data.json`. Para una persona eso
está perfecto; para Google el sitio entero era **una** dirección con poco más de 400 palabras,
y ninguna decía "Tecnicatura en Enfermería". Sin páginas propias, no hay nada que posicionar.

`generar-paginas.js` arma, con los mismos datos, un documento HTML por cada cosa que alguien
puede buscar:

| Ruta | Cuántas | Qué tiene |
|---|---|---|
| `/carrera/<slug>/` | ~554 | Quién la dicta, duración, modalidad, gestión, link oficial y carreras del mismo área |
| `/institucion/<slug>/` | ~80 | Ficha de contacto y toda su oferta agrupada por área |
| `/area/<slug>/` | 13 | Las carreras del área, separadas por tipo de formación |
| `/provincia/<slug>/` | 1 (hoy) | Las instituciones de esa provincia, por gestión |
| `/carreras/` y `/instituciones/` | 2 | Índices: el camino por el que el robot llega a todas |
| `404.html` | 1 | La pantalla de "no existe" del sitio (ver abajo) |
| `sitemap.xml`, `robots.txt` | — | El mapa y las reglas |

Cada página lleva `<title>`, `description`, canónica, Open Graph y JSON-LD (`BreadcrumbList` +
`Course`/`EducationalOrganization`), y termina en un botón que abre la app **ya filtrada** por
esa carrera. Usan `paginas.css`, no `style.css`: son documentos de lectura y no necesitan los
107 KB de la app, cuya velocidad de carga además cuenta para el posicionamiento.

La `description` se recorta a 160 caracteres (`LARGO_META`), que es lo que Google llega a
mostrar. El recorte va por **oraciones completas**, no por cantidad de letras: los resúmenes se
arman encadenando frases cerradas, así que quedarse con las primeras da un texto que se lee
entero en vez de cortarse a mitad de palabra. En la página se sigue mostrando el resumen
completo — ahí es contenido de verdad para quien lee, y no lo limita ningún buscador.

**Crecer a otras provincias no requiere tocar este archivo.** Las rutas no llevan la provincia
adentro (`/carrera/enfermeria/` sirve igual en Salta), la provincia es su propio eje, y las
páginas de provincia aparecen solas cuando esa jurisdicción supera `MINIMO_POR_PROVINCIA`
instituciones — el umbral existe para no publicar páginas de una sola institución, que a
Google le huelen a relleno.

### La página 404

GitHub Pages sirve `/404.html` —con el código HTTP 404 correcto— ante cualquier dirección que
no existe. Sin ese archivo muestra su pantalla genérica: quien llegó por un enlace viejo o un
slug que cambió se va, y el robot se queda sin camino para seguir. La nuestra ofrece la vuelta
al buscador y los dos índices.

La genera `generar-paginas.js` como todas las demás, y no a mano, para que comparta cabecera,
pie y estilos: si mañana cambia el logo, cambia sola. Va con `noindex` y sin canónica (una
pantalla de error no representa ningún contenido) y no entra al sitemap.

### Por qué ya no existe `/frontend/`

`/frontend/` era la dirección vieja de la app: un `index.html` que solo redirigía a
la raíz con `noindex` + canónica hacia `/`. Quedó como puente tras la mudanza, pero
ese redirect era la otra mitad del bucle que se armaba con una copia vieja del
`index.html` raíz cacheada (raíz → `/frontend/` → raíz). Se eliminó: cualquier
enlace viejo o favorito que caiga ahí termina en el `404.html` estático, sin
rebotes.

Dos detalles más que conviene conocer antes de tocar nada:

- **La app tiene una sola dirección canónica: `/`.** Los filtros escriben la URL con
  `history.replaceState` (`?q=`, `?area=`, `?gestion=`…), así que el mismo catálogo es
  alcanzable por miles de direcciones. La canónica fija en `index.html` hace que Google las
  cuente como una sola; el contenido "por tema" tiene su dirección de verdad en `/carrera/`.
- **Los duplicados de los datos se fusionan.** Si dos entradas de los perfiles de carrera son
  el mismo nombre con distinta puntuación (pasa: una coma de más genera una clave nueva),
  `generar-paginas.js` las une en una página con las ofertas de las dos, en vez de publicar dos
  páginas casi idénticas.

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

Es lo que consume el frontend; si cambia, hay que tocar `js/datos.js` (y probablemente
también `generar-paginas.js`, que lee el mismo archivo):

```json
{
  "instituciones": [
    { "id": 1, "nombre": "...", "carreras": [
        { "id": 1, "nombre_carrera": "...", "categoria": "...", "duracion": "...",
          "modalidad": "...", "facultad": "...", "link_oficial": "..." } ] } ],
  "plataformas": [ { "institucion": "...", "modalidad": "...", "oferta": "...", "duracion": "..." } ]
}
```
