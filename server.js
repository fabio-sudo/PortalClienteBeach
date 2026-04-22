const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_RUNTIME_CONFIG = {
    apiPrefix: '',
    portalApiPrefix: '',
    googleClientId: '1001684908537-r8544gu7n3j51c3ioci59cn3fjkh6nh8.apps.googleusercontent.com'
};

const STATIC_ROOT = __dirname;
const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8'
};

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

function buildRuntimeConfig() {
    const apiPrefix = sanitizeConfigValue(process.env.PORTAL_API_PREFIX)
        || sanitizeConfigValue(process.env.PORTAL_API_URL)
        || DEFAULT_RUNTIME_CONFIG.apiPrefix;
    const portalApiPrefix = sanitizeConfigValue(process.env.PORTAL_API_PREFIX)
        || sanitizeConfigValue(process.env.PORTAL_API_URL)
        || DEFAULT_RUNTIME_CONFIG.portalApiPrefix;
    const googleClientId = sanitizeConfigValue(process.env.PORTAL_GOOGLE_CLIENT_ID)
        || DEFAULT_RUNTIME_CONFIG.googleClientId;

    return {
        apiPrefix,
        portalApiPrefix,
        googleClientId
    };
}

function writeJson(response, statusCode, payload, headers = {}) {
    response.writeHead(statusCode, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        ...headers
    });
    response.end(JSON.stringify(payload));
}

function writeText(response, statusCode, message) {
    response.writeHead(statusCode, {
        'Content-Type': 'text/plain; charset=utf-8'
    });
    response.end(message);
}

function resolveStaticPath(requestPath) {
    const decodedPath = decodeURIComponent(requestPath.split('?')[0] || '/');
    const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    const absoluteRoot = path.resolve(STATIC_ROOT);
    const absoluteTarget = path.resolve(absoluteRoot, relativePath);

    if (!absoluteTarget.toLowerCase().startsWith(`${absoluteRoot.toLowerCase()}${path.sep.toLowerCase()}`)
        && absoluteTarget.toLowerCase() !== absoluteRoot.toLowerCase()) {
        return null;
    }

    return absoluteTarget;
}

function serveStaticFile(filePath, response) {
    fs.stat(filePath, (statError, stats) => {
        if (statError) {
            writeText(response, 404, 'Arquivo nao encontrado.');
            return;
        }

        if (stats.isDirectory()) {
            serveStaticFile(path.join(filePath, 'index.html'), response);
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[extension] || 'application/octet-stream';

        response.writeHead(200, {
            'Content-Type': contentType
        });

        const stream = fs.createReadStream(filePath);
        stream.on('error', () => {
            if (!response.headersSent) {
                writeText(response, 500, 'Erro ao ler arquivo.');
                return;
            }

            response.destroy();
        });
        stream.pipe(response);
    });
}

const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (requestUrl.pathname === '/health') {
        writeJson(response, 200, {
            status: 'ok',
            service: 'arena-portal-cliente',
            timestamp: new Date().toISOString()
        });
        return;
    }

    if (requestUrl.pathname === '/js/runtime-config.json') {
        writeJson(response, 200, buildRuntimeConfig());
        return;
    }

    const filePath = resolveStaticPath(requestUrl.pathname);
    if (!filePath) {
        writeText(response, 403, 'Acesso negado.');
        return;
    }

    serveStaticFile(filePath, response);
});

server.listen(PORT, HOST, () => {
    console.log(`Arena Portal Cliente iniciado em http://${HOST}:${PORT}`);
});
