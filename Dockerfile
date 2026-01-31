# StyleAI - Dockerfile para produção
FROM node:22-alpine AS base

# Instalar pnpm
RUN npm install -g pnpm

# Stage 1: Instalar dependências
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build da aplicação
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build front-end e back-end
RUN pnpm build

# Stage 3: Produção
FROM base AS runner
WORKDIR /app

# Copiar apenas arquivos necessários
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle ./drizzle

# Expor porta
EXPOSE 3000

# Variáveis de ambiente (serão sobrescritas em runtime)
ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicialização
CMD ["node", "dist/index.js"]
