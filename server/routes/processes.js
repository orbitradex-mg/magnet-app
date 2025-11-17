import express from 'express';
import { query, get, run } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Начать выполнение процесса
router.post('/:processId/start', authenticateToken, async (req, res) => {
  try {
    const { processId } = req.params;
    const { equipment } = req.body;
    const userId = req.user.id;

    // Проверяем, существует ли процесс
    const process = await get(`
      SELECT op.*, o.order_number
      FROM order_processes op
      JOIN orders o ON op.order_id = o.id
      WHERE op.id = ?
    `, [processId]);

    if (!process) {
      return res.status(404).json({ error: 'Process not found' });
    }

    // Для высечки проверяем занятость тигеля
    if (process.process_name === 'Высечка' && equipment) {
      const activeExecution = await get(`
        SELECT pe.*, u.name as user_name, o.order_number
        FROM process_executions pe
        JOIN order_processes op ON pe.order_process_id = op.id
        JOIN orders o ON op.order_id = o.id
        JOIN users u ON pe.user_id = u.id
        WHERE pe.equipment = ? AND pe.completed_at IS NULL
      `, [equipment]);

      if (activeExecution) {
        return res.status(400).json({
          error: `${equipment} занят. На нем выполняется высечка заказа ${activeExecution.order_number} сотрудником ${activeExecution.user_name}`
        });
      }
    }

    // Создаем запись о начале выполнения
    const result = await run(`
      INSERT INTO process_executions (order_process_id, user_id, equipment, started_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [processId, userId, equipment || null]);

    // Обновляем статус процесса на "in_progress", если он был "pending"
    await run(`
      UPDATE order_processes
      SET status = 'in_progress'
      WHERE id = ? AND status = 'pending'
    `, [processId]);

    res.json({
      message: 'Процесс начат',
      executionId: result.lastID
    });
  } catch (error) {
    console.error('Error starting process:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Завершить выполнение процесса
router.post('/:processId/complete', authenticateToken, async (req, res) => {
  try {
    const { processId } = req.params;
    const { executionId } = req.body;
    const userId = req.user.id;

    // Проверяем, что выполнение существует и принадлежит пользователю
    let execution;
    if (executionId) {
      execution = await get(`
        SELECT pe.*
        FROM process_executions pe
        WHERE pe.id = ? AND pe.user_id = ? AND pe.completed_at IS NULL
      `, [executionId, userId]);
    } else {
      // Если executionId не указан, берем последнее активное выполнение пользователя
      execution = await get(`
        SELECT pe.*
        FROM process_executions pe
        WHERE pe.order_process_id = ? AND pe.user_id = ? AND pe.completed_at IS NULL
        ORDER BY pe.started_at DESC
        LIMIT 1
      `, [processId, userId]);
    }

    if (!execution) {
      return res.status(404).json({ 
        error: 'Active execution not found or already completed' 
      });
    }

    // Завершаем выполнение
    await run(`
      UPDATE process_executions
      SET completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [execution.id]);

    // Проверяем, все ли выполнения процесса завершены
    const activeExecutions = await query(`
      SELECT COUNT(*) as count
      FROM process_executions
      WHERE order_process_id = ? AND completed_at IS NULL
    `, [processId]);

    // Если все выполнения завершены, обновляем статус процесса
    if (activeExecutions[0].count === 0) {
      await run(`
        UPDATE order_processes
        SET status = 'completed'
        WHERE id = ?
      `, [processId]);
    }

    res.json({ message: 'Процесс завершен' });
  } catch (error) {
    console.error('Error completing process:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить историю выполнения процесса
router.get('/:processId/executions', authenticateToken, async (req, res) => {
  try {
    const { processId } = req.params;
    
    const executions = await query(`
      SELECT pe.*, u.name as user_name
      FROM process_executions pe
      JOIN users u ON pe.user_id = u.id
      WHERE pe.order_process_id = ?
      ORDER BY pe.started_at DESC
    `, [processId]);

    res.json(executions);
  } catch (error) {
    console.error('Error fetching executions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

