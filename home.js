/* Homepage: the sky on/off switch. The choice is remembered on this device. */
(() => {
  "use strict";
  const home = document.getElementById("home");
  const btn = document.getElementById("skyToggle");
  const video = document.getElementById("skyVideo");
  const KEY = "homeSky";

  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  let on = saved === null ? !reduce : saved === "1";   // default: on (off if the phone asks for less motion)

  video.addEventListener("playing", () => video.classList.add("playing"));

  function apply() {
    home.classList.toggle("sky-on", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? "sky: on" : "sky: off";
    if (on) {
      const p = video.play();
      if (p && p.catch) p.catch(() => {});   // no video file / blocked: the css clouds stay
    } else {
      video.pause();
      video.classList.remove("playing");
    }
  }

  btn.addEventListener("click", () => {
    on = !on;
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {}
    apply();
  });

  apply();
})();
