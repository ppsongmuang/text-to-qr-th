document.querySelectorAll(".article-language").forEach((select) => {
  select.addEventListener("change", () => {
    const language = select.value;
    const canonical = select.dataset.canonical;
    if (!canonical) return;
    if (language === "th") {
      window.location.href = canonical;
      return;
    }
    const target = new URL("https://translate.google.com/translate");
    target.searchParams.set("sl", "th");
    target.searchParams.set("tl", language);
    target.searchParams.set("u", canonical);
    window.location.href = target.toString();
  });
});
