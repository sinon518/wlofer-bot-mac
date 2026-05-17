// UI and Tabs Logic
const navLinks = document.querySelectorAll('.nav-menu a');
const sections = document.querySelectorAll('.view-section');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navLinks.forEach(l => l.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        link.classList.add('active');
        const targetId = link.id.replace('nav-', 'content-');
        document.getElementById(targetId).classList.add('active');
        document.querySelector('.top-bar h1').innerText = link.innerText;
    });
});

// Accounts Tabs Logic
const accTabBtns = document.querySelectorAll('.acc-tab-btn');
const accViews = document.querySelectorAll('.acc-view');
accTabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        accTabBtns.forEach(b => {
            b.classList.remove('active');
            b.style.color = 'var(--text-muted)';
            b.style.fontWeight = 'normal';
        });
        btn.classList.add('active');
        btn.style.color = 'white';
        btn.style.fontWeight = 'bold';
        
        accViews.forEach(v => v.style.display = 'none');
        document.getElementById(btn.getAttribute('data-tab')).style.display = 'block';
    });
});

// YouTube Multiple Auth Status
async function checkYouTubeStatus() {
    try {
        const response = await fetch('/api/youtube/accounts');
        const data = await response.json();
        
        const container = document.getElementById('yt-accounts-container');
        container.innerHTML = '';
        
        if (data.accounts && data.accounts.length > 0) {
            data.accounts.forEach(acc => {
                const item = document.createElement('div');
                item.className = 'account-item';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.background = 'rgba(0,0,0,0.2)';
                item.style.padding = '1rem';
                item.style.borderRadius = '8px';
                item.style.gap = '1rem';
                
                item.innerHTML = `
                    <img src="https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg" alt="YouTube" style="width:30px;">
                    <div style="flex:1;">
                        <h4>${acc.title}</h4>
                        <p style="font-size:0.8rem; color:#4ade80;">Bağlantı Başarılı ✅</p>
                    </div>
                    <button class="btn logout-btn" onclick="logoutAccount('youtube', '${acc.id}')" style="background:#ef4444; color:white; font-size:0.7rem; padding:0.4rem 0.8rem;">Çıkış Yap</button>
                `;
                container.appendChild(item);
            });
        } else {
            container.innerHTML = '<p style="color:#f87171;">Hiçbir hesap bağlı değil. Lütfen aşağıdaki butondan hesap ekleyin.</p>';
        }
    } catch (err) {
        console.error("Status check failed", err);
        document.getElementById('yt-accounts-container').innerHTML = '<p style="color:#f87171;">Bağlantı hatası.</p>';
    }
}

// Instagram Multiple Auth Status
async function checkInstagramStatus() {
    try {
        const response = await fetch('/api/instagram/accounts');
        const data = await response.json();
        
        const container = document.getElementById('ig-accounts-container');
        container.innerHTML = '';
        
        if (data.accounts && data.accounts.length > 0) {
            data.accounts.forEach(acc => {
                const item = document.createElement('div');
                item.className = 'account-item';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.background = 'rgba(0,0,0,0.2)';
                item.style.padding = '1rem';
                item.style.borderRadius = '8px';
                item.style.gap = '1rem';
                
                item.innerHTML = `
                    <img src="https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg" alt="Instagram" style="width:30px;">
                    <div style="flex:1;">
                        <h4>${acc.title}</h4>
                        <p style="font-size:0.8rem; color:#4ade80;">Meta API ile Bağlandı ✅</p>
                    </div>
                    <button class="btn logout-btn" onclick="logoutAccount('instagram', '${acc.id}')" style="background:#ef4444; color:white; font-size:0.7rem; padding:0.4rem 0.8rem;">Çıkış Yap</button>
                `;
                container.appendChild(item);
            });
        } else {
            container.innerHTML = '<p style="color:#fbbf24;">Sistem tokeni doğrulanamadı. Lütfen .env dosyasındaki bilgileri kontrol edin.</p>';
        }
    } catch (err) {
        console.error("Status check failed", err);
        document.getElementById('ig-accounts-container').innerHTML = '<p style="color:#f87171;">Bağlantı hatası.</p>';
    }
}

document.getElementById('btn-yt-connect').addEventListener('click', async () => {
    const res = await fetch('/api/youtube/auth-url');
    const data = await res.json();
    
    const preCheck = await fetch('/api/youtube/accounts');
    const preData = await preCheck.json();
    const startCount = (preData.accounts || []).length;

    if(data.url) {
        window.open(data.url, '_blank', 'width=600,height=700');
        const interval = setInterval(async () => {
            const check = await fetch('/api/youtube/accounts');
            const checkData = await check.json();
            // If new account added, refresh the list
            if(checkData.accounts && checkData.accounts.length > startCount) {
                clearInterval(interval);
                checkYouTubeStatus();
            }
        }, 3000);
    }
});

