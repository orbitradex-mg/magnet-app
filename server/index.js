import express from 'express';
import cors from 'cors';
import { initDatabase } from './database.js';
import authRoutes from './routes/auth.js';
import ordersRoutes from './routes/orders.js';
import processesRoutes from './routes/processes.js';
import usersRoutes from './routes/users.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Настройка CORS для работы с фронтендом на другом домене
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Инициализация базы данных и запуск сервера
initDatabase()
  .then(() => {
    // Маршруты
    app.use('/api/auth', authRoutes);
    app.use('/api/orders', ordersRoutes);
    app.use('/api/processes', processesRoutes);
    app.use('/api/users', usersRoutes);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

