FROM node:23-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && apt-get install -y unzip

COPY package*.json ./
RUN npm install
RUN npm install -g prisma

COPY . .
RUN chmod +x fetch-artifacts.sh

EXPOSE 3000

ENTRYPOINT ["fetch-artifacts.sh"]
CMD ["npm", "run", "start:dev"]