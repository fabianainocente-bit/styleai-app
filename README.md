# StyleAI - Assistente Pessoal de Moda com IA

Um aplicativo completo de moda com IA que oferece guarda-roupa virtual, provador virtual com tecnologia FASHN, cápsulas de looks personalizadas e muito mais.

## 🚀 Funcionalidades

- **Guarda-Roupa Virtual**: Organize suas roupas digitalmente com fotos
- **Provador Virtual com IA**: Experimente roupas usando tecnologia FASHN Virtual Try-On
- **Cápsulas Inteligentes**: Crie coleções de looks para diferentes ocasiões
- **Planejador de Viagens**: Monte malas otimizadas
- **Analytics de Uso**: Veja estatísticas de peças mais usadas e economia
- **Sistema de Badges**: Gamificação com conquistas (Sustentável, Criativo, etc)
- **Quiz de Estilo**: Onboarding personalizado
- **Compartilhamento Social**: Compartilhe looks no Instagram

## 📋 Pré-requisitos

- **Node.js** 18+ ([baixar aqui](https://nodejs.org/))
- **pnpm** (gerenciador de pacotes): `npm install -g pnpm`
- **Banco de dados MySQL** ou **TiDB Cloud** (gratuito)
- **Conta Fal.ai** para API FASHN (opcional, mas recomendado)

## 🔧 Instalação

### 1. Clone ou extraia o projeto

```bash
# Se baixou o ZIP, extraia e entre na pasta
cd styleai-export
```

### 2. Instale as dependências

```bash
pnpm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Banco de Dados (obrigatório)
DATABASE_URL="mysql://usuario:senha@host:3306/styleai"

# Autenticação (obrigatório)
JWT_SECRET="seu-secret-super-seguro-aqui-min-32-chars"

# OAuth Manus (se quiser usar autenticação Manus)
VITE_APP_ID="seu-app-id"
OAUTH_SERVER_URL="https://oauth.manus.im"
VITE_OAUTH_PORTAL_URL="https://portal.manus.im"
OWNER_OPEN_ID="seu-open-id"
OWNER_NAME="Seu Nome"

# API FASHN para Provador Virtual (opcional mas recomendado)
FAL_KEY="sua-chave-fal-ai"

# Forge APIs (opcional - para LLM e storage)
BUILT_IN_FORGE_API_URL="https://api.manus.im"
BUILT_IN_FORGE_API_KEY="sua-chave"
VITE_FRONTEND_FORGE_API_KEY="sua-chave-frontend"
VITE_FRONTEND_FORGE_API_URL="https://api.manus.im"

# Analytics (opcional)
VITE_ANALYTICS_ENDPOINT="https://analytics.exemplo.com"
VITE_ANALYTICS_WEBSITE_ID="seu-website-id"

# App Config
VITE_APP_TITLE="StyleAI"
VITE_APP_LOGO="/logo.png"
```

### 4. Configure o banco de dados

#### Opção A: TiDB Cloud (Gratuito, Recomendado)

1. Acesse [TiDB Cloud](https://tidbcloud.com/)
2. Crie uma conta gratuita
3. Crie um cluster (tier gratuito disponível)
4. Copie a connection string e cole em `DATABASE_URL`

#### Opção B: MySQL Local

```bash
# Instale MySQL
# Ubuntu/Debian:
sudo apt install mysql-server

# macOS (com Homebrew):
brew install mysql

# Crie o banco de dados
mysql -u root -p
CREATE DATABASE styleai;
```

### 5. Execute as migrações do banco

```bash
pnpm db:push
```

Isso criará todas as tabelas necessárias:
- `users` (usuários)
- `wardrobe_items` (peças do guarda-roupa)
- `outfits` (looks salvos)
- `capsules` (cápsulas de looks)
- `trips` (viagens planejadas)
- `mirror_analyses` (análises do espelho inteligente)
- `social_shares` (compartilhamentos sociais)
- `user_badges` (badges conquistadas)

### 6. Inicie o servidor de desenvolvimento

```bash
pnpm dev
```

O app estará disponível em: **http://localhost:3000**

## 🌐 Deploy em Produção

### Build para produção

```bash
pnpm build
```

Isso gera:
- Front-end otimizado em `client/dist/`
- Back-end compilado em `dist/`

### Deploy em Replit

1. Acesse [Replit](https://replit.com/)
2. Clique em "Create Repl" → "Import from GitHub" ou faça upload do ZIP
3. Configure as variáveis de ambiente no painel "Secrets"
4. Execute: `pnpm install && pnpm db:push && pnpm dev`

### Deploy em Google Cloud Run

```bash
# Build da imagem Docker
docker build -t styleai .

# Deploy no Cloud Run
gcloud run deploy styleai --image styleai --platform managed
```

### Deploy em Vercel/Netlify

⚠️ **Não recomendado**: Este app usa tRPC com backend Node.js, que requer servidor persistente. Plataformas serverless podem ter limitações.

## 🔑 Obtendo API Keys

### Fal.ai (Provador Virtual)

1. Acesse [Fal.ai](https://fal.ai/)
2. Crie uma conta
3. Vá em "API Keys" e gere uma nova chave
4. Cole em `FAL_KEY` no `.env`
5. **Custo**: ~$0.075 por geração (~R$ 0,40)

### OAuth Manus (Autenticação)

Se quiser usar autenticação Manus:
1. Acesse [Manus Platform](https://manus.im/)
2. Crie um app OAuth
3. Configure as variáveis `VITE_APP_ID`, `OAUTH_SERVER_URL`, etc.

**Alternativa**: Implemente seu próprio sistema de autenticação (JWT já está configurado)

## 📁 Estrutura do Projeto

```
styleai-export/
├── client/                    # Front-end React
│   ├── public/               # Assets estáticos (imagens, ícones)
│   ├── src/
│   │   ├── _core/           # Hooks e utilitários core
│   │   ├── components/      # Componentes reutilizáveis
│   │   │   ├── ui/         # shadcn/ui components
│   │   │   ├── DashboardLayout.tsx
│   │   │   └── ...
│   │   ├── pages/          # Páginas do app
│   │   │   ├── Home.tsx
│   │   │   ├── Wardrobe.tsx
│   │   │   ├── VirtualTryOn.tsx
│   │   │   ├── Capsules.tsx
│   │   │   └── ...
│   │   ├── App.tsx         # Rotas principais
│   │   ├── main.tsx        # Entry point
│   │   └── index.css       # Estilos globais (Tailwind)
│   └── index.html          # HTML base
├── server/                   # Back-end Node.js/Express
│   ├── _core/               # Infraestrutura (tRPC, OAuth, etc)
│   ├── routers.ts           # Rotas tRPC (API)
│   ├── db.ts                # Helpers de banco de dados
│   └── storage.ts           # Helpers de S3
├── drizzle/                 # Schema e migrações do banco
│   ├── schema.ts            # Definição das tabelas
│   └── migrations/          # Migrações SQL
├── shared/                  # Código compartilhado (tipos, constantes)
├── package.json             # Dependências
├── vite.config.ts           # Config do Vite (build)
├── tsconfig.json            # Config do TypeScript
└── README.md                # Este arquivo
```

## 🛠️ Tecnologias Utilizadas

### Front-end
- **React 19** - Framework UI
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Estilos utilitários
- **shadcn/ui** - Componentes UI modernos
- **Wouter** - Roteamento leve
- **tRPC** - Type-safe API client
- **@use-gesture/react** - Gestos touch (pinch zoom)

### Back-end
- **Node.js 22** - Runtime
- **Express 4** - Servidor HTTP
- **tRPC 11** - API type-safe
- **Drizzle ORM** - Database ORM
- **MySQL/TiDB** - Banco de dados
- **Jose** - JWT authentication
- **AWS S3** - Storage de imagens

### APIs Externas
- **Fal.ai** - FASHN Virtual Try-On API
- **Manus Forge** - LLM e storage (opcional)

## 🧪 Testes

```bash
# Rodar testes unitários
pnpm test

# Rodar testes em modo watch
pnpm test --watch
```

## 📝 Scripts Disponíveis

```bash
pnpm dev          # Inicia servidor de desenvolvimento
pnpm build        # Build para produção
pnpm start        # Inicia servidor de produção
pnpm test         # Roda testes
pnpm db:push      # Aplica migrações do banco
pnpm format       # Formata código com Prettier
```

## 🐛 Troubleshooting

### Erro: "Cannot connect to database"
- Verifique se `DATABASE_URL` está correto no `.env`
- Teste a conexão: `mysql -h host -u usuario -p`

### Erro: "FAL_KEY is not defined"
- Adicione `FAL_KEY` no `.env` ou desative o provador virtual

### Erro: "Port 3000 already in use"
- Mude a porta em `vite.config.ts` (linha `server.port`)

### Imagens não aparecem
- Verifique se a pasta `client/public/images/` existe
- Certifique-se de que as imagens foram copiadas corretamente

## 📄 Licença

Este projeto é de código aberto. Sinta-se livre para usar, modificar e distribuir.

## 🤝 Contribuindo

Contribuições são bem-vindas! Abra uma issue ou pull request.

## 📧 Suporte

Para dúvidas ou problemas, abra uma issue no repositório ou entre em contato.

---

**Desenvolvido com ❤️ usando Manus AI Platform**
