import ExcelJS from "exceljs";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { jsPDF } from "jspdf";

export type SessionReportRow = {
  time: string;
  account: string;
  market: string;
  barrier: number;
  stake: number;
  payout: number | null;
  profit: number;
  status: string;
  contractId: string;
};

export type SessionReportSummary = {
  closed: number;
  wins: number;
  losses: number;
  netProfit: number;
};

export type MarketSummary = {
  market: string;
  count: number;
};

const columns = [
  "Time",
  "Account",
  "Market",
  "Barrier",
  "Stake",
  "Payout",
  "Profit / loss",
  "Status",
  "Contract ID",
];

function rowValues(row: SessionReportRow): (string | number)[] {
  return [
    row.time,
    row.account,
    row.market,
    row.barrier,
    row.stake,
    row.payout ?? "",
    row.profit,
    row.status,
    row.contractId,
  ];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadWordReport(
  rows: SessionReportRow[],
  summary: SessionReportSummary,
  markets: MarketSummary[],
) {
  const maxMarketCount = Math.max(1, ...markets.map((item) => item.count));
  const marketBars = markets.slice(0, 8).map((item) => {
    const bar = "█".repeat(Math.max(1, Math.round((item.count / maxMarketCount) * 20)));
    return new Paragraph({ text: `${item.market.padEnd(18)} ${bar} ${item.count}` });
  });
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: columns.map((column) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: column, bold: true })] })],
      })),
    }),
    ...rows.map((row) => new TableRow({
      children: rowValues(row).map((value) => new TableCell({
        children: [new Paragraph({ text: String(value) })],
      })),
    })),
  ];

  const sections = [
    new Paragraph({ text: "Digit Killer — Session Report", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `Generated ${new Date().toLocaleString()}` }),
    new Paragraph({ text: `Settled contracts: ${summary.closed} · Wins: ${summary.wins} · Losses: ${summary.losses} · Net P/L: ${summary.netProfit.toFixed(2)}` }),
    new Paragraph({ text: "Win / loss distribution", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({
      text: `Wins ${"█".repeat(summary.wins)}${"░".repeat(summary.losses)} Losses`,
    }),
    new Paragraph({ text: "Settled contracts by market", heading: HeadingLevel.HEADING_2 }),
    ...(marketBars.length ? marketBars : [new Paragraph({ text: "No settled market records yet." })]),
    new Paragraph({ text: "Contract history", heading: HeadingLevel.HEADING_2 }),
  ];

  if (rows.length) {
    sections.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    }) as unknown as Paragraph);
  } else {
    sections.push(new Paragraph({ text: "No contract records are available in this session." }));
  }

  const document = new Document({ sections: [{ children: sections }] });
  const blob = await Packer.toBlob(document);
  downloadBlob(blob, "digit-killer-session-report.docx");
}

export async function downloadExcelReport(
  rows: SessionReportRow[],
  summary: SessionReportSummary,
  markets: MarketSummary[],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Digit Killer";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.addRows([
    ["Metric", "Value"],
    ["Settled contracts", summary.closed],
    ["Wins", summary.wins],
    ["Losses", summary.losses],
    ["Net profit / loss", Number(summary.netProfit.toFixed(2))],
    ["Generated", new Date().toLocaleString()],
  ]);
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123343" } };
  summarySheet.columns = [{ width: 28 }, { width: 28 }];

  const marketSheet = workbook.addWorksheet("Markets");
  marketSheet.addRow(["Market", "Settled contracts", "Share"]);
  const totalMarkets = markets.reduce((sum, item) => sum + item.count, 0) || 1;
  markets.forEach((item) => marketSheet.addRow([
    item.market,
    item.count,
    Number(((item.count / totalMarkets) * 100).toFixed(1)),
  ]));
  marketSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  marketSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123343" } };
  marketSheet.columns = [{ width: 24 }, { width: 24 }, { width: 16 }];

  const tradesSheet = workbook.addWorksheet("Contracts");
  tradesSheet.addRow(columns);
  rows.forEach((row) => tradesSheet.addRow(rowValues(row)));
  tradesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  tradesSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123343" } };
  tradesSheet.views = [{ state: "frozen", ySplit: 1 }];
  tradesSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: columns.length },
  };
  tradesSheet.columns = [
    { width: 25 }, { width: 12 }, { width: 20 }, { width: 12 }, { width: 14 },
    { width: 14 }, { width: 17 }, { width: 14 }, { width: 24 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "digit-killer-session-report.xlsx",
  );
}

