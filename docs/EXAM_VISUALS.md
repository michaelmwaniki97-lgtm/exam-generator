# Print-ready exam visuals

Questions can carry an optional `visual` alongside existing `stimuli`. Missing or null visuals preserve text-only behaviour. The field is stored inside the existing exam JSON; no database migration is needed.

```json
{
  "type": "graph",
  "required": true,
  "altText": "Temperature against time",
  "specification": {
    "graphType": "line",
    "xAxis": { "label": "Time", "unit": "minutes", "min": 0, "max": 20 },
    "yAxis": { "label": "Temperature", "unit": "C", "min": 0, "max": 100 },
    "series": [{ "name": "Water", "points": [
      { "x": 0, "y": 20 }, { "x": 5, "y": 35 },
      { "x": 10, "y": 55 }, { "x": 15, "y": 70 }, { "x": 20, "y": 70 }
    ] }]
  }
}
```

## Supported specifications

- `graph`: line, bar, scatter, or a blank `coordinate` grid. New visuals currently support one series, up to 40 points (12 distinct bars). Bar ranges must include zero. Coordinate grids use an empty series array and equal physical scales; axis spans must be comparable. Use unit `"1"` for dimensionless axes.
- `table`: string `columns` and rectangular string `rows`, within the existing table limits.
- `diagram` and `illustration`: bounded `width`, `height` and declarative line, arrow, circle, rectangle, polygon and label primitives. These cover geometry, simple science apparatus and contextual line drawings. Omit label primitives for unlabelled diagrams. No raster generation or remote images are used.
- `diagram` with `diagramType: "number_line"`: numeric `min`, `max`, `step`, and `points: [{value,label}]`; up to 20 tick intervals and 10 named points.

Only include a visual when it supports the learning task. `required: true` records a question's dependency on it. Labels must not reveal answers the learner is supposed to supply. Alt text is accessibility metadata and is not printed as an answer-bearing caption.

## Generation, editing and printing

`visual-schema.ts` defines the closed structured-output contract. `question-visual.ts` validates bounds, unsafe text, unknown fields, point ranges and payload size at generation, save/regeneration and stored-content loading. Model output is never inserted as HTML or SVG. Existing legacy stimuli remain supported.

The editor previews the rendered visual. “Regenerate visual and matching answer” regenerates the selected question's content and marking together, preserving its visual type and immutable blueprint structure. It uses the existing authenticated, revision-checked, reservation-protected atomic update. Other slots are preserved. Unsaved edits must be saved first.

“Remove visual” is a draft edit and can be undone before saving. When the visual is required, the teacher must rewrite the question and its answer/rubric to include needed information. References to missing resources are rejected. Semantic checks do not prove mathematical correctness; teachers should review the paper and marking before use.

Browser and PDF graphs use the same layout calculations. Output uses white backgrounds, black outlines, readable ticks and labels, real arrowheads and outline bars. Scatter points are not connected. Short visual questions stay together across PDF page breaks; long content can flow. The teacher marking scheme includes the same visual, and AI marking receives the underlying specification and existing stimuli.

## Claude configuration

Existing provider selection stays unchanged. To use the optional Anthropic adapter, set:

```dotenv
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-server-side-key
ANTHROPIC_MODEL=claude-sonnet-5
```

The adapter uses Anthropic's Messages API and `output_config.format` for staged question and marking generation, following the [structured-output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Server validators enforce constraints omitted from the provider schema. Requests use the existing abort deadlines; refusals, truncation and empty responses fail safely. Regeneration uses the existing JSON-with-validation-and-retry workflow.

Tests cover unsafe input, ranges, all visual families, shared geometry, save/reload/removal, targeted regeneration, marking context, mocked Anthropic requests, and browser/PDF output with pagination. Run `npm run lint`, `npm run typecheck`, and `npm run test:nonintegration`.
