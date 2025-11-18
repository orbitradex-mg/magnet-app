import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './OrderDetails.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [equipment, setEquipment] = useState('');
  const [activeExecutions, setActiveExecutions] = useState({});
  const [error, setError] = useState('');
  
  // Переменные для процесса Печать
  const [printVariables, setPrintVariables] = useState({
    material: '',
    sheet_size: '',
    sheet_size_custom: '',
    sheet_count: '',
    defective_count: ''
  });
  
  const [completingExecution, setCompletingExecution] = useState(null);

  useEffect(() => {
    fetchOrderDetails();
    const interval = setInterval(fetchOrderDetails, 5000); // Обновление каждые 5 секунд
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/orders/${orderId}`);
      setOrder(response.data.order);
      setProcesses(response.data.processes);
      
      // Сохраняем активные выполнения
      const executions = {};
      response.data.processes.forEach(process => {
        if (process.active_executions && process.active_executions.length > 0) {
          executions[process.id] = process.active_executions;
        }
      });
      setActiveExecutions(executions);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartProcess = async (processId) => {
    setError('');
    setSelectedProcess(processId);
    
    // Для высечки показываем выбор тигеля
    const process = processes.find(p => p.id === processId);
    if (process.process_name === 'Высечка') {
      setEquipment('Тигель 1'); // По умолчанию
    } else if (process.process_name === 'Печать') {
      // Для печати сбрасываем переменные
      setPrintVariables({
        material: '',
        sheet_size: '',
        sheet_size_custom: '',
        sheet_count: '',
        defective_count: ''
      });
    } else {
      setEquipment('');
      await startExecution(processId, '', {});
    }
  };

  const startExecution = async (processId, equipmentValue, variables = {}) => {
    try {
      const process = processes.find(p => p.id === processId);
      let varsToSend = {};
      
      // Для печати собираем переменные
      if (process?.process_name === 'Печать') {
        varsToSend = {
          material: printVariables.material,
          sheet_size: printVariables.sheet_size === 'custom' 
            ? printVariables.sheet_size_custom 
            : printVariables.sheet_size,
          sheet_count: printVariables.sheet_count
        };
      }
      
      const response = await axios.post(`${API_URL}/processes/${processId}/start`, {
        equipment: equipmentValue || null,
        variables: varsToSend
      });
      
      if (response.data.error) {
        setError(response.data.error);
        setSelectedProcess(null);
      } else {
        setSelectedProcess(null);
        setEquipment('');
        setPrintVariables({
          material: '',
          sheet_size: '',
          sheet_size_custom: '',
          sheet_count: '',
          defective_count: ''
        });
        fetchOrderDetails();
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка при начале процесса');
      setSelectedProcess(null);
    }
  };

  const handleCompleteProcess = async (execution) => {
    // Для печати показываем форму для ввода брака
    const process = processes.find(p => p.id === execution.order_process_id);
    if (process?.process_name === 'Печать') {
      setCompletingExecution(execution);
      setPrintVariables(prev => ({
        ...prev,
        defective_count: execution.variables?.defective_count || ''
      }));
      return;
    }
    
    // Для других процессов завершаем сразу
    await completeExecution(execution, {});
  };

  const completeExecution = async (execution, variables = {}) => {
    try {
      await axios.post(`${API_URL}/processes/${execution.order_process_id}/complete`, {
        executionId: execution.id,
        variables: variables
      });
      setCompletingExecution(null);
      setPrintVariables({
        material: '',
        sheet_size: '',
        sheet_size_custom: '',
        sheet_count: '',
        defective_count: ''
      });
      fetchOrderDetails();
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка при завершении процесса');
    }
  };

  const handleCompleteOrder = async () => {
    if (window.confirm('Вы уверены, что хотите завершить заказ? Все процессы должны быть выполнены.')) {
      try {
        await axios.post(`${API_URL}/orders/${orderId}/complete`);
        navigate('/orders');
      } catch (error) {
        setError(error.response?.data?.error || 'Ошибка при завершении заказа');
      }
    }
  };

  const allProcessesCompleted = processes.every(p => p.status === 'completed');
  const canCompleteOrder = allProcessesCompleted && order?.status === 'in_progress';

  if (loading) {
    return <div className="loading">Загрузка деталей заказа...</div>;
  }

  if (!order) {
    return <div className="error">Заказ не найден</div>;
  }

  return (
    <div className="order-details-container">
      <div className="order-details-header">
        <button onClick={() => navigate('/orders')} className="back-button">
          ← Назад к заказам
        </button>
        <div className="order-header-info">
          <h1>Заказ #{order.order_number}</h1>
          {order.description && (
            <p className="order-description">{order.description}</p>
          )}
          {order.photo_url && (
            <div className="order-photo">
              <img src={order.photo_url} alt="Фото заказа" />
            </div>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="processes-list">
        {processes.map((process, index) => {
          const isActive = activeExecutions[process.id] || [];
          const hasActiveExecutions = isActive.length > 0;
          const showStartButton = process.status !== 'completed' && 
                                 selectedProcess !== process.id && 
                                 !hasActiveExecutions;
          
          return (
            <div
              key={process.id}
              className={`process-item ${process.status} ${
                selectedProcess === process.id ? 'selected' : ''
              }`}
            >
              <div className="process-header">
                <div className="process-number">{index + 1}</div>
                <div className="process-info">
                  <h3>{process.process_name}</h3>
                  <span className={`process-status ${process.status}`}>
                    {process.status === 'pending' && 'Ожидает'}
                    {process.status === 'in_progress' && 'В работе'}
                    {process.status === 'completed' && 'Завершен'}
                  </span>
                </div>
              </div>

              {process.process_name === 'Высечка' && selectedProcess === process.id && (
                <div className="equipment-selection">
                  <label>Выберите тигель:</label>
                  <select
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value)}
                  >
                    <option value="Тигель 1">Тигель 1</option>
                    <option value="Тигель 2">Тигель 2</option>
                  </select>
                  <button
                    onClick={() => startExecution(process.id, equipment)}
                    className="start-button"
                  >
                    Приступить
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProcess(null);
                      setEquipment('');
                    }}
                    className="cancel-button"
                  >
                    Отмена
                  </button>
                </div>
              )}

              {process.process_name === 'Печать' && selectedProcess === process.id && (
                <div className="process-variables-form">
                  <h4>Параметры печати</h4>
                  
                  <div className="variable-group">
                    <label>Материал *</label>
                    <select
                      value={printVariables.material}
                      onChange={(e) => setPrintVariables({ ...printVariables, material: e.target.value })}
                      required
                    >
                      <option value="">Выберите материал</option>
                      <option value="Пленка белый глянец">Пленка белый глянец</option>
                      <option value="Пленка белый мат">Пленка белый мат</option>
                      <option value="Пленка прозрачная">Пленка прозрачная</option>
                      <option value="Мелованный картон 235грм">Мелованный картон 235грм</option>
                      <option value="Мелованная бумага от 100 до 300грм">Мелованная бумага от 100 до 300грм</option>
                      <option value="Самоклейка">Самоклейка</option>
                    </select>
                  </div>

                  <div className="variable-group">
                    <label>Размер листа *</label>
                    <select
                      value={printVariables.sheet_size}
                      onChange={(e) => setPrintVariables({ ...printVariables, sheet_size: e.target.value, sheet_size_custom: '' })}
                      required
                    >
                      <option value="">Выберите размер</option>
                      <option value="330х487">330х487</option>
                      <option value="330х450">330х450</option>
                      <option value="custom">Ввести вручную</option>
                    </select>
                    {printVariables.sheet_size === 'custom' && (
                      <input
                        type="text"
                        value={printVariables.sheet_size_custom}
                        onChange={(e) => setPrintVariables({ ...printVariables, sheet_size_custom: e.target.value })}
                        placeholder="Например: 400х500"
                        style={{ marginTop: '10px', width: '100%', padding: '8px' }}
                        required
                      />
                    )}
                  </div>

                  <div className="variable-group">
                    <label>Количество листов *</label>
                    <input
                      type="number"
                      value={printVariables.sheet_count}
                      onChange={(e) => setPrintVariables({ ...printVariables, sheet_count: e.target.value })}
                      placeholder="Введите количество"
                      min="1"
                      required
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      onClick={() => startExecution(process.id, '', {})}
                      className="start-button"
                      disabled={!printVariables.material || !printVariables.sheet_size || !printVariables.sheet_count || 
                               (printVariables.sheet_size === 'custom' && !printVariables.sheet_size_custom)}
                    >
                      Приступить
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProcess(null);
                        setPrintVariables({
                          material: '',
                          sheet_size: '',
                          sheet_size_custom: '',
                          sheet_count: '',
                          defective_count: ''
                        });
                      }}
                      className="cancel-button"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {hasActiveExecutions && (
                <div className="active-executions">
                  <strong>В работе:</strong>
                  {isActive.map((execution) => {
                    const isMyExecution = execution.user_id === user?.id;
                    const isCompleting = completingExecution?.id === execution.id;
                    
                    return (
                      <div key={execution.id} className="execution-item">
                        {!isCompleting ? (
                          <>
                            <span>
                              {execution.user_name}
                              {execution.equipment && ` (${execution.equipment})`}
                              {execution.variables?.material && ` - Материал: ${execution.variables.material}`}
                              {execution.variables?.sheet_size && `, Размер: ${execution.variables.sheet_size}`}
                              {execution.variables?.sheet_count && `, Листов: ${execution.variables.sheet_count}`}
                              {' - '}
                              Начато: {new Date(execution.started_at).toLocaleTimeString('ru-RU')}
                              {isMyExecution && <span className="my-execution-badge"> (Вы)</span>}
                            </span>
                            {isMyExecution && (
                              <button
                                onClick={() => handleCompleteProcess(execution)}
                                className="complete-button"
                              >
                                Завершить
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="completion-form">
                            <label>Количество бракованных листов:</label>
                            <input
                              type="number"
                              value={printVariables.defective_count}
                              onChange={(e) => setPrintVariables({ ...printVariables, defective_count: e.target.value })}
                              placeholder="0"
                              min="0"
                              style={{ width: '150px', padding: '8px', margin: '0 10px' }}
                            />
                            <button
                              onClick={() => completeExecution(execution, { defective_count: printVariables.defective_count || '0' })}
                              className="complete-button"
                            >
                              Завершить
                            </button>
                            <button
                              onClick={() => setCompletingExecution(null)}
                              className="cancel-button"
                            >
                              Отмена
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {showStartButton && (
                <button
                  onClick={() => handleStartProcess(process.id)}
                  className="start-button"
                >
                  Приступить к выполнению
                </button>
              )}
            </div>
          );
        })}
      </div>

      {canCompleteOrder && (
        <div className="complete-order-section">
          <button onClick={handleCompleteOrder} className="complete-order-button">
            Готово - Завершить заказ
          </button>
        </div>
      )}
    </div>
  );
};

export default OrderDetails;

