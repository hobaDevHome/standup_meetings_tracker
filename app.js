var TEAMS = [
  { id:'modeling', label:'Modeling',  color:'#4a6cf7' },
  { id:'unity',    label:'Unity',     color:'#16a272' },
  { id:'2d',       label:'2D',        color:'#d4820a' },
  { id:'lead',     label:'Team Lead', color:'#9333ea' }
];

var TOKEN = '', GIST = '', cache = [];

window.addEventListener('DOMContentLoaded', function() {
  TOKEN = localStorage.getItem('gh_token') || '';
  GIST  = localStorage.getItem('gh_gist')  || '';
  document.getElementById('meetingDate').value = new Date().toISOString().split('T')[0];
  if (TOKEN && GIST) enterApp();
});

/* ── CONNECT ── */
window.doConnect = async function() {
  var token = document.getElementById('inToken').value.trim();
  var gist  = document.getElementById('inGist').value.trim();
  var errEl = document.getElementById('errMsg');
  var btn   = document.getElementById('btnConnect');

  errEl.style.display = 'none';
  document.getElementById('inGist').classList.remove('err-field');

  if (!token) { showToast('⚠️ ادخلي الـ Token', true); return; }
  if (!gist)  { showToast('⚠️ ادخلي الـ Gist ID', true); return; }

  btn.disabled = true;
  btn.textContent = 'جاري التحقق...';

  try {
    var res = await fetch('https://api.github.com/gists/' + gist, {
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.status === 404) {
      document.getElementById('inGist').classList.add('err-field');
      errEl.textContent = '❌ الـ Gist ID مش موجود — تأكدي من الـ URL';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = '🔗 ربط وابدأ';
      return;
    }
    if (res.status === 401) {
      showToast('❌ الـ Token غلط أو انتهت صلاحيته', true);
      btn.disabled = false;
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
    showToast('❌ فشل الاتصال: ' + e.message, true);
    btn.disabled = false;
    btn.textContent = '🔗 ربط وابدأ';
  }
};

function enterApp() {
  go('entry');
  document.getElementById('mainNav').style.display  = 'flex';
  document.getElementById('syncWrap').style.display = 'flex';
  var btns = document.querySelectorAll('.nav-btn');
  btns.forEach(function(b){ b.classList.remove('active'); });
  btns[0].classList.add('active');
  document.getElementById('stToken').value = TOKEN;
  document.getElementById('stGist').value  = GIST;
  document.getElementById('gistLink').href = 'https://gist.github.com/' + GIST;
}

window.doDisconnect = function() {
  if (!confirm('هتقطعي الاتصال — الداتا على الـ Gist هتفضل موجودة.')) return;
  localStorage.removeItem('gh_token');
  localStorage.removeItem('gh_gist');
  location.reload();
};

/* ── NAV ── */
window.showPage = function(name, btn) {
  go(name);
  document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  if (name === 'history') loadHistory();
};

function go(name) {
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
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

async function writeGist(meetings) {
  setSyncing(true);
  var res = await gPatch(JSON.stringify(meetings, null, 2));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  cache = meetings;
  setSyncing(false);
}

/* ── SAVE ── */
window.doSave = async function() {
  var date = document.getElementById('meetingDate').value;
  if (!date) { showToast('⚠️ اختاري تاريخ الميتنج', true); return; }

  var meeting = { date: date, teams: {} };
  TEAMS.forEach(function(t) {
    var d = document.getElementById(t.id + '-done').value.trim();
    var p = document.getElementById(t.id + '-planned').value.trim();
    meeting.teams[t.id] = {
      done:    d ? d.split('\n').filter(function(l){ return l.trim(); }) : [],
      planned: p ? p.split('\n').filter(function(l){ return l.trim(); }) : []
    };
  });

  var btn = document.getElementById('btnSave');
  btn.disabled = true;
  btn.textContent = 'جاري الحفظ...';

  try {
    var meetings = await readGist();
    var idx = meetings.findIndex(function(m){ return m.date === date; });
    if (idx >= 0) meetings[idx] = meeting; else meetings.push(meeting);
    meetings.sort(function(a,b){ return b.date.localeCompare(a.date); });
    await writeGist(meetings);
    showToast('✅ تم الحفظ على GitHub!');
    TEAMS.forEach(function(t) {
      document.getElementById(t.id + '-done').value    = '';
      document.getElementById(t.id + '-planned').value = '';
    });
    var d = new Date(date); d.setDate(d.getDate() + 1);
    document.getElementById('meetingDate').value = d.toISOString().split('T')[0];
  } catch(e) {
    showToast('❌ مش قادرة تحفظ: ' + e.message, true);
    setSyncing(false, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 حفظ الميتنج';
  }
};

/* ── HISTORY ── */
window.loadHistory = async function() {
  document.getElementById('filterDate').value = '';
  var el = document.getElementById('mlist');
  el.innerHTML = '<div class="empty"><div class="spin-d" style="animation:spin .7s linear infinite"></div></div>';
  try {
    renderList(await readGist());
  } catch(e) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">مش قادرة تحمّل البيانات</div></div>';
    setSyncing(false, true);
  }
};

window.doFilter = function() {
  var date = document.getElementById('filterDate').value;
  if (!date) { loadHistory(); return; }
  renderList(cache.filter(function(m){ return m.date === date; }), date);
};

function renderList(list, fd) {
  var el = document.getElementById('mlist');
  if (!list.length) {
    var msg = fd ? 'مفيش ميتنج بتاريخ ' + fmtDate(fd) : 'مفيش ميتنجز لحد دلوقتي';
    el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">' + msg + '</div></div>';
    return;
  }
  el.innerHTML = list.map(mkCard).join('');
}

/* ── DELETE ── */
window.doDelete = async function(date) {
  if (!confirm('تأكيدي حذف ميتنج ' + fmtDate(date) + '؟')) return;
  try {
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
function mkCard(m) {
  var body = TEAMS.map(function(t) {
    var data = m.teams[t.id] || { done:[], planned:[] };
    if (!data.done.length && !data.planned.length) return '';
    var di = data.done.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') || '<li style="color:var(--text3)">—</li>';
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

window.toggle = function(d) { document.getElementById('mc-' + d).classList.toggle('open'); };

/* ── PRINT & SAVE FILE ── */
function buildPrintContent(m) {
  var rows = TEAMS.map(function(t) {
    var data = m.teams[t.id] || { done:[], planned:[] };
    if (!data.done.length && !data.planned.length) return '';
    var di = data.done.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') || '<li>—</li>';
    var pi = data.planned.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') || '<li>—</li>';
    return '<div class="ts">' +
      '<div class="tt" style="border-right:4px solid ' + t.color + '">' + t.label + '</div>' +
      '<div class="cols">' +
        '<div><p class="ct done-ct">&#10003; Done</p><ul class="tl">' + di + '</ul></div>' +
        '<div><p class="ct plan-ct">&#8594; Planned</p><ul class="tl">' + pi + '</ul></div>' +
      '</div>' +
    '</div>';
  }).join('');

  var css = [
    'body{font-family:Arial,sans-serif;direction:rtl;background:#fff;color:#111;padding:40px;font-size:13px;max-width:800px;margin:0 auto}',
    'h1{font-size:20px;font-weight:700;padding-bottom:10px;border-bottom:2px solid #111;margin-bottom:4px}',
    '.dt{color:#555;font-size:12px;margin-bottom:24px}',
    '.ts{margin-top:20px}',
    '.tt{font-size:14px;font-weight:700;padding:6px 12px;background:#f4f5f8;margin-bottom:10px;border-radius:4px}',
    '.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}',
    '.ct{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid}',
    '.done-ct{color:#16a272;border-color:#16a272}',
    '.plan-ct{color:#d4820a;border-color:#d4820a}',
    '.tl{list-style:none;padding:0;margin:0}',
    '.tl li{font-size:12.5px;padding:4px 0;border-bottom:1px solid #eee;color:#333;line-height:1.5}',
    '.tl li::before{content:"• ";color:#aaa}'
  ].join('');

  return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
    '<title>Standup ' + m.date + '</title>' +
    '<style>' + css + '</style>' +
    '</head><body>' +
    '<h1>Standup Meeting</h1>' +
    '<p class="dt">' + fmtDate(m.date) + '</p>' +
    rows +
    '</body></html>';
}

window.doPrint = function(date) {
  var m = cache.find(function(x){ return x.date === date; });
  if (!m) return;
  var iframe = document.getElementById('printFrame');
  iframe.onload = function() { iframe.contentWindow.print(); };
  iframe.srcdoc = buildPrintContent(m);
};

window.doSaveFile = function(date) {
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
function setSyncing(active, err) {
  var dot = document.getElementById('syncDot');
  var txt = document.getElementById('syncTxt');
  dot.className = 'sync-dot' + (active ? ' on' : err ? ' err' : '');
  txt.textContent = active ? 'جاري المزامنة...' : err ? 'خطأ في الاتصال' : 'متصل ✓';
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('ar-EG', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, err) {
  var el = document.getElementById('toast');
  el.textContent    = msg;
  el.style.background = err ? '#dc2626' : '#16a272';
  el.classList.add('show');
  setTimeout(function(){ el.classList.remove('show'); }, 3000);
}
