// ============================================================================
// AUDITORÍA DE ACCESIBILIDAD (WCAG 2.1 AA) — 10.ª suite
// ============================================================================
// Corre la app real (index.html + main.js) en jsdom y verifica tres capas:
//
//   1. Reglas de estructura y ARIA (equivalente propio de axe-core: sin
//      dependencias nuevas, porque el proyecto no las tiene instaladas).
//   2. Contraste calculado sobre los tokens de style.css en los cuatro estados
//      de tema (claro / oscuro / claro+alto / oscuro+alto).
//   3. Áreas táctiles mínimas declaradas en el CSS.
//
// Lo que NO cubre (y por eso queda el guion manual en el README/entrega):
// píxeles renderizados, zoom 200%, Tab real y lectores de pantalla.
//
// Correr con:  node test_accesibilidad.js
// ============================================================================
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { pathToFileURL } = require('url');

const RAIZ = __dirname;
let aserciones = 0;
let fallos = 0;
const ok = (cond, msg) => {
    if (cond) { aserciones++; console.log('  ✓ ' + msg); }
    else { fallos++; console.error('  ✗ ' + msg); }
};
const seccion = (n) => console.log(`\n${n}`);

// ---------------------------------------------------------------------------
// Arranque de la app (mismo harness que test_arranque.js)
// ---------------------------------------------------------------------------
const errores = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => {
    const texto = String(e.message || e);
    if (/Could not parse CSS|not implemented|scrollTo/i.test(texto)) return;
    errores.push(texto);
});
['error', 'warn', 'log'].forEach(k => vc.on(k, () => {}));

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
        window.matchMedia = (q) => ({
            matches: /max-width:\s*820px/.test(q), media: q,
            addEventListener() {}, removeEventListener() {}
        });
        window.scrollTo = () => {};
        window.requestIdleCallback = (fn) => setTimeout(fn, 10);
        window.HTMLElement.prototype.scrollIntoView = () => {};
    }
});
const win = dom.window;

// jsdom no implementa inert: se emula como propiedad para poder auditarlo.
const inertProps = new WeakSet();
win.HTMLElement.prototype.__defineSetter__('inert', function (v) {
    if (v) inertProps.add(this); else inertProps.delete(this);
});
win.HTMLElement.prototype.__defineGetter__('inert', function () {
    return inertProps.has(this);
});

win.fetch = async (url) => {
    const limpia = String(url).split('?')[0].replace(/^\//, '');
    const p = path.join(RAIZ, limpia);
    if (!fs.existsSync(p)) return { ok: false, status: 404 };
    const texto = fs.readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(texto), text: async () => texto };
};
win.eval(fs.readFileSync(path.join(RAIZ, 'js/vocacional/motor.js'), 'utf8'));
win.eval(fs.readFileSync(path.join(RAIZ, 'js/vocacional/eventos.js'), 'utf8'));
win.eval(fs.readFileSync(path.join(RAIZ, 'js/favoritos.js'), 'utf8'));
win.eval(fs.readFileSync(path.join(RAIZ, 'js/accesibilidad.js'), 'utf8'));
win.eval(fs.readFileSync(path.join(RAIZ, 'js/feedback.js'), 'utf8'));

for (const [k, v] of Object.entries({
    window: win, document: win.document, localStorage: win.localStorage, location: win.location,
    history: win.history, CustomEvent: win.CustomEvent, Event: win.Event, Node: win.Node,
    Element: win.Element, fetch: win.fetch, URL: win.URL, Blob: win.Blob,
    KeyboardEvent: win.KeyboardEvent, MutationObserver: win.MutationObserver
})) { try { global[k] = v; } catch (e) {} }
global.IntersectionObserver = win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };

// ---------------------------------------------------------------------------
// Utilidades de auditoría
// ---------------------------------------------------------------------------
const FOCALIZABLES = 'a[href], button, input, select, textarea, [tabindex], summary, audio[controls], video[controls]';

