// A classic script can report a failed module graph before the 3D code starts.
function whenPageIsParsed(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}

function updateCatalogueLinks() {
  const work = /^#work\/([\w-]+)$/.exec(location.hash);
  document.querySelectorAll(".catalogue-link").forEach(link => {
    link.hash = work ? "#project-" + work[1] : "";
  });
}

function showStartupNotice(english, german) {
  const stage = document.getElementById("gallery-stage");
  if (!stage?.hasAttribute("aria-busy")) return;
  const status = document.getElementById("gallery-status");
  let language = document.documentElement.lang;
  try { language = localStorage.getItem("museum-language") || language; } catch { /* Optional preference. */ }
  if (language === "de") {
    document.documentElement.lang = "de";
    document.querySelectorAll(".catalogue-link").forEach(link => { link.textContent = "Arbeitsproben ohne 3D ansehen"; });
  }
  status.textContent = language === "de" ? german : english;
  status.hidden = false;
  stage.classList.add("has-startup-error");
  stage.removeAttribute("aria-busy");
  document.getElementById("museum-loading").hidden = true;
}

whenPageIsParsed(updateCatalogueLinks);
window.addEventListener("hashchange", updateCatalogueLinks);
if (location.protocol === "file:") {
  whenPageIsParsed(() => {
    document.getElementById("file-notice").hidden = false;
    showStartupNotice("Please open this museum through a local server.", "Öffne das Museum über einen lokalen Server.");
  });
} else {
  window.addEventListener("error", event => {
    const mainModule = event.target?.tagName === "SCRIPT" && event.target.type === "module"
      && /\/src\/museum\/main\.js(?:[?#]|$)/.test(event.target.src || "");
    let localSyntaxError = false;
    if (event.error?.name === "SyntaxError" && event.filename) {
      try {
        const source = new URL(event.filename, location.href);
        localSyntaxError = source.origin === location.origin && /\.js$/i.test(source.pathname);
      } catch { /* No usable source URL. */ }
    }
    if (mainModule || localSyntaxError) {
      whenPageIsParsed(() => showStartupNotice(
        "Some exhibition files could not be loaded.",
        "Einige Dateien des Museums konnten nicht geladen werden."
      ));
    }
  }, true);
}
