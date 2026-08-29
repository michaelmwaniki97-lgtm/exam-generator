import type {
  DiagramPrimitive,
  DiagramStimulus,
  GraphStimulus,
  RichStimulus,
} from "@/lib/assessment/rich-content";

function Graph({ stimulus }: { stimulus: GraphStimulus }) {
  const width = 640; const height = 320; const pad = 48;
  const x = (value: number) => pad + ((value - stimulus.xAxis.min) / (stimulus.xAxis.max - stimulus.xAxis.min)) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - stimulus.yAxis.min) / (stimulus.yAxis.max - stimulus.yAxis.min)) * (height - pad * 2);
  const colors = ["#1d4ed8", "#b91c1c", "#047857", "#7e22ce"];
  return <figure aria-label={stimulus.title ?? "Question graph"} className="overflow-x-auto">
    <svg role="img" viewBox={`0 0 ${width} ${height}`} className="min-w-[32rem] max-w-full" aria-labelledby={`${stimulus.id}-title`}>
      <title id={`${stimulus.id}-title`}>{stimulus.title ?? "Question graph"}</title>
      <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="currentColor" />
      <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke="currentColor" />
      <text x={pad} y={height-pad+18} textAnchor="middle" fontSize="11">{stimulus.xAxis.min}</text>
      <text x={width-pad} y={height-pad+18} textAnchor="middle" fontSize="11">{stimulus.xAxis.max}</text>
      <text x={pad-8} y={height-pad} textAnchor="end" fontSize="11">{stimulus.yAxis.min}</text>
      <text x={pad-8} y={pad+4} textAnchor="end" fontSize="11">{stimulus.yAxis.max}</text>
      <text x={width/2} y={height-8} textAnchor="middle" fontSize="13">{stimulus.xAxis.label} ({stimulus.xAxis.unit})</text>
      <text x="14" y={height/2} textAnchor="middle" fontSize="13" transform={`rotate(-90 14 ${height/2})`}>{stimulus.yAxis.label} ({stimulus.yAxis.unit})</text>
      {stimulus.series.map((series, index) => {
        const points = series.points.map((point) => `${x(point.x)},${y(point.y)}`).join(" ");
        return <g key={series.name}>
          {stimulus.graphType !== "bar" && <polyline points={points} fill="none" stroke={colors[index]} strokeWidth="2" />}
          {series.points.map((point, pointIndex) => stimulus.graphType === "bar"
            ? <g key={pointIndex}><rect x={x(point.x)-5} y={y(point.y)} width="10" height={height-pad-y(point.y)} fill={colors[index]} /><text x={x(point.x)} y={y(point.y)-5} textAnchor="middle" fontSize="10">{point.y}</text></g>
            : <g key={pointIndex}><circle cx={x(point.x)} cy={y(point.y)} r="4" fill={colors[index]} /><text x={x(point.x)+6} y={y(point.y)-6} fontSize="10">{point.x}, {point.y}</text></g>)}
        </g>;
      })}
    </svg>
    <figcaption className="text-xs text-foreground/65">{stimulus.series.map((series) => series.name).join(" · ")}</figcaption>
  </figure>;
}

function primitive(primitive: DiagramPrimitive, index: number) {
  if (primitive.type === "line" || primitive.type === "arrow") return <g key={index}><line x1={primitive.x1} y1={primitive.y1} x2={primitive.x2} y2={primitive.y2} stroke="currentColor" strokeWidth="2" markerEnd={primitive.type === "arrow" ? "url(#arrowhead)" : undefined} />{primitive.label && <text x={(primitive.x1+primitive.x2)/2} y={(primitive.y1+primitive.y2)/2-5} fontSize="14">{primitive.label}</text>}</g>;
  if (primitive.type === "circle") return <g key={index}><circle cx={primitive.cx} cy={primitive.cy} r={primitive.r} fill="none" stroke="currentColor" strokeWidth="2" />{primitive.label && <text x={primitive.cx} y={primitive.cy} textAnchor="middle" fontSize="14">{primitive.label}</text>}</g>;
  if (primitive.type === "rectangle") return <g key={index}><rect x={primitive.x} y={primitive.y} width={primitive.width} height={primitive.height} fill="none" stroke="currentColor" strokeWidth="2" />{primitive.label && <text x={primitive.x+primitive.width/2} y={primitive.y+primitive.height/2} textAnchor="middle" fontSize="14">{primitive.label}</text>}</g>;
  if (primitive.type === "polygon") return <g key={index}><polygon points={primitive.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />{primitive.label && <text x={primitive.points[0].x} y={primitive.points[0].y-5} fontSize="14">{primitive.label}</text>}</g>;
  if (primitive.type === "label") return <text key={index} x={primitive.x} y={primitive.y} fontSize="14">{primitive.text}</text>;
  return null;
}

function Diagram({ stimulus }: { stimulus: DiagramStimulus }) {
  return <figure aria-label={stimulus.title ?? "Question diagram"} className="overflow-x-auto">
    <svg role="img" viewBox={`0 0 ${stimulus.width} ${stimulus.height}`} className="min-w-[24rem] max-w-full" aria-labelledby={`${stimulus.id}-title`}>
      <title id={`${stimulus.id}-title`}>{stimulus.title ?? stimulus.caption ?? "Question diagram"}</title>
      <defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="currentColor" /></marker></defs>
      {stimulus.primitives.map(primitive)}
    </svg>
    {stimulus.caption && <figcaption className="text-xs text-foreground/65">{stimulus.caption}</figcaption>}
  </figure>;
}

export function RichStimuli({ stimuli = [] }: { stimuli?: RichStimulus[] }) {
  if (!stimuli.length) return null;
  return <div className="mt-3 grid gap-3">
    {stimuli.map((stimulus) => <div key={stimulus.id} className="rounded-lg border border-border bg-background/50 p-4">
      {stimulus.title && <h4 className="text-sm font-bold text-foreground">{stimulus.title}</h4>}
      {stimulus.instructions && <p className="mt-1 text-xs text-foreground/65">{stimulus.instructions}</p>}
      {(stimulus.type === "passage" || stimulus.type === "extract") && <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{stimulus.content}</div>}
      {stimulus.type === "table" && <div className="mt-2 overflow-x-auto"><table className="w-full border-collapse text-sm"><caption className="mb-2 text-left text-xs text-foreground/65">{stimulus.caption}</caption><thead><tr>{stimulus.columns.map((column, index) => <th key={index} scope="col" className="border border-border px-3 py-2 text-left">{column}</th>)}</tr></thead><tbody>{stimulus.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border border-border px-3 py-2">{cell}</td>)}</tr>)}</tbody></table></div>}
      {stimulus.type === "dataset" && <div className="mt-2 overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr><th className="border border-border px-3 py-2 text-left" scope="col">Label</th>{stimulus.series.map((series) => <th key={series.name} scope="col" className="border border-border px-3 py-2 text-left">{series.name} ({series.unit})</th>)}</tr></thead><tbody>{stimulus.labels.map((label, index) => <tr key={index}><th scope="row" className="border border-border px-3 py-2 text-left">{label}</th>{stimulus.series.map((series) => <td key={series.name} className="border border-border px-3 py-2 tabular-nums">{series.values[index]}</td>)}</tr>)}</tbody></table></div>}
      {stimulus.type === "graph" && <Graph stimulus={stimulus} />}
      {stimulus.type === "diagram" && <Diagram stimulus={stimulus} />}
    </div>)}
  </div>;
}
