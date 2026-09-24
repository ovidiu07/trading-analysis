#!/usr/bin/env python3
from __future__ import annotations

import math
import os
from pathlib import Path

import pandas as pd
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    Image as RLImage,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path("/Users/ovidiu/Documents/trading-analysis")
RUN = Path("/Users/ovidiu/.codex/automations/nasdaq-100-ema-200-daily/runs/2026-09-21")
WORK = ROOT / "tmp/pdfs/ema200-preview"
PDF_OUT = ROOT / "output/pdf/raport-nasdaq100-ema200-top3-2026-09-21.pdf"
PNG_OUT = ROOT / "output/imagegen/top3-nasdaq100-ema200-2026-09-21.png"
RUN_PDF = RUN / PDF_OUT.name
RUN_PNG = RUN / PNG_OUT.name
BACKGROUND = Path("/Users/ovidiu/.codex/generated_images/01a08f44-c637-7bf0-ba80-35ea0dfe6830/exec-3732d490-f25a-43ef-9217-415872542e7e.png")

NAVY = colors.HexColor("#071A2B")
NAVY_2 = colors.HexColor("#0D2B40")
TEAL = colors.HexColor("#12C7B4")
CYAN = colors.HexColor("#79E5F2")
MINT = colors.HexColor("#C9FFF6")
LIGHT = colors.HexColor("#EEF7FA")
INK = colors.HexColor("#102B3A")
MUTED = colors.HexColor("#59717E")
PALE = colors.HexColor("#E9F6F5")
AMBER = colors.HexColor("#FFCB6B")
RED = colors.HexColor("#FF7C7C")
WHITE = colors.white


def money(value: float) -> str:
    return f"${value:,.2f}"


def pct(value: float) -> str:
    return f"{value:+.2f}%"


def register_fonts() -> None:
    base = Path("/System/Library/Fonts/Supplemental")
    pdfmetrics.registerFont(TTFont("Arial", str(base / "Arial.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Bold", str(base / "Arial Bold.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Italic", str(base / "Arial Italic.ttf")))
    pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold", italic="Arial-Italic")


class Rule(Flowable):
    def __init__(self, width: float, color=TEAL, height: float = 1.5):
        super().__init__()
        self.width = width
        self.height = height
        self.color = color

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.height)
        self.canv.line(0, 0, self.width, 0)


def build_styles():
    s = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", fontName="Arial-Bold", fontSize=26, leading=30, textColor=WHITE, alignment=TA_LEFT, spaceAfter=6),
        "subtitle": ParagraphStyle("subtitle", fontName="Arial", fontSize=11.5, leading=16, textColor=MINT, spaceAfter=12),
        "kicker": ParagraphStyle("kicker", fontName="Arial-Bold", fontSize=9, leading=12, textColor=TEAL, tracking=1.1, spaceAfter=5),
        "h1": ParagraphStyle("h1", fontName="Arial-Bold", fontSize=21, leading=25, textColor=NAVY, spaceAfter=10),
        "h2": ParagraphStyle("h2", fontName="Arial-Bold", fontSize=14, leading=18, textColor=INK, spaceBefore=8, spaceAfter=6),
        "h3": ParagraphStyle("h3", fontName="Arial-Bold", fontSize=11, leading=14, textColor=INK, spaceBefore=5, spaceAfter=3),
        "body": ParagraphStyle("body", fontName="Arial", fontSize=9.3, leading=13.4, textColor=INK, spaceAfter=6),
        "small": ParagraphStyle("small", fontName="Arial", fontSize=7.6, leading=10.4, textColor=MUTED, spaceAfter=3),
        "tiny": ParagraphStyle("tiny", fontName="Arial", fontSize=6.7, leading=8.8, textColor=MUTED),
        "callout": ParagraphStyle("callout", fontName="Arial-Bold", fontSize=10.5, leading=14.5, textColor=NAVY, spaceAfter=4),
        "center": ParagraphStyle("center", fontName="Arial-Bold", fontSize=10, leading=13, textColor=INK, alignment=TA_CENTER),
        "white_small": ParagraphStyle("white_small", fontName="Arial", fontSize=8.5, leading=12, textColor=WHITE),
        "white_bold": ParagraphStyle("white_bold", fontName="Arial-Bold", fontSize=12, leading=15, textColor=WHITE),
        "link": ParagraphStyle("link", fontName="Arial", fontSize=7.4, leading=10.2, textColor=colors.HexColor("#176B78"), spaceAfter=3),
    }


