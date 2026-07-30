const startupError = document.getElementById("startup-error");
const startupErrorTitle = document.getElementById("startup-error-title");
const startupErrorDetail = document.getElementById("startup-error-detail");

function showStartupError(title, detail) {
  startupErrorTitle.textContent = title;
  startupErrorDetail.textContent = detail;
  startupError.hidden = false;
  document.documentElement.classList.add("startup-failed");
}

import("./game.js").catch((error) => {
  console.error("SuiTrump startup failed:", error);
  const isWebGLError = /webgl|graphics context/i.test(String(error?.message || error));
  showStartupError(
    isWebGLError ? "WebGL is unavailable in this browser" : "The 3D renderer could not start",
    isWebGLError
      ? "The page loaded correctly, but the browser could not create the graphics context required by Three.js."
      : "The game module loaded, but renderer initialization failed. Relaunch in Brave and check the console if it persists.",
  );
});
