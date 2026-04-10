"use client";

import { useEffect } from "react";

function markRequiredLabels(root: ParentNode = document) {
  const controls = root.querySelectorAll<HTMLElement>(
    "input[required], select[required], textarea[required], input[data-required='true'], select[data-required='true'], textarea[data-required='true'], input[aria-required='true'], select[aria-required='true'], textarea[aria-required='true']"
  );

  controls.forEach((control) => {
    const labels: HTMLLabelElement[] = [];

    const id = control.getAttribute("id");
    if (id) {
      document
        .querySelectorAll<HTMLLabelElement>(`label[for='${id}']`)
        .forEach((label) => labels.push(label));
    }

    const wrappedLabel = control.closest("label");
    if (wrappedLabel) {
      labels.push(wrappedLabel as HTMLLabelElement);
    }

    const parent = control.parentElement;
    if (parent) {
      const directLabel = parent.querySelector("label");
      if (directLabel) {
        labels.push(directLabel as HTMLLabelElement);
      }
    }

    labels.forEach((label) => {
      if (!label.classList.contains("required-field-label")) {
        label.classList.add("required-field-label");
      }
    });
  });
}

export function RequiredFieldMarker() {
  useEffect(() => {
    markRequiredLabels(document);

    const observer = new MutationObserver(() => {
      markRequiredLabels(document);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["required", "data-required", "aria-required", "id", "for"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
