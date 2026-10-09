import { MongoClient, ObjectId } from "mongodb";
const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "mascotas";
let db;
export function isReady() { return Boolean(db); }
export async function connect() {
  if (!uri) throw new Error("Falta MONGODB_URI");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db(dbName);
  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  await db.collection("pets").createIndex({ userId: 1, name: 1 });
  await db.collection("shots").createIndex({ userId: 1, petId: 1, day: -1 });
  console.log(`MongoDB conectado (${dbName})`);
  return db;
}
export const users = () => db.collection("users");
export const pets = () => db.collection("pets");
export const shots = () => db.collection("shots");
export function toId(value) { return ObjectId.isValid(value) ? new ObjectId(String(value)) : null; }
export function mapPet(doc) { return { id: String(doc._id), name: doc.name, species: doc.species }; }
export function mapShot(doc) { return { id: String(doc._id), petId: doc.petId, name: doc.name, day: doc.day, next: doc.next || "" }; }
