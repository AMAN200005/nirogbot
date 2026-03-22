function setUserProfile(name, email) {
  const initial = name ? name[0].toUpperCase() : "G";
  document.getElementById("sidebar-avatar").textContent = initial;
  document.getElementById("sidebar-name").textContent = name || "Guest User";
  document.getElementById("popup-avatar").textContent = initial;
  document.getElementById("popup-name").textContent = name || "Guest User";

  const emailEl = document.getElementById("popup-email");
  if (email) {
    emailEl.textContent = email;
    emailEl.style.display = "block";
  } else {
    emailEl.style.display = "none";
  }
}

setUserProfile(null, null);

let diseasesData = {};
let trendCount = {};
let alertedDiseases = {};
let currentChatId = null;
let currentReportId = null;

/* LOAD DATABASE */
fetch("data/diseases.json")
.then(res => res.json())
.then(data => {
  diseasesData = data;
  console.log("Disease database loaded");
})
.catch(err => {
  console.error("Failed to load disease database:", err);
});

/* SEND MESSAGE */
document.getElementById("send-btn").onclick = sendMessage;

document.getElementById("user-input").addEventListener("keypress", function(e){
  if(e.key === "Enter") sendMessage();
});

function sendMessage(){
  currentChatId = null;

  const wrapper = document.querySelector(".quick-actions-wrapper");
  if(wrapper && wrapper.style.display !== "none"){
    wrapper.style.opacity = "0";
    setTimeout(function(){ wrapper.style.display = "none"; }, 400);
  }

  const input = document.getElementById("user-input");
  const text = input.value.trim().toLowerCase();
  if(text === "") return;

  addMessage(text, "user");
  input.value = "";

  let result = detectDisease(text);
  if(result){
    updateTrend(result.disease);
    showDisease(result.disease, result.mode);
  } else {
    askLLM(text);
  }
}

/* ADD MESSAGE */
function addMessage(text, type){
  const chat = document.getElementById("chat-window");

  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper " + type;

  const bubble = document.createElement("div");
  bubble.className = "message " + type;
  bubble.innerText = text;

  if(type === "user"){
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerHTML = "👤";
    wrapper.appendChild(bubble);
    wrapper.appendChild(avatar);
  } else if(type === "bot"){
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerHTML = "🤖";
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
  } else if(type === "alert"){
    wrapper.appendChild(bubble);
  }

  chat.appendChild(wrapper);

  const main = document.querySelector(".main");
  main.scrollTop = main.scrollHeight;
}

/* DETECT DISEASE */
function detectDisease(text){
  const lang = document.getElementById("language").value;
  const wordCount = text.trim().split(" ").length;

  // Aliases for common alternate names
  const aliases = {
    "covid": "covid19",
    "covid 19": "covid19",
    "coronavirus": "covid19",
    "tb": "tuberculosis",
    "aids": "hiv",
    "hiv aids": "hiv",
    "jaundice": "hepatitis",
    "filarial": "filaria",
    "chicken pox": "chickenpox"
  };

  // Check aliases first
  if(aliases[text.trim()]){
    return { disease: aliases[text.trim()], mode: "direct" };
  }

  // Short queries (1-3 words): check disease name first
  if(wordCount <= 3){
    for(let disease in diseasesData){
      if(text.includes(disease.toLowerCase())){
        return { disease: disease, mode: "direct" };
      }
    }
  }

  // Symptom scoring — need at least 2 matches
  let bestMatch = null;
  let bestScore = 0;

  for(let disease in diseasesData){
    const langData = diseasesData[disease][lang];
    const data = langData || diseasesData[disease]["english"];
    if(!data || !data.symptoms_list) continue;

    let score = 0;
    for(let s of data.symptoms_list){
      if(text.includes(s.toLowerCase())) score++;
    }

    if(score > bestScore){
      bestScore = score;
      bestMatch = disease;
    }
  }

  if(bestMatch && bestScore >= 2){
    return { disease: bestMatch, mode: "symptom" };
  }

  // Long sentence with disease name mentioned
  for(let disease in diseasesData){
    if(text.includes(disease.toLowerCase())){
      return { disease: disease, mode: "direct" };
    }
  }

  return null;
}

