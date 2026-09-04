/* ---------- Data ---------- */
const STORAGE_KEY = 'chachi_reminders_v1';
const COLORS = [
  {name:'آبی', value:'#4FA3F7'},
  {name:'صورتی', value:'#FF6FA5'},
  {name:'سبز', value:'#34D399'},
  {name:'کهربایی', value:'#FBBF24'},
  {name:'بنفش', value:'#A78BFA'},
  {name:'نارنجی', value:'#FB923C'},
  {name:'قرمز', value:'#FB7185'},
  {name:'فیروزه‌ای', value:'#2DD4BF'},
];
const EMOJIS = ['💧','🦷','🚶','🧘','👀','💊','🍎','😴','🧴','📵','☕','🌬️','📖','✍️','🩹','🧠'];

const SUGGESTIONS = [
  {title:'آب بخور', msg:'یه لیوان آب سر بکش', icon:'💧', color:'#4FA3F7', mode:'interval', intervalMin:90, useRange:true, rangeStart:'08:00', rangeEnd:'23:00'},
  {title:'دندوناتو فشار نده', msg:'فک‌تو شل کن', icon:'🦷', color:'#FF6FA5', mode:'interval', intervalMin:10, useRange:false},
  {title:'بلند شو راه برو', msg:'چند قدم بزن', icon:'🚶', color:'#34D399', mode:'interval', intervalMin:60, useRange:true, rangeStart:'09:00', rangeEnd:'20:00'},
  {title:'چشماتو استراحت بده', msg:'به یه نقطه‌ی دور نگاه کن', icon:'👀', color:'#A78BFA', mode:'interval', intervalMin:20, useRange:false},
  {title:'نفس عمیق بکش', msg:'چند ثانیه آروم باش', icon:'🧘', color:'#2DD4BF', mode:'interval', intervalMin:45, useRange:false},
];

