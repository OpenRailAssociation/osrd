# OSRD Front -- End-to-End (E2E) Test Suite

This README explains how to install, configure, run, debug, and maintain the **Playwright-based E2E
test suite** for the OSRD front-end.

---

# 🚀 1. Running E2E Tests

You can run the E2E tests in **two ways**:

- **Locally (against a Dockerized OSRD stack)**
- **Inside OSRD's Playwright container**

---

## 🧩 1.1 Run E2E Tests Locally (Against Dockerized OSRD)

In this mode, Playwright runs on your host machine while OSRD services run in Docker

## Requirements

- Node.js + npm
- OSRD instance up and running:

```bash
./osrd-compose default up
```

**Or**, rebuild the stack if the branch includes major changes:

```bash
./osrd-compose default up -d --build
```

ℹ️ The front is significantly slower using `dev-front` mode, and it can lead to timeout during e2e-tests.

## Install specific e2e-tests dependencies

```bash
cd front/
npm install
npx playwright install --with-deps
```

ℹ️ If you use nix and the `flake.nix` of the current repository, you won’t need to `npm playwright install`.

## Run E2E tests

```bash
npm run e2e-tests
# equivalent to
npx playwright test
```

---

# 🤖 1.2 Run Tests in OSRD's Playwright Container

It is recommended to use it if you are running a Linux distribution that is not officially supported by Playwright (Playwright supports only Windows, macOS, and Ubuntu/Debian)

Start the Playwright container only:

```bash
./osrd-compose playwright up playwright
```

**Or**, start the full stack including the front-end (recommended when working on both the front-end
and E2E tests, but beware of timeouts):

```bash
./osrd-compose playwright up playwright
```

Run tests:

```bash
osrd/scripts/run-front-playwright-container.sh
```

This script accepts all Playwright CLI flags:

```bash
./scripts/run-front-playwright-container.sh --project=chromium nge/001 --retries=1
```

---

### 🧹 Clean setup (when switching compose modes)

If you switch between `default`, `playwright`, or other compose configurations, it is recommended to
clean up first:

```bash
./osrd-compose down --remove-orphans
```

---

# 🧪 2. Folder Structure & Test Organization

    tests/
      01-home/
        001-home-page.spec.ts
        ...

      02-operational-studies/
        management/
          001-project-management.spec.ts
          002-study-management.spec.ts
          003-scenario-management.spec.ts
          ...

        train-creation-tabs/
          001-op-rolling-stock-tab.spec.ts
          002-op-route-tab.spec.ts
          003-op-times-and-stops-tab.spec.ts
          004-op-simulation-settings-tab.spec.ts
          ...

        timetable/
          001-train-timetable.spec.ts
          002-train-timetable-filter.spec.ts
          003-train-edition.spec.ts
          004-train-timetable-multiselection.spec.ts
          005-scenario-page-synchronization.spec.ts
          ...

        paced-trains/
          001-paced-train-management.spec.ts
          002-paced-train-exceptions.spec.ts
          003-paced-train-occurrence-edition.spec.ts
          ...

        simulation-result/
          001-get-manchette.spec.ts
          ...

        nge/
          001-osrd-nge.spec.ts
          002-nge-osrd.spec.ts
          ...

      03-stdcm/
        001-stdcm.spec.ts
        002-stdcm-simulation-sheet.spec.ts
        003-stdcm-feedback-mail.spec.ts
        004-stdcm-linked-train.spec.ts
        005-stdcm-missing-fields.spec.ts
        ...

      04-rolling-stock-editor/
        001-rolling-stock-editor.spec.ts
        002-rolling-stock-filter.spec.ts
        ...

      utils/
      reporter/
      pages/
      assets/
      README.md

### 🧭 Rules

- Only **test files** (`*.spec.ts`) go inside domain folders.
- Assets must never be mixed with test files.
- Utilities and Page Objects stay in their dedicated folders.
- Every test file is **incrementally numbered**.
- Page Object = behavior + locators
- Test = data + expectations

---

# 🏷️ 3. Using the `@smoke` Tag

The `@smoke` tag should be used for:

- **Critical user flows**
- **Key validations intended for fast CI runs**, especially when the full test suite becomes too
  long to execute on the pipeline

### Example

```ts
test('@smoke create a new study', async ({ page }) => {
  ...
});
```

### Run only smoke tests

```bash
npx playwright test -g "@smoke"
```

---

# ⚙️ 4. Recommended Test Lifecycle Structure

Every test file should follow this structure:

---

## 🔹 `beforeAll`

Used for **expensive setup** executed once:

```ts
test.beforeAll(async () => {
  infra = await getInfra();
  project = await getProject();
});
```

---

## 🔹 `beforeEach`

Used for **test isolation** and **repeated steps**:

```ts
test.beforeEach(async ({ page }) => {
  pageModel = new SomePage(page);

  await page.goto(url);
  await waitForInfraStateToBeCached(infra.id);
});
```

---

## 🔹 `afterEach`

Used for **soft cleanup**:

```ts
test.afterEach(async () => {
  await deleteScenarioIfExists();
});
```

---

## 🔹 `afterAll`

Used for **heavy cleanup**:

```ts
test.afterAll(async () => {
  await deleteScenario(study.id, scenario.name);
});
```

