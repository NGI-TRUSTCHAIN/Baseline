FROM node:23-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl

COPY package*.json ./
RUN npm install
RUN npm install -g prisma

COPY . .
COPY fetch-artifacts.sh /usr/local/bin/fetch-artifacts.sh
RUN chmod +x /usr/local/bin/fetch-artifacts.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/fetch-artifacts.sh"]
CMD ["npm", "run", "start:dev"]