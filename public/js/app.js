import { api, setSession, clearSession, getToken } from "./api.js";
const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const authForm = document.querySelector("#auth-form");
const authError = document.querySelector("#auth-error");
const authSubmit = document.querySelector("#auth-submit");
const listEl = document.querySelector("#list");
const petSelect = document.querySelector("#pet");
const formError = document.querySelector("#form-error");
let mode = "login";
const showError = (el, message) => { el.hidden = !message; el.textContent = message || ""; };
function today() { return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10); }

function setMode(next) {
  mode = next;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  authSubmit.textContent = mode === "login" ? "Entrar" : "Crear cuenta";
}
async function refresh() {
  const data = await api("/api/pets");
  petSelect.innerHTML = "";
  listEl.innerHTML = "";
  data.pets.forEach((pet) => {
    const option = document.createElement("option");
    option.value = pet.id;
    option.textContent = pet.name;
    petSelect.append(option);
    const card = document.createElement("article");
    card.className = "pet";
    const title = document.createElement("strong");
    title.textContent = `${pet.name} \u00b7 ${pet.species}`;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "ghost";
    del.textContent = "Borrar";
    del.addEventListener("click", async () => { await api(`/api/pets/${pet.id}`, { method: "DELETE" }); await refresh(); });
    card.append(title, del);
    data.shots.filter((shot) => shot.petId === pet.id).forEach((shot) => {
      const p = document.createElement("p");
      p.textContent = `${shot.day} \u00b7 ${shot.name}${shot.next ? ` \u00b7 proxima ${shot.next}` : ""}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ghost";
      remove.textContent = "Quitar";
      remove.addEventListener("click", async () => { await api(`/api/shots/${shot.id}`, { method: "DELETE" }); await refresh(); });
      const row = document.createElement("div");
      row.className = "row";
      row.append(p, remove);
      card.append(row);
    });
    listEl.append(card);
  });
}
async function boot() {
  if (!getToken()) return;
  try {
    const { user } = await api("/api/auth/me");
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    document.querySelector("#user-name").textContent = user.username;
    document.querySelector("#day").value = today();
    await refresh();
  } catch { clearSession(); }
}
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(authError, "");
  const fd = new FormData(authForm);
  try {
    const data = await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", { method: "POST", body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }) });
    setSession(data.token);
    authForm.reset();
    await boot();
  } catch (err) { showError(authError, err.message); }
});
document.querySelector("#logout").addEventListener("click", () => { clearSession(); appView.classList.add("hidden"); authView.classList.remove("hidden"); });
document.querySelector("#pet-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(formError, "");
  try {
    await api("/api/pets", { method: "POST", body: JSON.stringify({ name: document.querySelector("#name").value.trim(), species: document.querySelector("#species").value.trim() }) });
    document.querySelector("#name").value = "";
    await refresh();
  } catch (err) { showError(formError, err.message); }
});
document.querySelector("#shot-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(formError, "");
  try {
    await api("/api/shots", { method: "POST", body: JSON.stringify({ petId: petSelect.value, name: document.querySelector("#vaccine").value.trim(), day: document.querySelector("#day").value, next: document.querySelector("#next").value }) });
    document.querySelector("#vaccine").value = "";
    await refresh();
  } catch (err) { showError(formError, err.message); }
});
boot();
