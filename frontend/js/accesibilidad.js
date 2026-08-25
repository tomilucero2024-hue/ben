/**
 * Módulo de Accesibilidad para BEN (Buscador Educativo Nacional)
 * Cumple con estándares WCAG 2.1 (Nivel AA/AAA).
 *
 * Funcionalidades:
 * 1. Escalado tipográfico fluido (Normal, Grande, Extra Grande).
 * 2. Modo Alto Contraste reforzado (>7:1).
 * 3. Modo Lectura Fácil / Dislexia (espaciado tipográfico e interlineado).
 * 4. Resaltado de enlaces y controles interactivos.
 * 5. Lector por voz nativo (Web Speech API) para tarjetas de carreras y contenidos.
 * 6. Atajos de teclado globales y trampa de foco accesible.
 * 7. Persistencia de preferencias en localStorage.
 */

(() => {
    'use strict';

    const CLAVE_STORAGE = 'ben-a11y';

    const estadoPorDefecto = {
        fontScale: 1,           // 1 = normal (100%), 1.15 = grande (115%), 1.30 = extra (130%)
        highContrast: false,    // true | false
        dyslexiaFont: false,    // true | false
        highlightLinks: false,  // true | false
        ttsEnabled: false       // true | false
    };

    let estado = { ...estadoPorDefecto };
    let elementoPrevioFoco = null;
    let vozEspanol = null;
    let reproduciendoId = null;

    // Cargar estado inicial guardado
    function cargarEstado() {
        try {
            const guardado = localStorage.getItem(CLAVE_STORAGE);
            if (guardado) {
                const parsed = JSON.parse(guardado);
                estado = { ...estadoPorDefecto, ...parsed };
            }
        } catch (e) {
            console.warn('[Accesibilidad] Error al leer preferencias de localStorage:', e);
        }
    }

    // Guardar estado actual en localStorage
    function guardarEstado() {
        try {
            localStorage.setItem(CLAVE_STORAGE, JSON.stringify(estado));
        } catch (e) {
            console.warn('[Accesibilidad] Error al guardar preferencias:', e);
        }
    }

    // Aplicar estado actual al DOM
    function aplicarEstado() {
        const raiz = document.documentElement;

        // 1. Escala tipográfica
        raiz.style.setProperty('--font-scale', estado.fontScale);

        // 2. Alto contraste
        if (estado.highContrast) {
            raiz.dataset.contrast = 'high';
        } else {
            delete raiz.dataset.contrast;
        }

        // 3. Lectura fácil / Dislexia
        if (estado.dyslexiaFont) {
            raiz.dataset.dyslexia = 'true';
        } else {
            delete raiz.dataset.dyslexia;
        }

        // 4. Resaltado de enlaces y botones
        if (estado.highlightLinks) {
            raiz.dataset.highlight = 'true';
        } else {
            delete raiz.dataset.highlight;
        }

        // 5. Lector por voz activado
        if (estado.ttsEnabled) {
            raiz.dataset.tts = 'true';
        } else {
            delete raiz.dataset.tts;
            detenerVoz();
        }

        actualizarControlesUI();
    }

    // Sincronizar los botones del panel con el estado activo
    function actualizarControlesUI() {
        // Escala tipográfica
        const botonesFuente = document.querySelectorAll('[data-a11y-font]');
        botonesFuente.forEach(btn => {
            const val = parseFloat(btn.dataset.a11yFont);
            const activo = Math.abs(val - estado.fontScale) < 0.01;
            btn.classList.toggle('is-active', activo);
            btn.setAttribute('aria-pressed', String(activo));
        });

        // Toggles booleanos
        const toggleContraste = document.getElementById('a11yToggleContrast');
        if (toggleContraste) {
            toggleContraste.checked = estado.highContrast;
            toggleContraste.setAttribute('aria-checked', String(estado.highContrast));
        }

        const toggleDislexia = document.getElementById('a11yToggleDyslexia');
        if (toggleDislexia) {
            toggleDislexia.checked = estado.dyslexiaFont;
            toggleDislexia.setAttribute('aria-checked', String(estado.dyslexiaFont));
        }

        const toggleEnlaces = document.getElementById('a11yToggleHighlight');
        if (toggleEnlaces) {
            toggleEnlaces.checked = estado.highlightLinks;
            toggleEnlaces.setAttribute('aria-checked', String(estado.highlightLinks));
        }

        const toggleTTS = document.getElementById('a11yToggleTTS');
        if (toggleTTS) {
            toggleTTS.checked = estado.ttsEnabled;
            toggleTTS.setAttribute('aria-checked', String(estado.ttsEnabled));
        }
    }

    // ================================================================
    // SÍNTESIS DE VOZ (Web Speech API)
    // ================================================================
    function inicializarVoces() {
        if (!('speechSynthesis' in window)) return;

        const seleccionarVoz = () => {
            const voces = window.speechSynthesis.getVoices();
            vozEspanol = voces.find(v => v.lang === 'es-AR') ||
                         voces.find(v => v.lang.startsWith('es-')) ||
                         voces.find(v => v.lang.startsWith('es')) ||
                         null;
        };

        seleccionarVoz();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = seleccionarVoz;
        }
    }

    function detenerVoz() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        reproduciendoId = null;
        actualizarBotonesAudio();
    }

    function leerTexto(texto, cardId, alTerminar) {
        if (!('speechSynthesis' in window)) {
            alert('La síntesis de voz no está soportada en tu navegador actual.');
            return;
        }

        window.speechSynthesis.cancel();

        if (reproduciendoId === cardId) {
            detenerVoz();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(texto);
        if (vozEspanol) utterance.voice = vozEspanol;
        utterance.lang = 'es-AR';
        utterance.rate = 0.95; // Velocidad cómoda y clara
        utterance.pitch = 1.0;

        reproduciendoId = cardId;
        actualizarBotonesAudio();

        utterance.onend = () => {
            reproduciendoId = null;
            actualizarBotonesAudio();
            if (alTerminar) alTerminar();
        };

        utterance.onerror = () => {
            reproduciendoId = null;
            actualizarBotonesAudio();
        };

        window.speechSynthesis.speak(utterance);
    }

    function actualizarBotonesAudio() {
        const botones = document.querySelectorAll('.btn-escuchar-card');
        botones.forEach(btn => {
            const id = btn.dataset.cardId;
            const sonando = (reproduciendoId && reproduciendoId === id);
            btn.classList.toggle('is-playing', sonando);
            btn.setAttribute('aria-pressed', String(sonando));
            btn.innerHTML = sonando
                ? '<span aria-hidden="true">⏹</span> <span>Detener</span>'
                : '<span aria-hidden="true">🔊</span> <span>Escuchar</span>';
        });
    }

    // Construye el texto narrativo de una tarjeta para el lector
    function extraerTextoTarjeta(cardEl) {
        const titulo = cardEl.querySelector('.card-title, h3, h2')?.textContent?.trim() || '';
        const institucion = cardEl.querySelector('.card-info p:first-child, .institucion-tag')?.textContent?.trim() || '';
        const badges = Array.from(cardEl.querySelectorAll('.badge, .tipo-badge')).map(b => b.textContent.trim()).join(', ');
        const duracion = cardEl.querySelector('[data-duracion], .card-info p:last-child')?.textContent?.trim() || '';

        let speech = `Carrera: ${titulo}. `;
        if (institucion) speech += `Institución: ${institucion}. `;
        if (badges) speech += `Características: ${badges}. `;
        if (duracion) speech += `Duración: ${duracion}.`;

        return speech;
    }

    // ================================================================
    // GESTIÓN DEL MODAL / PANEL DE ACCESIBILIDAD
    // ================================================================
    function abrirPanel() {
        const panel = document.getElementById('panelAccesibilidad');
        const btnToggle = document.getElementById('btnAccesibilidad');
        if (!panel) return;

        elementoPrevioFoco = document.activeElement;
        panel.hidden = false;
        panel.classList.add('is-open');
        btnToggle?.setAttribute('aria-expanded', 'true');

        // Foco al primer elemento accionable o botón de cierre
        const primerElemento = panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        primerElemento?.focus();

        document.addEventListener('keydown', manejarTrampaFoco);
    }

    function cerrarPanel() {
        const panel = document.getElementById('panelAccesibilidad');
        const btnToggle = document.getElementById('btnAccesibilidad');
        if (!panel || panel.hidden) return;

        panel.classList.remove('is-open');
        panel.hidden = true;
        btnToggle?.setAttribute('aria-expanded', 'false');

        document.removeEventListener('keydown', manejarTrampaFoco);

        // Restaurar foco al botón disparador
        if (elementoPrevioFoco && typeof elementoPrevioFoco.focus === 'function') {
            elementoPrevioFoco.focus();
        } else {
            btnToggle?.focus();
        }
    }

    function togglePanel() {
        const panel = document.getElementById('panelAccesibilidad');
        if (!panel || panel.hidden) {
            abrirPanel();
        } else {
            cerrarPanel();
        }
    }

    function manejarTrampaFoco(e) {
        if (e.key === 'Escape') {
            cerrarPanel();
            return;
        }

        if (e.key !== 'Tab') return;

        const panel = document.getElementById('panelAccesibilidad');
        if (!panel) return;

        const elementosInteractivos = panel.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (elementosInteractivos.length === 0) return;

        const primero = elementosInteractivos[0];
        const ultimo = elementosInteractivos[elementosInteractivos.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === primero) {
                e.preventDefault();
                ultimo.focus();
            }
        } else {
            if (document.activeElement === ultimo) {
                e.preventDefault();
                primero.focus();
            }
        }
    }

    // ================================================================
    // ATAJOS DE TECLADO GLOBALES
    // ================================================================
    function configurarAtajosTeclado() {
        document.addEventListener('keydown', (e) => {
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            const esInput = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;

            // Atajo 1: "/" para buscar (si no está escribiendo ya en un campo)
            if (e.key === '/' && !esInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
                return;
            }

            // Atajo 2: Alt + A para abrir/cerrar panel de accesibilidad
            if ((e.altKey && (e.key === 'a' || e.key === 'A')) || (e.altKey && e.code === 'KeyA')) {
                e.preventDefault();
                togglePanel();
                return;
            }

            // Atajo 3: Escape cierra cualquier modal, panel o drawer abierto
            if (e.key === 'Escape') {
                const panelA11y = document.getElementById('panelAccesibilidad');
                if (panelA11y && !panelA11y.hidden) {
                    cerrarPanel();
                    return;
                }
            }
        });
    }

    // ================================================================
    // VINCULACIÓN DE EVENTOS DEL DOM
    // ================================================================
    function configurarEventosPanel() {
        const btnToggle = document.getElementById('btnAccesibilidad');
        const btnCerrar = document.getElementById('a11yCloseButton');
        const overlay = document.getElementById('a11yOverlay');
        const btnReset = document.getElementById('a11yResetButton');

        btnToggle?.addEventListener('click', togglePanel);
        btnCerrar?.addEventListener('click', cerrarPanel);
        overlay?.addEventListener('click', cerrarPanel);

        // Selector de tamaño de fuente
        const botonesFuente = document.querySelectorAll('[data-a11y-font]');
        botonesFuente.forEach(btn => {
            btn.addEventListener('click', () => {
                estado.fontScale = parseFloat(btn.dataset.a11yFont) || 1;
                aplicarEstado();
                guardarEstado();
            });
        });

        // Toggle Alto Contraste
        const toggleContraste = document.getElementById('a11yToggleContrast');
        toggleContraste?.addEventListener('change', (e) => {
            estado.highContrast = e.target.checked;
            aplicarEstado();
            guardarEstado();
        });

        // Toggle Dislexia / Lectura fácil
        const toggleDislexia = document.getElementById('a11yToggleDyslexia');
        toggleDislexia?.addEventListener('change', (e) => {
            estado.dyslexiaFont = e.target.checked;
            aplicarEstado();
            guardarEstado();
        });

        // Toggle Destacar Enlaces
        const toggleEnlaces = document.getElementById('a11yToggleHighlight');
        toggleEnlaces?.addEventListener('change', (e) => {
            estado.highlightLinks = e.target.checked;
            aplicarEstado();
            guardarEstado();
        });

        // Toggle Lector por Voz
        const toggleTTS = document.getElementById('a11yToggleTTS');
        toggleTTS?.addEventListener('change', (e) => {
            estado.ttsEnabled = e.target.checked;
            aplicarEstado();
            guardarEstado();
        });

        // Botón Restablecer
        btnReset?.addEventListener('click', () => {
            detenerVoz();
            estado = { ...estadoPorDefecto };
            aplicarEstado();
            guardarEstado();
        });
    }

    // Observador para insertar y gestionar botones "Escuchar" en las tarjetas
    function configurarObserverTarjetas() {
        // Delegación de clic en todo el documento para botones .btn-escuchar-card
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-escuchar-card');
            if (!btn) return;

            e.preventDefault();
            e.stopPropagation();

            const card = btn.closest('.card, .carrera-card, .platform-card, .curso-card');
            if (!card) return;

            const cardId = btn.dataset.cardId || card.dataset.id || card.dataset.carreraId || Math.random().toString();
            btn.dataset.cardId = cardId;

            const textoALeer = extraerTextoTarjeta(card);
            leerTexto(textoALeer, cardId);
        });
    }

    // Inicialización del módulo
    function inicializar() {
        cargarEstado();
        aplicarEstado();
        inicializarVoces();
        configurarEventosPanel();
        configurarAtajosTeclado();
        configurarObserverTarjetas();
    }

    // Exponer API en ventana para interoperabilidad
    window.BENAccesibilidad = {
        abrirPanel,
        cerrarPanel,
        togglePanel,
        leerTexto,
        detenerVoz,
        obtenerEstado: () => ({ ...estado })
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
