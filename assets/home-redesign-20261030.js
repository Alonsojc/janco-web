(() => {
  const stages = [
    {
      title: "Cotización COT-0128",
      status: "Aceptada",
      fields: [["Activo", "Vehículo"], ["Plazo", "36 meses"], ["Renta propuesta", "$18,500 MXN"], ["Contrato relacionado", "ARR-0128"]],
      progress: ["Propuesta preparada", "Condiciones revisadas", "Cotización aceptada"],
    },
    {
      title: "Contrato ARR-0128",
      status: "Activo",
      fields: [["Activo", "Vehículo"], ["Plazo", "36 meses"], ["Renta mensual", "$18,500 MXN"], ["Próximo vencimiento", "02 nov 2026"]],
      progress: ["Cotización aceptada", "Contrato firmado", "Activo asignado"],
    },
    {
      title: "Activo VEH-0128",
      status: "Asignado",
      fields: [["Tipo de activo", "Vehículo"], ["Contrato", "ARR-0128"], ["Expediente", "Completo"], ["Cliente", "Cliente de ejemplo"]],
      progress: ["Activo registrado", "Documentos completos", "Asignado al contrato"],
    },
    {
      title: "Cobranza ARR-0128",
      status: "Al corriente",
      fields: [["Renta mensual", "$18,500 MXN"], ["Próximo vencimiento", "02 nov 2026"], ["Rentas pagadas", "11 de 36"], ["Saldo vencido", "$0 MXN"]],
      progress: ["Calendario definido", "Factura relacionada", "Pago conciliado"],
    },
  ];

  const journey = document.querySelector(".journey-section");
  if (journey) {
    // Keep fictional upcoming rents coherent after the launch date without using customer data.
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const now = new Date();
    const nextMonth = now.getMonth() + (now.getDate() > 2 ? 1 : 0);
    function rentDate(offset) {
      const date = new Date(now.getFullYear(), nextMonth + offset, 2, 12);
      return `02 ${months[date.getMonth()]} ${date.getFullYear()}`;
    }
    stages[1].fields[3][1] = rentDate(0);
    stages[3].fields[1][1] = rentDate(0);
    journey.querySelectorAll("[data-journey-rent-date]").forEach((cell) => {
      cell.textContent = rentDate(Number(cell.dataset.journeyRentDate));
    });

    const tabs = Array.from(journey.querySelectorAll("[data-journey-stage]"));
    const viewButtons = Array.from(journey.querySelectorAll("[data-journey-view]"));
    const viewPanels = Array.from(journey.querySelectorAll("[data-journey-panel]"));
    const fields = Array.from(journey.querySelectorAll("[data-journey-label]"));
    const values = Array.from(journey.querySelectorAll("[data-journey-value]"));
    const progress = Array.from(journey.querySelectorAll("[data-journey-progress]"));
    const heading = journey.querySelector("[data-journey-heading]");
    const status = journey.querySelector("[data-journey-status]");
    const mainPanel = journey.querySelector("#journey-panel");
    let currentStage = 1;

    function showView(view) {
      viewButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.journeyView === view)));
      viewPanels.forEach((panel) => { panel.hidden = panel.dataset.journeyPanel !== view; });
      heading.textContent = view === "resumen" ? stages[currentStage].title : view === "documentos" ? "Documentos del expediente" : "Calendario de rentas";
      status.textContent = view === "resumen" ? stages[currentStage].status : "ARR-0128";
    }

    function showStage(index, moveFocus = false) {
      if (!stages[index]) return;
      currentStage = index;
      const stage = stages[index];
      tabs.forEach((tab, tabIndex) => {
        const selected = tabIndex === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });
      mainPanel.setAttribute("aria-labelledby", tabs[index].id);
      stage.fields.forEach(([label, value], fieldIndex) => {
        fields[fieldIndex].textContent = label;
        values[fieldIndex].textContent = value;
      });
      stage.progress.forEach((value, progressIndex) => { progress[progressIndex].textContent = value; });
      showView("resumen");
      if (moveFocus) tabs[index].focus();
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => showStage(Number(tab.dataset.journeyStage)));
      tab.addEventListener("keydown", (event) => {
        let next;
        if (event.key === "ArrowRight") next = (currentStage + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (currentStage + tabs.length - 1) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        showStage(next, true);
      });
    });
    viewButtons.forEach((button) => button.addEventListener("click", () => showView(button.dataset.journeyView)));
    showStage(currentStage);

    // Keep fixed contact/privacy controls from covering the interactive preview on small screens.
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        ([entry]) => document.body.classList.toggle("journey-visible", entry.isIntersecting),
        { threshold: 0.1 },
      );
      observer.observe(journey);
    }
  }

  // Move the existing form into the dialog rather than making a second form or a simulated submission.
  // Without dialog support or JavaScript, the original #contacto anchor remains usable.
  const dialog = document.querySelector("[data-demo-dialog]");
  const form = document.querySelector("[data-demo-form]");
  const slot = document.querySelector("[data-demo-dialog-slot]");
  const closeButton = document.querySelector("[data-demo-dialog-close]");
  let formPosition;

  function restoreForm() {
    if (formPosition?.parentNode) {
      formPosition.parentNode.insertBefore(form, formPosition);
      formPosition.remove();
      formPosition = null;
    }
  }

  if (dialog && form && slot && closeButton && typeof dialog.showModal === "function") {
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href="#contacto"]') : null;
      if (!link || dialog.open) return;
      if (formPosition) restoreForm();
      formPosition = document.createComment("Posición original del formulario de contacto");
      form.before(formPosition);
      slot.append(form);
      try {
        dialog.showModal();
        event.preventDefault();
      } catch {
        restoreForm();
      }
    });
    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => { if (!dialog.open) restoreForm(); });
  }
})();
