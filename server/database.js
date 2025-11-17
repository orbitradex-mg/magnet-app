import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.sqlite');

let db;

export const getDb = () => db;

export const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
      createTables().then(resolve).catch(reject);
    });
  });
};

const createTables = async () => {
  const run = promisify(db.run.bind(db));

  // Таблица пользователей
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица заказов
  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  // Таблица процессов заказа
  await run(`
    CREATE TABLE IF NOT EXISTS order_processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      process_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sequence_order INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  // Таблица выполнения процессов
  await run(`
    CREATE TABLE IF NOT EXISTS process_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_process_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      equipment TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (order_process_id) REFERENCES order_processes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Создаем тестового пользователя (пароль: admin123)
  const get = promisify(db.get.bind(db));
  const existingUser = await get('SELECT id FROM users WHERE username = ?', ['admin']);
  
  if (!existingUser) {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.default.hash('admin123', 10);
    await run('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', 
      ['admin', hashedPassword, 'Администратор']);
    console.log('Test user created: admin / admin123');
  }

  // Создаем тестовый заказ
  const existingOrder = await get('SELECT id FROM orders WHERE order_number = ?', ['1825']);
  if (!existingOrder) {
    const { lastID } = await run('INSERT INTO orders (order_number, status) VALUES (?, ?)', 
      ['1825', 'in_progress']);
    
    const processes = [
      'Печать', 'Ламинация', 'Порезка магнита', 'Кашировка', 
      'Высечка', 'Выборка', 'Упаковка'
    ];
    
    for (let i = 0; i < processes.length; i++) {
      await run(
        'INSERT INTO order_processes (order_id, process_name, sequence_order) VALUES (?, ?, ?)',
        [lastID, processes[i], i + 1]
      );
    }
    console.log('Test order 1825 created');
  }
};

export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

