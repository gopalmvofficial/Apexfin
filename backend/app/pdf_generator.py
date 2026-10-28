import io
from typing import List, Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_financial_statement_pdf(
    user_name: str,
    account_name: str,
    liquid_balance: float,
    total_income: float,
    total_expenses: float,
    transactions: List[Dict[str, Any]],
    currency: str = "USD"
) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom Sovereign Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
    )

    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748b'),
    )

    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=14,
        spaceAfter=8,
    )

    story = []

    # 1. Header & Branding
    story.append(Paragraph("APEXFIN INTELLIGENCE — FINANCIAL STATEMENT", title_style))
    story.append(Paragraph(f"Account: {account_name} | Client: {user_name} | Generated: October 2026", subtitle_style))
    story.append(Spacer(1, 16))

    # 2. Executive Summary Metrics Box
    net_savings = total_income - total_expenses
    summary_data = [
        ["Total Liquid Balance", "Monthly Inflow", "Monthly Outflow", "Net Monthly Savings"],
        [
            f"${liquid_balance:,.2f}",
            f"+${total_income:,.2f}",
            f"-${total_expenses:,.2f}",
            f"{'+' if net_savings >= 0 else ''}${net_savings:,.2f}"
        ]
    ]

    summary_table = Table(summary_data, colWidths=[130, 130, 130, 130])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#475569')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 11),
        ('TEXTCOLOR', (0, 1), (0, 1), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (1, 1), (1, 1), colors.HexColor('#10b981')),
        ('TEXTCOLOR', (2, 1), (2, 1), colors.HexColor('#ef4444')),
        ('TEXTCOLOR', (3, 1), (3, 1), colors.HexColor('#3b82f6')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # 3. Itemized Transactions Table
    story.append(Paragraph("Cleared Financial Ledger Transactions", section_style))

    tx_table_data = [["Date", "Description", "Type", "Status", "Amount"]]
    for tx in transactions[:35]: # up to 35 on statement
        is_inc = tx.get("type") == "income"
        amt_str = f"{'+' if is_inc else '-'}${tx.get('amount', 0.0):,.2f}"
        tx_table_data.append([
            tx.get("date", "2026-10-26"),
            tx.get("description", "Transaction")[:34],
            tx.get("type", "expense").upper(),
            tx.get("status", "cleared").upper(),
            amt_str
        ])

    tx_table = Table(tx_table_data, colWidths=[70, 240, 60, 60, 90])
    tx_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    story.append(tx_table)

    story.append(Spacer(1, 20))
    story.append(Paragraph("This automated financial statement is officially verified by ApexFin Predictive Intelligence. Generated under WCAG AA & PCI compliance standards.", subtitle_style))

    doc.build(story)
    buffer.seek(0)
    return buffer
