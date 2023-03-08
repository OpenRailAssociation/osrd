# Contributing to OSRD

## Where to start ?

All contributions, bug reports, bug fixes, documentation improvements, enhancements, and ideas are welcome.

If you are brand new to OSRD or open-source development, we recommend chatting with us on [libera chat](https://web.libera.chat/#osrd) or going through the [GitHub issues](https://github.com/DGEXSolutions/osrd/issues) tab to find issues that interest you. There are number of issues listed under `good first issue` where you could start out.

## Contribute code

Commit style is detailed in the [osrd.fr/docs](https://osrd.fr/en/docs/guides/contribute/code/#git-commit-style).

### Pull request / code review

- Every PR, good or bad, is an act of generosity.
  Opening with a positive comment will help the author feel rewarded, and your subsequent remarks may be heard more clearly.
  You may feel good also.
- Add a description to PRs to explain what they do and why.
- Each PR must be linked to at least one github issue to simplify tracking.
- Pay attention to all the comments made by reviewers and either answer/challenge them or address them before asking for another review.
- Assign one maintainer and one developer using github assignment when opening the PR to get reviews.
- Help the reviewer by following advice given in [mtlynch article](https://mtlynch.io/code-review-love/).
- Review code following advice given in [osrd.fr/docs](https://osrd.fr/en/docs/guides/contribute/code-reviews/) and [mtlynch article](https://mtlynch.io/human-code-reviews-1/).
- Make commits of logical and atomic units.
- If possible, make PR of logical and atomic units too (avoid mixing refactoring, new features and bug fix at the same time).
- Keep your branch up-to-date :
```
git checkout <your_branch>
git fetch
git rebase origin/dev
```

### Bugs

The way support is delivered greatly impacts how users perceive the product and the team.
Handling the incoming support requests efficiently is thus a top priority.

- Bug must have a correct description and the bug's issue template must be filled carefully.
- Bug must be tagged with:
  - `kind:bug`
  - one or several `area:<affected_area>` if possible, if the affected area is not known leave it blank it will be added later by another team member`.
  - one `severity:<bug_severity>` if possible, if severity is not known leave it blank it will be added later by another team member
- Contributors can change issues' tags (severity, area, kind, ...) if necessary. 
  Keep in mind that explaining why you are editing an issue is the best way to avoid misunderstanding.
- If you are working on a bug or plan to work on a bug, assign yourself to the bug.
  If a bug is assigned, consider that they are already working on the resolution.
- PRs solving bugs should add a regression tests to ensure that bug will not be back in the future.

### General code recommendations

- Take the time to pick good names.
  Avoid non well-known abbreviations.

### Python

- Follow [the Zen of Python](https://www.python.org/dev/peps/pep-0020/).
- To keep our API surface minimal, only make public what is necessary.
- Documentation should only be there to explain things that aren't self evident.
- Code is linted with [flake8](https://github.com/csachs/pyproject-flake8).
- Code is formatted with [Black](https://github.com/psf/black).
- Imports are sorted with [Isort](https://github.com/PyCQA/isort).

### Test

- Python tests are written using [pytest](https://docs.pytest.org/).

### Rust

- To keep our API surface minimal, only make public what is necessary.
- Documentation should only be there to explain things that aren't self evident.
- Use the [documentation example](https://doc.rust-lang.org/rust-by-example/meta/doc.html) to know how to phrase and format your documentation.
- Code is linted with [clippy](https://github.com/rust-lang/rust-clippy).
- Code is formatted with [fmt](https://github.com/rust-lang/rustfmt).

### Test

- Test as much code as possible to avoid future regression and show that added code is bullet proof.
- Rust code is tested files per files following these [recommendations](https://doc.rust-lang.org/book/ch11-01-writing-tests.html).

### Java

- To keep our API surface minimal, only make public what is necessary.
- All public methods must be documented.
  Avoid paraphrasing doc.
- Code is formatted with [checkstyle](https://checkstyle.sourceforge.io/).

#### Tests

- TODO

### Javascript / Typescript / Front

- To keep our API surface minimal, only make public what is necessary.
- Documentation should only be there to explain things that aren't self evident.
- When adding new files, write them in TypeScript as there is a goal to move to TypeScript.
- Code is linted with [eslint](https://eslint.org/).
- Code is formatted with [prettier](https://prettier.io/).

#### Tests

- End-to-end tests are required for stable and critical features.
  [Playwright](https://playwright.dev/) is used to write these tests.
- To write unit test use [vitest](https://vitest.dev/).

### Integration tests

- Integration tests are written using [pytest](https://docs.pytest.org/) under the `/tests` folder.
- Test as much as you can when adding a new api.
