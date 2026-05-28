"""
ККОТИП — Портал студента
Аутентификация и обработка персональных данных
в соответствии с Федеральным законом № 152-ФЗ «О персональных данных»
"""
from flask import Flask, render_template, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os, uuid, json

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "kkotip_secret_key_2024")
app.permanent_session_lifetime = timedelta(hours=8)

# ─── 152-ФЗ: минимальный набор персональных данных ───────────────────────────
# Храним только: логин, хэш пароля, имя, роль, группа, дата регистрации,
# согласие на обработку ПД. Никаких лишних данных.

# ─── Хранилище (в продакшне заменить на БД) ──────────────────────────────────
users_db    = {}   # login -> {id, name, role, group, avatar, color, password_hash, consent_date, registered_at}
sessions_db = {}   # session_token -> uid
chats_db    = {}   # tuple(uid1,uid2) -> [msg,...]

AVATAR_COLORS = ["#4F8EF7","#E05C5C","#7C5CE4","#00B894","#FDCB6E",
                 "#55EFC4","#FD79A8","#A29BFE","#6C5CE7","#00CEC9"]

# ─── Предустановленные пользователи (демо) ────────────────────────────────────
DEMO_USERS = [
    {"login":"marcel",    "name":"Хайрулин Марсель",     "role":"student","group":"ИС 24-01/1","avatar":"МХ","color":"#4F8EF7","password":"marcel123"},
    {"login":"danis",     "name":"Данис Шакиров",         "role":"student","group":"ИС 24-01/1","avatar":"ДШ","color":"#FDCB6E","password":"danis123"},
    {"login":"dima",      "name":"Дима Колмаков",         "role":"student","group":"ИС 24-01/1","avatar":"ДК","color":"#55EFC4","password":"dima123"},
    {"login":"stanislav", "name":"Станислав Юрьевич",     "role":"teacher","group":"",          "avatar":"СЮ","color":"#E05C5C","password":"stan123"},
    {"login":"olga",      "name":"Ольга Сергеевна",       "role":"teacher","group":"",          "avatar":"ОС","color":"#7C5CE4","password":"olga123"},
    {"login":"ekaterina", "name":"Екатерина Комиссарова", "role":"teacher","group":"",          "avatar":"ЕК","color":"#00B894","password":"kate123"},
]

for u in DEMO_USERS:
    uid = u["login"]
    users_db[u["login"]] = {
        "id":            uid,
        "login":         u["login"],
        "name":          u["name"],
        "role":          u["role"],
        "group":         u["group"],
        "avatar":        u["avatar"],
        "color":         u["color"],
        "password_hash": generate_password_hash(u["password"]),
        "consent_given": True,
        "consent_date":  "2024-01-01T00:00:00",
        "registered_at": "2024-01-01T00:00:00",
    }

# ─── Расписание ───────────────────────────────────────────────────────────────
SCHEDULE = {
    "Понедельник": [
        {"time":"08:30–10:00","subject":"ЭКЗАМЕН","teacher":"ТРОПАШКО О.А.","room":"209","type":"exam"},
    ],
    "Вторник": [
        {"time":"08:30–10:00","subject":"О.С.Т.","teacher":"ЛАВРЕНКОВ С.С.","room":"207","type":"lecture"},
        {"time":"10:10–11:40","subject":"Осн. алгоритмизации и программирования","teacher":"ЛАВРЕНКОВ С.С.","room":"207","type":"lab"},
        {"time":"12:10–13:40","subject":"Физическая культура","teacher":"ДУБИНИН Е.О.","room":"СП ПЛОЩАДКА","type":"sport"},
        {"time":"13:50–15:20","subject":"МДК.03.02 Управление проектами","teacher":"КОМИССАРОВА Е.А.","room":"301А","type":"lab"},
    ],
    "Среда": [
        {"time":"12:10–13:40","subject":"О.С.Т.","teacher":"ЛАВРЕНКОВ С.С.","room":"207","type":"lecture"},
        {"time":"13:50–15:20","subject":"Физическая культура","teacher":"ДУБИНИН Е.О.","room":"СП ЗАЛ","type":"sport"},
        {"time":"15:30–17:00","subject":"Осн. алгоритмизации и программирования","teacher":"ЛАВРЕНКОВ С.С.","room":"207","type":"lab"},
    ],
    "Четверг": [
        {"time":"08:30–10:00","subject":"Учебная практика","teacher":"ШИХОВА Ю.А.","room":"405","type":"lab"},
        {"time":"10:10–11:40","subject":"Учебная практика","teacher":"ШИХОВА Ю.А.","room":"405","type":"lab"},
        {"time":"12:10–13:40","subject":"Учебная практика","teacher":"ШИХОВА Ю.А.","room":"405","type":"lab"},
    ],
    "Пятница": [
        {"time":"08:30–10:00","subject":"МДК.05.02 Разработка кода информационных систем","teacher":"ГЛУХОВ С.Ю.","room":"403","type":"lab"},
        {"time":"10:10–11:40","subject":"Осн. алгоритмизации и программирования","teacher":"ЛАВРЕНКОВ С.С.","room":"207","type":"lab"},
        {"time":"12:10–13:40","subject":"О.С.Т.","teacher":"ЛАВРЕНКОВ С.С.","room":"207","type":"lecture"},
        {"time":"13:50–15:20","subject":"Физическая культура","teacher":"ДУБИНИН Е.О.","room":"СП ПЛОЩАДКА","type":"sport"},
        {"time":"15:30–17:00","subject":"МДК.03.02 Управление проектами","teacher":"КОМИССАРОВА Е.А.","room":"403","type":"lab"},
    ],
}

