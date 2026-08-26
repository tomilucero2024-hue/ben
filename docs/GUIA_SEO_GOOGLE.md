# Guía de Puesta en Marcha en Google Search Console y Monitoreo SEO

Esta guía describe los pasos necesarios para conectar **BEN (Buscador Educativo Nacional)** con Google Search Console, indexar las 628 páginas estáticas y monitorear la aparición de fragmentos enriquecidos (rich snippets).

---

## 1. Verificación del Dominio en Google Search Console

1. Ingresá a [Google Search Console](https://search.google.com/search-console).
2. Seleccioná la opción **Prefijo de la URL** o **Dominio**:
   * **Recomendado (Dominio completo):** Escribí `buscadoreducativo.com.ar`.
   * Copiá el registro **TXT de verificación** provisto por Google.
   * Entrá al panel de control de tu proveedor de dominio (ej. Nic.ar, Cloudflare, DonWeb, etc.) y agregá el registro TXT en la zona DNS.
   * Hacé clic en **Verificar**.

---

## 2. Envío del Mapa del Sitio (`sitemap.xml`)

El generador estático de BEN compila automáticamente el archivo `sitemap.xml` en la raíz del proyecto conteniendo la totalidad de las URLs indexables:

1. En el menú lateral izquierdo de Search Console, hacé clic en **Sitemaps**.
2. En el campo *"Añadir un sitemap"*, ingresá:
   ```text
   sitemap.xml
   ```
3. Hacé clic en **Enviar**.
4. Verificá que el estado pase a **"Correcto"** y que Google detecte las ~629 URLs enviadas.

---

## 3. Solicitud de Indexación Prioritaria (Primeras 24/48 hs)

Googlebot rastreará todo el sitio a través del sitemap, pero podés acelerar la indexación de las páginas de mayor impacto utilizando la herramienta **Inspección de URLs**:

En la barra de búsqueda superior de Search Console, inspeccioná una por una estas URLs clave y presioná **"Solicitar indexación"**:

1. Portada: `https://buscadoreducativo.com.ar/`
2. Hub de Universidades: `https://buscadoreducativo.com.ar/provincia/mendoza/universidades/`
3. Hub de Carreras: `https://buscadoreducativo.com.ar/provincia/mendoza/carreras/`
4. Carreras de alta demanda:
   - `https://buscadoreducativo.com.ar/carrera/medicina/`
   - `https://buscadoreducativo.com.ar/carrera/abogacia/`
   - `https://buscadoreducativo.com.ar/carrera/psicologia/`
   - `https://buscadoreducativo.com.ar/carrera/licenciatura-en-administracion-de-empresas/`

---

## 4. Validación de Esquemas y Fragmentos Enriquecidos (Rich Results)

BEN incluye marcado estructurado Schema.org nativo en formato JSON-LD:
- **`Course` y `ItemList`:** En fichas de carreras y dónde estudiarlas.
- **`FAQPage`:** Preguntas frecuentes interactivas con respuestas desplegables.
- **`CollectionPage`:** En índices provinciales y áreas académicas.
- **`EducationalOrganization`:** En instituciones.
- **`BreadcrumbList`:** Migas de pan de navegación.

### Cómo testearlo:
1. Abrí la [Prueba de resultados enriquecidos de Google](https://search.google.com/test/rich-results).
2. Ingresá una URL de carrera (o pegá el código HTML de una ficha).
3. Verificá que se detecten en verde:
   - ✅ **Cursos** (`Course`)
   - ✅ **Preguntas frecuentes** (`FAQPage`)
   - ✅ **Ruta de exploración** (`Breadcrumbs`)

---

## 5. Mantenimiento y Rutina de Actualización

Cada vez que actualices datos o ejecutes los scrapers:
1. Corré `node generar-paginas.js` para regenerar el catálogo estático y el `sitemap.xml`.
2. Hacé el commit en Git y subí los cambios al hosting/servidor (`git push`).
3. Googlebot detectará automáticamente la fecha `lastmod` actualizada en el sitemap y re-rastreará las páginas modificadas.
