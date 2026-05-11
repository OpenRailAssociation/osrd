# Front Testing

## Where do we put tests?

- In a `__tests__` folder as close as possible to the file(s) being tested
- ...with a `.spec.ts` suffix
- What does the name refer to?
  - If only one function is tested, the name of that function
  - If several functions are tested, the main function being tested (for example, `useDebounce` even if it also tests `useDebounceAsync`)

## What do we test?

### ...in a unit test

- One function or method at a time
- The idea is to test the output according to the input, i.e. the parameters
- Test the behavior with _expected_ parameters, i.e. the general case
- Test the behavior with _unexpected_ parameters, i.e. edge cases
- Make sure to also test side effects, including global variables, shared states...

### ...in an integration test

- Any function that manages the _behavior_ of the application:
  - functions that touch the application lifecycle
  - functions that make API calls
  - functions that manage context variables
  - functions that manage store variables
  - functions that orchestrate modules/applications together
  - etc.
- For this function, we test the expected and unexpected parameters, the general case as well as edge cases, and potential side effects, but we also test the behaviors on mounting, updating and unmounting of certain components.

### ...in any case, we do not test

We must always ensure, in all our tests, that they are not _redundant_. Typically, **we do not test**:

- the framework
- the libs
- the browser
- what is not directly related to what is being tested
  - Typically, an integration test is not a unit test, and does not substitute for it: in an integration test, the functions called in the tested function are not mocked.

## How to test?

- Whatever the type of test used (unit or integration), we rely on [`vitest`](https://vitest.dev/guide/#writing-tests).
- Tests follow some rules:
  - We create `describe` groups containing `it` tests
  - We name the first level `describe` groups by the name of the hook/function
  - We name the test cases `it` always starting with "should..." (it should be _linted_)
  - If it is relevant to run the same test case multiple times but with different data, use [`it.each([1, 2, ...])`](https://vitest.dev/api/test.html#test-each).
- The data created for the tests, often fictious, must follow a neutral naming or content that does not refer to a particular infrastructure manager.
- It is sometimes necessary to mock or perform operations before a test can run properly, via instructions placed in `beforeEach()` / `afterEach()` or `beforeAll()` / `afterAll()` pairs.
  - The choice between the `beforeEach` or `beforeAll` versions (and their corresponding `after`) is at the discretion of the developers and reviewers depending on the need.
  - The balance is to be found between ensuring that we avoid undetected side effects in the case of `beforeAll` (which causes _flaky_ tests, meaning weak between runs)...
  - ...and the impact on the execution time of the tests of performing operations between each test case, in the case of `beforeEach`.

In the case of integration tests (hooks, components, etc.):

- We rely on the [React Testing Library (RTL)](https://testing-library.com/docs/react-testing-library/intro/).
  - The [Quickstart](https://testing-library.com/docs/react-testing-library/example-intro/) shows a simple example of tests, which can be summarized in this order:
    - Imports: import everything we need and define all the data common to the test cases;
    - Mock: declare all the mocks necessary for the tests;
    - Arrange (in the English sense of the term): instantiate the component via `render` or the hook via `renderHook`;
    - Act: if necessary, perform actions on this component or on the methods of the hook;
    - Assert: check that the output corresponds to what is expected.
  - The RTL exposes `act()` to use to wrap actions that require executing React's own lifecycle.
  - To test hooks, we use `renderHook` and the methods it returns: `render`, `rerender` and `unmount`.
  - For **mocking APIs** called by these components or hooks:
    - We import `mockOsrdEditoastEndpoints` from [front/src/common/api/\_\_mocks\_\_/osrdEditoastApi.ts](src/common/api/__mocks__/osrdEditoastApi.ts) and use the endpoints it provides to mock the API calls. This approach offers the advantage of not having to do gymnastics with types.
    - We also import `renderHookWithStore` from [front/src/store/\_\_tests\_\_/index.ts](src/store/__tests__/index.ts) to render hooks that require the store, which is a common case.
