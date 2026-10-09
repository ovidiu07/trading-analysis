# Five Sessions Model — complete strategy and implementation notes

The strategy uses independent Europe and New York state objects to retain actual completed same-type session highs, freeze the evaluation-time bias, and manage FVG clusters and trade allowances. A single global order/position reservation prevents simultaneous strategy positions. All decisions use completed chart candles.

This replaces the previous 4H/1H trend-continuation model. Its original source, guide, and validation record are preserved under `archive/`. The old snapshot exports and screenshots describe that archived version, not this model.

## Complete Pine Script v6 source

```pine
// This Pine Script® code is subject to the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
//@version=6
strategy("Five Sessions Model", overlay=true, pyramiding=0,
     initial_capital=10000, currency=currency.USD, default_qty_type=strategy.fixed, default_qty_value=0.1,
     commission_type=strategy.commission.percent, commission_value=0, slippage=0,
     margin_long=100, margin_short=100, calc_on_every_tick=false, calc_on_order_fills=false,
     process_orders_on_close=false, use_bar_magnifier=true, max_bars_back=5000,
     max_lines_count=300, max_labels_count=300, max_boxes_count=100)

// Confirmed chart bars only. Orders become eligible on the NEXT tick, never on
// the FVG's own historical range. Attached brackets also protect same-bar fills.
// Historical fills depend on the emulator's intrabar path / Bar Magnifier data.
// Cancellation runs at bar close: a fill on the deadline bar can precede cancel;
// across a feed/session gap Pine cannot cancel an order while no script runs.
// Leave the three recalculation / on-close settings above unchanged for this model.
string GC = "FIVE SESSIONS CONTEXT"
string GE = "EUROPE SESSION"
string GN = "NEW YORK SESSION"
string GX = "EXECUTION"
string GT = "TIMEFRAME"
string GV = "VISUALS"
int sessionLookback = input.int(5, "Session lookback", minval=1, maxval=250, group=GC)
string sessionTimezone = input.string("Europe/Bucharest", "Timezone (IANA)", group=GC)
string contextTimeframe = input.timeframe("60", "Context timeframe", group=GT,
     tooltip="Session-clipped context buckets are built from confirmed chart bars. The maximum of their highs is the exact session high. This avoids full HTF candles leaking prices outside a partial-hour session. No security/lookahead request is needed.")
string executionTimeframe = input.timeframe("5", "Execution timeframe", group=GT,
     tooltip="Set the chart to this interval. Orders are disabled on a different interval or synthetic chart. Evaluation and session boundaries must align with chart-bar boundaries.")
bool enableEurope = input.bool(true, "Enable Europe", group=GE)
string europeReferenceSession = input.session("1000-1830", "Reference session", group=GE)
int europeBiasHour = input.int(10, "Bias evaluation hour", minval=0, maxval=23, group=GE, inline="EU")
int europeBiasMinute = input.int(15, "Minute", minval=0, maxval=59, group=GE, inline="EU")
int europeSetupSearchMinutes = input.int(120, "Setup search minutes", minval=1, maxval=1440, group=GE)
bool enableNewYork = input.bool(true, "Enable New York", group=GN)
string newYorkReferenceSession = input.session("1630-2300", "Reference session", group=GN)
int newYorkBiasHour = input.int(16, "Bias evaluation hour", minval=0, maxval=23, group=GN, inline="NY")
int newYorkBiasMinute = input.int(15, "Minute", minval=0, maxval=59, group=GN, inline="NY")
int newYorkSetupSearchMinutes = input.int(120, "Setup search minutes", minval=1, maxval=1440, group=GN)
float minimumFvgPercent = input.float(0.05, "Minimum FVG size %", minval=0, step=0.01, group=GX)
float entryDepthPercent = input.float(30, "Entry depth %", minval=0, maxval=100, step=1, group=GX)
int orderValidityMinutes = input.int(60, "Order validity minutes", minval=1, maxval=1440, group=GX)
float maxStopPoints = input.float(40, "Maximum stop distance (price points)", minval=0.00000001, group=GX)
float rewardRiskRatio = input.float(1.5, "Reward / risk", minval=0.01, step=0.1, group=GX)
int maximumTradesPerSession = input.int(2, "Maximum filled trades per session", minval=1, maxval=2, group=GX,
     tooltip="Trade 2 is permitted only after trade 1 exits through its SL bracket. Sizing is controlled independently in Strategy Properties (fixed units, cash, or % equity notional).")
bool showSessionHighs = input.bool(true, "Show current session highs", group=GV)
bool showReferenceHigh = input.bool(true, "Show reference highs", group=GV)
bool showFvgBoxes = input.bool(true, "Show FVG boxes", group=GV)
bool showEntry = input.bool(true, "Show Entry", group=GV)
bool showSL = input.bool(true, "Show SL", group=GV)
bool showTP = input.bool(true, "Show TP", group=GV)
bool showExpiration = input.bool(true, "Show pending expiration", group=GV)
bool showSessionBias = input.bool(true, "Show session bias", group=GV)
bool showTable = input.bool(true, "Show compact state table", group=GV)
bool debugMode = input.bool(false, "Debug information / Pine Logs", group=GV)
int retainedTradeDrawings = input.int(40, "Completed trades to draw", minval=0, maxval=80, group=GV)

int chartMs = int(timeframe.in_seconds() * 1000)
int contextMs = int(timeframe.in_seconds(contextTimeframe) * 1000)
bool executionChart = chart.is_standard and timeframe.isintraday and timeframe.in_seconds() == timeframe.in_seconds(executionTimeframe)
bool contextValid = contextMs >= chartMs and contextMs < 86400000
// Never let a user-edited minute deadline fall inside an execution candle.
bool deadlinesAligned = chartMs > 0 and (orderValidityMinutes * 60000) % chartMs == 0 and (not enableEurope or (europeSetupSearchMinutes * 60000) % chartMs == 0) and (not enableNewYork or (newYorkSetupSearchMinutes * 60000) % chartMs == 0)
bool nativeMode = executionChart and contextValid and deadlinesAligned

// Each session owns its history and cycle state; a global Plan reserves the
// single pending/open position. A session result is attributed by cycle ID,
// so a position held overnight cannot debit the following session's allowance.
type SessionState
    string tag
    array<float> highs
    int cycle = na
    int referenceStart = na
    int referenceEnd = na
    int evaluationTime = na
    int windowEnd = na
    float bucketHigh = na
    int bucket = na
    float committedHigh = na
    float currentHigh = na
    bool highStored = false
    bool completeHistory = true
    float lastStoredHigh = na
    int lastStoredEnd = na
    float referenceHigh = na
    float evaluationPrice = na
    int bias = 0
    bool evaluated = false
    int trades = 0
    string firstResult = "NONE"
    bool finished = false
    int lastExitBar = na
    int lastFvgBar = na
    float lower = na
    float upper = na
    float entry = na
    float stop = na
    float target = na
    float fvgPercent = na
    bool clusterConsumed = false
    string event = "Waiting"

type Plan
    int owner
    int cycle
    string orderId
    int activated
    int expires
    int side
    float entry
    float stop
    float target
    bool filled = false
    bool abnormalExit = false
    box zone = na
    line entryLine = na
    line stopLine = na
    line targetLine = na
    label entryLabel = na
    label stopLabel = na
    label targetLabel = na
    label expiryLabel = na

f_debug(SessionState s, string message) =>
    s.event := message
    if debugMode
        log.info(s.tag + " | " + str.format_time(time_close, "yyyy-MM-dd HH:mm", sessionTimezone) + " | " + message)

f_stamp(int dayOffset, int minuteOfDay, int nowTime) =>
    timestamp(sessionTimezone, year(nowTime, sessionTimezone), month(nowTime, sessionTimezone), dayofmonth(nowTime, sessionTimezone) + dayOffset, int(minuteOfDay / 60), minuteOfDay % 60)

// Overnight sessions: an evaluation before the overnight end belongs to the
// preceding start date. A pre-open evaluation (NY default) belongs to that day.
f_schedule(string hours, int evalHour, int evalMinute, int searchMinutes) =>
    int startMinute = int(str.tonumber(str.substring(hours, 0, 2))) * 60 + int(str.tonumber(str.substring(hours, 2, 4)))
    int endMinute = int(str.tonumber(str.substring(hours, 5, 7))) * 60 + int(str.tonumber(str.substring(hours, 7, 9)))
    int evalMinuteOfDay = evalHour * 60 + evalMinute
    bool overnight = endMinute <= startMinute
    int evalOffset = overnight and evalMinuteOfDay < endMinute ? 1 : 0
    int anchorMinute = math.min(startMinute, evalMinuteOfDay + evalOffset * 1440)
    int offset = time_close < f_stamp(0, anchorMinute, time_close) ? -1 : 0
    int start = f_stamp(offset, startMinute, time_close)
    int finish = f_stamp(offset + (overnight ? 1 : 0), endMinute, time_close)
    int evaluation = f_stamp(offset + evalOffset, evalMinuteOfDay, time_close)
    int anchor = math.min(start, evaluation)
    [anchor, start, finish, evaluation, math.min(finish, evaluation + searchMinutes * 60000)]

method clearCluster(SessionState s) =>
    s.lastFvgBar := na
    s.lower := na
    s.upper := na
    s.entry := na
    s.stop := na
    s.target := na
    s.fvgPercent := na
    s.clusterConsumed := false

method storeHigh(SessionState s) =>
    if not s.highStored and not na(s.currentHigh) and time_close >= s.referenceEnd
        if s.completeHistory
            array.push(s.highs, s.currentHigh)
            if array.size(s.highs) > sessionLookback
                array.shift(s.highs)
            s.lastStoredHigh := s.currentHigh
            s.lastStoredEnd := s.referenceEnd
            f_debug(s, "Stored session high " + str.tostring(s.currentHigh, format.mintick))
        else
            f_debug(s, "Incomplete/boundary-straddling first session excluded")
        s.highStored := true

method updateContext(SessionState s, string hours, int evalHour, int evalMinute, int searchMinutes) =>
    [cycle, start, finish, evaluation, windowEnd] = f_schedule(hours, evalHour, evalMinute, searchMinutes)
    // Flush the previous session even when the feed has no out-of-session bars.
    if na(s.cycle) or cycle != s.cycle
        s.storeHigh()
        s.cycle := cycle
        s.referenceStart := start
        s.referenceEnd := finish
        s.evaluationTime := evaluation
        s.windowEnd := windowEnd
        s.bucketHigh := na
        s.bucket := na
        s.committedHigh := na
        s.currentHigh := na
        s.highStored := false
        s.completeHistory := not barstate.isfirst or time <= start
        // Snapshot preceding sessions now. If evaluation is edited to a time
        // after this reference session ends, its newly stored high is excluded.
        s.referenceHigh := array.size(s.highs) >= sessionLookback ? array.get(s.highs, array.size(s.highs) - sessionLookback) : na
        s.evaluationPrice := na
        s.bias := 0
        s.evaluated := false
        s.trades := 0
        s.firstResult := "NONE"
        s.finished := false
        s.lastExitBar := na
        s.clearCluster()
        f_debug(s, "Cycle started " + str.format_time(cycle, "yyyy-MM-dd HH:mm", sessionTimezone))
    bool intersects = time < finish and time_close > start
    bool belongs = time >= start and time_close <= finish
    if intersects and not belongs
        s.completeHistory := false
        f_debug(s, "Reference boundary crosses a chart candle; session excluded")
    if belongs and not s.highStored
        int bucket = int(math.floor((time - start) / contextMs))
        if not na(s.bucket) and bucket != s.bucket
            s.committedHigh := na(s.committedHigh) ? s.bucketHigh : math.max(s.committedHigh, s.bucketHigh)
            s.bucketHigh := na
        s.bucket := bucket
        s.bucketHigh := na(s.bucketHigh) ? high : math.max(s.bucketHigh, high)
        s.currentHigh := na(s.committedHigh) ? s.bucketHigh : math.max(s.committedHigh, s.bucketHigh)
    // Evaluate BEFORE storing this cycle's high, even if an edited evaluation
    // coincides with the reference end. N completed preceding cycles are required.
    if not s.evaluated and time_close >= evaluation
        s.evaluated := true
        if time_close == evaluation
            s.evaluationPrice := close
            if not na(s.referenceHigh)
                s.bias := close > s.referenceHigh ? 1 : close < s.referenceHigh ? -1 : 0
            f_debug(s, "Bias price=" + str.tostring(close, format.mintick) + " reference=" + str.tostring(s.referenceHigh, format.mintick) + " side=" + str.tostring(s.bias))
        else
            f_debug(s, "Evaluation close missing; bias UNAVAILABLE")
    s.storeHigh()

method erase(Plan p) =>
    box.delete(p.zone)
    line.delete(p.entryLine)
    line.delete(p.stopLine)
    line.delete(p.targetLine)
    label.delete(p.entryLabel)
    label.delete(p.stopLabel)
    label.delete(p.targetLabel)
    label.delete(p.expiryLabel)

method extend(Plan p, int right) =>
    // One-bar trades remain visible; drawings use timestamps on every chart.
    int end = math.max(right, p.activated + chartMs)
    line.set_x2(p.entryLine, end)
    line.set_x2(p.stopLine, end)
    line.set_x2(p.targetLine, end)
    label.set_x(p.entryLabel, end)
    label.set_x(p.stopLabel, end)
    label.set_x(p.targetLabel, end)
    box.set_right(p.zone, end)

f_draw(Plan p, SessionState s) =>
    color sideColor = p.side == 1 ? color.teal : color.orange
    if showFvgBoxes
        p.zone := box.new(time[2], s.upper, p.expires, s.lower, xloc=xloc.bar_time, border_color=sideColor, bgcolor=color.new(sideColor, 88))
    if showEntry
        p.entryLine := line.new(p.activated, p.entry, p.expires, p.entry, xloc=xloc.bar_time, color=color.aqua)
        p.entryLabel := label.new(p.expires, p.entry, s.tag + " Entry " + str.tostring(p.entry, format.mintick), xloc=xloc.bar_time, style=label.style_label_left, color=color.blue, textcolor=color.white, size=size.tiny)
    if showSL
        p.stopLine := line.new(p.activated, p.stop, p.expires, p.stop, xloc=xloc.bar_time, color=color.red)
        p.stopLabel := label.new(p.expires, p.stop, "SL " + str.tostring(p.stop, format.mintick), xloc=xloc.bar_time, style=label.style_label_left, color=color.red, textcolor=color.white, size=size.tiny)
    if showTP
        p.targetLine := line.new(p.activated, p.target, p.expires, p.target, xloc=xloc.bar_time, color=color.lime)
        p.targetLabel := label.new(p.expires, p.target, "TP " + str.tostring(p.target, format.mintick), xloc=xloc.bar_time, style=label.style_label_left, color=color.green, textcolor=color.white, size=size.tiny)
    if showExpiration
        p.expiryLabel := label.new(p.expires, p.entry, "Expires " + str.format_time(p.expires, "HH:mm", sessionTimezone), xloc=xloc.bar_time, style=label.style_label_down, color=color.gray, textcolor=color.white, size=size.tiny)

f_cancel(Plan p, SessionState s, string reason) =>
    strategy.cancel(p.orderId)
    strategy.cancel(p.orderId + "-EXIT")
    p.erase()
    s.clusterConsumed := true
    f_debug(s, "Order cancelled: " + reason)

f_submit(Plan p) =>
    // qty omitted: native Properties owns sizing and currency conversion.
    strategy.entry(p.orderId, p.side == 1 ? strategy.long : strategy.short, limit=p.entry)
    strategy.exit(p.orderId + "-EXIT", from_entry=p.orderId, stop=p.stop, limit=p.target, comment_loss="SL", comment_profit="TP")

var SessionState europe = SessionState.new("EU", array.new<float>())
var SessionState newYork = SessionState.new("NY", array.new<float>())
var array<SessionState> sessions = array.from(europe, newYork)
var Plan active = na
var array<Plan> drawings = array.new<Plan>()
var int processedClosed = 0

// Standard three-candle definition: no middle-candle-close/displacement filter.
bool bullishFvg = not na(high[2]) and low > high[2]
bool bearishFvg = not na(low[2]) and high < low[2]
float structureLow = math.min(low, math.min(low[1], low[2]))
float structureHigh = math.max(high, math.max(high[1], high[2]))

if nativeMode and barstate.isconfirmed
    // Reconcile broker-emulator fills BEFORE resetting cycles or editing orders.
    // closedtrades also catches entry + exit within one chart bar.
    if not na(active)
        SessionState owner = array.get(sessions, active.owner)
        bool closedNow = strategy.closedtrades > processedClosed
        bool openNow = strategy.position_size != 0
        if not active.filled and (openNow or closedNow)
            active.filled := true
            label.delete(active.expiryLabel)
            active.expiryLabel := na
            if owner.cycle == active.cycle
                owner.trades += 1
                owner.clusterConsumed := true
            f_debug(owner, "Order filled " + active.orderId + "; count=" + str.tostring(owner.trades))
        if closedNow
            string result = "OTHER"
            for n = processedClosed to strategy.closedtrades - 1
                string exitComment = strategy.closedtrades.exit_comment(n)
                if strategy.closedtrades.entry_id(n) == active.orderId
                    if exitComment != "SL" and exitComment != "TP"
                        active.abnormalExit := true
                    result := exitComment == "SL" ? "SL" : exitComment == "TP" ? "TP" : "OTHER"
                    f_debug(owner, "Exit " + result + " price=" + str.tostring(strategy.closedtrades.exit_price(n), format.mintick))
            // Partial/margin exits do not unlock a second trade. Keep protecting
            // any residual position, then terminate this session when flat.
            if not openNow
                if owner.cycle == active.cycle
                    owner.lastExitBar := strategy.closedtrades.exit_bar_index(strategy.closedtrades - 1)
                    if owner.trades == 1
                        owner.firstResult := active.abnormalExit ? "OTHER" : result
                    owner.finished := owner.trades >= maximumTradesPerSession or owner.firstResult != "SL" or active.abnormalExit
                    owner.clearCluster()
                active.extend(strategy.closedtrades.exit_time(strategy.closedtrades - 1))
                array.push(drawings, active)
                if array.size(drawings) > retainedTradeDrawings
                    Plan oldest = array.shift(drawings)
                    oldest.erase()
                active := na
        if not na(active) and active.filled
            active.extend(time_close)
    processedClosed := strategy.closedtrades

    europe.updateContext(europeReferenceSession, europeBiasHour, europeBiasMinute, europeSetupSearchMinutes)
    newYork.updateContext(newYorkReferenceSession, newYorkBiasHour, newYorkBiasMinute, newYorkSetupSearchMinutes)

    if not na(active) and not active.filled
        SessionState owner = array.get(sessions, active.owner)
        if active.cycle != owner.cycle or time_close >= active.expires
            f_cancel(active, owner, active.cycle != owner.cycle ? "new session" : "validity / setup window ended")
            active := na

    // EU wins a same-bar global reservation tie. No second session's order is
    // queued behind an existing position/pending order; only new FVGs qualify.
    for i = 0 to 1
        SessionState s = array.get(sessions, i)
        bool enabled = i == 0 ? enableEurope : enableNewYork
        bool inWindow = s.evaluated and time_close > s.evaluationTime and time_close < s.windowEnd
        bool allowance = not s.finished and s.trades < maximumTradesPerSession and (s.trades == 0 or s.firstResult == "SL")
        bool freshAfterExit = na(s.lastExitBar) or bar_index > s.lastExitBar
        bool ownsPending = not na(active) and active.owner == i and not active.filled
        bool free = na(active) and strategy.position_size == 0
        bool canSearch = enabled and inWindow and allowance and freshAfterExit and s.bias != 0 and (free or ownsPending)
        bool directionFvg = s.bias == 1 ? bullishFvg : bearishFvg
        if canSearch and directionFvg
            float lower = s.bias == 1 ? high[2] : high
            float upper = s.bias == 1 ? low : low[2]
            float width = upper - lower
            float midpoint = (upper + lower) / 2
            float percent = midpoint > 0 ? width / midpoint * 100 : na
            f_debug(s, "FVG %=" + str.tostring(percent, "#.#####"))
            if not na(percent) and percent >= minimumFvgPercent
                bool consecutive = not na(s.lastFvgBar) and s.lastFvgBar == bar_index - 1
                // An unrelated new cluster cannot displace an existing order.
                if not ownsPending or consecutive
                    if not consecutive
                        s.clearCluster()
                    s.lastFvgBar := bar_index
                    // Compare midpoints to define 'lowest/highest structure';
                    // equal midpoints retain the earlier FVG. No future bars.
                    bool preferred = na(s.lower) or (s.bias == 1 ? midpoint < (s.lower + s.upper) / 2 : midpoint > (s.lower + s.upper) / 2)
                    if preferred and not s.clusterConsumed
                        s.lower := lower
                        s.upper := upper
                        s.fvgPercent := percent
                        // Preserve specified arithmetic; no arbitrary tick/SL
                        // buffer or stop cap. The emulator handles tick prices.
                        s.entry := s.bias == 1 ? lower + width * entryDepthPercent / 100 : upper - width * entryDepthPercent / 100
                        s.stop := s.bias == 1 ? structureLow : structureHigh
                        float risk = s.bias * (s.entry - s.stop)
                        s.target := s.entry + s.bias * risk * rewardRiskRatio
                        f_debug(s, "Preferred FVG entry=" + str.tostring(s.entry) + " SL distance=" + str.tostring(risk))
                        if risk > 0 and risk <= maxStopPoints
                            int activated = ownsPending ? active.activated : time_close
                            int expires = math.min(activated + orderValidityMinutes * 60000, s.windowEnd)
                            if ownsPending
                                strategy.cancel(active.orderId)
                                strategy.cancel(active.orderId + "-EXIT")
                                active.erase()
                            string orderId = s.tag + (s.bias == 1 ? "-LONG-" : "-SHORT-") + str.tostring(s.trades + 1) + "-" + str.tostring(s.cycle)
                            active := Plan.new(i, s.cycle, orderId, activated, expires, s.bias, s.entry, s.stop, s.target)
                            f_draw(active, s)
                            f_submit(active)
                            f_debug(s, (ownsPending ? "Order modified " : "Order created ") + orderId)
                        else
                            if ownsPending
                                f_cancel(active, s, "preferred cluster FVG has invalid structural stop")
                                active := na
                            // Keep tracking the cluster: a later preferred FVG
                            // may itself qualify, but never substitute a worse one.
                            s.clusterConsumed := false
                            f_debug(s, "Rejected structural SL distance=" + str.tostring(risk))

f_price(float value) =>
    na(value) ? "—" : str.tostring(value, format.mintick)
f_time(int value) =>
    na(value) ? "—" : str.format_time(value, "MM-dd HH:mm", sessionTimezone)
f_bias(SessionState s) =>
    not s.evaluated or na(s.evaluationPrice) or na(s.referenceHigh) ? "UNAVAILABLE" : s.bias == 1 ? "LONG" : s.bias == -1 ? "SHORT" : "NEUTRAL"

plot(showSessionHighs ? europe.currentHigh : na, "Europe current high", color=color.new(color.teal, 45), style=plot.style_linebr)
plot(showSessionHighs ? newYork.currentHigh : na, "NY current high", color=color.new(color.orange, 45), style=plot.style_linebr)
plot(showReferenceHigh ? europe.referenceHigh : na, "Europe exact N-session reference", color=color.teal, style=plot.style_linebr)
plot(showReferenceHigh ? newYork.referenceHigh : na, "NY exact N-session reference", color=color.orange, style=plot.style_linebr)
var table dashboard = table.new(position.top_right, 3, 21, bgcolor=color.new(color.black, 12), frame_color=color.gray, frame_width=1)
if barstate.isfirst
    table.merge_cells(dashboard, 0, 0, 2, 0)
// On an open market, a close-only strategy has not executed on the live candle
// yet. Populate the table on the last confirmed historical candle as well.
if barstate.islast or barstate.islastconfirmedhistory
    table.clear(dashboard, 0, 0, 2, 20)
    string warning = not executionChart ? "Set a standard chart to Execution Timeframe (" + executionTimeframe + "). Backtest accuracy is highest when chart timeframe matches Execution Timeframe. Orders disabled." : not contextValid ? "Context timeframe must be intraday and >= chart timeframe. Orders disabled." : not deadlinesAligned ? "Order validity and search durations must be multiples of the chart interval. Orders disabled." : ""
    if warning != ""
        table.cell(dashboard, 0, 0, warning, text_color=color.yellow, text_size=size.small)
    if showTable or showSessionBias or debugMode
        array<string> names = array.from("Session", "Bias", "Reference high", "Evaluation price", "Filled trades", "Order", "FVG %", "Entry", "SL", "TP", "Expires", "First result", "Window ends", "Last event", "History size", "Stored high", "Stored end", "Evaluation time", "Cycle started", "Sizing / min qty")
        for row = 0 to array.size(names) - 1
            bool visible = row == 1 ? showSessionBias : row <= 12 ? showTable : debugMode
            if visible
                table.cell(dashboard, 0, row + 1, array.get(names, row), text_color=color.silver, text_size=size.tiny)
                for i = 0 to 1
                    SessionState s = array.get(sessions, i)
                    bool owns = not na(active) and active.owner == i
                    string value = switch row
                        0 => s.tag + ((i == 0 ? enableEurope : enableNewYork) ? "" : " OFF")
                        1 => f_bias(s)
                        2 => f_price(s.referenceHigh)
                        3 => f_price(s.evaluationPrice)
                        4 => str.tostring(s.trades) + "/" + str.tostring(maximumTradesPerSession)
                        5 => owns ? (active.filled ? "OPEN" : "PENDING") : s.finished ? "FINISHED" : "NONE"
                        6 => na(s.fvgPercent) ? "—" : str.tostring(s.fvgPercent, "#.#####")
                        7 => f_price(owns ? active.entry : s.entry)
                        8 => f_price(owns ? active.stop : s.stop)
                        9 => f_price(owns ? active.target : s.target)
                        10 => owns and not active.filled ? f_time(active.expires) : "—"
                        11 => s.firstResult
                        12 => f_time(s.windowEnd)
                        13 => s.event
                        14 => str.tostring(array.size(s.highs))
                        15 => f_price(s.lastStoredHigh)
                        16 => f_time(s.lastStoredEnd)
                        17 => f_time(s.evaluationTime)
                        18 => f_time(s.cycle)
                        19 => str.tostring(strategy.default_entry_qty(close)) + " / " + str.tostring(syminfo.mincontract)
                    table.cell(dashboard, i + 1, row + 1, value, text_color=color.white, text_size=size.tiny)
```

