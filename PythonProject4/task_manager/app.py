from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import json
import os
import secrets
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tasks.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = secrets.token_hex(16)

db = SQLAlchemy(app)


# Модель задачи
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='pending')
    priority = db.Column(db.String(10), default='medium')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime, nullable=True)
    category = db.Column(db.String(50), nullable=True)
    assigned_email = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'priority': self.priority,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M'),
            'due_date': self.due_date.strftime('%Y-%m-%d') if self.due_date else None,
            'category': self.category,
            'assigned_email': self.assigned_email
        }


# Модель для хранения настроек email (новое)
class EmailSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100), nullable=False, default='default')
    smtp_server = db.Column(db.String(100), nullable=False, default='smtp.gmail.com')
    smtp_port = db.Column(db.Integer, nullable=False, default=587)
    use_tls = db.Column(db.Boolean, nullable=False, default=True)
    use_ssl = db.Column(db.Boolean, nullable=False, default=False)
    username = db.Column(db.String(200), nullable=False)
    password = db.Column(db.String(500), nullable=False)  # В реальном приложении нужно шифровать
    sender_email = db.Column(db.String(200), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'smtp_server': self.smtp_server,
            'smtp_port': self.smtp_port,
            'use_tls': self.use_tls,
            'use_ssl': self.use_ssl,
            'username': self.username,
            'sender_email': self.sender_email,
            'is_active': self.is_active,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M')
        }


# Создаем таблицы
with app.app_context():
    db.create_all()


# Функция получения активных настроек email
def get_active_email_settings():
    """Получить активные настройки email"""
    settings = EmailSettings.query.filter_by(is_active=True, user_id='default').first()
    return settings