/* SHOW DISEASE INFO */
function showDisease(disease, mode){
  const lang = document.getElementById("language").value;
  const langData = diseasesData[disease][lang];
  const info = langData || diseasesData[disease]["english"];

  const heading = mode === "direct"
    ? `ℹ️ Here is information about ${disease.toUpperCase()}`
    : `⚠️ Based on your symptoms, this may indicate: ${disease.toUpperCase()}`;

  const disclaimers = {
    "english": "⚕️ Note: This information is AI-generated. Please do not take any medication without prior consultation with a certified doctor.",
    "hindi": "⚕️ नोट: यह जानकारी AI द्वारा उत्पन्न है। कृपया किसी प्रमाणित डॉक्टर से परामर्श किए बिना कोई दवा न लें।",
    "odia": "⚕️ ଜ୍ଞାତବ୍ୟ: ଏହି ତଥ୍ୟ AI ଦ୍ୱାରା ପ୍ରସ୍ତୁତ। ଦୟାକରି କୌଣସି ଡାକ୍ତରଙ୍କ ପରାମର୍ଶ ବିନା କୌଣସି ଔଷଧ ଗ୍ରହଣ କରନ୍ତୁ ନାହିଁ।",
    "tamil": "⚕️ குறிப்பு: இந்த தகவல் AI மூலம் உருவாக்கப்பட்டது. சான்றளிக்கப்பட்ட மருத்துவரின் ஆலோசனை இல்லாமல் எந்த மருந்தும் எடுக்க வேண்டாம்।"
  };

  const disclaimer = disclaimers[lang] || disclaimers["english"];

  const response =
`${heading}

🤒 Symptoms: ${info.symptoms}

🛡️ Prevention: ${info.prevention}

💊 Medicine: ${info.medicine}

─────────────────────
${disclaimer}`;

  showTyping();
  botReply(response, "bot", 1500);
}

/* TYPING INDICATOR */
function showTyping(){
  const chat = document.getElementById("chat-window");

  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper bot";
  wrapper.id = "typing-indicator";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerHTML = "🤖";

  const bubble = document.createElement("div");
  bubble.className = "message bot typing-bubble";
  bubble.innerHTML = '<span></span><span></span><span></span>';

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chat.appendChild(wrapper);

  const main = document.querySelector(".main");
  main.scrollTop = main.scrollHeight;
}

function removeTyping(){
  const t = document.getElementById("typing-indicator");
  if(t) t.remove();
}

function botReply(text, type, delay){
  setTimeout(function(){
    removeTyping();
    addMessage(text, type);
  }, delay);
}

/* TRENDING */
function updateTrend(disease){
  if(!trendCount[disease]) trendCount[disease] = 0;
  trendCount[disease]++;
  localStorage.setItem("healthbot_trends", JSON.stringify(trendCount));
  renderTrends();
  checkOutbreakAlert(disease);
}

function renderTrends(){
  const list = document.getElementById("trending-list");
  if(!list) return;
  list.innerHTML = "";

  const sorted = Object.entries(trendCount).sort((a,b) => b[1] - a[1]);
  for(let [disease, count] of sorted){
    let card = document.createElement("div");
    card.className = "trend-card";
    card.style.background = randomColor();
    card.innerText = disease.toUpperCase() + " ↑ " + count;
    list.appendChild(card);
  }
}

function randomColor(){
  const colors = ["#ff6b6b","#ff9f43","#1dd1a1","#54a0ff","#5f27cd"];
  return colors[Math.floor(Math.random() * colors.length)];
}

/* OUTBREAK ALERT */
function getAlertPrecautions(disease){
  const lang = document.getElementById("language").value;
  const langData = diseasesData[disease] && diseasesData[disease][lang];
  const data = langData || (diseasesData[disease] && diseasesData[disease]["english"]);
  if(data && data.prevention) return "🛡️ " + data.prevention;
  return "🛡️ Maintain hygiene, stay hydrated and consult a doctor immediately.";
}

function checkOutbreakAlert(disease){
  const threshold = 3;
  if(trendCount[disease] >= threshold && trendCount[disease] % threshold === 0){
    setTimeout(function(){
      showFlashBanner(disease);
      setTimeout(function(){
        const alertMessage =
`🚨 OUTBREAK ALERT 🚨

⚠️ ${disease.toUpperCase()} has been reported ${trendCount[disease]} times recently in your area.

This may indicate a potential outbreak situation. Please take the following precautions immediately:

${getAlertPrecautions(disease)}

📞 Contact your nearest health center or call the National Health Helpline: 104

🏥 This alert has been generated based on community-reported symptoms. Stay safe and spread awareness.`;

        addMessage(alertMessage, "alert");
      }, 5000);
    }, 2000);
  }
}

