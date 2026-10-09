import { URL } from "node:url";
import { connect, isReady, pets, shots, toId, users, mapPet, mapShot } from "./db.js";
import { createApp, readJson, sendEmpty, sendJson, serveStatic } from "./http.js";
import { getUserFromRequest, hashPassword, signToken, verifyPassword } from "./middleware/auth.js";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
function usernameQuery(username) { return new RegExp("^" + username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i"); }
function requireUser(req, res) { const user = getUserFromRequest(req); if (!user) { sendJson(res, 401, { error: "No autenticado" }); return null; } return user; }
function dayKey(date = new Date()) { return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function dateOf(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""; }

const server = createApp(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname } = url;
  const method = req.method || "GET";
  if (pathname === "/health") return sendJson(res, 200, { ok: true, db: isReady() });
  if (pathname.startsWith("/api/") && !isReady()) return sendJson(res, 503, { error: "Base no lista" });
  if (!pathname.startsWith("/api/")) return serveStatic(req, res);

  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!USERNAME_RE.test(username)) return sendJson(res, 400, { error: "Usuario: 3-20 caracteres, letras, numeros y _" });
    if (password.length < 6) return sendJson(res, 400, { error: "La contrasena debe tener al menos 6 caracteres" });
    if (await users().findOne({ username: usernameQuery(username) })) return sendJson(res, 409, { error: "Ese usuario ya existe" });
    const result = await users().insertOne({ username, passwordHash: hashPassword(password), createdAt: new Date() });
    const user = { id: String(result.insertedId), username };
    return sendJson(res, 201, { user, token: signToken(user) });
  }
  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(req);
    const username = String(body.username || "").trim();
    const row = await users().findOne({ username: usernameQuery(username) });
    if (!row || !verifyPassword(String(body.password || ""), row.passwordHash)) return sendJson(res, 401, { error: "Usuario o contrasena incorrectos" });
    const user = { id: String(row._id), username: row.username };
    return sendJson(res, 200, { user, token: signToken(user) });
  }
  if (method === "GET" && pathname === "/api/auth/me") {
    const user = requireUser(req, res);
    if (!user) return;
    return sendJson(res, 200, { user });
  }

  const user = requireUser(req, res);
  if (!user) return;
  const userId = user.id;

  if (method === "GET" && pathname === "/api/pets") {
    const rows = await pets().find({ userId }).sort({ name: 1 }).limit(50).toArray();
    const vax = await shots().find({ userId }).sort({ day: -1 }).limit(200).toArray();
    return sendJson(res, 200, { pets: rows.map(mapPet), shots: vax.map(mapShot) });
  }
  if (method === "POST" && pathname === "/api/pets") {
    const body = await readJson(req);
    const name = String(body.name || "").trim();
    if (!name) return sendJson(res, 400, { error: "El nombre es obligatorio" });
    const result = await pets().insertOne({ userId, name: name.slice(0, 40), species: String(body.species || "otro").slice(0, 30), createdAt: new Date() });
    return sendJson(res, 201, { pet: mapPet(await pets().findOne({ _id: result.insertedId })) });
  }
  if (method === "POST" && pathname === "/api/shots") {
    const body = await readJson(req);
    const pet = await pets().findOne({ _id: toId(body.petId), userId });
    const name = String(body.name || "").trim();
    if (!pet || !name) return sendJson(res, 400, { error: "Mascota y vacuna son obligatorias" });
    const result = await shots().insertOne({ userId, petId: String(pet._id), name: name.slice(0, 60), day: dateOf(body.day) || dayKey(), next: dateOf(body.next), createdAt: new Date() });
    return sendJson(res, 201, { shot: mapShot(await shots().findOne({ _id: result.insertedId })) });
  }
  const petMatch = pathname.match(/^\/api\/pets\/([a-fA-F0-9]{24})$/);
  if (petMatch && method === "DELETE") {
    const result = await pets().deleteOne({ _id: toId(petMatch[1]), userId });
    if (!result.deletedCount) return sendJson(res, 404, { error: "Mascota no encontrada" });
    await shots().deleteMany({ userId, petId: petMatch[1] });
    return sendEmpty(res, 204);
  }
  const shotMatch = pathname.match(/^\/api\/shots\/([a-fA-F0-9]{24})$/);
  if (shotMatch && method === "DELETE") {
    const result = await shots().deleteOne({ _id: toId(shotMatch[1]), userId });
    if (!result.deletedCount) return sendJson(res, 404, { error: "Vacuna no encontrada" });
    return sendEmpty(res, 204);
  }
  sendJson(res, 404, { error: "Ruta no encontrada" });
});

server.listen(PORT, HOST, () => console.log(`Mascotas en http://${HOST}:${PORT}`));
async function bootDb() { for (;;) { try { await connect(); return; } catch (err) { console.error("Mongo no disponible:", err.message); await new Promise((resolve) => setTimeout(resolve, 5000)); } } }
bootDb();
