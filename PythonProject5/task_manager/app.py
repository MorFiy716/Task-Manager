from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tasks.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Настройки email (будут настраиваться через веб-интерфейс)
app.config['EMAIL_CONFIG'] = {
    'server': '',
    'port': 587,
    'username': '',
    'password': '',
    'from_email': '',
    'use_tls': True
}

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
            'assigned_email': self.assigned_email
        }


# Модель для настроек email
class EmailConfig(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    smtp_server = db.Column(db.String(100), default='smtp.gmail.com')
    smtp_port = db.Column(db.Integer, default=587)
    username = db.Column(db.String(200))
    password = db.Column(db.String(500))
    from_email = db.Column(db.String(200))
    use_tls = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'smtp_server': self.smtp_server,
            'smtp_port': self.smtp_port,
            'username': self.username,
            'from_email': self.from_email,
            'use_tls': self.use_tls
        }


# Создаем таблицы
with app.app_context():
    db.create_all()


# Загружаем настройки email
def load_email_config():
    with app.app_context():
        config = EmailConfig.query.first()
        if config:
            app.config['EMAIL_CONFIG'] = config.to_dict()
            app.config['EMAIL_CONFIG']['password'] = config.password
        return config


# Отправка email
def send_email(to_email, subject, html_content, text_content):
    config = app.config['EMAIL_CONFIG']

    if not config['username'] or not config['password']:
        return False, "Email не настроен"

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = config['from_email']
        msg['To'] = to_email

        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html_content, 'html')

        msg.attach(part1)
        msg.attach(part2)

        server = smtplib.SMTP(config['smtp_server'], config['smtp_port'])
        if config['use_tls']:
            server.starttls()
        server.login(config['username'], config['password'])
        server.send_message(msg)
        server.quit()

        return True, "Письмо отправлено"
    except Exception as e:
        return False, f"Ошибка: {str(e)}"


# Главная страница
@app.route('/')
def index():
    return render_template('index.html')


# API: Получить все задачи
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    status = request.args.get('status', 'all')
    priority = request.args.get('priority', 'all')

    with app.app_context():
        query = Task.query

        if status != 'all':
            query = query.filter_by(status=status)
        if priority != 'all':
            query = query.filter_by(priority=priority)

        tasks = query.order_by(Task.created_at.desc()).all()
        return jsonify([task.to_dict() for task in tasks])


# API: Создать задачу
@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.json

    due_date = None
    if data.get('due_date'):
        try:
            due_date = datetime.strptime(data['due_date'], '%Y-%m-%d')
        except:
            pass

    with app.app_context():
        task = Task(
            title=data['title'],
            description=data.get('description', ''),
            priority=data.get('priority', 'medium'),
            due_date=due_date,
            assigned_email=data.get('assigned_email')
        )

        db.session.add(task)
        db.session.commit()

        # Отправляем email если нужно
        if data.get('send_email') and data.get('assigned_email'):
            task_data = task.to_dict()

            html = f"""
            <h2>Новая задача: {task_data['title']}</h2>
            <p><strong>Описание:</strong> {task_data['description'] or 'Нет описания'}</p>
            <p><strong>Статус:</strong> {task_data['status']}</p>
            <p><strong>Приоритет:</strong> {task_data['priority']}</p>
            <p><strong>Срок:</strong> {task_data['due_date'] or 'Не указан'}</p>
            """

            text = f"""
            Новая задача: {task_data['title']}
            Описание: {task_data['description'] or 'Нет описания'}
            Статус: {task_data['status']}
            Приоритет: {task_data['priority']}
            Срок: {task_data['due_date'] or 'Не указан'}
            """

            success, message = send_email(
                data['assigned_email'],
                f"Новая задача: {task_data['title']}",
                html,
                text
            )

            return jsonify({
                'task': task.to_dict(),
                'email_sent': success,
                'email_message': message
            })

        return jsonify(task.to_dict())


# API: Обновить задачу
@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.json

    with app.app_context():
        task = Task.query.get_or_404(task_id)

        if 'title' in data:
            task.title = data['title']
        if 'description' in data:
            task.description = data['description']
        if 'status' in data:
            task.status = data['status']
        if 'priority' in data:
            task.priority = data['priority']
        if 'assigned_email' in data:
            task.assigned_email = data['assigned_email']
        if 'due_date' in data:
            try:
                task.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d') if data['due_date'] else None
            except:
                pass

        db.session.commit()
        return jsonify(task.to_dict())


