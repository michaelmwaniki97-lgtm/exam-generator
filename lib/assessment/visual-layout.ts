import type { DiagramPrimitive, DiagramStimulus, GraphStimulus } from "./rich-content.ts";

export function arrowHead(x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return [{ x: x2, y: y2 }, ...[-0.45, 0.45].map(offset => ({ x: x2 - 8 * Math.cos(angle + offset), y: y2 - 8 * Math.sin(angle + offset) }))];
}

/** One geometry calculation for browser SVG and PDF vectors. No model-supplied markup. */
export function graphLayout(item: GraphStimulus): DiagramStimulus {
  const grid = String(item.graphType) === "coordinate";
  const width = 540, height = 330;
  const xr = item.xAxis.max - item.xAxis.min, yr = item.yAxis.max - item.yAxis.min;
  const scale = Math.min(420 / xr, 220 / yr);
  const plotWidth = grid ? xr * scale : 420, plotHeight = grid ? yr * scale : 220;
  const left = 75 + (420 - plotWidth) / 2, top = 38 + (220 - plotHeight) / 2;
  const x = (value: number) => left + (value - item.xAxis.min) / xr * plotWidth;
  const y = (value: number) => top + plotHeight - (value - item.yAxis.min) / yr * plotHeight;
  const primitives: DiagramPrimitive[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number) => primitives.push({ type: "line", x1, y1, x2, y2 });
  const label = (x: number, y: number, text: string) => primitives.push({ type: "label", x, y, text });
  const niceStep = (range: number) => {
    const power = 10 ** Math.floor(Math.log10(range / 10));
    return [1, 2, 5, 10].find(n => n * power >= range / 10)! * power;
  };
  const commonStep = niceStep(Math.max(xr, yr));
  const xStep = grid ? commonStep : niceStep(xr), yStep = grid ? commonStep : niceStep(yr);
  for (let i = Math.ceil(item.xAxis.min / xStep); i <= Math.floor(item.xAxis.max / xStep); i++) {
    const xv = i * xStep;
    line(x(xv), top + plotHeight + 5, x(xv), top);
    label(x(xv) - 6, top + plotHeight + 20, String(Number(xv.toPrecision(6))));
  }
  for (let i = Math.ceil(item.yAxis.min / yStep); i <= Math.floor(item.yAxis.max / yStep); i++) {
    const yv = i * yStep;
    line(left - 5, y(yv), left + plotWidth, y(yv));
    label(left - 48, y(yv) + 4, String(Number(yv.toPrecision(6))));
  }
  line(left, top + plotHeight, left + plotWidth, top + plotHeight);
  line(left, top, left, top + plotHeight);
  if (item.xAxis.min < 0 && item.xAxis.max > 0) line(x(0), top, x(0), top + plotHeight);
  if (item.yAxis.min < 0 && item.yAxis.max > 0) line(left, y(0), left + plotWidth, y(0));
  const axisTitle = (axis: GraphStimulus["xAxis"]) => `${axis.label}${axis.unit === "1" ? "" : ` (${axis.unit})`}`;
  label(75, 18, axisTitle(item.yAxis));
  label(100, 308, axisTitle(item.xAxis));
  item.series.forEach((series, index) => {
    const points = series.points;
    if (item.graphType === "line") for (let i = 1; i < points.length; i++) line(x(points[i - 1].x), y(points[i - 1].y), x(points[i].x), y(points[i].y));
    const distinct = [...new Set(points.map(p => x(p.x)))].sort((a,b) => a-b);
    const gap = distinct.length > 1 ? Math.min(...distinct.slice(1).map((v,i) => v-distinct[i])) : 40;
    const barWidth = Math.max(1, Math.min(24, gap * 0.65) / item.series.length);
    for (const point of points) {
      if (item.graphType === "bar") {
        const baseline = y(Math.min(item.yAxis.max, Math.max(item.yAxis.min, 0)));
        if (point.y !== 0) primitives.push({ type: "rectangle", x: x(point.x) - barWidth * item.series.length / 2 + index * barWidth, y: Math.min(y(point.y), baseline), width: barWidth, height: Math.abs(y(point.y) - baseline) });
      } else {
        primitives.push({ type: "circle", cx: x(point.x), cy: y(point.y), r: 3 + index });
      }
      if (item.series.length > 1) label(x(point.x) + 6, y(point.y) - 6, String(index + 1));
    }
  });
  return { id: item.id, type: "diagram", width, height, primitives, caption: item.series.length > 1 ? item.series.map((s,i) => `${i+1}. ${s.name}`).join("; ") : undefined };
}
