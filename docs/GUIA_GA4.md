# Guía para leer Google Analytics 4

Esta guía es para **leer** los datos de BEN. La parte técnica (qué archivo manda qué evento y cómo)
vive en el README, sección *Analítica*. Acá solo interesa lo otro: qué significa cada nombre que
aparece en pantalla y qué conviene hacer cuando un número se mueve.

No hace falta saber nada de analítica para entenderla. Los nombres de los eventos —`test_falla`,
`search_sin_resultado`— son feos porque son nombres internos, pero cada uno tiene una traducción
abajo.

---

## 0. Antes de empezar: los eventos no son iguales que sus datos

En GA4 hay dos cosas distintas y conviene no mezclarlas:

- **El evento** es el hecho: "alguien usó el buscador", "el test se rompió". Se ve en
  **Informes → Eventos**, como una fila con un número al lado. No hay que configurar nada.
- **Los datos de ese evento** (qué buscó, en qué sección, cuántos resultados hubo) son los
  **parámetros**. Para verlos hay que **registrarlos primero** como "dimensión personalizada". Si no
  los registrás, GA4 igual los recibe pero los tira a la basura: vas a ver que hubo 40
  `search_sin_resultado`, sin saber cuáles fueron esas 40 búsquedas.

Ese registro es el paso 1 y es una sola vez. Está abajo, con la lista exacta para copiar.

---

## 1. Registrar las dimensiones personalizadas (una sola vez)

**Administrar → Definiciones personalizadas → botón "Crear dimensión personalizada".**

Por cada fila de esta tabla, creás una dimensión. Son tres campos:

- **Nombre de la dimensión**: el texto libre que querés que diga la columna del informe (se puede
  cambiar después, no afecta los datos).
- **Alcance**: siempre **Evento**.
- **Parámetro del evento**: el nombre técnico. **Esto sí tiene que coincidir letra por letra** con
  la columna "Parámetro" de la tabla, o no junta nada.

| Nombre de la dimensión | Parámetro | Qué guarda |
|---|---|---|
| Búsqueda | `search_term` | Lo que se escribió en el buscador o se le preguntó al Copiloto |
| Por qué no encontró | `origen` | Si falló el texto (`texto`), los filtros (`filtros`) o los dos (`texto_y_filtros`) |
| Desde dónde buscó | `via` | `buscador`, `autocompletado` o `cabecera_estatica` |
| Sección | `seccion` | En qué pestaña pasó (formal, plataformas, secundario…) |
| Filtro tocado | `filtro` | Qué filtro se usó (área, modalidad, duración, orden…) |
| Valor del filtro | `valor` | Qué eligió en ese filtro |
| Acción | `accion` | Qué hizo: `agregado`, `completar`, `abrir`, `empezar`… |
| Carrera | `nombre` | El nombre de la carrera marcada o recomendada |
| Área | `area` | El área de esa carrera (Salud, Ingeniería…) |
| Formación | `formacion` | grado, tecnicatura, curso… |
| Perfil del test | `codigo` | El resultado del test en 3 letras (SIE, AIN…) |
| Orientación RIASEC | `driver_riasec` | Por dónde calzó el resultado, ej. `Social-Emprendedor` |
| Orientación aptitud | `driver_apt` | Ej. `interpersonal` |
| Orientación valor | `driver_val` | Ej. `impacto social` |
| Sitio de destino | `host` | A qué institución se fue (ej. `uncuyo.edu.ar`) |
| Página de salida | `pagina` | Desde qué página hizo clic para irse |
| Dónde falló | `donde` | `test`, `motor`, `datos`, o el archivo que falló |
| Tipo de falla | `tipo` | `js`, `rechazo`, `recurso` |
| Mensaje del error | `mensaje` | El detalle técnico del error, sin datos personales |
| Consulta al Copiloto | `texto` | Lo que le escribió al chat |

**Las que son números** (`sugerencias`, `candidatas`, `preguntadas`, `total`, `preguntas`) van como
**métrica personalizada**, no como dimensión: se crean igual, pero eligiendo **Alcance: Evento** y
marcando que es un número. Si las registrás como dimensión funcionan igual para agrupar, pero no se
pueden promediar ni sumar.

> **Ojo con el arrastre.** Una dimensión empieza a juntar datos **desde que la creás**. Lo que el
> sitio mandó antes no se recupera. Por eso conviene registrarlas **antes** de que el sitio empiece a
> usarlas en serio.

### La vía rápida: el script (esto es lo que se usó)

Cargar una veintena de dimensiones a mano es donde se cuela un error de tipeo que recién se nota
semanas después, cuando el parámetro no aparece. Por eso hay un script que las registra todas de una:
`registrar-dimensiones-ga4.js`. La tabla de arriba y el catálogo del script son la misma lista.

