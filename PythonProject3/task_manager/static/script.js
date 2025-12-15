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

    // Фильтры
    let currentFilters = {
        status: 'all',
        priority: 'all',
        category: 'all'
    };

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

        taskElement.innerHTML = `
            <div class="task-header">
                <h3 class="task-title">${task.title}</h3>
                <div class="task-actions">
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

        editBtn.addEventListener('click', () => openEditModal(task));
        deleteBtn.addEventListener('click', () => deleteTask(task.id));

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

                // Очищаем список категорий кроме первого элемента
                categorySelect.innerHTML = '<option value="all">Все</option>';
                categoriesList.innerHTML = '';
                editCategoriesList.innerHTML = '';

                categories.forEach(category => {
                    // Для фильтра
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);

                    // Для datalist
                    const datalistOption = document.createElement('option');
                    datalistOption.value = category;
                    categoriesList.appendChild(datalistOption);

                    // Для datalist редактирования
                    const editDatalistOption = document.createElement('option');
                    editDatalistOption.value = category;
                    editCategoriesList.appendChild(editDatalistOption);
                });
            });
    }

    // Создать новую задачу
    taskForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = {
            title: document.getElementById('title').value.trim(),
            description: document.getElementById('description').value.trim(),
            priority: document.getElementById('priority').value,
            category: document.getElementById('category').value.trim() || 'general',
            due_date: document.getElementById('due-date').value
        };

        if (!formData.title) {
            alert('Введите название задачи');
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
        .then(task => {
            // Сбросить форму
            taskForm.reset();
            document.getElementById('priority').value = 'medium';

            // Перезагрузить задачи
            loadTasks();

            // Показать уведомление
            showNotification('Задача успешно создана!', 'success');
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

        editModal.classList.add('active');
    }

    // Закрыть модальное окно
    function closeEditModal() {
        editModal.classList.remove('active');
        editForm.reset();
    }

    // Обработчики закрытия модального окна
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', closeEditModal);
    });

    editModal.addEventListener('click', function(e) {
        if (e.target === editModal) {
            closeEditModal();
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
            due_date: document.getElementById('edit-due-date').value
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

    // Загрузить все при запуске
    loadTasks();

    // Обновлять статистику каждые 30 секунд
    setInterval(updateStats, 30000);
});