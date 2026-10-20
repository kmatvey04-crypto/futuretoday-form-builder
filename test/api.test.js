import { test } from "node:test";
import { request as httpRequest } from "node:http";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.js";

const sample = () => ({
  title: "Стажировка",
  description: "Расскажите о себе",
  fields: [
    { id: "name", type: "text", label: "Имя", required: true },
    { id: "mail", type: "email", label: "Email", required: true },
    {
      id: "team",
      type: "select",
      label: "Команда",
      required: true,
      options: ["Веб", "Дизайн"],
    },
    { id: "about", type: "textarea", label: "О себе", required: false },
    { id: "agree", type: "checkbox", label: "Согласие", required: true },
  ],
});
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "futuretoday-"));
  const file = join(dir, "store.json");
  const servers = [];
  async function start() {
    const server = createApp({ dataFile: file }).listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise((resolve) => server.once("listening", resolve));
    const origin = "http://127.0.0.1:" + server.address().port;
    const request = async (url, method = "GET", body, headers = {}) => {
      const r = await fetch(origin + "/api" + url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: r.status, body: await r.json() };
    };
    return { request, server, origin };
  }
  t.after(async () => {
    for (const s of servers) await new Promise((r) => s.close(r));
    rmSync(dir, { recursive: true, force: true });
  });
  return { ...(await start()), start, file };
}
test("основной сценарий, отдельный черновик и сохранение после перезапуска", async (t) => {
  const { request, start, server, file } = await fixture(t);
  const created = await request("/forms", "POST", sample());
  assert.equal(created.status, 201);
  const f = created.body;
  assert.equal((await request("/public/" + f.slug)).status, 404);
  const pub = await request("/forms/" + f.id + "/publish", "POST", {});
  assert.equal(pub.body.revision, 1);
  const a = {
    name: "Тестовый студент",
    mail: "student@example.com",
    team: "Веб",
    agree: true,
    about: "<script>alert(1)</script>",
  };
  assert.equal(
    (
      await request("/public/" + f.slug + "/responses", "POST", {
        answers: a,
        revision: 1,
      })
    ).status,
    201,
  );
  await request("/forms/" + f.id, "PUT", {
    ...sample(),
    title: "Новый заголовок",
  });
  assert.equal((await request("/public/" + f.slug)).body.title, "Стажировка");
  await request("/forms/" + f.id + "/publish", "POST", {});
  assert.equal(
    (
      await request("/public/" + f.slug + "/responses", "POST", {
        answers: a,
        revision: 1,
      })
    ).status,
    409,
  );
  const responses = (await request("/forms/" + f.id + "/responses")).body;
  assert.equal(responses[0].form.title, "Стажировка");
  assert.equal(responses[0].answers.about, a.about);
  assert.equal((await request("/forms")).body[0].responseCount, 1);
  await new Promise((r) => server.close(r));
  const restarted = await start();
  assert.equal(
    (await restarted.request("/forms")).body[0].draft.title,
    "Новый заголовок",
  );
  assert.equal(
    (await restarted.request("/forms/" + f.id + "/responses")).body.length,
    1,
  );
  assert.ok(JSON.parse(readFileSync(file)).responses.length);
});
test("валидация формы и ответов на сервере", async (t) => {
  const { request } = await fixture(t);
  for (const bad of [
    { ...sample(), title: "" },
    { ...sample(), fields: [] },
    { ...sample(), title: "a".repeat(121) },
    { ...sample(), fields: [{ ...sample().fields[0], type: "file" }] },
    { ...sample(), fields: [sample().fields[0], sample().fields[0]] },
  ])
    assert.equal((await request("/forms", "POST", bad)).status, 422);
  const f = (await request("/forms", "POST", sample())).body;
  await request("/forms/" + f.id + "/publish", "POST", {});
  for (const answers of [
    {},
    { name: "А", mail: "bad", team: "Веб", agree: true },
    { name: "А", mail: "test@example.com", team: "Другая", agree: true },
    { name: "А", mail: "test@example.com", team: "Веб", agree: "true" },
    { name: "А", mail: "test@example.com", team: "Веб", agree: false },
    { name: 42, mail: "test@example.com", team: "Веб", agree: true },
  ]) {
    const r = await request("/public/" + f.slug + "/responses", "POST", {
      answers,
      revision: 1,
    });
    assert.equal(r.status, 422);
    assert.ok(Object.keys(r.body.errors).length);
  }
  assert.equal((await request("/forms/" + f.id + "/responses")).body.length, 0);
});
test("границы HTTP: неизвестные адреса, origin, Host и размер тела", async (t) => {
  const { request, origin } = await fixture(t);
  assert.equal((await request("/forms/missing")).status, 404);
  assert.equal(
    (
      await request("/forms", "POST", sample(), {
        Origin: "https://example.com",
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/forms", "POST", sample(), { Origin: origin })).status,
    201,
  );
  const badHost = await new Promise((resolve, reject) => {
    const req = httpRequest(
      origin + "/api/forms",
      { headers: { Host: "evil.example" } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(badHost, 403);
  assert.equal(
    (await request("/forms", "POST", { title: "x".repeat(220000) })).status,
    413,
  );
  const r = await fetch(origin + "/api/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{broken",
  });
  assert.equal(r.status, 400);
});
