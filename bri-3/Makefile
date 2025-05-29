# Makefile for NestJS + Postgres + NATS Dev Environment

# Compose file path (optional if not using default name)
COMPOSE=docker compose

# Containers
APP_1=nestjs-app
APP_2=nestjs-app-2
DB_1=postgres
DB_2=postgres-2
NATS=nats

# Commands
up:
	$(COMPOSE) up --build

up-detached:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

down-v:
	$(COMPOSE) down -v

restart: down up

restart-v: down-v up

logs:
	$(COMPOSE) logs -f

logs-app-1:
	$(COMPOSE) logs -f $(APP_1)

logs-app-2:
	$(COMPOSE) logs -f $(APP_2)

logs-nats:
	$(COMPOSE) logs -f $(NATS)

ps:
	$(COMPOSE) ps

exec-app-1:
	$(COMPOSE) exec $(APP_1) sh

exec-app-2:
	$(COMPOSE) exec $(APP_2) sh

# Prisma commands inside app containers
prisma-generate:
	$(COMPOSE) exec $(APP_1) npx prisma generate

prisma-migrate:
	$(COMPOSE) exec $(APP_1) npx prisma migrate dev --name init

prisma-seed:
	$(COMPOSE) exec $(APP_1) npx prisma db seed

# Dev shortcut for rebuild
rebuild:
	$(COMPOSE) build --no-cache

