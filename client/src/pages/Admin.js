import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Admin.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ALL_PROCESSES = [
  'Печать',
  'Ламинация',
  'Кашировка',
  'Порезка магнита',
  'Прикатка скотча',
  'Плотерная порезка',
  'Заливка смолы',
  'Выкладка на стекла',
  'Снятие со стекол',
  'Упаковка',
  'Высечка',
  'Упаковка Флоу Пак',
  'Упаковка в пакет с отрывной лентой',
  'Выборка',
  'Порезка Резак',
  'Хоз работы'
];

const Admin = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  
  // Форма создания/редактирования
  const [formData, setFormData] = useState({
    order_number: '',
    processes: []
  });

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders();
    } else if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/orders/stats/summary`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/orders`, formData);
      alert('Заказ успешно создан!');
      setShowCreateForm(false);
      setFormData({ order_number: '', processes: [] });
      fetchOrders();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при создании заказа');
    }
  };

  const handleEditOrder = async (order) => {
    try {
      // Загружаем детали заказа с процессами
      const response = await axios.get(`${API_URL}/orders/${order.id}`);
      const processes = response.data.processes.map(p => p.process_name);
      
      setEditingOrder(order);
      setFormData({
        order_number: order.order_number,
        processes: processes
      });
      setShowCreateForm(true);
    } catch (error) {
      console.error('Error loading order details:', error);
      alert('Ошибка при загрузке деталей заказа');
    }
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/orders/${editingOrder.id}`, formData);
      alert('Заказ успешно обновлен!');
      setShowCreateForm(false);
      setEditingOrder(null);
      setFormData({ order_number: '', processes: [] });
      fetchOrders();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при обновлении заказа');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот заказ?')) {
      try {
        await axios.delete(`${API_URL}/orders/${orderId}`);
        alert('Заказ успешно удален!');
        fetchOrders();
      } catch (error) {
        alert(error.response?.data?.error || 'Ошибка при удалении заказа');
      }
    }
  };

  const toggleProcess = (processName) => {
    setFormData(prev => {
      const processes = [...prev.processes];
      const index = processes.indexOf(processName);
      if (index > -1) {
        processes.splice(index, 1);
      } else {
        processes.push(processName);
      }
      return { ...prev, processes };
    });
  };

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="header-content">
          <h1>Панель администратора</h1>
          <div className="header-actions">
            <button onClick={() => navigate('/orders')} className="btn-secondary">
              К заказам
            </button>
            <div className="user-info">
              <span>{user?.name || user?.username}</span>
              <button onClick={logout} className="btn-logout">
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="admin-content">
        <div className="admin-tabs">
          <button
            className={`tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Управление заказами
          </button>
          <button
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Статистика
          </button>
        </div>

        {activeTab === 'orders' && (
          <div className="orders-management">
            <div className="section-header">
              <h2>Все заказы</h2>
              <button onClick={() => {
                setEditingOrder(null);
                setFormData({ order_number: '', processes: [] });
                setShowCreateForm(true);
              }} className="btn-primary">
                + Создать заказ
              </button>
            </div>

            {showCreateForm && (
              <div className="create-order-form">
                <h3>{editingOrder ? 'Редактировать заказ' : 'Создать новый заказ'}</h3>
                <form onSubmit={editingOrder ? handleUpdateOrder : handleCreateOrder}>
                  <div className="form-group">
                    <label>Номер заказа *</label>
                    <input
                      type="text"
                      value={formData.order_number}
                      onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                      required
                      placeholder="Например: 1826"
                    />
                  </div>

                  <div className="form-group">
                    <label>Процессы производства</label>
                    <div className="processes-grid">
                      {ALL_PROCESSES.map(process => (
                        <label key={process} className="process-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.processes.includes(process)}
                            onChange={() => toggleProcess(process)}
                          />
                          <span>{process}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-primary">
                      {editingOrder ? 'Сохранить изменения' : 'Создать заказ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingOrder(null);
                        setFormData({ order_number: '', processes: [] });
                      }}
                      className="btn-secondary"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </div>
            )}

            {loading ? (
              <div className="loading">Загрузка заказов...</div>
            ) : (
              <div className="orders-table">
                <table>
                  <thead>
                    <tr>
                      <th>Номер заказа</th>
                      <th>Статус</th>
                      <th>Процессов</th>
                      <th>Выполнено</th>
                      <th>Создан</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.id}>
                        <td>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/orders/${order.id}`);
                            }}
                            className="order-link"
                          >
                            #{order.order_number}
                          </a>
                        </td>
                        <td>
                          <span className={`status-badge ${order.status}`}>
                            {order.status === 'in_progress' ? 'В работе' : 'Выполнено'}
                          </span>
                        </td>
                        <td>{order.total_processes || 0}</td>
                        <td>
                          {order.completed_processes || 0} / {order.total_processes || 0}
                        </td>
                        <td>{new Date(order.created_at).toLocaleDateString('ru-RU')}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="btn-view"
                              title="Просмотр"
                            >
                              👁️
                            </button>
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="btn-edit"
                              title="Редактировать"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="btn-delete"
                              title="Удалить"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orders.length === 0 && (
                  <div className="empty-state">Заказов пока нет</div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="stats-section">
            <h2>Статистика</h2>
            {loading ? (
              <div className="loading">Загрузка статистики...</div>
            ) : stats ? (
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Всего заказов</h3>
                  <div className="stat-value">{stats.orders.total}</div>
                </div>
                <div className="stat-card">
                  <h3>В работе</h3>
                  <div className="stat-value in-progress">{stats.orders.in_progress}</div>
                </div>
                <div className="stat-card">
                  <h3>Выполнено</h3>
                  <div className="stat-value completed">{stats.orders.completed}</div>
                </div>
                <div className="stat-card">
                  <h3>Всего процессов</h3>
                  <div className="stat-value">{stats.processes.total}</div>
                </div>
                <div className="stat-card">
                  <h3>Завершено процессов</h3>
                  <div className="stat-value completed">{stats.processes.completed}</div>
                </div>
                <div className="stat-card">
                  <h3>Процент выполнения</h3>
                  <div className="stat-value">
                    {stats.processes.total > 0
                      ? Math.round((stats.processes.completed / stats.processes.total) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">Не удалось загрузить статистику</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;

