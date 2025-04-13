const puppeteer = require("puppeteer");
require("dotenv").config();

const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
const SCOPE_URL = "https://scope.sciencecoop.ubc.ca";

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

const login = async () => {
	const browser = await puppeteer.launch({
		headless: false,
		userDataDir: "./my-scope-profile", // persistent session folder
		defaultViewport: null,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	const [page] = await browser.pages();
	await page.bringToFront();

	// Try to access postings directly
	await page.goto(`${SCOPE_URL}/myAccount/co-op/postings.htm`, { waitUntil: "networkidle2" });

	if (page.url().includes("notLoggedIn")) {
		console.log("🔒 Not logged in. Performing login...");
		console.log("HEY2");

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
		await page.goto(`${SCOPE_URL}/myAccount/co-op/postings.htm`, { waitUntil: "networkidle2" });
	} else {
		console.log("✅ Already logged in using session cache.");
	}

	console.log("📂 Clicking the 'F25 - Early Sept 2025 Postings' link...");

	await page.evaluate(() => {
		const links = Array.from(document.querySelectorAll("a"));
		const target = links.find((link) => link.textContent.includes("F25 - Early Sept 2025 Postings"));
		if (target) target.click();
	});

	await new Promise((resolve) => setTimeout(resolve, 3000));
	console.log("🔍 Scanning job postings...");

	const jobRows = await page.$$('tr[id^="posting"]');

	console.log(`🔎 Found ${jobRows.length} job rows`);

	for (const row of jobRows) {
		const title = await row.$eval("td.orgDivTitleMaxWidth", (el) => el.getAttribute("title"));
		const applyButton = await row.$("a.btn.btn-primary");
		if (!applyButton) continue;

		console.log(`\n🚀 Opening job: ${title}`);
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const [newPagePromise] = await Promise.all([
			new Promise((resolve) =>
				page.browser().once("targetcreated", async (target) => {
					const newPage = await target.page();
					await newPage.bringToFront();
					resolve(newPage);
				})
			),
			applyButton.click(),
		]);

		const newPage = await newPagePromise;

		try {
			await newPage.waitForSelector("span.np-view-question--28", { timeout: 15000 });
			const fullJobDescription = await newPage.$eval("span.np-view-question--28", (el) => el.innerText.trim());

			console.log(fullJobDescription);

			// const safeFilename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
			// if (!fs.existsSync("job_descriptions")) fs.mkdirSync("job_descriptions");
			// fs.writeFileSync(path.join("job_descriptions", `${safeFilename}.txt`), fullJobDescription);

			console.log("📄 Saved full job description:", title);
		} catch (err) {
			console.error(`❌ Failed to extract job: ${err.message}`);
			await newPage.screenshot({ path: `error_${Date.now()}.png` });
		}

		await newPage.close();
		await page.bringToFront();

		break;
	}

	console.log("✅ All jobs scanned.");
};

login();
