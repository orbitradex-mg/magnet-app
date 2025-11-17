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

    // Получаем информацию о текущих выполнениях для каждого процесса
    for (const process of processes) {
      const executions = await query(`
        SELECT pe.*, u.name as user_name
        FROM process_executions pe
        JOIN users u ON pe.user_id = u.id
        WHERE pe.order_process_id = ? AND pe.completed_at IS NULL
        ORDER BY pe.started_at DESC
      `, [process.id]);
      
      process.active_executions = executions;
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

export default router;