function uid(){ return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function todayStr(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function nowHM(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }

function loadReminders(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }catch(e){ return []; }
}
function saveReminders(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
let reminders = loadReminders();
let snoozes = []; // {id, fireAt}

/* ---------- Service worker ---------- */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
  navigator.serviceWorker.addEventListener('message', (e)=>{
    const {type, reminderId} = e.data || {};
    if(type === 'snooze'){ scheduleSnooze(reminderId); }
    if(type === 'done'){ /* just acknowledgment */ }
  });
}

/* ---------- Rendering ---------- */
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('emptyState');
const suggestChips = document.getElementById('suggestChips');

function render(){
  saveReminders(reminders);
  listEl.innerHTML = '';
  if(reminders.length === 0){
    emptyEl.style.display = 'block';
    renderSuggestions();
    return;
  }
  emptyEl.style.display = 'none';
  reminders.forEach(r=>{
    const card = document.createElement('div');
    card.className = 'card' + (r.enabled ? '' : ' disabled');
    const sub = describeSchedule(r);
    card.innerHTML = `
      <div class="chip" style="background:${r.color}22;color:${r.color}">${r.icon}</div>
      <div class="body">
        <h3>${escapeHtml(r.title)}</h3>
        <p>${sub}</p>
      </div>
      <div class="actions">
        <div class="switch ${r.enabled?'on':''}" data-id="${r.id}" data-act="toggle"><div class="knob"></div></div>
        <button class="dots-btn" data-id="${r.id}" data-act="edit">⋯</button>
      </div>`;
    listEl.appendChild(card);
  });
}

function renderSuggestions(){
  suggestChips.innerHTML = '';
  SUGGESTIONS.forEach(s=>{
    const c = document.createElement('div');
    c.className = 'chip-suggest';
    c.textContent = s.icon + ' ' + s.title;
    c.onclick = ()=>{
      const r = Object.assign({id:uid(), enabled:true, lastFired:Date.now(), firedSlots:{}, times:[]}, s);
      reminders.push(r);
      render();
      showToast('اضافه شد — می‌تونی از ⋯ ویرایشش کنی');
    };
    suggestChips.appendChild(c);
  });
}

function describeSchedule(r){
  if(r.mode === 'time'){
    if(!r.times || r.times.length===0) return 'ساعتی تنظیم نشده';
    return 'ساعت ' + r.times.join(' ، ');
  }
  let s = 'هر ' + r.intervalMin + ' دقیقه';
  if(r.useRange) s += ' • از ' + r.rangeStart + ' تا ' + r.rangeEnd;
  return s;
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

listEl.addEventListener('click', (e)=>{
  const el = e.target.closest('[data-act]');
  if(!el) return;
  const id = el.dataset.id;
  const r = reminders.find(x=>x.id===id);
  if(!r) return;
  if(el.dataset.act === 'toggle'){
    r.enabled = !r.enabled;
    r.lastFired = Date.now();
    render();
  } else if(el.dataset.act === 'edit'){
    openSheet(r);
  }
});

/* ---------- Sheet (add/edit) ---------- */
const overlay = document.getElementById('overlay');
const sheet = document.getElementById('sheet');
const fTitle = document.getElementById('fTitle');
const fMsg = document.getElementById('fMsg');
const emojiPick = document.getElementById('emojiPick');
const colorPick = document.getElementById('colorPick');
const modeSeg = document.getElementById('modeSeg');
const intervalBlock = document.getElementById('intervalBlock');
const timeBlock = document.getElementById('timeBlock');
const fInterval = document.getElementById('fInterval');
const rangeSwitch = document.getElementById('rangeSwitch');
const rangeBlock = document.getElementById('rangeBlock');
const fRangeStart = document.getElementById('fRangeStart');
const fRangeEnd = document.getElementById('fRangeEnd');
const timeList = document.getElementById('timeList');
const addTimeBtn = document.getElementById('addTimeBtn');
const deleteBtn = document.getElementById('deleteBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const sheetTitle = document.getElementById('sheetTitle');

let editingId = null;
let draft = {};

EMOJIS.forEach(em=>{
  const b = document.createElement('div');
  b.className = 'emoji-pick';
  b.textContent = em;
  b.onclick = ()=>{ draft.icon = em; refreshPicks(); };
  b.dataset.em = em;
  emojiPick.appendChild(b);
});
COLORS.forEach(c=>{
  const b = document.createElement('div');
  b.className = 'swatch';
  b.style.background = c.value;
  b.title = c.name;
  b.onclick = ()=>{ draft.color = c.value; refreshPicks(); };
  b.dataset.c = c.value;
  colorPick.appendChild(b);
});
function refreshPicks(){
  [...emojiPick.children].forEach(el=> el.classList.toggle('selected', el.dataset.em === draft.icon));
  [...colorPick.children].forEach(el=> el.classList.toggle('selected', el.dataset.c === draft.color));
}

modeSeg.addEventListener('click', (e)=>{
  const b = e.target.closest('button'); if(!b) return;
  draft.mode = b.dataset.mode;
  [...modeSeg.children].forEach(x=>x.classList.toggle('active', x===b));
  intervalBlock.style.display = draft.mode==='interval' ? 'block' : 'none';
  timeBlock.style.display = draft.mode==='time' ? 'block' : 'none';
});

rangeSwitch.addEventListener('click', ()=>{
  draft.useRange = !draft.useRange;
  rangeSwitch.classList.toggle('on', draft.useRange);
  rangeBlock.style.display = draft.useRange ? 'block' : 'none';
});

addTimeBtn.addEventListener('click', ()=>{
  draft.times = draft.times || [];
  draft.times.push('08:00');
  renderTimeList();
});
function renderTimeList(){
  timeList.innerHTML = '';
  (draft.times||[]).forEach((t, i)=>{
    const row = document.createElement('div');
    row.className = 'time-row';
    row.innerHTML = `<input type="time" value="${t}"><button class="small-x">✕</button>`;
    row.querySelector('input').addEventListener('change', (e)=>{ draft.times[i] = e.target.value; });
    row.querySelector('button').addEventListener('click', ()=>{ draft.times.splice(i,1); renderTimeList(); });
    timeList.appendChild(row);
  });
}

function openSheet(r){
  editingId = r ? r.id : null;
  draft = r ? JSON.parse(JSON.stringify(r)) : {
    icon:'💧', color:COLORS[0].value, mode:'interval', intervalMin:60,
    useRange:false, rangeStart:'08:00', rangeEnd:'23:00', times:[]
  };
  sheetTitle.textContent = r ? 'ویرایش یادآوری' : 'یادآوری جدید';
  fTitle.value = draft.title || '';
  fMsg.value = draft.msg || '';
  fInterval.value = draft.intervalMin || 60;
  fRangeStart.value = draft.rangeStart || '08:00';
  fRangeEnd.value = draft.rangeEnd || '23:00';
  rangeSwitch.classList.toggle('on', !!draft.useRange);
  rangeBlock.style.display = draft.useRange ? 'block' : 'none';
  [...modeSeg.children].forEach(x=>x.classList.toggle('active', x.dataset.mode===draft.mode));
  intervalBlock.style.display = draft.mode==='interval' ? 'block' : 'none';
  timeBlock.style.display = draft.mode==='time' ? 'block' : 'none';
  renderTimeList();
  refreshPicks();
  deleteBtn.style.display = r ? 'block' : 'none';
  overlay.classList.add('show');
  sheet.classList.add('show');
}
function closeSheet(){
  overlay.classList.remove('show');
  sheet.classList.remove('show');
}
document.getElementById('fabAdd').addEventListener('click', ()=> openSheet(null));
cancelBtn.addEventListener('click', closeSheet);
overlay.addEventListener('click', closeSheet);

saveBtn.addEventListener('click', ()=>{
  const title = fTitle.value.trim();
  if(!title){ fTitle.focus(); return; }
  draft.title = title;
  draft.msg = fMsg.value.trim();
  draft.intervalMin = Math.max(1, parseInt(fInterval.value)||60);
  draft.rangeStart = fRangeStart.value;
  draft.rangeEnd = fRangeEnd.value;
  draft.mode = draft.mode || 'interval';

  if(editingId){
    const idx = reminders.findIndex(x=>x.id===editingId);
    reminders[idx] = Object.assign(reminders[idx], draft);
  } else {
    reminders.push(Object.assign({id:uid(), enabled:true, lastFired:Date.now(), firedSlots:{}}, draft));
  }
  closeSheet();
  render();
});

deleteBtn.addEventListener('click', ()=>{
  reminders = reminders.filter(x=>x.id!==editingId);
  closeSheet();
  render();
});

/* ---------- Toast ---------- */
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toastEl.classList.remove('show'), 2400);
}

/* ---------- Permission ---------- */
const permBanner = document.getElementById('permBanner');
const permBtn = document.getElementById('permBtn');
function refreshPermUI(){
  if('Notification' in window && Notification.permission !== 'granted'){
    permBanner.style.display = 'flex';
  } else {
    permBanner.style.display = 'none';
  }
}
document.getElementById('permAllow').addEventListener('click', requestPerm);
permBtn.addEventListener('click', requestPerm);
function requestPerm(){
  if(!('Notification' in window)) return showToast('این مرورگر نوتیفیکیشن رو پشتیبانی نمی‌کنه');
  Notification.requestPermission().then(refreshPermUI);
}
refreshPermUI();

/* ---------- Scheduling engine ---------- */
function inRange(hm, start, end){
  if(start <= end) return hm >= start && hm <= end;
  return hm >= start || hm <= end; // wraps past midnight
}

function tick(){
  const now = Date.now();
  const hm = nowHM();
  const today = todayStr();

  reminders.forEach(r=>{
    if(!r.enabled) return;
    if(r.mode === 'interval'){
      if(r.useRange && !inRange(hm, r.rangeStart, r.rangeEnd)) return;
      if(!r.lastFired) r.lastFired = now;
      if(now - r.lastFired >= r.intervalMin*60000){
        r.lastFired = now;
        fire(r);
      }
    } else if(r.mode === 'time'){
      r.firedSlots = r.firedSlots || {};
      (r.times||[]).forEach(t=>{
        if(t === hm && r.firedSlots[t] !== today){
          r.firedSlots[t] = today;
          fire(r);
        }
      });
    }
  });

  // snoozes
  snoozes = snoozes.filter(s=>{
    if(now >= s.fireAt){
      const r = reminders.find(x=>x.id===s.id);
      if(r) fire(r);
      return false;
    }
    return true;
  });

  saveReminders(reminders);
}
setInterval(tick, 15000);
tick();

function scheduleSnooze(id){
  snoozes.push({id, fireAt: Date.now() + 5*60000});
  showToast('باشه، ۵ دقیقه‌ی دیگه دوباره می‌گم 🙂');
}

/* ---------- Firing: in-app bubble banner or OS notification ---------- */
const bannerLayer = document.getElementById('bannerLayer');

function fire(r){
  if(document.visibilityState === 'visible'){
    showBanner(r);
  } else {
    showOSNotification(r);
  }
}

function showBanner(r){
  const el = document.createElement('div');
  el.className = 'banner';
  el.style.background = `linear-gradient(135deg, ${r.color}, ${shade(r.color)})`;
  let bubbles = '';
  for(let i=0;i<6;i++){
    const size = 10 + Math.random()*22;
    const left = 5 + Math.random()*90;
    const delay = Math.random()*2;
    bubbles += `<div class="bubble" style="width:${size}px;height:${size}px;left:${left}%;animation-delay:${delay}s"></div>`;
  }
  el.innerHTML = `
    ${bubbles}
    <div class="brow">
      <div class="bicon">${r.icon}</div>
      <div class="btext"><h4>${escapeHtml(r.title)}</h4><p>${escapeHtml(r.msg||'')}</p></div>
    </div>
    <div class="bactions">
      <button class="b-done">انجام شد ✓</button>
      <button class="b-snooze">بعداً</button>
    </div>`;
  bannerLayer.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('show'));

  const remove = ()=>{
    el.classList.remove('show');
    setTimeout(()=> el.remove(), 400);
  };
  el.querySelector('.b-done').onclick = remove;
  el.querySelector('.b-snooze').onclick = ()=>{ scheduleSnooze(r.id); remove(); };
  setTimeout(remove, 8000);
}

function shade(hex){
  // slightly darker variant for gradient
  const c = hex.replace('#','');
  const num = parseInt(c,16);
  let r = Math.max(0,(num>>16)-30), g = Math.max(0,((num>>8)&0xff)-30), b = Math.max(0,(num&0xff)-30);
  return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
}

function showOSNotification(r){
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  if(navigator.serviceWorker && navigator.serviceWorker.ready){
    navigator.serviceWorker.ready.then(reg=>{
      reg.showNotification(r.icon + ' ' + r.title, {
        body: r.msg || '',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: r.id,
        renotify: true,
        data: {id: r.id, color: r.color},
        actions: [
          {action:'done', title:'انجام شد'},
          {action:'snooze', title:'بعداً'}
        ]
      });
    });
  } else {
    new Notification(r.icon + ' ' + r.title, {body:r.msg||''});
  }
}

render();
