function persistPortalSession(response) {
    localStorage.setItem('portal_token', response.token);
    localStorage.setItem('portal_user', JSON.stringify(response));
}

function buildPortalSession(response) {
    return {
        token: response.token,
        name: response.name || response.username || 'Cliente',
        username: response.username || response.email || response.name || 'cliente',
        email: response.email || null,
        phone: response.phone || null,
        role: response.role || null,
        accountType: response.accountType || null,
        customerId: response.customerId ?? null,
        studentId: response.studentId ?? null,
        portalAccessEnabled: response.portalAccessEnabled ?? true,
        hasStudentBillingAccess: response.hasStudentBillingAccess ?? !!response.studentId
    };
}

function readStoredPortalSession() {
    try {
        return JSON.parse(localStorage.getItem('portal_user') || 'null');
    } catch {
        return null;
    }
}

async function completePortalCallbackLogin(token, fallbackProfile = null) {
    localStorage.setItem('portal_token', token);

    try {
        const profile = await api.request('/portal/profile/me');
        persistPortalSession(buildPortalSession({
            token,
            ...profile
        }));
        return;
    } catch (error) {
        if (fallbackProfile) {
            persistPortalSession(buildPortalSession({
                token,
                ...fallbackProfile
            }));
            return;
        }

        localStorage.removeItem('portal_token');
        throw error;
    }
}

window.syncPortalSessionProfile = async function () {
    const token = localStorage.getItem('portal_token');
    if (!token) {
        return null;
    }

    const currentSession = readStoredPortalSession() || {};
    const profile = await api.request('/portal/profile/me');
    const refreshedSession = buildPortalSession({
        ...currentSession,
        token,
        ...profile
    });

    persistPortalSession(refreshedSession);
    return refreshedSession;
};

function readPortalOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const hasRelevantParams =
        params.has('token') ||
        params.has('error') ||
        params.has('newUser');

    if (!hasRelevantParams) {
        return null;
    }

    return {
        token: (params.get('token') || '').trim(),
        email: (params.get('email') || '').trim(),
        name: (params.get('name') || '').trim(),
        newUser: params.get('newUser') === 'true',
        error: (params.get('error') || '').trim()
    };
}

function clearPortalOAuthCallback() {
    const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, cleanUrl);
}

window.startPortalGoogleLogin = function () {
    const redirectUrl = new URL('index.html', window.location.href);
    redirectUrl.search = '';
    redirectUrl.hash = '';

    window.location.href = `${API_URL}/portal/auth/google-mobile-start?redirectUri=${encodeURIComponent(redirectUrl.toString())}`;
};

window.handlePortalGoogleLogin = async function (googleResponse) {
    const errorMsg = document.getElementById('errorMessage');
    const loginForm = document.getElementById('loginForm');
    const submitButton = loginForm?.querySelector('button[type="submit"]');
    const originalText = submitButton?.textContent || 'Entrar no portal';

    if (errorMsg) {
        errorMsg.textContent = '';
    }

    if (submitButton) {
        submitButton.textContent = 'Autenticando com Google...';
        submitButton.disabled = true;
    }

    try {
        const response = await api.request('/portal/auth/google-login', 'POST', {
            credential: googleResponse.credential
        });

        persistPortalSession(buildPortalSession(response));
        window.location.href = 'dashboard.html';
    } catch (error) {
        if (errorMsg) {
            errorMsg.textContent = error.message || 'Nao foi possivel acessar o portal com Google.';
        }
    } finally {
        if (submitButton) {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMsg = document.getElementById('errorMessage');
    const googleButton = document.getElementById('portalGoogleLoginButton');

    const hasToken = !!localStorage.getItem('portal_token');
    const isLoginPage =
        window.location.pathname.endsWith('/index.html') ||
        window.location.pathname.endsWith('\\index.html') ||
        window.location.pathname === '/' ||
        window.location.pathname === '';
    const oauthCallback = readPortalOAuthCallback();

    if (googleButton) {
        googleButton.addEventListener('click', () => {
            if (errorMsg) {
                errorMsg.textContent = '';
            }

            startPortalGoogleLogin();
        });
    }

    if (oauthCallback) {
        const finalizeOAuthLogin = async () => {
            clearPortalOAuthCallback();

            if (oauthCallback.error) {
                if (errorMsg) {
                    errorMsg.textContent = oauthCallback.error;
                }
                return;
            }

            if (oauthCallback.newUser || !oauthCallback.token) {
                if (errorMsg) {
                    errorMsg.textContent = 'O e-mail usado no Google ainda nao esta liberado no portal. Fale com o administrador.';
                }
                return;
            }

            try {
                await completePortalCallbackLogin(oauthCallback.token, {
                    name: oauthCallback.name || oauthCallback.email || 'Cliente',
                    username: oauthCallback.email || oauthCallback.name || 'google',
                    email: oauthCallback.email || null
                });
                window.location.href = 'dashboard.html';
            } catch (error) {
                if (errorMsg) {
                    errorMsg.textContent = error.message || 'Nao foi possivel concluir o login com Google.';
                }
            }
        };

        finalizeOAuthLogin();
        return;
    }

    if (hasToken && isLoginPage) {
        window.location.href = 'dashboard.html';
        return;
    }

    if (!loginForm) {
        return;
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMsg.textContent = '';

        const submitButton = loginForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        submitButton.textContent = 'Acessando...';
        submitButton.disabled = true;

        try {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            const response = await api.request('/portal/auth/login', 'POST', { username, password });

            persistPortalSession(buildPortalSession(response));
            window.location.href = 'dashboard.html';
        } catch (error) {
            errorMsg.textContent = error.message || 'Nao foi possivel acessar o portal.';
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    });
});

function logout() {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_user');
    window.location.href = 'index.html';
}

function ensurePortalTrainingLink() {
    const nav = document.querySelector('.portal-nav-tabs');
    if (!nav || nav.querySelector('.portal-nav-link[href="treinos.html"]')) {
        return;
    }

    const currentFile = window.location.pathname.split('/').pop() || 'dashboard.html';
    const link = document.createElement('a');
    link.href = 'treinos.html';
    link.className = `portal-nav-link${currentFile === 'treinos.html' ? ' active' : ''}`;
    link.textContent = 'Treinos';

    const billingLink = nav.querySelector('.portal-nav-link[href="mensalidades.html"]');
    if (billingLink) {
        billingLink.insertAdjacentElement('beforebegin', link);
        return;
    }

    nav.appendChild(link);
}

document.addEventListener('DOMContentLoaded', () => {
    ensurePortalTrainingLink();
});
