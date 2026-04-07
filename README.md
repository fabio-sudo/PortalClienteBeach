# Arena Portal Cliente no Azure App Service

Este portal foi preparado para rodar como um app Node simples no Azure App Service, servindo os arquivos HTML/CSS/JS da pasta e montando a configuracao de runtime via App Settings.

## O que subir no Azure

Crie o Web App com estas escolhas:

- Publicacao: `Codigo`
- Sistema operacional: `Linux`
- Stack de runtime: `Node 20 LTS` ou superior
- Plano: o menor que atender seu uso, preferencialmente na mesma regiao da API
- Startup Command: deixar em branco

## App Settings recomendadas

No recurso do App Service, abra `Environment variables` e cadastre:

- `PORTAL_API_PREFIX` = URL base da API com `/api`
- `PORTAL_GOOGLE_CLIENT_ID` = Client ID do Google Sign-In usado no portal

Exemplo:

- `PORTAL_API_PREFIX=https://
- `PORTAL_GOOGLE_CLIENT_ID=

## Teste local

Dentro desta pasta:

```powershell
npm start
```

Depois abra:

- `http://localhost:8080`

## Publicacao automatizada

Existe um workflow em `.github/workflows/deploy-portal-cliente.yml`.

Para usar no GitHub, configure estes secrets no repositorio:

- `AZURE_PORTAL_CLIENTE_WEBAPP_NAME`
- `AZURE_PORTAL_CLIENTE_PUBLISH_PROFILE`

O segundo valor vem de `Get publish profile` dentro do App Service no Azure.
