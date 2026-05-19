from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from datetime import datetime, timedelta
import json
import os

app = Flask(__name__)
app.secret_key = "kkotip_secret_2024"

# ─── Данные пользователей ────────────────────────────────────────────────────
USERS = {
    "marcel": {
        "name": "Хайрулин Марсель",
        "role": "student",
        "group": "ИС 24-01/1",
        "avatar": "МХ",
        "color": "#4F8EF7"
    }
}

CONTACTS = [
    {"id": "stanislav",  "name": "Станислав Юрьевич",    "role": "teacher",  "subject": "Математика",          "avatar": "СЮ", "color": "#E05C5C", "online": True},
    {"id": "olga",       "name": "Ольга Сергеевна",       "role": "teacher",  "subject": "Информатика",         "avatar": "ОС", "color": "#7C5CE4", "online": False},
    {"id": "ekaterina",  "name": "Екатерина Комиссарова", "role": "teacher",  "subject": "Английский язык",     "avatar": "ЕК", "color": "#00B894", "online": True},
    {"id": "danis",      "name": "Данис Шакиров",         "role": "student",  "subject": "ИС 24-01/1",          "avatar": "ДШ", "color": "#FDCB6E", "online": True},
    {"id": "dima",       "name": "Дима Колмаков",         "role": "student",  "subject": "ИС 24-01/1",          "avatar": "ДК", "color": "#55EFC4", "online": False},
]

# ─── Начальные сообщения ────────────────────────────────────────────────────
INITIAL_MESSAGES = {
    "stanislav": [
        {"from": "stanislav", "text": "Добрый день, Марсель! Напоминаю, что в пятницу контрольная по теме «Матрицы».", "time": "09:15", "date": "Вчера"},
        {"from": "marcel",    "text": "Здравствуйте, Станислав Юрьевич! Понял, буду готовиться.", "time": "09:30", "date": "Вчера"},
        {"from": "stanislav", "text": "Хорошо. Если будут вопросы — пишите.", "time": "09:31", "date": "Вчера"},
    ],
    "olga": [
        {"from": "olga",   "text": "Марсель, вы сдали лабораторную работу №3?", "time": "14:00", "date": "Вчера"},
        {"from": "marcel", "text": "Ольга Сергеевна, ещё нет, отправлю сегодня вечером.", "time": "14:45", "date": "Вчера"},
    ],
    "ekaterina": [
        {"from": "ekaterina", "text": "Здравствуйте! Не забудьте про эссе на тему Technology in Education — сдача до воскресенья.", "time": "10:00", "date": "Сегодня"},
    ],
    "danis": [
        {"from": "danis",  "text": "Марсель, ты конспект по информатике писал?", "time": "11:20", "date": "Сегодня"},
        {"from": "marcel", "text": "Да, могу скинуть фото.", "time": "11:25", "date": "Сегодня"},
        {"from": "danis",  "text": "Огонь, скинь пожалуйста 🙏", "time": "11:26", "date": "Сегодня"},
    ],
    "dima": [
        {"from": "dima",   "text": "Бро, во сколько завтра пара начинается?", "time": "18:05", "date": "Вчера"},
        {"from": "marcel", "text": "В 8:30, пара по математике.", "time": "18:10", "date": "Вчера"},
        {"from": "dima",   "text": "Спасибо!", "time": "18:11", "date": "Вчера"},
    ],
}

