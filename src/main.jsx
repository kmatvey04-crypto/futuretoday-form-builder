import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
const types = {
  text: "Строка",
  textarea: "Большой текст",
  email: "Email",
  select: "Выбор из списка",
  checkbox: "Согласие",
};
const date = (s) =>
  new Intl.DateTimeFormat("ru", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(s));
const newField = () => ({
  id: crypto.randomUUID(),
  label: "",
  type: "text",
  required: false,
  options: [],
});
async function api(url, options) {
  const r = await fetch("/api" + url, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  const body = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(body.message), {
      errors: body.errors,
      status: r.status,
    });
  return body;
}
const json = (method, body) => ({ method, body: JSON.stringify(body) });
function Header({ student = false }) {
  return (
    <header>
      <a className="brand" href={student ? "#" : "/admin"}>
        <span className="logo">F</span>Форма
      </a>
      <span className="quiet">
        {student ? "Отклик на возможности" : "Локальный кабинет"}
      </span>
    </header>
  );
}
function Alert({ children }) {
  return children ? (
    <div role="alert" className="alert">
      {children}
    </div>
  ) : null;
}
function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-symbol" aria-hidden="true">
        ↗
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
function App() {
  const path = location.pathname.split("/").filter(Boolean);
  if (path[0] === "f") return <PublicForm slug={path[1]} />;
  if (path[0] === "admin" && path[1]) return <Editor id={path[1]} />;
  return <Dashboard />;
}
function Dashboard() {
  const [forms, setForms] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/forms")
      .then(setForms)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <Header />
      <main>
        <div className="page-heading">
          <div>
            <h1>Мои формы</h1>
            <p className="quiet">От первого вопроса до нового отклика.</p>
          </div>
          <a className="button primary" href="/admin/new">
            + Создать форму
          </a>
        </div>
        <Alert>{error}</Alert>
        {!forms && !error && <p role="status">Загружаем формы…</p>}
        {forms?.length === 0 && (
          <section className="panel">
            <Empty
              title="Здесь начинаются новые знакомства"
              action={
                <a className="button primary" href="/admin/new">
                  Создать первую форму
                </a>
              }
            >
              Соберите вопросы для стажировки или мероприятия
              <br />и поделитесь ссылкой со студентами.
            </Empty>
          </section>
        )}
        {forms?.length > 0 && (
          <section className="panel form-list">
            <div className="list-label">
              Форма <span>Ответы / Обновлено</span>
            </div>
            {forms.map((f) => (
              <a className="form-row" key={f.id} href={"/admin/" + f.id}>
                <span className="form-icon" aria-hidden="true">
                  ▤
                </span>
                <div className="form-name">
                  <h2>{f.draft.title}</h2>
                  <span className={"status " + (f.published ? "live" : "")}>
                    {f.published ? "Опубликована" : "Черновик"}
                  </span>
                </div>
                <div className="row-meta">
                  <strong>
                    {f.responseCount}{" "}
                    {f.responseCount === 1 ? "ответ" : "ответов"}
                  </strong>
                  <small>{date(f.updatedAt)}</small>
                </div>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
function AnswerFields({
  form,
  answers = {},
  setAnswers = () => {},
  errors = {},
  preview = false,
  onEdit = () => {},
}) {
  return form.fields.map((f, i) => {
    const id = (preview ? "preview-" : "answer-") + f.id;
    const common = {
      id,
      name: f.id,
      required: f.required,
      "aria-invalid": !!errors[f.id],
      "aria-describedby": errors[f.id] ? id + "-error" : undefined,
    };
    const change = (e) => {
      setAnswers((a) => ({
        ...a,
        [f.id]: f.type === "checkbox" ? e.target.checked : e.target.value,
      }));
      onEdit(f.id);
    };
    return (
      <div className="answer-field" key={f.id}>
        {f.type === "checkbox" ? (
          <label className="check-label">
            <input
              {...common}
              type="checkbox"
              checked={answers[f.id] || false}
              onChange={change}
            />
            <span>
              {f.label || "Новый вопрос"}
              {f.required && <em> *</em>}
            </span>
          </label>
        ) : (
          <>
            <label htmlFor={id}>
              {f.label || "Новый вопрос"}
              {f.required && <em> *</em>}
            </label>
            {f.type === "textarea" ? (
              <textarea
                {...common}
                rows="3"
                maxLength={5000}
                value={answers[f.id] || ""}
                onChange={change}
              />
            ) : f.type === "select" ? (
              <select {...common} value={answers[f.id] || ""} onChange={change}>
                <option value="">Выберите вариант</option>
                {f.options.filter(Boolean).map((o, n) => (
                  <option key={n}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                {...common}
                type={f.type === "email" ? "email" : "text"}
                maxLength={500}
                placeholder={
                  f.type === "email" ? "name@example.com" : "Ваш ответ"
                }
                value={answers[f.id] || ""}
                onChange={change}
              />
            )}
          </>
        )}
        {errors[f.id] && (
          <small className="field-error" id={id + "-error"}>
            {errors[f.id]}
          </small>
        )}
      </div>
    );
  });
}
function Editor({ id }) {
  const [record, setRecord] = useState(null),
    [draft, setDraft] = useState(null),
    [tab, setTab] = useState("editor"),
    [responses, setResponses] = useState([]),
    [open, setOpen] = useState(null),
    [error, setError] = useState(""),
    [errors, setErrors] = useState({}),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [previewAnswers, setPreviewAnswers] = useState({});
  useEffect(() => {
    if (id === "new") {
      const f = { ...newField(), label: "Ваше имя", required: true };
      setDraft({ title: "", description: "", fields: [f] });
      setOpen(f.id);
    } else
      api("/forms/" + id)
        .then((f) => {
          setRecord(f);
          setDraft(f.draft);
          setOpen(f.draft.fields[0]?.id);
        })
        .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    const fn = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  useEffect(() => {
    if (record?.id)
      api("/forms/" + record.id + "/responses")
        .then(setResponses)
        .catch((e) => setError(e.message));
  }, [record?.id, tab]);
  function update(change) {
    setDraft((d) => ({ ...d, ...change }));
    setDirty(true);
    setNotice("");
  }
  function updateField(fid, change) {
    update({
      fields: draft.fields.map((f) => (f.id === fid ? { ...f, ...change } : f)),
    });
  }
  async function save(publish = false) {
    setBusy(true);
    setError("");
    setErrors({});
    setNotice("");
    try {
      let f = await api(
        record ? "/forms/" + record.id : "/forms",
        json(record ? "PUT" : "POST", draft),
      );
      setDirty(false);
      setRecord(f);
      setDraft(f.draft);
      if (id === "new") history.replaceState(null, "", "/admin/" + f.id);
      if (publish) {
        f = await api("/forms/" + f.id + "/publish", json("POST", {}));
        setRecord(f);
      }
      setNotice(
        publish
          ? "Форма опубликована. Можно делиться ссылкой."
          : "Черновик сохранён.",
      );
    } catch (e) {
      setError(e.message);
      setErrors(e.errors || {});
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    const url = location.origin + "/f/" + record.slug;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Ссылка скопирована.");
    } catch {
      setNotice("Скопируйте ссылку из поля вручную.");
    }
  }
  function move(index, delta) {
    const fields = [...draft.fields];
    [fields[index], fields[index + delta]] = [
      fields[index + delta],
      fields[index],
    ];
    update({ fields });
  }
  return (
    <>
      <Header />
      <main>
        <a className="breadcrumb" href="/admin">
          ← Мои формы
        </a>
        <div className="page-heading">
          <div>
            <h1>{record ? "Форма отклика" : "Новая форма"}</h1>
            <p className="quiet">
              {dirty
                ? "Есть несохранённые изменения"
                : record?.published
                  ? "Опубликована · " + date(record.publishedAt)
                  : "Черновик"}
            </p>
          </div>
          {draft && (
            <div className="actions">
              <button disabled={busy} onClick={() => save()}>
                {busy ? "Сохраняем…" : "Сохранить"}
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => save(true)}
              >
                {record?.published ? "Обновить публикацию" : "Опубликовать"}
              </button>
            </div>
          )}
        </div>
        <Alert>{error}</Alert>
        <div role="status" className={notice ? "notice" : ""}>
          {notice}
        </div>
        {!draft && !error && <p>Загружаем форму…</p>}
        {draft && (
          <>
            <div className="tabs" role="tablist" aria-label="Форма">
              <button
                role="tab"
                aria-selected={tab === "editor"}
                onClick={() => setTab("editor")}
              >
                Редактор
              </button>
              <button
                role="tab"
                aria-selected={tab === "responses"}
                onClick={() => setTab("responses")}
              >
                Ответы <span className="count">{responses.length}</span>
              </button>
            </div>
            {record?.published && (
              <div className="share">
                <label htmlFor="share-url">Ссылка для студентов</label>
                <div className="share-controls">
                  <input
                    id="share-url"
                    readOnly
                    value={location.origin + "/f/" + record.slug}
                    onFocus={(e) => e.target.select()}
                  />
                  <button onClick={copy}>Копировать</button>
                  <a
                    className="button"
                    href={"/f/" + record.slug}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть ↗
                  </a>
                </div>
              </div>
            )}
            {tab === "editor" ? (
              <>
                <div className="editor-grid">
                  <section className="panel editor-panel">
                    <h2>О форме</h2>
                    <label htmlFor="form-title">Название формы</label>
                    <input
                      id="form-title"
                      maxLength={120}
                      placeholder="Например, стажировка в команде"
                      value={draft.title}
                      aria-invalid={!!errors.title}
                      onChange={(e) => update({ title: e.target.value })}
                    />
                    {errors.title && (
                      <small className="field-error">{errors.title}</small>
                    )}
                    <label htmlFor="form-description">
                      Описание <span className="optional">необязательно</span>
                    </label>
                    <textarea
                      id="form-description"
                      maxLength={1000}
                      rows="3"
                      placeholder="Кому подойдёт и чего ждать дальше"
                      value={draft.description}
                      onChange={(e) => update({ description: e.target.value })}
                    />
                    {errors.description && (
                      <small className="field-error">
                        {errors.description}
                      </small>
                    )}
                    <div className="section-heading">
                      <h2>Вопросы</h2>
                      <span className="quiet">{draft.fields.length} / 30</span>
                    </div>
                    {errors.fields && (
                      <small className="field-error">{errors.fields}</small>
                    )}
                    {draft.fields.length === 0 && (
                      <p className="quiet">Добавьте первый вопрос.</p>
                    )}
                    {draft.fields.map((f, i) => (
                      <article
                        className={
                          "question " + (errors[f.id] ? "invalid" : "")
                        }
                        key={f.id}
                      >
                        <button
                          className="question-head"
                          aria-expanded={open === f.id}
                          aria-label={
                            "Вопрос " +
                            (i + 1) +
                            ": " +
                            (f.label || "Новый вопрос")
                          }
                          onClick={() => setOpen(open === f.id ? null : f.id)}
                        >
                          <span className="number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>
                            {f.label || "Новый вопрос"}
                            {f.required && <em> *</em>}
                          </span>
                          <span className="chevron">
                            {open === f.id ? "−" : "+"}
                          </span>
                        </button>
                        {open === f.id && (
                          <div className="question-body">
                            <label htmlFor={"label-" + f.id}>
                              Подпись вопроса
                            </label>
                            <input
                              id={"label-" + f.id}
                              maxLength={200}
                              value={f.label}
                              aria-invalid={!!errors[f.id]}
                              onChange={(e) =>
                                updateField(f.id, { label: e.target.value })
                              }
                            />
                            <label htmlFor={"type-" + f.id}>Тип ответа</label>
                            <select
                              id={"type-" + f.id}
                              value={f.type}
                              onChange={(e) =>
                                updateField(f.id, {
                                  type: e.target.value,
                                  options:
                                    e.target.value === "select"
                                      ? ["Первый вариант", "Второй вариант"]
                                      : [],
                                })
                              }
                            >
                              {Object.entries(types).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            {f.type === "select" && (
                              <>
                                <label htmlFor={"options-" + f.id}>
                                  Варианты — каждый с новой строки
                                </label>
                                <textarea
                                  id={"options-" + f.id}
                                  rows="4"
                                  value={f.options.join("\n")}
                                  onChange={(e) =>
                                    updateField(f.id, {
                                      options: e.target.value.split("\n"),
                                    })
                                  }
                                />
                              </>
                            )}
                            <div className="question-footer">
                              <label className="check-label">
                                <input
                                  type="checkbox"
                                  checked={f.required}
                                  onChange={(e) =>
                                    updateField(f.id, {
                                      required: e.target.checked,
                                    })
                                  }
                                />
                                Обязательный вопрос
                              </label>
                              <div className="actions small">
                                <button
                                  disabled={i === 0}
                                  title="Переместить вверх"
                                  aria-label={"Вопрос " + (i + 1) + " вверх"}
                                  onClick={() => move(i, -1)}
                                >
                                  ↑
                                </button>
                                <button
                                  disabled={i === draft.fields.length - 1}
                                  title="Переместить вниз"
                                  aria-label={"Вопрос " + (i + 1) + " вниз"}
                                  onClick={() => move(i, 1)}
                                >
                                  ↓
                                </button>
                                <button
                                  className="danger"
                                  onClick={() => {
                                    update({
                                      fields: draft.fields.filter(
                                        (x) => x.id !== f.id,
                                      ),
                                    });
                                  }}
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {errors[f.id] && (
                          <p className="field-error">{errors[f.id]}</p>
                        )}
                      </article>
                    ))}
                    <button
                      className="add-button"
                      disabled={draft.fields.length >= 30}
                      onClick={() => {
                        const f = newField();
                        update({ fields: [...draft.fields, f] });
                        setOpen(f.id);
                      }}
                    >
                      + Добавить вопрос
                    </button>
                  </section>
                  <aside className="panel preview">
                    <div className="preview-heading">
                      <h2>Так увидит студент</h2>
                      <span className="quiet">Предпросмотр</span>
                    </div>
                    <div className="student-content">
                      <h2>{draft.title || "Название формы"}</h2>
                      {draft.description && (
                        <p className="description">{draft.description}</p>
                      )}
                      <AnswerFields
                        form={draft}
                        answers={previewAnswers}
                        setAnswers={setPreviewAnswers}
                        preview
                      />
                      <button
                        className="primary full"
                        type="button"
                        onClick={() =>
                          setNotice(
                            "Это предпросмотр. Ответы принимаются по опубликованной ссылке.",
                          )
                        }
                      >
                        Отправить
                      </button>
                    </div>
                  </aside>
                </div>
                <p className="footnote">
                  {record?.published
                    ? "Изменения попадут в форму после обновления публикации. Полученные ответы сохранятся."
                    : "Сохраните черновик или опубликуйте форму, чтобы получить ссылку и начать принимать ответы."}
                </p>
              </>
            ) : (
              <Responses responses={responses} saved={!!record} />
            )}
          </>
        )}
      </main>
    </>
  );
}
function Responses({ responses, saved }) {
  return (
    <section className="panel responses">
      {!responses.length ? (
        <Empty title="Пока нет ответов">
          {saved
            ? "Поделитесь опубликованной ссылкой. Новые отклики появятся здесь."
            : "Сначала сохраните и опубликуйте форму."}
        </Empty>
      ) : (
        <>
          <div className="responses-heading">
            <h2>Полученные ответы</h2>
            <span className="quiet">{responses.length} всего</span>
          </div>
          {responses.map((r, index) => (
            <details className="response" key={r.id} open={index === 0}>
              <summary>
                <strong>Ответ №{responses.length - index}</strong>
                <span>{date(r.createdAt)}</span>
              </summary>
              <div className="response-body">
                <p className="quiet">
                  {r.form.title} · версия {r.revision}
                </p>
                <dl>
                  {r.form.fields.map((f) => (
                    <div key={f.id}>
                      <dt>{f.label}</dt>
                      <dd>
                        {f.type === "checkbox"
                          ? r.answers[f.id]
                            ? "Да"
                            : "Нет"
                          : r.answers[f.id] || "Нет ответа"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          ))}
        </>
      )}
    </section>
  );
}
function PublicForm({ slug }) {
  const [form, setForm] = useState(null),
    [answers, setAnswers] = useState({}),
    [errors, setErrors] = useState({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  useEffect(() => {
    api("/public/" + slug)
      .then((f) => {
        setForm(f);
        document.title = f.title + " — Форма";
      })
      .catch((e) => setError(e.message));
  }, [slug]);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setErrors({});
    // Native constraints are displayed with field-linked custom messages too.
    const errs = {};
    for (const f of form.fields) {
      const v = answers[f.id];
      if (f.required && (f.type === "checkbox" ? v !== true : !v?.trim()))
        errs[f.id] =
          f.type === "checkbox"
            ? "Подтвердите согласие."
            : "Заполните это поле.";
      else if (v && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        errs[f.id] = "Введите email в формате name@example.com.";
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      setError("Проверьте выделенные поля.");
      requestAnimationFrame(() =>
        document.querySelector('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setBusy(true);
    try {
      await api(
        "/public/" + slug + "/responses",
        json("POST", { answers, revision: form.revision }),
      );
      setSent(true);
    } catch (e) {
      setError(e.message);
      setErrors(e.errors || {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header student />
      <main className="public-main">
        <section className="panel public-card">
          {sent ? (
            <div className="success">
              <span className="success-icon" aria-hidden="true">
                ✓
              </span>
              <h1>Спасибо за отклик!</h1>
              <p className="quiet">
                Ваши ответы сохранены и уже доступны команде.
              </p>
              <p>Эту страницу можно закрыть.</p>
            </div>
          ) : (
            <>
              {form && (
                <>
                  <h1>{form.title}</h1>
                  {form.description && (
                    <p className="description">{form.description}</p>
                  )}
                  <p className="required-note">
                    <em>*</em> Обязательные вопросы
                  </p>
                </>
              )}
              <Alert>{error}</Alert>
              {!form && !error && <p role="status">Загружаем форму…</p>}
              {form && (
                <form onSubmit={submit} noValidate>
                  <AnswerFields
                    form={form}
                    answers={answers}
                    setAnswers={setAnswers}
                    errors={errors}
                    onEdit={(id) => {
                      setErrors((previous) => {
                        const next = { ...previous };
                        delete next[id];
                        return next;
                      });
                      setError("");
                    }}
                  />
                  <button
                    className="primary full"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "Отправляем…" : "Отправить"}
                  </button>
                </form>
              )}
            </>
          )}
        </section>
        <p className="public-footer">Сделано в Форме</p>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