def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    if doc.page == 1:
        canvas.setFillColor(NAVY)
        canvas.rect(0, 0, w, h, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor("#0B3A4A"))
        canvas.circle(w - 25 * mm, h - 28 * mm, 42 * mm, fill=1, stroke=0)
        canvas.setStrokeColor(colors.HexColor("#16AFA5"))
        canvas.setLineWidth(2)
        path = canvas.beginPath()
        path.moveTo(0, 38 * mm)
        path.curveTo(45 * mm, 54 * mm, 75 * mm, 25 * mm, 110 * mm, 48 * mm)
        path.curveTo(145 * mm, 72 * mm, 170 * mm, 60 * mm, w, 88 * mm)
        canvas.drawPath(path, stroke=1, fill=0)
    else:
        canvas.setFillColor(NAVY)
        canvas.rect(0, h - 12 * mm, w, 12 * mm, fill=1, stroke=0)
        canvas.setFillColor(TEAL)
        canvas.rect(0, h - 12.8 * mm, w, 0.8 * mm, fill=1, stroke=0)
        canvas.setFont("Arial-Bold", 7.5)
        canvas.setFillColor(WHITE)
        canvas.drawString(17 * mm, h - 8 * mm, "NASDAQ-100 | TEST EMA 200 | EDIȚIA 21 SEPTEMBRIE 2026")
        canvas.setFont("Arial", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(17 * mm, 10 * mm, "Date până la închiderea din 18.09.2026 • Material educațional, nu recomandare personalizată")
        canvas.drawRightString(w - 17 * mm, 10 * mm, f"{doc.page}")
    canvas.restoreState()


def metric_card(label: str, value: str, note: str, styles, width=49 * mm):
    data = [[Paragraph(label, styles["small"])], [Paragraph(value, styles["white_bold"])], [Paragraph(note, styles["white_small"])]]
    t = Table(data, colWidths=[width], rowHeights=[7 * mm, 9 * mm, 12 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY_2),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#25778A")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


def info_box(title: str, text: str, styles, bg=PALE, border=TEAL):
    t = Table([[Paragraph(title, styles["callout"])], [Paragraph(text, styles["body"])]], colWidths=[172 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.8, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def make_chart(history: pd.DataFrame, ticker: str, levels: dict[str, float]) -> Path:
    x = history.xs(ticker, level="Ticker", axis=1).dropna().tail(90).copy()
    full = history.xs(ticker, level="Ticker", axis=1).dropna().copy()
    full["EMA200"] = full["Adj Close"].ewm(span=200, adjust=False).mean()
    x["EMA200"] = full.loc[x.index, "EMA200"]
    width, height = 1460, 430
    img = Image.new("RGB", (width, height), "#F4FAFB")
    d = ImageDraw.Draw(img)
    left, right, top, bottom = 78, 30, 44, 58
    plot_w, plot_h = width-left-right, height-top-bottom
    vals = list(x["Adj Close"]) + list(x["EMA200"]) + list(levels.values())
    lo, hi = min(vals), max(vals)
    pad = (hi-lo)*0.08 or 1
    lo, hi = lo-pad, hi+pad
    def xp(i): return left + i * plot_w / (len(x)-1)
    def yp(v): return top + (hi-v) * plot_h / (hi-lo)
    # Grid and axis labels
    small = load_font(18)
    for i in range(5):
        y = top + i*plot_h/4
        d.line((left, y, width-right, y), fill="#C8DADD", width=1)
        value = hi - i*(hi-lo)/4
        d.text((8, y-10), f"${value:.0f}", font=small, fill="#59717E")
    for i in range(0, len(x), 22):
        xx = xp(i)
        d.line((xx, top, xx, top+plot_h), fill="#DFEAEC", width=1)
        d.text((xx-38, height-38), x.index[i].strftime("%d.%m"), font=small, fill="#59717E")
    # Series
    price_pts = [(xp(i), yp(v)) for i, v in enumerate(x["Adj Close"])]
    ema_pts = [(xp(i), yp(v)) for i, v in enumerate(x["EMA200"])]
    d.line(price_pts, fill="#0D2B40", width=5, joint="curve")
    d.line(ema_pts, fill="#12AFA4", width=5, joint="curve")
    for label, level in levels.items():
        y = yp(level)
        col = "#EEA633" if "Țintă" in label else "#E36D6D"
        for sx in range(left, width-right, 22):
            d.line((sx, y, min(sx+11, width-right), y), fill=col, width=2)
        d.rounded_rectangle((left+8, y-29, left+235, y-2), radius=6, fill="#F4FAFBDD")
        d.text((left+14, y-27), f"{label}: ${level:.1f}", font=small, fill="#6A4A15" if "Țintă" in label else "#8C3333")
    # Legend
    d.line((left, 22, left+55, 22), fill="#0D2B40", width=5)
    d.text((left+65, 10), "Închidere ajustată", font=small, fill="#102B3A")
    d.line((left+285, 22, left+340, 22), fill="#12AFA4", width=5)
    d.text((left+350, 10), "EMA 200", font=small, fill="#102B3A")
    out = WORK / f"chart-{ticker}.png"
    img.save(out)
    return out


def build_pdf() -> None:
    register_fonts()
    styles = build_styles()
    screen = pd.read_csv(RUN / "screen.csv")
    history = pd.read_pickle(RUN / "history.pkl")
    qualified = screen[screen["distance"].abs() <= 2.0].head(10).copy()

    picks = {
        "BKR": {
            "rank": "#1",
            "name": "Baker Hughes",
            "close": 57.25,
            "ema": 57.76,
            "distance": -0.89,
            "rsi": 34.4,
            "volume": 2.89,
            "confirm": "$57,60–$58,00",
            "t1": "$59,00",
            "t2": "$60,50–$61,00",
            "risk": "$55,40",
            "structural": "$52,00",
            "easy": "Prețul a revenit exact din zona EMA 200, iar volumul a fost de aproape trei ori peste normal. Asta arată interes real al cumpărătorilor, dar revenirea trebuie confirmată peste maximul ultimei ședințe.",
            "why": "Cea mai bună combinație din eșantion între supravânzare moderată, EMA 200 încă ascendentă, volum ridicat și ținte apropiate. Backlogul din energie/LNG oferă și un context fundamental rezonabil.",
            "fund": "T2: venituri $6,74 mld., EBITDA ajustată $1,23 mld. și flux de numerar liber $1,11 mld. Riscurile principale sunt ciclicitatea serviciilor petroliere, Orientul Mijlociu și integrarea achizițiilor.",
            "levels": {"Țintă 2": 60.75, "Risc": 55.4},
            "plan": "Scenariul devine activ numai dacă prețul ține peste $57,60–$58,00. Prima zonă de marcare este $59,00; dacă volumul rămâne bun, extensia este $60,50–$61,00. O închidere sub $55,40 slăbește imediat ideea; sub $52,00 structura este invalidată.",
        },
        "MAR": {
            "rank": "#2",
            "name": "Marriott International",
            "close": 338.92,
            "ema": 340.97,
            "distance": -0.60,
            "rsi": 45.0,
            "volume": 2.87,
            "confirm": "$340,70–$342,30",
            "t1": "$350,00",
            "t2": "$354,00",
            "risk": "$332,00",
            "structural": "$320,00",
            "easy": "Marriott a recuperat puternic de la suport, pe volum de aproape trei ori peste medie. Prețul este foarte aproape de EMA 200, deci o trecere clară peste $342 poate transforma revenirea într-un impuls de câteva zile.",
            "why": "Revenire de +1,47% cu participare ridicată, suport apropiat și un model de afaceri asset-light. Volatilitatea este mai mică decât la acțiunile AI, ceea ce face planul mai ușor de explicat și controlat.",
            "fund": "T2: venituri $7,07 mld., EPS ajustat $3,19, RevPAR +3,4% și EBITDA ajustată +13%. Riscul dominant este datoria ridicată, la care se adaugă sensibilitatea la călătorii și dobânzi.",
            "levels": {"Țintă 2": 354.0, "Risc": 332.0},
            "plan": "Confirmarea este o închidere peste $340,70–$342,30. Prima țintă tactică este $350, iar zona $354 reprezintă rezistența mai importantă. Dacă prețul pierde $332, setup-ul pe termen scurt se deteriorează; sub $320, baza actuală este invalidată.",
        },
        "AVGO": {
            "rank": "#3",
            "name": "Broadcom",
            "close": 357.61,
            "ema": 364.00,
            "distance": -1.75,
            "rsi": 45.5,
            "volume": 1.72,
            "confirm": "$363,30–$364,00",
            "t1": "$372,70–$376,60",
            "t2": "$379,80–$380,00",
            "risk": "$345,00",
            "structural": "$335,00",
            "easy": "Broadcom are cele mai puternice rezultate fundamentale din grup și a revenit aproape 3% pe volum peste medie. Totuși, EMA 200 este încă deasupra prețului; de aceea este pe locul trei până când recucerește zona $364.",
            "why": "Creșterea din AI și fluxul mare de numerar oferă suport fundamental, iar revenirea tehnică are loc din zona $336–$351. Principalul minus este că prețul mai are de trecut prin două rezistențe apropiate.",
            "fund": "T3 fiscal: venituri $29,59 mld. (+86%), venituri AI +221% la $16,7 mld. și FCF $13,67 mld. Riscurile sunt concentrarea clienților, încetinirea cheltuielilor AI, integrarea VMware și levierul.",
            "levels": {"Țintă 2": 380.0, "Risc": 345.0},
            "plan": "Ideea se activează numai peste $363,30–$364. Prima zonă-țintă este $372,70–$376,60, iar extensia este $379,80–$380. Sub $345 impulsul se slăbește; o închidere sub $335 invalidează baza tehnică.",
        },
    }

    charts = {t: make_chart(history, t, p["levels"]) for t, p in picks.items()}
    doc = SimpleDocTemplate(
        str(PDF_OUT), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=20 * mm, bottomMargin=17 * mm, title="Raport NASDAQ-100 EMA 200 — Top 3",
        author="Raport de cercetare educațională",
    )
    story = []

    # Cover
    story += [Spacer(1, 18 * mm), Paragraph("RAPORT SPECIAL • 2–5 ȘEDINȚE", styles["kicker"]),
              Paragraph("Top 3 acțiuni NASDAQ-100<br/>la testul EMA 200", styles["title"]),
              Paragraph("Selecție tactică în limba română, construită din datele ultimei ședințe americane încheiate: <b>18 septembrie 2026</b>.", styles["subtitle"]),
              Spacer(1, 4 * mm)]
    cards = Table([[metric_card("#1 • BKR", "$57,25", "Confirmare peste $57,60–$58,00", styles),
                    metric_card("#2 • MAR", "$338,92", "Confirmare peste $340,70–$342,30", styles),
                    metric_card("#3 • AVGO", "$357,61", "Confirmare peste $363,30–$364,00", styles)]],
                  colWidths=[55 * mm] * 3, hAlign="LEFT")
    cards.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 6)]))
    story += [cards, Spacer(1, 10 * mm),
              info_box("Ideea centrală", "Acestea sunt cele mai bune trei configurații <b>relative</b> din screeningul curent, nu cele mai sigure acțiuni din piață. Niciuna nu este tratată drept cumpărare automată: fiecare are un nivel de confirmare, ținte tactice și un nivel de invalidare.", styles, bg=colors.HexColor("#DDF7F3")),
              Spacer(1, 6 * mm),
              Paragraph("UNIVERS ANALIZAT", styles["kicker"]),
              Paragraph("101 titluri NASDAQ-100 • 99 eligibile • 681 ședințe • 10 titluri în banda ±2% față de EMA 200", styles["white_bold"]),
              Spacer(1, 6 * mm),
              Paragraph("Acest material este educațional. Nu reprezintă consultanță financiară și nu ține cont de situația, toleranța la risc sau orizontul cititorului. Țintele sunt scenarii, nu garanții.", styles["white_small"]),
              PageBreak()]

    # Executive summary and universe
    story += [Paragraph("Rezumat executiv", styles["h1"]),
              Paragraph("Cum se citește selecția", styles["h2"]),
              Paragraph("Screeningul caută acțiunile NASDAQ-100 aflate la cel mult 2% de EMA 200. Apoi ordonează oportunitățile pe baza distanței, direcției mediei, reacției de preț, volumului, momentumului, lichidității și contextului fundamental. Pentru orizontul de 2–5 ședințe, am preferat reveniri cu volum și risc tehnic clar, nu doar acțiuni ieftine sau povești populare.", styles["body"]),
              info_box("Clasamentul de azi", "<b>1. BKR</b> — cel mai curat raport între suport, volum și distanță până la primele ținte.<br/><b>2. MAR</b> — revenire pe volum foarte ridicat, cu volatilitate relativ controlabilă.<br/><b>3. AVGO</b> — fundamentale excepționale, dar are nevoie de confirmare peste EMA 200; de aceea nu este pe primul loc.", styles),
              Paragraph("Toate cele 10 acțiuni care au trecut filtrul", styles["h2"])]
    rows = [["Rang", "Simbol", "Închidere", "EMA 200", "Distanță", "RSI 14", "Volum*", "Verdict"]]
    verdict = {"SHOP": "Observă", "MAR": "Constructiv", "DASH": "Observă", "BKR": "Constructiv", "MDLZ": "Observă", "CCEP": "Neutru", "MSTR": "Evită acum", "KLAC": "Constructiv", "AVGO": "Constructiv", "PYPL": "Neutru"}
    for i, r in qualified.reset_index(drop=True).iterrows():
        rows.append([str(i + 1), r.symbol, money(r.close), money(r.ema), pct(r.distance), f"{r.rsi14:.1f}", f"{r.volume_ratio:.2f}×", verdict[r.symbol]])
    table = Table(rows, colWidths=[10*mm, 17*mm, 25*mm, 25*mm, 20*mm, 17*mm, 18*mm, 28*mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), NAVY), ("TEXTCOLOR", (0,0), (-1,0), WHITE),
        ("FONTNAME", (0,0), (-1,0), "Arial-Bold"), ("FONTNAME", (0,1), (-1,-1), "Arial"),
        ("FONTSIZE", (0,0), (-1,-1), 7.1), ("LEADING", (0,0), (-1,-1), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, colors.HexColor("#F1F7F8")]),
        ("GRID", (0,0), (-1,-1), .35, colors.HexColor("#B7CDD2")),
        ("ALIGN", (0,0), (-1,-1), "CENTER"), ("ALIGN", (1,1), (1,-1), "LEFT"),
        ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    story += [table, Paragraph("* Raportul dintre volumul ultimei ședințe și media precedentelor 20 de ședințe.", styles["tiny"]),
              Paragraph("De ce nu am ales automat primele trei după distanța față de EMA", styles["h2"]),
              Paragraph("SHOP și DASH sunt foarte aproape de EMA 200, dar se află sub mediile pe 20 și 50 de zile și nu au oferit încă o revenire la fel de clară. MSTR a avut o mișcare de +16,39% legată de Bitcoin, ceea ce crește riscul de reversare. KLAC rămâne constructiv, însă are rezistență imediată și volatilitate ridicată. Selecția BKR–MAR–AVGO urmărește un compromis mai bun între confirmare, lichiditate, context și disciplină de risc.", styles["body"]),
              PageBreak()]

    # Individual pages
    for ticker, p in picks.items():
        story += [Paragraph(f"{p['rank']} • {ticker} — {p['name']}", styles["h1"]),
                  Table([[metric_card("ÎNCHIDERE", money(p["close"]), f"EMA 200: {money(p['ema'])}", styles, 51*mm),
                          metric_card("DISTANȚĂ", pct(p["distance"]), f"RSI(14): {p['rsi']:.1f}", styles, 51*mm),
                          metric_card("VOLUM", f"{p['volume']:.2f}×", "față de media precedentelor 20 zile", styles, 51*mm)]], colWidths=[57*mm]*3),
                  Spacer(1, 5*mm),
                  Paragraph("Explicația simplă", styles["h2"]),
                  Paragraph(p["easy"], styles["body"]),
                  RLImage(str(charts[ticker]), width=170*mm, height=53*mm),
                  Paragraph("Plan tactic pentru următoarele 2–5 ședințe", styles["h2"])]
        plan_rows = [
            [Paragraph("Confirmare", styles["center"]), Paragraph("Ținta 1", styles["center"]), Paragraph("Ținta 2", styles["center"]), Paragraph("Risc apropiat", styles["center"])],
            [Paragraph(p["confirm"], styles["center"]), Paragraph(p["t1"], styles["center"]), Paragraph(p["t2"], styles["center"]), Paragraph(p["risk"], styles["center"])],
        ]
        pt = Table(plan_rows, colWidths=[42.5*mm]*4)
        pt.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), PALE), ("BACKGROUND", (0,1), (-2,1), WHITE), ("BACKGROUND", (-1,1), (-1,1), colors.HexColor("#FFF0EE")),
            ("BOX", (0,0), (-1,-1), .8, colors.HexColor("#9EBCC2")), ("INNERGRID", (0,0), (-1,-1), .4, colors.HexColor("#C2D6DA")),
            ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ]))
        story += [pt, Spacer(1, 4*mm), Paragraph(p["plan"], styles["body"]),
                  info_box("De ce este în Top 3", p["why"], styles),
                  Paragraph("Context fundamental și riscuri", styles["h2"]),
                  Paragraph(p["fund"], styles["body"]),
                  Paragraph(f"Invalidare structurală: <b>{p['structural']}</b>. Nivelul de risc apropiat nu este o recomandare universală de stop; dimensiunea poziției trebuie adaptată la volatilitate și la pierderea maximă acceptată.", styles["small"]),
                  PageBreak()]

    # Methodology, sources, community-ready explanation
    story += [Paragraph("Metodologie, utilizare și surse", styles["h1"]),
              Paragraph("Reguli folosite", styles["h2"])]
    rules = [
        ["1", "Univers", "Componența NASDAQ-100 disponibilă la 18.09.2026: 101 titluri reprezentând 100 de companii."],
        ["2", "Istoric", "681 ședințe ajustate pentru acțiuni corporative; SPCX și HONA au fost excluse deoarece au doar 68, respectiv 67 ședințe."],
        ["3", "Filtru", "Distanță inclusivă de ±2% față de EMA(200), calculată recursiv cu α = 2/201."],
        ["4", "Selecție Top 3", "Nu doar distanță: direcția EMA, reacția ultimei ședințe, volum, RSI, suport/rezistență, lichiditate și context fundamental."],
        ["5", "Ținte", "Niveluri tactice derivate din rezistențe recente și amplitudinea normală a mișcării; devin relevante numai după confirmare."],
    ]
    rt = Table([[Paragraph(f"<b>{a}</b>", styles["body"]), Paragraph(f"<b>{b}</b>", styles["body"]), Paragraph(c, styles["body"])] for a,b,c in rules], colWidths=[10*mm, 30*mm, 130*mm])
    rt.setStyle(TableStyle([("ROWBACKGROUNDS", (0,0), (-1,-1), [PALE, WHITE]), ("GRID", (0,0), (-1,-1), .35, colors.HexColor("#C0D5D9")), ("VALIGN", (0,0), (-1,-1), "TOP"), ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 4)]))
    story += [rt,
              Paragraph("Text scurt, gata de explicat comunității", styles["h2"]),
              info_box("Pe scurt", "Astăzi nu căutăm acțiuni care doar par ieftine. Căutăm reacții verificabile în jurul EMA 200. BKR are cel mai bun echilibru între volum, suport și ținte apropiate; MAR oferă o revenire mai ordonată; AVGO are povestea fundamentală cea mai puternică, dar trebuie să depășească $364. Dacă nivelurile de confirmare nu sunt atinse, scenariul rămâne doar pe lista de observație.", styles, bg=colors.HexColor("#E5F5FF"), border=colors.HexColor("#54A8C2")),
              Paragraph("Surse principale", styles["h2"]),
              Paragraph('<link href="https://www.nasdaq.com/solutions/global-indexes/nasdaq-100/companies">Nasdaq — componența NASDAQ-100</link> • instantaneu 18.09.2026', styles["link"]),
              Paragraph('<link href="https://finance.yahoo.com/">Yahoo Finance / yfinance — OHLCV ajustat și instantanee de piață</link> • acces 21.09.2026', styles["link"]),
              Paragraph('<link href="https://investors.bakerhughes.com/news/press-releases/news-details/2026/Baker-Hughes-Announces-Second-Quarter-2026-Results/default.aspx">Baker Hughes — rezultate T2 2026</link>', styles["link"]),
              Paragraph('<link href="https://www.sec.gov/Archives/edgar/data/1048286/000104828626000033/mar-2026q2xex99earningsrel.htm">Marriott — rezultate T2 2026, document SEC</link>', styles["link"]),
              Paragraph('<link href="https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announces-third-quarter-fiscal-year-2026-financial">Broadcom — rezultate T3 fiscal 2026</link>', styles["link"]),
              Paragraph("Datele, valorile și concluziile sunt cele ale screeningului rulat înaintea deschiderii SUA din 21.09.2026 și folosesc ultima lumânare completă din 18.09.2026. Țintele agregate pe 12 luni din raportul-sursă nu au fost folosite drept ținte pentru 2–5 zile.", styles["small"]),
              Paragraph("Avertisment important", styles["h2"]),
              Paragraph("Acest raport este material educațional și editorial. Nu reprezintă recomandare de cumpărare/vânzare, consultanță financiară, promisiune de randament sau evaluare a adecvării pentru o persoană. Piețele pot deschide cu gap, pot traversa nivelurile fără execuție și pot reacționa la știri neprevăzute. Fiecare cititor trebuie să verifice datele curente, să decidă independent și, dacă este necesar, să consulte un profesionist autorizat.", styles["body"])]

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    RUN_PDF.write_bytes(PDF_OUT.read_bytes())


