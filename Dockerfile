FROM node:20-alpine

# OpenSSL is required by Prisma's query engine on Alpine.
RUN apk add --no-cache openssl

WORKDIR /app

# Copy manifests AND the Prisma schema before install, because the postinstall
# hook (`prisma generate`) needs schema.prisma to exist.
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm install

# Copy the rest of the source. At runtime this layer is shadowed by the bind
# mount in docker-compose.yml, but the baked node_modules (including the
# generated Prisma client) survives via the anonymous volume.
COPY . .

EXPOSE 3000 5555

CMD ["npm", "run", "dev"]
