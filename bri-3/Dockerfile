FROM node:latest

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Optional: install prisma CLI globally
RUN npm install -g prisma

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
