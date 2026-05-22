Веб-приложение для планирования дня: календарь, временные слоты, типы активностей и сводка. FastAPI + PostgreSQL + React. Гостевой режим (localStorage) или аккаунт с JWT и 2FA.

# Навигация по проекту

Краткая карта репозитория для просмотра на GitHub.

## Основное

- `docker-compose.yml` — PostgreSQL и pgAdmin для локальной разработки.
- `requirements.txt` — Python-зависимости backend.

## Backend

- `app/main.py` — точка входа FastAPI, CORS, подключение роутеров.
- `app/routers/` — API-маршруты:
  - `auth.py` — регистрация, вход, JWT, 2FA;
  - `schedule.py` — расписание и сводка;
  - `activity_types.py` — типы активности и импорт из CSV;
  - `health.py` — проверка API.
- `app/models/` — SQLAlchemy-модели БД.
- `app/schemas/` — Pydantic-схемы запросов и ответов.
- `app/crud/` — операции с БД.
- `app/services/` — функциональные модули: TOTP, CSV-импорт, нормализация и fuzzy-поиск активностей.

## Frontend

- `frontend/src/App.tsx` — основной UI и логика приложения.
- `frontend/src/components/` — компоненты календаря, дня и сводки.
- `frontend/src/api.ts` — запросы к backend через `fetch`.
- `frontend/src/summaryUtils.ts` — локальный расчёт сводки для гостевого режима.
- `frontend/src/types.ts` — TypeScript-типы DTO.
- `frontend/package.json` — зависимости и npm-скрипты.

## Данные

- `datasets/` — CSV-датасет типов активности.
- PostgreSQL хранит пользователей, типы активности и записи расписания.

## Быстрый запуск

Backend:

```bash
docker compose up -d postgres
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Открыть приложение: `http://localhost:5173`.