def load_font(size: int, bold=False):
    name = "Arial Bold.ttf" if bold else "Arial.ttf"
    return ImageFont.truetype(f"/System/Library/Fonts/Supplemental/{name}", size)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def fit_text(draw, text, box_width, start_size, min_size=18, bold=True):
    for size in range(start_size, min_size - 1, -1):
        f = load_font(size, bold)
        if draw.textbbox((0,0), text, font=f)[2] <= box_width:
            return f
    return load_font(min_size, bold)


def build_social() -> None:
    bg = Image.open(BACKGROUND).convert("RGB")
    target = (1080, 1350)
    ratio = max(target[0] / bg.width, target[1] / bg.height)
    bg = bg.resize((int(bg.width * ratio), int(bg.height * ratio)), Image.Resampling.LANCZOS)
    left = (bg.width - target[0]) // 2
    top = (bg.height - target[1]) // 2
    bg = bg.crop((left, top, left + target[0], top + target[1]))
    bg = ImageEnhance.Brightness(bg).enhance(.56)
    overlay = Image.new("RGBA", target, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle((0, 0, 1080, 1350), fill=(3, 18, 33, 78))
    od.rectangle((0, 0, 1080, 330), fill=(3, 18, 33, 100))
    canvas = Image.alpha_composite(bg.convert("RGBA"), overlay)
    d = ImageDraw.Draw(canvas)

    teal = (26, 224, 199, 255)
    white = (244, 251, 252, 255)
    pale = (194, 223, 228, 255)
    amber = (255, 205, 102, 255)
    red = (255, 145, 135, 255)
    navy_card = (6, 27, 44, 225)

    # Header
    d.text((70, 58), "RAPORT TACTIC • 2–5 ȘEDINȚE", font=load_font(25, True), fill=teal)
    d.text((70, 105), "TOP 3 ACȚIUNI", font=load_font(68, True), fill=white)
    d.text((70, 180), "NASDAQ-100 la testul EMA 200", font=load_font(37, True), fill=white)
    d.text((70, 232), "Date: închiderea din 18 septembrie 2026", font=load_font(24), fill=pale)
    d.line((70, 280, 1010, 280), fill=teal, width=3)

    cards = [
        ("1", "BKR", "$57,25", "Peste $57,60–$58", "$59,00", "$60,50–$61", "$55,40", "Volum 2,89× • RSI 34,4"),
        ("2", "MAR", "$338,92", "Peste $340,70–$342,30", "$350,00", "$354,00", "$332,00", "Volum 2,87× • RSI 45,0"),
        ("3", "AVGO", "$357,61", "Peste $363,30–$364", "$372,70–$376,60", "$379,80–$380", "$345,00", "Volum 1,72× • RSI 45,5"),
    ]
    y_positions = [322, 594, 866]
    for (rank, ticker, price, confirm, t1, t2, risk, reason), y in zip(cards, y_positions):
        rounded(d, (55, y, 1025, y + 238), 28, navy_card, (34, 132, 148, 220), 2)
        rounded(d, (78, y + 26, 142, y + 90), 18, (15, 190, 170, 255))
        f_rank = load_font(32, True)
        rb = d.textbbox((0, 0), rank, font=f_rank)
        d.text((110 - (rb[2]-rb[0])/2, y + 38), rank, font=f_rank, fill=(4, 33, 48, 255))
        d.text((165, y + 23), ticker, font=load_font(46, True), fill=white)
        price_font = fit_text(d, price, 240, 38, 28, True)
        d.text((760, y + 27), price, font=price_font, fill=amber)
        d.text((165, y + 81), reason, font=load_font(21), fill=pale)
        d.text((82, y + 132), "CONFIRMARE", font=load_font(18, True), fill=teal)
        d.text((230, y + 128), confirm, font=fit_text(d, confirm, 270, 24, 18, True), fill=white)
        d.text((530, y + 132), "ȚINTA 1", font=load_font(18, True), fill=teal)
        d.text((630, y + 128), t1, font=fit_text(d, t1, 185, 24, 18, True), fill=white)
        d.text((82, y + 183), "ȚINTA 2", font=load_font(18, True), fill=teal)
        d.text((182, y + 179), t2, font=fit_text(d, t2, 275, 23, 17, True), fill=white)
        d.text((545, y + 183), "RISC", font=load_font(18, True), fill=red)
        d.text((610, y + 179), risk, font=load_font(23, True), fill=white)

    # Footer
    rounded(d, (55, 1134, 1025, 1287), 24, (4, 22, 37, 238), (34, 132, 148, 200), 2)
    d.text((82, 1160), "NU CUMPĂRĂM AUTOMAT LA EMA 200", font=load_font(24, True), fill=amber)
    d.text((82, 1200), "Așteptăm confirmarea. Țintele sunt scenarii, nu garanții.", font=load_font(23, True), fill=white)
    d.text((82, 1242), "Material educațional • Verifică prețurile curente înainte de orice decizie", font=load_font(18), fill=pale)
    d.text((740, 1303), "21.09.2026", font=load_font(17, True), fill=teal)

    canvas.convert("RGB").save(PNG_OUT, quality=95)
    RUN_PNG.write_bytes(PNG_OUT.read_bytes())


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    PDF_OUT.parent.mkdir(parents=True, exist_ok=True)
    PNG_OUT.parent.mkdir(parents=True, exist_ok=True)
    build_pdf()
    build_social()
    print(PDF_OUT)
    print(PNG_OUT)
    print(RUN_PDF)
    print(RUN_PNG)


if __name__ == "__main__":
    main()
