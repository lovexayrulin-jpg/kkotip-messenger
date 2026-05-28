/* ККОТИП — Frontend с аутентификацией (152-ФЗ) */

let ME = null;
let currentContact = null;
let contacts = [];
let schedule = {};
let selectedRole = "student";
let searchTimer = null;

const DAYS = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const isMobile = () => window.innerWidth <= 680;

// ── INIT ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Проверяем сессию
  const res  = await fetch("/api/me");
  const data = await res.json();
  if (data.ok) enterApp(data.user, data.contacts);
});

// ── AUTH TABS ────────────────────────────────────
function showAuthTab(tab) {
  document.getElementById("tab-login-btn").classList.toggle("active", tab==="login");
  document.getElementById("tab-reg-btn").classList.toggle("active",   tab==="register");
  document.getElementById("tab-login").classList.toggle("hidden",     tab!=="login");
  document.getElementById("tab-register").classList.toggle("hidden",  tab!=="register");
}

function fillLogin(login, pass) {
  document.getElementById("login-login").value = login;
  document.getElementById("login-pass").value  = pass;
}

function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  inp.type = inp.type === "password" ? "text" : "password";
  btn.style.opacity = inp.type === "text" ? "1" : "0.5";
}

function setRole(role) {
  selectedRole = role;
  document.getElementById("role-student").classList.toggle("active", role==="student");
  document.getElementById("role-teacher").classList.toggle("active", role==="teacher");
  document.getElementById("reg-group-field").classList.toggle("hidden", role==="teacher");
}

// Индикатор надёжности пароля
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("reg-pass")?.addEventListener("input", function() {
    const bar = document.getElementById("pass-strength");
    const v = this.value;
    if (!v) { bar.className="pass-strength"; return; }
    const strong = v.length>=8 && /[A-Za-zА-Яа-я]/.test(v) && /[0-9]/.test(v);
    const medium = v.length>=6;
    bar.className = "pass-strength " + (strong?"strong":medium?"medium":"weak");
  });
});

function checkConsent() {
  const checked = document.getElementById("consent-check").checked;
  document.getElementById("reg-submit-btn").disabled = !checked;
}

// ── LOGIN ────────────────────────────────────────
async function doLogin() {
  const login = document.getElementById("login-login").value.trim();
  const pass  = document.getElementById("login-pass").value.trim();
  const errEl = document.getElementById("login-error");
  errEl.classList.add("hidden");

  if (!login || !pass) { showErr(errEl,"Заполните все поля"); return; }

  const res  = await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({login,password:pass})});
  const data = await res.json();
  if (data.ok) enterApp(data.user, data.contacts);
  else showErr(errEl, data.error||"Ошибка входа");
}

