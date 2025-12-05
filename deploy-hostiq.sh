#!/bin/bash

# Скрипт для автоматической настройки приложения на VPS HOSTiQ.ua
# ВНИМАНИЕ: Выполняйте только на чистом VPS сервере
# Использование: bash deploy-hostiq.sh

set -e

echo "🚀 Начинаем развертывание Magnet App на HOSTiQ.ua VPS..."

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Пожалуйста, запустите скрипт с правами root: sudo bash deploy-hostiq.sh"
    exit 1
fi

# Обновление системы
echo "📦 Обновление системы..."
apt update && apt upgrade -y

# Установка Node.js
echo "📦 Установка Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi
echo "✅ Node.js $(node --version) установлен"

# Установка PostgreSQL
echo "📦 Установка PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi
echo "✅ PostgreSQL установлен"

# Создание базы данных
echo "📦 Создание базы данных..."
read -p "Введите пароль для пользователя базы данных: " DB_PASSWORD
sudo -u postgres psql <<EOF
CREATE USER magnet_user WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE magnet_db OWNER magnet_user;
GRANT ALL PRIVILEGES ON DATABASE magnet_db TO magnet_user;
\q
EOF
echo "✅ База данных создана"

# Установка PM2
echo "📦 Установка PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
echo "✅ PM2 установлен"

# Установка Nginx
echo "📦 Установка Nginx..."
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
fi
echo "✅ Nginx установлен"

# Установка Git
echo "📦 Установка Git..."
apt install -y git

# Вопросы для настройки
read -p "Введите путь для размещения приложения (по умолчанию /var/www/magnet-app): " APP_PATH
APP_PATH=${APP_PATH:-/var/www/magnet-app}

read -p "Введите ваш домен (например: example.com): " DOMAIN

# Создание директории
echo "📦 Создание директории приложения..."
mkdir -p $APP_PATH
cd $APP_PATH

# Клонирование репозитория (или загрузка файлов)
read -p "Введите URL Git репозитория (или нажмите Enter, чтобы пропустить): " GIT_URL
if [ ! -z "$GIT_URL" ]; then
    git clone $GIT_URL .
else
    echo "⚠️  Пропущено клонирование. Загрузите файлы вручную в $APP_PATH"
fi

# Установка зависимостей
if [ -d "server" ]; then
    echo "📦 Установка зависимостей backend..."
    cd server
    npm install
    cd ..
fi

if [ -d "client" ]; then
    echo "📦 Установка зависимостей frontend..."
    cd client
    npm install
    echo "📦 Сборка frontend..."
    npm run build
    cd ..
fi

# Создание .env файла
echo "📦 Создание .env файла..."
cat > server/.env <<EOF
DATABASE_URL=postgresql://magnet_user:$DB_PASSWORD@localhost:5432/magnet_db
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://$DOMAIN
EOF

# Создание конфигурации Nginx
echo "📦 Настройка Nginx..."
cat > /etc/nginx/sites-available/magnet-app <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root $APP_PATH/client/build;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/magnet-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Создание директории для логов
mkdir -p $APP_PATH/logs

# Запуск приложения через PM2
echo "📦 Запуск приложения..."
cd $APP_PATH/server
pm2 start index.js --name magnet-app-backend
pm2 save
pm2 startup

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Настройте DNS записи для домена $DOMAIN на IP этого сервера"
echo "2. Установите SSL сертификат: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "3. Проверьте логи: pm2 logs magnet-app-backend"
echo "4. Проверьте статус: pm2 status"
echo ""
echo "🔗 Документация: см. DEPLOY_HOSTIQ.md"


