from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tasks.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


# Модель задачи
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='pending')  # pending, in_progress, completed
    priority = db.Column(db.String(10), default='medium')  # low, medium, high
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime, nullable=True)
    category = db.Column(db.String(50), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'priority': self.priority,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M'),
            'due_date': self.due_date.strftime('%Y-%m-%d') if self.due_date else None,
            'category': self.category
        }


# Создаем таблицы
with app.app_context():
    db.create_all()


@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')


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

    # Парсим дату если она есть
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
        due_date=due_date
    )

    db.session.add(task)
    db.session.commit()

    return jsonify(task.to_dict()), 201


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

    # Статистика по приоритетам
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


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)