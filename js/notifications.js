let portalFeedbackState = {
    resolve: null,
    dismissible: true
};

document.addEventListener('DOMContentLoaded', () => {
    initializeNotificationsDropdown();
    ensurePortalFeedbackModal();
});

function initializeNotificationsDropdown() {
    const button = document.getElementById('btnNotifications');
    if (!button) {
        return;
    }

    button.addEventListener('click', (event) => {
        event.stopPropagation();
        const dropdown = document.getElementById('notificationsDropdown');
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', (event) => {
        const dropdown = document.getElementById('notificationsDropdown');
        if (dropdown && dropdown.style.display === 'block' && !event.target.closest('.notifications-wrapper')) {
            dropdown.style.display = 'none';
        }
    });

    const markAllButton = document.getElementById('btnMarkAllRead');
    if (markAllButton) {
        markAllButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await api.request('/portal/notifications/read-all', 'PUT');
            loadNotifications();
        });
    }

    loadNotifications();
    startPortalRealtimeNotifications();
    setInterval(() => {
        if (!document.hidden) {
            loadNotifications();
        }
    }, 30000);
}

function ensurePortalFeedbackModal() {
    if (document.getElementById('portalFeedbackModal')) {
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'portalFeedbackModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content glass-panel portal-feedback-card" data-tone="info" role="dialog" aria-modal="true" aria-labelledby="portalFeedbackTitle">
            <div class="portal-feedback-icon" id="portalFeedbackIcon" aria-hidden="true">i</div>
            <div class="portal-feedback-body">
                <h3 id="portalFeedbackTitle">Aviso</h3>
                <p id="portalFeedbackMessage">Mensagem</p>
            </div>
            <div class="portal-feedback-actions" id="portalFeedbackActions"></div>
        </div>
    `;

    modal.addEventListener('click', (event) => {
        if (event.target === modal && portalFeedbackState.dismissible) {
            closePortalFeedback(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.classList.contains('hidden') && portalFeedbackState.dismissible) {
            closePortalFeedback(false);
        }
    });

    document.body.appendChild(modal);
}

function getPortalFeedbackToneMeta(tone) {
    switch (tone) {
        case 'success':
            return { icon: 'OK', title: 'Tudo certo' };
        case 'error':
            return { icon: '!', title: 'Algo deu errado' };
        case 'warning':
            return { icon: '!', title: 'Atencao' };
        default:
            return { icon: 'i', title: 'Aviso' };
    }
}

function openPortalFeedback(options = {}) {
    ensurePortalFeedbackModal();

    const modal = document.getElementById('portalFeedbackModal');
    const card = modal.querySelector('.portal-feedback-card');
    const icon = document.getElementById('portalFeedbackIcon');
    const title = document.getElementById('portalFeedbackTitle');
    const message = document.getElementById('portalFeedbackMessage');
    const actions = document.getElementById('portalFeedbackActions');

    const tone = options.tone || 'info';
    const toneMeta = getPortalFeedbackToneMeta(tone);
    portalFeedbackState.dismissible = options.dismissible !== false;

    card.dataset.tone = tone;
    icon.textContent = options.icon || toneMeta.icon;
    title.textContent = options.title || toneMeta.title;
    message.textContent = options.message || '';
    actions.innerHTML = '';

    const buttons = Array.isArray(options.actions) && options.actions.length
        ? options.actions
        : [{ label: 'Ok', value: true, className: 'btn btn-primary' }];

    buttons.forEach((buttonConfig, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = buttonConfig.className || (index === buttons.length - 1 ? 'btn btn-primary' : 'btn btn-ghost');
        button.style.width = 'auto';
        button.textContent = buttonConfig.label;
        button.addEventListener('click', () => closePortalFeedback(buttonConfig.value));
        actions.appendChild(button);
    });

    document.body.classList.add('modal-open');
    modal.classList.remove('hidden');

    const focusTarget = actions.querySelector('button:last-child') || actions.querySelector('button');
    if (focusTarget) {
        setTimeout(() => focusTarget.focus(), 0);
    }

    return new Promise((resolve) => {
        portalFeedbackState.resolve = resolve;
    });
}

function closePortalFeedback(result) {
    const modal = document.getElementById('portalFeedbackModal');
    if (!modal || modal.classList.contains('hidden')) {
        return;
    }

    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');

    if (typeof portalFeedbackState.resolve === 'function') {
        const resolve = portalFeedbackState.resolve;
        portalFeedbackState.resolve = null;
        resolve(result);
    }
}

window.portalFeedback = {
    alert(message, options = {}) {
        return openPortalFeedback({
            ...options,
            message
        });
    },
    success(message, options = {}) {
        return openPortalFeedback({
            tone: 'success',
            title: 'Operacao concluida',
            ...options,
            message
        });
    },
    error(message, options = {}) {
        return openPortalFeedback({
            tone: 'error',
            title: 'Nao foi possivel continuar',
            ...options,
            message
        });
    },
    confirm(message, options = {}) {
        return openPortalFeedback({
            tone: options.tone || 'warning',
            title: options.title || 'Confirmar acao',
            message,
            dismissible: options.dismissible !== false,
            actions: options.actions || [
                { label: options.cancelText || 'Voltar', value: false, className: 'btn btn-ghost' },
                { label: options.confirmText || 'Confirmar', value: true, className: 'btn btn-primary' }
            ]
        });
    }
};

async function loadNotifications() {
    try {
        const notifications = await api.request('/portal/notifications');
        const unreadCount = notifications.filter(notification => !notification.isRead).length;

        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        }

        const list = document.getElementById('notificationsList');
        if (!list) {
            return;
        }

        if (notifications.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted); text-align:center; font-size:0.9rem; margin-top:10px;">Voce nao tem notificacoes.</p>';
            return;
        }

        list.innerHTML = '';
        notifications.slice(0, 10).forEach((notification) => {
            const isRead = notification.isRead;
            const row = document.createElement('div');
            row.className = `portal-notification-row ${isRead ? 'read' : 'unread'}`;

            row.innerHTML = `
                <strong>${notification.title}</strong>
                <p>${notification.message}</p>
                <span>${new Date(notification.createdAt).toLocaleDateString('pt-BR')}</span>
            `;

            row.addEventListener('click', async () => {
                if (!isRead) {
                    await api.request(`/portal/notifications/${notification.id}/read`, 'PUT');
                    loadNotifications();
                }
            });

            list.appendChild(row);
        });
    } catch (error) {
        console.error('Erro notificacoes', error);
    }
}

async function ensureSignalRClient() {
    if (window.signalR) {
        return window.signalR;
    }

    if (window.__portalSignalRLoader) {
        return window.__portalSignalRLoader;
    }

    window.__portalSignalRLoader = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.7/signalr.min.js';
        script.async = true;
        script.onload = () => resolve(window.signalR);
        script.onerror = () => reject(new Error('Nao foi possivel carregar o cliente SignalR do portal.'));
        document.head.appendChild(script);
    });

    return window.__portalSignalRLoader;
}

function schedulePortalNotificationsRefresh() {
    if (window.__portalNotificationsRefreshTimer) {
        window.clearTimeout(window.__portalNotificationsRefreshTimer);
    }

    window.__portalNotificationsRefreshTimer = window.setTimeout(() => {
        loadNotifications();
    }, 200);
}

function schedulePortalRealtimeRestart(delay = 5000) {
    if (window.__portalRealtimeRetryTimer) {
        window.clearTimeout(window.__portalRealtimeRetryTimer);
    }

    if (!localStorage.getItem('portal_token')) {
        return;
    }

    window.__portalRealtimeRetryTimer = window.setTimeout(() => {
        window.__portalRealtimeStarted = false;
        startPortalRealtimeNotifications();
    }, delay);
}

async function startPortalRealtimeNotifications() {
    if (window.__portalRealtimeStarted || !localStorage.getItem('portal_token')) {
        return;
    }

    try {
        await ensureSignalRClient();
    } catch (error) {
        console.warn(error.message || 'SignalR indisponivel no portal.');
        return;
    }

    if (!window.signalR || !window.buildHubUrl) {
        return;
    }

    let connection = window.__portalRealtimeConnection;

    if (!connection) {
        connection = new window.signalR.HubConnectionBuilder()
            .withUrl(window.buildHubUrl('/hubs/notifications'), {
                accessTokenFactory: () => localStorage.getItem('portal_token') || ''
            })
            .withAutomaticReconnect()
            .build();

        connection.on('notificationReceived', (notification) => {
            window.dispatchEvent(new CustomEvent('portal:notification-received', { detail: notification || null }));
            schedulePortalNotificationsRefresh();
        });

        connection.onreconnected(() => schedulePortalNotificationsRefresh());
        connection.onclose(() => {
            window.__portalRealtimeStarted = false;
            schedulePortalRealtimeRestart();
        });

        window.__portalRealtimeConnection = connection;
    }

    if (window.signalR.HubConnectionState
        && connection.state !== window.signalR.HubConnectionState.Disconnected) {
        return;
    }

    try {
        await connection.start();
        window.__portalRealtimeStarted = true;
        schedulePortalNotificationsRefresh();
    } catch (error) {
        window.__portalRealtimeStarted = false;
        console.warn('Nao foi possivel iniciar a conexao SignalR do portal.', error);
        schedulePortalRealtimeRestart();
    }
}
