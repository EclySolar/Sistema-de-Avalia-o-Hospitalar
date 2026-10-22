# Sistema de Gestão da Experiência do Paciente — FHDOD

Aplicação inicial para pesquisas de satisfação hospitalar, com Node.js, Express, MySQL e interface HTML responsiva.

## Instalação no Windows

1. Instale Node.js LTS e MySQL 8.
2. Copie `.env.exemplo` para `.env` e informe as credenciais locais.
3. No PowerShell, execute:

```powershell
npm install
npm run db:init
npm run db:migrate
npm run db:seed
$env:name='Administrador'; $env:email='admin@exemplo.local'; $env:password='uma-senha-forte'; npm run admin:create
npm run dev
```

Abra `http://localhost:3000`. Pesquisas públicas ficam em `/pesquisa/<slug>`, por exemplo `/pesquisa/pronto-atendimento`.

## Perfis

- `SUPER_ADMIN`: usuários, setores, categorias e indicadores gerais.
- `SECTOR_ADMIN`: perguntas e indicadores somente dos setores vinculados.
- `MANAGEMENT`: indicadores dos setores vinculados, somente leitura.

## Endpoints

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET|POST|PUT /api/admin/sectors`; `GET|POST /api/admin/categories`
- `GET|POST /api/admin/questions`; `GET /api/admin/dashboard`; `GET|POST /api/admin/users`
- `GET /api/public/sectors/:slug`; `POST /api/public/surveys/:slug`
- `GET /api/health/database`

## Segurança e pendências

Senhas usam bcrypt; sessões usam cookie HttpOnly/SameSite; login possui rate limit; SQL é parametrizado; autorização por perfil e setor ocorre no servidor. Antes de produção hospitalar, é indispensável revisão de segurança/LGPD, HTTPS, store persistente de sessão, CSRF completo e política institucional de retenção.
