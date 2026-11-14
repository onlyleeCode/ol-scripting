/**
 * tou.ts 逻辑验证
 * 运行：npx tsx tou.test.mjs（或 Node 22.6+ 直接 node tou.test.mjs）
 */
import assert from "node:assert/strict"
import {
  PERIOD_RULES,
  TIERS,
  getChongqingNow,
  getPeriod,
  getNextChange,
  priceOf,
  parseTier,
  fmtDuration,
  minToHM,
  periodEndHM,
} from "./tou.ts"

let passed = 0
function ok(name, fn) {
  fn()
  passed++
  console.log("  ✓ " + name)
}

console.log("1) 时段边界（12 个关键分钟）")
const boundaryCases = [
  [0, "valley"], [479, "valley"],
  [480, "flat"], [659, "flat"],
  [660, "peak"], [1019, "peak"],
  [1020, "flat"], [1199, "flat"],
  [1200, "peak"], [1319, "peak"],
  [1320, "flat"], [1439, "flat"],
]
ok("边界分钟判定", () => {
  for (const [m, type] of boundaryCases) {
    const p = getPeriod(m)
    assert.ok(p, `minute ${m} 应有时段`)
    assert.equal(p.key, type, `minute ${m}`)
  }
})

ok("全天 1440 分钟逐分钟扫描", () => {
  const expect = (m) => {
    if (m < 480) return "valley"
    if (m < 660) return "flat"
    if (m < 1020) return "peak"
    if (m < 1200) return "flat"
    if (m < 1320) return "peak"
    return "flat"
  }
  for (let m = 0; m < 1440; m++) {
    assert.equal(getPeriod(m).key, expect(m), `minute ${m}`)
  }
})

ok("规则连续且覆盖全天", () => {
  let total = 0
  for (let i = 0; i < PERIOD_RULES.length; i++) {
    const r = PERIOD_RULES[i]
    total += r.to - r.from
    if (i > 0) assert.equal(r.from, PERIOD_RULES[i - 1].to)
  }
  assert.equal(total, 1440)
  assert.equal(PERIOD_RULES[0].from, 0)
  assert.equal(PERIOD_RULES[PERIOD_RULES.length - 1].to, 1440)
})

console.log("2) 电价（3 档 × 3 时段）")
ok("电价表", () => {
  const valley = getPeriod(0), flat = getPeriod(500), peak = getPeriod(700)
  const expected = [
    ["0.34", "0.52", "0.62"],
    ["0.39", "0.57", "0.67"],
    ["0.64", "0.82", "0.92"],
  ]
  for (let t = 0; t < 3; t++) {
    assert.equal(priceOf(t, valley), expected[t][0])
    assert.equal(priceOf(t, flat), expected[t][1])
    assert.equal(priceOf(t, peak), expected[t][2])
  }
})

console.log("3) 切换倒计时")
ok("关键时刻", () => {
  // 10:59:59 → 1 秒后 11:00 转峰
  let n = getNextChange(10 * 3600 + 59 * 60 + 59)
  assert.equal(n.remainingSeconds, 1)
  assert.equal(n.nextType, "peak")
  assert.equal(n.atSecond, 39600)
  // 23:59:59 → 1 秒后次日 00:00 转谷（跨午夜）
  n = getNextChange(86399)
  assert.equal(n.remainingSeconds, 1)
  assert.equal(n.nextType, "valley")
  assert.equal(n.atSecond, 86400)
  // 00:00:00 → 8 小时后 08:00 转平
  n = getNextChange(0)
  assert.equal(n.remainingSeconds, 28800)
  assert.equal(n.nextType, "flat")
  // 恰好 11:00:00 → 6 小时后 17:00 转平
  n = getNextChange(39600)
  assert.equal(n.remainingSeconds, 21600)
  assert.equal(n.nextType, "flat")
  assert.equal(n.atSecond, 61200)
  // 恰好 22:00:00 → 2 小时后次日 00:00 转谷
  n = getNextChange(79200)
  assert.equal(n.remainingSeconds, 7200)
  assert.equal(n.nextType, "valley")
})

console.log("4) 重庆时间（时区无关）")
ok("固定时刻换算 + 模拟 6 种设备时区", () => {
  const orig = Date.prototype.getTimezoneOffset
  // 2026-11-14 03:00 UTC = 重庆 11:00（峰段起点）
  const instant = new Date(Date.UTC(2026, 10, 14, 3, 0, 0))
  try {
    for (const off of [-720, -480, 0, 330, 480, 570]) {
      Date.prototype.getTimezoneOffset = () => off
      const r = getChongqingNow(instant)
      assert.equal(r.hour, 11, `offset ${off}`)
      assert.equal(r.minute, 0)
      assert.equal(r.minutesOfDay, 660)
      assert.equal(r.timeStr, "11:00:00")
      assert.equal(r.dateStr, "11月14日")
      assert.equal(getPeriod(r.minutesOfDay).key, "peak")
    }
  } finally {
    Date.prototype.getTimezoneOffset = orig
  }
})
ok("跨午夜日期正确", () => {
  const orig = Date.prototype.getTimezoneOffset
  try {
    // 2026-11-13 16:00 UTC = 重庆 11-14 00:00
    Date.prototype.getTimezoneOffset = () => 0
    const r = getChongqingNow(new Date(Date.UTC(2026, 10, 13, 16, 0, 0)))
    assert.equal(r.hour, 0)
    assert.equal(r.dateStr, "11月14日")
    assert.equal(r.weekday, "周六")
    assert.equal(getPeriod(r.minutesOfDay).key, "valley")
    // 2026-11-14 15:59:59 UTC = 重庆 23:59:59
    const r2 = getChongqingNow(new Date(Date.UTC(2026, 10, 14, 15, 59, 59)))
    assert.equal(r2.timeStr, "23:59:59")
    assert.equal(r2.secondsOfDay, 86399)
  } finally {
    Date.prototype.getTimezoneOffset = orig
  }
})

console.log("5) 小组件参数解析")
ok("parseTier", () => {
  assert.equal(parseTier(undefined), 0)
  assert.equal(parseTier(null), 0)
  assert.equal(parseTier(""), 0)
  assert.equal(parseTier("1"), 1)
  assert.equal(parseTier("2"), 2)
  assert.equal(parseTier('{"tier":2}'), 2)
  assert.equal(parseTier("第二档"), 1)
  assert.equal(parseTier("9"), 2)   // 越界钳制
  assert.equal(parseTier("-3"), 0)
  assert.equal(parseTier("abc"), 0)
})

console.log("6) 文案工具")
ok("fmtDuration / minToHM / periodEndHM", () => {
  assert.equal(fmtDuration(3661), "1 小时 1 分 1 秒")
  assert.equal(fmtDuration(61), "1 分 1 秒")
  assert.equal(fmtDuration(5), "5 秒")
  assert.equal(fmtDuration(0), "0 秒")
  assert.equal(minToHM(660), "11:00")
  assert.equal(minToHM(1440), "00:00")
  assert.equal(periodEndHM(getPeriod(1400)), "24:00")
  assert.equal(periodEndHM(getPeriod(0)), "08:00")
})

console.log(`\n全部通过：${passed} 组测试 ✔`)