FROM node:20-slim

ENV NODE_ENV=development
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY . .
RUN npx hardhat compile
RUN chmod +x docker-entrypoint.sh

EXPOSE 8545
ENTRYPOINT ["./docker-entrypoint.sh"]