const esInert = (el) => {
    for (let n = el; n; n = n.parentElement) {
        if (n.inert === true) return true;
        if (n.hasAttribute && n.hasAttribute('hidden')) return true;
    }
    return false;
};
const esAriaOculto = (el) => {
    for (let n = el; n; n = n.parentElement) {
        if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return true;
    }
    return false;
};
const visible = (el) => {
    if (esInert(el) || esAriaOculto(el) || el.disabled) return false;
    const t = el.getAttribute('tabindex');
    if (t !== null && Number(t) < 0) return false;
    return true;
};
const nombreAccesible = (el) => {
    const doc = el.ownerDocument;
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
        const n = lb.split(/\s+/).map(id => (doc.getElementById(id)?.textContent || '').trim()).join(' ').trim();
        if (n) return n;
    }
    if (el.id) {
        const lbl = doc.querySelector(`label[for="${el.id.replace(/"/g, '\\"')}"]`);
        if (lbl && lbl.textContent.trim()) return lbl.textContent.trim();
    }
    const envoltura = el.closest && el.closest('label');
    if (envoltura && envoltura.textContent.trim()) return envoltura.textContent.trim();
    const texto = (el.textContent || '').trim();
    if (texto) return texto;
    return (el.getAttribute('title') || '').trim();
};
const sinSaltosDeHeading = (doc) => {
    let previo = 0; const saltos = [];
    doc.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
        if (!visible(h)) return;
        const n = Number(h.tagName[1]);
        if (previo && n > previo + 1) saltos.push(`h${previo}→h${n}`);
        previo = n;
    });
    return saltos;
};
const interactivosAnidados = (doc) => {
    const malos = [];
    doc.querySelectorAll('[role="option"] a, [role="option"] button, [role="option"] input').forEach(el => {
        malos.push(el.tagName.toLowerCase());
    });
    return malos;
};

