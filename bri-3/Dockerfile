FROM node:latest

WORKDIR /app

# Copy only package manifests to install dependencies first and cache this layer
COPY package*.json ./

# Install all base dependencies
RUN npm install

# Install global tools separately to cache them independently
RUN npm install -g prisma

# Copy the rest of the app (source code, Prisma schema, etc.)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
