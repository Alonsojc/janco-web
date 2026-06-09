const header = document.querySelector(".site-header");
const menuButton = document.querySelector("[data-menu-button]");
const yearTarget = document.querySelector("[data-year]");
const demoForm = document.querySelector("[data-demo-form]");
const formStatus = document.querySelector("[data-form-status]");
const submitButton = document.querySelector("[data-submit-button]");

if (yearTarget) {
  yearTarget.textContent = new Date().getFullYear();
}

if (header && menuButton) {
  menuButton.addEventListener("click", () => {
    const isOpen = header.getAttribute("data-open") === "true";
    header.setAttribute("data-open", String(!isOpen));
    menuButton.setAttribute("aria-expanded", String(!isOpen));
  });

  header.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
      header.setAttribute("data-open", "false");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

if (demoForm) {
  const setFormStatus = (state, message) => {
    if (!formStatus) return;
    formStatus.dataset.state = state;
    formStatus.textContent = message;
  };

  demoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(demoForm);
    const payload = Object.fromEntries(data.entries());

    setFormStatus("loading", "Enviando solicitud...");
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch("/api/leads", {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "No se pudo enviar la solicitud.");
      }

      demoForm.reset();
      setFormStatus("success", result.message || "Listo. Recibimos tu solicitud y te contactaremos pronto.");
    } catch (error) {
      setFormStatus(
        "error",
        `${error.message} También puedes escribirnos por WhatsApp al +52 442 272 0445.`,
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
