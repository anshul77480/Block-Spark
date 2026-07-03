FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# NEXT_PUBLIC_API_URL is read by the browser, so it must point at the host-mapped
# backend port. Baked at build time; override via build-arg if needed.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
