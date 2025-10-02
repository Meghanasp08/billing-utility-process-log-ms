# Stage 1: Build the application
FROM node:20-slim as build

RUN mkdir -p /usr/src/uniteybillingapi
# Set the working directory
WORKDIR /usr/src/uniteybillingapi

# Copy the package.json and install dependencies
COPY package*.json ./

RUN npm cache clean --force

RUN npm install --omit=dev --legacy-peer-deps && npm install -g @nestjs/cli
RUN apt-get update && apt-get install -y openssl

COPY . .

#RUN npx prisma generate --schema=prisma/schema.prisma

RUN npm run build

# Stage 2: Create the final image
FROM node:20-slim

ENV NODE_ENV=
ENV MONGO_INITDB_ROOT_USERNAME=mongoadmin
ENV MONGO_INITDB_ROOT_PASSWORD=rC9!*$L!Ku6pSSWx
ENV MONGO_URL=mongodb://mongoadmin:rC9!*%24L!Ku6pSSWx@uniteydata:27017/billing?authSource=admin
ENV ACCESS_TOKEN_SECRET=access_token_secret
ENV REFRESH_TOKEN_SECRET=refresh_token_secret
ENV ACCESS_TOKEN_EXPIRY=30000
ENV REFRESH_TOKEN_EXPIRY=300000

RUN mkdir -p /usr/src/uniteybillingapi
# Set the working directory
WORKDIR /usr/src/uniteybillingapi

# Copy the built application from the previous stage
COPY --from=build /usr/src/uniteybillingapi/dist ./dist
COPY --from=build /usr/src/uniteybillingapi/node_modules ./node_modules
COPY --from=build /usr/src/uniteybillingapi/package*.json ./
COPY --from=build /usr/src/uniteybillingapi/tsconfig*.json ./
#COPY --from=build /usr/src/uniteybillingapi/uploads ./uploads

# Copy the startup script into the container
#COPY add-host-start-node.sh /usr/local/bin/add-host-start-node.sh
#RUN echo "20.174.44.201 gateway.dev.switch.local" >> /etc/hosts

RUN npm cache clean --force

RUN npm install --omit=dev --legacy-peer-deps && npm install -g @nestjs/cli

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libglib2.0-0 \
    wget \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        fonts-noto \
        fonts-dejavu-core && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN npx puppeteer browsers install chrome
RUN apt-get update && apt-get install -y openssl

RUN ln -sf /usr/share/zoneinfo/Asia/Dubai /etc/localtime
# Expose the port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]