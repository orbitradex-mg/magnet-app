import express from 'express';
import { query, get, run } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Получить все заказы
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    let sql = `
      SELECT o.*, 
        COUNT(DISTINCT op.id) as total_processes,
        COUNT(DISTINCT CASE WHEN op.status = 'completed' THEN op.id END) as completed_processes
      FROM orders o
      LEFT JOIN order_processes op ON o.id = op.order_id
    `;
    
    const params = [];
    if (status) {
      sql += ' WHERE o.status = ?';
      params.push(status);
    }
    
    sql += ' GROUP BY o.id ORDER BY o.created_at DESC';
    
    const orders = await query(sql, params);
    
    // Логируем для отладки
    console.log(`📋 Fetched ${orders.length} order(s), status filter: ${status || 'all'}`);
    if (orders.length > 0) {
      console.log(`   Orders: ${orders.map(o => `#${o.order_number}`).join(', ')}`);
    }
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить детали заказа
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { includeHistory } = req.query; // Флаг для включения полной истории
    
    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const processes = await query(`
      SELECT op.*,
        COUNT(pe.id) as execution_count
      FROM order_processes op
      LEFT JOIN process_executions pe ON op.id = pe.order_process_id
      WHERE op.order_id = ?
      GROUP BY op.id
      ORDER BY op.sequence_order
    `, [orderId]);

    // Получаем информацию о выполнениях для каждого процесса
    for (const process of processes) {
      if (includeHistory === 'true') {
        // Полная история всех выполнений (для админ-панели)
        const allExecutions = await query(`
          SELECT pe.*, u.name as user_name, u.username
          FROM process_executions pe
          JOIN users u ON pe.user_id = u.id
          WHERE pe.order_process_id = ?
          ORDER BY pe.started_at DESC
        `, [process.id]);
        
        // Загружаем переменные для каждого выполнения
        for (const execution of allExecutions) {
          const variables = await query(`
            SELECT variable_name, variable_value
            FROM process_variables
            WHERE process_execution_id = ?
          `, [execution.id]);
          
          execution.variables = {};
          variables.forEach(v => {
            execution.variables[v.variable_name] = v.variable_value;
          });
        }
        
        process.all_executions = allExecutions;
      } else {
        // Только активные выполнения (для обычных пользователей)
        const executions = await query(`
          SELECT pe.*, u.name as user_name
          FROM process_executions pe
          JOIN users u ON pe.user_id = u.id
          WHERE pe.order_process_id = ? AND pe.completed_at IS NULL
          ORDER BY pe.started_at DESC
        `, [process.id]);
        
        // Загружаем переменные для активных выполнений
        for (const execution of executions) {
          const variables = await query(`
            SELECT variable_name, variable_value
            FROM process_variables
            WHERE process_execution_id = ?
          `, [execution.id]);
          
          execution.variables = {};
          variables.forEach(v => {
            execution.variables[v.variable_name] = v.variable_value;
          });
        }
        
        process.active_executions = executions;
      }
    }

    res.json({ order, processes });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Завершить заказ
router.post('/:orderId/complete', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Проверяем, что все процессы завершены
    const incompleteProcesses = await query(`
      SELECT COUNT(*) as count
      FROM order_processes
      WHERE order_id = ? AND status != 'completed'
    `, [orderId]);
    
    if (incompleteProcesses[0].count > 0) {
      return res.status(400).json({ 
        error: 'Не все процессы завершены. Невозможно завершить заказ.' 
      });
    }

    await run(
      'UPDATE orders SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['completed', orderId]
    );

    res.json({ message: 'Заказ успешно завершен' });
  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Создать новый заказ (админ)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { order_number, processes, description, photo_url } = req.body;

    if (!order_number) {
      return res.status(400).json({ error: 'Номер заказа обязателен' });
    }

    // Проверяем, не существует ли уже заказ с таким номером
    const existingOrder = await get('SELECT id FROM orders WHERE order_number = ?', [order_number]);
    if (existingOrder) {
      return res.status(400).json({ error: 'Заказ с таким номером уже существует' });
    }

    // Создаем заказ
    const result = await run(
      'INSERT INTO orders (order_number, status, description, photo_url) VALUES (?, ?, ?, ?) RETURNING id',
      [order_number, 'in_progress', description || null, photo_url || null]
    );
    
    console.log(`✅ Order created: #${order_number}, ID: ${result.lastID}`);

    // Добавляем процессы, если они указаны
    if (processes && Array.isArray(processes) && processes.length > 0) {
      for (let i = 0; i < processes.length; i++) {
        await run(
          'INSERT INTO order_processes (order_id, process_name, sequence_order) VALUES (?, ?, ?)',
          [result.lastID, processes[i], i + 1]
        );
      }
    }

    res.json({ message: 'Заказ успешно создан', orderId: result.lastID });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Обновить заказ (админ)
router.put('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { order_number, status, processes, description, photo_url } = req.body;

    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    // Обновляем номер заказа, если указан
    if (order_number && order_number !== order.order_number) {
      const existingOrder = await get('SELECT id FROM orders WHERE order_number = ? AND id != ?', [order_number, orderId]);
      if (existingOrder) {
        return res.status(400).json({ error: 'Заказ с таким номером уже существует' });
      }
      await run('UPDATE orders SET order_number = ? WHERE id = ?', [order_number, orderId]);
    }

    // Обновляем статус, если указан
    if (status) {
      await run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    }

    // Обновляем описание, если указано
    if (description !== undefined) {
      await run('UPDATE orders SET description = ? WHERE id = ?', [description || null, orderId]);
    }

    // Обновляем фото, если указано
    if (photo_url !== undefined) {
      await run('UPDATE orders SET photo_url = ? WHERE id = ?', [photo_url || null, orderId]);
    }

    // Обновляем процессы, если указаны
    if (processes && Array.isArray(processes)) {
      // Удаляем старые процессы
      await run('DELETE FROM order_processes WHERE order_id = ?', [orderId]);
      
      // Добавляем новые процессы
      for (let i = 0; i < processes.length; i++) {
        await run(
          'INSERT INTO order_processes (order_id, process_name, sequence_order) VALUES (?, ?, ?)',
          [orderId, processes[i], i + 1]
        );
      }
    }

    res.json({ message: 'Заказ успешно обновлен' });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Удалить заказ (админ)
router.delete('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    // Удаляем связанные записи
    await run('DELETE FROM process_executions WHERE order_process_id IN (SELECT id FROM order_processes WHERE order_id = ?)', [orderId]);
    await run('DELETE FROM order_processes WHERE order_id = ?', [orderId]);
    await run('DELETE FROM orders WHERE id = ?', [orderId]);

    res.json({ message: 'Заказ успешно удален' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить статистику (админ)
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const totalOrders = await get('SELECT COUNT(*) as count FROM orders');
    const inProgressOrders = await get('SELECT COUNT(*) as count FROM orders WHERE status = ?', ['in_progress']);
    const completedOrders = await get('SELECT COUNT(*) as count FROM orders WHERE status = ?', ['completed']);
    
    const totalProcesses = await get('SELECT COUNT(*) as count FROM order_processes');
    const completedProcesses = await get('SELECT COUNT(*) as count FROM order_processes WHERE status = ?', ['completed']);

    res.json({
      orders: {
        total: totalOrders.count,
        in_progress: inProgressOrders.count,
        completed: completedOrders.count
      },
      processes: {
        total: totalProcesses.count,
        completed: completedProcesses.count
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

