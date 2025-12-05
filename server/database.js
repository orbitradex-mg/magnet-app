import pg from 'pg';
const { Pool } = pg;

// Подключаемся к PostgreSQL
// Если DATABASE_URL не указан, используем локальные настройки для разработки
const DATABASE_URL = process.env.DATABASE_URL;

let pool;

export const getDb = () => pool;

export const initDatabase = async () => {
  try {
    if (!DATABASE_URL) {
      // Для локальной разработки можно использовать SQLite или создать локальную PostgreSQL
      console.log('⚠️  DATABASE_URL not set. Please set DATABASE_URL environment variable.');
      console.log('   For local development, you can use PostgreSQL or keep SQLite.');
      throw new Error('DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    });

    // Тестируем подключение
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
    client.release();

    await createTables();
  } catch (error) {
    console.error('❌ Error connecting to database:', error.message);
    throw error;
  }
};

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Таблица пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Добавляем поле role, если его нет
    const roleColumnExists = await checkColumnExists(client, 'users', 'role');
    if (!roleColumnExists) {
      await client.query('ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT \'employee\'');
    }

    // Таблица заказов
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
        description TEXT,
        photo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    // Добавляем новые поля, если их нет
    const descColumnExists = await checkColumnExists(client, 'orders', 'description');
    if (!descColumnExists) {
      await client.query('ALTER TABLE orders ADD COLUMN description TEXT');
    }

    const photoColumnExists = await checkColumnExists(client, 'orders', 'photo_url');
    if (!photoColumnExists) {
      await client.query('ALTER TABLE orders ADD COLUMN photo_url TEXT');
    }

    // Таблица процессов заказа
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_processes (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        process_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        sequence_order INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    // Таблица выполнения процессов
    await client.query(`
      CREATE TABLE IF NOT EXISTS process_executions (
        id SERIAL PRIMARY KEY,
        order_process_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        equipment VARCHAR(255),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (order_process_id) REFERENCES order_processes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Таблица переменных процессов
    await client.query(`
      CREATE TABLE IF NOT EXISTS process_variables (
        id SERIAL PRIMARY KEY,
        process_execution_id INTEGER NOT NULL,
        variable_name VARCHAR(255) NOT NULL,
        variable_value TEXT,
        FOREIGN KEY (process_execution_id) REFERENCES process_executions(id) ON DELETE CASCADE
      )
    `);

    await client.query('COMMIT');

    // Создаем тестового пользователя (пароль: admin123)
    const existingUser = await get('SELECT id FROM users WHERE username = $1', ['admin']);
    
    if (!existingUser) {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash('admin123', 10);
      await run('INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, $4)', 
        ['admin', hashedPassword, 'Администратор', 'admin']);
      console.log('✅ Test user created: admin / admin123 (role: admin)');
    } else {
      // Обновляем роль существующего админа
      await run('UPDATE users SET role = $1 WHERE username = $2', ['admin', 'admin']);
    }

    // Создаем тестовый заказ ТОЛЬКО если база пустая (нет других заказов)
    const allOrders = await query('SELECT COUNT(*) as count FROM orders');
    const orderCount = parseInt(allOrders[0]?.count || 0);
    
    if (orderCount === 0) {
      // База пустая - создаем тестовый заказ
      const existingOrder = await get('SELECT id FROM orders WHERE order_number = $1', ['1825']);
      if (!existingOrder) {
        const result = await run(
          'INSERT INTO orders (order_number, status) VALUES ($1, $2) RETURNING id', 
          ['1825', 'in_progress']
        );
        
        const processes = [
          'Печать', 'Ламинация', 'Порезка магнита', 'Кашировка', 
          'Высечка', 'Выборка', 'Упаковка'
        ];
        
        for (let i = 0; i < processes.length; i++) {
          await run(
            'INSERT INTO order_processes (order_id, process_name, sequence_order) VALUES ($1, $2, $3)',
            [result.lastID, processes[i], i + 1]
          );
        }
        console.log('✅ Test order 1825 created (database was empty)');
      }
    } else {
      console.log(`✅ Database initialized with ${orderCount} existing order(s)`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Функция для проверки существования колонки
const checkColumnExists = async (client, tableName, columnName) => {
  try {
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    `, [tableName, columnName]);
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
};

// Обертка для SELECT запросов (возвращает массив строк)
export const query = async (sql, params = []) => {
  try {
    // Заменяем ? на $1, $2, $3 для PostgreSQL
    const pgSql = convertToPostgresParams(sql);
    const result = await pool.query(pgSql, params);
    return result.rows;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

// Обертка для SELECT запросов (возвращает одну строку)
export const get = async (sql, params = []) => {
  try {
    const pgSql = convertToPostgresParams(sql);
    const result = await pool.query(pgSql, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Get error:', error);
    throw error;
  }
};

// Обертка для INSERT/UPDATE/DELETE запросов
export const run = async (sql, params = []) => {
  try {
    const pgSql = convertToPostgresParams(sql);
    const result = await pool.query(pgSql, params);
    
    // Если есть RETURNING id, используем его
    if (result.rows && result.rows.length > 0 && result.rows[0].id) {
      return {
        lastID: result.rows[0].id,
        changes: result.rowCount
      };
    }
    
    // Иначе возвращаем изменения
    return {
      lastID: null,
      changes: result.rowCount
    };
  } catch (error) {
    console.error('Run error:', error);
    throw error;
  }
};

// Конвертирует SQL с ? на PostgreSQL параметры $1, $2, $3
const convertToPostgresParams = (sql) => {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
};
