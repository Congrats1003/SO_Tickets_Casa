
// src/worker.ts
import { MongoClient } from "mongodb";

export interface Env { MONGODB_URI: string }

// Re-uso de cliente entre invocaciones (reduce latencia en Workers calientes)
let cachedClient: MongoClient | null = null;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS simple (ajusta Origin a tu GitHub Pages si quieres restringir)
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // Inicializa cliente una vez
    cachedClient ??= new MongoClient(env.MONGODB_URI, {
      maxPoolSize: 1,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000, // evita esperas largas si red/whitelist falla
    });

    const client = cachedClient;

    // Ajusta estos nombres a tu esquema real
    const db = client.db("miBase");
    const coll = db.collection("registros");

    try {
      if (url.pathname === "/insert" && request.method === "POST") {
        const doc = await request.json();
        const res = await coll.insertOne({ ...doc, fecha: new Date() });
        return new Response(JSON.stringify({ insertedId: res.insertedId }), {
          headers: { "Content-Type": "application/json", ...cors },
          status: 200,
        });
      }

      if (url.pathname === "/find" && request.method === "POST") {
        const body = await request.json(); // { filter, limit, sort, projection }
        const { filter = {}, limit = 10, sort = { fecha: -1 }, projection } = body;
        const cursor = coll.find(filter, { limit, sort, projection });
        const results = await cursor.toArray();
        return new Response(JSON.stringify(results), {
          headers: { "Content-Type": "application/json", ...cors },
          status: 200,
        });
      }

      return new Response("Not Found", { status: 404, headers: cors });
    } catch (err) {
      // Errores típicos: ServerSelection (IP whitelist), auth, DNS/TLS
      return new Response(JSON.stringify({ error: String(err) }), {
        headers: { "Content-Type": "application/json", ...cors },
        status: 500,
      });
    }
  },
} satisfies ExportedHandler<Env>;
