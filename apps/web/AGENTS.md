<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Shadcn UI

This app uses Shadcn components with the Radix Nova style. The source of truth is `components.json`; generated primitives belong in `components/ui/`.

## Component workflow

- Before creating UI, search `components/ui/` and reuse an existing primitive.
- Add primitives with `pnpm --dir apps/web dlx shadcn@latest add <component>`.
- Keep Shadcn primitives in `components/ui/`; put feature composition in `components/web/`, `components/admin/`, or the owning route.
- Import UI primitives through `@/components/ui/<component>`.
- Use `cn()` from `@/lib/utils` and existing `cva` variants instead of adding competing styling helpers.
- Use `lucide-react` or the existing `@tabler/icons-react` icons; do not add an icon package for a new icon set.
- Preserve `data-slot`, variants, accessibility behavior, keyboard interaction, RTL support, and exported component APIs when modifying a generated primitive.

## UI quality

- Compose primitives instead of rewriting dialogs, menus, sheets, selects, and forms from raw HTML.
- Add explicit loading, empty, error, and disabled states where the feature has those states.
- Preserve existing responsive breakpoints and color/typography tokens.
- Do not add a dependency, registry, or redesign a component without a concrete need.

Validate web UI changes with `pnpm --filter web lint` and `pnpm --filter web build`. Use browser verification for rendering and interaction changes.