**Necesita una credencial de servicio de Google**, que se genera una sola vez en Google Cloud (no en
GA4):

1. Entrá a https://console.cloud.google.com y logueate con tu cuenta de Google.
2. Arriba dice "Seleccionar un proyecto" → **"Proyecto nuevo"** → nombre `ben-analitica` → **Crear**.
3. En la barra de búsqueda: `Google Analytics Admin API` → **"Habilitar"**.
4. Menú ☰ → **"IAM y administración" → "Cuentas de servicio"** → **"Crear cuenta de servicio"**:
   nombre `ben-ga4` → "Crear y continuar" → sin roles → "Continuar" → "Listo".
5. Entrá a esa cuenta → pestaña **"Claves" → "Agregar clave" → "Crear clave nueva" → JSON → Crear**.
   Se descarga un `.json`. **Es una llave privada: no se comparte ni se versiona** (ya está en
   `.gitignore`; se guarda fuera del repo, ej. en `Documentos/`).
6. Copiá el email de esa cuenta de servicio (termina en `...@...iam.gserviceaccount.com`).
7. En **GA4 → Administrar → Acceso a la propiedad → "+" → Agregar usuarios**: pegá ese email, rol
   **Editor**, destildá el aviso por correo. Sin este paso la API responde "403 Permission denied".

Con la credencial guardada, una sola orden:

```bash
node registrar-dimensiones-ga4.js 556804277 /ruta/al/archivo.json
```

El `556804277` es el **ID de la propiedad** del sitio (Administrar → Configuración de la propiedad),
que **no** es el `G-JCNCMH202B`. El script saltea las que ya existen, así que se puede correr de nuevo
sin miedo cuando se agregue un evento nuevo. En esta propiedad ya quedaron registradas las 24
dimensiones y las 5 métricas.

---

## 2. Dónde mirar cada cosa

### El día a día: Tiempo real

**Informes → Tiempo real.** Muestra lo que está pasando *ahora mismo*, con los últimos 30 minutos.
Es donde verificás que la analítica funciona: entrá vos al sitio y deberías verte.

### Los números del mes: Informes → Eventos

**Informes → Engagement → Eventos** (o **Informes → Eventos**, según la versión). Una fila por
evento, con **cuántas veces pasó** y **cuántas personas** lo hicieron. Es la pantalla que contesta
"¿aparece `test_falla`?" sin ninguna configuración.

### Los cruces: Explorar

**Explorar → iniciar nuevo informe → "Exploración en blanco".** Acá se arman las preguntas que la
pantalla anterior no contesta: "de las búsquedas que no encontraron nada, ¿cuáles fueron?". Se
arrastra `search_term` a **Filas**, se filtra por el evento `search_sin_resultado` y aparece la
lista de términos ordenada de mayor a menor.

### Un solo evento, con lujo de detalle: Depuración

**Administrar → Depuración** (en algunas versiones, "DebugView"). Muestra cada evento apenas pasa,
con **todos sus parámetros**, sin límites de tiempo. Sirve para confirmar que un dato nuevo está
saliendo bien. Para verlo hay que abrir el sitio en el mismo navegador donde estás logueado.

---

## 3. Diccionario: qué significa cada nombre

Acá está el "no tengo ni idea qué es esto" resuelto. La columna **"Si sube"** es la que importa: dice
qué hacer cuando el número crece.

### Lo que hace la gente

| Evento | En castellano | Si sube |
|---|---|---|
| `page_view` | Alguien vio una página | — es el total de tráfico, el número base |
| `search` | Escribió en el buscador (y encontró algo) | Buena señal: están buscando lo que hay |
| `search_sin_resultado` | **Buscó y no encontró nada** | **El más accionable.** Ver abajo, punto 4 |
| `filtro` | Tocó un filtro | Están explorando el catálogo con paciencia |
| `filtros_limpiados` | Limpió todos los filtros y volvió a empezar | Si sube mucho, los filtros son confusos o demasiado restrictivos |
| `seccion` | Cambió de pestaña | Te dice qué sección tira: si Formaciones Alternativas crece y Grado no, el público es otro |
| `favorito` | Marcó "Me interesa" | **La conversión del sitio.** Es el que más importa |
| `mi_lista` | Abrió el comparador, copió o imprimió la lista | Está comparando en serio: buen momento del recorrido |
| `test_vocacional` | Usó el Test Vocacional | Mirá `accion`: `completar` (terminó) vs `abandonar` (se cansó) |
| `copiloto` | Le preguntó algo al chat | Está perdido o curioso; mirá `texto` |
| `salir` | **Hizo clic en el link de una institución** | **El objetivo final:** se fue con la respuesta que buscaba. Ver punto 4 |

