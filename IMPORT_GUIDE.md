# 📥 Guia de Importação - StyleAI

Como importar o código fonte do StyleAI em diferentes plataformas e ferramentas.

---

## 🔧 Replit

### Método 1: Upload Direto (Mais Fácil)

1. Acesse https://replit.com/
2. Faça login ou crie uma conta
3. Clique em **"Create Repl"**
4. Selecione **"Import from ZIP"**
5. Faça upload do arquivo `styleai-source-code.zip`
6. Aguarde o upload e extração
7. Configure os **Secrets** (variáveis de ambiente):
   - Clique no ícone de cadeado 🔒 na barra lateral
   - Adicione:
     ```
     DATABASE_URL=mysql://usuario:senha@host:3306/styleai
     JWT_SECRET=seu-secret-min-32-chars
     FAL_KEY=sua-chave-fal-ai
     ```
8. Clique em **"Run"**
9. Aguarde instalação automática das dependências
10. Acesse o app pela URL gerada pelo Replit

### Método 2: GitHub Import

1. Faça upload do código para um repositório GitHub
2. No Replit, clique em **"Import from GitHub"**
3. Cole a URL do repositório
4. Configure os Secrets (passo 7 acima)
5. Clique em **"Run"**

---

## 🤖 Google AI Studio / Vertex AI

### Preparação

Google AI Studio não roda aplicações web completas, mas você pode:

1. **Usar o código para análise/referência**:
   - Extraia o ZIP
   - Abra os arquivos no AI Studio para análise de código
   - Use para gerar variações ou melhorias

2. **Deploy no Google Cloud Run**:
   ```bash
   # 1. Extraia o ZIP
   unzip styleai-source-code.zip
   cd styleai-export
   
   # 2. Configure o .env
   cp .env.example .env
   # Edite o .env com suas credenciais
   
   # 3. Build da imagem Docker
   gcloud builds submit --tag gcr.io/SEU-PROJECT-ID/styleai
   
   # 4. Deploy no Cloud Run
   gcloud run deploy styleai \
     --image gcr.io/SEU-PROJECT-ID/styleai \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars DATABASE_URL="...",JWT_SECRET="...",FAL_KEY="..."
   ```

---

## 🐙 GitHub Codespaces

1. Faça upload do código para um repositório GitHub
2. No repositório, clique em **"Code"** → **"Codespaces"** → **"Create codespace"**
3. Aguarde o ambiente ser criado
4. Configure o `.env`:
   ```bash
   cp .env.example .env
   nano .env  # Edite com suas credenciais
   ```
5. Instale dependências e rode:
   ```bash
   pnpm install
   pnpm db:push
   pnpm dev
   ```
6. Acesse pela porta forwarded (Codespaces faz isso automaticamente)

---

## 💻 VS Code Local

1. Extraia o ZIP:
   ```bash
   unzip styleai-source-code.zip
   cd styleai-export
   ```

2. Abra no VS Code:
   ```bash
   code .
   ```

3. Configure o `.env`:
   ```bash
   cp .env.example .env
   # Edite o .env com suas credenciais
   ```

4. Instale extensões recomendadas:
   - ESLint
   - Prettier
   - Tailwind CSS IntelliSense
   - TypeScript

5. Instale dependências:
   ```bash
   pnpm install
   ```

6. Rode as migrações:
   ```bash
   pnpm db:push
   ```

7. Inicie o servidor:
   ```bash
   pnpm dev
   ```

8. Acesse: http://localhost:3000

---

## 🌊 Vercel

⚠️ **Limitação**: Vercel é serverless, este app precisa de servidor persistente. Não recomendado.

**Alternativa**: Use Vercel apenas para o front-end e hospede o back-end em outro lugar (Railway, Render, etc.)

---

## 🚂 Railway

1. Acesse https://railway.app/
2. Faça login com GitHub
3. Clique em **"New Project"** → **"Deploy from GitHub repo"**
4. Faça upload do código para GitHub primeiro
5. Selecione o repositório
6. Configure as variáveis de ambiente:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `FAL_KEY`
   - `PORT=3000`
7. Railway detectará automaticamente o `package.json` e rodará `pnpm build && pnpm start`
8. Aguarde o deploy
9. Acesse pela URL gerada

---

## 🎨 Render

1. Acesse https://render.com/
2. Faça login
3. Clique em **"New +"** → **"Web Service"**
4. Conecte seu repositório GitHub
5. Configure:
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `pnpm start`
   - **Environment Variables**:
     - `DATABASE_URL`
     - `JWT_SECRET`
     - `FAL_KEY`
     - `NODE_ENV=production`
6. Clique em **"Create Web Service"**
7. Aguarde o deploy
8. Acesse pela URL gerada

---

## 🐳 Docker (Qualquer Plataforma)

### Desenvolvimento Local

```bash
# 1. Extraia o ZIP
unzip styleai-source-code.zip
cd styleai-export

# 2. Configure o .env
cp .env.example .env
# Edite com suas credenciais

# 3. Inicie com Docker Compose
docker-compose up -d

# 4. Rode as migrações
docker-compose exec app pnpm db:push

# 5. Acesse
# http://localhost:3000
```

### Deploy em Produção (AWS, GCP, Azure)

```bash
# 1. Build da imagem
docker build -t styleai .

# 2. Rode o container
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e JWT_SECRET="..." \
  -e FAL_KEY="..." \
  --name styleai \
  styleai
```

---

## 📱 Expo / React Native (Mobile)

Este projeto é web-only (React + Vite). Para converter para mobile:

1. Use **Capacitor** (recomendado):
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init
   npx cap add ios
   npx cap add android
   ```

2. Ou use **React Native Web** (mais trabalho):
   - Reescreva componentes para React Native
   - Mantenha o back-end separado

---

## 🧪 Sandbox/Playground Online

### CodeSandbox

1. Acesse https://codesandbox.io/
2. Clique em **"Create Sandbox"** → **"Import from GitHub"**
3. Cole a URL do repositório GitHub
4. Configure os Secrets (variáveis de ambiente)
5. Aguarde instalação automática

### StackBlitz

1. Acesse https://stackblitz.com/
2. Clique em **"Import from GitHub"**
3. Cole a URL do repositório
4. Configure as variáveis de ambiente
5. Aguarde instalação

⚠️ **Limitação**: Sandboxes online podem ter limitações de memória/CPU para apps grandes.

---

## 🔍 Verificação Pós-Importação

Após importar em qualquer plataforma, verifique:

1. ✅ Dependências instaladas: `node_modules/` existe
2. ✅ Build funcionando: `pnpm build` sem erros
3. ✅ Banco conectado: `pnpm db:push` sem erros
4. ✅ Servidor iniciado: `pnpm dev` roda sem crashes
5. ✅ App acessível: http://localhost:3000 carrega

---

## 🐛 Problemas Comuns

### "pnpm: command not found"
```bash
npm install -g pnpm
```

### "Cannot find module 'vite'"
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### "Database connection failed"
- Verifique `DATABASE_URL` no `.env`
- Certifique-se de que o banco está acessível

### "Port 3000 already in use"
- Mude a porta em `vite.config.ts`
- Ou mate o processo: `lsof -ti:3000 | xargs kill -9`

---

## 📚 Recursos Adicionais

- [README.md](README.md) - Documentação completa
- [QUICKSTART.md](QUICKSTART.md) - Guia rápido de instalação
- `.env.example` - Template de variáveis de ambiente

---

**Dúvidas?** Consulte a documentação ou abra uma issue!
