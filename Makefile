# Local ports sit together, outside the usual dev defaults.
WEB_PORT ?= 18610
WORKER_PORT ?= 18611

.DEFAULT_GOAL := help
.PHONY: help install dev emulators worker web test

help:
	@printf '%s\n' \
	  'make install    npm install in web/, worker/ and firebase/' \
	  'make dev        the Firebase emulators, the Worker and the web app together' \
	  'make test       every test, including the Firestore rules in the emulator' \
	  '' \
	  'App        http://localhost:$(WEB_PORT)' \
	  'Worker     http://127.0.0.1:$(WORKER_PORT)/api/health' \
	  'Emulators  http://127.0.0.1:18614'

install:
	npm install --prefix web
	npm install --prefix worker
	npm install --prefix firebase

# The emulators need Java 21. Nothing here touches a cloud account.
dev:
	$(MAKE) -j3 emulators worker web

emulators:
	cd firebase && npx firebase emulators:start --project demo-kudocoin

worker:
	cd worker && npx wrangler dev --env dev --port $(WORKER_PORT)

web:
	cd web && VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-kudocoin VITE_API_URL=http://127.0.0.1:$(WORKER_PORT) npm run dev

test:
	npm test --prefix web
	npm test --prefix worker
	npm test --prefix firebase
