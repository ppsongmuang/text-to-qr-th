const translations = window.QR_TRANSLATIONS;
const defaults = {
  size: 480,
  level: "M",
  foreground: "#173f36",
  background: "#fffdf7",
  accent: "#438a78",
  style: "classic",
};

const elements = {
  language: document.querySelector("#language-select"),
  text: document.querySelector("#qr-text"),
  toolButtons: [...document.querySelectorAll("[data-tool]")],
  toolPanels: [...document.querySelectorAll("[data-panel]")],
  fields: [...document.querySelectorAll(".tool-field")],
  wifiHidden: document.querySelector("#wifi-hidden"),
  size: document.querySelector("#qr-size"),
  level: document.querySelector("#qr-level"),
  styleButtons: [...document.querySelectorAll("[data-qr-style]")],
  foreground: document.querySelector("#qr-foreground"),
  background: document.querySelector("#qr-background"),
  accent: document.querySelector("#qr-accent"),
  foregroundValue: document.querySelector("#foreground-value"),
  backgroundValue: document.querySelector("#background-value"),
  accentValue: document.querySelector("#accent-value"),
  accentControl: document.querySelector("#accent-color-control"),
  count: document.querySelector("#char-count"),
  canvas: document.querySelector("#qr-canvas"),
  empty: document.querySelector("#empty-state"),
  status: document.querySelector("#status-text"),
  download: document.querySelector("#download-button"),
  reset: document.querySelector("#reset-button"),
};

let currentLocale = "th";
let activeTool = "text";
let activeStyle = defaults.style;
let hasQr = false;
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
  elements.accentValue.value = elements.accent.value.toUpperCase();
}

function updateCount(payload) {
  elements.count.textContent = `${payload.length} / 900`;
}

function showEmptyState(isEmpty) {
  elements.canvas.hidden = isEmpty;
  elements.empty.hidden = !isEmpty;
  elements.download.disabled = isEmpty;
  if (isEmpty) hasQr = false;
  setStatus(isEmpty ? strings().waiting : strings().updated);
}

