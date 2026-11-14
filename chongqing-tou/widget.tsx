/**
 * 重庆居民分时电价 · 主屏幕小组件
 *
 * 小组件环境为一次性渲染：不能用 useState/useEffect，
 * 所有数据必须在 Widget.present 之前算好，present 之后不能再写代码。
 *
 * 时钟与倒计时使用 DateLabel / TimerIntervalLabel，
 * 由系统自动实时更新，无需脚本反复运行；
 * 并在“下一次时段切换时刻 + 3 秒”安排一次刷新，保证电价及时更新。
 *
 * 档位参数：长按小组件 → 编辑，参数填 0 / 1 / 2（或 {"tier":1}），默认第一档。
 */
import {
  VStack,
  HStack,
  Text,
  Widget,
  DateLabel,
  TimerIntervalLabel,
} from "scripting"
import {
  getChongqingNow,
  getPeriod,
  getNextChange,
  priceOf,
  minToHM,
  periodEndHM,
  parseTier,
  TIERS,
  PERIOD_META,
} from "./tou"

// ---- 在 present 之前准备好全部数据 ----
const now = getChongqingNow()
const period = getPeriod(now.minutesOfDay)!
const next = getNextChange(now.secondsOfDay)
const tier = parseTier(Widget.parameter)
const price = priceOf(tier, period)
const nextMeta = PERIOD_META[next.nextType]

const boundaryMs = now.date.getTime() + next.remainingSeconds * 1000
const reloadDate = new Date(boundaryMs + 3000)

const family = Widget.family
// 透明 / 模糊模式下背景必须完全透明
const plain = Widget.isTransparentMode || Widget.isBlurMode
const BG = plain ? "clear" : "#12161D"
const FG = "#FFFFFF"
const SUB = "#9AA4B2"

function Countdown(props: { size: number }) {
  return (
    <TimerIntervalLabel
      from={now.date.getTime()}
      to={boundaryMs}
      countsDown={true}
      showsHours={true}
      font={props.size}
      monospacedDigit
      foregroundStyle={FG}
    />
  )
}

/** 锁屏 / 待机圆形小组件：只保留最关键信息 */
function CircularWidget() {
  return (
    <VStack spacing={2}>
      <Text font={18} fontWeight="bold">
        {period.glyph}
      </Text>
      <Text font={12} monospacedDigit>
        {price}
      </Text>
    </VStack>
  )
}

/** 锁屏矩形小组件：一行展示 */
function RectangularWidget() {
  return (
    <HStack spacing={8}>
      <Text font={15} fontWeight="bold">
        {period.glyph}
      </Text>
      <Text font={13} monospacedDigit>
        {price} 元
      </Text>
      <Countdown size={12} />
    </HStack>
  )
}

/** 小尺寸：时段 + 电价 + 倒计时 */
function SmallWidget() {
  return (
    <VStack spacing={8} padding={14} background={BG}>
      <HStack spacing={6}>
        <Text font={17} fontWeight="bold" foregroundStyle={period.color}>
          {period.glyph}
        </Text>
        <DateLabel date={now.date} style="time" font={13} foregroundStyle={SUB} />
      </HStack>
      <HStack spacing={4} alignment="bottom">
        <Text
          font={30}
          fontWeight="bold"
          fontDesign="rounded"
          monospacedDigit
          foregroundStyle={period.color}
        >
          {price}
        </Text>
        <Text font={11} foregroundStyle={SUB}>
          元/度
        </Text>
      </HStack>
      <VStack spacing={2}>
        <Text font={10} foregroundStyle={SUB}>
          距切换
        </Text>
        <Countdown size={14} />
      </VStack>
    </VStack>
  )
}

/** 中 / 大尺寸：左侧时段信息，右侧时钟与电价 */
function WideWidget() {
  return (
    <HStack spacing={12} padding={16} background={BG}>
      <VStack alignment="leading" spacing={6} frame={{ maxWidth: Infinity }}>
        <HStack spacing={6}>
          <Text font={24} fontWeight="bold" foregroundStyle={period.color}>
            {period.glyph}
          </Text>
          <Text font={15} fontWeight="semibold" foregroundStyle="#E6EDF3">
            {period.name}
          </Text>
        </HStack>
        <Text font={11} foregroundStyle={SUB}>
          {minToHM(period.from)} – {periodEndHM(period)}
        </Text>
        <Text font={10} foregroundStyle={SUB}>
          距切换
        </Text>
        <Countdown size={18} />
        <Text font={10} foregroundStyle={SUB}>
          {minToHM(next.atSecond / 60)} 转{nextMeta.glyph}
        </Text>
      </VStack>
      <VStack alignment="trailing" spacing={6} frame={{ maxWidth: Infinity }}>
        <DateLabel
          date={now.date}
          style="time"
          font={20}
          fontWeight="bold"
          monospacedDigit
          foregroundStyle={FG}
        />
        <HStack spacing={4} alignment="bottom">
          <Text
            font={30}
            fontWeight="bold"
            fontDesign="rounded"
            monospacedDigit
            foregroundStyle={period.color}
          >
            {price}
          </Text>
          <Text font={11} foregroundStyle={SUB}>
            元/度
          </Text>
        </HStack>
        <Text font={10} foregroundStyle={SUB}>
          {TIERS[tier].label} · {now.dateStr}
        </Text>
      </VStack>
    </HStack>
  )
}

function WidgetView() {
  if (family === "accessoryCircular") return <CircularWidget />
  if (family === "accessoryRectangular") return <RectangularWidget />
  if (family === "systemSmall") return <SmallWidget />
  return <WideWidget />
}

// present 之后上下文即被销毁，这必须是最后一条语句
Widget.present(<WidgetView />, {
  reloadPolicy: { policy: "after", date: reloadDate },
})