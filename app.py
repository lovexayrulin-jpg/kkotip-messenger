from flask import Flask, render_template, request, jsonify
from datetime import datetime
import os, uuid

app = Flask(__name__)
app.secret_key = "kkotip_secret_2024"

# ─── Пользователи ────────────────────────────────────────────────────────────
FIXED_USERS = [
    {"id": "marcel",    "name": "Хайрулин Марсель",     "role": "student", "group": "ИС 24-01/1", "avatar": "МХ", "color": "#4F8EF7"},
    {"id": "danis",     "name": "Данис Шакиров",         "role": "student", "group": "ИС 24-01/1", "avatar": "ДШ", "color": "#FDCB6E"},
    {"id": "dima",      "name": "Дима Колмаков",         "role": "student", "group": "ИС 24-01/1", "avatar": "ДК", "color": "#55EFC4"},
    {"id": "stanislav", "name": "Станислав Юрьевич",     "role": "teacher", "group": "",           "avatar": "СЮ", "color": "#E05C5C"},
    {"id": "olga",      "name": "Ольга Сергеевна",       "role": "teacher", "group": "",           "avatar": "ОС", "color": "#7C5CE4"},
    {"id": "ekaterina", "name": "Екатерина Комиссарова", "role": "teacher", "group": "",           "avatar": "ЕК", "color": "#00B894"},
]

AVATAR_COLORS = ["#4F8EF7","#E05C5C","#7C5CE4","#00B894","#FDCB6E","#55EFC4","#FD79A8","#A29BFE","#6C5CE7","#00CEC9"]

# Все зарегистрированные пользователи (fixed + custom)
all_users = {u["id"]: dict(u) for u in FIXED_USERS}

# Сообщения: { uid: { contact_id: [msg, ...] } }
messages_store = {}

# ─── Расписание ───────────────────────────────────────────────────────────────
SCHEDULE = {
    "Понедельник": [
        {"time": "08:30–10:00", "subject": "ЭКЗАМЕН",                                         "teacher": "ТРОПАШКО О.А.",    "room": "209",         "type": "exam"},
    ],
    "Вторник": [
        {"time": "08:30–10:00", "subject": "О.С.Т.",                                           "teacher": "ЛАВРЕНКОВ С.С.",   "room": "207",         "type": "lecture"},
        {"time": "10:10–11:40", "subject": "Осн. алгоритмизации и программирования",           "teacher": "ЛАВРЕНКОВ С.С.",   "room": "207",         "type": "lab"},
        {"time": "12:10–13:40", "subject": "Физическая культура",                              "teacher": "ДУБИНИН Е.О.",     "room": "СП ПЛОЩАДКА", "type": "sport"},
        {"time": "13:50–15:20", "subject": "МДК.03.02 Управление проектами",                   "teacher": "КОМИССАРОВА Е.А.", "room": "301А",        "type": "lab"},
    ],
    "Среда": [
        {"time": "12:10–13:40", "subject": "О.С.Т.",                                           "teacher": "ЛАВРЕНКОВ С.С.",   "room": "207",         "type": "lecture"},
        {"time": "13:50–15:20", "subject": "Физическая культура",                              "teacher": "ДУБИНИН Е.О.",     "room": "СП ЗАЛ",     "type": "sport"},
        {"time": "15:30–17:00", "subject": "Осн. алгоритмизации и программирования",           "teacher": "ЛАВРЕНКОВ С.С.",   "room": "207",         "type": "lab"},
    ],
    "Четверг": [
        {"time": "08:30–10:00", "subject": "Учебная практика",                                 "teacher": "ШИХОВА Ю.А.",      "room": "405",         "type": "lab"},
        {"time": "10:10–11:40", "subject": "Учебная практика",                                 "teacher": "ШИХОВА Ю.А.",      "room": "405",         "type": "lab"},
        {"time": "12:10–13:40", "subject": "Учебная практика",                                 "teacher": "ШИХОВА Ю.А.",      "room": "405",         "type": "lab"},
    ],
    "Пятница": [
        {"time": "08:30–10:00", "subject": "МДК.05.02 Разработка кода информационных систем",  "teacher": "ГЛУХОВ С.Ю.",      "room": "403",         "type": "lab"},
        {"time": "10:10–11:40", "subject": "Осн. алгоритмизации и программирования",           "teacher": "ЛАВРЕНКОВ С.С.",   "room": "207",         "type": "lab"},
        {"time": "12:10–13:40", "subject": "О.С.Т.",                                           "teacher": "ЛАВРЕНКОВ С.С.",   "room": "207",         "type": "lecture"},
        {"time": "13:50–15:20", "subject": "Физическая культура",                              "teacher": "ДУБИНИН Е.О.",     "room": "СП ПЛОЩАДКА", "type": "sport"},
        {"time": "15:30–17:00", "subject": "МДК.03.02 Управление проектами",                   "teacher": "КОМИССАРОВА Е.А.", "room": "403",         "type": "lab"},
    ],
}