---

# 🧰 5. Useful Commands

Run all tests:

```bash
npx playwright test
```

Run only one file:

```bash
npx playwright test tests/op/tabs/002-op-route-tab.spec.ts
```
Run tests in headed mode:

```bash
npx playwright test --headed 002-op-route-tab.spec.ts
```

Run in interactive mode with UI:

```bash
npx playwright test --ui
```

Update snapshots:

If visual comparison tests fail due to UI changes, new snapshots must be generated as the new baseline.

You can automatically update snapshots by running:

```bash
npx playwright test --update-snapshots
```

ℹ️ Snapshot files include the operating system name in their filename.
For example, if you generate snapshots on macOS, the files will end with `-darwin.png`.
Since CI runs on Linux, you must rename the files to use `-linux.png` before committing them.

Run tests in debug mode with the Playwright Inspector:

```bash
npx playwright test --debug
```

Run a specific test:

```bash
npx playwright test 003-op-times-and-stops-tab.spec.ts -g "Update and clear input table row"
# or
npx playwright test train-creation-tabs/003 -g "Update and clear input table row"
```

Run tests on a specific browser with custom worker and retry settings:

```bash
npx playwright test --project=chromium --retries=1 --workers=2
```

ℹ️ All commands above also work when running tests inside the Playwright container by replacing
 `npx playwright test` with `./scripts/run-front-playwright-container.sh`.

You may also want to explore [Playwright documentation](https://playwright.dev/docs/intro) for more
insights.

---

# 🎥 6. Debugging Failures

When a test fails, Playwright automatically generates:

- **trace files**
- **videos**
- **screenshots**

They are available under:

    front/test-results/

Open a trace locally with:

```bash
npx playwright show-trace path/to/trace.zip
```
You can also inspect traces in the browser by following [this url](https://trace.playwright.dev/)  

In the CI those files are available as artifacts. You can view them in the Github summary.

## UI Mode

Use UI Mode when you want to explore, run, and debug tests visually.

It is useful for:

- replaying steps
- checking what happened before and after a failure
- filtering by file, project, tag, or status

```bash
npx playwright test --ui
```
## Playwright Inspector

Use the Playwright Inspector for a focused debug session.

It is useful when you want to:

- pause execution
- step through actions
- inspect locators and runtime behavior

```bash
npx playwright test --debug
```
To debug one test file, run the Playwright test command with the test file name that you want to debug followed by the `--debug` flag

```bash
npx playwright test 001-stdcm.spec.ts --debug
```
---

# ⚙️ 7. Current Playwright Configuration Summary

This section describes the current OSRD configuration, not Playwright defaults.

```bash
npx playwright test --help
```

- **Retries on test failure**: `1` in CI and locally
- **Trace**: on first retry
- **Video**: only when retried
- **Projects**: only `chromium` & `firefox` are available
- **Locale**: `fr`
- **Timezone**: `Europe/Paris`
- **Reporter**: custom + HTML
- **Parallel workers**: no limit in CI, but technically `2` (and `30%` of logical CPU locally, after empirical tries)
- **Screenshots**: on failure

---

# 🧱 8. Page Object Model (POM)

All Page Objects are stored under:

    tests/pages/

All Page Objects **must be accessed through Playwright fixtures** (defined in
`tests/page-object-fixture.ts`), instead of being instantiated manually inside each test.

✅ Preferred:

```ts
test('test example', async ({ homePage }) => {
  await homePage.goToOperationalStudiesPage();
  await expect(homePage.page).toHaveURL(/.*\/operational-studies/);
});
```

❌ Avoid:

```ts
test('test example', async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goToOperationalStudiesPage();
  await expect(homePage.page).toHaveURL(/.*\/operational-studies/);
});
```

Guidelines:

- Always use `getByTestId()`
- Avoid brittle CSS/DOM selectors
- Keep business logic **out** of tests → put it in POMs
- Keep POMs clean, typed, readable
- Each page has its own folder and class

---

# 📦 9. Test Data & Assets

Available under:

    tests/assets/

Includes:

- JSON datasets
- Rolling stock input data
- Timetable inputs
- Paced train data
- Expected output models

---

# 📢 10. Best Testing Practices

---

### ✅ Do

- **Use meaningful `test.describe()` tags**
  Helps filtering by domain: `@op`, `@timetable`, `@stdcm`, `@nge`, etc.

- **Keep tests isolated**
  No shared globals.
  Each test creates its own data.
  Clean up test data in `afterAll`.

- **Use `test.step()` to provide structure**
  Gives clean trace output.

- **Rely on POM instead of inline locators**

- **Prefer assertions like `toHaveText()`, `toHaveValue()`, `toBeVisible()`…**
  These are auto-retried and more stable than manual checks.

- **Prefer `expect.poll()`**
  Useful for dynamic content (simulation results, timetable validations).

- **Add `data-testid` for anything interacted with in tests**

---

### ❌ Avoid

- Hardcoded delays (`waitForTimeout`)
- Brittle selectors
  `.class > div:nth-child(3)`
  `.dsg-container`
- Long tests doing too many things
- Business logic inside test files
  Anything repeated twice → move into a POM or utils.
- Adding logs (`console.log`) in the test environment
