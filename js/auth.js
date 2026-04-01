function persistPortalSession(response) {
    localStorage.setItem('portal_token', response.token);
    localStorage.setItem('portal_user', JSON.stringify(response));
}

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

        persistPortalSession(response);
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

    const hasToken = !!localStorage.getItem('portal_token');
    const isLoginPage =
        window.location.pathname.endsWith('/index.html') ||
        window.location.pathname.endsWith('\\index.html') ||
        window.location.pathname === '/' ||
        window.location.pathname === '';

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

            persistPortalSession(response);
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
