const GA_MEASUREMENT_ID = "G-LJTJ2JVW0Z";
const ATTRIBUTION_STORAGE_KEY = "janco_attribution";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

const readStoredAttribution = () => {
  try {
    return JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const captureAttribution = () => {
  const params = new URLSearchParams(window.location.search);
  const current = Object.fromEntries(
    UTM_KEYS.map((key) => [key, params.get(key) || ""]).filter(([, value]) => value),
  );
  const stored = readStoredAttribution();
  const attribution = Object.keys(current).length
    ? {
        ...stored,
        ...current,
        landing_page: stored.landing_page || window.location.href,
      }
    : stored;

  if (Object.keys(current).length) {
    try {
      window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
    } catch {
      // La medición sigue funcionando aunque el navegador bloquee sessionStorage.
    }
  }

  return attribution;
};

captureAttribution();
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag() {
  window.dataLayer.push(arguments);
};
window.gtag("js", new Date());
window.gtag("config", GA_MEASUREMENT_ID);

const googleTag = document.createElement("script");
googleTag.async = true;
googleTag.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
document.head.appendChild(googleTag);

const getCampaignParameters = () => {
  const campaign = readStoredAttribution();
  return {
    ...(campaign.utm_source ? { campaign_source: campaign.utm_source } : {}),
    ...(campaign.utm_medium ? { campaign_medium: campaign.utm_medium } : {}),
    ...(campaign.utm_campaign ? { campaign_name: campaign.utm_campaign } : {}),
  };
};

const trackEvent = (eventName, parameters = {}) => {
  window.gtag("event", eventName, {
    ...getCampaignParameters(),
    ...parameters,
  });
};

const getLinkLocation = (link) => {
  if (link.classList.contains("floating-whatsapp")) return "floating_whatsapp";
  const section = link.closest("header, section, footer");
  if (!section) return "page";
  return section.id || section.classList[0] || section.tagName.toLowerCase();
};

window.jancoAnalytics = {
  getAttribution: readStoredAttribution,
  track: trackEvent,
};

document.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;

  const href = link.getAttribute("href") || "";
  const label = (link.textContent || link.getAttribute("aria-label") || "").trim().toLowerCase();
  const linkLocation = getLinkLocation(link);

  if (href.includes("wa.me/")) {
    trackEvent("click_whatsapp", { link_location: linkLocation });
  }

  if (label.includes("agendar demo")) {
    trackEvent("click_demo", { link_location: linkLocation });
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches('[name="sistema"]') && event.target.value) {
    trackEvent("select_system", { system_name: event.target.value });
  }
});

const systemPath = window.location.pathname.match(/^\/sistemas\/([^/]+)\/?$/);
if (systemPath) {
  trackEvent("view_system", { system_name: systemPath[1].replace(/-/g, "_") });
}

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
    const storedAttribution = window.jancoAnalytics.getAttribution();

    payload.pagina = window.location.href;
    ["utm_source", "utm_medium", "utm_campaign"].forEach((key) => {
      payload[key] = storedAttribution[key] || "";
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

      trackEvent("generate_lead", { system_name: payload.sistema });
      demoForm.reset();
      setFormStatus("success", result.message || "Listo. Recibimos tu solicitud y te contactaremos pronto.");
    } catch (error) {
      trackEvent("form_submit_error", { error_type: "delivery" });
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
