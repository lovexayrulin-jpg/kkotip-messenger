/* ККОТИП — Frontend */

let ME = null;          // текущий пользователь
let currentContact = null;
let contacts = [];
let schedule = {};
let selectedRole = "student";
let searchTimer = null;

const DAYS = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const isMobile = () => window.innerWidth <= 680;

// ── INIT ────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  FIXED_USERS.filter(u=>u.role==="student").forEach(u=>{
    document.getElementById("login-students").appendChild(makeLoginBtn(u));
  });
  FIXED_USERS.filter(u=>u.role==="teacher").forEach(u=>{
    document.getElementById("login-teachers").appendChild(makeLoginBtn(u));
  });
});

function makeLoginBtn(u) {
  const btn = document.createElement("button");
  btn.className = "login-user-btn";
  btn.innerHTML = `
    <div class="avatar" style="background:${u.color}">${u.avatar}</div>
    <div class="login-user-info">
      <div class="login-user-name">${u.name}</div>
      <div class="login-user-role">${u.role==="teacher"?"Преподаватель":"Студент · "+u.group}</div>
    </div>
    <span class="login-arrow">›</span>`;
  btn.onclick = () => loginFixed(u.id);
  return btn;
}

// ── LOGIN TABS ───────────────────────────────────
function showLoginTab(tab) {
  document.querySelectorAll(".login-tab").forEach((b,i)=>
    b.classList.toggle("active",(i===0&&tab==="select")||(i===1&&tab==="custom")));
  document.getElementById("tab-select").classList.toggle("hidden", tab!=="select");
  document.getElementById("tab-custom").classList.toggle("hidden",  tab!=="custom");
}

function setRole(role) {
  selectedRole = role;
  document.getElementById("role-student").classList.toggle("active", role==="student");
  document.getElementById("role-teacher").classList.toggle("active", role==="teacher");
  document.getElementById("group-field").classList.toggle("hidden",  role==="teacher");
}

// ── LOGIN ────────────────────────────────────────
async function loginFixed(userId) {
  const res  = await fetch("/api/login", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:userId})});
  const data = await res.json();
  if (data.ok) enterApp(data.user, data.contacts);
}

async function loginCustom() {
  const name  = document.getElementById("custom-name").value.trim();
  const group = document.getElementById("custom-group")?.value.trim()||"";
  const errEl = document.getElementById("form-error");
  if (!name) { showErr(errEl,"Пожалуйста, введи своё имя!"); return; }
  errEl.classList.add("hidden");
  const res  = await fetch("/api/login_custom",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,role:selectedRole,group})});
  const data = await res.json();
  if (data.ok) enterApp(data.user, data.contacts);
  else showErr(errEl, data.error||"Ошибка входа");
}

function showErr(el, msg) { el.textContent=msg; el.classList.remove("hidden"); }

function enterApp(user, userContacts) {
  ME = user; contacts = userContacts;
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("user-card").innerHTML = `
    <div class="avatar avatar--lg" style="background:${ME.color}">${ME.avatar}</div>
    <div><div class="user-name">${ME.name}</div>
    <div class="user-group">${ME.group||(ME.role==="teacher"?"Преподаватель":"")}</div></div>`;
  document.getElementById("welcome-greeting").innerHTML = `Добро пожаловать,<br><span>${ME.name}</span>`;
  renderContacts();
  loadSchedule().then(()=>{ renderScheduleSidebar(); renderTodayBlock(); });
  if (isMobile()) showSidebar();
}

function logout() {
  ME=null; currentContact=null; contacts=[]; schedule={};
  document.getElementById("app").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("contacts-list").innerHTML="";
  document.getElementById("welcome-screen").classList.remove("hidden");
  document.getElementById("chat-window").classList.add("hidden");
  document.getElementById("schedule-screen").classList.add("hidden");
  document.getElementById("custom-name").value="";
  clearSearch();
  showLoginTab("select");
}