// ---------------------------------------------------------------------------
// Contraste: lee los tokens de style.css y calcula ratios WCAG
// ---------------------------------------------------------------------------
const css = fs.readFileSync(path.join(RAIZ, 'style.css'), 'utf8');
const bloqueDe = (sel) => {
    const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([\\s\\S]*?)\\}'));
    return m ? m[1] : '';
};
const tokensDe = (texto) => {
    const t = {};
    for (const m of texto.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) t[m[1]] = m[2].trim();
    return t;
};
const TOKENS = {
    raiz: tokensDe(bloqueDe(':root')),
    claro: tokensDe(bloqueDe('html[data-theme="light"]')),
    oscuro: tokensDe(bloqueDe('html[data-theme="dark"]')),
    alto: tokensDe(bloqueDe('html[data-contrast="high"]')),
    altoClaro: tokensDe(bloqueDe('html[data-theme="light"][data-contrast="high"]')),
    altoOscuro: tokensDe(bloqueDe('html[data-theme="dark"][data-contrast="high"]'))
};
const TEMAS = {
    'claro': { ...TOKENS.raiz, ...TOKENS.claro },
    'oscuro': { ...TOKENS.raiz, ...TOKENS.oscuro },
    'claro+alto': { ...TOKENS.raiz, ...TOKENS.claro, ...TOKENS.alto, ...TOKENS.altoClaro },
    'oscuro+alto': { ...TOKENS.raiz, ...TOKENS.oscuro, ...TOKENS.alto, ...TOKENS.altoOscuro }
};
const resolver = (valor, tokens, prof = 0) => {
    if (typeof valor !== 'string' || prof > 8) return valor;
    const m = valor.trim().match(/^var\(--([a-z0-9-]+)/);
    if (!m) return valor;
    const siguiente = tokens[m[1]];
    return siguiente === undefined ? valor : resolver(siguiente, tokens, prof + 1);
};
const aRgb = (color) => {
    if (!color) return null;
    let m = String(color).match(/^#([0-9a-fA-F]{6})$/);
    if (m) { const h = m[1]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]; }
    m = String(color).match(/^#([0-9a-fA-F]{3})$/);
    if (m) return [...m[1]].map(c => parseInt(c + c, 16)).concat(1);
    m = String(color).match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,]+([\d.]+))?\)/);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
    return null;
};
const sobre = (frente, fondo) => {
    if (!frente) return null;
    if (frente[3] === 1) return frente.slice(0, 3);
    const a = frente[3];
    return [0, 1, 2].map(i => Math.round(frente[i] * a + fondo[i] * (1 - a)));
};
const luminancia = (c) => {
    const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contraste = (a, b) => {
    const l1 = luminancia(a), l2 = luminancia(b);
    const [alto_, bajo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (alto_ + 0.05) / (bajo + 0.05);
};
const mezcla = (p, c1, c2) => [0, 1, 2].map(i => Math.round(c1[i] * p + c2[i] * (1 - p)));

const PARES = [
    ['texto normal sobre fondo', 'text', 'bg', 4.5],
    ['texto normal sobre tarjeta', 'text', 'surface', 4.5],
    ['texto atenuado sobre fondo', 'muted', 'bg', 4.5],
    ['texto atenuado sobre superficie suave', 'muted', 'surface-soft', 4.5],
    ['acción sólida (chip activo, CTA, skip link)', 'accion-ink', 'accion-fill', 4.5],
    ['badge compatibilidad alta', 'on-vivid', 'green', 4.5],
    ['badge compatibilidad media / botón naranja', 'on-vivid', 'orange', 4.5],
    ['badge tipo Curso', 'on-vivid', 'teal', 4.5],
    ['badge compatibilidad baja', 'on-muted', 'muted', 4.5],
    ['badge de match (extremo claro del degradado)', 'on-vivid', '#059669', 4.5],
    ['título de pestaña activa (tinte naranja 14%)', 'orange-ink', 'TINTE_NARANJA', 4.5],
    ['título de pestaña activa (tinte verde 14%)', 'green-ink', 'TINTE_VERDE', 4.5],
    ['filtro activo (tinte de acento 14%)', 'accent-ink', 'TINTE_ACENTO', 4.5],
    ['borde de campos de formulario', 'control-line', 'surface', 3.0],
    ['borde de campos sobre superficie suave', 'control-line', 'surface-soft', 3.0],
    ['enlace de acento', 'accent-ink', 'bg', 4.5]
];

function valorDelPar(token, tokens) {
    if (token.startsWith('#')) return aRgb(token);
    if (token === 'TINTE_NARANJA') return mezcla(0.14, aRgb('#F97316').slice(0, 3), aRgb(resolver('var(--surface)', tokens)).slice(0, 3));
    if (token === 'TINTE_VERDE') return mezcla(0.14, aRgb('#16A34A').slice(0, 3), aRgb(resolver('var(--surface)', tokens)).slice(0, 3));
    if (token === 'TINTE_ACENTO') return mezcla(0.14, aRgb(resolver('var(--accent)', tokens)).slice(0, 3), aRgb(resolver('var(--surface)', tokens)).slice(0, 3));
    return aRgb(resolver(`var(--${token})`, tokens));
}

// ---------------------------------------------------------------------------
(async () => {
    console.log('🧪 Iniciando test_accesibilidad...');
    await import(pathToFileURL(path.join(RAIZ, 'js/main.js')).href);
    await new Promise(r => setTimeout(r, 700));
    const doc = win.document;

    seccion('1. Estructura, landmarks y jerarquía (1.3.1 / 2.4.1)');
    ok(doc.documentElement.getAttribute('lang') === 'es-AR', 'el idioma declarado es es-AR (' + doc.documentElement.getAttribute('lang') + ')');
    ok(doc.querySelectorAll('main').length === 1, 'hay un solo <main>');
    ok(doc.querySelectorAll('h1').length === 1, 'hay un solo <h1>');
    ok(!doc.querySelector('nav:not([aria-label]):not([aria-labelledby])'), 'todos los <nav> tienen nombre accesible');
    ok(Boolean(doc.querySelector('[role="search"]')), 'el buscador tiene landmark de búsqueda');
    ok(sinSaltosDeHeading(doc).length === 0, 'sin saltos en la jerarquía de headings' + (sinSaltosDeHeading(doc).length ? ' → ' + sinSaltosDeHeading(doc).join(', ') : ''));
    const ids = {};
    doc.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; });
    ok(Object.values(ids).every(n => n === 1), 'sin ids duplicados');
    ok(doc.querySelectorAll('img:not([alt])').length === 0, 'todas las imágenes tienen alt');
    const refsRotas = [];
    doc.querySelectorAll('[aria-controls],[aria-labelledby],[aria-describedby],[aria-activedescendant]').forEach(el => {
        ['aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-activedescendant'].forEach(at => {
            const v = el.getAttribute(at);
            if (!v) return;
            v.split(/\s+/).forEach(id => { if (!doc.getElementById(id)) refsRotas.push(`${at}=${id}`); });
        });
    });
    ok(refsRotas.length === 0, 'sin referencias ARIA rotas' + (refsRotas.length ? ' → ' + refsRotas.slice(0, 3).join(', ') : ''));

    seccion('2. Teclado: skip links, foco y trampas (2.1.1 / 2.4.1 / 2.4.3)');
    ok(doc.activeElement.id === 'btnBienvenidaCopiloto', 'al cargar, el foco arranca dentro de la portada');
    const skips = [...doc.querySelectorAll('.skip-link')];
    ok(skips.length >= 2, `skip links del catálogo: filtros y resultados (${skips.length})`);
    ok(skips.every(a => {
        const destino = doc.getElementById((a.getAttribute('href') || '').slice(1));
        return destino && destino.getAttribute('tabindex') === '-1';
    }), 'cada skip link apunta a un destino enfocable (tabindex="-1")');
    ok(doc.getElementById('cardContainer').focus instanceof Function && (() => {
        doc.getElementById('cardContainer').focus();
        return doc.activeElement.id === 'cardContainer';
    })(), 'el destino "Saltar a los resultados" recibe el foco');
    ok(Boolean(doc.querySelector('.skip-link[href="#filtersSidebar"]')), 'hay "Saltar a los filtros"');
    ok(doc.querySelectorAll('[tabindex]:not([tabindex="-1"])').length === 0, 'sin tabindex positivos (el orden de Tab sigue el DOM)');

    // Con la portada arriba, el pie no puede estar entre los primeros tab stops
    const primeros = [...doc.querySelectorAll(FOCALIZABLES)].filter(visible).slice(0, 6);
    ok(!primeros.some(el => el.closest('.site-footer')), 'con la portada visible, el pie queda fuera del orden de Tab');
    const bienvenida = doc.getElementById('pantallaBienvenida');
    ok(bienvenida.getAttribute('role') === 'dialog' && bienvenida.getAttribute('aria-modal') === 'true', 'la portada es un diálogo modal declarado');
    ok(Boolean(nombreAccesible(bienvenida)), 'la portada tiene nombre accesible: «' + nombreAccesible(bienvenida).slice(0, 40) + '»');

    // Zona inerte detrás de la portada
    ok(doc.querySelector('.site-footer').inert === true && doc.querySelector('.catalog-layout').inert === true, 'el catálogo y el pie quedan inert detrás de la portada');
    const btnA11y = doc.getElementById('btnAccesibilidad');
    ok(doc.querySelector('.a11y-widget').inert === false, 'el widget de accesibilidad sigue operable en la portada');
    btnA11y.focus(); btnA11y.click();
    await new Promise(r => setTimeout(r, 120));
    ok(doc.getElementById('panelAccesibilidad').inert === false && doc.querySelector('.catalog-layout').inert === true, 'el panel de accesibilidad queda por encima y el fondo inerte');
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    ok(doc.querySelector('.catalog-layout').inert === true && bienvenida.inert === false, 'al cerrar el panel se restaura el inert previo tal cual');
    ok(doc.activeElement === btnA11y, 'el foco vuelve al botón que abrió el panel');

    seccion('3. Catálogo: filtros, vistas y listas reales (4.1.2 / 1.3.1)');
    doc.getElementById('btnBienvenidaOfertas').click();
    await new Promise(r => setTimeout(r, 700));
    ok(doc.activeElement.id === 'searchInput', 'al entrar al catálogo el foco no se pierde (va al buscador)');
    const contenedor = doc.getElementById('cardContainer');
    ok(contenedor.tagName === 'UL' && contenedor.getAttribute('role') === 'list', 'los resultados son una lista real (<ul role="list">)');
    ok([...contenedor.children].every(h => h.tagName === 'LI'), 'todos los hijos de la lista son <li>');
    ok(contenedor.querySelectorAll('li.card h3').length > 0, 'cada tarjeta conserva su encabezado');
    ['contenedor-plataformas', 'contenedor-formaciones', 'contenedor-oficios', 'contenedor-secundario'].forEach(id => {
        const el = doc.getElementById(id);
        ok(el && el.tagName === 'UL' && el.getAttribute('role') === 'list', `#${id} es una lista real`);
    });

    const grupos = [...doc.querySelectorAll('.filter-options[role="group"]')];
    ok(grupos.length === 7, `los 7 grupos de filtros están declarados como grupo (${grupos.length})`);
    ok(grupos.every(g => doc.getElementById(g.getAttribute('aria-labelledby') || '')), 'cada grupo toma su nombre del h3 visible');
    const botonesFiltro = [...doc.querySelectorAll('.filter-option')];
    ok(botonesFiltro.every(b => b.hasAttribute('aria-pressed')), 'todos los filtros exponen aria-pressed');
    const tecn = botonesFiltro.find(b => b.dataset.value === 'tecnicaturas');
    tecn.click();
    await new Promise(r => setTimeout(r, 250));
    ok(tecn.getAttribute('aria-pressed') === 'true', 'al aplicar un filtro, aria-pressed pasa a true');
    const marcadosPorGrupo = grupos.map(g => [...g.querySelectorAll('.filter-option')].filter(b => b.getAttribute('aria-pressed') === 'true').length);
    ok(marcadosPorGrupo.length === 7 && marcadosPorGrupo.every(n => n === 1), 'exactamente un valor marcado por grupo (' + marcadosPorGrupo.join(',') + ')');
    ok(doc.getElementById('resultsCount').getAttribute('role') === 'status' && doc.getElementById('resultsCount').getAttribute('aria-live') === 'polite', 'el contador de resultados se anuncia (role="status" + aria-live)');
    doc.getElementById('clearFiltersButton').click();
    await new Promise(r => setTimeout(r, 200));
    ok(botonesFiltro.filter(b => b.getAttribute('aria-pressed') === 'true').length === 7, 'al limpiar, vuelve a estar marcado "todos" en cada grupo');
    const vistas = [...doc.querySelectorAll('.vistas-switcher-btn')];
    ok(vistas.every(b => b.hasAttribute('aria-pressed')), 'las vistas (Carreras / Instituciones) exponen su estado');

    seccion('4. Autocompletado (4.1.2)');
    const input = doc.getElementById('searchInput');
    ok(input.getAttribute('role') === 'combobox' && input.getAttribute('aria-controls') === 'searchDropdown', 'el buscador es un combobox que controla el listbox');
    input.value = 'abog';
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    const dd = doc.getElementById('searchDropdown');
    const gruposDd = [...dd.querySelectorAll('.search-dropdown-grupo')];
    ok(gruposDd.length > 0 && gruposDd.every(g => g.getAttribute('role') === 'group' && doc.getElementById(g.getAttribute('aria-labelledby') || '')), 'los grupos de sugerencias son role="group" con nombre');
    const opciones = [...dd.querySelectorAll('[role="option"]')];
    ok(opciones.length > 0 && opciones.every(o => o.hasAttribute('aria-selected')), `cada opción declara aria-selected (${opciones.length})`);
    ok(interactivosAnidados(dd).length === 0, 'sin controles anidados dentro de las opciones');
    input.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
    ok(dd.querySelector('[aria-selected="true"]') && input.getAttribute('aria-activedescendant'), 'las flechas resaltan la opción y lo declaran (aria-activedescendant)');

    seccion('5. Test vocacional: contexto, progreso y avance guardado (4.1.2 / 4.1.3 / 2.2.6)');
    doc.getElementById('btnBienvenidaCopiloto').click();
    await new Promise(r => setTimeout(r, 600));
    doc.querySelector('#chat-caja [data-chat-accion="test-completo"]').click();
    await new Promise(r => setTimeout(r, 800));
    doc.querySelector('[data-tc-accion="empezar"]').click();
    await new Promise(r => setTimeout(r, 300));
    const legend = doc.querySelector('#tc-cuerpo fieldset legend');
    ok(/Pregunta \d+ de 65/.test(legend.textContent), 'la leyenda anuncia la pregunta en contexto («' + legend.textContent.trim().slice(0, 34) + '»)');
    const fieldset = doc.querySelector('#tc-cuerpo fieldset');
    ok(/Escala de 1 a 5/.test((doc.getElementById(fieldset.getAttribute('aria-describedby')) || {}).textContent || ''), 'el fieldset describe la escala completa');
    const barra = doc.getElementById('tc-progreso');
    ok(barra.getAttribute('role') === 'progressbar' && Number(barra.getAttribute('aria-valuemax')) === 65, 'la barra es un progressbar con máximo real');
    ok(/de 65 respondidas/.test(barra.getAttribute('aria-valuetext') || ''), 'el progreso tiene texto alternativo en palabras');
    ok(doc.getElementById('tc-anuncio').getAttribute('role') === 'status', 'hay región role="status" para anunciar las tandas');
    const radios = [...doc.querySelectorAll('#tc-cuerpo fieldset')].map(f => f.querySelector('input[type=radio]'));
    radios.forEach(r => {
        const elegido = doc.querySelector(`input[name="${r.name}"][value="3"]`);
        elegido.checked = true;
        elegido.dispatchEvent(new win.Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 200));
    ok(Number(barra.getAttribute('aria-valuenow')) === radios.length, 'aria-valuenow acompaña las respuestas');
    const guardado = JSON.parse(win.localStorage.getItem('ben-vocacional-progreso') || 'null');
    ok(guardado && Object.keys(guardado.respuestas).length === radios.length, 'el avance se guarda para poder retomar (autosave)');

    seccion('6. Formulario de sugerencias (3.3.1 / 3.3.2 / 2.1.1)');
    doc.getElementById('tc-cerrar').click();
    doc.getElementById('btnAbrirFeedback').click();
    await new Promise(r => setTimeout(r, 250));
    ok(doc.activeElement.id === 'feedbackMensaje', 'el foco entra al primer campo del formulario');
    ok(Boolean(doc.querySelector('label[for="feedbackMensaje"]')) && Boolean(doc.querySelector('label[for="feedbackEmail"]')), 'ambos campos tienen label asociado');
    doc.getElementById('btnEnviarFeedback').click();
    await new Promise(r => setTimeout(r, 250));
    const err = doc.getElementById('feedbackErrorMensaje');
    ok(!err.hidden && err.getAttribute('role') === 'alert', 'el error se muestra con role="alert"');
    ok(doc.getElementById('feedbackMensaje').getAttribute('aria-describedby') === 'feedbackErrorMensaje', 'el error está asociado al campo (aria-describedby)');
    ok(doc.getElementById('feedbackMensaje').getAttribute('aria-invalid') === 'true', 'el campo se marca aria-invalid');
    const sug = doc.querySelector('[data-tipo="sugerencia"]'), fall = doc.querySelector('[data-tipo="fallo"]');
    ok(sug.tabIndex === 0 && fall.tabIndex === -1, 'el selector Sugerencia/Fallo usa roving tabindex');
    sug.focus();
    sug.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    ok(fall.getAttribute('aria-checked') === 'true' && doc.activeElement === fall, 'las flechas cambian la selección del radiogroup');
    doc.getElementById('btnCerrarFeedback').click();
    await new Promise(r => setTimeout(r, 150));

    seccion('7. Contraste AA en los cuatro estados de tema (1.4.3 / 1.4.11)');
    for (const [tema, tokens] of Object.entries(TEMAS)) {
        const fallan = [];
        PARES.forEach(([nombre, fg, bg, umbral]) => {
            const f = valorDelPar(fg, tokens), b = valorDelPar(bg, tokens);
            if (!f || !b) { fallan.push(`${nombre} (no resoluble)`); return; }
            const ratio = contraste(sobre(f, b), b);
            if (ratio < umbral) fallan.push(`${nombre} ${ratio.toFixed(2)}:1 < ${umbral}`);
        });
        ok(fallan.length === 0, `${tema}: los ${PARES.length} pares críticos pasan el umbral` + (fallan.length ? ' → ' + fallan.join(' · ') : ''));
    }

    seccion('8. Áreas táctiles (2.5.8)');
    ok(/\.ml-item-check input \{[^}]*width: 24px/.test(css.replace(/\n/g, ' ')), 'checkbox de comparar en Mi lista: 24px');
    ok(/\.chapa-recomendacion button \{[\s\S]*?width: 24px/.test(css), '✕ de recomendaciones: 24px');
    ok(/\.a11y-close-btn \{[\s\S]*?min-height: 24px/.test(css), '✕ del panel de accesibilidad: ≥24px');
    ok(/@media \(pointer: coarse\)[\s\S]*?\.filter-option \{ min-height: 44px/.test(css), 'en pantallas táctiles los filtros suben a 44px');

    seccion('9. Regresiones del panel de accesibilidad (no romper lo que ya había)');
    const panel = doc.getElementById('panelAccesibilidad');
    doc.getElementById('btnAccesibilidad').click();
    await new Promise(r => setTimeout(r, 120));
    const fuente = panel.querySelector('[data-a11y-font="1.15"]');
    fuente.click();
    ok(doc.documentElement.style.getPropertyValue('--font-scale') === '1.15', 'tamaño de texto');
    const contraste2 = doc.getElementById('a11yToggleContrast');
    contraste2.checked = true;
    contraste2.dispatchEvent(new win.Event('change', { bubbles: true }));
    ok(doc.documentElement.dataset.contrast === 'high', 'alto contraste');
    const dislexia = doc.getElementById('a11yToggleDyslexia');
    dislexia.checked = true;
    dislexia.dispatchEvent(new win.Event('change', { bubbles: true }));
    ok(doc.documentElement.dataset.dyslexia === 'true', 'lectura fácil');
    const tts = doc.getElementById('a11yToggleTTS');
    tts.checked = true;
    tts.dispatchEvent(new win.Event('change', { bubbles: true }));
    ok(doc.documentElement.dataset.tts === 'true', 'lector por voz');
    const realce = doc.getElementById('a11yToggleHighlight');
    realce.checked = true;
    realce.dispatchEvent(new win.Event('change', { bubbles: true }));
    ok(doc.documentElement.dataset.highlight === 'true', 'destacar enlaces');
    doc.getElementById('a11yResetButton').click();
    await new Promise(r => setTimeout(r, 80));
    ok(doc.documentElement.style.getPropertyValue('--font-scale') === '1' && !doc.documentElement.dataset.contrast && !doc.documentElement.dataset.dyslexia, 'restablecer deja todo por defecto');
    ok(Object.keys(win.localStorage).some(k => k === 'ben-a11y'), 'las preferencias se siguen guardando');

    ok(errores.length === 0, 'sin errores de jsdom durante toda la corrida' + (errores.length ? ' → ' + errores[0] : ''));

    seccion('10. Páginas estáticas generadas (566 fichas)');
    const PAGINAS = ['carrera/abogacia/index.html', 'carreras/index.html', 'area/salud/index.html', 'instituciones/index.html'];
    for (const rel of PAGINAS) {
        const ruta = path.join(RAIZ, rel);
        if (!fs.existsSync(ruta)) { ok(false, `${rel} no existe (¿falta correr generar-paginas.js?)`); continue; }
        const pagina = new JSDOM(fs.readFileSync(ruta, 'utf8')).window.document;
        const problemas = [];
        if (pagina.documentElement.getAttribute('lang') !== 'es-AR') problemas.push('lang');
        if (pagina.querySelectorAll('main').length !== 1) problemas.push('<main>');
        if (pagina.querySelectorAll('h1').length !== 1) problemas.push('h1');
        if (sinSaltosDeHeading(pagina).length) problemas.push('saltos de heading');
        if (pagina.querySelectorAll('img:not([alt])').length) problemas.push('img sin alt');
        const skip = pagina.querySelector('.skip-link');
        const destinoSkip = skip && pagina.getElementById((skip.getAttribute('href') || '').slice(1));
        if (!skip || !destinoSkip || destinoSkip.getAttribute('tabindex') !== '-1') problemas.push('skip link');
        if (pagina.querySelectorAll('[tabindex]:not([tabindex="-1"])').length) problemas.push('tabindex positivo');
        const sinNombre = [...pagina.querySelectorAll(FOCALIZABLES)].filter(el => {
            if (el.closest('[hidden]')) return false;
            if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
            return !nombreAccesible(el);
        });
        if (sinNombre.length) problemas.push(`${sinNombre.length} control(es) sin nombre`);
        const camposSinLabel = [...pagina.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(c => {
            if (c.getAttribute('aria-label') || c.getAttribute('aria-labelledby')) return false;
            if (c.id && pagina.querySelector(`label[for="${c.id}"]`)) return false;
            return !c.closest('label');
        });
        if (camposSinLabel.length) problemas.push(`${camposSinLabel.length} campo(s) sin label`);
        ok(problemas.length === 0, `${rel}: estructura, foco y etiquetas` + (problemas.length ? ' → ' + problemas.join(', ') : ''));
    }

    console.log(`\n${fallos === 0 ? '✅' : '❌'} test_accesibilidad.js: ${aserciones} aserciones, ${fallos} fallo(s)`);
    process.exit(fallos ? 1 : 0);
})().catch(error => {
    console.error('❌ test_accesibilidad.js falló:', error);
    process.exit(1);
});
