# BEN — Buscador Educativo Nacional

Sitio estático (HTML/CSS/JavaScript vanilla, sin frameworks ni build) que funciona como
buscador/catálogo de oferta educativa de Mendoza: universidades, IES/institutos superiores,
centros de formación y plataformas online. Incluye un feed de novedades, un "Copiloto
Vocacional" (mini test de orientación) y una vista de centros deportivos.

## Estructura

```
frontend/    el sitio: index.html, app.js, style.css, logos e íconos
data/        los JSON generados (data.json, noticias.json, deporte.json + uno por institución)
scrapers/    los scripts Python que generan esos JSON
  scraper_utils.py   funciones compartidas por todos los scrapers
  unir_todo.py       consolida los JSON individuales en data.json
  plataforma.py      agrega las plataformas online a data.json
  fuentes/           páginas guardadas que algún scraper usa como entrada offline
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
2. Correr `python scrapers/unir_todo.py`. Lee los JSON individuales que ya estén en `data/`
   (no hace falta volver a scrapear todo) y regenera `data.json`, incluida la sección
   `plataformas` — no hace falta correr `plataforma.py` aparte, `unir_todo.py` lo encadena.

Los scripts resuelven sus rutas a partir de su propia ubicación, así que se pueden ejecutar
desde cualquier carpeta.

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

Es lo que consume el frontend; si cambia, hay que tocar `frontend/app.js`:

```json
{
  "instituciones": [
    { "id": 1, "nombre": "...", "carreras": [
        { "id": 1, "nombre_carrera": "...", "categoria": "...", "duracion": "...",
          "modalidad": "...", "facultad": "...", "link_oficial": "..." } ] } ],
  "plataformas": [ { "institucion": "...", "modalidad": "...", "oferta": "...", "duracion": "..." } ]
}
```