# Функция отправки email
def send_task_email(task_data, recipient_email):
    """Отправляет задачу на указанный email"""
    try:
        # Получаем настройки из базы данных
        settings = get_active_email_settings()

        if not settings:
            return False, "Настройки email не найдены. Пожалуйста, настройте email в приложении."

        # Проверяем обязательные поля
        if not all([settings.username, settings.password, recipient_email]):
            return False, "Не все обязательные поля настроек email заполнены"

        # Создаем сообщение
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"Новая задача: {task_data['title']}"
        msg['From'] = settings.sender_email
        msg['To'] = recipient_email

        # Статусы на русском
        status_labels = {
            'pending': '⏳ Ожидает',
            'in_progress': '🚀 В работе',
            'completed': '✅ Выполнено'
        }

        # Приоритеты на русском
        priority_labels = {
            'low': '🔵 Низкий',
            'medium': '🟡 Средний',
            'high': '🔴 Высокий'
        }

        # HTML версия письма
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }}
                .task-card {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4f46e5; }}
                .badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }}
                .badge-pending {{ background: #fef3c7; color: #92400e; }}
                .badge-in_progress {{ background: #dbeafe; color: #1e40af; }}
                .badge-completed {{ background: #d1fae5; color: #065f46; }}
                .badge-low {{ background: #dbeafe; color: #1e40af; }}
                .badge-medium {{ background: #fef3c7; color: #92400e; }}
                .badge-high {{ background: #fee2e2; color: #991b1b; }}
                .info-row {{ margin: 10px 0; }}
                .label {{ font-weight: 600; color: #6b7280; }}
                .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📋 Новая задача назначена</h1>
                </div>
                <div class="content">
                    <div class="task-card">
                        <h2 style="margin-top: 0;">{task_data['title']}</h2>

                        {f'<p><strong>Описание:</strong> {task_data["description"]}</p>' if task_data.get('description') else ''}

                        <div class="info-row">
                            <span class="label">Статус:</span>
                            <span class="badge badge-{task_data['status']}">
                                {status_labels.get(task_data['status'], task_data['status'])}
                            </span>
                        </div>

                        <div class="info-row">
                            <span class="label">Приоритет:</span>
                            <span class="badge badge-{task_data['priority']}">
                                {priority_labels.get(task_data['priority'], task_data['priority'])}
                            </span>
                        </div>

                        {f'<div class="info-row"><span class="label">Категория:</span> {task_data["category"]}</div>' if task_data.get('category') else ''}

                        {f'<div class="info-row"><span class="label">Срок выполнения:</span> {task_data["due_date"]}</div>' if task_data.get('due_date') else ''}

                        <div class="info-row">
                            <span class="label">Дата создания:</span>
                            {task_data['created_at']}
                        </div>
                    </div>

                    <div class="footer">
                        <p>Это письмо отправлено из Task Manager. Задача #{task_data['id']}</p>
                        <p><a href="http://localhost:5000" style="color: #4f46e5;">Перейти в приложение →</a></p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        # Простая текстовая версия
        text = f"""
        Новая задача: {task_data['title']}

        {'Описание: ' + task_data['description'] if task_data.get('description') else ''}

        Статус: {status_labels.get(task_data['status'], task_data['status'])}
        Приоритет: {priority_labels.get(task_data['priority'], task_data['priority'])}
        {'Категория: ' + task_data['category'] if task_data.get('category') else ''}
        {'Срок выполнения: ' + task_data['due_date'] if task_data.get('due_date') else ''}
        Дата создания: {task_data['created_at']}

        Задача #{task_data['id']}
        """

        # Прикрепляем обе версии
        part1 = MIMEText(text, 'plain')
        part2 = MIMEText(html, 'html')

        msg.attach(part1)
        msg.attach(part2)

        # Подключаемся к SMTP серверу
        if settings.use_ssl:
            server = smtplib.SMTP_SSL(settings.smtp_server, settings.smtp_port)
        else:
            server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)

        if settings.use_tls:
            server.starttls()

        server.login(settings.username, settings.password)
        server.send_message(msg)
        server.quit()

        return True, "Письмо успешно отправлено"

    except smtplib.SMTPAuthenticationError:
        return False, "Ошибка аутентификации. Проверьте логин и пароль."
    except smtplib.SMTPException as e:
        return False, f"Ошибка SMTP: {str(e)}"
    except Exception as e:
        return False, f"Ошибка отправки: {str(e)}"


@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')


# API для задач (остается без изменений)
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Получить все задачи с фильтрацией"""
    status_filter = request.args.get('status')
    priority_filter = request.args.get('priority')
    category_filter = request.args.get('category')

    query = Task.query

    if status_filter and status_filter != 'all':
        query = query.filter_by(status=status_filter)
    if priority_filter and priority_filter != 'all':
        query = query.filter_by(priority=priority_filter)
    if category_filter and category_filter != 'all':
        query = query.filter_by(category=category_filter)

    tasks = query.order_by(Task.created_at.desc()).all()
    return jsonify([task.to_dict() for task in tasks])


@app.route('/api/tasks', methods=['POST'])
def create_task():
    """Создать новую задачу"""
    data = request.json

    due_date = None
    if data.get('due_date'):
        try:
            due_date = datetime.strptime(data['due_date'], '%Y-%m-%d')
        except:
            pass

    task = Task(
        title=data['title'],
        description=data.get('description', ''),
        priority=data.get('priority', 'medium'),
        category=data.get('category', 'general'),
        due_date=due_date,
        assigned_email=data.get('assigned_email')
    )

    db.session.add(task)
    db.session.commit()

    # Отправляем email если указан
    if data.get('assigned_email') and data.get('send_email', False):
        task_data = task.to_dict()
        success, message = send_task_email(task_data, data['assigned_email'])

        return jsonify({
            'task': task.to_dict(),
            'email_sent': success,
            'email_message': message
        }), 201

    return jsonify(task.to_dict()), 201


@app.route('/api/tasks/<int:task_id>/send-email', methods=['POST'])
def send_task_email_endpoint(task_id):
    """Отправить задачу по email"""
    task = Task.query.get_or_404(task_id)

    data = request.json
    recipient_email = data.get('email', task.assigned_email)

    if not recipient_email:
        return jsonify({'error': 'Не указан email получателя'}), 400

    success, message = send_task_email(task.to_dict(), recipient_email)

    if success:
        return jsonify({
            'success': True,
            'message': message,
            'task_id': task.id,
            'email': recipient_email
        })
    else:
        return jsonify({
            'success': False,
            'error': message
        }), 500


# Остальные endpoints для задач (без изменений)
@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """Обновить задачу"""
    task = Task.query.get_or_404(task_id)
    data = request.json

    if 'title' in data:
        task.title = data['title']
    if 'description' in data:
        task.description = data['description']
    if 'status' in data:
        task.status = data['status']
    if 'priority' in data:
        task.priority = data['priority']
    if 'category' in data:
        task.category = data['category']
    if 'assigned_email' in data:
        task.assigned_email = data['assigned_email']
    if 'due_date' in data:
        try:
            task.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d') if data['due_date'] else None
        except:
            pass

    db.session.commit()
    return jsonify(task.to_dict())


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Удалить задачу"""
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({'message': 'Task deleted successfully'})


@app.route('/api/stats')
def get_stats():
    """Получить статистику по задачам"""
    total = Task.query.count()
    completed = Task.query.filter_by(status='completed').count()
    pending = Task.query.filter_by(status='pending').count()
    in_progress = Task.query.filter_by(status='in_progress').count()

    high_priority = Task.query.filter_by(priority='high').count()
    medium_priority = Task.query.filter_by(priority='medium').count()
    low_priority = Task.query.filter_by(priority='low').count()

    return jsonify({
        'total': total,
        'completed': completed,
        'pending': pending,
        'in_progress': in_progress,
        'high_priority': high_priority,
        'medium_priority': medium_priority,
        'low_priority': low_priority
    })


@app.route('/api/categories')
def get_categories():
    """Получить список всех категорий"""
    categories = db.session.query(Task.category).distinct().filter(Task.category.isnot(None)).all()
    return jsonify([cat[0] for cat in categories if cat[0]])


# API для настроек email (новое)
@app.route('/api/email/settings', methods=['GET'])
def get_email_settings():
    """Получить настройки email"""
    settings = get_active_email_settings()
    if settings:
        return jsonify(settings.to_dict())
    else:
        return jsonify({'configured': False})


@app.route('/api/email/settings', methods=['POST'])
def save_email_settings():
    """Сохранить настройки email"""
    data = request.json

    # Деактивируем все старые настройки
    EmailSettings.query.filter_by(user_id='default').update({'is_active': False})

    # Создаем новые настройки
    settings = EmailSettings(
        user_id='default',
        smtp_server=data.get('smtp_server', 'smtp.gmail.com'),
        smtp_port=int(data.get('smtp_port', 587)),
        use_tls=bool(data.get('use_tls', True)),
        use_ssl=bool(data.get('use_ssl', False)),
        username=data.get('username', ''),
        password=data.get('password', ''),
        sender_email=data.get('sender_email', data.get('username', '')),
        is_active=True
    )

    db.session.add(settings)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Настройки email сохранены',
        'settings': settings.to_dict()
    })


@app.route('/api/email/settings', methods=['DELETE'])
def delete_email_settings():
    """Удалить настройки email"""
    settings = get_active_email_settings()
    if settings:
        db.session.delete(settings)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Настройки email удалены'})
    else:
        return jsonify({'success': False, 'error': 'Настройки не найдены'}), 404


@app.route('/api/email/test', methods=['POST'])
def test_email():
    """Тестовая отправка email"""
    data = request.json
    recipient_email = data.get('email')

    if not recipient_email:
        return jsonify({'error': 'Не указан email'}), 400

    # Проверяем настройки
    settings = get_active_email_settings()
    if not settings:
        return jsonify({'error': 'Настройки email не найдены'}), 400

    test_task = {
        'id': 0,
        'title': 'Тестовая задача',
        'description': 'Это тестовое письмо для проверки работы email отправки.',
        'status': 'pending',
        'priority': 'medium',
        'category': 'Тест',
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M'),
        'due_date': None
    }

    success, message = send_task_email(test_task, recipient_email)

    if success:
        return jsonify({
            'success': True,
            'message': 'Тестовое письмо отправлено успешно'
        })
    else:
        return jsonify({
            'success': False,
            'error': message
        }), 500


# Presets для популярных почтовых сервисов
@app.route('/api/email/presets')
def get_email_presets():
    """Получить пресеты для популярных почтовых сервисов"""
    presets = {
        'gmail': {
            'name': 'Gmail',
            'smtp_server': 'smtp.gmail.com',
            'smtp_port': 587,
            'use_tls': True,
            'use_ssl': False,
            'hint': 'Используйте пароль приложения'
        },
        'yandex': {
            'name': 'Yandex Mail',
            'smtp_server': 'smtp.yandex.ru',
            'smtp_port': 465,
            'use_tls': False,
            'use_ssl': True,
            'hint': 'Используйте пароль приложения'
        },
        'mailru': {
            'name': 'Mail.ru',
            'smtp_server': 'smtp.mail.ru',
            'smtp_port': 465,
            'use_tls': False,
            'use_ssl': True,
            'hint': 'Используйте пароль приложения'
        },
        'outlook': {
            'name': 'Outlook/Hotmail',
            'smtp_server': 'smtp.office365.com',
            'smtp_port': 587,
            'use_tls': True,
            'use_ssl': False,
            'hint': 'Используйте обычный пароль'
        }
    }
    return jsonify(presets)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)