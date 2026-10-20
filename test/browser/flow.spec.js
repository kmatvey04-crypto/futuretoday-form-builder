import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
const evidence = resolve(process.env.EVIDENCE_DIR || "test-results/screenshots");
mkdirSync(evidence, { recursive: true });
test("менеджер создаёт и публикует, студент отвечает, менеджер видит результат", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/admin");
  await expect(page).toHaveTitle(/Форма/);
  await expect(page.getByRole("heading", { name: "Мои формы" })).toBeVisible();
  await page.getByRole("link", { name: "+ Создать форму" }).click();
  await page
    .getByLabel("Название формы", { exact: true })
    .fill("Стажировка в веб-команде");
  await page
    .getByLabel(/Описание/)
    .fill("Хочется создавать удобные продукты? Расскажите немного о себе.");
  await page.getByRole("button", { name: "+ Добавить вопрос" }).click();
  await page
    .getByLabel("Подпись вопроса", { exact: true })
    .fill("Электронная почта");
  await page.getByLabel("Тип ответа").selectOption("email");
  await page.getByLabel("Обязательный вопрос").check();
  await page.getByRole("button", { name: "+ Добавить вопрос" }).click();
  await page.getByLabel("Подпись вопроса", { exact: true }).fill("Направление");
  await page.getByLabel("Тип ответа").selectOption("select");
  await page.getByLabel("Варианты").fill("Frontend\nBackend");
  await page.getByRole("button", { name: "+ Добавить вопрос" }).click();
  await page.getByLabel("Подпись вопроса", { exact: true }).fill("О себе");
  await page.getByLabel("Тип ответа").selectOption("textarea");
  await page.getByRole("button", { name: "+ Добавить вопрос" }).click();
  await page
    .getByLabel("Подпись вопроса", { exact: true })
    .fill("Готов выполнить тестовое задание");
  await page.getByLabel("Тип ответа").selectOption("checkbox");
  await page.getByLabel("Обязательный вопрос").check();
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Форма опубликована. Можно делиться ссылкой.",
  );
  const studentUrl = await page.getByLabel("Ссылка для студентов").inputValue();
  await page.getByRole("button", { name: "Вопрос 1: Ваше имя" }).click();
  await page.screenshot({
    path: resolve(evidence, "editor-desktop.png"),
    fullPage: true,
  });
  const student = await context.newPage();
  student.on("pageerror", (e) => errors.push(e.message));
  await student.goto(studentUrl);
  await expect(student).toHaveTitle("Стажировка в веб-команде — Форма");
  await student.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(student.getByRole("alert")).toHaveText(
    "Проверьте выделенные поля.",
  );
  await expect(student.getByText("Подтвердите согласие.")).toBeVisible();
  await student.getByLabel("Ваше имя").fill("Тестовый студент");
  await student.getByLabel("Электронная почта").fill("wrong");
  await student.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(
    student.getByText("Введите email в формате name@example.com."),
  ).toBeVisible();
  await student.getByLabel("Электронная почта").fill("student@example.com");
  await student.getByLabel("Направление").selectOption("Frontend");
  await student
    .getByLabel("О себе")
    .fill("Люблю понятные интерфейсы и небольшие законченные проекты.");
  await student.getByLabel("Готов выполнить").check();
  await student.screenshot({
    path: resolve(evidence, "student-desktop.png"),
    fullPage: true,
  });
  await student.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      student.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    )
    .toBeTruthy();
  await student.screenshot({
    path: resolve(evidence, "student-mobile.png"),
    fullPage: true,
  });
  await student.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(
    student.getByRole("heading", { name: "Спасибо за отклик!" }),
  ).toBeVisible();
  await student.screenshot({
    path: resolve(evidence, "success-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: /Ответы/ }).click();
  await expect(
    page.getByText("Тестовый студент", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("student@example.com", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(evidence, "responses-desktop.png"),
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("tab", { name: /Ответы/ }).click();
  await expect(
    page.getByText("Тестовый студент", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Редактор" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBeTruthy();
  await page.screenshot({
    path: resolve(evidence, "editor-mobile.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('ошибки редактора, перемещение и удаление вопросов, сохранённый черновик', async ({ page }) => {
  await page.goto('/admin/new');
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Проверьте выделенные поля.');
  await page.getByLabel('Название формы', { exact: true }).fill('Черновик для проверки');
  await page.getByRole('button', { name: '+ Добавить вопрос' }).click();
  await page.getByLabel('Подпись вопроса', { exact: true }).fill('Второй вопрос');
  await page.getByRole('button', { name: 'Вопрос 2 вверх' }).click();
  await expect(page.getByRole('button', { name: 'Вопрос 1: Второй вопрос' })).toBeVisible();
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Вопрос 1: Ваше имя' })).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Черновик сохранён.');
  await page.reload();
  await expect(page.getByLabel('Название формы', { exact: true })).toHaveValue('Черновик для проверки');
  await expect(page.getByLabel('Ссылка для студентов')).toHaveCount(0);
  await page.getByRole('tab', { name: /Ответы/ }).click();
  await expect(page.getByRole('heading', { name: 'Пока нет ответов' })).toBeVisible();
});