# ─── Вспомогательные функции ──────────────────────────────────────────────────
def make_avatar(name):
    parts = name.strip().split()
    return (parts[0][0]+parts[1][0]).upper() if len(parts)>=2 else name[:2].upper()

def get_uid():
    return session.get("uid")

def get_user(uid=None):
    uid = uid or get_uid()
    if not uid: return None
    for u in users_db.values():
        if u["id"] == uid:
            return u
    return None

def safe_user(u):
    """Отдаём клиенту только безопасные поля — без хэша пароля"""
    return {k:v for k,v in u.items()
            if k not in ("password_hash","consent_date","registered_at")}

def chat_key(a, b):
    return tuple(sorted([a, b]))

def get_contacts(uid):
    me = get_user(uid)
    result = []
    for u in users_db.values():
        if u["id"] == uid: continue
        su = safe_user(u)
        su["online"] = u["id"] in ["stanislav","ekaterina","danis"]
        result.append(su)
    return result

def initial_msgs(uid, cid):
    starters = {
        "stanislav": [{"from":"stanislav","text":"Добрый день! Напоминаю о контрольной в пятницу.","time":"09:15","date":"Вчера"}],
        "olga":      [{"from":"olga","text":"Вы сдали лабораторную работу №3?","time":"14:00","date":"Вчера"}],
        "ekaterina": [{"from":"ekaterina","text":"Не забудьте про эссе — сдача до воскресенья.","time":"10:00","date":"Сегодня"}],
    }
    teacher = cid if cid in starters else (uid if uid in starters else None)
    return list(starters.get(teacher, []))

# ─── Маршруты ─────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/privacy")
def privacy():
    return render_template("privacy.html")

# ── Аутентификация ────────────────────────────────────────────────────────────
@app.route("/api/register", methods=["POST"])
def api_register():
    """Регистрация нового пользователя. 152-ФЗ: фиксируем согласие на ПД."""
    d = request.get_json()
    login    = d.get("login","").strip().lower()
    password = d.get("password","").strip()
    name     = d.get("name","").strip()
    role     = d.get("role","student")
    group    = d.get("group","").strip()
    consent  = d.get("consent", False)   # 152-ФЗ: обязательное согласие

    # Валидация
    if not login:    return jsonify({"ok":False,"error":"Введите логин"}), 400
    if len(login)<3: return jsonify({"ok":False,"error":"Логин минимум 3 символа"}), 400
    if not password: return jsonify({"ok":False,"error":"Введите пароль"}), 400
    if len(password)<6: return jsonify({"ok":False,"error":"Пароль минимум 6 символов"}), 400
    if not name:     return jsonify({"ok":False,"error":"Введите имя"}), 400
    if not consent:  return jsonify({"ok":False,"error":"Необходимо согласие на обработку персональных данных (152-ФЗ)"}), 400
    if login in users_db: return jsonify({"ok":False,"error":"Такой логин уже занят"}), 400

    uid   = "u_" + str(uuid.uuid4())[:8]
    color = AVATAR_COLORS[len(users_db) % len(AVATAR_COLORS)]
    now   = datetime.now().isoformat()

    user = {
        "id":            uid,
        "login":         login,
        "name":          name,
        "role":          role,
        "group":         group,
        "avatar":        make_avatar(name),
        "color":         color,
        "password_hash": generate_password_hash(password),
        "consent_given": True,
        "consent_date":  now,   # 152-ФЗ: дата и время согласия
        "registered_at": now,
    }
    users_db[login] = user

    # Создаём сессию
    session.permanent = True
    session["uid"] = uid
    return jsonify({"ok":True,"user":safe_user(user),"contacts":get_contacts(uid)})

