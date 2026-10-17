const defaults = {
  text: "สวัสดี! สแกน QR นี้ได้เลย",
  size: 480,
  level: "M",
  foreground: "#173f36",
  background: "#fffdf7",
};

const elements = {
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

let qr;
let renderTimer;

function setStatus(message) {
  elements.status.textContent = message;
}

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
  setStatus(isEmpty ? "รอข้อความของคุณ" : "QR Code อัปเดตแล้ว");
}

function createQr() {
  if (typeof QRious === "undefined") {
    setStatus("ไม่สามารถโหลดตัวสร้าง QR ได้ กรุณารีเฟรชหน้า");
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

  const value = elements.text.value.trim();
  if (!value) {
    showEmptyState(true);
    return;
  }

  showEmptyState(false);
  renderTimer = window.setTimeout(() => {
    try {
      if (!qr) {
        createQr();
      } else {
        qr.set({
          value: elements.text.value,
          size: Number(elements.size.value),
          level: elements.level.value,
          foreground: elements.foreground.value,
          background: elements.background.value,
          padding: 28,
        });
      }
      setStatus("QR Code อัปเดตแล้ว");
    } catch (error) {
      setStatus("ข้อความยาวเกินไปสำหรับการตั้งค่านี้");
      elements.download.disabled = true;
      console.error(error);
    }
  }, 100);
}

function downloadQr() {
  if (!qr || elements.download.disabled) return;

  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);
  link.download = `qr-code-${timestamp}.png`;
  link.href = elements.canvas.toDataURL("image/png");
  link.click();

  setStatus("ดาวน์โหลดไฟล์แล้ว");
  window.setTimeout(() => setStatus("QR Code อัปเดตแล้ว"), 1800);
}

function resetAll() {
  elements.text.value = defaults.text;
  elements.size.value = String(defaults.size);
  elements.level.value = defaults.level;
  elements.foreground.value = defaults.foreground;
  elements.background.value = defaults.background;
  renderQr();
  elements.text.focus();
}

[elements.text, elements.size, elements.level, elements.foreground, elements.background]
  .forEach((element) => element.addEventListener("input", renderQr));

elements.download.addEventListener("click", downloadQr);
elements.reset.addEventListener("click", resetAll);

window.addEventListener("load", renderQr);
