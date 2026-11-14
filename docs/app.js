const translations = window.QR_TRANSLATIONS;
const defaults = { size: 480, level: "M", foreground: "#173f36", background: "#fffdf7" };

const elements = {
  language: document.querySelector("#language-select"),
  text: document.querySelector("#qr-text"),
  toolButtons: [...document.querySelectorAll("[data-tool]")],
  toolPanels: [...document.querySelectorAll("[data-panel]")],
  fields: [...document.querySelectorAll(".tool-field")],
  wifiHidden: document.querySelector("#wifi-hidden"),
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
let activeTool = "text";
let qr;
let renderTimer;

const strings = () => translations[currentLocale];
const fieldValue = (id) => document.querySelector(`#${id}`).value.trim();
const setStatus = (message) => { elements.status.textContent = message; };

function escapeWifi(value) {
  return value.replace(/([\\;,:])/g, "\\$1");
}

function escapeVcard(value) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([;,])/g, "\\$1");
}

function normalizeUrl(value) {
  if (!value) return "";
  return /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
}

function buildPayload() {
  switch (activeTool) {
    case "url":
      return normalizeUrl(fieldValue("qr-url"));
    case "wifi": {
      const ssid = fieldValue("wifi-ssid");
      if (!ssid) return "";
      const security = fieldValue("wifi-security");
      const password = fieldValue("wifi-password");
      const hidden = elements.wifiHidden.checked ? "true" : "false";
      const passwordPart = security === "nopass" ? "" : `P:${escapeWifi(password)};`;
      return `WIFI:T:${security};S:${escapeWifi(ssid)};${passwordPart}H:${hidden};;`;
    }
    case "vcard": {
      const values = {
        name: fieldValue("vcard-name"), org: fieldValue("vcard-org"), phone: fieldValue("vcard-phone"),
        email: fieldValue("vcard-email"), url: normalizeUrl(fieldValue("vcard-url")),
      };
      if (!Object.values(values).some(Boolean)) return "";
      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      if (values.name) lines.push(`FN:${escapeVcard(values.name)}`);
      if (values.org) lines.push(`ORG:${escapeVcard(values.org)}`);
      if (values.phone) lines.push(`TEL:${escapeVcard(values.phone)}`);
      if (values.email) lines.push(`EMAIL:${escapeVcard(values.email)}`);
      if (values.url) lines.push(`URL:${escapeVcard(values.url)}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
    case "email": {
      const address = fieldValue("email-address");
      if (!address) return "";
      const params = new URLSearchParams();
      const subject = fieldValue("email-subject");
      const body = fieldValue("email-body");
      if (subject) params.set("subject", subject);
      if (body) params.set("body", body);
      const query = params.toString();
      return `mailto:${address}${query ? `?${query}` : ""}`;
    }
    case "phone": {
      const number = fieldValue("phone-number");
      return number ? `tel:${number}` : "";
    }
    case "sms": {
      const number = fieldValue("sms-number");
      return number ? `SMSTO:${number}:${fieldValue("sms-message")}` : "";
    }
    case "whatsapp": {
      const number = fieldValue("whatsapp-number").replace(/\D/g, "");
      if (!number) return "";
      const message = fieldValue("whatsapp-message");
      return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
    }
    case "location": {
      const latitude = fieldValue("location-lat");
      const longitude = fieldValue("location-lng");
      if (!latitude || !longitude) return "";
      const label = fieldValue("location-label");
      const query = `${latitude},${longitude}${label ? ` (${label})` : ""}`;
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }
    default:
      return elements.text.value.trim();
  }
}

function updateColorLabels() {
  elements.foregroundValue.value = elements.foreground.value.toUpperCase();
  elements.backgroundValue.value = elements.background.value.toUpperCase();
}

function updateCount(payload) {
  elements.count.textContent = `${payload.length} / 900`;
}

function showEmptyState(isEmpty) {
  elements.canvas.hidden = isEmpty;
  elements.empty.hidden = !isEmpty;
  elements.download.disabled = isEmpty;
  setStatus(isEmpty ? strings().waiting : strings().updated);
}

function createQr(payload) {
  if (typeof QRious === "undefined") {
    setStatus(strings().loadError);
    elements.download.disabled = true;
    return;
  }
  qr = new QRious({
    element: elements.canvas,
    value: payload,
    size: Number(elements.size.value),
    level: elements.level.value,
    foreground: elements.foreground.value,
    background: elements.background.value,
    padding: 28,
  });
}

function renderQr() {
  window.clearTimeout(renderTimer);
  const payload = buildPayload();
  updateCount(payload);
  updateColorLabels();
  if (!payload) {
    showEmptyState(true);
    return;
  }
  showEmptyState(false);
  renderTimer = window.setTimeout(() => {
    try {
      if (!qr) createQr(payload);
      else qr.set({
        value: payload,
        size: Number(elements.size.value),
        level: elements.level.value,
        foreground: elements.foreground.value,
        background: elements.background.value,
        padding: 28,
      });
      if (qr) setStatus(strings().updated);
    } catch (error) {
      setStatus(strings().tooLong);
      elements.download.disabled = true;
      console.error(error);
    }
  }, 100);
}

function selectTool(tool, focusField = true) {
  if (!elements.toolButtons.some((button) => button.dataset.tool === tool)) return;
  activeTool = tool;
  elements.toolButtons.forEach((button) => {
    const selected = button.dataset.tool === tool;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  elements.toolPanels.forEach((panel) => {
    const selected = panel.dataset.panel === tool;
    panel.classList.toggle("is-active", selected);
    panel.hidden = !selected;
  });
  if (focusField) document.querySelector(`[data-panel="${tool}"] .tool-field`)?.focus();
  renderQr();
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
  link.download = `qr-${activeTool}-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = elements.canvas.toDataURL("image/png");
  link.click();
  setStatus(strings().downloaded);
  window.setTimeout(() => setStatus(strings().updated), 1800);
}

function resetAll() {
  const activePanel = document.querySelector(`[data-panel="${activeTool}"]`);
  activePanel.querySelectorAll("input, textarea, select").forEach((field) => {
    if (field.type === "checkbox") field.checked = false;
    else if (field.tagName === "SELECT") field.selectedIndex = 0;
    else field.value = "";
  });
  if (activeTool === "text") elements.text.value = strings().defaultText;
  elements.size.value = String(defaults.size);
  elements.level.value = defaults.level;
  elements.foreground.value = defaults.foreground;
  elements.background.value = defaults.background;
  renderQr();
  activePanel.querySelector(".tool-field")?.focus();
}

elements.fields.forEach((element) => element.addEventListener("input", renderQr));
elements.wifiHidden.addEventListener("change", renderQr);
[elements.size, elements.level, elements.foreground, elements.background]
  .forEach((element) => element.addEventListener("input", renderQr));
elements.toolButtons.forEach((button) => button.addEventListener("click", () => selectTool(button.dataset.tool)));
elements.language.addEventListener("change", (event) => applyLanguage(event.target.value));
elements.download.addEventListener("click", downloadQr);
elements.reset.addEventListener("click", resetAll);

applyLanguage(resolveInitialLanguage(), false);
window.addEventListener("load", renderQr);
