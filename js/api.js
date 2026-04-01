const DEFAULT_PORTAL_API_PREFIX = 'https://arena-api-h5cqf9b4brbsbnfb.brazilsouth-01.azurewebsites.net/api';
const DEFAULT_LOCAL_HTTP_API_PREFIX = 'http://localhost:5151/api';
const DEFAULT_LOCAL_HTTPS_API_PREFIX = 'https://localhost:7044/api';
const DEFAULT_GOOGLE_CLIENT_ID = '1001684908537-r8544gu7n3j51c3ioci59cn3fjkh6nh8.apps.googleusercontent.com';

function trimTrailingSlash(value) {
    return value ? value.replace(/\/+$/, '') : '';
}

function sanitizeConfigValue(value) {
    if (!value) {
        return '';
    }

    const normalized = String(value).trim();
    if (!normalized || (normalized.startsWith('__') && normalized.endsWith('__'))) {
        return '';
    }

    return normalized;
}

function isLocalEnvironment() {
    return window.location.protocol === 'file:'
        || window.location.hostname === 'localhost'
        || window.location.hostname === '127.0.0.1';
}

function getDefaultPortalApiPrefix() {
    if (!isLocalEnvironment()) {
        return DEFAULT_PORTAL_API_PREFIX;
    }

    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        && (window.location.port === '5151' || window.location.port === '7044')) {
        return `${window.location.origin}/api`;
    }

    if (window.location.protocol === 'https:') {
        return DEFAULT_LOCAL_HTTPS_API_PREFIX;
    }

    return DEFAULT_LOCAL_HTTP_API_PREFIX;
}

function loadRuntimeConfig() {
    const explicitConfigUrl = sanitizeConfigValue(window.ARENA_RUNTIME_CONFIG_URL);

    try {
        const currentScript = document.currentScript
            || Array.from(document.scripts).find(script => script.src && script.src.includes('/js/api.js'))
            || Array.from(document.scripts).find(script => script.src && script.src.endsWith('js/api.js'));

        const scriptSource = currentScript?.src;
        const candidateUrls = [];

        if (explicitConfigUrl) {
            candidateUrls.push(explicitConfigUrl);
        }

        if (scriptSource) {
            candidateUrls.push(new URL('runtime-config.json', scriptSource).toString());
        }

        if (window.location.origin && window.location.origin !== 'null') {
            candidateUrls.push(new URL('/js/runtime-config.json', window.location.origin).toString());
        }

        if (!candidateUrls.length) {
            return {};
        }

        for (const configUrl of [...new Set(candidateUrls)]) {
            const request = new XMLHttpRequest();
            request.open('GET', configUrl, false);
            request.send(null);

            if (request.status >= 200 && request.status < 300 && request.responseText) {
                const parsed = JSON.parse(request.responseText);
                return parsed && typeof parsed === 'object' ? parsed : {};
            }
        }
    } catch (error) {
        console.warn('Nao foi possivel carregar runtime-config.json do portal.', error);
    }

    return {};
}

const runtimeConfig = Object.assign(
    {
        apiPrefix: getDefaultPortalApiPrefix(),
        portalApiPrefix: getDefaultPortalApiPrefix(),
        googleClientId: DEFAULT_GOOGLE_CLIENT_ID
    },
    loadRuntimeConfig(),
    window.ARENA_RUNTIME_CONFIG || {}
);
window.ARENA_RUNTIME_CONFIG = runtimeConfig;

if (!window.ARENA_PORTAL_API_PREFIX) {
    window.ARENA_PORTAL_API_PREFIX = isLocalEnvironment()
        ? ''
        : sanitizeConfigValue(runtimeConfig.portalApiPrefix || runtimeConfig.apiPrefix);
}

if (!window.ARENA_GOOGLE_CLIENT_ID) {
    window.ARENA_GOOGLE_CLIENT_ID = sanitizeConfigValue(runtimeConfig.googleClientId);
}

function resolvePortalApiUrl() {
    const globalConfiguredValue = sanitizeConfigValue(window.ARENA_PORTAL_API_PREFIX);
    const metaConfiguredValue = sanitizeConfigValue(
        document.querySelector('meta[name="arena-api-prefix"]')?.content
    );
    const persistedConfiguredValue = sanitizeConfigValue(localStorage.getItem('arena_api_prefix'));

    if (isLocalEnvironment()) {
        const normalizedLocalPersistedValue = trimTrailingSlash(persistedConfiguredValue);
        const isLocalPersistedValue = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api$/i.test(normalizedLocalPersistedValue);

        if (persistedConfiguredValue && !isLocalPersistedValue) {
            localStorage.removeItem('arena_api_prefix');
        }

        return isLocalPersistedValue
            ? normalizedLocalPersistedValue
            : trimTrailingSlash(getDefaultPortalApiPrefix());
    }

    if (globalConfiguredValue) {
        return trimTrailingSlash(globalConfiguredValue);
    }

    if (metaConfiguredValue) {
        return trimTrailingSlash(metaConfiguredValue);
    }

    if (persistedConfiguredValue) {
        return trimTrailingSlash(persistedConfiguredValue);
    }

    return trimTrailingSlash(getDefaultPortalApiPrefix());
}

const API_URL = resolvePortalApiUrl();
function buildPortalApiUnavailableMessage(targetUrl = API_URL) {
    const environmentHint = isLocalEnvironment()
        ? 'Confirme que o backend local esta ativo em http://localhost:5151 ou https://localhost:7044.'
        : 'Confirme que o App Service da API esta iniciado e com CORS liberado para o portal do cliente.';

    return `Nao foi possivel conectar a API configurada (${targetUrl}). ${environmentHint}`;
}

window.buildHubUrl = function (path = '/hubs/notifications') {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const apiOrigin = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;
    return `${apiOrigin}${normalizedPath}`;
};

class ApiService {
    async request(endpoint, method = 'GET', data = null) {
        const token = localStorage.getItem('portal_token');
        const headers = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const config = {
            method,
            headers
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(data);
        }

        let response;

        try {
            response = await fetch(`${API_URL}${endpoint}`, config);
        } catch (error) {
            throw new Error(buildPortalApiUnavailableMessage(`${API_URL}${endpoint}`));
        }

        if (response.status === 401) {
            localStorage.removeItem('portal_token');
            localStorage.removeItem('portal_user');

            if (!window.location.href.includes('index.html')) {
                window.location.href = 'index.html';
            }

            throw new Error('Sessao expirada. Faca login novamente.');
        }

        const responseData = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(responseData?.message || 'Erro de conexao com o servidor.');
        }

        return responseData;
    }
}

const api = new ApiService();
