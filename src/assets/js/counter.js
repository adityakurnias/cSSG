const btn = document.getElementById("btn");
const countEl = document.getElementById("count");
let count = 0;

btn.addEventListener("click", () => {
  count++;
  countEl.textContent = count;
});
