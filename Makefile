.PHONY: up down build logs smoke test seed reset

up: ## Stack starten (baut Images bei Bedarf)
	docker compose up -d --build

down: ## Stack stoppen
	docker compose down

logs: ## Logs folgen
	docker compose logs -f api pocketbase

smoke: ## End-to-End-Smoke-Test (17 Checks)
	ADMIN_INITIAL_PASSWORD="$$(grep '^ADMIN_INITIAL_PASSWORD=' .env.local | cut -d= -f2-)" node scripts/smoke.mjs

test: ## API-Unit-Tests
	cd api && node --test src/

reset: ## Volumes löschen (frischer Zustand, Admin-Passwort aus .env.local)
	docker compose down -v
	docker compose up -d --build
