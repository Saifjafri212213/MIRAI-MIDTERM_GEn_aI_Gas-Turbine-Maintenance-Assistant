// Gas Turbine Maintenance Assistant Frontend Logic

const PRESET_QUESTIONS = [
  {
    id: 1,
    text: "What are the three main types of inspection?",
    tag: "Scopes",
    tagClass: "table"
  },
  {
    id: 2,
    text: "What does a maintenance factor of two mean?",
    tag: "Formula",
    tagClass: "rule"
  },
  {
    id: 3,
    text: "What is the purchase price of this gas turbine?",
    tag: "Trap: Not Found",
    tagClass: "trap"
  },
  {
    id: 4,
    text: "What is the melting point of titanium?",
    tag: "Trap: Not Found",
    tagClass: "trap"
  },
  {
    id: 5,
    text: "What is the recommended combustion-inspection interval in hours?",
    tag: "Fig. 36 Table",
    tagClass: "table"
  }
];

const EVAL_ITEMS = [
  {
    num: 1,
    question: "What are the three main types of inspection?",
    answer: "General inspection includes three operational categories: standby, running, and disassembly. The three major disassembly inspection types are: 1. Combustion Inspection, 2. Hot Gas Path Inspection, and 3. Major Inspection.",
    reference: 'Section "Hot Gas Path", Page 23',
    status: "Grounded & Verified",
    statusClass: "grounded"
  },
  {
    num: 2,
    question: "What does a maintenance factor of two mean?",
    answer: "A maintenance factor of two indicates a maintenance interval that is half of the baseline interval (components reach inspection in half the operating hours/starts).",
    reference: 'Section "Starts and Hours Criteria", Page 9',
    status: "Calculation Verified",
    statusClass: "grounded"
  },
  {
    num: 3,
    question: "What is the purchase price of this gas turbine?",
    answer: "Not found",
    reference: "N/A",
    status: "Hallucination Rejected",
    statusClass: "trap-safe"
  },
  {
    num: 4,
    question: "What is the melting point of titanium?",
    answer: "Not found",
    reference: "N/A",
    status: "Hallucination Rejected",
    statusClass: "trap-safe"
  },
  {
    num: 5,
    question: "What is the recommended combustion-inspection interval in hours?",
    answer: "Under baseline operating conditions (base load, natural gas fuel, dry), baseline combustion inspection intervals in factored hours are: 6B: 12,000 hrs (DLN/Non-DLN); 7E/9E: 8,000 hrs (Non-DLN) / 12,000 hrs (DLN); 6F: 8,000 hrs (Non-DLN) / 32,000 hrs (DLN); 7F/9F: 24,000 to 32,000 hrs depending on model (e.g. 7F.03: 24,000 hrs); 7HA/9HA: 25,000 hrs (DLN).",
    reference: 'Section "Inspection, Type B Visual Inspection, and Type C Major", Page 33 (Figure 36)',
    status: "Table Matrix Verified",
    statusClass: "grounded"
  }
];

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  renderPresetPills();
  renderEvaluationTable();
});

// Render Preset Question Pills
function renderPresetPills() {
  const container = document.getElementById("preset-pills");
  if (!container) return;

  container.innerHTML = PRESET_QUESTIONS.map(q => `
    <button class="preset-pill" onclick="askPreset('${escapeQuotes(q.text)}')">
      <span class="pill-tag ${q.tagClass}">${q.tag}</span>
      <span>${q.text}</span>
    </button>
  `).join("");
}

// Render Evaluation Table
function renderEvaluationTable() {
  const tbody = document.getElementById("eval-tbody");
  if (!tbody) return;

  tbody.innerHTML = EVAL_ITEMS.map(item => `
    <tr>
      <td><strong>${item.num}</strong></td>
      <td><strong>${item.question}</strong></td>
      <td>${item.answer}</td>
      <td><code style="font-family: var(--font-mono); color: #8ae4ff; font-size: 0.8rem;">${item.reference}</code></td>
      <td>
        <span class="status-chip ${item.statusClass}">
          ● ${item.status}
        </span>
      </td>
    </tr>
  `).join("");
}