// ── REGISTER ─────────────────────────────────────
async function doRegister() {
  const login   = document.getElementById("reg-login").value.trim();
  const pass    = document.getElementById("reg-pass").value.trim();
  const name    = document.getElementById("reg-name").value.trim();
  const group   = document.getElementById("reg-group")?.value.trim()||"";
  const consent = document.getElementById("consent-check").checked;
  const errEl   = document.getElementById("reg-error");
  errEl.classList.add("hidden");

  const res  = await fetch("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({login,password:pass,name,role:selectedRole,group,consent})});
  const data = await res.json();
  if (data.ok) enterApp(data.user, data.contacts);
  else showErr(errEl, data.error||"Ошибка регистрации");
}

// ── ENTER APP ────────────────────────────────────
async function enterApp(user, userContacts) {
  ME = user; contacts = userContacts;
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  document.getElementById("user-card").innerHTML = `
    <div class="avatar avatar--lg" style="background:${ME.color}">${ME.avatar}</div>
    <div><div class="user-name">${ME.name}</div>
    <div class="user-group">${ME.group||(ME.role==="teacher"?"Преподаватель":"")}</div></div>`;

  document.getElementById("welcome-greeting").innerHTML =
    `Добро пожаловать,<br><span>${ME.name}</span>`;

  renderContacts();
  renderProfilePanel();
  await loadSchedule();
  renderScheduleSidebar();
  renderTodayBlock();
  if (isMobile()) showSidebar();
}

// ── LOGOUT ───────────────────────────────────────
async function doLogout() {
  await fetch("/api/logout",{method:"POST"});
  ME=null; currentContact=null; contacts=[];
  document.getElementById("app").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("contacts-list").innerHTML="";
  document.getElementById("welcome-screen").classList.remove("hidden");
  document.getElementById("chat-window").classList.add("hidden");
  document.getElementById("schedule-screen").classList.add("hidden");
  showAuthTab("login");
}

// ── PROFILE PANEL ────────────────────────────────
function renderProfilePanel() {
  const p = document.getElementById("profile-panel");
  p.innerHTML = `
    <div class="profile-section">
      <div class="profile-section-title">Мои данные</div>
      <div class="profile-row"><span class="profile-row-label">Имя</span><span class="profile-row-value">${ME.name}</span></div>
      <div class="profile-row"><span class="profile-row-label">Логин</span><span class="profile-row-value">${ME.login}</span></div>
      <div class="profile-row"><span class="profile-row-label">Роль</span><span class="profile-row-value">${ME.role==="teacher"?"Преподаватель":"Студент"}</span></div>
      ${ME.group?`<div class="profile-row"><span class="profile-row-label">Группа</span><span class="profile-row-value">${ME.group}</span></div>`:""}
    </div>

    <div class="profile-section">
      <div class="profile-section-title">Персональные данные (152-ФЗ)</div>
      <div class="profile-law-note">В соответствии с ФЗ-152 «О персональных данных» вы имеете право на получение сведений о своих данных и их удаление.</div>
      <br>
      <button class="profile-btn" onclick="viewMyData()">📋 Посмотреть мои данные</button>
      <button class="profile-btn" onclick="window.open('/privacy','_blank')">📄 Политика конфиденциальности</button>
      <button class="profile-btn danger" onclick="confirmDeleteAccount()">🗑 Удалить аккаунт и все данные</button>
    </div>`;
}

async function viewMyData() {
  const res  = await fetch("/api/my_data");
  const data = await res.json();
  if (!data.ok) return;
  const d = data.data;
  showModal(
    "Мои персональные данные",
    `<div style="text-align:left;font-size:12px;color:var(--text2);line-height:1.8">
      <b>Логин:</b> ${d.login}<br>
      <b>Имя:</b> ${d.name}<br>
      <b>Роль:</b> ${d.role}<br>
      <b>Группа:</b> ${d.group||"—"}<br>
      <b>Дата регистрации:</b> ${d.registered_at?.slice(0,19).replace("T"," ")}<br>
      <b>Согласие на ПД:</b> ${d.consent_given?"Дано":"Не дано"}<br>
      <b>Дата согласия:</b> ${d.consent_date?.slice(0,19).replace("T"," ")}<br><br>
      <span style="color:var(--text3);font-size:11px">${d.note}</span>
    </div>`,
    "Закрыть", null
  );
}

function confirmDeleteAccount() {
  showModal(
    "Удалить аккаунт?",
    "Все ваши персональные данные будут безвозвратно удалены в соответствии со ст. 21 ФЗ-152. Это действие нельзя отменить.",
    "Отмена",
    "Удалить",
    async () => {
      const res  = await fetch("/api/delete_account",{method:"POST"});
      const data = await res.json();
      if (data.ok) doLogout();
    }
  );
}

// ── MODAL ────────────────────────────────────────
function showModal(title, text, cancelText, confirmText, onConfirm) {
  const existing = document.getElementById("modal-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className="modal-overlay"; overlay.id="modal-overlay";
  overlay.innerHTML=`
    <div class="modal-box">
      <div class="modal-title">${title}</div>
      <div class="modal-text">${text}</div>
      <div class="modal-btns">
        <button class="modal-btn cancel" onclick="document.getElementById('modal-overlay').remove()">${cancelText}</button>
        ${confirmText?`<button class="modal-btn confirm-danger" id="modal-confirm">${confirmText}</button>`:""}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (onConfirm) document.getElementById("modal-confirm").onclick = onConfirm;
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
}

// ── CONTACTS ─────────────────────────────────────
function renderContacts() {
  const list = document.getElementById("contacts-list"); list.innerHTML="";
  const teachers = contacts.filter(c=>c.role==="teacher");
  const students  = contacts.filter(c=>c.role==="student");
  if (teachers.length) { list.innerHTML+=`<div class="section-label">ПРЕПОДАВАТЕЛИ</div>`; teachers.forEach(c=>list.appendChild(makeContactEl(c))); }
  if (students.length)  { list.innerHTML+=`<div class="section-label">ОДНОГРУППНИКИ</div>`;  students.forEach(c=>list.appendChild(makeContactEl(c))); }
}

function makeContactEl(c) {
  const el=document.createElement("div"); el.className="contact-item"; el.id="contact-"+c.id;
  el.innerHTML=`
    <div class="avatar" style="background:${c.color}">${c.avatar}${c.online?'<span class="online-dot"></span>':""}</div>
    <div class="contact-info">
      <div class="contact-name">${c.name}</div>
      <div class="contact-last">${c.role==="teacher"?"Преподаватель":(c.group?"Группа "+c.group:"Студент")}</div>
    </div>`;
  el.onclick=()=>openChat(c);
  return el;
}

// ── SEARCH ───────────────────────────────────────
function onSearch(val) {
  document.getElementById("search-clear").classList.toggle("hidden",!val);
  clearTimeout(searchTimer);
  if (!val) { document.getElementById("search-results").classList.add("hidden"); return; }
  searchTimer = setTimeout(()=>showSearchResults(val), 300);
}
async function showSearchResults(q) {
  const res=await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const list=await res.json();
  const box=document.getElementById("search-results"); box.classList.remove("hidden");
  if (!list.length) { box.innerHTML=`<div class="search-no-results">Никого не найдено</div>`; return; }
  box.innerHTML=list.map(u=>`
    <div class="search-result-item" onclick='addAndOpenChat(${JSON.stringify(u)})'>
      <div class="avatar" style="background:${u.color}">${u.avatar}</div>
      <div><div class="contact-name">${u.name}</div><div class="contact-last">${u.role==="teacher"?"Преподаватель":(u.group?"Группа "+u.group:"Студент")}</div></div>
    </div>`).join("");
}
function addAndOpenChat(user) {
  clearSearch();
  if (!contacts.find(c=>c.id===user.id)) {
    contacts.push(user);
    const list=document.getElementById("contacts-list");
    let sec=list.querySelector(".sec-other");
    if (!sec) {
      list.innerHTML+=`<div class="section-label">ДРУГИЕ</div>`;
      sec=document.createElement("div"); sec.className="sec-other"; list.appendChild(sec);
    }
    sec.appendChild(makeContactEl(user));
  }
  openChat(user);
}
function clearSearch() {
  document.getElementById("search-input").value="";
  document.getElementById("search-clear").classList.add("hidden");
  document.getElementById("search-results").classList.add("hidden");
}
document.addEventListener("click",e=>{ if(!e.target.closest(".search-bar")) document.getElementById("search-results")?.classList.add("hidden"); });

// ── CHAT ─────────────────────────────────────────
async function openChat(c) {
  currentContact=c;
  document.querySelectorAll(".contact-item").forEach(el=>el.classList.remove("active"));
  document.getElementById("contact-"+c.id)?.classList.add("active");
  document.getElementById("welcome-screen").classList.add("hidden");
  document.getElementById("schedule-screen").classList.add("hidden");
  document.getElementById("chat-window").classList.remove("hidden");
  const av=document.getElementById("chat-avatar-el"); av.textContent=c.avatar; av.style.background=c.color;
  document.getElementById("chat-name-el").textContent=c.name;
  document.getElementById("chat-status-el").textContent=c.role==="teacher"?"Преподаватель":(c.group?"Студент · Группа "+c.group:"Студент");
  if (isMobile()) hideSidebar();
  await loadMessages(c.id);
  document.getElementById("msg-input").focus();
}

async function loadMessages(cid) {
  const area=document.getElementById("messages-area");
  area.innerHTML=`<div style="text-align:center;color:var(--text3);font-size:12px;padding:20px">Загрузка…</div>`;
  const res=await fetch(`/api/messages?cid=${cid}`);
  const msgs=await res.json();
  area.innerHTML=""; let lastDate=null;
  msgs.forEach(m=>{
    if (m.date!==lastDate) { const dl=document.createElement("div"); dl.className="date-label"; dl.textContent=m.date; area.appendChild(dl); lastDate=m.date; }
    area.appendChild(makeBubble(m));
  });
  area.scrollTop=area.scrollHeight;
}

function makeBubble(msg) {
  const isOut=ME&&msg.from===ME.id;
  const row=document.createElement("div"); row.className=`bubble-row ${isOut?"out":"in"}`;
  row.innerHTML=`<div class="bubble"><div>${escHtml(msg.text)}</div><div class="bubble-time">${msg.time}</div></div>`;
  return row;
}

async function sendMessage() {
  const input=document.getElementById("msg-input");
  const text=input.value.trim();
  if (!text||!currentContact) return;
  input.value="";
  const res=await fetch("/api/send",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({cid:currentContact.id,text})});
  const data=await res.json();
  if (data.ok) { const area=document.getElementById("messages-area"); area.appendChild(makeBubble(data.msg)); area.scrollTop=area.scrollHeight; }
}

function closeChatMobile() {
  document.getElementById("chat-window").classList.add("hidden");
  document.getElementById("welcome-screen").classList.remove("hidden");
  currentContact=null;
  document.querySelectorAll(".contact-item").forEach(el=>el.classList.remove("active"));
  if (isMobile()) showSidebar();
}

// ── SCHEDULE ─────────────────────────────────────
async function loadSchedule() { const res=await fetch("/api/schedule"); schedule=await res.json(); }

function renderScheduleSidebar() {
  const container=document.getElementById("sched-day-list"); container.innerHTML="";
  const todayName=DAYS[new Date().getDay()===0?6:new Date().getDay()-1];
  DAYS.slice(0,6).forEach(day=>{
    const lessons=schedule[day]; if(!lessons) return;
    const btn=document.createElement("button");
    btn.className="sched-day-btn"+(day===todayName?" today":"");
    btn.innerHTML=`${day} <span class="sched-count">${lessons.length} пар</span>`;
    btn.onclick=()=>{switchTab("schedule");showDayContent(day);};
    container.appendChild(btn);
  });
}

async function renderTodayBlock() {
  const res=await fetch("/api/today"); const data=await res.json();
  const block=document.getElementById("today-block");
  if (!data.lessons?.length) { block.innerHTML=`<div class="today-title">СЕГОДНЯ · ${data.day.toUpperCase()}</div><div style="color:var(--text3);font-size:13px;padding:8px 0">Занятий нет 🎉</div>`; return; }
  let html=`<div class="today-title">СЕГОДНЯ · ${data.day.toUpperCase()}</div>`;
  data.lessons.forEach(l=>{ html+=`<div class="today-lesson"><div class="lesson-time">${l.time}</div><div><div class="lesson-name">${l.subject}</div><div class="lesson-teacher">${l.teacher} · ауд. ${l.room}</div></div></div>`; });
  block.innerHTML=html;
}

function showScheduleScreen() {
  document.getElementById("welcome-screen").classList.add("hidden");
  document.getElementById("chat-window").classList.add("hidden");
  document.getElementById("schedule-screen").classList.remove("hidden");
  if (isMobile()) hideSidebar();
  const todayName=DAYS[new Date().getDay()===0?6:new Date().getDay()-1];
  const tabs=document.getElementById("day-tabs"); tabs.innerHTML="";
  const days=DAYS.slice(0,6).filter(d=>schedule[d]);
  days.forEach(day=>{ const btn=document.createElement("button"); btn.className="day-tab-btn"+(day===todayName?" today":""); btn.textContent=day; btn.onclick=()=>showDayContent(day); tabs.appendChild(btn); });
  showDayContent(schedule[todayName]?todayName:(days[0]||"Вторник"));
}

function showDayContent(day) {
  document.querySelectorAll(".day-tab-btn").forEach(b=>b.classList.toggle("active",b.textContent===day));
  const lessons=schedule[day]||[]; const content=document.getElementById("day-content");
  if (!lessons.length) { content.innerHTML=`<div class="no-lessons">В этот день занятий нет 🎉</div>`; return; }
  let html=`<div class="sched-card">`;
  lessons.forEach(l=>{ html+=`<div class="sched-row"><div class="sched-dot type-${l.type}"></div><div style="flex:1"><div style="display:flex;justify-content:space-between"><div class="sched-time">${l.time}</div><span class="sched-room">ауд. ${l.room}</span></div><div class="sched-subject">${l.subject}</div><div class="sched-meta">${l.teacher}</div></div></div>`; });
  content.innerHTML=html+`</div>`;
}

function switchTab(tab) {
  document.querySelectorAll(".nav-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  document.querySelectorAll(".tab-content").forEach(t=>t.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
  if (tab==="schedule") showScheduleScreen();
  else {
    document.getElementById("schedule-screen").classList.add("hidden");
    if (!currentContact) { document.getElementById("chat-window").classList.add("hidden"); document.getElementById("welcome-screen").classList.remove("hidden"); }
    if (isMobile()&&tab!=="profile") showSidebar();
  }
}

function hideSidebar(){ document.getElementById("sidebar").classList.add("hidden-mobile"); }
function showSidebar() { document.getElementById("sidebar").classList.remove("hidden-mobile"); }
function escHtml(s)    { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function showErr(el,msg){ el.textContent=msg; el.classList.remove("hidden"); }