@app.route("/api/login", methods=["POST"])
def api_login():
    """Идентификация + аутентификация пользователя."""
    d        = request.get_json()
    login    = d.get("login","").strip().lower()
    password = d.get("password","").strip()

    if not login or not password:
        return jsonify({"ok":False,"error":"Введите логин и пароль"}), 400

    user = users_db.get(login)
    if not user:
        return jsonify({"ok":False,"error":"Пользователь не найден"}), 404
    if not check_password_hash(user["password_hash"], password):
        return jsonify({"ok":False,"error":"Неверный пароль"}), 401

    session.permanent = True
    session["uid"] = user["id"]
    return jsonify({"ok":True,"user":safe_user(user),"contacts":get_contacts(user["id"])})

@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"ok":True})

@app.route("/api/me")
def api_me():
    """Проверка текущей сессии."""
    uid = get_uid()
    if not uid: return jsonify({"ok":False}), 401
    user = get_user(uid)
    if not user: return jsonify({"ok":False}), 401
    return jsonify({"ok":True,"user":safe_user(user),"contacts":get_contacts(uid)})

# ── 152-ФЗ: управление персональными данными ──────────────────────────────────
@app.route("/api/delete_account", methods=["POST"])
def api_delete_account():
    """152-ФЗ ст.21: право субъекта на удаление своих персональных данных."""
    uid = get_uid()
    if not uid: return jsonify({"ok":False,"error":"Не авторизован"}), 401
    user = get_user(uid)
    if not user: return jsonify({"ok":False}), 404

    # Удаляем пользователя
    login = user["login"]
    if login in users_db:
        del users_db[login]

    # Удаляем все чаты с этим пользователем
    keys_to_del = [k for k in chats_db if uid in k]
    for k in keys_to_del:
        del chats_db[k]

    session.clear()
    return jsonify({"ok":True,"message":"Ваши персональные данные удалены"})

@app.route("/api/my_data")
def api_my_data():
    """152-ФЗ ст.14: право субъекта знать какие данные о нём хранятся."""
    uid = get_uid()
    if not uid: return jsonify({"ok":False}), 401
    user = get_user(uid)
    if not user: return jsonify({"ok":False}), 404
    return jsonify({
        "ok": True,
        "data": {
            "id":            user["id"],
            "login":         user["login"],
            "name":          user["name"],
            "role":          user["role"],
            "group":         user["group"],
            "registered_at": user["registered_at"],
            "consent_given": user["consent_given"],
            "consent_date":  user["consent_date"],
            "note":          "Хранятся только: логин, имя, роль, группа. Пароль хранится в виде необратимого хэша. Иные персональные данные не собираются."
        }
    })

# ── Поиск ─────────────────────────────────────────────────────────────────────
@app.route("/api/search")
def api_search():
    uid = get_uid()
    q   = request.args.get("q","").strip().lower()
    if not q or not uid: return jsonify([])
    results = [safe_user(u) for u in users_db.values()
               if u["id"]!=uid and q in u["name"].lower()]
    return jsonify(results[:10])

# ── Сообщения ─────────────────────────────────────────────────────────────────
@app.route("/api/messages")
def api_messages():
    uid = get_uid()
    cid = request.args.get("cid","")
    if not uid or not cid: return jsonify([])
    key  = chat_key(uid, cid)
    msgs = chats_db.get(key)
    if msgs is None:
        msgs = initial_msgs(uid, cid)
    return jsonify(msgs)

@app.route("/api/send", methods=["POST"])
def api_send():
    uid = get_uid()
    if not uid: return jsonify({"ok":False,"error":"Не авторизован"}), 401
    d    = request.get_json()
    cid  = d.get("cid","")
    text = d.get("text","").strip()
    if not text or not cid: return jsonify({"ok":False}), 400

    now = datetime.now()
    msg = {"from":uid,"text":text,"time":now.strftime("%H:%M"),"date":"Сегодня"}
    key = chat_key(uid, cid)
    if key not in chats_db:
        chats_db[key] = initial_msgs(uid, cid)
    chats_db[key].append(msg)
    return jsonify({"ok":True,"msg":msg})

# ── Расписание ────────────────────────────────────────────────────────────────
@app.route("/api/schedule")
def api_schedule():
    return jsonify(SCHEDULE)

@app.route("/api/today")
def api_today():
    days_ru = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"]
    today   = days_ru[datetime.now().weekday()]
    return jsonify({"day":today,"lessons":SCHEDULE.get(today,[])})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print("="*50)
    print("  ККОТИП — Портал студента запущен!")
    print(f"  http://127.0.0.1:{port}")
    print("="*50)
    app.run(debug=False, host="0.0.0.0", port=port)