# ─── Расписание ─────────────────────────────────────────────────────────────
SCHEDULE = {
    "Понедельник": [
        {"time": "08:30–10:00", "subject": "Математика",        "teacher": "Станислав Юрьевич",    "room": "214", "type": "lecture"},
        {"time": "10:10–11:40", "subject": "Информатика",       "teacher": "Ольга Сергеевна",       "room": "Лаб.2", "type": "lab"},
        {"time": "12:10–13:40", "subject": "Английский язык",   "teacher": "Екатерина Комиссарова", "room": "305", "type": "practice"},
        {"time": "13:50–15:20", "subject": "Физическая культура","teacher": "Иванов А.П.",          "room": "Зал",  "type": "sport"},
    ],
    "Вторник": [
        {"time": "08:30–10:00", "subject": "Алгоритмы и структуры данных", "teacher": "Ольга Сергеевна",       "room": "Лаб.1", "type": "lab"},
        {"time": "10:10–11:40", "subject": "Базы данных",                  "teacher": "Станислав Юрьевич",    "room": "Лаб.3", "type": "lab"},
        {"time": "12:10–13:40", "subject": "Английский язык",              "teacher": "Екатерина Комиссарова", "room": "305",  "type": "practice"},
    ],
    "Среда": [
        {"time": "08:30–10:00", "subject": "Математика",        "teacher": "Станислав Юрьевич",    "room": "214", "type": "lecture"},
        {"time": "10:10–11:40", "subject": "Информатика",       "teacher": "Ольга Сергеевна",       "room": "Лаб.2", "type": "lab"},
        {"time": "13:50–15:20", "subject": "История",           "teacher": "Петрова Н.В.",          "room": "118", "type": "lecture"},
    ],
    "Четверг": [
        {"time": "08:30–10:00", "subject": "Алгоритмы и структуры данных", "teacher": "Ольга Сергеевна", "room": "Лаб.1", "type": "lab"},
        {"time": "10:10–11:40", "subject": "Базы данных",                  "teacher": "Станислав Юрьевич", "room": "Лаб.3", "type": "lab"},
        {"time": "12:10–13:40", "subject": "Физическая культура",          "teacher": "Иванов А.П.",       "room": "Зал",  "type": "sport"},
    ],
    "Пятница": [
        {"time": "08:30–10:00", "subject": "Математика",      "teacher": "Станислав Юрьевич",    "room": "214", "type": "lecture"},
        {"time": "10:10–11:40", "subject": "Английский язык", "teacher": "Екатерина Комиссарова", "room": "305", "type": "practice"},
        {"time": "12:10–13:40", "subject": "Информатика",     "teacher": "Ольга Сергеевна",       "room": "Лаб.2", "type": "lab"},
    ],
}

# ─── Хранилище сообщений в памяти ────────────────────────────────────────────
messages_store = dict(INITIAL_MESSAGES)

# ─── Маршруты ───────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html",
                           user=USERS["marcel"],
                           contacts=CONTACTS)

@app.route("/api/contacts")
def api_contacts():
    return jsonify(CONTACTS)

@app.route("/api/messages/<contact_id>")
def api_messages(contact_id):
    msgs = messages_store.get(contact_id, [])
    return jsonify(msgs)

@app.route("/api/send", methods=["POST"])
def api_send():
    data = request.get_json()
    contact_id = data.get("contact_id")
    text = data.get("text", "").strip()
    if not text or not contact_id:
        return jsonify({"ok": False}), 400

    now = datetime.now()
    msg = {
        "from": "marcel",
        "text": text,
        "time": now.strftime("%H:%M"),
        "date": "Сегодня"
    }
    if contact_id not in messages_store:
        messages_store[contact_id] = []
    messages_store[contact_id].append(msg)
    return jsonify({"ok": True, "msg": msg})

@app.route("/api/schedule")
def api_schedule():
    return jsonify(SCHEDULE)

@app.route("/api/today")
def api_today():
    days_ru = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"]
    today = days_ru[datetime.now().weekday()]
    return jsonify({"day": today, "lessons": SCHEDULE.get(today, [])})

if __name__ == "__main__":
    print("=" * 50)
    print("  ККОТИП — Мессенджер запущен!")
    print("  Открой в браузере: http://127.0.0.1:5000")
    print("=" * 50)
    app.run(debug=True, host="0.0.0.0", port=5000)
