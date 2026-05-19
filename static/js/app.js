/* ═══════════════════════════════════════════════
   ККОТИП — Frontend Logic
═══════════════════════════════════════════════ */

let currentContact = null;
let schedule = {};

const DAYS = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];

// ── Init ────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadSchedule();
  renderTodayBlock();
  renderScheduleSidebar();
});

// ── Tab switching ───────────────────────────────
function switchTab(tab) {
  document.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));

  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
  document.getElementById(`tab-${tab}`).classList.add("active");

  if (tab === "schedule") {
    showScheduleScreen();
  } else {
    document.getElementById("schedule-screen").classList.add("hidden");
    if (!currentContact) showWelcome();
  }
}

// ── Open chat ───────────────────────────────────
async function openChat(id, name, avatar, color, subject, role) {
  currentContact = id;

  // Mark active contact
  document.querySelectorAll(".contact-item").forEach(el => el.classList.remove("active"));
  document.getElementById(`contact-${id}`)?.classList.add("active");

  // Hide/show panels
  document.getElementById("welcome-screen").classList.add("hidden");
  document.getElementById("schedule-screen").classList.add("hidden");
  const cw = document.getElementById("chat-window");
  cw.classList.remove("hidden");
  document.getElementById("main").classList.add("chat-open");

  // Set header
  const avatarEl = document.getElementById("chat-avatar-el");
  avatarEl.textContent = avatar;
  avatarEl.style.background = color;

  document.getElementById("chat-name-el").textContent = name;
  document.getElementById("chat-status-el").textContent =
    role === "teacher" ? `Преподаватель · ${subject}` : `Одногруппник · Группа ${subject}`;

  // Load messages
  await loadMessages(id);

  document.getElementById("msg-input").focus();
}

// ── Load messages ───────────────────────────────
async function loadMessages(contactId) {
  const area = document.getElementById("messages-area");
  area.innerHTML = "<div style='text-align:center;color:var(--text3);font-size:12px;padding:20px'>Загрузка…</div>";

  const res = await fetch(`/api/messages/${contactId}`);
  const msgs = await res.json();

  area.innerHTML = "";
  let lastDate = null;

  msgs.forEach(m => {
    if (m.date !== lastDate) {
      const dl = document.createElement("div");
      dl.className = "date-label";
      dl.textContent = m.date;
      area.appendChild(dl);
      lastDate = m.date;
    }
    area.appendChild(buildBubble(m));
  });
  area.scrollTop = area.scrollHeight;
}

// ── Build bubble ────────────────────────────────
function buildBubble(msg) {
  const isOut = msg.from === "marcel";
  const row = document.createElement("div");
  row.className = `bubble-row ${isOut ? "out" : "in"}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const txt = document.createElement("div");
  txt.textContent = msg.text;

  const time = document.createElement("div");
  time.className = "bubble-time";
  time.textContent = msg.time;

  bubble.appendChild(txt);
  bubble.appendChild(time);
  row.appendChild(bubble);
  return row;
}

// ── Send message ────────────────────────────────
async function sendMessage() {
  const input = document.getElementById("msg-input");
  const text = input.value.trim();
  if (!text || !currentContact) return;

  input.value = "";

  const res = await fetch("/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contact_id: currentContact, text })
  });
  const data = await res.json();
  if (data.ok) {
    const area = document.getElementById("messages-area");
    area.appendChild(buildBubble(data.msg));
    area.scrollTop = area.scrollHeight;
  }
}

// ── Back to welcome ─────────────────────────────
function backToWelcome() {
  currentContact = null;
  document.querySelectorAll(".contact-item").forEach(el => el.classList.remove("active"));
  document.getElementById("chat-window").classList.add("hidden");
  document.getElementById("main").classList.remove("chat-open");
  showWelcome();
}

function showWelcome() {
  document.getElementById("welcome-screen").classList.remove("hidden");
  document.getElementById("schedule-screen").classList.add("hidden");
  document.getElementById("chat-window").classList.add("hidden");
}

// ── Load schedule ───────────────────────────────
async function loadSchedule() {
  const res = await fetch("/api/schedule");
  schedule = await res.json();
}

// ── Today block on welcome ──────────────────────
async function renderTodayBlock() {
  const res = await fetch("/api/today");
  const data = await res.json();
  const block = document.getElementById("today-block");

  if (!data.lessons || data.lessons.length === 0) {
    block.innerHTML = `<div class="today-title">СЕГОДНЯ · ${data.day.toUpperCase()}</div><div style="color:var(--text3);font-size:13px;padding:8px 0">Занятий нет 🎉</div>`;
    return;
  }

  let html = `<div class="today-title">СЕГОДНЯ · ${data.day.toUpperCase()}</div>`;
  data.lessons.forEach(l => {
    html += `
      <div class="today-lesson">
        <div class="lesson-time">${l.time}</div>
        <div>
          <div class="lesson-name">${l.subject}</div>
          <div class="lesson-teacher">${l.teacher} · ауд. ${l.room}</div>
        </div>
      </div>`;
  });
  block.innerHTML = html;
}

// ── Schedule sidebar buttons ────────────────────
function renderScheduleSidebar() {
  const container = document.getElementById("schedule-days");
  const todayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  container.innerHTML = "";

  DAYS.slice(0, 5).forEach(day => {
    const lessons = schedule[day] || [];
    const btn = document.createElement("button");
    btn.className = "sched-day-btn" + (day === todayName ? " today" : "");
    btn.innerHTML = `${day} <span class="sched-count">${lessons.length} пар</span>`;
    btn.onclick = () => { switchTab("schedule"); };
    container.appendChild(btn);
  });
}

// ── Full schedule screen ────────────────────────
function showScheduleScreen() {
  document.getElementById("welcome-screen").classList.add("hidden");
  document.getElementById("chat-window").classList.add("hidden");
  document.getElementById("schedule-screen").classList.remove("hidden");
  renderScheduleFull();
}

function renderScheduleFull() {
  const todayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const container = document.getElementById("schedule-full");
  container.innerHTML = "";

  DAYS.slice(0, 5).forEach(day => {
    const lessons = schedule[day] || [];
    const card = document.createElement("div");
    card.className = "sched-card";

    const isToday = day === todayName;
    card.innerHTML = `
      <div class="sched-card-header">
        ${day}
        ${isToday ? '<span class="today-badge">Сегодня</span>' : ''}
      </div>`;

    if (lessons.length === 0) {
      card.innerHTML += `<div style="padding:16px 18px;color:var(--text3);font-size:13px">Нет занятий</div>`;
    } else {
      lessons.forEach(l => {
        card.innerHTML += `
          <div class="sched-row">
            <div class="sched-type-dot type-${l.type}"></div>
            <div style="flex:1">
              <div>
                <span class="sched-subject">${l.subject}</span>
                <span class="sched-room">ауд. ${l.room}</span>
              </div>
              <div class="sched-time">${l.time}</div>
              <div class="sched-meta">${l.teacher}</div>
            </div>
          </div>`;
      });
    }
    container.appendChild(card);
  });
}
