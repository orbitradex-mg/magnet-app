import express from 'express';
import bcrypt from 'bcryptjs';
import { query, get, run } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware для проверки прав администратора
const requireAdmin = async (req, res, next) => {
  try {
    const user = await get('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Получить всех пользователей (только админ)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await query(`
      SELECT id, username, name, role, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Создать нового пользователя (только админ)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, name, role } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Имя пользователя, пароль и имя обязательны' });
    }

    // Проверяем, не существует ли уже пользователь
    const existingUser = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const result = await run(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, name, role || 'employee']
    );

    res.json({ 
      message: 'Пользователь успешно создан',
      userId: result.lastID
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Обновить пользователя (только админ)
router.put('/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, password, name, role } = req.body;

    const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Обновляем имя пользователя, если указано
    if (username && username !== user.username) {
      const existingUser = await get('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
      if (existingUser) {
        return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
      }
      await run('UPDATE users SET username = ? WHERE id = ?', [username, userId]);
    }

    // Обновляем пароль, если указан
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    }

    // Обновляем имя, если указано
    if (name) {
      await run('UPDATE users SET name = ? WHERE id = ?', [name, userId]);
    }

    // Обновляем роль, если указана
    if (role) {
      await run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    }

    res.json({ message: 'Пользователь успешно обновлен' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Удалить пользователя (только админ)
router.delete('/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Нельзя удалить самого себя
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }

    const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    await run('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'Пользователь успешно удален' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

