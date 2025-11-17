# Исправление: Добавить /api в конец URL

## Проблема
В консоли видно: `API URL: https://magnet-backend-566y.onrender.com`

Но должно быть: `https://magnet-backend-566y.onrender.com/api`

## Решение

### Шаг 1: Откройте Render Dashboard

1. Зайдите в https://dashboard.render.com
2. Выберите ваш **Frontend** сервис (`magnet-frontend`)

### Шаг 2: Исправьте переменную окружения

1. Перейдите в раздел **"Environment"** (слева в меню)
2. Найдите переменную `REACT_APP_API_URL`
3. Нажмите на неё для редактирования
4. Измените значение с:
   ```
   https://magnet-backend-566y.onrender.com
   ```
   
   На:
   ```
   https://magnet-backend-566y.onrender.com/api
   ```
   
   ⚠️ **ВАЖНО:** Добавьте `/api` в конец URL!

5. Нажмите **"Save Changes"**

### Шаг 3: Пересоберите Frontend

**ОБЯЗАТЕЛЬНО:** После изменения переменной нужно пересобрать!

1. В Render Dashboard выберите ваш Frontend сервис
2. Нажмите **"Manual Deploy"** (вверху справа)
3. Выберите **"Deploy latest commit"**
4. Дождитесь завершения деплоя (2-3 минуты)
5. Обновите страницу в браузере (Cmd+R)

### Шаг 4: Проверьте

1. Откройте сайт
2. Нажмите F12 (Cmd+Option+I)
3. В консоли должно быть: `API URL: https://magnet-backend-566y.onrender.com/api`
4. Попробуйте войти снова

---

## Правильное значение переменной

**Key:** `REACT_APP_API_URL`  
**Value:** `https://magnet-backend-566y.onrender.com/api`

⚠️ Обратите внимание на `/api` в конце!

