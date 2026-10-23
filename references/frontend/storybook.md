# Storybook

Only a top-level component gets `stories/<ComponentName>.stories.tsx`; internal components never get stories. Use `stories/static` only for story-owned constants.

The story file must:

- use Russian story text and descriptions;
- define metadata with `satisfies Meta<typeof Component>` and the framework-required default export;
- include `title`, `component`, and the `autodocs` tag;
- identify the component and its path or logical location in `title`;
- use `args` for optional defaults and unavoidable required props;
- document all props with `argTypes`;
- define a `TStory` alias;
- include `DocsPreview` with tags set to `!dev`;
- add meaningful distinct per-state or per-prop stories;
- use a custom `render` only when necessary.

Use the installed Storybook types. A story request does not authorize a production API change merely for the story.
