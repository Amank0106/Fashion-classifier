(() => {
  "use strict";

  const API_URL = "/predict";
  const MAX_BYTES = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/png", "image/jpeg"];
  const ALLOWED_EXT = /\.(png|jpe?g)$/i;

  const $ = (id) => document.getElementById(id);
  const el = {
    dropzone: $("dropzone"),
    input: $("file-input"),
    preview: $("preview"),
    previewImg: $("preview-img"),
    fileName: $("file-name"),
    fileSize: $("file-size"),
    replace: $("replace-btn"),
    remove: $("remove-btn"),
    analyze: $("analyze-btn"),
    analyzeLabel: $("analyze-label"),
    error: $("form-error"),
    result: $("result"),
    resultUpload: $("result-upload"),
    resultClass: $("result-class"),
    resultLabel: $("result-label"),
    resultConf: $("result-conf"),
    resultBar: $("result-bar"),
    resultId: $("result-id"),
  };

  const state = { file: null, previewUrl: null, loading: false };

  /* ---------- helpers ---------- */

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function showError(message) {
    el.error.textContent = message;
    el.error.hidden = false;
  }

  function clearError() {
    el.error.hidden = true;
    el.error.textContent = "";
  }

  function validate(file) {
    if (!file) return "Please choose an image first.";
    const typeOk = ALLOWED_TYPES.includes(file.type) || (!file.type && ALLOWED_EXT.test(file.name));
    if (!typeOk || !ALLOWED_EXT.test(file.name)) return "Unsupported file. Please upload a PNG, JPG or JPEG image.";
    if (file.size === 0) return "This file is empty. Please choose another image.";
    if (file.size > MAX_BYTES) return `This file is ${formatSize(file.size)}. The limit is ${formatSize(MAX_BYTES)}.`;
    return null;
  }

  function setLoading(isLoading) {
    state.loading = isLoading;
    el.analyze.classList.toggle("is-loading", isLoading);
    el.analyze.disabled = isLoading || !state.file;
    el.analyzeLabel.textContent = isLoading ? "Analyzing..." : "Analyze Image";
    el.remove.disabled = el.replace.disabled = isLoading;
  }

  /* ---------- file handling ---------- */

  function releasePreview() {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }

  function setFile(file) {
    clearError();
    const problem = validate(file);
    if (problem) {
      showError(problem);
      return;
    }
    releasePreview();
    state.file = file;
    state.previewUrl = URL.createObjectURL(file);
    el.previewImg.src = state.previewUrl;
    el.fileName.textContent = file.name;
    el.fileSize.textContent = formatSize(file.size);
    el.preview.hidden = false;
    el.dropzone.hidden = true;
    el.result.hidden = true;
    el.analyze.disabled = false;
  }

  function clearFile() {
    releasePreview();
    state.file = null;
    el.input.value = "";
    el.preview.hidden = true;
    el.dropzone.hidden = false;
    el.result.hidden = true;
    el.analyze.disabled = true;
    clearError();
  }

  /* ---------- API ---------- */

  async function readErrorMessage(response) {
    let detail = "";
    try {
      const data = await response.json();
      if (typeof data.detail === "string") detail = data.detail;
      else if (Array.isArray(data.detail) && data.detail[0]?.msg) detail = data.detail[0].msg;
      else if (typeof data.error === "string") detail = data.error;
    } catch (_) { /* body was not JSON */ }

    if (response.status === 400) return detail || "The server could not read this image. Try a different file.";
    if (response.status === 413) return "The image is too large for the server.";
    if (response.status === 422) return detail || "The server rejected the upload. Make sure the file is a valid image.";
    if (response.status >= 500) return "The server hit an error while analyzing the image. Please try again in a moment.";
    return detail || `Request failed (status ${response.status}).`;
  }

  function parsePrediction(data) {
    const ok =
      data && typeof data === "object" &&
      typeof data.prediction === "string" && data.prediction.trim() !== "" &&
      Number.isFinite(Number(data.confidence)) &&
      Number.isFinite(Number(data.class_id));
    if (!ok) throw new Error("MALFORMED");
    return {
      prediction: data.prediction,
      confidence: Math.min(100, Math.max(0, Number(data.confidence))),
      classId: Number(data.class_id),
      classImage: typeof data.class_image === "string" ? data.class_image : "",
    };
  }

  async function analyze() {
    clearError();
    const problem = validate(state.file);
    if (problem) {
      showError(problem);
      return;
    }

    const formData = new FormData();
    formData.append("file", state.file);

    setLoading(true);
    el.result.hidden = true;

    try {
      const response = await fetch(API_URL, { method: "POST", body: formData });
      if (!response.ok) {
        showError(await readErrorMessage(response));
        return;
      }
      let data;
      try {
        data = await response.json();
      } catch (_) {
        throw new Error("MALFORMED");
      }
      renderResult(parsePrediction(data));
    } catch (err) {
      if (err.message === "MALFORMED") {
        showError("The server sent a response this page could not understand. Please try again.");
      } else {
        showError("Could not reach the server. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  /* ---------- rendering ---------- */

  function renderResult(r) {
    el.resultUpload.src = state.previewUrl;
    el.resultLabel.textContent = r.prediction;
    el.resultConf.textContent = `${r.confidence.toFixed(2)}%`;
    el.resultId.textContent = String(r.classId);

    const classFigure = el.resultClass.closest("figure");
    if (r.classImage) {
      el.resultClass.alt = `Example of the ${r.prediction} class`;
      el.resultClass.onerror = () => { classFigure.hidden = true; };
      el.resultClass.src = r.classImage;
      classFigure.hidden = false;
    } else {
      classFigure.hidden = true;
    }

    el.resultBar.style.width = "0%";
    el.resultBar.parentElement.setAttribute("aria-valuenow", r.confidence.toFixed(0));
    el.result.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.resultBar.style.width = `${r.confidence}%`;
    }));
    el.result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---------- events ---------- */

  const openPicker = () => { if (!state.loading) el.input.click(); };

  el.dropzone.addEventListener("click", openPicker);
  el.dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); }
  });
  el.input.addEventListener("change", () => {
    if (el.input.files.length) setFile(el.input.files[0]);
  });

  ["dragenter", "dragover"].forEach((type) =>
    el.dropzone.addEventListener(type, (e) => { e.preventDefault(); el.dropzone.classList.add("is-over"); })
  );
  ["dragleave", "drop"].forEach((type) =>
    el.dropzone.addEventListener(type, (e) => { e.preventDefault(); el.dropzone.classList.remove("is-over"); })
  );
  el.dropzone.addEventListener("drop", (e) => {
    const files = e.dataTransfer?.files;
    if (!files || !files.length) { showError("No file detected. Please drop an image."); return; }
    if (files.length > 1) { showError("Please upload one image at a time."); return; }
    setFile(files[0]);
  });

  el.replace.addEventListener("click", openPicker);
  el.remove.addEventListener("click", clearFile);
  el.analyze.addEventListener("click", analyze);

  // Stop the browser from opening a file dropped outside the dropzone.
  ["dragover", "drop"].forEach((type) => window.addEventListener(type, (e) => e.preventDefault()));
})();