function showFlashBanner(disease){
  const existing = document.getElementById("flash-banner");
  if(existing) existing.remove();

  const flash = document.createElement("div");
  flash.id = "flash-banner";
  flash.innerHTML = `🚨 ${disease.toUpperCase()} OUTBREAK ALERT DETECTED IN YOUR AREA 🚨<br><span style="font-size:13px;font-weight:400;">Community reports indicate rising cases — Please take precautions immediately</span>`;
  document.body.appendChild(flash);

  setTimeout(function(){
    flash.style.animation = "fadeOutFlash 0.5s ease forwards";
    setTimeout(function(){ flash.remove(); }, 500);
  }, 10000);
}

/* QUICK ACTIONS */
function quickAction(text){
  const wrapper = document.querySelector(".quick-actions-wrapper");
  if(wrapper){
    wrapper.style.transition = "opacity 0.4s ease";
    wrapper.style.opacity = "0";
    setTimeout(function(){ wrapper.style.display = "none"; }, 400);
  }

  setTimeout(function(){
    const input = document.getElementById("user-input");
    input.value = text;
    sendMessage();
    setTimeout(function(){
      document.getElementById("user-input").focus();
    }, 100);
  }, 300);
}

/* LLM INTEGRATION */

async function askLLM(userText){
  showTyping();

  const lang = document.getElementById("language").value;

  try {
    const response = await fetch("https://nirogbot.onrender.com/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: userText,
        language: lang
      })
    });

    const data = await response.json();
    removeTyping();

    if(data.choices && data.choices[0] && data.choices[0].message){
      addMessage(data.choices[0].message.content, "bot");
    } else {
      addMessage("I couldn't get a response. Please try again.", "bot");
    }

  } catch(err) {
    removeTyping();
    addMessage("Connection error. Please check your internet and try again.", "bot");
    console.error("LLM error:", err);
  }
}

/* ACCOUNT MENU */
function toggleAccountMenu(){
  const popup = document.getElementById("account-popup");
  popup.classList.toggle("active");
}

document.addEventListener("click", function(e){
  const popup = document.getElementById("account-popup");
  const section = document.querySelector(".account-section");
  if(popup && section && !section.contains(e.target) && !popup.contains(e.target)){
    popup.classList.remove("active");
  }
});

function closeAccountMenu(){
  document.getElementById("account-popup").classList.remove("active");
}

/* SETTINGS / HELP / LOGOUT */
function openSettings(){
  closeAccountMenu();
  showToast("⚙️ Settings panel coming soon!");
}

function openHelp(){
  closeAccountMenu();
  showToast("❓ For help contact: healthbot@odisha.gov.in");
}

function confirmLogout(){
  closeAccountMenu();
  if(confirm("Are you sure you want to log out?")){
    showToast("👋 Logged out successfully!");
  }
}

/* LANGUAGE DROPDOWN */
function toggleLangDropdown(){
  const options = document.getElementById("lang-options");
  options.classList.toggle("active");
}

function selectLang(value, code, name){
  document.getElementById("language").value = value;
  const flagMap = {
    'EN': 'gb',
    'HI': 'in',
    'OD': 'in',
    'TM': 'in'
  };
  document.getElementById("lang-flag").src = `https://flagcdn.com/w20/${flagMap[code]}.png`;
  document.getElementById("lang-name").innerText = name;
  document.getElementById("lang-options").classList.remove("active");
  document.getElementById("user-input").focus();
}

document.addEventListener("click", function(e){
  const dropdown = document.querySelector(".lang-dropdown");
  if(dropdown && !dropdown.contains(e.target)){
    const options = document.getElementById("lang-options");
    if(options) options.classList.remove("active");
  }
});

/* NEW CHAT */
document.querySelector(".new-chat").addEventListener("click", function(){
  newChat();
});

function newChat(){
  const chat = document.getElementById("chat-window");

  if(chat.innerHTML.trim() !== "" && currentChatId === null){
    saveCurrentChat();
  }

  currentChatId = null;
  chat.innerHTML = "";
  alertedDiseases = {};
  renderTrends();

  const wrapper = document.querySelector(".quick-actions-wrapper");
  if(wrapper){
    wrapper.style.display = "block";
    setTimeout(function(){ wrapper.style.opacity = "1"; }, 50);
  }

  document.getElementById("user-input").value = "";
  document.getElementById("user-input").focus();

  const flash = document.getElementById("flash-banner");
  if(flash) flash.remove();

  renderChatHistory();
}

