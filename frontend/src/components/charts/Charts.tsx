import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Units } from '../../types'
import { kgToLb, shortDate } from '../../utils/format'

const AXIS = { stroke: '#6B756D', fontSize: 11, tickLine: false, axisLine: false } as const
const GRID = <CartesianGrid stroke="#ffffff" strokeOpacity={0.05} vertical={false} />

function Tip({ active, payload, label, unit, fmt }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-ink-850/95 px-3 py-2 text-xs shadow-pop backdrop-blur">
      <p className="mb-1 text-fg-dim">{fmt ? fmt(label) : label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 font-medium text-fg">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill || p.stroke }} />
          {p.name}: <span className="tabular-nums">{typeof p.value === 'number' ? Math.round(p.value * 10) / 10 : p.value}{unit}</span>
        </p>
      ))}
    </div>
  )
}

/** Evenly spaced, round tick values covering [lo, hi] (avoids uneven labels like 86, 81, 78, 75). */
function niceTicks(lo: number, hi: number, count = 4) {
  const span = Math.max(hi - lo, 1e-6)
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(x => x >= raw) ?? raw
  const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(+v.toFixed(2))
  return { ticks, domain: [start, end] as [number, number] }
}

export function WeightChart({ data, target, units, height = 240 }: { data: { date: string; weight_kg: number }[]; target?: number; units: Units; height?: number }) {
  const conv = (v: number) => (units === 'imperial' ? +kgToLb(v).toFixed(1) : v)
  const rows = data.map(d => ({ date: d.date, weight: conv(d.weight_kg) }))
  const vals = rows.map(r => r.weight).concat(target ? [conv(target)] : [])
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1)
  const u = units === 'imperial' ? ' lb' : ' kg'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C6F36B" stopOpacity={0.35} /><stop offset="1" stopColor="#C6F36B" stopOpacity={0} /></linearGradient></defs>
        {GRID}
        <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} minTickGap={28} />
        <YAxis {...AXIS} domain={niceTicks(lo, hi).domain} ticks={niceTicks(lo, hi).ticks} width={44} />
        <Tooltip content={<Tip unit={u} fmt={shortDate} />} cursor={{ stroke: '#C6F36B', strokeOpacity: 0.3 }} />
        {target && <ReferenceLine y={conv(target)} stroke="#49B675" strokeDasharray="5 5" label={{ value: 'Target', fill: '#49B675', fontSize: 11, position: 'insideTopRight' }} />}
        <Area type="monotone" dataKey="weight" name="Weight" stroke="#C6F36B" strokeWidth={2.2} fill="url(#wg)" dot={false} activeDot={{ r: 4, fill: '#C6F36B', stroke: '#0B0D0C', strokeWidth: 2 }} animationDuration={900} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function CaloriesChart({ data, target, height = 220 }: { data: { date: string; calories: number }[]; target: number; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="calOk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#64C98C" /><stop offset="1" stopColor="#3A9560" stopOpacity={0.7} /></linearGradient>
          <linearGradient id="calHi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F5C877" /><stop offset="1" stopColor="#F2B85B" stopOpacity={0.6} /></linearGradient>
        </defs>
        {GRID}
        <XAxis dataKey="date" {...AXIS} tickFormatter={d => new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'narrow' })} />
        <YAxis {...AXIS} width={40} />
        <Tooltip content={<Tip unit=" kcal" fmt={shortDate} />} cursor={{ fill: '#ffffff', fillOpacity: 0.03 }} />
        <ReferenceLine y={target} stroke="#C6F36B" strokeOpacity={0.6} strokeDasharray="4 4" />
        <Bar dataKey="calories" name="Calories" radius={[6, 6, 2, 2]} maxBarSize={26} animationDuration={900}>
          {data.map(d => <Cell key={d.date} fill={d.calories === 0 ? '#29312B' : d.calories > target * 1.1 ? 'url(#calHi)' : 'url(#calOk)'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ProteinChart({ data, target, height = 200 }: { data: { date: string; protein_g: number; entries?: number }[]; target: number; height?: number }) {
  // days with nothing logged are gaps, not zero intake
  const rows = data.map(d => ({ ...d, protein_g: d.entries === 0 ? null : d.protein_g }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} minTickGap={24} />
        <YAxis {...AXIS} width={40} />
        <Tooltip content={<Tip unit=" g" fmt={shortDate} />} />
        <ReferenceLine y={target} stroke="#C6F36B" strokeOpacity={0.5} strokeDasharray="4 4" />
        <Line type="monotone" dataKey="protein_g" name="Protein" stroke="#7CC4F2" strokeWidth={2.2} dot={{ r: 2.5, fill: '#7CC4F2' }} connectNulls={false} animationDuration={900} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ActivityChart({ data, height = 200, dataKey = 'workouts', xKey = 'day' }: { data: any[]; height?: number; dataKey?: string; xKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
        <defs><linearGradient id="actOn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D4F78F" /><stop offset="1" stopColor="#A9D84F" stopOpacity={0.75} /></linearGradient></defs>
        {GRID}
        <XAxis dataKey={xKey} {...AXIS} tickFormatter={xKey === 'week_start' ? shortDate : undefined} />
        <YAxis {...AXIS} allowDecimals={false} width={36} domain={[0, Math.max(2, ...data.map(d => Number(d[dataKey]) || 0))]}
          ticks={Array.from({ length: Math.max(2, ...data.map(d => Number(d[dataKey]) || 0)) + 1 }, (_, i) => i)} />
        <Tooltip content={<Tip fmt={xKey === 'week_start' ? (l: string) => `Week of ${shortDate(l)}` : undefined} />} cursor={{ fill: '#ffffff', fillOpacity: 0.03 }} />
        <Bar dataKey={dataKey} name="Workouts" radius={[6, 6, 2, 2]} maxBarSize={30} animationDuration={900}>
          {data.map((d, i) => <Cell key={i} fill={d[dataKey] > 0 ? 'url(#actOn)' : '#29312B'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MacroDonut({ protein, carbs, fat, size = 150, calories }: { protein: number; carbs: number; fat: number; size?: number; calories?: number }) {
  const data = [{ name: 'Protein', value: protein * 4, c: '#C6F36B' }, { name: 'Carbs', value: carbs * 4, c: '#7CC4F2' }, { name: 'Fat', value: fat * 9, c: '#F2B85B' }]
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div style={{ width: size, height: size }} className="relative">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={total ? data : [{ name: 'Empty', value: 1, c: '#29312B' }]} dataKey="value" innerRadius="70%" outerRadius="100%" paddingAngle={total ? 3 : 0} stroke="none" animationDuration={900}>
            {(total ? data : [{ c: '#29312B' }]).map((d: any, i) => <Cell key={i} fill={d.c} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><p className="font-display text-xl font-bold tabular-nums">{Math.round(calories ?? total)}</p><p className="text-[10px] uppercase tracking-wider text-fg-dim">kcal</p></div>
    </div>
  )
}

export function MeasureChart({ data, keys, height = 220 }: { data: any[]; keys: [string, string, string][]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="recorded_on" {...AXIS} tickFormatter={shortDate} minTickGap={24} />
        <YAxis {...AXIS} width={48} domain={['auto', 'auto']} allowDecimals={false} />
        <Legend iconType="plainline" iconSize={14} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Tooltip content={<Tip unit=" cm" fmt={shortDate} />} />
        {keys.map(([k, n, c]) => <Line key={k} type="monotone" dataKey={k} name={n} stroke={c} strokeWidth={2} dot={{ r: 2.5 }} connectNulls animationDuration={900} />)}
      </LineChart>
    </ResponsiveContainer>
  )
}
