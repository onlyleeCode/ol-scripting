/**
 * 重庆居民分时电价 · App 内视图
 *
 * 在 Scripting 中运行本脚本：全屏深色卡片，实时时钟、峰/平/谷判定、
 * 当前档位电价（可切换三档）、距下次切换倒计时。
 * 逻辑与 HTML 版完全一致，见 ./tou.ts。
 */
import {
  Navigation,
  Script,
  VStack,
  HStack,
  Text,
  Button,
  useState,
  useEffect,
} from "scripting"
import {
  getChongqingNow,
  getPeriod,
  getNextChange,
  priceOf,
  fmtDuration,
  minToHM,
  periodEndHM,
  TIERS,
  PERIOD_META,
} from "./tou"

const BG = "#0F141A"
const FG = "#FFFFFF"
const SUB = "#8A94A6"
const DIM = "#5C6672"

function App() {
  const [now, setNow] = useState(getChongqingNow())
  const [tier, setTier] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(getChongqingNow())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const period = getPeriod(now.minutesOfDay)!
  const next = getNextChange(now.secondsOfDay)
  const price = priceOf(tier, period)
  const deltaText = (period.delta >= 0 ? "+" : "") + period.delta.toFixed(2)

  function tierButton(i: number) {
    return (
      <Button
        title={TIERS[i].label}
        buttonStyle={i === tier ? "borderedProminent" : "bordered"}
        action={() => setTier(i)}
      />
    )
  }

  return (
    <VStack
      spacing={22}
      padding={28}
      background={BG}
      frame={{ maxWidth: Infinity, maxHeight: Infinity }}
    >
      {/* 日期 + 实时时钟 */}
      <VStack spacing={4}>
        <Text font={13} foregroundStyle={SUB}>
          {now.dateStr} {now.weekday} · 重庆
        </Text>
        <Text
          font={54}
          fontWeight="bold"
          fontDesign="rounded"
          monospacedDigit
          foregroundStyle={FG}
        >
          {now.timeStr}
        </Text>
      </VStack>

      {/* 峰 / 平 / 谷 */}
      <HStack spacing={12}>
        <Text font={30} fontWeight="bold" foregroundStyle={period.color}>
          {period.glyph}
        </Text>
        <VStack alignment="leading" spacing={2}>
          <Text font={17} fontWeight="semibold" foregroundStyle="#E6EDF3">
            {period.name}
          </Text>
          <Text font={12} foregroundStyle={SUB}>
            {minToHM(period.from)} – {periodEndHM(period)}
          </Text>
        </VStack>
      </HStack>

      {/* 当前电价 */}
      <VStack spacing={6}>
        <HStack spacing={6} alignment="bottom">
          <Text
            font={42}
            fontWeight="bold"
            fontDesign="rounded"
            monospacedDigit
            foregroundStyle={period.color}
          >
            {price}
          </Text>
          <Text font={14} foregroundStyle={SUB}>
            元/度
          </Text>
        </HStack>
        <Text font={12} foregroundStyle={SUB}>
          {TIERS[tier].label} · 较基础电价 {deltaText} 元
        </Text>
      </VStack>

      {/* 档位切换 */}
      <HStack spacing={10} tint={period.color}>
        {tierButton(0)}
        {tierButton(1)}
        {tierButton(2)}
      </HStack>

      {/* 倒计时 */}
      <VStack spacing={4}>
        <Text font={12} foregroundStyle={SUB}>
          距下次切换
        </Text>
        <Text font={22} fontWeight="bold" monospacedDigit foregroundStyle={FG}>
          {fmtDuration(next.remainingSeconds)}
        </Text>
        <Text font={12} foregroundStyle={SUB}>
          {minToHM(next.atSecond / 60)} 进入{PERIOD_META[next.nextType].name}
        </Text>
      </VStack>

      <Text font={11} foregroundStyle={DIM}>
        居民分时电价 · 需“一户一表”居民自愿申请
      </Text>
    </VStack>
  )
}

Navigation.present({ element: <App /> }).then(() => {
  Script.exit()
})