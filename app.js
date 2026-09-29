const STORAGE_KEY = "daymark-tasks-v1";
const today = localDate(new Date());

let tasks = loadTasks();
let currentView = "today";
let statusFilter = "open";
let currentProject = "";
let searchTerm = "";
let installPrompt = null;
let toastTimer;

const elements = {
  taskForm: document.querySelector("#task-form"),
  taskTitle: document.querySelector("#task-title"),
  taskDate: document.querySelector("#task-date"),
  taskProject: document.querySelector("#task-project"),
  taskPriority: document.querySelector("#task-priority"),
  taskList: document.querySelector("#task-list"),
  visibleCount: document.querySelector("#visible-count"),
  search: document.querySelector("#search-input"),
  toast: document.querySelector("#toast")
};

elements.taskDate.value = today;
document.querySelector("#topbar-date").textContent = formatDate(new Date(), { month: "short", day: "numeric" }).toUpperCase();
document.querySelector("#full-date").textContent = formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" });
render();

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = elements.taskTitle.value.trim();
  if (!title) return;
  tasks.push({
    id: crypto.randomUUID(),
    title,
    due: elements.taskDate.value || today,
    project: elements.taskProject.value,
    priority: elements.taskPriority.value,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString()
  });
  currentView = "today";
  statusFilter = "open";
  currentProject = "";
  elements.taskTitle.value = "";
  elements.taskForm.classList.remove("show-options");
  document.querySelector("#options-toggle").setAttribute("aria-expanded", "false");
  saveAndRender();
  showToast("Added to your day");
  elements.taskTitle.focus();
});

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    currentView = viewButton.dataset.view;
    statusFilter = currentView === "completed" ? "completed" : "open";
    currentProject = "";
    render();
    return;
  }

  const projectButton = event.target.closest("[data-project]");
  if (projectButton) {
    currentView = "all";
    currentProject = projectButton.dataset.project;
    render();
    return;
  }

  const statusButton = event.target.closest("[data-status]");
  if (statusButton) {
    statusFilter = statusButton.dataset.status;
    render();
    return;
  }

  if (event.target.closest("#clear-project")) {
    currentProject = "";
    render();
    return;
  }

  const checkButton = event.target.closest("[data-toggle]");
  if (checkButton) {
    const task = tasks.find((item) => item.id === checkButton.dataset.toggle);
    if (task) {
      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : null;
      saveAndRender();
    }
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    tasks = tasks.filter((item) => item.id !== deleteButton.dataset.delete);
    saveAndRender();
    showToast("Task removed");
    return;
  }

  const editButton = event.target.closest("[data-edit]");
  if (editButton) beginEdit(editButton.dataset.edit);
});

elements.search.addEventListener("input", () => {
  searchTerm = elements.search.value.trim().toLowerCase();
  renderTasks();
});

document.querySelector("#options-toggle").addEventListener("click", () => {
  const expanded = elements.taskForm.classList.toggle("show-options");
  document.querySelector("#options-toggle").setAttribute("aria-expanded", String(expanded));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !isTyping(event.target)) {
    event.preventDefault();
    elements.search.focus();
  }
  if (event.key === "Escape" && document.activeElement === elements.search) {
    elements.search.value = "";
    searchTerm = "";
    elements.search.blur();
    renderTasks();
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  document.querySelector("#install-app").hidden = false;
});

document.querySelector("#install-app").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  document.querySelector("#install-app").hidden = true;
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

function loadTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter(isTask) : [];
  } catch {
    return [];
  }
}

function isTask(task) {
  return task && typeof task.id === "string" && typeof task.title === "string" && typeof task.due === "string";
}

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  render();
}

function render() {
  updateNavigation();
  updateHeading();
  renderTasks();
  renderProgress();
  renderWeek();
}

function updateNavigation() {
  const openTasks = tasks.filter((task) => !task.completed);
  document.querySelector("#today-count").textContent = openTasks.filter((task) => task.due <= today).length;
  document.querySelector("#upcoming-count").textContent = openTasks.filter((task) => task.due > today).length;
  document.querySelector("#all-count").textContent = openTasks.length;

  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === currentView;
    button.classList.toggle("is-active", active);
    if (button.classList.contains("mobile-nav-item")) button.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll("[data-project]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.project === currentProject);
  });
  document.querySelectorAll("[data-status]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.status === statusFilter);
  });
}

function updateHeading() {
  const labels = {
    today: ["Today", "YOUR DAY, AT A GLANCE"],
    upcoming: ["Coming up", "A LOOK AHEAD"],
    all: [currentProject || "Everything", currentProject ? "YOUR PROJECT" : "THE WHOLE PICTURE"],
    completed: ["All done", "LOOK AT YOU GO"]
  };
  const [title, eyebrow] = labels[currentView];
  document.querySelector("#page-title").innerHTML = `${escapeHtml(title)}<span class="heading-period">.</span>`;
  document.querySelector("#date-eyebrow").textContent = eyebrow;
}

function visibleTasks() {
  let result = tasks.filter((task) => {
    if (currentView === "today" && task.due > today) return false;
    if (currentView === "upcoming" && task.due <= today) return false;
    if (currentView === "completed" && !task.completed) return false;
    if (currentView !== "completed" && statusFilter === "open" && task.completed) return false;
    if (currentView !== "completed" && statusFilter === "completed" && !task.completed) return false;
    if (currentProject && task.project !== currentProject) return false;
    if (searchTerm && !`${task.title} ${task.project}`.toLowerCase().includes(searchTerm)) return false;
    return true;
  });
  return result.sort((a, b) => Number(a.completed) - Number(b.completed) || a.due.localeCompare(b.due) || priorityRank(a.priority) - priorityRank(b.priority));
}

