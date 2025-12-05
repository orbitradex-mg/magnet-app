# Настройка PostgreSQL на Render

## Шаг 1: Создание PostgreSQL базы данных на Render

1. Войдите в **Render Dashboard**: https://dashboard.render.com
2. Нажмите **"New +"** → **"PostgreSQL"**
3. Заполните форму:
   - **Name**: `magnet-app-database` (или любое другое имя)
   - **Database**: `magnet_db` (или любое другое имя)
   - **User**: будет автоматически создан
   - **Region**: выберите ближайший регион
   - **PostgreSQL Version**: оставьте последнюю версию
   - **Plan**: **Free** (бесплатно)
4. Нажмите **"Create Database"**

## Шаг 2: Получение Internal Database URL

1. После создания базы данных, откройте её в Render Dashboard
2. Найдите раздел **"Connection Info"**
3. Найдите **"Internal Database URL"** - это строка вида:
   ```
   postgresql://user:password@dpg-xxxxx-a.oregon-postgres.render.com/database_name
   ```
4. **Скопируйте этот URL** - он понадобится в следующем шаге

## Шаг 3: Настройка переменной окружения в Backend сервисе

1. В Render Dashboard откройте ваш **backend сервис** (`magnet-app-backend`)
2. Перейдите в раздел **"Environment"** (или **"Environment Variables"**)
3. Нажмите **"Add Environment Variable"**
4. Добавьте:
   - **Key**: `DATABASE_URL`
   - **Value**: вставьте скопированный **Internal Database URL** из шага 2
5. Нажмите **"Save Changes"**

## Шаг 4: Перезапуск сервиса

1. После добавления переменной окружения Render автоматически перезапустит сервис
2. Или нажмите **"Manual Deploy"** → **"Deploy latest commit"**

## Шаг 5: Проверка

1. Откройте **Logs** вашего backend сервиса
2. Должно появиться сообщение:
   ```
   ✅ Connected to PostgreSQL database
   ✅ Database initialized with X existing order(s)
   ```

## Важно

- **Internal Database URL** работает только между сервисами Render
- Не используйте **External Connection String** - он требует дополнительной настройки
- База данных теперь будет **сохранять данные между перезапусками** ✅

## Локальная разработка

Для локальной разработки нужно установить PostgreSQL локально или использовать DATABASE_URL:

```bash
# Установите PostgreSQL локально
# Затем создайте базу данных:
createdb magnet_db

# В файле .env (создайте его в server/)
DATABASE_URL=postgresql://username:password@localhost:5432/magnet_db
```

Или используйте бесплатный PostgreSQL на:
- https://www.elephantsql.com/
- https://neon.tech/
- https://supabase.com/

## Что изменилось

- ✅ База данных теперь **PostgreSQL** вместо SQLite
- ✅ Данные **сохраняются** между перезапусками
- ✅ Поддержка переменных окружения **DATABASE_URL**
- ✅ Автоматическое создание таблиц при первом запуске