// Switch between Chat and Evaluation Matrix tabs
function switchTab(tab) {
  const chatView = document.getElementById("view-chat");
  const evalView = document.getElementById("view-eval");
  const tabChat = document.getElementById("tab-chat");
  const tabEval = document.getElementById("tab-eval");

  if (tab === "chat") {
    chatView.classList.add("active");
    evalView.classList.remove("active");
    tabChat.classList.add("active");
    tabEval.classList.remove("active");
  } else {
    chatView.classList.remove("active");
    evalView.classList.add("active");
    tabChat.classList.remove("active");
    tabEval.classList.add("active");
  }
}

// Ask a preset question directly
function askPreset(questionText) {
  switchTab("chat");
  const input = document.getElementById("query-input");
  input.value = questionText;
  submitQuery(questionText);
}

// Form submit handler
function handleSend(e) {
  e.preventDefault();
  const input = document.getElementById("query-input");
  const q = input.value.trim();
  if (!q) return;
  submitQuery(q);
}

// Core submit query function
async function submitQuery(queryText) {
  const messagesContainer = document.getElementById("chat-messages");
  const input = document.getElementById("query-input");
  const sendBtn = document.getElementById("send-btn");

  // Append user bubble
  appendUserMessage(queryText);
  input.value = "";
  input.disabled = true;
  sendBtn.disabled = true;

  // Append typing indicator
  const typingId = appendTypingIndicator();
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: queryText })
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    removeTypingIndicator(typingId);
    appendAssistantMessage(data);
  } catch (err) {
    removeTypingIndicator(typingId);
    appendErrorMessage(`Failed to communicate with RAG server: ${err.message}`);
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

function appendUserMessage(text) {
  const container = document.getElementById("chat-messages");
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const html = `
    <div class="message user-message">
      <div class="message-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-header">
          <span class="sender-name">Operator</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-body">${escapeHtml(text)}</div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", html);
}

function appendAssistantMessage(data) {
  const container = document.getElementById("chat-messages");
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let citationHtml = "";
  if (data.is_not_found) {
    citationHtml = `
      <div class="citation-card not-found">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span>Out-of-Scope: Information not present in GE GER-3620 Rev P</span>
      </div>
    `;
  } else if (data.reference && data.reference !== "N/A") {
    citationHtml = `
      <div class="citation-card">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <span><strong>Source Reference:</strong> ${escapeHtml(data.reference)}</span>
      </div>
    `;
  }

  const html = `
    <div class="message assistant-message">
      <div class="message-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
          <path d="M2 12h20"></path>
        </svg>
      </div>
      <div class="message-content">
        <div class="message-header">
          <span class="sender-name">Maintenance Assistant</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-body">
          <p>${escapeHtml(data.answer)}</p>
          ${citationHtml}
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", html);
}

function appendTypingIndicator() {
  const container = document.getElementById("chat-messages");
  const id = `typing-${Date.now()}`;
  const html = `
    <div class="message assistant-message" id="${id}">
      <div class="message-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
        </svg>
      </div>
      <div class="message-content" style="padding: 10px 14px;">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 8px;">Retrieving from ChromaDB (k=8)...</span>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", html);
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function appendErrorMessage(msg) {
  const container = document.getElementById("chat-messages");
  const html = `
    <div class="message assistant-message">
      <div class="message-content" style="background: rgba(255, 75, 75, 0.1); border-color: rgba(255, 75, 75, 0.3);">
        <p style="color: #ff9999; font-size: 0.85rem;">⚠️ ${escapeHtml(msg)}</p>
      </div>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", html);
}

function escapeHtml(text) {
  if (!text) return "";
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function escapeQuotes(text) {
  return text.replace(/'/g, "\\'");
}