// ── CONTACTS ─────────────────────────────────────
function renderContacts() {
  const list = document.getElementById("contacts-list");
  list.innerHTML = "";
  const teachers = contacts.filter(c=>c.role==="teacher");
  const students  = contacts.filter(c=>c.role==="student");
  if (teachers.length) { list.innerHTML+=`<div class="section-label">ПРЕПОДАВАТЕЛИ</div>`; teachers.forEach(c=>list.appendChild(makeContactEl(c))); }
  if (students.length)  { list.innerHTML+=`<div class="section-label">ОДНОГРУППНИКИ</div>`; students.forEach(c=>list.appendChild(makeContactEl(c))); }
}

function makeContactEl(c) {
  const el = document.createElement("div");
  el.className="contact-item"; el.id="contact-"+c.id;
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
function openSearch() {
  const val = document.getElementById("search-input").value.trim();
  if (val) showSearchResults(val);
}

function onSearch(val) {
  const clearBtn = document.getElementById("search-clear");
  clearBtn.classList.toggle("hidden", !val);
  clearTimeout(searchTimer);
  if (!val) { document.getElementById("search-results").classList.add("hidden"); return; }
  searchTimer = setTimeout(()=>showSearchResults(val), 300);
}

async function showSearchResults(q) {
  const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}&uid=${ME?.id||""}`);
  const list = await res.json();
  const box  = document.getElementById("search-results");
  box.classList.remove("hidden");
  if (!list.length) {
    box.innerHTML=`<div class="search-no-results">Никого не найдено</div>`; return;
  }
  box.innerHTML = list.map(u=>`
    <div class="search-result-item" onclick="addAndOpenChat(${JSON.stringify(u).replace(/"/g,'&quot;')})">
      <div class="avatar" style="background:${u.color}">${u.avatar}</div>
      <div>
        <div class="contact-name">${u.name}</div>
        <div class="contact-last">${u.role==="teacher"?"Преподаватель":(u.group?"Группа "+u.group:"Студент")}</div>
      </div>
    </div>`).join("");
}

function addAndOpenChat(user) {
  clearSearch();
  // Добавить в контакты если нет
  if (!contacts.find(c=>c.id===user.id)) {
    contacts.push(user);
    // Добавить в список
    const list = document.getElementById("contacts-list");
    let section = list.querySelector('.section-other');
    if (!section) {
      const lbl = document.createElement("div");
      lbl.className="section-label"; lbl.textContent="ДРУГИЕ";
      list.appendChild(lbl);
      section = document.createElement("div");
      section.className="section-other";
      list.appendChild(section);
    }
    section.appendChild(makeContactEl(user));
  }
  openChat(user);
}

function clearSearch() {
  document.getElementById("search-input").value="";
  document.getElementById("search-clear").classList.add("hidden");
  document.getElementById("search-results").classList.add("hidden");
}

// Клик вне поиска — закрыть результаты
document.addEventListener("click", e=>{
  if (!e.target.closest(".search-bar"))
    document.getElementById("search-results")?.classList.add("hidden");
});

// ── CHAT ─────────────────────────────────────────
async function openChat(c) {
  currentContact = c;
  document.querySelectorAll(".contact-item").forEach(el=>el.classList.remove("active"));
  document.getElementById("contact-"+c.id)?.classList.add("active");
  document.getElementById("welcome-screen").classList.add("hidden");
  document.getElementById("schedule-screen").classList.add("hidden");
  document.getElementById("chat-window").classList.remove("hidden");
  const av = document.getElementById("chat-avatar-el");
  av.textContent=c.avatar; av.style.background=c.color;
  document.getElementById("chat-name-el").textContent=c.name;
  document.getElementById("chat-status-el").textContent=
    c.role==="teacher"?"Преподаватель":(c.group?"Студент · Группа "+c.group:"Студент");
  if (isMobile()) hideSidebar();
  await loadMessages(c.id);
  document.getElementById("msg-input").focus();
}

async function loadMessages(cid) {
  const area=document.getElementById("messages-area");
  area.innerHTML=`<div style="text-align:center;color:var(--text3);font-size:12px;padding:20px">Загрузка…</div>`;
  const res  = await fetch(`/api/messages?uid=${ME.id}&cid=${cid}`);
  const msgs = await res.json();
  area.innerHTML="";
  let lastDate=null;
  msgs.forEach(m=>{
    if (m.date!==lastDate) {
      const dl=document.createElement("div"); dl.className="date-label"; dl.textContent=m.date;
      area.appendChild(dl); lastDate=m.date;
    }
    area.appendChild(makeBubble(m));
  });
  area.scrollTop=area.scrollHeight;
}

function makeBubble(msg) {
  const isOut = ME && msg.from===ME.id;
  const row=document.createElement("div"); row.className=`bubble-row ${isOut?"out":"in"}`;
  row.innerHTML=`<div class="bubble"><div>${escHtml(msg.text)}</div><div class="bubble-time">${msg.time}</div></div>`;
  return row;
}

async function sendMessage() {
  const input=document.getElementById("msg-input");
  const text=input.value.trim();
  if (!text||!currentContact||!ME) return;
  input.value="";
  const res=await fetch("/api/send",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({uid:ME.id, cid:currentContact.id, text})});
  const data=await res.json();
  if (data.ok) {
    const area=document.getElementById("messages-area");
    area.appendChild(makeBubble(data.msg));
    area.scrollTop=area.scrollHeight;
  }
}

function closeChatMobile() {
  document.getElementById("chat-window").classList.add("hidden");
  document.getElementById("welcome-screen").classList.remove("hidden");
  currentContact=null;
  document.querySelectorAll(".contact-item").forEach(el=>el.classList.remove("active"));
  if (isMobile()) showSidebar();
}

// ── SCHEDULE ─────────────────────────────────────
async function loadSchedule() {
  const res=await fetch("/api/schedule"); schedule=await res.json();
}

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
  if (!data.lessons?.length) {
    block.innerHTML=`<div class="today-title">СЕГОДНЯ · ${data.day.toUpperCase()}</div><div style="color:var(--text3);font-size:13px;padding:8px 0">Занятий нет 🎉</div>`;
    return;
  }
  let html=`<div class="today-title">СЕГОДНЯ · ${data.day.toUpperCase()}</div>`;
  data.lessons.forEach(l=>{
    html+=`<div class="today-lesson"><div class="lesson-time">${l.time}</div>
    <div><div class="lesson-name">${l.subject}</div><div class="lesson-teacher">${l.teacher} · ауд. ${l.room}</div></div></div>`;
  });
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
  days.forEach(day=>{
    const btn=document.createElement("button");
    btn.className="day-tab-btn"+(day===todayName?" today":"");
    btn.textContent=day; btn.onclick=()=>showDayContent(day);
    tabs.appendChild(btn);
  });
  showDayContent(schedule[todayName]?todayName:(days[0]||"Вторник"));
}

function showDayContent(day) {
  document.querySelectorAll(".day-tab-btn").forEach(b=>b.classList.toggle("active",b.textContent===day));
  const lessons=schedule[day]||[];
  const content=document.getElementById("day-content");
  if (!lessons.length) { content.innerHTML=`<div class="no-lessons">В этот день занятий нет 🎉</div>`; return; }
  let html=`<div class="sched-card">`;
  lessons.forEach(l=>{
    html+=`<div class="sched-row"><div class="sched-dot type-${l.type}"></div>
    <div style="flex:1">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="sched-time">${l.time}</div>
        <span class="sched-room">ауд. ${l.room}</span>
      </div>
      <div class="sched-subject">${l.subject}</div>
      <div class="sched-meta">${l.teacher}</div>
    </div></div>`;
  });
  content.innerHTML=html+`</div>`;
}

function switchTab(tab) {
  document.querySelectorAll(".nav-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  document.querySelectorAll(".tab-content").forEach(t=>t.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
  if (tab==="schedule") { showScheduleScreen(); }
  else {
    document.getElementById("schedule-screen").classList.add("hidden");
    if (!currentContact) { document.getElementById("chat-window").classList.add("hidden"); document.getElementById("welcome-screen").classList.remove("hidden"); }
    if (isMobile()) showSidebar();
  }
}

function hideSidebar(){ document.getElementById("sidebar").classList.add("hidden-mobile"); }
function showSidebar() { document.getElementById("sidebar").classList.remove("hidden-mobile"); }
function escHtml(s)    { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
