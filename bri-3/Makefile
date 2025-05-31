IMAGE_NAME = bri-3-nestjs-app

.PHONY: up up-detached down build rebuild logs

build:
	docker build -t $(IMAGE_NAME) .

up: build
	docker compose up -d

down:
	docker compose down -v --remove-orphans

test-origination:
	./test/e2e-test-origination.sh

logs:
	docker compose logs -f
