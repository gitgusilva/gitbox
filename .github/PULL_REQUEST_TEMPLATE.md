<!-- Keep this short. Describe what changes and why, not how the diff is laid out. -->

## What this changes

## Why

<!-- The problem it solves. Link the issue if there is one: Closes #123 -->

## How it was tested

<!-- Which platform you ran it on, and what you exercised in the app. Screenshots or a short clip for anything visual, before and after when you are changing something that already existed. -->

## Checklist

- [ ] `npm --prefix app/ui run build` passes (this runs `vue-tsc`, so it catches type errors too)
- [ ] Ran the change in the app, not only in tests
- [ ] New user-facing strings are in all three locales: `en.json`, `pt-br.json`, `es.json`
- [ ] Colours, borders and surfaces come from the theme tokens (`bg-surface`, `border-line`, `text-content`), not from hardcoded Tailwind palette classes, so every theme keeps working
- [ ] Hints use the `Tooltip` component rather than a `title` attribute
- [ ] Commits follow the conventional style used in the history (`feat(scope): ...`, `fix(scope): ...`)
- [ ] No emojis in code, documentation or commit messages

<!-- If the change touches the native addon, say whether it needs a rebuild of the
     vendored libgit2, and mention any new symbol it links against: the addon must
     stay self-contained, with no system git and no system OpenSSL. -->