function isFinderModule(row, column, count) {
  return (row < 7 && column < 7)
    || (row < 7 && column >= count - 7)
    || (row >= count - 7 && column < 7);
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawFinder(context, column, row, unit, quiet, fill, rounded) {
  const x = (column + quiet) * unit;
  const y = (row + quiet) * unit;
  const radius = rounded ? unit * 1.25 : 0;

  context.fillStyle = fill;
  roundedRect(context, x, y, unit * 7, unit * 7, radius);
  context.fill();
  context.fillStyle = elements.background.value;
  roundedRect(context, x + unit, y + unit, unit * 5, unit * 5, rounded ? unit * 0.8 : 0);
  context.fill();
  context.fillStyle = fill;
  roundedRect(context, x + unit * 2, y + unit * 2, unit * 3, unit * 3, rounded ? unit * 0.65 : 0);
  context.fill();
}

function drawModule(context, column, row, unit, quiet, fill) {
  const x = (column + quiet) * unit;
  const y = (row + quiet) * unit;
  context.fillStyle = fill;

  if (activeStyle === "dots") {
    context.beginPath();
    context.arc(x + unit / 2, y + unit / 2, unit * 0.43, 0, Math.PI * 2);
    context.fill();
    return;
  }

  if (activeStyle === "diamond") {
    context.save();
    context.translate(x + unit / 2, y + unit / 2);
    context.rotate(Math.PI / 4);
    context.fillRect(-unit * 0.41, -unit * 0.41, unit * 0.82, unit * 0.82);
    context.restore();
    return;
  }

  if (activeStyle === "classic") {
    const left = Math.round(x);
    const top = Math.round(y);
    const right = Math.round(x + unit);
    const bottom = Math.round(y + unit);
    context.fillRect(left, top, right - left, bottom - top);
    return;
  }

  const inset = unit * 0.055;
  roundedRect(context, x + inset, y + inset, unit - inset * 2, unit - inset * 2, unit * 0.28);
  context.fill();
}

function drawThaiFrame(context, size, unit) {
  const margin = unit * 0.42;
  const reach = unit * 2.15;
  const ornamentColor = "#b58a32";

  function drawCorner(flipX, flipY) {
    context.save();
    context.translate(flipX ? size : 0, flipY ? size : 0);
    context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    context.globalAlpha = 0.96;
    context.strokeStyle = ornamentColor;
    context.fillStyle = ornamentColor;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = Math.max(1.6, unit * 0.2);

    context.beginPath();
    context.moveTo(margin + reach, margin);
    context.lineTo(margin + unit * 0.72, margin);
    context.quadraticCurveTo(margin, margin, margin, margin + unit * 0.72);
    context.lineTo(margin, margin + reach);
    context.stroke();

    context.beginPath();
    context.moveTo(margin + unit * 0.55, margin + unit * 1.72);
    context.bezierCurveTo(
      margin + unit * 0.62,
      margin + unit * 1.03,
      margin + unit * 1.05,
      margin + unit * 0.61,
      margin + unit * 1.72,
      margin + unit * 0.55,
    );
    context.bezierCurveTo(
      margin + unit * 1.18,
      margin + unit * 0.86,
      margin + unit * 0.86,
      margin + unit * 1.18,
      margin + unit * 0.55,
      margin + unit * 1.72,
    );
    context.closePath();
    context.fill();

    context.translate(margin + unit * 1.68, margin + unit * 1.68);
    context.rotate(Math.PI / 4);
    context.fillRect(-unit * 0.18, -unit * 0.18, unit * 0.36, unit * 0.36);
    context.restore();
  }

  drawCorner(false, false);
  drawCorner(true, false);
  drawCorner(false, true);
  drawCorner(true, true);
}

function drawQr(matrix) {
  const size = Number(elements.size.value);
  const context = elements.canvas.getContext("2d");
  const count = matrix.getModuleCount();
  const quiet = 4;
  const ornament = activeStyle === "thai" ? 3 : 0;
  const offset = quiet + ornament;
  const unit = size / (count + offset * 2);

  elements.canvas.width = size;
  elements.canvas.height = size;
  context.clearRect(0, 0, size, size);
  context.fillStyle = elements.background.value;
  context.fillRect(0, 0, size, size);

  let fill = elements.foreground.value;
  if (activeStyle === "gradient") {
    fill = context.createLinearGradient(0, 0, size, size);
    fill.addColorStop(0, elements.foreground.value);
    fill.addColorStop(1, elements.accent.value);
  }

  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (!matrix.isDark(row, column) || isFinderModule(row, column, count)) continue;
      drawModule(context, column, row, unit, offset, fill);
    }
  }

  const roundedFinder = ["rounded", "dots", "gradient", "thai"].includes(activeStyle);
  drawFinder(context, 0, 0, unit, offset, fill, roundedFinder);
  drawFinder(context, count - 7, 0, unit, offset, fill, roundedFinder);
  drawFinder(context, 0, count - 7, unit, offset, fill, roundedFinder);

  if (activeStyle === "thai") drawThaiFrame(context, size, unit);
}

function createQr(payload) {
  if (typeof qrcode === "undefined") return null;
  if (qrcode.stringToBytesFuncs?.["UTF-8"]) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  }
  const matrix = qrcode(0, elements.level.value);
  matrix.addData(payload, "Byte");
  matrix.make();
  return matrix;
}

function selectStyle(style, shouldRender = true) {
  if (!elements.styleButtons.some((button) => button.dataset.qrStyle === style)) return;
  activeStyle = style;
  elements.styleButtons.forEach((button) => {
    const selected = button.dataset.qrStyle === style;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  elements.accentControl.classList.toggle("is-active", style === "gradient");
  if (shouldRender) renderQr();
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
      const matrix = createQr(payload);
      if (!matrix) {
        setStatus(strings().loadError);
        elements.download.disabled = true;
        return;
      }
      drawQr(matrix);
      hasQr = true;
      setStatus(strings().updated);
    } catch (error) {
      hasQr = false;
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
  if (!hasQr || elements.download.disabled) return;
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
  elements.accent.value = defaults.accent;
  selectStyle(defaults.style, false);
  renderQr();
  activePanel.querySelector(".tool-field")?.focus();
}

elements.fields.forEach((element) => element.addEventListener("input", renderQr));
elements.wifiHidden.addEventListener("change", renderQr);
[elements.size, elements.level, elements.foreground, elements.background, elements.accent]
  .forEach((element) => element.addEventListener("input", renderQr));
elements.toolButtons.forEach((button) => button.addEventListener("click", () => selectTool(button.dataset.tool)));
elements.styleButtons.forEach((button) => button.addEventListener("click", () => selectStyle(button.dataset.qrStyle)));
elements.language.addEventListener("change", (event) => applyLanguage(event.target.value));
elements.download.addEventListener("click", downloadQr);
elements.reset.addEventListener("click", resetAll);

applyLanguage(resolveInitialLanguage(), false);
selectStyle(defaults.style, false);
window.addEventListener("load", renderQr);
