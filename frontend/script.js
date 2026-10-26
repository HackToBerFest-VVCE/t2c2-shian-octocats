const USE_MOCK_DATA = false;
const API_URL = "http://localhost:3000";
const DATA_URL = "mock-data.json";

const elements = {
  totalAgents: document.querySelector("#total-agents"),
  totalPrs: document.querySelector("#total-prs"),
  verifiedPrs: document.querySelector("#verified-prs"),
  averageScore: document.querySelector("#average-score"),
  agentCount: document.querySelector("#agent-count"),
  prCount: document.querySelector("#pr-count"),
  agentsTable: document.querySelector("#agents-table"),
  pullRequests: document.querySelector("#pull-requests"),
  loadError: document.querySelector("#load-error")
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function scoreClass(score) {
  if (score > 70) return "score-high";
  if (score >= 40) return "score-medium";
  return "score-low";
}

function renderMetrics(agents, pullRequests) {
  const verified = pullRequests.filter((pullRequest) => pullRequest.status === "Verified").length;
  const average = agents.length
    ? Math.round(agents.reduce((total, agent) => total + agent.score, 0) / agents.length)
    : 0;

  elements.totalAgents.textContent = agents.length;
  elements.totalPrs.textContent = pullRequests.length;
  elements.verifiedPrs.textContent = verified;
  elements.averageScore.textContent = average;
  elements.agentCount.textContent = `${agents.length} records`;
  elements.prCount.textContent = `${pullRequests.length} records`;
}

function renderAgents(agents) {
  elements.agentsTable.innerHTML = agents
    .map(
      (agent) => `
        <tr>
          <td class="agent-name"><span class="agent-avatar" aria-hidden="true">✦</span>${escapeHtml(agent.name)}</td>
          <td class="identifier">${escapeHtml(agent.identifier)}</td>
          <td><span class="score-badge ${scoreClass(agent.score)}">${agent.score}</span></td>
          <td>${agent.totalPRs}</td>
          <td>${agent.mergedPRs}</td>
          <td>${agent.rejectedPRs}</td>
        </tr>
      `
    )
    .join("");
}

function renderPullRequests(pullRequests) {
  elements.pullRequests.innerHTML = pullRequests
    .map((pullRequest) => {
      const tagClass = pullRequest.status === "Verified" ? "tag-verified" : "tag-unknown";
      return `
        <article class="pr-item">
          <div>
            <p class="pr-repo">${escapeHtml(pullRequest.repo)}</p>
            <p class="pr-title">${escapeHtml(pullRequest.title)}</p>
          </div>
          <div class="pr-meta">
            <span class="tag ${tagClass}"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(pullRequest.status)}</span>
            <span class="outcome"><span class="outcome-icon" aria-hidden="true">↗</span>${escapeHtml(pullRequest.outcome)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadDashboard() {
  async function loadMockData() {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Mock data request failed with status ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data.agents) || !Array.isArray(data.pullRequests)) {
      throw new Error("Mock data must contain agents and pullRequests arrays");
    }

    return data;
  }

  try {
    const data = USE_MOCK_DATA
      ? await loadMockData()
      : await Promise.all([
          fetch(`${API_URL}/api/agents`).then((response) => {
            if (!response.ok) throw new Error(`Agents request failed with status ${response.status}`);
            return response.json();
          }),
          fetch(`${API_URL}/api/prs`).then((response) => {
            if (!response.ok) throw new Error(`Pull requests request failed with status ${response.status}`);
            return response.json();
          })
        ]).then(([agents, pullRequests]) => ({ agents, pullRequests }));

    if (!Array.isArray(data.agents) || !Array.isArray(data.pullRequests)) {
      throw new Error("Server data must contain agents and pull requests arrays");
    }

    preserveSelection(() => {
      renderMetrics(data.agents, data.pullRequests);
      renderAgents(data.agents);
      renderPullRequests(data.pullRequests);
    });
  } catch (error) {
    if (USE_MOCK_DATA) {
      elements.loadError.hidden = false;
      elements.loadError.textContent = `Unable to load dashboard data: ${error.message}`;
      console.error(error);
      return;
    }

    try {
      const data = await loadMockData();
      preserveSelection(() => {
        renderMetrics(data.agents, data.pullRequests);
        renderAgents(data.agents);
        renderPullRequests(data.pullRequests);
      });
      elements.loadError.hidden = false;
      elements.loadError.textContent = `Unable to load live dashboard data: ${error.message} Showing mock data instead.`;
      console.error(error);
    } catch (fallbackError) {
      elements.loadError.hidden = false;
      elements.loadError.textContent = `Unable to load dashboard data: ${error.message}. Mock fallback also failed: ${fallbackError.message}`;
      console.error(error);
      console.error(fallbackError);
    }
  }
}

function preserveSelection(render) {
  const controls = [...document.querySelectorAll("select, input")].map((control) => ({
    control,
    value: control.value,
    checked: control.checked
  }));
  const activeElement = document.activeElement;

  render();

  controls.forEach(({ control, value, checked }) => {
    if (!control.isConnected) return;
    control.value = value;
    control.checked = checked;
  });

  if (activeElement instanceof HTMLElement && activeElement.isConnected) {
    activeElement.focus();
  }
}

async function refreshDashboard() {
  await loadDashboard();
}

loadDashboard();

if (!USE_MOCK_DATA) {
  let refreshInterval;

  function startRefreshing() {
    if (!refreshInterval) refreshInterval = setInterval(refreshDashboard, 5000);
  }

  function stopRefreshing() {
    clearInterval(refreshInterval);
    refreshInterval = undefined;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopRefreshing();
    } else {
      refreshDashboard();
      startRefreshing();
    }
  });

  startRefreshing();
}

function enableInteractions() {
  const glow = document.querySelector(".cursor-glow");
  const interactiveCards = document.querySelectorAll(".interactive-card");
  const magneticElements = document.querySelectorAll(".magnetic");
  const soundElements = document.querySelectorAll(".click-sound, .nav-links a, .wordmark, .metric-card, .pr-item");
  let audioContext;

  function playClickSound() {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(520, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(780, audioContext.currentTime + 0.06);
    gain.gain.setValueAtTime(0.045, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.11);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.11);
  }

  document.addEventListener("pointermove", (event) => {
    glow?.style.setProperty("--cursor-x", `${event.clientX}px`);
    glow?.style.setProperty("--cursor-y", `${event.clientY}px`);
  });

  interactiveCards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      card.style.setProperty("--rotate-x", `${y * -5}deg`);
      card.style.setProperty("--rotate-y", `${x * 5}deg`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--rotate-x", "0deg");
      card.style.setProperty("--rotate-y", "0deg");
    });
  });

  magneticElements.forEach((element) => {
    element.addEventListener("pointermove", (event) => {
      const bounds = element.getBoundingClientRect();
      const x = (event.clientX - bounds.left - bounds.width / 2) * 0.12;
      const y = (event.clientY - bounds.top - bounds.height / 2) * 0.12;
      element.style.transform = `translate(${x}px, ${y}px)`;
    });

    element.addEventListener("pointerleave", () => {
      element.style.transform = "";
    });
  });

  soundElements.forEach((element) => {
    element.addEventListener("click", playClickSound);
  });
}

enableInteractions();