## Backtesting limitations

- TradingView's broker emulator controls fills. Bar Magnifier is enabled, but intrabar coverage is feed/plan/history dependent. Same-bar entry and exit are possible; the script detects them through `strategy.closedtrades` and counts the entry once.
- Pending entries are created after Candle 3 closes and become eligible on the next tick. `process_orders_on_close`, `calc_on_every_tick`, and `calc_on_order_fills` default to false. Keep the bar-close/one-tick execution behavior for this model. Orders are not backdated into the setup candle.
- Expiry and window-end cancellations occur on chart closes. A fill on the candle ending at the deadline can occur before that close's cancellation. During a missing-bar/feed/weekend gap, Pine cannot cancel while it is not executing; the emulator may process the next opening tick before the script can cancel. Strict wall-clock expiry during feed gaps cannot be guaranteed by a Pine backtest. Live order routing would require broker-side expiry separately.
- Validity/search durations must be multiples of the execution candle duration. The script blocks incompatible settings and displays a warning. Evaluation times must coincide with an actual candle close; a missing evaluation close produces UNAVAILABLE, not a delayed replacement price.
- Reference-session boundaries must align with execution candles. A candle straddling a boundary cannot supply its partial-session high from OHLC alone, so that reference session is excluded. The first session is also excluded if the loaded history starts mid-session. Empty closed-market dates add no session to the history. Early market closes count the actual available configured-session bars; the script has no holiday calendar or way to identify vendor data outages.
- Entry and target arithmetic preserves the requested formulas without changing the structural stop. TradingView normalizes fills to the instrument's tick precision, so recorded prices and realized RR can differ slightly. Gaps, slippage, fees, capital, leverage, and minimum quantity can also affect fills/results.
- Chart timeframe must match Execution Timeframe on standard candles. Orders are disabled on mismatched and synthetic charts; there is no lower-timeframe fill emulation or snapshot viewer in this replacement.
- Default fees and slippage are zero, as placeholders in native Strategy Properties. Set realistic costs for your instrument. Fixed 0.1 units is the initial sizing setting, retained from the previous file; native cash and percent-of-equity settings express position notional, not stop risk. Orders below instrument minimum size or available margin may not fill.

