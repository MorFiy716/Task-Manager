// Полный обновленный script.js

document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const tasksContainer = document.getElementById('tasks-container');
    const taskForm = document.getElementById('task-form');
    const editForm = document.getElementById('edit-form');
    const editModal = document.getElementById('edit-modal');
    const searchInput = document.getElementById('search-input');
    const filterStatus = document.getElementById('filter-status');
    const filterPriority = document.getElementById('filter-priority');
    const filterCategory = document.getElementById('filter-category');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const emailSettingsModal = document.getElementById('email-settings-modal');
    const emailSettingsForm = document.getElementById('email-settings-form');
    const testEmailForm = document.getElementById('test-email-form');

    // Фильтры
    let currentFilters = {
        status: 'all',
        priority: 'all',
        category: 'all'
    };

    // Текущие настройки email
    let emailConfigured = false;

    // Инициализация
    loadTasks();
    loadEmailSettings();
    loadEmailPresets();

    // ========== ФУНКЦИИ ДЛЯ ЗАДАЧ ==========

    // Загрузить задачи
    function loadTasks() {
        tasksContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка задач...</div>';

        const params = new URLSearchParams(currentFilters);

        fetch(`/api/tasks?${params}`)
            .then(response => response.json())
            .then(tasks => {
                displayTasks(tasks);
                updateStats();
                loadCategories();
            })
            .catch(error => {
                console.error('Ошибка загрузки задач:', error);
                tasksContainer.innerHTML = '<div class="error">Ошибка загрузки задач</div>';
            });
    }

    // Отобразить задачи
    function displayTasks(tasks) {
        if (tasks.length === 0) {
            tasksContainer.innerHTML = `
                <div class="no-tasks">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>Задачи не найдены</h3>
                    <p>Создайте первую задачу с помощью формы слева</p>
                </div>
            `;
            return;
        }

        tasksContainer.innerHTML = '';

        const searchTerm = searchInput.value.toLowerCase();

        tasks.forEach(task => {
            // Фильтр поиска
            if (searchTerm && !task.title.toLowerCase().includes(searchTerm) &&
                !task.description.toLowerCase().includes(searchTerm)) {
                return;
            }

            const taskElement = createTaskElement(task);
            tasksContainer.appendChild(taskElement);
        });
    }

    // Создать элемент задачи
    function createTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.className = `task-card priority-${task.priority} ${task.status}`;

        const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU') : 'Без срока';
        const createdDate = new Date(task.created_at).toLocaleDateString('ru-RU');

        const statusLabels = {
            'pending': 'Ожидает',
            'in_progress': 'В работе',
            'completed': 'Выполнено'
        };

        const priorityLabels = {
            'low': 'Низкий',
            'medium': 'Средний',
            'high': 'Высокий'
        };

        // Иконка email если есть назначенный email
        const emailIcon = task.assigned_email ?
            `<button class="action-btn send-email-btn" data-id="${task.id}" title="Отправить на email">
                <i class="fas fa-paper-plane email-icon"></i>
            </button>` : '';

        taskElement.innerHTML = `
            <div class="task-header">
                <h3 class="task-title">${task.title}</h3>
                <div class="task-actions">
                    ${emailIcon}
                    <button class="action-btn edit-btn" data-id="${task.id}" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" data-id="${task.id}" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <p class="task-description">${task.description || 'Нет описания'}</p>
            <div class="task-meta">
                <div>
                    <span class="task-status status-${task.status}">${statusLabels[task.status]}</span>
                    <span class="task-category">${task.category || 'Общая'}</span>
                    ${task.assigned_email ?
                        `<span class="task-email" title="Назначено на: ${task.assigned_email}">
                            <i class="fas fa-envelope"></i> ${task.assigned_email}
                        </span>` : ''}
                </div>
                <div>
                    <span class="task-due" title="Срок выполнения"><i class="far fa-calendar"></i> ${dueDate}</span>
                </div>
            </div>
            <div class="task-footer" style="margin-top: 10px; font-size: 0.8rem; color: #6c757d;">
                <span>Создано: ${createdDate}</span>
                <span style="margin-left: 10px;">Приоритет: ${priorityLabels[task.priority]}</span>
            </div>
        `;

        // Добавляем обработчики событий
        const editBtn = taskElement.querySelector('.edit-btn');
        const deleteBtn = taskElement.querySelector('.delete-btn');
        const sendEmailBtn = taskElement.querySelector('.send-email-btn');

        editBtn.addEventListener('click', () => openEditModal(task));
        deleteBtn.addEventListener('click', () => deleteTask(task.id));

        if (sendEmailBtn) {
            sendEmailBtn.addEventListener('click', () => sendTaskEmail(task.id, task.assigned_email));
        }

        return taskElement;
    }

    // Обновить статистику
    function updateStats() {
        fetch('/api/stats')
            .then(response => response.json())
            .then(stats => {
                document.getElementById('total-tasks').textContent = stats.total;
                document.getElementById('completed-tasks').textContent = stats.completed;
                document.getElementById('inprogress-tasks').textContent = stats.in_progress;
            });
    }

    // Загрузить категории
    function loadCategories() {
        fetch('/api/categories')
            .then(response => response.json())
            .then(categories => {
                const categorySelect = filterCategory;
                const categoriesList = document.getElementById('categories-list');
                const editCategoriesList = document.getElementById('edit-categories-list');

                categorySelect.innerHTML = '<option value="all">Все</option>';
                categoriesList.innerHTML = '';
                editCategoriesList.innerHTML = '';

                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);

                    const datalistOption = document.createElement('option');
                    datalistOption.value = category;
                    categoriesList.appendChild(datalistOption);

                    const editDatalistOption = document.createElement('option');
                    editDatalistOption.value = category;
                    editCategoriesList.appendChild(editDatalistOption);
                });
            });
    }

    // ========== ОБРАБОТЧИКИ ДЛЯ ЗАДАЧ ==========

    // Создать новую задачу
    taskForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = {
            title: document.getElementById('title').value.trim(),
            description: document.getElementById('description').value.trim(),
            priority: document.getElementById('priority').value,
            category: document.getElementById('category').value.trim() || 'general',
            due_date: document.getElementById('due-date').value,
            assigned_email: document.getElementById('assigned-email').value.trim() || null,
            send_email: document.getElementById('send-email').checked
        };

        if (!formData.title) {
            showNotification('Введите название задачи', 'error');
            return;
        }

        // Проверка настроек email если требуется отправка
        if (formData.send_email) {
            if (!formData.assigned_email) {
                showNotification('Для отправки email укажите адрес получателя', 'error');
                return;
            }
            if (!emailConfigured) {
                showNotification('Сначала настройте email в приложении', 'error');
                return;
            }
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

            // Перезагрузить задачи
            loadTasks();

            // Показать уведомление
            let message = 'Задача успешно создана!';
            let type = 'success';

            if (data.email_sent !== undefined) {
                if (data.email_sent) {
                    message += ' Email отправлен.';
                } else {
                    message += ' Ошибка отправки email: ' + data.email_message;
                    type = 'warning';
                }
            }

            showNotification(message, type);
        })
        .catch(error => {
            console.error('Ошибка создания задачи:', error);
            showNotification('Ошибка создания задачи', 'error');
        });
    });

    // Открыть модальное окно редактирования
    function openEditModal(task) {
        document.getElementById('edit-id').value = task.id;
        document.getElementById('edit-title').value = task.title;
        document.getElementById('edit-description').value = task.description || '';
        document.getElementById('edit-status').value = task.status;
        document.getElementById('edit-priority').value = task.priority;
        document.getElementById('edit-category').value = task.category || '';
        document.getElementById('edit-due-date').value = task.due_date || '';
        document.getElementById('edit-assigned-email').value = task.assigned_email || '';

        editModal.classList.add('active');
    }

    // Закрыть модальное окно
    function closeEditModal() {
        editModal.classList.remove('active');
        editForm.reset();
    }

    // Обработчики закрытия модального окна
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    editModal.addEventListener('click', function(e) {
        if (e.target === editModal) {
            closeAllModals();
        }
    });

    // Сохранить изменения задачи
    editForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const taskId = document.getElementById('edit-id').value;
        const formData = {
            title: document.getElementById('edit-title').value.trim(),
            description: document.getElementById('edit-description').value.trim(),
            status: document.getElementById('edit-status').value,
            priority: document.getElementById('edit-priority').value,
            category: document.getElementById('edit-category').value.trim() || 'general',
            due_date: document.getElementById('edit-due-date').value,
            assigned_email: document.getElementById('edit-assigned-email').value.trim() || null
        };

        if (!formData.title) {
            alert('Введите название задачи');
            return;
        }

        fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(updatedTask => {
            closeEditModal();
            loadTasks();
            showNotification('Задача обновлена!', 'success');
        })
        .catch(error => {
            console.error('Ошибка обновления задачи:', error);
            showNotification('Ошибка обновления задачи', 'error');
        });
    });

    // Удалить задачу
    document.getElementById('delete-btn').addEventListener('click', function() {
        const taskId = document.getElementById('edit-id').value;

        if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
            deleteTask(taskId);
            closeEditModal();
        }
    });

    function deleteTask(taskId) {
        if (!confirm('Вы уверены, что хотите удалить эту задачу?')) {
            return;
        }

        fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(() => {
            loadTasks();
            showNotification('Задача удалена!', 'success');
        })
        .catch(error => {
            console.error('Ошибка удаления задачи:', error);
            showNotification('Ошибка удаления задачи', 'error');
        });
    }

    // Применить фильтры
    applyFiltersBtn.addEventListener('click', function() {
        currentFilters = {
            status: filterStatus.value,
            priority: filterPriority.value,
            category: filterCategory.value
        };

        loadTasks();
    });

    // Поиск
    searchInput.addEventListener('input', function() {
        loadTasks();
    });

    // ========== ФУНКЦИИ ДЛЯ EMAIL ==========

    // Загрузить настройки email
    function loadEmailSettings() {
        fetch('/api/email/settings')
            .then(response => response.json())
            .then(settings => {
                const statusDiv = document.getElementById('email-settings-status');

                if (settings.configured === false) {
                    emailConfigured = false;
                    statusDiv.innerHTML = `
                        <p class="status status-disconnected">
                            <i class="fas fa-exclamation-circle"></i> Email не настроен
                        </p>
                        <p>Для отправки задач по email настройте подключение к почтовому серверу.</p>
                    `;
                } else {
                    emailConfigured = true;
                    // Заполняем форму сохраненными значениями
                    document.getElementById('smtp-server').value = settings.smtp_server;
                    document.getElementById('smtp-port').value = settings.smtp_port;
                    document.getElementById('use-tls').checked = settings.use_tls;
                    document.getElementById('use-ssl').checked = settings.use_ssl;
                    document.getElementById('email-username').value = settings.username;
                    document.getElementById('email-password').value = settings.password;
                    document.getElementById('sender-email').value = settings.sender_email;

                    statusDiv.innerHTML = `
                        <p class="status status-connected">
                            <i class="fas fa-check-circle"></i> Email настроен
                        </p>
                        <p><strong>Сервер:</strong> ${settings.smtp_server}:${settings.smtp_port}</p>
                        <p><strong>Email:</strong> ${settings.username}</p>
                        <p><strong>Обновлено:</strong> ${settings.updated_at}</p>
                    `;
                }
            })
            .catch(error => {
                console.error('Ошибка загрузки настроек email:', error);
            });
    }

    // Загрузить пресеты email
    function loadEmailPresets() {
        fetch('/api/email/presets')
            .then(response => response.json())
            .then(presets => {
                const container = document.getElementById('presets-container');
                container.innerHTML = '';

                Object.keys(presets).forEach(key => {
                    const preset = presets[key];
                    const card = document.createElement('div');
                    card.className = 'preset-card';
                    card.dataset.preset = key;

                    card.innerHTML = `
                        <h5><i class="fas fa-envelope"></i> ${preset.name}</h5>
                        <div class="preset-details">
                            <p><strong>Сервер:</strong> ${preset.smtp_server}:${preset.smtp_port}</p>
                            <p><strong>Безопасность:</strong> ${preset.use_tls ? 'TLS' : preset.use_ssl ? 'SSL' : 'Нет'}</p>
                        </div>
                        <div class="preset-hint">
                            <i class="fas fa-lightbulb"></i> ${preset.hint}
                        </div>
                        <button class="btn btn-primary btn-sm use-preset-btn">
                            <i class="fas fa-check"></i> Использовать
                        </button>
                    `;

                    container.appendChild(card);

                    // Обработчик для кнопки использования пресета
                    card.querySelector('.use-preset-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        applyPreset(preset);
                    });

                    // Обработчик для клика по карточке
                    card.addEventListener('click', (e) => {
                        if (!e.target.classList.contains('use-preset-btn')) {
                            applyPreset(preset);
                        }
                    });
                });
            });
    }

    // Применить пресет
    function applyPreset(preset) {
        document.getElementById('smtp-server').value = preset.smtp_server;
        document.getElementById('smtp-port').value = preset.smtp_port;
        document.getElementById('use-tls').checked = preset.use_tls;
        document.getElementById('use-ssl').checked = preset.use_ssl;

        // Показать сообщение
        showNotification(`Настройки "${preset.name}" применены`, 'success');

        // Выделить выбранный пресет
        document.querySelectorAll('.preset-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.target.closest('.preset-card').classList.add('selected');
    }

    // Сохранить настройки email
    emailSettingsForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = {
            smtp_server: document.getElementById('smtp-server').value.trim(),
            smtp_port: parseInt(document.getElementById('smtp-port').value),
            use_tls: document.getElementById('use-tls').checked,
            use_ssl: document.getElementById('use-ssl').checked,
            username: document.getElementById('email-username').value.trim(),
            password: document.getElementById('email-password').value,
            sender_email: document.getElementById('sender-email').value.trim()
        };

        // Валидация
        if (!formData.smtp_server || !formData.smtp_port || !formData.username || !formData.password || !formData.sender_email) {
            showNotification('Заполните все обязательные поля', 'error');
            return;
        }

        if (formData.use_tls && formData.use_ssl) {
            showNotification('Выберите либо TLS, либо SSL, но не оба одновременно', 'error');
            return;
        }

        fetch('/api/email/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Настройки email успешно сохранены', 'success');
                loadEmailSettings();
            } else {
                showNotification('Ошибка сохранения: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка сохранения настроек:', error);
            showNotification('Ошибка сохранения настроек', 'error');
        });
    });

    // Удалить настройки email
    document.getElementById('delete-settings-btn').addEventListener('click', function() {
        if (confirm('Вы уверены, что хотите удалить настройки email?')) {
            fetch('/api/email/settings', {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('Настройки email удалены', 'success');
                    emailSettingsForm.reset();
                    loadEmailSettings();
                }
            })
            .catch(error => {
                console.error('Ошибка удаления настроек:', error);
                showNotification('Ошибка удаления настроек', 'error');
            });
        }
    });

    // Тестовая отправка email
    testEmailForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const email = document.getElementById('test-email').value.trim();
        const testResult = document.getElementById('test-result');

        if (!email) {
            showNotification('Введите email для теста', 'error');
            return;
        }

        // Показать индикатор загрузки
        const submitBtn = testEmailForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
        submitBtn.disabled = true;

        fetch('/api/email/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: email })
        })
        .then(response => response.json())
        .then(data => {
            // Восстановить кнопку
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            if (data.success) {
                testResult.className = 'test-result success';
                testResult.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;
                testResult.style.display = 'block';
            } else {
                testResult.className = 'test-result error';
                testResult.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.error}`;
                testResult.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Ошибка тестовой отправки:', error);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            testResult.className = 'test-result error';
            testResult.innerHTML = `<i class="fas fa-exclamation-circle"></i> Ошибка соединения`;
            testResult.style.display = 'block';
        });
    });

    // Функция отправки задачи по email
    function sendTaskEmail(taskId, currentEmail = null) {
        // Проверяем настройки email
        if (!emailConfigured) {
            showNotification('Сначала настройте email в приложении', 'error');
            openEmailSettings();
            return;
        }

        Swal.fire({
            title: 'Отправить задачу по email',
            input: 'email',
            inputLabel: 'Email получателя',
            inputValue: currentEmail || '',
            inputPlaceholder: 'Введите email',
            showCancelButton: true,
            confirmButtonText: 'Отправить',
            cancelButtonText: 'Отмена',
            showLoaderOnConfirm: true,
            preConfirm: (email) => {
                if (!email) {
                    Swal.showValidationMessage('Пожалуйста, введите email');
                    return false;
                }

                return fetch(`/api/tasks/${taskId}/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: email })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Ошибка сети');
                    }
                    return response.json();
                })
                .catch(error => {
                    Swal.showValidationMessage(`Ошибка: ${error}`);
                });
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then((result) => {
            if (result.isConfirmed) {
                if (result.value && result.value.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Успешно!',
                        text: 'Задача отправлена на email',
                        timer: 2000
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Ошибка',
                        text: result.value ? result.value.error : 'Неизвестная ошибка'
                    });
                }
            }
        });
    }

    // Обработчик кнопки отправки email в модальном окне редактирования
    document.getElementById('send-email-btn').addEventListener('click', function() {
        const taskId = document.getElementById('edit-id').value;
        const email = document.getElementById('edit-assigned-email').value;

        if (!email) {
            showNotification('Укажите email получателя', 'error');
            return;
        }

        sendTaskEmail(taskId, email);
    });

    // ========== УТИЛИТЫ ==========

    // Показать уведомление
    function showNotification(message, type = 'info') {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Стили для уведомления
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '8px';
        notification.style.color = 'white';
        notification.style.fontWeight = '500';
        notification.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        notification.style.zIndex = '1001';
        notification.style.transform = 'translateX(100%)';
        notification.style.transition = 'transform 0.3s ease';

        if (type === 'success') {
            notification.style.background = '#4caf50';
        } else if (type === 'error') {
            notification.style.background = '#f44336';
        } else if (type === 'warning') {
            notification.style.background = '#ff9800';
        } else {
            notification.style.background = '#2196f3';
        }

        document.body.appendChild(notification);

        // Показываем уведомление
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Скрываем через 3 секунды
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Закрыть все модальные окна
    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Открыть настройки email
    function openEmailSettings() {
        closeAllModals();
        emailSettingsModal.classList.add('active');
    }

    // Обработчик для кнопки настроек email
    document.getElementById('email-settings-btn').addEventListener('click', openEmailSettings);

    // Обработчик для модального окна настроек email
    emailSettingsModal.addEventListener('click', function(e) {
        if (e.target === emailSettingsModal || e.target.classList.contains('close-btn')) {
            closeAllModals();
        }
    });

    // Переключение видимости пароля
    document.getElementById('toggle-password').addEventListener('click', function() {
        const passwordInput = document.getElementById('email-password');
        const icon = this.querySelector('i');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            icon.className = 'fas fa-eye';
        }
    });

    // Переключение табов
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;

            // Деактивировать все табы
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Активировать выбранный таб
            this.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });

    // Добавляем обработчик для закрытия всех модальных окон при ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    // Обновлять статистику каждые 30 секунд
    setInterval(updateStats, 30000);
});