// /frontend/components/ExportButton.jsx
import React from "react";

const ExportButton = ({
  items = [],
  withImages = true,
  filename = "excel_catalog_en_demo.xlsx",
  apiBase = "",
}) => {
  const onExport = async () => {
    if (!Array.isArray(items) || items.length === 0) {
      alert("No exportable data available.");
      return;
    }

    if (
      typeof window === "undefined" ||
      !window.ExportXlsx ||
      typeof window.ExportXlsx.export !== "function"
    ) {
      alert("Export module is not loaded.");
      return;
    }

    try {
      await window.ExportXlsx.export(items, filename, apiBase, {
        withImages,
        lang: "en",
      });
    } catch (err) {
      console.error("[ExportButton] export failed:", err);
      alert("Export failed. Please check the browser console.");
    }
  };

  return (
    <button
      onClick={onExport}
      className="btn btn-primary"
      style={{ marginBottom: "10px" }}
      type="button"
    >
      ⇩ Export Excel (Schema v1.1)
    </button>
  );
};

export default ExportButton;
