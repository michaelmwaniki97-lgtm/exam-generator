import { graphLayout, arrowHead } from "@/lib/assessment/visual-layout";
import { visualStimulus, type QuestionVisual } from "@/lib/assessment/question-visual";
import type {
  DiagramPrimitive,
  DiagramStimulus,
  GraphStimulus,
  RichStimulus,
} from "@/lib/assessment/rich-content";

function Graph({ stimulus }: { stimulus: GraphStimulus }) {
  return <Diagram stimulus={graphLayout(stimulus)} />;
}

function primitive(primitive: DiagramPrimitive, index: number) {
  if (primitive.type === "line" || primitive.type === "arrow") return <g key={index}><line x1={primitive.x1} y1={primitive.y1} x2={primitive.x2} y2={primitive.y2} stroke="currentColor" strokeWidth="1"  />{primitive.type === "arrow" && <polygon points={arrowHead(primitive.x1, primitive.y1, primitive.x2, primitive.y2).map(p => `${p.x},${p.y}`).join(" ")} fill="black" />}{primitive.label && <text x={(primitive.x1+primitive.x2)/2} y={(primitive.y1+primitive.y2)/2-5} fontSize="12">{primitive.label}</text>}</g>;
  if (primitive.type === "circle") return <g key={index}><circle cx={primitive.cx} cy={primitive.cy} r={primitive.r} fill="none" stroke="currentColor" strokeWidth="1" />{primitive.label && <text x={primitive.cx} y={primitive.cy} textAnchor="middle" fontSize="12">{primitive.label}</text>}</g>;
  if (primitive.type === "rectangle") return <g key={index}><rect x={primitive.x} y={primitive.y} width={primitive.width} height={primitive.height} fill="none" stroke="currentColor" strokeWidth="1" />{primitive.label && <text x={primitive.x+primitive.width/2} y={primitive.y+primitive.height/2} textAnchor="middle" fontSize="12">{primitive.label}</text>}</g>;
  if (primitive.type === "polygon") return <g key={index}><polygon points={primitive.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="1" />{primitive.label && <text x={primitive.points[0].x} y={primitive.points[0].y-5} fontSize="12">{primitive.label}</text>}</g>;
  if (primitive.type === "label") return <text key={index} x={primitive.x} y={primitive.y} fontSize="12">{primitive.text}</text>;
  return null;
}

function Diagram({ stimulus }: { stimulus: DiagramStimulus }) {
  return <figure aria-label={stimulus.title ?? "Question diagram"} className="overflow-x-auto">
    <svg role="img" viewBox={`0 0 ${stimulus.width} ${stimulus.height}`} className="w-full max-w-[540px] bg-white text-black" aria-labelledby={`${stimulus.id}-title`}>
      <title id={`${stimulus.id}-title`}>{stimulus.title ?? stimulus.caption ?? "Question diagram"}</title>
      {stimulus.primitives.map(primitive)}
    </svg>
    {stimulus.caption && <figcaption className="text-xs text-black">{stimulus.caption}</figcaption>}
  </figure>;
}

export function RichStimuli({ stimuli: legacy = [], visual }: { stimuli?: RichStimulus[]; visual?: QuestionVisual | null }) {
  const stimuli = visual ? [...legacy, visualStimulus(visual)] : legacy;
  if (!stimuli.length) return null;
  return <div className="mt-3 grid gap-3">
    {stimuli.map((stimulus) => <div key={stimulus.id} className="border border-black bg-white p-3 text-black" role={stimulus.id === "question-visual" ? "img" : undefined} aria-label={stimulus.id === "question-visual" ? visual?.altText ?? "Question visual" : undefined}>
      {stimulus.title && <h4 className="text-sm font-bold text-black">{stimulus.title}</h4>}
      {stimulus.instructions && <p className="mt-1 text-xs text-black">{stimulus.instructions}</p>}
      {(stimulus.type === "passage" || stimulus.type === "extract") && <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-black">{stimulus.content}</div>}
      {stimulus.type === "table" && <div className="mt-2 overflow-x-auto"><table className="w-full border-collapse text-sm"><caption className="mb-2 text-left text-xs text-black">{stimulus.caption}</caption><thead><tr>{stimulus.columns.map((column, index) => <th key={index} scope="col" className="border border-black px-3 py-2 text-left">{column}</th>)}</tr></thead><tbody>{stimulus.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border border-black px-3 py-2">{cell}</td>)}</tr>)}</tbody></table></div>}
      {stimulus.type === "dataset" && <div className="mt-2 overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr><th className="border border-black px-3 py-2 text-left" scope="col">Label</th>{stimulus.series.map((series) => <th key={series.name} scope="col" className="border border-black px-3 py-2 text-left">{series.name} ({series.unit})</th>)}</tr></thead><tbody>{stimulus.labels.map((label, index) => <tr key={index}><th scope="row" className="border border-black px-3 py-2 text-left">{label}</th>{stimulus.series.map((series) => <td key={series.name} className="border border-black px-3 py-2 tabular-nums">{series.values[index]}</td>)}</tr>)}</tbody></table></div>}
      {stimulus.type === "graph" && <Graph stimulus={stimulus} />}
      {stimulus.type === "diagram" && <Diagram stimulus={stimulus} />}
    </div>)}
  </div>;
}