# ─── Вспомогательные функции ──────────────────────────────────────────────────
def make_avatar(name):
    parts = name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return name[:2].upper()

def ensure_store(uid):
    """Создаёт пустое хранилище для пользователя если нет"""
    if uid not in messages_store:
        messages_store[uid] = {}

def get_chat_key(uid, cid):
    """Уникальный ключ чата между двумя пользователями (не зависит от порядка)"""
    return tuple(sorted([uid, cid]))

# Общее хранилище чатов по паре (uid1, uid2)
chats = {}   # {(uid1,uid2): [msg, ...]}

# ─── Маршруты ─────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", fixed_users=FIXED_USERS)

@app.route("/api/login", methods=["POST"])
def api_login():
    uid = request.get_json().get("user_id", "")
    if uid not in all_users:
        return jsonify({"ok": False, "error": "Пользователь не найден"}), 400
    user = all_users[uid]
    contacts = [dict(u, online=(u["id"] in ["stanislav","ekaterina","danis"]))
                for uid2, u in all_users.items() if uid2 != uid]
    return jsonify({"ok": True, "user": user, "contacts": contacts})

@app.route("/api/login_custom", methods=["POST"])
def api_login_custom():
    data = request.get_json()
    name  = data.get("name", "").strip()
    role  = data.get("role", "student")
    group = data.get("group", "").strip()
    if not name:
        return jsonify({"ok": False, "error": "Введи имя"}), 400
    uid   = "u_" + str(uuid.uuid4())[:8]
    color = AVATAR_COLORS[len(all_users) % len(AVATAR_COLORS)]
    user  = {"id": uid, "name": name, "role": role, "group": group,
             "avatar": make_avatar(name), "color": color}
    all_users[uid] = user
    contacts = [dict(u, online=(u["id"] in ["stanislav","ekaterina","danis"]))
                for uid2, u in all_users.items() if uid2 != uid]
    return jsonify({"ok": True, "user": user, "contacts": contacts})

@app.route("/api/search")
def api_search():
    """Поиск пользователей по имени"""
    q   = request.args.get("q", "").strip().lower()
    uid = request.args.get("uid", "")
    if not q:
        return jsonify([])
    results = [dict(u) for cid, u in all_users.items()
               if cid != uid and q in u["name"].lower()]
    return jsonify(results[:10])

@app.route("/api/messages")
def api_messages():
    uid = request.args.get("uid", "")
    cid = request.args.get("cid", "")
    if not uid or not cid:
        return jsonify([])
    key  = get_chat_key(uid, cid)
    msgs = chats.get(key, [])
    # Добавить стартовые сообщения для учителей если чат пустой
    if not msgs and cid in ["stanislav","olga","ekaterina"] and uid != cid:
        starters = {
            "stanislav": [{"from":"stanislav","text":"Добрый день! Напоминаю о контрольной в пятницу.","time":"09:15","date":"Вчера"}],
            "olga":      [{"from":"olga",     "text":"Вы сдали лабораторную работу №3?",              "time":"14:00","date":"Вчера"}],
            "ekaterina": [{"from":"ekaterina","text":"Не забудьте про эссе — сдача до воскресенья.",  "time":"10:00","date":"Сегодня"}],
        }
        msgs = starters.get(cid, [])
    return jsonify(msgs)

@app.route("/api/send", methods=["POST"])
def api_send():
    data = request.get_json()
    uid  = data.get("uid", "")
    cid  = data.get("cid", "")
    text = data.get("text", "").strip()
    if not uid or not cid or not text:
        return jsonify({"ok": False}), 400
    if uid not in all_users:
        return jsonify({"ok": False, "error": "Неизвестный пользователь"}), 400
    now = datetime.now()
    msg = {"from": uid, "text": text, "time": now.strftime("%H:%M"), "date": "Сегодня"}
    key = get_chat_key(uid, cid)
    if key not in chats:
        # Скопировать стартовые сообщения учителя если нужно
        starters = {
            "stanislav": [{"from":"stanislav","text":"Добрый день! Напоминаю о контрольной в пятницу.","time":"09:15","date":"Вчера"}],
            "olga":      [{"from":"olga",     "text":"Вы сдали лабораторную работу №3?",              "time":"14:00","date":"Вчера"}],
            "ekaterina": [{"from":"ekaterina","text":"Не забудьте про эссе — сдача до воскресенья.",  "time":"10:00","date":"Сегодня"}],
        }
        teacher = cid if cid in starters else (uid if uid in starters else None)
        chats[key] = list(starters.get(teacher, []))
    chats[key].append(msg)
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
    port = int(os.environ.get("PORT", 8080))
    print("=" * 50)
    print("  ККОТИП — Портал студента запущен!")
    print(f"  Открой в браузере: http://127.0.0.1:{port}")
    print("=" * 50)
    app.run(debug=False, host="0.0.0.0", port=port)
