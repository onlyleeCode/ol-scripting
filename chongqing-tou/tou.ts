/**
 * 重庆居民分时电价 · 纯逻辑模块
 *
 * 政策依据（重庆市发改委居民分时电价，自愿申请）：
 *   高峰 11:00–17:00、20:00–22:00，在档位基础电价上加 0.10 元/度
 *   低谷 00:00–08:00，在档位基础电价上减 0.18 元/度
 *   平段 08:00–11:00、17:00–20:00、22:00–24:00，执行档位基础电价
 *   档位基础电价：第一档 0.52 / 第二档 0.57 / 第三档 0.82 元/度
 *
 * 本文件不依赖 scripting API，App 视图与小组件共用，也可用 Node 直接测试。
 */

export type PeriodKey = "peak" | "flat" | "valley"

export interface PeriodRule {
  /** 起始分钟（含） */
  from: number
  /** 结束分钟（不含） */
  to: number
  type: PeriodKey
}

export interface PeriodMeta {
  glyph: string
  name: string
  /** 相对档位基础电价的浮动（元/度） */
  delta: number
  color: string
}

export interface PeriodInfo {
  key: PeriodKey
  glyph: string
  name: string
  delta: number
  color: string
  from: number
  to: number
}

export interface Tier {
  label: string
  base: number
}

export interface NextChange {
  remainingSeconds: number
  nextType: PeriodKey
  /** 切换时刻的“当日秒数”，86400 表示次日 00:00 */
  atSecond: number
}

export interface ChongqingNow {
  /** 原始输入时间，用于推算小组件刷新时刻 */
  date: Date
  hour: number
  minute: number
  second: number
  minutesOfDay: number
  secondsOfDay: number
  timeStr: string
  dateStr: string
  weekday: string
}

/** 时段规则：左闭右开，单位“当日分钟数” */
export const PERIOD_RULES: PeriodRule[] = [
  { from: 0, to: 480, type: "valley" },    // 00:00–08:00 谷
  { from: 480, to: 660, type: "flat" },    // 08:00–11:00 平
  { from: 660, to: 1020, type: "peak" },   // 11:00–17:00 峰
  { from: 1020, to: 1200, type: "flat" },  // 17:00–20:00 平
  { from: 1200, to: 1320, type: "peak" },  // 20:00–22:00 峰
  { from: 1320, to: 1440, type: "flat" },  // 22:00–24:00 平
]

export const PERIOD_META: Record<PeriodKey, PeriodMeta> = {
  peak: { glyph: "峰", name: "高峰时段", delta: 0.1, color: "#FF6B5E" },
  flat: { glyph: "平", name: "平段", delta: 0, color: "#FFC53D" },
  valley: { glyph: "谷", name: "低谷时段", delta: -0.18, color: "#3DDC97" },
}

export const TIERS: Tier[] = [
  { label: "第一档", base: 0.52 },
  { label: "第二档", base: 0.57 },
  { label: "第三档", base: 0.82 },
]

export function pad(n: number): string {
  return n < 10 ? "0" + n : String(n)
}

/**
 * 取重庆（北京时间 UTC+8）当前时间。
 * 绝对时刻 + 8 小时后按 UTC 字段读取，即为重庆墙上时间，
 * 与设备所在时区完全无关，也不依赖 Intl（小组件受限环境可用）。
 */
export function getChongqingNow(date: Date = new Date()): ChongqingNow {
  const shifted = new Date(date.getTime() + 8 * 3600000)
  const hour = shifted.getUTCHours()
  const minute = shifted.getUTCMinutes()
  const second = shifted.getUTCSeconds()
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"]
  return {
    date,
    hour,
    minute,
    second,
    minutesOfDay: hour * 60 + minute,
    secondsOfDay: hour * 3600 + minute * 60 + second,
    timeStr: pad(hour) + ":" + pad(minute) + ":" + pad(second),
    dateStr: shifted.getUTCMonth() + 1 + "月" + shifted.getUTCDate() + "日",
    weekday: "周" + weekdays[shifted.getUTCDay()],
  }
}

/** 按“当日分钟数”判定峰/平/谷，覆盖全天 1440 分钟 */
export function getPeriod(minutesOfDay: number): PeriodInfo | null {
  const m = ((minutesOfDay % 1440) + 1440) % 1440
  for (const rule of PERIOD_RULES) {
    if (m >= rule.from && m < rule.to) {
      const meta = PERIOD_META[rule.type]
      return {
        key: rule.type,
        glyph: meta.glyph,
        name: meta.name,
        delta: meta.delta,
        color: meta.color,
        from: rule.from,
        to: rule.to,
      }
    }
  }
  return null
}

/** 距下一次时段切换的秒数、切换后的时段与切换时刻 */
export function getNextChange(secondsOfDay: number): NextChange {
  const s = ((secondsOfDay % 86400) + 86400) % 86400
  const boundaries: number[] = PERIOD_RULES.map((r) => r.from * 60)
  boundaries.push(86400)
  boundaries.sort((a, b) => a - b)
  for (const b of boundaries) {
    if (b > s) {
      const startMin = (b / 60) % 1440
      const rule = PERIOD_RULES.find((r) => r.from === startMin)
      return {
        remainingSeconds: b - s,
        nextType: rule ? rule.type : "valley",
        atSecond: b,
      }
    }
  }
  return { remainingSeconds: 0, nextType: "valley", atSecond: 86400 }
}

export function clampTier(n: number): number {
  if (!isFinite(n)) return 0
  return Math.min(TIERS.length - 1, Math.max(0, Math.floor(n)))
}

/** 当前档位 + 当前时段的电价（元/度，保留两位小数） */
export function priceOf(tierIndex: number, period: PeriodInfo): string {
  const tier = TIERS[clampTier(tierIndex)]
  return (tier.base + period.delta).toFixed(2)
}

/**
 * 解析小组件参数（长按小组件 → 编辑时填写）。
 * 支持 "0"/"1"/"2"、"第一档" 等文本，或 JSON：{"tier":1}
 */
export function parseTier(param?: string | null): number {
  if (param == null) return 0
  const text = String(param).trim()
  if (text === "") return 0
  try {
    const obj = JSON.parse(text)
    if (typeof obj === "number") return clampTier(obj)
    if (obj && typeof obj.tier === "number") return clampTier(obj.tier)
  } catch (e) {
    // 不是 JSON，按普通文本继续解析
  }
  const n = parseInt(text, 10)
  if (!isNaN(n)) return clampTier(n)
  const idx = TIERS.findIndex((t) => t.label === text)
  return idx >= 0 ? idx : 0
}

/** 倒计时文案：x 小时 x 分 x 秒 */
export function fmtDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return h + " 小时 " + m + " 分 " + s + " 秒"
  if (m > 0) return m + " 分 " + s + " 秒"
  return s + " 秒"
}

/** 分钟数 → HH:MM（1440 归一为 00:00） */
export function minToHM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return pad(Math.floor(m / 60)) + ":" + pad(m % 60)
}

/** 时段结束时间文案：24:00 显示为 24:00 而非 00:00 */
export function periodEndHM(period: PeriodInfo): string {
  return period.to === 1440 ? "24:00" : minToHM(period.to)
}