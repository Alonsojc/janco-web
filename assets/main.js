const header = document.querySelector(".site-header");
const menuButton = document.querySelector("[data-menu-button]");
const yearTarget = document.querySelector("[data-year]");
const demoForm = document.querySelector("[data-demo-form]");

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
  demoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(demoForm);
    const subject = encodeURIComponent(`Demo Janco - ${data.get("sistema") || "sitio web"}`);
    const body = encodeURIComponent(
      [
        `Nombre: ${data.get("nombre") || ""}`,
        `Empresa: ${data.get("empresa") || ""}`,
        `Correo: ${data.get("email") || ""}`,
        `Teléfono: ${data.get("telefono") || ""}`,
        `Sistema: ${data.get("sistema") || ""}`,
        "",
        data.get("mensaje") || "",
      ].join("\n"),
    );

    window.location.href = `mailto:hola@janco.tech?subject=${subject}&body=${body}`;
  });
}
