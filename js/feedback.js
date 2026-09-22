/**
 * Módulo de Feedback y Reporte de Fallos para BEN
 * 
 * Permite a los usuarios enviar sugerencias o reportar errores de forma integrada y minimalista.
 * Se conecta con FormSubmit.co para el envío de correos sin requerir servidor backend propio.
 */

(() => {
    'use strict';

    // Configuración del endpoint de destino
    const DESTINO_EMAIL = 'tomilucero2015@gmail.com';
    const FORMSUBMIT_URL = `https://formsubmit.co/ajax/${DESTINO_EMAIL}`;

    // Elementos del DOM
    let btnAbrirModal = null;
    let modal = null;
    let overlay = null;
    let btnCerrarModal = null;
    let form = null;
    let tipoBotones = [];
    let mensajeInput = null;
    let emailInput = null;
    let labelMensaje = null;
    let errorMensaje = null;
    let errorEmail = null;
    let btnEnviar = null;
    let contenedorExito = null;
    let contenedorError = null;
    let btnAceptarExito = null;
    let btnReintentar = null;

    // Estado del módulo
    let tipoActual = 'sugerencia'; // 'sugerencia' | 'fallo'
    let elementoPrevioFoco = null;
    let enviando = false;

    /**
     * Textos adaptativos según el tipo seleccionado
     */
    const TEXTOS_TIPO = {
        sugerencia: {
            label: '¿Qué te gustaría sugerir o mejorar en BEN?',
            placeholder: 'Escribí tu sugerencia o recomendación aquí...',
            tituloModal: 'Sugerencias o Ideas',
            icono: '💡'
        },
        fallo: {
            label: '¿Qué error encontraste y cómo ocurrió?',
            placeholder: 'Describí qué falló, en qué carrera o sección estabas, etc...',
            tituloModal: 'Reportar un Fallo o Error',
            icono: '⚠️'
        }
    };

    /**
     * Inicialización del módulo cuando el DOM esté listo
     */
    function inicializar() {
        btnAbrirModal = document.getElementById('btnAbrirFeedback');
        modal = document.getElementById('modalFeedback');
        if (!modal) return;

        overlay = document.getElementById('overlayFeedback');
        btnCerrarModal = document.getElementById('btnCerrarFeedback');
        form = document.getElementById('formFeedback');
        tipoBotones = Array.from(document.querySelectorAll('.btn-tipo-feedback'));
        mensajeInput = document.getElementById('feedbackMensaje');
        emailInput = document.getElementById('feedbackEmail');
        labelMensaje = document.getElementById('labelFeedbackMensaje');
        errorMensaje = document.getElementById('feedbackErrorMensaje');
        errorEmail = document.getElementById('feedbackErrorEmail');
        btnEnviar = document.getElementById('btnEnviarFeedback');
        contenedorExito = document.getElementById('feedbackExito');
        contenedorError = document.getElementById('feedbackErrorEnvio');
        btnAceptarExito = document.getElementById('btnFeedbackAceptarExito');
        btnReintentar = document.getElementById('btnFeedbackReintentar');

        vincularEventos();
    }

    /**
     * Asignación de event listeners con delegación y manejo accesible
     */
    function vincularEventos() {
        if (btnAbrirModal) {
            btnAbrirModal.addEventListener('click', abrirModal);
        }

        if (btnCerrarModal) {
            btnCerrarModal.addEventListener('click', cerrarModal);
        }

        if (overlay) {
            overlay.addEventListener('click', cerrarModal);
        }

        // Selección de tipo (Sugerencia vs Fallo)
        tipoBotones.forEach((btn, indice) => {
            btn.addEventListener('click', () => {
                const tipo = btn.dataset.tipo;
                if (tipo && tipo !== tipoActual) {
                    cambiarTipo(tipo);
                }
            });
            // WCAG 2.1 - 2.1.1 Teclado: en un radiogroup las flechas mueven la
            // selección (y el foco), Home/End van a los extremos. Se activa al
            // mover, que es el patrón esperado de un grupo de radios.
            btn.addEventListener('keydown', (event) => {
                const teclas = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
                if (!teclas.includes(event.key)) return;
                event.preventDefault();
                let destino = indice;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') destino = (indice + 1) % tipoBotones.length;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') destino = (indice - 1 + tipoBotones.length) % tipoBotones.length;
                if (event.key === 'Home') destino = 0;
                if (event.key === 'End') destino = tipoBotones.length - 1;
                const siguiente = tipoBotones[destino];
                if (!siguiente) return;
                cambiarTipo(siguiente.dataset.tipo);
                siguiente.focus();
            });
        });

        // Envío de formulario
        if (form) {
            form.addEventListener('submit', manejarEnvio);
        }

        // Botones en pantallas de estado
        if (btnAceptarExito) {
            btnAceptarExito.addEventListener('click', cerrarModal);
        }
        if (btnReintentar) {
            btnReintentar.addEventListener('click', () => {
                mostrarVistaFormulario();
            });
        }

        // Atajos de teclado: Escape para cerrar, Tab para atrapar foco
        document.addEventListener('keydown', manejarTeclado);
    }

    /**
     * Cambia la categoría entre 'sugerencia' y 'fallo' actualizando etiquetas y accesibilidad
     */
    function cambiarTipo(nuevoTipo) {
        tipoActual = nuevoTipo;
        const config = TEXTOS_TIPO[nuevoTipo] || TEXTOS_TIPO.sugerencia;

        tipoBotones.forEach(btn => {
            const activo = btn.dataset.tipo === nuevoTipo;
            btn.classList.toggle('is-active', activo);
            btn.setAttribute('aria-checked', activo ? 'true' : 'false');
            // Roving tabindex: dentro de un radiogroup el Tab entra una vez y las
            // flechas hacen el resto (WCAG 2.1 - 2.1.1 / patrón ARIA de radios).
            btn.tabIndex = activo ? 0 : -1;
        });

        if (labelMensaje) {
            labelMensaje.textContent = config.label;
        }
        if (mensajeInput) {
            mensajeInput.placeholder = config.placeholder;
        }

        limpiarErrores();
    }

    /**
     * Abre el modal y prepara el foco
     */
    // WCAG 2.1 - 4.1.2: el diálogo es aria-modal, así que lo de atrás queda
    // inerte de verdad (mismo criterio que el test vocacional y Mi lista).
    function alternarFondoInert(inert) {
        ['#copilotoPanel', '.site-footer', '.a11y-widget'].forEach(sel => {
            const el = document.querySelector(sel);
            if (el) el.inert = inert;
        });
        const main = document.querySelector('.catalog-layout');
        const hero = document.querySelector('.hero');
        if (main) main.inert = inert;
        if (hero) hero.inert = inert;
    }

    function abrirModal() {
        elementoPrevioFoco = document.activeElement;
        modal.hidden = false;
        modal.classList.add('is-open');
        document.body.classList.add('modal-abierto');
        alternarFondoInert(true);

        mostrarVistaFormulario();
        limpiarFormulario();

        // Foco inicial en el textarea
        setTimeout(() => {
            if (mensajeInput) mensajeInput.focus();
        }, 50);
    }

    /**
     * Cierra el modal y restaura el foco
     */
    function cerrarModal() {
        modal.classList.remove('is-open');
        modal.hidden = true;
        document.body.classList.remove('modal-abierto');
        alternarFondoInert(false);

        if (elementoPrevioFoco && typeof elementoPrevioFoco.focus === 'function') {
            elementoPrevioFoco.focus();
        }
    }

    /**
     * Muestra la vista del formulario y oculta mensajes de éxito o error
     */
    function mostrarVistaFormulario() {
        if (form) form.hidden = false;
        if (contenedorExito) contenedorExito.hidden = true;
        if (contenedorError) contenedorError.hidden = true;
        const selector = document.querySelector('.feedback-tipo-selector');
        if (selector) selector.hidden = false;
    }

    /**
     * Muestra la pantalla de éxito
     */
    function mostrarVistaExito() {
        if (form) form.hidden = true;
        if (contenedorError) contenedorError.hidden = true;
        if (contenedorExito) contenedorExito.hidden = false;
        const selector = document.querySelector('.feedback-tipo-selector');
        if (selector) selector.hidden = true;
        if (btnAceptarExito) btnAceptarExito.focus();
    }

    /**
     * Muestra la pantalla de error con opción de reintento
     */
    function mostrarVistaError() {
        if (form) form.hidden = true;
        if (contenedorExito) contenedorExito.hidden = true;
        if (contenedorError) contenedorError.hidden = false;
        const selector = document.querySelector('.feedback-tipo-selector');
        if (selector) selector.hidden = true;
        if (btnReintentar) btnReintentar.focus();
    }

    /**
     * Limpia los campos del formulario
     */
    function limpiarFormulario() {
        if (form) form.reset();
        cambiarTipo('sugerencia');
        limpiarErrores();
    }

    /**
     * Limpia mensajes de validación
     */
    function limpiarErrores() {
        if (errorMensaje) errorMensaje.hidden = true;
        if (errorEmail) errorEmail.hidden = true;
        if (mensajeInput) mensajeInput.removeAttribute('aria-invalid');
        if (emailInput) emailInput.removeAttribute('aria-invalid');
    }

    /**
     * Valida el formato de email
     */
    function esEmailValido(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Obtiene la sección activa actualmente en la aplicación
     */
    function obtenerSeccionActiva() {
        const tabActivo = document.querySelector('.section-tab.is-active');
        if (tabActivo) {
            const texto = tabActivo.querySelector('strong');
            return texto ? texto.textContent.trim() : tabActivo.dataset.seccion || 'Desconocida';
        }
        return 'Inicio / General';
    }

    /**
     * Procesa y valida el envío del formulario
     */
    async function manejarEnvio(event) {
        event.preventDefault();
        if (enviando) return;

        limpiarErrores();

        const mensaje = mensajeInput ? mensajeInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';

        let esValido = true;

        // Validación de mensaje obligatorio (al menos 3 caracteres)
        if (!mensaje || mensaje.length < 3) {
            if (errorMensaje) {
                errorMensaje.textContent = 'Por favor, escribí un mensaje para enviar.';
                errorMensaje.hidden = false;
            }
            if (mensajeInput) {
                mensajeInput.setAttribute('aria-invalid', 'true');
                mensajeInput.focus();
            }
            esValido = false;
        }

        // Validación de email solo si fue completado
        if (email && !esEmailValido(email)) {
            if (errorEmail) {
                errorEmail.textContent = 'Por favor, ingresá un correo electrónico válido.';
                errorEmail.hidden = false;
            }
            if (emailInput) {
                emailInput.setAttribute('aria-invalid', 'true');
                if (esValido) emailInput.focus();
            }
            esValido = false;
        }

        if (!esValido) return;

        // Preparar payload con metadatos de contexto útiles para depuración
        const payload = {
            _subject: `BEN Feedback: ${tipoActual.toUpperCase()} - ${new Date().toLocaleDateString('es-AR')}`,
            _template: 'table',
            _captcha: 'false',
            tipo: tipoActual === 'fallo' ? '⚠️ Reporte de Fallo' : '💡 Sugerencia / Recomendación',
            mensaje: mensaje,
            contacto_email: email || 'No provisto (anónimo)',
            seccion_activa: obtenerSeccionActiva(),
            url: window.location.href,
            resolucion_pantalla: `${window.innerWidth}x${window.innerHeight}`,
            modo_tema: document.documentElement.dataset.theme || 'light',
            fecha: new Date().toLocaleString('es-AR', { timeZoneName: 'short' })
        };

        // Estado de carga en el botón
        setEstadoBotonEnvio(true);

        try {
            const respuesta = await fetch(FORMSUBMIT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (respuesta.ok) {
                mostrarVistaExito();
            } else {
                console.warn('[Feedback] FormSubmit respondió con error:', respuesta.status);
                mostrarVistaError();
            }
        } catch (error) {
            console.error('[Feedback] Error de red al enviar reporte:', error);
            mostrarVistaError();
        } finally {
            setEstadoBotonEnvio(false);
        }
    }

    /**
     * Actualiza el estado visual del botón de envío durante la petición
     */
    function setEstadoBotonEnvio(estaCargando) {
        enviando = estaCargando;
        if (!btnEnviar) return;

        btnEnviar.disabled = estaCargando;
        const textoSpan = btnEnviar.querySelector('.btn-feedback-texto');
        const spinner = btnEnviar.querySelector('.btn-feedback-spinner');

        if (textoSpan) {
            textoSpan.textContent = estaCargando ? 'Enviando...' : 'Enviar mensaje';
        }
        if (spinner) {
            spinner.hidden = !estaCargando;
        }
    }

    /**
     * Maneja eventos de teclado globales (Escape y trampa de foco accesible)
     */
    function manejarTeclado(event) {
        if (!modal || modal.hidden) return;

        // Escape: cerrar modal
        if (event.key === 'Escape' || event.key === 'Esc') {
            event.preventDefault();
            cerrarModal();
            return;
        }

        // Trampa de foco (Tab / Shift+Tab dentro del modal)
        if (event.key === 'Tab') {
            const elementosEnfocables = modal.querySelectorAll(
                'button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])'
            );

            const visibles = Array.from(elementosEnfocables).filter(el => el.offsetParent !== null);
            if (visibles.length === 0) return;

            const primerElemento = visibles[0];
            const ultimoElemento = visibles[visibles.length - 1];

            if (event.shiftKey) {
                if (document.activeElement === primerElemento) {
                    event.preventDefault();
                    ultimoElemento.focus();
                }
            } else {
                if (document.activeElement === ultimoElemento) {
                    event.preventDefault();
                    primerElemento.focus();
                }
            }
        }
    }

    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
    } else {
        inicializar();
    }
})();
