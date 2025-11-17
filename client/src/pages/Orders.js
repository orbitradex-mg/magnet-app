import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Orders.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('in_progress');
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, [activeTab]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/orders`, {
        params: { status: activeTab },
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderClick = (orderId) => {
    navigate(`/orders/${orderId}`);
  };

  return (
    <div className="orders-container">
      <header className="orders-header">
        <div className="header-content">
          <h1>Управление заказами</h1>
          <div className="user-info">
            <button onClick={() => navigate('/admin')} className="admin-button">
              Админ-панель
            </button>
            <span>Привет, {user?.name || user?.username}!</span>
            <button onClick={logout} className="logout-button">
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="orders-content">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'in_progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('in_progress')}
          >
            Заказы в работе
          </button>
          <button
            className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            Выполнено
          </button>
        </div>

        {loading ? (
          <div className="loading">Загрузка заказов...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            {activeTab === 'in_progress'
              ? 'Нет заказов в работе'
              : 'Нет выполненных заказов'}
          </div>
        ) : (
          <div className="orders-grid">
            {orders.map((order) => (
              <div
                key={order.id}
                className="order-card"
                onClick={() => handleOrderClick(order.id)}
              >
                <div className="order-header">
                  <h2>Заказ #{order.order_number}</h2>
                  <span className={`status-badge ${order.status}`}>
                    {order.status === 'in_progress' ? 'В работе' : 'Выполнено'}
                  </span>
                </div>
                {order.photo_url && (
                  <div className="order-card-photo">
                    <img src={order.photo_url} alt="Фото заказа" />
                  </div>
                )}
                {order.description && (
                  <div className="order-card-description">
                    {order.description.length > 100 
                      ? `${order.description.substring(0, 100)}...` 
                      : order.description}
                  </div>
                )}
                <div className="order-progress">
                  <div className="progress-text">
                    Процессов: {order.completed_processes || 0} / {order.total_processes || 0}
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${order.total_processes > 0 
                          ? (order.completed_processes / order.total_processes) * 100 
                          : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="order-date">
                  Создан: {new Date(order.created_at).toLocaleDateString('ru-RU')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;