function renderTasks() {
  const visible = visibleTasks();
  elements.visibleCount.textContent = `${visible.length} ${visible.length === 1 ? "task" : "tasks"}`;
  if (!visible.length) {
    const heading = searchTerm ? "Nothing found." : currentView === "completed" || statusFilter === "completed" ? "Nothing checked off yet." : "A little room to breathe.";
    const message = searchTerm ? "Try another search." : currentView === "today" ? "Add a task above whenever you're ready." : "Nothing on this list just yet.";
    elements.taskList.innerHTML = `<div class="empty-state"><strong>${heading}</strong>${message}</div>`;
    return;
  }

  elements.taskList.innerHTML = visible.map((task) => {
    const overdue = !task.completed && task.due < today;
    const dateLabel = task.due === today ? "Today" : formatDate(new Date(`${task.due}T12:00:00`), { month: "short", day: "numeric" });
    const dueClass = overdue ? "task-due is-overdue" : "task-due";
    const priority = task.priority === "high" ? '<span class="priority">↑ High</span>' : task.priority === "low" ? '<span class="priority priority-low">↓ Low</span>' : "";
    return `<article class="task-row${task.completed ? " is-complete" : ""}">
      <button class="task-check" type="button" data-toggle="${escapeHtml(task.id)}" aria-label="${task.completed ? "Mark incomplete" : "Complete"}: ${escapeHtml(task.title)}" aria-pressed="${task.completed}">${task.completed ? "✓" : ""}</button>
      <div class="task-copy"><button class="task-name" type="button" data-edit="${escapeHtml(task.id)}" aria-label="Edit ${escapeHtml(task.title)}">${escapeHtml(task.title)}</button><div class="task-meta"><span class="task-project"><span class="project-dot ${projectDot(task.project)}"></span>${escapeHtml(task.project || "Inbox")}</span><span aria-hidden="true">·</span><span class="${dueClass}">${overdue ? "Overdue" : dateLabel}</span></div></div>
      ${priority}<button class="delete-task" type="button" data-delete="${escapeHtml(task.id)}" aria-label="Delete ${escapeHtml(task.title)}" title="Delete task">×</button>
    </article>`;
  }).join("");
}

function renderProgress() {
  const dueToday = tasks.filter((task) => task.due <= today);
  const completed = dueToday.filter((task) => task.completed).length;
  const percent = dueToday.length ? Math.round(completed / dueToday.length * 100) : 0;
  const ring = document.querySelector("#progress-ring");
  ring.style.background = `conic-gradient(var(--green) ${percent * 3.6}deg, #cdd7c5 ${percent * 3.6}deg)`;
  ring.setAttribute("aria-label", `${percent} percent of today's tasks complete`);
  document.querySelector("#progress-percent").textContent = `${percent}%`;
  document.querySelector("#progress-count").textContent = `${completed} of ${dueToday.length}`;
  document.querySelector("#progress-message").textContent = dueToday.length && completed === dueToday.length ? "Look at you go." : completed ? "Keep that feeling." : dueToday.length ? "One thing at a time." : "A fresh page.";
  const firstTask = tasks.filter((task) => !task.completed && task.due <= today).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.due.localeCompare(b.due))[0];
  document.querySelector("#focus-task").textContent = firstTask ? firstTask.title : "Add your first task and begin anywhere.";
}

function renderWeek() {
  const monday = new Date();
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { date, key: localDate(date), label: formatDate(date, { weekday: "narrow" }) };
  });
  const counts = days.map((day) => tasks.filter((task) => task.completedAt && localDate(new Date(task.completedAt)) === day.key).length);
  const max = Math.max(1, ...counts);
  document.querySelector("#week-total").textContent = `${counts.reduce((sum, count) => sum + count, 0)} done`;
  document.querySelector("#week-chart").innerHTML = days.map((day, index) => {
    const height = counts[index] ? Math.max(8, counts[index] / max * 100) : 0;
    return `<div class="week-day${day.key === today ? " is-today" : ""}"><div class="week-bar-track"><div class="week-bar" style="height:${height}%"></div></div><span>${day.label}</span></div>`;
  }).join("");
}

function beginEdit(id) {
  const task = tasks.find((item) => item.id === id);
  const row = elements.taskList.querySelector(`[data-edit="${CSS.escape(id)}"]`)?.closest(".task-row");
  if (!task || !row) return;
  const input = document.createElement("input");
  input.className = "task-name task-edit-input";
  input.value = task.title;
  input.maxLength = 120;
  row.querySelector(".task-name").replaceWith(input);
  input.focus();
  input.select();
  const finish = (save) => {
    if (save && input.value.trim()) task.title = input.value.trim();
    saveAndRender();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true), { once: true });
}

function projectDot(project) {
  return ({ Work: "dot-coral", Personal: "dot-blue", Home: "dot-green", Inbox: "dot-gray" })[project] || "dot-gray";
}

function priorityRank(priority) {
  return ({ high: 0, normal: 1, low: 2 })[priority] ?? 1;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function isTyping(element) {
  return element instanceof HTMLElement && (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 1900);
}