# 🚀 Quick Start - StyleAI

Guia rápido para rodar o StyleAI em menos de 5 minutos!

## ⚡ Opção 1: Desenvolvimento Local (Recomendado)

### Passo 1: Instalar dependências

```bash
# Instale Node.js 18+ (se não tiver)
# https://nodejs.org/

# Instale pnpm
npm install -g pnpm

# Instale as dependências do projeto
pnpm install
```

### Passo 2: Configurar banco de dados

**Opção A: TiDB Cloud (Gratuito, Mais Fácil)**

1. Acesse https://tidbcloud.com/
2. Crie conta gratuita
3. Crie cluster (tier gratuito)
4. Copie a connection string

**Opção B: MySQL Local**

```bash
# Instale MySQL
# Ubuntu: sudo apt install mysql-server
# macOS: brew install mysql

# Crie o banco
mysql -u root -p
CREATE DATABASE styleai;
```

### Passo 3: Configurar .env

```bash
# Copie o template
cp .env.example .env

# Edite o .env e adicione:
DATABASE_URL="mysql://usuario:senha@host:3306/styleai"
JWT_SECRET="seu-secret-min-32-chars-aqui-gere-um-aleatorio"
FAL_KEY="sua-chave-fal-ai"  # Opcional, mas recomendado
```

### Passo 4: Rodar migrações

```bash
pnpm db:push
```

### Passo 5: Iniciar o app

```bash
pnpm dev
```

✅ **Pronto!** Acesse: http://localhost:3000

---

## 🐳 Opção 2: Docker (Mais Rápido)

```bash
# 1. Configure o .env (apenas FAL_KEY se quiser provador virtual)
echo "FAL_KEY=sua-chave" > .env

# 2. Inicie tudo com Docker Compose
docker-compose up -d

# 3. Rode as migrações
docker-compose exec app pnpm db:push
```

✅ **Pronto!** Acesse: http://localhost:3000

---

## 🌐 Opção 3: Replit (Online, Sem Instalar Nada)

1. Acesse https://replit.com/
2. Clique em "Create Repl" → "Import from GitHub" ou faça upload do ZIP
3. Configure os Secrets (variáveis de ambiente):
   - `DATABASE_URL` (use TiDB Cloud gratuito)
   - `JWT_SECRET` (gere um aleatório)
   - `FAL_KEY` (opcional)
4. Clique em "Run"

✅ **Pronto!** O Replit vai instalar tudo automaticamente

---

## 🔑 Obtendo API Keys

### Fal.ai (Provador Virtual)

1. Acesse https://fal.ai/
2. Crie conta
3. Vá em "API Keys" → "Create new key"
4. Copie e cole em `FAL_KEY` no `.env`

**Custo**: ~$0.075/geração (~R$ 0,40)

---

## 📝 Primeiro Acesso

1. Acesse http://localhost:3000
2. Clique em "Criar Conta Grátis"
3. Faça o quiz de estilo (5 perguntas)
4. Comece a usar! 🎉

### Funcionalidades principais:

- **Meu Guarda-Roupa**: Adicione fotos das suas roupas
- **Provador Virtual**: Experimente looks com IA
- **Cápsulas Inteligentes**: Crie coleções de looks
- **Analytics**: Veja estatísticas de uso

---

## 🐛 Problemas Comuns

### "Cannot connect to database"
- Verifique se `DATABASE_URL` está correto
- Teste: `mysql -h host -u user -p`

### "Port 3000 already in use"
- Mude a porta em `vite.config.ts`
- Ou mate o processo: `lsof -ti:3000 | xargs kill`

### "FAL_KEY is not defined"
- Adicione no `.env` ou ignore (provador virtual não funcionará)

### Imagens não aparecem
- Certifique-se de que `client/public/images/` existe
- Verifique permissões: `chmod -R 755 client/public/`

---

## 📚 Próximos Passos

- Leia o [README.md](README.md) completo para detalhes
- Explore a [estrutura do projeto](README.md#-estrutura-do-projeto)
- Configure [deploy em produção](README.md#-deploy-em-produção)

---

**Dúvidas?** Abra uma issue ou consulte a documentação completa!
