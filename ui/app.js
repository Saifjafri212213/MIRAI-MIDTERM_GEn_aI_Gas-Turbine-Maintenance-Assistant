/**
 * Gas Turbine Maintenance Assistant - Frontend Application
 * Interacts with FastAPI backend (/api/ask) and renders grounded answers & citations.
 */

const BENCHMARK_DATA = [
  {
    num: 1,
    question: "What are the three main types of inspection?",
    answer: "Maintenance inspection types may be broadly classified as standby, running, and disassembly inspections.",
    reference: 'Section "Standby Inspections", Page 25',
    status: "Verified Grounded",
    statusClass: "status-grounded"
  },
  {
    num: 2,
    question: "What does a maintenance factor of two mean?",
    answer: "A maintenance factor of two would indicate a maintenance interval that is half of the baseline interval.",
    reference: 'Section "Starts and Hours Criteria", Page 9',
    status: "Verified Grounded",
    statusClass: "status-grounded"
  },
  {
    num: 3,
    question: "What is the purchase price of this gas turbine?",
    answer: "Not found",
    reference: "N/A",
    status: "Anti-Hallucination Safe",
    statusClass: "status-safe"
  },
  {
    num: 4,
    question: "What is the melting point of titanium?",
    answer: "Not found",
    reference: "N/A",
    status: "Anti-Hallucination Safe",
    statusClass: "status-safe"
  },
  {
    num: 5,
    question: "What is the recommended combustion-inspection interval in hours?",
    answer: "The baseline recommended combustion inspection intervals vary from 8,000 to 32,000 factored hours depending on frame size and DLN configuration.",
    reference: 'Section "Inspection, Type B Visual Inspection, and Type C Major", Page 33',
    status: "Verified Grounded",
    statusClass: "status-grounded"
  }
];

document.addEventListener("DOMContentLoaded", () => {
  renderBenchmarkModal();
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeBenchmarkModal();
  });
});

function handleCardClick(questionText) {
  const input = document.getElementById("query-input");
  input.value = questionText;
  submitQuery(questionText);
}

function handleSend(e) {
  e.preventDefault();
  const input = document.getElementById("query-input");
  const q = input.value.trim();
  if (!q) return;
  submitQuery(q);
}

async function submitQuery(queryText) {
  const hero = document.getElementById("hero-starter");
  const messagesList = document.getElementById("messages-list");
  const viewport = document.getElementById("chat-viewport");
  const input = document.getElementById("query-input");
  const sendBtn = document.getElementById("send-btn");

  // Hide hero if visible
  if (hero && hero.style.display !== "none") {
    hero.style.display = "none";
  }

  // Append user message
  appendUserMessage(queryText);
  input.value = "";
  input.disabled = true;
  sendBtn.disabled = true;
  viewport.scrollTop = viewport.scrollHeight;

  // Append typing indicator
  const typingId = appendTypingIndicator();
  viewport.scrollTop = viewport.scrollHeight;

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
    appendErrorMessage(`Connection Error: ${err.message}`);
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
    viewport.scrollTop = viewport.scrollHeight;
  }
}

function appendUserMessage(text) {
  const list = document.getElementById("messages-list");
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const html = `
    <div class="message-item user-msg">
      <div class="message-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      <div class="message-bubble">
        <div class="bubble-header">
          <span class="bubble-author">Operator</span>
          <span class="bubble-time">${time}</span>
        </div>
        <div class="bubble-text">${escapeHtml(text)}</div>
      </div>
    </div>
  `;
  list.insertAdjacentHTML("beforeend", html);
}

function appendAssistantMessage(data) {
  const list = document.getElementById("messages-list");
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let citationHtml = "";
  if (data.is_not_found) {
    citationHtml = `
      <div class="not-found-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span><strong>Anti-Hallucination Guardrail:</strong> Information not found in GE GER-3620 Rev P.</span>
      </div>
    `;
  } else if (data.reference && data.reference !== "N/A") {
    citationHtml = `
      <div class="citation-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <span>Reference: ${escapeHtml(data.reference)}</span>
      </div>
    `;
  }

  const html = `
    <div class="message-item assistant-msg">
      <div class="message-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
          <path d="M2 12h20"></path>
        </svg>
      </div>
      <div class="message-bubble">
        <div class="bubble-header">
          <span class="bubble-author">Turbine Assistant</span>
          <span class="bubble-time">${time}</span>
        </div>
        <div class="bubble-text">${escapeHtml(data.answer)}</div>
        ${citationHtml}
      </div>
    </div>
  `;
  list.insertAdjacentHTML("beforeend", html);
}

function appendTypingIndicator() {
  const list = document.getElementById("messages-list");
  const id = `typing-${Date.now()}`;
  const html = `
    <div class="message-item assistant-msg" id="${id}">
      <div class="message-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
        </svg>
      </div>
      <div class="message-bubble" style="padding: 12px 18px; max-width: 320px;">
        <div class="typing-box">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 8px;">Retrieving from ChromaDB (k=8)...</span>
        </div>
      </div>
    </div>
  `;
  list.insertAdjacentHTML("beforeend", html);
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function appendErrorMessage(msg) {
  const list = document.getElementById("messages-list");
  const html = `
    <div class="message-item assistant-msg">
      <div class="message-bubble" style="background: rgba(244, 63, 94, 0.1); border-color: rgba(244, 63, 94, 0.3);">
        <p style="color: #fb7185; font-size: 0.88rem;">⚠️ ${escapeHtml(msg)}</p>
      </div>
    </div>
  `;
  list.insertAdjacentHTML("beforeend", html);
}

function resetChat() {
  const list = document.getElementById("messages-list");
  const hero = document.getElementById("hero-starter");
  list.innerHTML = "";
  if (hero) hero.style.display = "flex";
}

function openBenchmarkModal() {
  const modal = document.getElementById("benchmark-modal");
  modal.classList.add("active");
}

function closeBenchmarkModal() {
  const modal = document.getElementById("benchmark-modal");
  modal.classList.remove("active");
}

function closeModalOnBackdrop(e) {
  if (e.target.id === "benchmark-modal") {
    closeBenchmarkModal();
  }
}

function renderBenchmarkModal() {
  const tbody = document.getElementById("benchmark-tbody");
  if (!tbody) return;

  tbody.innerHTML = BENCHMARK_DATA.map(item => `
    <tr>
      <td><strong>${item.num}</strong></td>
      <td><strong>${escapeHtml(item.question)}</strong></td>
      <td>${escapeHtml(item.answer)}</td>
      <td><code style="font-family: var(--font-mono); color: #93c5fd; font-size: 0.8rem;">${escapeHtml(item.reference)}</code></td>
      <td>
        <span class="benchmark-status ${item.statusClass}">
          ● ${item.status}
        </span>
      </td>
    </tr>
  `).join("");
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
