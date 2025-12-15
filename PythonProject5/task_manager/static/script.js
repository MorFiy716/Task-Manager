document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const tasksContainer = document.getElementById('tasks-container');
    const taskForm = document.getElementById('task-form');
    const emailSettingsBtn = document.getElementById('email-settings-btn');
    const emailModal = document.getElementById('email-modal');

    // Фильтры
    let currentFilters = {
        status: 'all',
        priority: 'all'
    };

    // Инициализация
    loadTasks();
    loadStats();

    // ========== ФУНКЦИИ ==========

    // Загрузить задачи
    function loadTasks() {
        tasksContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i> Загрузка задач...
            </div>
        `;

        const params = new URLSearchParams(currentFilters);

        fetch(`/api/tasks?${params}`)
            .then(response => response.json())
            .then(tasks => {
                displayTasks(tasks);
            })
            .catch(error => {
                console.error('Ошибка:', error);
                tasksContainer.innerHTML = `
                    <div class="message error">
                        Ошибка загрузки задач
                    </div>
                `;
            });
    }

    // Отобразить задачи
    function displayTasks(tasks) {
        if (tasks.length === 0) {
            tasksContainer.innerHTML = `
                <div class="no-tasks">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>Нет задач</h3>
                    <p>Создайте первую задачу</p>
                </div>
            `;
            return;
        }

        tasksContainer.innerHTML = '';

        tasks.forEach(task => {
            const taskElement = createTaskElement(task);
            tasksContainer.appendChild(taskElement);
        });
    }

    // Создать элемент задачи
    function createTaskElement(task) {
        const element = document.createElement('div');
        element.className = `task-card priority-${task.priority}`;

        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU') : 'Нет срока';

        element.innerHTML = `
            <div class="task-header">
                <h3 class="task-title">${task.title}</h3>
                <div class="task-actions">
                    <button class="action-btn edit-btn" data-id="${task.id}" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn email-btn" data-id="${task.id}" title="Отправить по email">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                    <button class="action-btn delete-btn" data-id="${task.id}" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>

            <p class="task-description">${task.description || 'Нет описания'}</p>

            <div class="task-meta">
                <div>
                    <span class="task-status status-${task.status}">
                        ${getStatusText(task.status)}
                    </span>
                    ${task.assigned_email ? `
                        <span class="task-email">
                            <i class="fas fa-envelope"></i> ${task.assigned_email}
                        </span>
                    ` : ''}
                </div>
                <div class="task-due">
                    <i class="far fa-calendar"></i> ${dueDate}
                </div>
            </div>
        `;

        // Обработчики событий
        element.querySelector('.edit-btn').addEventListener('click', () => editTask(task.id));
        element.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));
        element.querySelector('.email-btn').addEventListener('click', () => sendTaskEmail(task.id));

        return element;
    }

    // Получить текст статуса
    function getStatusText(status) {
        const statuses = {
            'pending': 'Ожидает',
            'in_progress': 'В работе',
            'completed': 'Выполнено'
        };
        return statuses[status] || status;
    }

    // Загрузить статистику
    function loadStats() {
        fetch('/api/stats')
            .then(response => response.json())
            .then(stats => {
                document.getElementById('total-tasks').textContent = stats.total;
                document.getElementById('completed-tasks').textContent = stats.completed;
                document.getElementById('pending-tasks').textContent = stats.pending;
            });
    }

    // Создать задачу
    taskForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = {
            title: document.getElementById('title').value.trim(),
            description: document.getElementById('description').value.trim(),
            priority: document.getElementById('priority').value,
            due_date: document.getElementById('due-date').value || null,
            assigned_email: document.getElementById('assigned-email').value.trim() || null,
            send_email: document.getElementById('send-email').checked
        };

        if (!formData.title) {
            showMessage('Введите название задачи', 'error');
            return;
        }

        fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(data => {
            // Сбросить форму
            taskForm.reset();
            document.getElementById('priority').value = 'medium';
            document.getElementById('send-email').checked = false;

            // Обновить задачи и статистику
            loadTasks();
            loadStats();

            // Показать сообщение
            let message = 'Задача создана!';
            if (data.email_sent !== undefined) {
                message += data.email_sent ? ' Email отправлен.' : ' Ошибка отправки email.';
            }

            showMessage(message, data.email_sent ? 'success' : 'warning');
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка создания задачи', 'error');
        });
    });

    // Редактировать задачу
    function editTask(taskId) {
        // Загрузить данные задачи
        fetch(`/api/tasks/${taskId}`)
            .then(response => response.json())
            .then(task => {
                // Создать форму редактирования
                const html = `
                    <div class="modal active" id="edit-modal">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3><i class="fas fa-edit"></i> Редактировать задачу</h3>
                                <button class="close-btn">&times;</button>
                            </div>
                            <div class="modal-body">
                                <form id="edit-task-form">
                                    <div class="form-group">
                                        <label for="edit-title">Название:</label>
                                        <input type="text" id="edit-title" value="${task.title}" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="edit-description">Описание:</label>
                                        <textarea id="edit-description">${task.description || ''}</textarea>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="edit-status">Статус:</label>
                                            <select id="edit-status">
                                                <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Ожидает</option>
                                                <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>В работе</option>
                                                <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Выполнено</option>
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label for="edit-priority">Приоритет:</label>
                                            <select id="edit-priority">
                                                <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Низкий</option>
                                                <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Средний</option>
                                                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>Высокий</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="edit-due-date">Срок:</label>
                                            <input type="date" id="edit-due-date" value="${task.due_date || ''}">
                                        </div>
                                        <div class="form-group">
                                            <label for="edit-email">Email:</label>
                                            <input type="email" id="edit-email" value="${task.assigned_email || ''}" placeholder="email@example.com">
                                        </div>
                                    </div>
                                    <div class="modal-actions">
                                        <button type="submit" class="btn btn-primary">
                                            <i class="fas fa-save"></i> Сохранить
                                        </button>
                                        <button type="button" class="btn btn-secondary close-btn">
                                            Отмена
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                `;

                // Добавить модальное окно на страницу
                const modalDiv = document.createElement('div');
                modalDiv.innerHTML = html;
                document.body.appendChild(modalDiv);

                // Обработчик сохранения
                document.getElementById('edit-task-form').addEventListener('submit', function(e) {
                    e.preventDefault();

                    const formData = {
                        title: document.getElementById('edit-title').value.trim(),
                        description: document.getElementById('edit-description').value.trim(),
                        status: document.getElementById('edit-status').value,
                        priority: document.getElementById('edit-priority').value,
                        due_date: document.getElementById('edit-due-date').value || null,
                        assigned_email: document.getElementById('edit-email').value.trim() || null
                    };

                    fetch(`/api/tasks/${taskId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(formData)
                    })
                    .then(response => response.json())
                    .then(() => {
                        // Закрыть модальное окно
                        modalDiv.remove();

                        // Обновить задачи
                        loadTasks();
                        loadStats();

                        showMessage('Задача обновлена!', 'success');
                    })
                    .catch(error => {
                        console.error('Ошибка:', error);
                        showMessage('Ошибка обновления задачи', 'error');
                    });
                });

                // Обработчик закрытия
                modalDiv.querySelectorAll('.close-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        modalDiv.remove();
                    });
                });
            });
    }

    // Удалить задачу
    function deleteTask(taskId) {
        if (!confirm('Удалить эту задачу?')) return;

        fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(() => {
            loadTasks();
            loadStats();
            showMessage('Задача удалена', 'success');
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка удаления задачи', 'error');
        });
    }

    // Отправить задачу по email
    function sendTaskEmail(taskId) {
        const email = prompt('Введите email получателя:', '');
        if (!email) return;

        fetch(`/api/tasks/${taskId}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: email })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showMessage('Задача отправлена по email', 'success');
            } else {
                showMessage('Ошибка отправки: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            showMessage('Ошибка отправки', 'error');
        });
    }

    // Показать сообщение
    function showMessage(text, type = 'info') {
        // Удалить старые сообщения
        const oldMessage = document.querySelector('.message');
        if (oldMessage) oldMessage.remove();

        // Создать новое сообщение
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = text;
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '20px';
        messageDiv.style.right = '20px';
        messageDiv.style.zIndex = '9999';
        messageDiv.style.maxWidth = '400px';

        document.body.appendChild(messageDiv);

        // Автоудаление через 5 секунд
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    // Настройки email
    emailSettingsBtn.addEventListener('click', function() {
        // Загрузить текущие настройки
        fetch('/api/email/config')
            .then(response => response.json())
            .then(config => {
                // Создать модальное окно настроек
                const html = `
                    <div class="modal active" id="email-config-modal">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3><i class="fas fa-cogs"></i> Настройки Email</h3>
                                <button class="close-btn">&times;</button>
                            </div>
                            <div class="modal-body">
                                ${config.configured === false ? `
                                    <div class="message warning">
                                        <i class="fas fa-exclamation-triangle"></i>
                                        Email не настроен. Заполните настройки ниже.
                                    </div>
                                ` : ''}

                                <form id="email-config-form">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label for="smtp-server">SMTP сервер:</label>
                                            <input type="text" id="smtp-server" value="${config.smtp_server || 'smtp.gmail.com'}" required>
                                        </div>
                                        <div class="form-group">
                                            <label for="smtp-port">Порт:</label>
                                            <input type="number" id="smtp-port" value="${config.smtp_port || 587}" required>
                                        </div>
                                    </div>

                                    <div class="form-group">
                                        <label for="email-username">Email (логин):</label>
                                        <input type="email" id="email-username" value="${config.username || ''}" required>
                                    </div>

                                    <div class="form-group">
                                        <label for="email-password">Пароль (приложения):</label>
                                        <input type="password" id="email-password" value="${config.password || ''}" required>
                                        <small style="color: #6c757d; display: block; margin-top: 5px;">
                                            Для Gmail используйте пароль приложения
                                        </small>
                                    </div>

                                    <div class="form-group">
                                        <label for="from-email">Отправитель (email):</label>
                                        <input type="email" id="from-email" value="${config.from_email || config.username || ''}" required>
                                    </div>

                                    <div class="checkbox-group">
                                        <label>
                                            <input type="checkbox" id="use-tls" ${config.use_tls !== false ? 'checked' : ''}>
                                            <span>Использовать TLS</span>
                                        </label>
                                    </div>

                                    <div class="modal-actions">
                                        <button type="submit" class="btn btn-primary">
                                            <i class="fas fa-save"></i> Сохранить настройки
                                        </button>
                                        <button type="button" class="btn btn-secondary" id="test-email-btn">
                                            <i class="fas fa-paper-plane"></i> Тест отправки
                                        </button>
                                        <button type="button" class="btn btn-secondary close-btn">
                                            Отмена
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                `;

                // Добавить модальное окно
                const modalDiv = document.createElement('div');
                modalDiv.innerHTML = html;
                document.body.appendChild(modalDiv);

                // Обработчик сохранения настроек
                document.getElementById('email-config-form').addEventListener('submit', function(e) {
                    e.preventDefault();

                    const formData = {
                        smtp_server: document.getElementById('smtp-server').value.trim(),
                        smtp_port: document.getElementById('smtp-port').value,
                        username: document.getElementById('email-username').value.trim(),
                        password: document.getElementById('email-password').value,
                        from_email: document.getElementById('from-email').value.trim(),
                        use_tls: document.getElementById('use-tls').checked
                    };

                    fetch('/api/email/config', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(formData)
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showMessage('Настройки email сохранены', 'success');
                        } else {
                            showMessage('Ошибка сохранения настроек', 'error');
                        }
                    })
                    .catch(error => {
                        console.error('Ошибка:', error);
                        showMessage('Ошибка сохранения настроек', 'error');
                    });
                });

                // Обработчик тестовой отправки
                document.getElementById('test-email-btn').addEventListener('click', function() {
                    const email = prompt('Введите email для тестовой отправки:', '');
                    if (!email) return;

                    fetch('/api/email/test', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email: email })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showMessage('Тестовое письмо отправлено', 'success');
                        } else {
                            showMessage('Ошибка: ' + data.message, 'error');
                        }
                    })
                    .catch(error => {
                        console.error('Ошибка:', error);
                        showMessage('Ошибка тестовой отправки', 'error');
                    });
                });

                // Обработчик закрытия
                modalDiv.querySelectorAll('.close-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        modalDiv.remove();
                    });
                });
            });
    });

    // Фильтры
    document.getElementById('filter-status').addEventListener('change', function() {
        currentFilters.status = this.value;
        loadTasks();
    });

    document.getElementById('filter-priority').addEventListener('change', function() {
        currentFilters.priority = this.value;
        loadTasks();
    });

    // Поиск
    document.getElementById('search-input').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const tasks = document.querySelectorAll('.task-card');

        tasks.forEach(task => {
            const title = task.querySelector('.task-title').textContent.toLowerCase();
            const description = task.querySelector('.task-description').textContent.toLowerCase();

            if (title.includes(searchTerm) || description.includes(searchTerm)) {
                task.style.display = 'block';
            } else {
                task.style.display = 'none';
            }
        });
    });

    // Обновлять статистику каждые 30 секунд
    setInterval(loadStats, 30000);
});