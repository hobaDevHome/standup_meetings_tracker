var TEAMS = [
  { id:'modeling', label:'Modeling',  color:'#4a6cf7' },
  { id:'unity',    label:'Unity',     color:'#16a272' },
  { id:'2d',       label:'2D',        color:'#d4820a' },
  { id:'lead',     label:'Team Lead', color:'#9333ea' }
];

// @ts-ignore
var TOKEN = '', GIST = '', cache = [];

window.addEventListener('DOMContentLoaded', function() {
  TOKEN = localStorage.getItem('gh_token') || '';
  GIST  = localStorage.getItem('gh_gist')  || '';
  // @ts-ignore
  document.getElementById('meetingDate').value = new Date().toISOString().split('T')[0];
  if (TOKEN && GIST) enterApp();
});

/* ── CONNECT ── */
// @ts-ignore
window.doConnect = async function() {
  // @ts-ignore
  var token = document.getElementById('inToken').value.trim();
  // @ts-ignore
  var gist  = document.getElementById('inGist').value.trim();
  var errEl = document.getElementById('errMsg');
  var btn   = document.getElementById('btnConnect');

  // @ts-ignore
  errEl.style.display = 'none';
  // @ts-ignore
  document.getElementById('inGist').classList.remove('err-field');

  if (!token) { showToast('⚠️ ادخلي الـ Token', true); return; }
  if (!gist)  { showToast('⚠️ ادخلي الـ Gist ID', true); return; }

  // @ts-ignore
  btn.disabled = true;
  // @ts-ignore
  btn.textContent = 'جاري التحقق...';

  try {
    var res = await fetch('https://api.github.com/gists/' + gist, {
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.status === 404) {
      // @ts-ignore
      document.getElementById('inGist').classList.add('err-field');
      // @ts-ignore
      errEl.textContent = '❌ الـ Gist ID مش موجود — تأكدي من الـ URL';
      // @ts-ignore
      errEl.style.display = 'block';
      // @ts-ignore
      btn.disabled = false;
      // @ts-ignore
      btn.textContent = '🔗 ربط وابدأ';
      return;
    }
    if (res.status === 401) {
      showToast('❌ الـ Token غلط أو انتهت صلاحيته', true);
      // @ts-ignore
      btn.disabled = false;
      // @ts-ignore
      btn.textContent = '🔗 ربط وابدأ';
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);

    localStorage.setItem('gh_token', token);
    localStorage.setItem('gh_gist',  gist);
    TOKEN = token;
    GIST  = gist;
    enterApp();
    showToast('✅ تم الاتصال بنجاح!');

  } catch(e) {
    // @ts-ignore
    showToast('❌ فشل الاتصال: ' + e.message, true);
    // @ts-ignore
    btn.disabled = false;
    // @ts-ignore
    btn.textContent = '🔗 ربط وابدأ';
  }
};

function enterApp() {
  go('entry');
  // @ts-ignore
  document.getElementById('mainNav').style.display  = 'flex';
  // @ts-ignore
  document.getElementById('syncWrap').style.display = 'flex';
  var btns = document.querySelectorAll('.nav-btn');
  btns.forEach(function(b){ b.classList.remove('active'); });
  btns[0].classList.add('active');
  // @ts-ignore
  document.getElementById('stToken').value = TOKEN;
  // @ts-ignore
  document.getElementById('stGist').value  = GIST;
  // @ts-ignore
  document.getElementById('gistLink').href = 'https://gist.github.com/' + GIST;
}

// @ts-ignore
window.doDisconnect = function() {
  if (!confirm('هتقطعي الاتصال — الداتا على الـ Gist هتفضل موجودة.')) return;
  localStorage.removeItem('gh_token');
  localStorage.removeItem('gh_gist');
  location.reload();
};

/* ── NAV ── */
// @ts-ignore
window.showPage = function(name, btn) {
  go(name);
  document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  // @ts-ignore
  if (name === 'history') loadHistory();
};

// @ts-ignore
function go(name) {
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  // @ts-ignore
  document.getElementById('page-' + name).classList.add('active');
}

/* ── GIST API ── */
function gGet() {
  return fetch('https://api.github.com/gists/' + GIST, {
    headers: {
      'Authorization': 'token ' + TOKEN,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
}

// @ts-ignore
function gPatch(content) {
  var body = { files: { 'standup-data.json': { content: content } } };
  return fetch('https://api.github.com/gists/' + GIST, {
    method: 'PATCH',
    headers: {
      'Authorization': 'token ' + TOKEN,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

async function readGist() {
  setSyncing(true);
  var res = await gGet();
  if (!res.ok) throw new Error('HTTP ' + res.status);
  var data  = await res.json();
  var files = data.files;
  var key   = Object.keys(files).find(function(k){ return k.toLowerCase().indexOf('standup') >= 0; });
  if (!key) key = Object.keys(files)[0];
  try { cache = JSON.parse(files[key].content || '[]'); } catch(e) { cache = []; }
  setSyncing(false);
  return cache;
}

// @ts-ignore
async function writeGist(meetings) {
  setSyncing(true);
  var res = await gPatch(JSON.stringify(meetings, null, 2));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  cache = meetings;
  setSyncing(false);
}

/* ── SAVE ── */
// @ts-ignore
window.doSave = async function() {
  // @ts-ignore
  var date = document.getElementById('meetingDate').value;
  if (!date) { showToast('⚠️ اختاري تاريخ الميتنج', true); return; }

  var meeting = { date: date, teams: {} };
  TEAMS.forEach(function(t) {
    // @ts-ignore
    var d = document.getElementById(t.id + '-done').value.trim();
    // @ts-ignore
    var p = document.getElementById(t.id + '-planned').value.trim();
    // @ts-ignore
    meeting.teams[t.id] = {
      // @ts-ignore
      done:    d ? d.split('\n').filter(function(l){ return l.trim(); }) : [],
      // @ts-ignore
      planned: p ? p.split('\n').filter(function(l){ return l.trim(); }) : []
    };
  });

  var btn = document.getElementById('btnSave');
  // @ts-ignore
  btn.disabled = true;
  // @ts-ignore
  btn.textContent = 'جاري الحفظ...';

  try {
    var meetings = await readGist();
    // @ts-ignore
    var idx = meetings.findIndex(function(m){ return m.date === date; });
    if (idx >= 0) meetings[idx] = meeting; else meetings.push(meeting);
    // @ts-ignore
    meetings.sort(function(a,b){ return b.date.localeCompare(a.date); });
    await writeGist(meetings);
    showToast('✅ تم الحفظ على GitHub!');
    TEAMS.forEach(function(t) {
      // @ts-ignore
      document.getElementById(t.id + '-done').value    = '';
      // @ts-ignore
      document.getElementById(t.id + '-planned').value = '';
    });
    var d = new Date(date); d.setDate(d.getDate() + 1);
    // @ts-ignore
    document.getElementById('meetingDate').value = d.toISOString().split('T')[0];
  } catch(e) {
    // @ts-ignore
    showToast('❌ مش قادرة تحفظ: ' + e.message, true);
    setSyncing(false, true);
  } finally {
    // @ts-ignore
    btn.disabled = false;
    // @ts-ignore
    btn.textContent = '💾 حفظ الميتنج';
  }
};

/* ── HISTORY ── */
// @ts-ignore
window.loadHistory = async function() {
  // @ts-ignore
  document.getElementById('filterDate').value = '';
  var el = document.getElementById('mlist');
  // @ts-ignore
  el.innerHTML = '<div class="empty"><div class="spin-d" style="animation:spin .7s linear infinite"></div></div>';
  try {
    renderList(await readGist());
  } catch(e) {
    // @ts-ignore
    el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">مش قادرة تحمّل البيانات</div></div>';
    setSyncing(false, true);
  }
};

// @ts-ignore
window.doFilter = function() {
  // @ts-ignore
  var date = document.getElementById('filterDate').value;
  // @ts-ignore
  if (!date) { loadHistory(); return; }
  // @ts-ignore
  renderList(cache.filter(function(m){ return m.date === date; }), date);
};

// @ts-ignore
function renderList(list, fd) {
  var el = document.getElementById('mlist');
  if (!list.length) {
    var msg = fd ? 'مفيش ميتنج بتاريخ ' + fmtDate(fd) : 'مفيش ميتنجز لحد دلوقتي';
    // @ts-ignore
    el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">' + msg + '</div></div>';
    return;
  }
  // @ts-ignore
  el.innerHTML = list.map(mkCard).join('');
}

/* ── DELETE ── */
// @ts-ignore
window.doDelete = async function(date) {
  if (!confirm('تأكيدي حذف ميتنج ' + fmtDate(date) + '؟')) return;
  try {
    // @ts-ignore
    var meetings = cache.filter(function(m){ return m.date !== date; });
    await writeGist(meetings);
    showToast('🗑️ تم الحذف');
    renderList(meetings);
  } catch(e) {
    showToast('❌ مش قادرة تحذف', true);
    setSyncing(false, true);
  }
};

/* ── CARD ── */
// @ts-ignore
function mkCard(m) {
  var body = TEAMS.map(function(t) {
    var data = m.teams[t.id] || { done:[], planned:[] };
    if (!data.done.length && !data.planned.length) return '';
    // @ts-ignore
    var di = data.done.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') || '<li style="color:var(--text3)">—</li>';
    // @ts-ignore
    var pi = data.planned.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') || '<li style="color:var(--text3)">—</li>';
    return '<div class="tr"><div class="tr-title"><div class="tdot" style="background:' + t.color + '"></div>' + t.label + '</div>' +
      '<div class="tcols">' +
        '<div><div class="tct cd">&#10003; Done</div><ul class="tl">' + di + '</ul></div>' +
        '<div><div class="tct cp">&#8594; Planned</div><ul class="tl">' + pi + '</ul></div>' +
      '</div></div>';
  }).join('');

  var d = m.date;
  return '<div class="mc" id="mc-' + d + '">' +
    '<div class="mc-h" onclick="toggle(\'' + d + '\')">' +
      '<span class="mc-date">' + fmtDate(d) + '</span>' +
      '<div class="mc-acts">' +
        '<button class="btn-a" onclick="event.stopPropagation();doPrint(\'' + d + '\')">&#128424; طباعة</button>' +
        '<button class="btn-a" onclick="event.stopPropagation();doSaveFile(\'' + d + '\')">&#128190; حفظ كملف</button>' +
        '<button class="btn-a del" onclick="event.stopPropagation();doDelete(\'' + d + '\')">حذف</button>' +
        '<span class="chev">&#9660;</span>' +
      '</div>' +
    '</div>' +
    '<div class="mc-body">' + body + '</div>' +
  '</div>';
}

// @ts-ignore
window.toggle = function(d) { document.getElementById('mc-' + d).classList.toggle('open'); };

/* ── PRINT & SAVE FILE ── */
// @ts-ignore
/* ── PRINT & SAVE FILE ── */
function buildPrintContent(m) {
  var cards = TEAMS.map(function(t) {
    var data = m.teams[t.id] || { done:[], planned:[] };
    if (!data.done.length && !data.planned.length) return '';
    var di = data.done.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') || '<li class="emp">—</li>';
    var pi = data.planned.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') || '<li class="emp">—</li>';
    var leadBadge = t.id === 'lead' ? '<span class="badge-lead">أنا</span>' : '';
    return '<div class="card">' +
      '<div class="card-hd">' +
        '<div class="tdot" style="background:' + t.color + '"></div>' +
        '<span class="card-title">' + t.label + '</span>' + leadBadge +
      '</div>' +
      '<div class="tgrid">' +
        '<div>' +
          '<div class="col-lbl"><span class="sym-done">✓</span><span class="badge-done">Done</span></div>' +
          '<ul class="tl">' + di + '</ul>' +
        '</div>' +
        '<div>' +
          '<div class="col-lbl"><span class="sym-plan">→</span><span class="badge-plan">Planned</span></div>' +
          '<ul class="tl">' + pi + '</ul>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  var css = [
    '@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap");',
    '*{margin:0;padding:0;box-sizing:border-box}',
    'body{font-family:"IBM Plex Sans Arabic",sans-serif;direction:rtl;background:#f5f6fa;color:#1a1e2e;padding:28px;font-size:13px;max-width:860px;margin:0 auto}',
    '.hdr{display:flex;align-items:center;gap:10px;margin-bottom:6px}',
    '.logo{width:28px;height:28px;background:#4a6cf7;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:13px}',
    '.main-title{font-size:20px;font-weight:700;letter-spacing:-.4px}',
    '.sub-date{font-size:13px;color:#5a6080;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid #e0e3ed}',
    '.card{background:#fff;border:1px solid #e0e3ed;border-radius:10px;padding:18px 20px;margin-bottom:12px;page-break-inside:avoid}',
    '.card-hd{display:flex;align-items:center;gap:8px;margin-bottom:14px}',
    '.tdot{width:10px;height:10px;border-radius:50%;flex-shrink:0}',
    '.card-title{font-weight:600;font-size:14px}',
    '.badge-lead{font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:rgba(147,51,234,.1);color:#9333ea;margin-right:4px}',
    '.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
    '.col-lbl{display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}',
    '.sym-done{color:#16a272}.sym-plan{color:#d4820a}',
    '.badge-done{background:rgba(22,162,114,.1);color:#16a272;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px}',
    '.badge-plan{background:rgba(212,130,10,.1);color:#d4820a;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px}',
    '.tl{list-style:none;background:#f5f6fa;border-radius:6px;padding:8px 10px;min-height:36px}',
    '.tl li{font-size:12.5px;padding:4px 0;border-bottom:1px solid #e0e3ed;color:#5a6080;line-height:1.6}',
    '.tl li:last-child{border-bottom:none}',
    '.tl li::before{content:"·";margin-left:7px;color:#9aa0b8}',
    '.emp{color:#9aa0b8 !important;font-size:12px}',
    '@media print{@page{margin:12mm}body{background:#fff;padding:0}.card{border-color:#ddd}}'
  ].join('');

  return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
    '<title>Standup ' + m.date + '</title>' +
    '<style>' + css + '</style>' +
    '</head><body>' +
    '<div class="hdr"><div class="logo">📋</div><div class="main-title">Standup Meeting</div></div>' +
    '<div class="sub-date">' + fmtDate(m.date) + '</div>' +
    cards +
    '</body></html>';
}

// @ts-ignore
window.doPrint = function(date) {
  // @ts-ignore
  var m = cache.find(function(x){ return x.date === date; });
  if (!m) return;
  var iframe = document.getElementById('printFrame');
  // @ts-ignore
  iframe.onload = function() { iframe.contentWindow.print(); };
  // @ts-ignore
  iframe.srcdoc = buildPrintContent(m);
};

// @ts-ignore
window.doSaveFile = function(date) {
  // @ts-ignore
  var m = cache.find(function(x){ return x.date === date; });
  if (!m) return;
  var blob = new Blob([buildPrintContent(m)], { type:'text/html;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'standup-' + date + '.html';
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  showToast('📁 تم تحميل الملف!');
};

/* ── HELPERS ── */
// @ts-ignore
function setSyncing(active, err) {
  var dot = document.getElementById('syncDot');
  var txt = document.getElementById('syncTxt');
  // @ts-ignore
  dot.className = 'sync-dot' + (active ? ' on' : err ? ' err' : '');
  // @ts-ignore
  txt.textContent = active ? 'جاري المزامنة...' : err ? 'خطأ في الاتصال' : 'متصل ✓';
}

// @ts-ignore
function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('ar-EG', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });
}

// @ts-ignore
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// @ts-ignore
function showToast(msg, err) {
  var el = document.getElementById('toast');
  // @ts-ignore
  el.textContent    = msg;
  // @ts-ignore
  el.style.background = err ? '#dc2626' : '#16a272';
  // @ts-ignore
  el.classList.add('show');
  // @ts-ignore
  setTimeout(function(){ el.classList.remove('show'); }, 3000);
}
