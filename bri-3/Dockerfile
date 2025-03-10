# Use the official Node.js image as the base image
FROM node:20

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

COPY .env ./

# Install the application dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Setup prisma
# generate the prisma client
RUN npm run prisma:generate
# migrate the db to latest state
RUN npm run prisma:migrate:dev
# seed db
RUN npx prisma db seed

# Build the NestJS application
RUN npm run build

# Expose the application port
EXPOSE 3000

# Command to run the application
CMD ["node", "dist/main"]