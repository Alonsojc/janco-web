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
    const params = new URLSearchParams(window.location.search);

    payload.pagina = window.location.href;
    ["utm_source", "utm_medium", "utm_campaign"].forEach((key) => {
      payload[key] = params.get(key) || "";
    });

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

const lightboxLinks = document.querySelectorAll("[data-lightbox-image]");

if (lightboxLinks.length > 0) {
  const lightbox = document.createElement("dialog");
  lightbox.className = "image-lightbox";
  lightbox.setAttribute("aria-label", "Vista ampliada de captura");
  lightbox.innerHTML = `
    <div class="image-lightbox-panel">
      <div class="image-lightbox-bar">
        <p data-lightbox-caption></p>
        <div class="image-lightbox-actions">
          <a class="image-lightbox-download" href="#" download>Descargar</a>
          <button class="image-lightbox-close" type="button" aria-label="Cerrar captura">Cerrar</button>
        </div>
      </div>
      <img data-lightbox-preview src="" alt="">
    </div>
  `;
  document.body.appendChild(lightbox);

  const preview = lightbox.querySelector("[data-lightbox-preview]");
  const caption = lightbox.querySelector("[data-lightbox-caption]");
  const closeButton = lightbox.querySelector(".image-lightbox-close");
  const downloadLink = lightbox.querySelector(".image-lightbox-download");

  const closeLightbox = () => {
    if (typeof lightbox.close === "function" && lightbox.open) {
      lightbox.close();
    }
  };

  lightboxLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (typeof lightbox.showModal !== "function") return;
      event.preventDefault();

      const image = link.querySelector("img");
      const figure = link.closest("figure");
      const figcaption = figure ? figure.querySelector("figcaption") : null;
      const imageUrl = link.getAttribute("href");

      preview.src = imageUrl;
      preview.alt = image ? image.alt : "Captura ampliada";
      caption.textContent = figcaption ? figcaption.textContent : "Captura ampliada";
      downloadLink.href = imageUrl;
      downloadLink.download = imageUrl.split("/").pop() || "captura-janco.png";

      lightbox.showModal();
    });
  });

  closeButton.addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  lightbox.addEventListener("close", () => {
    preview.removeAttribute("src");
  });
}
