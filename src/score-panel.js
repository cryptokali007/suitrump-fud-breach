import { checkRun, receiptHashInput } from "./scoring.js";

export function bindScorePanel(button, dialog, getReceipt) {
  const summary = dialog.querySelector("#score-summary");
  const feedback = dialog.querySelector("#score-feedback");
  const copy = dialog.querySelector("#copy-score");
  const download = dialog.querySelector("#download-score");
  let receipt;
  let pendingRun;

  button.addEventListener("click", async () => {
    const run = getReceipt();
    pendingRun = run;
    receipt = null;
    copy.disabled = true;
    download.disabled = true;
    feedback.textContent = "";
    const accuracy = run.stats.shots ? Math.round(100 * run.stats.hits / run.stats.shots) : 0;
    summary.value = [
      run.game,
      `${run.score.toLocaleString()} points · ${run.rank}`,
      `${(run.durationMs / 1000).toFixed(2)}s · ${run.stats.takedowns} KOs · ${accuracy}% accuracy`,
    ].join("\n");
    dialog.showModal();
    copy.disabled = false;
    try {
      checkRun(run);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(receiptHashInput(run)));
      const sha256 = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
      if (!dialog.open || pendingRun !== run) return;
      receipt = { ...run, sha256 };
      summary.value += `\nReceipt ${sha256.slice(0, 12)}`;
      download.disabled = false;
    } catch (error) {
      if (pendingRun === run) feedback.textContent = `Receipt unavailable. ${error.message}`;
    }
  });

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summary.value);
      feedback.textContent = "Score copied.";
    } catch {
      summary.focus();
      summary.select();
      feedback.textContent = "Score selected for copying.";
    }
  });

  download.addEventListener("click", () => {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fud-breach-score-${receipt.sha256.slice(0, 12)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    feedback.textContent = "Receipt downloaded.";
  });

  dialog.querySelector("#close-score").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    receipt = null;
    pendingRun = null;
    summary.value = "";
  });
}
