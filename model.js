import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export const TYPES = ["text", "textarea", "email", "select", "checkbox"];
export class Problem extends Error {
  constructor(status, message, errors = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}
const fail = (message, errors) => {
  throw new Problem(422, message, errors);
};
export function validateForm(input) {
  if (!input || typeof input !== "object") fail("Проверьте форму.");
  const errors = {};
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  if (!title || title.length > 120)
    errors.title = "Название: от 1 до 120 символов.";
  if (description.length > 1000)
    errors.description = "Описание: не больше 1000 символов.";
  if (
    !Array.isArray(input.fields) ||
    input.fields.length < 1 ||
    input.fields.length > 30
  )
    errors.fields = "Добавьте от 1 до 30 вопросов.";
  const ids = new Set();
  const fields = (
    Array.isArray(input.fields) ? input.fields.slice(0, 30) : []
  ).map((f, i) => {
    if (!f || typeof f !== "object") {
      errors[`field-${i}`] = "Некорректный вопрос.";
      return {};
    }
    const label = typeof f.label === "string" ? f.label.trim() : "";
    const id = typeof f.id === "string" ? f.id : "";
    if (!/^[a-zA-Z0-9-]{1,60}$/.test(id) || ids.has(id))
      errors.fields = "Вопросы должны иметь уникальные идентификаторы.";
    ids.add(id);
    if (!label || label.length > 200)
      errors[id] = "Подпись вопроса: от 1 до 200 символов.";
    if (!TYPES.includes(f.type)) errors[id] = "Выберите тип вопроса.";
    if (typeof f.required !== "boolean")
      errors[id] = "Укажите обязательность вопроса.";
    let options = [];
    if (f.type === "select") {
      options = Array.isArray(f.options)
        ? f.options.map((o) => (typeof o === "string" ? o.trim() : ""))
        : [];
      if (
        options.length < 2 ||
        options.length > 20 ||
        options.some((o) => !o || o.length > 100) ||
        new Set(options).size !== options.length
      )
        errors[id] = "Укажите 2–20 разных вариантов, каждый до 100 символов.";
    }
    return { id, type: f.type, label, required: f.required, options };
  });
  if (Object.keys(errors).length) fail("Проверьте выделенные поля.", errors);
  return { title, description, fields };
}
export function validateAnswers(form, input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Некорректные ответы.");
  const errors = {},
    answers = {};
  for (const f of form.fields) {
    const raw = Object.hasOwn(input, f.id) ? input[f.id] : undefined;
    if (f.type === "checkbox") {
      if (raw !== undefined && typeof raw !== "boolean")
        errors[f.id] = "Выберите значение.";
      if (f.required && raw !== true) errors[f.id] = "Подтвердите согласие.";
      answers[f.id] = raw === true;
      continue;
    }
    const v = typeof raw === "string" ? raw.trim() : "";
    if (raw !== undefined && typeof raw !== "string")
      errors[f.id] = "Введите текст.";
    if (f.required && !v) errors[f.id] = "Заполните это поле.";
    if (v.length > (f.type === "textarea" ? 5000 : 500))
      errors[f.id] = "Ответ слишком длинный.";
    if (v && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      errors[f.id] = "Введите email в формате name@example.com.";
    if (v && f.type === "select" && !f.options.includes(v))
      errors[f.id] = "Выберите вариант из списка.";
    answers[f.id] = v;
  }
  if (Object.keys(errors).length) fail("Проверьте выделенные поля.", errors);
  return answers;
}

export class Store {
  constructor(file) {
    this.file = file;
    mkdirSync(dirname(file), { recursive: true });
    this.data = existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : { forms: [], responses: [] };
    if (!Array.isArray(this.data.forms) || !Array.isArray(this.data.responses))
      throw new Error("Неверный формат файла данных.");
  }
  commit() {
    // Synchronous mutations keep each read/modify/write atomic within this single process.
    writeFileSync(this.file + ".tmp", JSON.stringify(this.data, null, 2), {
      mode: 0o600,
    });
    renameSync(this.file + ".tmp", this.file);
  }
  get(id) {
    const f = this.data.forms.find((f) => f.id === id);
    if (!f) throw new Problem(404, "Форма не найдена.");
    return f;
  }
  save(input, id) {
    const draft = validateForm(input);
    const now = new Date().toISOString();
    const f = id
      ? this.get(id)
      : {
          id: randomUUID(),
          slug: randomUUID(),
          createdAt: now,
          published: null,
          revision: 0,
        };
    Object.assign(f, { draft, updatedAt: now });
    if (!id) this.data.forms.unshift(f);
    this.commit();
    return f;
  }
  publish(id) {
    const f = this.get(id);
    f.published = structuredClone(f.draft);
    f.revision += 1;
    f.publishedAt = new Date().toISOString();
    this.commit();
    return f;
  }
  public(slug) {
    const f = this.data.forms.find((f) => f.slug === slug && f.published);
    if (!f)
      throw new Problem(404, "Эта форма не найдена или ещё не опубликована.");
    return { ...f.published, revision: f.revision };
  }
  submit(slug, body) {
    const f = this.data.forms.find((f) => f.slug === slug && f.published);
    if (!f)
      throw new Problem(404, "Эта форма не найдена или ещё не опубликована.");
    if (body?.revision !== f.revision)
      throw new Problem(
        409,
        "Форма обновилась. Обновите страницу и проверьте вопросы.",
      );
    const answers = validateAnswers(f.published, body.answers);
    const response = {
      id: randomUUID(),
      formId: f.id,
      createdAt: new Date().toISOString(),
      revision: f.revision,
      form: structuredClone(f.published),
      answers,
    };
    this.data.responses.unshift(response);
    this.commit();
    return { id: response.id };
  }
}