function drawBar(pdf: jsPDF, x: number, y: number, width: number, height: number, value: number, max: number, color: [number, number, number]) {
  pdf.setFillColor(230, 235, 239);
  pdf.roundedRect(x, y, width, height, 1.5, 1.5, "F");
  if (value > 0 && max > 0) {
    pdf.setFillColor(...color);
    pdf.roundedRect(x, y, Math.max(1, width * value / max), height, 1.5, 1.5, "F");
  }
}

export function downloadPdfReport(
  rows: SessionReportRow[],
  summary: SessionReportSummary,
  markets: MarketSummary[],
) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setTextColor(18, 38, 48);
  pdf.setFontSize(20);
  pdf.text("Digit Killer — Session Report", 14, 18);
  pdf.setFontSize(9);
  pdf.setTextColor(90, 105, 115);
  pdf.text(`Generated ${new Date().toLocaleString()}`, 14, 25);
  pdf.setTextColor(18, 38, 48);
  pdf.setFontSize(11);
  pdf.text(`Settled ${summary.closed}     Wins ${summary.wins}     Losses ${summary.losses}     Net P/L ${summary.netProfit.toFixed(2)}`, 14, 35);

  const outcomes = summary.wins + summary.losses;
  pdf.setFontSize(10);
  pdf.text("Win / loss distribution", 14, 49);
  drawBar(pdf, 14, 53, 104, 7, summary.wins, outcomes, [22, 163, 104]);
  drawBar(pdf, 122, 53, 104, 7, summary.losses, outcomes, [225, 76, 88]);
  pdf.setFontSize(8);
  pdf.text(`${summary.wins} wins · ${summary.losses} losses`, 14, 65);

  pdf.setFontSize(10);
  pdf.text("Settled contracts by market", 14, 78);
  const topMarkets = markets.slice(0, 8);
  const maxMarketCount = Math.max(1, ...topMarkets.map((item) => item.count));
  topMarkets.forEach((item, index) => {
    const y = 84 + index * 10;
    pdf.setFontSize(8);
    pdf.text(item.market.slice(0, 26), 14, y + 4);
    drawBar(pdf, 56, y, 150, 5, item.count, maxMarketCount, [0, 157, 174]);
    pdf.text(String(item.count), 210, y + 4);
  });
  pdf.setFontSize(8);
  pdf.setTextColor(90, 105, 115);
  pdf.text("Historical results summarize this session; they are not a forecast.", 14, 176);

  const widths = [35, 20, 26, 16, 19, 20, 25, 21, 58];
  const xPositions = widths.reduce<number[]>((positions, width, index) => {
    positions.push(index === 0 ? 12 : positions[index - 1] + widths[index - 1]);
    return positions;
  }, []);
  const pageHeader = () => {
    pdf.setFillColor(18, 51, 67);
    pdf.rect(12, 12, 273, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(6.7);
    columns.forEach((column, index) => pdf.text(column, xPositions[index] + 1.2, 17.5));
    pdf.setTextColor(18, 38, 48);
  };
  pdf.addPage("a4", "landscape");
  pageHeader();
  let y = 25;
  rows.forEach((row, index) => {
    if (y > 194) {
      pdf.addPage("a4", "landscape");
      pageHeader();
      y = 25;
    }
    if (index % 2 === 1) {
      pdf.setFillColor(243, 247, 249);
      pdf.rect(12, y - 4, 273, 7, "F");
    }
    pdf.setFontSize(6.5);
    pdf.setTextColor(35, 50, 58);
    rowValues(row).forEach((value, columnIndex) => {
      const text = String(value).slice(0, columnIndex === 8 ? 28 : 22);
      pdf.text(text, xPositions[columnIndex] + 1.2, y);
    });
    y += 7;
  });
  if (!rows.length) {
    pdf.setFontSize(9);
    pdf.text("No contract records are available in this session.", 14, 32);
  }
  pdf.save("digit-killer-session-report.pdf");
}
