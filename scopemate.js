import dotenv from "dotenv";
import puppeteer from "puppeteer";

import { generateCoverLetter, checkJobFitAndRole } from "./AIService.ts";
import { saveAsPDF } from "./PDFService.ts";

dotenv.config();

const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
const SCOPE_URL = "https://scope.sciencecoop.ubc.ca";

async function startScopeMate() {
	const { page, browser } = await initBrowser();

	await loginIfNeeded(page);

	await goToPostingsLink(page, "F25 - Early Sept 2025 Postings");

	await processPostings(page);

	console.log("✅ All jobs scanned.");
	// await browser.close();
}

startScopeMate();

async function initBrowser() {
	const browser = await puppeteer.launch({
		headless: false,
		userDataDir: "./my_scope_profile", // persistent session folder
		defaultViewport: null,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	const [page] = await browser.pages();
	await page.bringToFront();

	return { page, browser };
}

async function loginIfNeeded(page) {
	// Try to access postings directly
	await page.goto(`${SCOPE_URL}/myAccount/co-op/postings.htm`, {
		waitUntil: "networkidle2",
	});

	if (page.url().includes("notLoggedIn")) {
		console.log("🔒 Not logged in. Performing login...");

		// Go to the SCOPE login portal
		await page.goto(`${SCOPE_URL}/students/cwl-current-student-login.htm`);

		// Click the CWL Login button (anchor with Shibboleth SSO)
		await page.waitForSelector('a[href*="Shibboleth.sso"]');
		await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), page.click('a[href*="Shibboleth.sso"]')]);

		// Enter CWL username and password
		await page.waitForSelector("#username");
		await page.type("#username", USERNAME, { delay: 100 });
		await page.type("#password", PASSWORD, { delay: 100 });

		await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), page.click('button[name="_eventId_proceed"]')]);

		// Wait until URL shows we're logged into SCOPE
		console.log("✅ Waiting for you to approve 2FA on your phone...");
		await page.waitForFunction(() => window.location.href.includes("/myAccount/dashboard.htm"), { timeout: 0 });
		console.log("🎉 2FA complete. Logged in!");

		// Navigate back to postings
		await page.goto(`${SCOPE_URL}/myAccount/co-op/postings.htm`, {
			waitUntil: "networkidle2",
		});
	} else {
		console.log("✅ Already logged in using session cache.");
	}
}

async function goToPostingsLink(page, linkText) {
	console.log(`📂 Clicking the '${linkText}' link...`);

	await page.evaluate((text) => {
		const links = Array.from(document.querySelectorAll("a"));
		const target = links.find((link) => link.textContent.includes(text));
		if (target) target.click();
	}, linkText);

	// Wait a bit for postings to load
	await new Promise((resolve) => setTimeout(resolve, 3000));
}

async function processPostings(page) {
	console.log("🔍 Scanning job postings...");

	const jobRows = await page.$$('tr[id^="posting"]');
	console.log(`🔎 Found ${jobRows.length} job rows`);

	let count = 0;

	for (const row of jobRows) {
		const title = await row.$eval("td.orgDivTitleMaxWidth", (el) => el.getAttribute("title"));
		const companyName = await row.$$eval("td.orgDivTitleMaxWidth", (cells) => (cells.length > 1 ? cells[1].innerText.trim() : ""));
		const applyButton = await row.$("a.btn.btn-primary");

		console.log(`\n🚀 Opening job: ${title}`);

		// Open detail page in a new tab
		const [newPagePromise] = await Promise.all([
			new Promise((resolve) => {
				page.browser().once("targetcreated", async (target) => {
					const newPage = await target.page();
					await newPage.bringToFront();
					resolve(newPage);
				});
			}),
			applyButton.click(),
		]);

		const newPage = await newPagePromise;

		// Wait for job description
		await newPage.waitForSelector("span.np-view-question--28", { timeout: 15000 });
		const fullJobDescription = await newPage.$eval("span.np-view-question--28", (el) => el.innerText.trim());

		// Skip the first 12 postings
		if (count < 16) {
			count++;
			console.log(`Skipping job #${count}`);
			await newPage.close();
			await page.bringToFront();
			continue;
		}

		// Now handle postings starting from 13th onward
		count++;
		console.log(`Handling job #${count}: ${title}`);
		await processSinglePosting(newPage, page, title, companyName, fullJobDescription);

		break;
	}
}

async function processSinglePosting(newPage, mainPage, title, companyName, fullJobDescription) {
	// Ask the AI if it's a dev role and a good fit
	const { isDev, isFit, reason } = await checkJobFitAndRole(title, fullJobDescription);
	console.log(`🤖 AI says: { isDev: ${isDev}, isFit: ${isFit}, reason: "${reason}" }`);

	// If it's a dev role and a good fit, generate a cover letter
	if (isDev && isFit) {
		const safeFilename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
		await saveAsPDF(safeFilename, fullJobDescription, "job_descriptions");

		try {
			const coverLetter = await generateCoverLetter(companyName, fullJobDescription);
			await saveAsPDF(safeFilename, coverLetter, "cover_letters");
			console.log("📝 Cover letter generated and saved for:", title);
		} catch (err) {
			console.error("❌ Error generating cover letter:", err);
		}
	} else {
		console.log(`❌ Skipping cover letter for: ${title} (Not dev or not a fit)`);
	}

	// Close detail tab, bring main page to front
	await newPage.close();
	await mainPage.bringToFront();
}