async function logoutAccount(platform, id) {
    if (!confirm('Bu hesaptan çıkış yapmak istediğinize emin misiniz?')) return;
    
    try {
        const response = await fetch(`/api/${platform}/accounts/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const result = await response.json();
        if (result.success) {
            if (platform === 'youtube') checkYouTubeStatus();
            else checkInstagramStatus();
        }
    } catch (err) {
        alert('Çıkış işlemi başarısız oldu.');
    }
}

// Settings & Tabs State
let configState = { youtube: [], instagram: [], tiktok: [] };
let currentTab = 'youtube';

const tabBtns = document.querySelectorAll('.tab-btn');
const currentPlatformLabel = document.getElementById('current-platform-label');

tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        tabBtns.forEach(b => {
            b.classList.remove('active');
            b.style.color = 'var(--text-muted)';
            b.style.fontWeight = 'normal';
        });
        btn.classList.add('active');
        btn.style.color = 'white';
        btn.style.fontWeight = 'bold';
        
        currentTab = btn.getAttribute('data-tab');
        
        const platformNameMap = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok' };
        currentPlatformLabel.innerText = platformNameMap[currentTab];
        
        renderTimesList();
    });
});

function renderTimesList() {
    const listEl = document.getElementById('selected-times-list');
    listEl.innerHTML = '';
    
    let currentArr = configState[currentTab] || [];
    currentArr.sort();
    
    currentArr.forEach(t => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.background = 'rgba(0,0,0,0.3)';
        li.style.padding = '0.5rem 1rem';
        li.style.borderRadius = '6px';
        
        const span = document.createElement('span');
        span.innerText = t;
        span.style.fontWeight = 'bold';
        
        const removeBtn = document.createElement('button');
        removeBtn.innerText = 'İptal Et (Sil)';
        removeBtn.type = 'button';
        removeBtn.style.background = 'transparent';
        removeBtn.style.color = '#ef4444';
        removeBtn.style.border = 'none';
        removeBtn.style.cursor = 'pointer';
        
        removeBtn.onclick = () => {
            configState[currentTab] = configState[currentTab].filter(timeItem => timeItem !== t);
            renderTimesList();
        };
        
        li.appendChild(span);
        li.appendChild(removeBtn);
        listEl.appendChild(li);
    });
}

document.getElementById('btn-add-time').addEventListener('click', () => {
    const timeVal = document.getElementById('time-input').value;
    if (timeVal) {
        if (!configState[currentTab]) configState[currentTab] = [];
        if (!configState[currentTab].includes(timeVal)) {
            configState[currentTab].push(timeVal);
            renderTimesList();
        }
        document.getElementById('time-input').value = '';
    }
});

async function loadConfig() {
    try {
        const response = await fetch('/api/settings/auto-upload');
        const data = await response.json();
        if(data) configState = data;
        renderTimesList();
    } catch (e) {
        console.error("Could not load initial settings", e);
    }
}

document.getElementById('schedule-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = "Kaydediliyor...";
    btn.disabled = true;

    try {
        const response = await fetch('/api/settings/auto-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configState)
        });
        const result = await response.json();
        if(response.ok) {
            alert("İşlem başarılı: " + result.message);
            updateDashboard();
        } else {
            alert("Hata: " + result.message);
        }
    } catch (err) {
        alert("Bağlantı hatası!");
        console.error(err);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

// Dashboard & Countdown Logic
let countdownTargets = {}; 

async function updateDashboard() {
    try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();
        
        document.getElementById('stat-pending').innerText = data.pending !== undefined ? data.pending : '?';
        document.getElementById('stat-success').innerText = data.uploaded !== undefined ? data.uploaded : '?';
        
        const countdownList = document.getElementById('countdown-list');
        countdownList.innerHTML = '';
        countdownTargets = {};

        if (data.nextDate) {
            const platformMap = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok' };
            
            for (const [platform, timeStr] of Object.entries(data.nextDate)) {
                if (!timeStr) continue;

                // UI Build
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                row.style.background = 'rgba(255,255,255,0.05)';
                row.style.padding = '1rem';
                row.style.borderRadius = '8px';

                const left = document.createElement('div');
                left.innerHTML = `<p style="font-weight:bold; color:var(--text-light); text-transform:capitalize;">${platformMap[platform]}</p>
                                  <p style="color:var(--text-muted); font-size:0.9rem;">Saat: ${timeStr}</p>`;
                
                const right = document.createElement('div');
                right.id = `timer-${platform}`;
                right.style.fontSize = '1.5rem';
                right.style.fontWeight = '800';
                right.style.color = 'var(--primary)';
                right.innerText = '--:--:--';

                row.appendChild(left);
                row.appendChild(right);
                countdownList.appendChild(row);

                // Setup Date obj
                const rawTime = timeStr.split(' ')[0];
                const [h, m] = rawTime.split(':');
                let target = new Date();
                target.setHours(parseInt(h), parseInt(m), 0, 0);
                if (timeStr.includes('Yarın')) target.setDate(target.getDate() + 1);
                
                countdownTargets[platform] = target;
            }

            if (Object.keys(countdownTargets).length === 0) {
                countdownList.innerHTML = '<p style="color:var(--text-muted);">Henüz bekleyen saat yok.</p>';
            }
        }
    } catch (e) {
        console.error("Dashboard update failed", e);
    }
}

// Global timer loop for all active targets
setInterval(() => {
    const now = new Date().getTime();
    for (const [platform, targetDate] of Object.entries(countdownTargets)) {
        const el = document.getElementById(`timer-${platform}`);
        if (!el) continue;

        const distance = targetDate.getTime() - now;
        if (distance < 0) {
            el.innerText = "Yükleniyor...";
            continue;
        }

        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        el.innerText = 
            String(hours).padStart(2, '0') + ":" + 
            String(minutes).padStart(2, '0') + ":" + 
            String(seconds).padStart(2, '0');
    }
}, 1000);

// Init
checkYouTubeStatus();
checkInstagramStatus();
loadConfig();
updateDashboard();
setInterval(updateDashboard, 10000);
