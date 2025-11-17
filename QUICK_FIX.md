# Быстрое решение проблемы входа

## Вижу проблему: Frontend на `magnet-frontend-yosa.onrender.com`

### Шаг 1: Откройте консоль браузера

1. На странице входа нажмите **Cmd+Option+I** (или правой кнопкой → "Проверить элемент")
2. Перейдите на вкладку **"Console"**
3. Попробуйте войти снова
4. Посмотрите, какая ошибка там написана

### Шаг 2: Проверьте переменную окружения в Render

**В Render Dashboard:**

1. Откройте ваш **Frontend** сервис (`magnet-frontend`)
2. Перейдите в раздел **"Environment"**
3. Проверьте, есть ли переменная `REACT_APP_API_URL`
4. Если её нет или она неправильная:

**Добавьте/Измените:**
- **Key:** `REACT_APP_API_URL`
- **Value:** `https://ваш-backend-name.onrender.com/api`

⚠️ **ВАЖНО:** Замените `ваш-backend-name` на реальное имя вашего backend сервиса!

Например, если backend называется `magnet-backend`, то:
- **Value:** `https://magnet-backend.onrender.com/api`

### Шаг 3: Пересоберите Frontend

После изменения переменной окружения:

1. В Render Dashboard выберите ваш Frontend сервис
2. Нажмите **"Manual Deploy"** → **"Deploy latest commit"**
3. Дождитесь завершения деплоя (2-3 минуты)
4. Обновите страницу в браузере (Cmd+R)

### Шаг 4: Проверьте Backend

Откройте в браузере URL вашего backend (например: `https://magnet-backend.onrender.com`)

Должна быть ошибка 404 - это нормально, значит сервер работает.

---

## Как узнать имя вашего Backend?

1. Зайдите в Render Dashboard
2. Посмотрите список сервисов
3. Найдите сервис типа "Web Service" (не Static Site)
4. Его имя и есть имя backend
5. URL будет: `https://имя-сервиса.onrender.com`

---

## Если не помогло

Напишите мне:
1. Что написано в консоли браузера (F12 → Console)
2. Какое имя у вашего Backend сервиса в Render
3. Какая переменная `REACT_APP_API_URL` установлена (если есть)

