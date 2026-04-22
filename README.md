# Arena Portal Cliente

Este frontend funciona em dois modos:

- local em Docker/Node, servindo `runtime-config.json` dinamicamente
- hospedagem estatica, como GitHub Pages, usando `js/runtime-config.json`

## Configuracao da API

O portal nao depende de servir arquivos pelo backend. A URL da API deve ser definida em runtime por um destes caminhos:

- `js/runtime-config.json`
- `window.ARENA_PORTAL_API_PREFIX`
- `meta[name="arena-api-prefix"]`

Exemplo de `js/runtime-config.json`:

```json
{
  "apiPrefix": "https://SEU-APP-AZURE.azurewebsites.net/api",
  "portalApiPrefix": "https://SEU-APP-AZURE.azurewebsites.net/api",
  "googleClientId": "SEU_GOOGLE_CLIENT_ID"
}
```

## Teste local

Dentro desta pasta:

```powershell
node server.js
```

Depois abra [http://localhost:8080](http://localhost:8080).

## Publicacao estatica

Antes de publicar em GitHub Pages, gere o `runtime-config.json` com a URL da API correta:

```powershell
cd "C:\Users\Admin\Desktop\ProjetoERPBeachTennis\Projeto Beach Tenis"
.\scripts\generate-runtime-config.ps1 -AdminApiPrefix "https://SEU-APP-AZURE.azurewebsites.net/api" -PortalApiPrefix "https://SEU-APP-AZURE.azurewebsites.net/api" -GoogleClientId "SEU_GOOGLE_CLIENT_ID"
```

Depois publique apenas os arquivos estaticos desta pasta no repositório do GitHub Pages.
