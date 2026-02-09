setup:
	npm install

dev:
	npm run dev

test:
	npm run test

lint:
	npm run lint

typecheck:
	npm run typecheck

build:
	npm run build

security:
	npm run audit

check: lint typecheck test build security

smoke: build
	npm run smoke:browser

release: build
