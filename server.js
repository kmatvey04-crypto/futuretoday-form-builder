import express from "express";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Store, Problem } from "./model.js";
const root = dirname(fileURLToPath(import.meta.url));
export function createApp({
  dataFile = resolve(root, "data/store.json"),
  staticDir = resolve(root, "dist"),
} = {}) {
  const store = new Store(dataFile);
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    if (!["localhost", "127.0.0.1", "[::1]"].includes(req.hostname))
      return next(
        new Problem(403, "Доступ разрешён только с локального адреса."),
      );
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin
    ) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          return next(new Problem(403, "Запрос с другого сайта запрещён."));
      } catch {
        return next(new Problem(403, "Неверный источник запроса."));
      }
    }
    next();
  });
  app.use(express.json({ limit: "200kb" }));
  app.get("/api/forms", (req, res) =>
    res.json(
      store.data.forms.map((f) => ({
        ...f,
        responseCount: store.data.responses.filter((r) => r.formId === f.id)
          .length,
      })),
    ),
  );
  app.post("/api/forms", (req, res) =>
    res.status(201).json(store.save(req.body)),
  );
  app.get("/api/forms/:id", (req, res) => res.json(store.get(req.params.id)));
  app.put("/api/forms/:id", (req, res) =>
    res.json(store.save(req.body, req.params.id)),
  );
  app.post("/api/forms/:id/publish", (req, res) =>
    res.json(store.publish(req.params.id)),
  );
  app.get("/api/forms/:id/responses", (req, res) => {
    store.get(req.params.id);
    res.json(store.data.responses.filter((r) => r.formId === req.params.id));
  });
  app.get("/api/public/:slug", (req, res) =>
    res.json(store.public(req.params.slug)),
  );
  app.post("/api/public/:slug/responses", (req, res) =>
    res.status(201).json(store.submit(req.params.slug, req.body)),
  );
  app.use("/api", (req, res, next) =>
    next(new Problem(404, "Адрес не найден.")),
  );
  app.use(express.static(staticDir));
  app.get(["/", "/admin", "/admin/:id", "/f/:slug"], (req, res) =>
    res.sendFile(resolve(staticDir, "index.html")),
  );
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res
      .status(status)
      .json({
        message:
          status === 413
            ? "Слишком большой запрос."
            : status === 400
              ? "Некорректный JSON."
              : status >= 500
                ? "Не удалось сохранить данные. Попробуйте ещё раз."
                : err.message,
        errors: err.errors || {},
      });
  });
  return app;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("PORT должен быть числом от 1 до 65535.");
    process.exit(1);
  }
  const server = createApp().listen(port, "127.0.0.1", () =>
    console.log(`Форма: http://localhost:${port}/admin`),
  );
  server.on("error", (err) => {
    console.error(
      err.code === "EADDRINUSE"
        ? `Порт ${port} занят. Укажите другой: PORT=3001 npm start`
        : err.message,
    );
    process.exitCode = 1;
  });
}
