import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts } from "pdf-lib";

export async function saveAsPDF(filename: string, content: string, folder: string) {
	if (!fs.existsSync(folder)) {
		fs.mkdirSync(folder);
	}

	const pdfDoc = await PDFDocument.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	let page = pdfDoc.addPage();
	const { width: pageWidth, height: pageHeight } = page.getSize();
	const margin = 50;
	let y = pageHeight - margin;

	const fontSize = 12;
	const lineHeight = fontSize + 4;
	const maxLineWidth = pageWidth - margin * 2;

	function wrapLine(lineText: string) {
		const words = lineText.split(/\s+/);
		const wrappedLines: string[] = [];
		let currentLine = "";

		for (let i = 0; i < words.length; i++) {
			const testLine = currentLine ? currentLine + " " + words[i] : words[i];
			const testLineWidth = font.widthOfTextAtSize(testLine, fontSize);
			if (testLineWidth > maxLineWidth && i > 0) {
				wrappedLines.push(currentLine);
				currentLine = words[i];
			} else {
				currentLine = testLine;
			}
		}
		if (currentLine) {
			wrappedLines.push(currentLine);
		}
		return wrappedLines;
	}

	const contentLines = content.split(/\r?\n/);
	for (const rawLine of contentLines) {
		const wrapped = wrapLine(rawLine);
		for (const subLine of wrapped) {
			if (y - lineHeight < margin) {
				page = pdfDoc.addPage();
				y = page.getSize().height - margin;
			}
			page.drawText(subLine, {
				x: margin,
				y,
				size: fontSize,
				font,
			});
			y -= lineHeight;
		}
		// If line was blank, add spacing
		if (wrapped.length === 0) {
			y -= lineHeight;
		}
	}

	const pdfBytes = await pdfDoc.save();
	fs.writeFileSync(path.join(folder, `${filename}.pdf`), pdfBytes);
}