### Lo que se rompió

| Evento | En castellano | Si aparece |
|---|---|---|
| `test_falla` | El test no pudo calcular el resultado | **Hay que arreglarlo.** La persona contestó las 65 preguntas y se quedó sin resultado |
| `datos_no_cargan` | No bajaron los datos y la grilla quedó vacía | **Hay que arreglarlo urgente.** El sitio entero se ve sin ofertas |
| `error` | Cualquier falla que nadie previó | Mirá `donde` y `mensaje` para saber dónde. Si es `externo/…`, probablemente sea el bloqueador de anuncios del visitante, no el sitio |

**Los tres eventos de falla deberían estar en cero.** No es como los otros números: acá cero es la
respuesta correcta. Si aparecen, el `mensaje` te dice qué pasó.

### El test: hacia dónde se orienta la gente

Al `completar` salen tres etiquetas que resumen en qué se fijó el resultado. Por ejemplo,
`driver_riasec: Social-Emprendedor`, `driver_apt: interpersonal`, `driver_val: impacto social` es una
persona que quiere trabajar con gente y le importa lo social.

En **Explorar**, poné `driver_apt` en Filas y contá cuántas veces aparece cada uno, filtrando por el
evento `test_vocacional`. Ahí se ve qué orientación predomina entre los que terminan el test — que es
distinto de lo que *dicen* buscar: es lo que *les calzó*.

**Las respuestas del test no se mandan nunca**, ni los puntajes, ni la dimensión de presión familiar.
Solo estas tres etiquetas.

---

## 4. Los cinco números para mirar un lunes

Si no querés abrir Explorar, con **Informes → Eventos** y un vistazo alcanza. En orden de valor:

1. **`salir`** — cuántos se fueron a una institución. Es el objetivo del sitio.
2. **`favorito`** — cuántos marcaron "Me interesa". El paso previo.
3. **`search_sin_resultado`** — cuántas búsquedas quedaron sin respuesta.
4. **`test_vocacional` con `accion: completar` vs `abandonar`** — si el test retiene o cansa.
5. **`test_falla` / `datos_no_cargan`** — si aparece ≥ 1, dejá lo demás y revisá esto.

---

## 5. Un caso concreto, de principio a fin

Supongamos que el lunes ves esto en **Informes → Eventos**:

```
search_sin_resultado ......... 128
```

1. Ese número solo dice que 128 veces una búsqueda no dio resultados exactos. Para saber **cuáles**,
   vas a **Explorar** y armás un informe con `search_term` en Filas, filtrando por el evento
   `search_sin_resultado`.
2. Vas a agregar la dimensión `origen` para distinguir el caso. Imaginá que sale:

   ```
   enfermería        origen: texto          41
   veterinaria       origen: texto          33
   contador público  origen: texto_y_filtros 22
   ```

3. La lectura es directa:
   - **"enfermería" y "veterinaria" con `origen: texto`** → la gente las busca y **no están en el
     catálogo** (o están con otro nombre). Es para agregar o para revisar los sinónimos de búsqueda.
   - **"contador público" con `origen: texto_y_filtros`** → existe, pero algún filtro la esconde.
     Mirá qué filtro: probablemente alguien busca una palabra y a la vez tiene puesto un filtro que
     las contradice. Es un problema de pantalla, no de catálogo.
4. Acción: agregar "veterinaria" y "enfermería" al catálogo (o al buscador, si ya están), y revisar
   por qué los filtros se pisan.

Eso solo se puede hacer con la dimensión `search_term` registrada. Sin el paso 1, todo lo que ves es
`search_sin_resultado: 128` y nada más.

---

## 6. Si algo sale mal: apagar la analítica

Para probar en producción sin que los datos se ensucien, agregá **`?sin-analitica`** al final de
cualquier dirección:

```
https://buscadoreducativo.com.ar/?sin-analitica
```

Con eso, esa visita no manda **nada** a Google. Sirve para ver el sitio mientras lo arreglás, sin que
quede como una visita fantasma en los informes.

El interruptor vale para **la página que cargaste**. La app (`/`) es una sola página, así que una vez
que entrás con `?sin-analitica` queda apagada toda la sesión de la app; pero si de ahí saltás a una
ficha (`/carrera/…`), esa es otra carga y tenés que agregar el `?sin-analitica` de nuevo.

El archivo también se apaga solo si el **ID de medición** queda vacío, o si el navegador de la
persona tiene activado "No quiero ser rastreado". No hay nada que hacer en esos casos.