## Explicit implementation assumptions

1. **Evaluation price:** “price at 10:15/16:15” means the close of the execution candle ending exactly at that timestamp. On a 5-minute chart this is the candle opening at 10:10/16:10. Bias is frozen immediately; the first eligible FVG has Candle 3 close strictly after evaluation.
2. **Context aggregation:** configurable context intervals default to 60 minutes and begin at the reference-session start. Their highs are built from completed execution candles, with the final interval clipped to the configured session end. Taking the maximum of those highs gives the exact session high regardless of context bucket duration. Full exchange-aligned 1H OHLC requests are intentionally avoided because they cannot isolate the 18:30 boundary. There is no HTF request or lookahead mode.
3. **Reference indexing:** the current cycle snapshots `history[size - sessionLookback]` from preceding completed sessions. Europe and New York histories are separate. Calendar-day subtraction and rolling-high calculations are never used.
4. **New York pre-open:** its technical setup window begins after 16:15 even though reference-high collection begins at 16:30, as specified. The allowed end is the earlier of evaluation + search duration and reference-session end.
5. **Overnight configuration:** if an overnight session's evaluation is before its end, it belongs to the preceding start date. A pre-open evaluation otherwise belongs to that start date. IANA timezone timestamps handle calendar and DST offsets.
6. **Cluster location:** FVG midpoint defines lowest bullish / highest bearish structure. Ties keep the earlier candidate. Every cluster member must meet the FVG-size threshold; the preferred member must also pass its own structural-stop constraint before it can have an order. An invalid preferred member does not justify trading a worse member.
7. **Pending orders:** a later unrelated cluster does not displace an existing valid pending order. Only an immediately consecutive qualifying FVG can change that order's selected structure. Replacement preserves its original activation time. An expired cluster is consumed and cannot immediately re-arm; a new cluster can qualify within the remaining window.
8. **Filled positions:** the setup window cancels pending entries, while filled trades retain their original SL/TP until exit. The prompt supplies no time-based liquidation rule. A trade held across a same-type cycle reset remains attributed to its original cycle and cannot consume the next cycle's allowance.
9. **Session overlap:** one pending order or position reserves execution globally. Europe wins a same-bar tie because it is processed first. Opportunities while globally occupied are skipped, not queued. The other session retains its independent bias/history/count/result.
10. **Trade two:** only an actual bracket exit marked SL unlocks it. A new Candle 3 must close on a bar after the first trade's exit bar. TP, margin/other exits, and a second completed trade end the current session's allowance. An unfilled cancelled order never increments the count.

