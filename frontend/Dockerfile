FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy config files needed for build
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY tsconfig.json ./
COPY next.config.js ./
COPY eslint.config.mjs ./

# Install ALL dependencies including devDependencies
RUN npm install --include=dev

# Copy source files
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