# API: Удалить задачу
@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    with app.app_context():
        task = Task.query.get_or_404(task_id)
        db.session.delete(task)
        db.session.commit()
        return jsonify({'success': True})


# API: Отправить задачу по email
@app.route('/api/tasks/<int:task_id>/send', methods=['POST'])
def send_task_email(task_id):
    data = request.json

    with app.app_context():
        task = Task.query.get_or_404(task_id)

        email = data.get('email', task.assigned_email)
        if not email:
            return jsonify({'error': 'Не указан email'}), 400

        html = f"""
        <h2>Задача: {task.title}</h2>
        <p><strong>Описание:</strong> {task.description or 'Нет описания'}</p>
        <p><strong>Статус:</strong> {task.status}</p>
        <p><strong>Приоритет:</strong> {task.priority}</p>
        <p><strong>Срок:</strong> {task.due_date.strftime('%Y-%m-%d') if task.due_date else 'Не указан'}</p>
        <p><strong>Создана:</strong> {task.created_at.strftime('%Y-%m-%d %H:%M')}</p>
        """

        text = f"""
        Задача: {task.title}
        Описание: {task.description or 'Нет описания'}
        Статус: {task.status}
        Приоритет: {task.priority}
        Срок: {task.due_date.strftime('%Y-%m-%d') if task.due_date else 'Не указан'}
        Создана: {task.created_at.strftime('%Y-%m-%d %H:%M')}
        """

        success, message = send_email(
            email,
            f"Задача: {task.title}",
            html,
            text
        )

        return jsonify({
            'success': success,
            'message': message
        })


# API: Получить статистику
@app.route('/api/stats', methods=['GET'])
def get_stats():
    with app.app_context():
        total = Task.query.count()
        completed = Task.query.filter_by(status='completed').count()
        pending = Task.query.filter_by(status='pending').count()

        return jsonify({
            'total': total,
            'completed': completed,
            'pending': pending
        })


# API: Настройки email
@app.route('/api/email/config', methods=['GET'])
def get_email_config():
    with app.app_context():
        config = EmailConfig.query.first()
        if config:
            return jsonify(config.to_dict())
        return jsonify({'configured': False})


@app.route('/api/email/config', methods=['POST'])
def save_email_config():
    data = request.json

    with app.app_context():
        # Удаляем старые настройки
        EmailConfig.query.delete()

        config = EmailConfig(
            smtp_server=data.get('smtp_server', 'smtp.gmail.com'),
            smtp_port=int(data.get('smtp_port', 587)),
            username=data.get('username', ''),
            password=data.get('password', ''),
            from_email=data.get('from_email', data.get('username', '')),
            use_tls=bool(data.get('use_tls', True))
        )

        db.session.add(config)
        db.session.commit()

        # Обновляем конфиг в памяти
        load_email_config()

        return jsonify({
            'success': True,
            'config': config.to_dict()
        })


# API: Тест email
@app.route('/api/email/test', methods=['POST'])
def test_email():
    data = request.json
    email = data.get('email')

    if not email:
        return jsonify({'error': 'Не указан email'}), 400

    html = """
    <h2>Тестовое письмо от Task Manager</h2>
    <p>Если вы видите это письмо, значит настройки email работают правильно!</p>
    <p>Теперь вы можете отправлять задачи по email.</p>
    """

    text = """
    Тестовое письмо от Task Manager

    Если вы видите это письмо, значит настройки email работают правильно!
    Теперь вы можете отправлять задачи по email.
    """

    success, message = send_email(
        email,
        "Тестовое письмо от Task Manager",
        html,
        text
    )

    return jsonify({
        'success': success,
        'message': message
    })


# Глобальная обработка ошибок
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'error': 'Не найдено'}), 404


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Внутренняя ошибка сервера'}), 500


if __name__ == '__main__':
    # Загружаем настройки email при запуске
    with app.app_context():
        load_email_config()

    app.run(debug=True, host='0.0.0.0', port=5000)