## Manual validation checklist

- Load at least five completed Europe and five completed NY reference sessions before the date under review. Enable debug information to inspect stored highs, stored end timestamps, cycle starts, evaluation timestamps, and selected reference highs.
- Independently mark the exact Nth preceding session high. Confirm LONG above it, SHORT below it, and NEUTRAL on equality. Confirm that bias stays fixed after evaluation.
- Inspect a bullish and bearish FVG: size uses gap width divided by gap midpoint, entry uses the specified directional 30% formula, SL is the full three-candle extreme, and TP is 1.5R from planned entry.
- Check SL exactly 40 points is allowed, SL above 40 is rejected, and the stop is not moved inward. Check a sub-0.05% gap is rejected.
- Inspect consecutive gaps: lowest bullish/highest bearish is kept; a pending replacement never extends the original deadline; filled trades never change retroactively.
- Inspect expiry at the earlier of activation + 60 minutes and window end. New unrelated setups can qualify after expiry; old expired clusters cannot re-enter.
- Confirm trade one TP prevents trade two. After trade one SL, confirm a new FVG forms on a later bar before trade two. Confirm maximum two fills independently for EU and NY.
- Confirm a same-bar entry/exit counts once. Check global position overlap is absent.
- Change chart to 15m while Execution Timeframe remains 5: warning appears and there are no orders. Restore the 5m chart. Change validity to 61 on 5m: warning/no orders; restore 60.
- Toggle each visual and debug option. The last confirmed historical bar populates the table immediately, including on an open market before the next candle closes.

## Recommended initial configuration

| Setting | Value |
| --- | --- |
| Chart / Execution Timeframe | Standard 5-minute candles / 5 |
| Context Timeframe | 60 (1 hour) |
| Timezone | Europe/Bucharest |
| Session lookback | 5 completed same-type sessions |
| Europe reference / bias / search | 10:00–18:30 / 10:15 / 120 minutes |
| NY reference / bias / search | 16:30–23:00 / 16:15 / 120 minutes |
| Minimum FVG | 0.05% of midpoint |
| Entry depth | 30% |
| Order validity | 60 minutes |
| Maximum SL | 40 price points |
| Target | 1.5R |
| Filled trades per session | 2, second only after first SL |
| Position size | Configure native Strategy Properties |

See `devtrader-fvg-validation.md` for current validation evidence and its limits.

Official references: [TradingView strategy execution and broker emulator](https://www.tradingview.com/pine-script-docs/concepts/strategies/), [TradingView session definitions](https://www.tradingview.com/pine-script-docs/concepts/sessions/).