/* CHAT HISTORY */
function saveCurrentChat(){
  const chat = document.getElementById("chat-window");
  if(chat.innerHTML.trim() === "") return;

  const firstUserMsg = chat.querySelector(".message.user");
  const title = firstUserMsg
    ? firstUserMsg.innerText.substring(0, 30) + "..."
    : "Chat " + new Date().toLocaleDateString();

  const chatData = {
    id: Date.now(),
    title: title,
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    html: chat.innerHTML
  };

  let history = JSON.parse(localStorage.getItem("healthbot_history") || "[]");
  history.unshift(chatData);
  if(history.length > 10) history = history.slice(0, 10);
  localStorage.setItem("healthbot_history", JSON.stringify(history));
}

function renderChatHistory(){
  const history = JSON.parse(localStorage.getItem("healthbot_history") || "[]");
  const sidebar = document.querySelector(".history-list");
  if(!sidebar) return;
  sidebar.innerHTML = "";

  if(history.length === 0){
    sidebar.innerHTML = '<p class="no-history">No previous chats</p>';
    return;
  }

  history.forEach(function(chat){
    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
      <div class="history-item-content" onclick="loadChat(${JSON.stringify(chat).replace(/"/g, '&quot;')})">
        <div class="history-title">💬 ${chat.title}</div>
      </div>
      <div class="three-dot-btn" onclick="toggleChatMenu(event, '${chat.id}')">⋮</div>
      <div class="chat-menu" id="menu-${chat.id}">
        <div class="chat-menu-item" onclick="reportChat('${chat.id}')">🚩 Report</div>
        <div class="chat-menu-item" onclick="shareChat('${chat.id}')">🔗 Share</div>
        <div class="chat-menu-item danger" onclick="deleteChat('${chat.id}')">🗑️ Delete</div>
      </div>
    `;

    sidebar.appendChild(item);
  });
}

function toggleChatMenu(e, id){
  e.stopPropagation();
  closeAllMenus();
  const menu = document.getElementById("menu-" + id);
  if(menu) menu.classList.toggle("active");
}

function closeAllMenus(){
  document.querySelectorAll(".chat-menu").forEach(function(m){
    m.classList.remove("active");
  });
}
// Close chat menu when clicking outside
document.addEventListener("click", function(e) {
  if (!e.target.closest(".chat-menu") && !e.target.closest(".three-dot-btn")) {
    closeAllMenus();
  }
});

function deleteChat(id){
  if(confirm("Delete this chat?")){
    let history = JSON.parse(localStorage.getItem("healthbot_history") || "[]");
    history = history.filter(function(c){ return c.id != id; });
    localStorage.setItem("healthbot_history", JSON.stringify(history));
    renderChatHistory();
  }
}

function shareChat(id){
  closeAllMenus();
  const history = JSON.parse(localStorage.getItem("healthbot_history") || "[]");
  const chat = history.find(function(c){ return c.id == id; });
  if(!chat) return;

  const shareText = `HealthBot Chat: "${chat.title}" - Shared from HealthBot Public Health Assistant`;

  if(navigator.share){
    navigator.share({
      title: "HealthBot Chat",
      text: shareText,
      url: window.location.href
    });
  } else {
    navigator.clipboard.writeText(window.location.href + "?chat=" + id).then(function(){
      showToast("🔗 Chat link copied to clipboard!");
    });
  }
}

function loadChat(chatData){
  const chat = document.getElementById("chat-window");
  if(chat.innerHTML.trim() !== "" && currentChatId === null){
    saveCurrentChat();
  }

  chat.innerHTML = chatData.html;
  currentChatId = chatData.id;

  const wrapper = document.querySelector(".quick-actions-wrapper");
  if(wrapper){
    wrapper.style.opacity = "0";
    setTimeout(function(){ wrapper.style.display = "none"; }, 400);
  }

  const main = document.querySelector(".main");
  main.scrollTop = main.scrollHeight;
  document.getElementById("user-input").focus();
}

/* REPORTING */
function reportChat(id){
  closeAllMenus();
  currentReportId = id;
  document.getElementById("report-overlay").classList.add("active");
  document.getElementById("report-modal").classList.add("active");

  document.querySelectorAll(".report-option input").forEach(function(cb){
    cb.checked = false;
  });
  document.getElementById("report-text").value = "";
}

function closeReport(){
  document.getElementById("report-overlay").classList.remove("active");
  document.getElementById("report-modal").classList.remove("active");
  currentReportId = null;
}

function submitReport(){
  const selected = [];
  document.querySelectorAll(".report-option input:checked").forEach(function(cb){
    selected.push(cb.value);
  });

  const customText = document.getElementById("report-text").value.trim();

  if(selected.length === 0 && customText === ""){
    alert("Please select at least one issue or describe the problem.");
    return;
  }

  console.log("Report submitted:", {
    chatId: currentReportId,
    issues: selected,
    description: customText
  });

  closeReport();
  showToast("✅ Report submitted! Thank you for helping us improve.");
}

/* TOAST */
function showToast(message){
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerText = message;
  document.body.appendChild(toast);

  setTimeout(function(){ toast.classList.add("active"); }, 100);
  setTimeout(function(){
    toast.classList.remove("active");
    setTimeout(function(){ toast.remove(); }, 400);
  }, 3000);
}

/* ANALYTICS DASHBOARD */
function toggleDashboard(){
  const panel = document.getElementById("dashboard-panel");
  const overlay = document.getElementById("dashboard-overlay");

  if(panel.classList.contains("active")){
    closeDashboard();
  } else {
    updateDashboard();
    panel.classList.add("active");
    overlay.classList.add("active");
  }
}

function closeDashboard(){
  document.getElementById("dashboard-panel").classList.remove("active");
  document.getElementById("dashboard-overlay").classList.remove("active");
}

function updateDashboard(){
  const total = Object.values(trendCount).reduce((a, b) => a + b, 0);
  document.getElementById("stat-total").innerText = total;

  let topDisease = "—";
  let topCount = 0;
  let tiedCount = 0;

  for(let d in trendCount){
    if(trendCount[d] > topCount){
      topCount = trendCount[d];
      topDisease = d.toUpperCase();
      tiedCount = 1;
    } else if(trendCount[d] === topCount){
      tiedCount++;
    }
  }

  if(tiedCount > 1) topDisease = tiedCount + " TIED";
  document.getElementById("stat-top").innerText = topDisease;

  const riskEl = document.getElementById("stat-risk");
  const riskBar = document.getElementById("risk-bar");
  let riskLevel = "Low";
  let riskPercent = 10;
  let riskColor = "#1dd1a1";

  if(topCount >= 10){
    riskLevel = "Critical"; riskPercent = 100; riskColor = "#ff2222";
  } else if(topCount >= 6){
    riskLevel = "High"; riskPercent = 75; riskColor = "#ff6b6b";
  } else if(topCount >= 3){
    riskLevel = "Moderate"; riskPercent = 45; riskColor = "#ff9f43";
  }

  riskEl.innerText = riskLevel;
  riskEl.style.color = riskColor;
  riskBar.style.width = riskPercent + "%";
  riskBar.style.background = riskColor;

  renderChart();
}

function renderChart(){
  const container = document.getElementById("chart-container");
  container.innerHTML = "";

  if(Object.keys(trendCount).length === 0){
    container.innerHTML = '<p class="no-data">No disease searches yet. Start chatting!</p>';
    return;
  }

  const sorted = Object.entries(trendCount).sort((a, b) => b[1] - a[1]);
  const max = sorted[0][1];
  const colors = ["#54a0ff","#ff6b6b","#1dd1a1","#ff9f43","#5f27cd","#ff6b9d","#00d2d3","#feca57"];

  sorted.forEach(function([disease, count], index){
    const percent = Math.round((count / max) * 100);
    const color = colors[index % colors.length];

    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <div class="chart-label">${disease.toUpperCase()}</div>
      <div class="chart-bar-wrapper">
        <div class="chart-bar" style="width:${percent}%; background:${color};">
          <span class="chart-count">${count}</span>
        </div>
      </div>
    `;
    container.appendChild(row);
  });
}

function resetTrends(){
  if(confirm("Reset all analytics data?")){
    trendCount = {};
    localStorage.removeItem("healthbot_trends");
    updateDashboard();
    renderTrends();
  }
}

/* PAGE LOAD */
window.addEventListener("load", function(){
  document.getElementById("user-input").focus();
  renderChatHistory();

  const savedTrends = localStorage.getItem("healthbot_trends");
  if(savedTrends){
    trendCount = JSON.parse(savedTrends);
    renderTrends();
  }
});
