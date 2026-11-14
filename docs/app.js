const translations = window.QR_TRANSLATIONS;
const defaults = { size: 480, level: "M", foreground: "#173f36", background: "#fffdf7" };

const elements = {
  language: document.querySelector("#language-select"),
  text: document.querySelector("#qr-text"),
  size: document.querySelector("#qr-size"),
  level: document.querySelector("#qr-level"),
  foreground: document.querySelector("#qr-foreground"),
  background: document.querySelector("#qr-background"),
  foregroundValue: document.querySelector("#foreground-value"),
  backgroundValue: document.querySelector("#background-value"),
  count: document.querySelector("#char-count"),
  canvas: document.querySelector("#qr-canvas"),
  empty: document.querySelector("#empty-state"),
  status: document.querySelector("#status-text"),
  download: document.querySelector("#download-button"),
  reset: document.querySelector("#reset-button"),
};

let currentLocale = "th";
let qr;
let renderTimer;

const strings = () => translations[currentLocale];
const setStatus = (message) => { elements.status.textContent = message; };

function updateColorLabels() {
  elements.foregroundValue.value = elements.foreground.value.toUpperCase();
  elements.backgroundValue.value = elements.background.value.toUpperCase();
}

function updateCount() {
  elements.count.textContent = `${elements.text.value.length} / 900`;
}

function showEmptyState(isEmpty) {
  elements.canvas.hidden = isEmpty;
  elements.empty.hidden = !isEmpty;
  elements.download.disabled = isEmpty;
  setStatus(isEmpty ? strings().waiting : strings().updated);
}

function createQr() {
  if (typeof QRious === "undefined") {
    setStatus(strings().loadError);
    elements.download.disabled = true;
    return;
  }
  qr = new QRious({
    element: elements.canvas,
    value: elements.text.value,
    size: Number(elements.size.value),
    level: elements.level.value,
    foreground: elements.foreground.value,
    background: elements.background.value,
    padding: 28,
  });
}

function renderQr() {
  window.clearTimeout(renderTimer);
  updateCount();
  updateColorLabels();
  if (!elements.text.value.trim()) {
    showEmptyState(true);
    return;
  }
  showEmptyState(false);
  renderTimer = window.setTimeout(() => {
    try {
      if (!qr) createQr();
      else qr.set({
        value: elements.text.value,
        size: Number(elements.size.value),
        level: elements.level.value,
        foreground: elements.foreground.value,
        background: elements.background.value,
        padding: 28,
      });
      setStatus(strings().updated);
    } catch (error) {
      setStatus(strings().tooLong);
      elements.download.disabled = true;
      console.error(error);
    }
  }, 100);
}

function applyLanguage(locale, shouldRender = true) {
  const nextLocale = translations[locale] ? locale : "en";
  const isExample = Object.values(translations).some(({ defaultText }) => defaultText === elements.text.value);
  currentLocale = nextLocale;
  const text = strings();

  document.documentElement.lang = nextLocale;
  document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr";
  document.title = text.pageTitle;
  document.querySelector('meta[name="description"]').content = text.metaDescription;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    if (text[node.dataset.i18n]) node.textContent = text[node.dataset.i18n];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    if (text[node.dataset.i18nPlaceholder]) node.placeholder = text[node.dataset.i18nPlaceholder];
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    if (text[node.dataset.i18nAriaLabel]) node.setAttribute("aria-label", text[node.dataset.i18nAriaLabel]);
  });

  elements.language.value = nextLocale;
  if (isExample) elements.text.value = text.defaultText;
  try { localStorage.setItem("qr-language", nextLocale); } catch (_) {}
  if (shouldRender) renderQr();
}

function resolveInitialLanguage() {
  try {
    const saved = localStorage.getItem("qr-language");
    if (saved && translations[saved]) return saved;
  } catch (_) {}
  const baseLocale = (navigator.language || "th").toLowerCase().split("-")[0];
  return translations[baseLocale] ? baseLocale : "th";
}

function downloadQr() {
  if (!qr || elements.download.disabled) return;
  const link = document.createElement("a");
  link.download = `qr-code-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = elements.canvas.toDataURL("image/png");
  link.click();
  setStatus(strings().downloaded);
  window.setTimeout(() => setStatus(strings().updated), 1800);
}

function resetAll() {
  elements.text.value = strings().defaultText;
  elements.size.value = String(defaults.size);
  elements.level.value = defaults.level;
  elements.foreground.value = defaults.foreground;
  elements.background.value = defaults.background;
  renderQr();
  elements.text.focus();
}

[elements.text, elements.size, elements.level, elements.foreground, elements.background]
  .forEach((element) => element.addEventListener("input", renderQr));
elements.language.addEventListener("change", (event) => applyLanguage(event.target.value));
elements.download.addEventListener("click", downloadQr);
elements.reset.addEventListener("click", resetAll);

applyLanguage(resolveInitialLanguage(), false);
window.addEventListener("load", renderQr);
