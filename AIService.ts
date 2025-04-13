import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY;

const openai = new OpenAI({
	baseURL: "https://openrouter.ai/api/v1",
	apiKey: OPEN_ROUTER_API_KEY,
});

export async function checkJobFitAndRole(title: string, description: string) {
	let parsed;
	let rawText = "";

	const response = await openai.chat.completions.create({
		model: "google/gemini-2.0-flash-exp:free",
		messages: [
			{
				role: "system",
				content: `
          You are an AI assistant that analyzes a job title and job description. 

          Your task is to determine:
            1) Is it a “developer role”?
            2) If yes, does it align with the user's developer interests listed below?

          The user's primary developer interests are:
            - Frontend
            - Backend
            - Full Stack
            - Web Development
            - Mobile App Development
            - Game Development
            - QA Automation / Testing

          Your final answer must be valid JSON **only** in this exact format:
            {
              "isDev": boolean,
              "isFit": boolean,
              "reason": string
            }
          
          Where:
            - "isDev" is true if the job is a software, web, or app developer role of any kind, else false.
            - "isFit" is true if it specifically matches one (or more) of the user’s interests listed above, else false.
            - "reason" is a short sentence explaining your reasoning.

          Do NOT include triple backticks, code fences, or any text outside the JSON object.
        `,
			},
			{
				role: "user",
				content: `
          Title: ${title}

          Description: ${description}

          Return valid JSON only, in the specified format. No extra text or markdown.
        `,
			},
		],
	});

	const choice = response?.choices?.[0];
	if (!choice || !choice.message?.content) {
		console.error("OpenRouter returned no content or an unexpected response:", response);
		return { isDev: false, isFit: false, reason: "No valid response from AI" };
	}

	rawText = choice.message.content.trim();

	// Remove any triple backticks or code fences if they exist
	// This regex removes ```json, ``` and any language hinting
	rawText = rawText
		.replace(/```[\w]*\n?/g, "")
		.replace(/```/g, "")
		.trim();

	try {
		parsed = JSON.parse(rawText);
	} catch (error) {
		console.error("Failed to parse JSON from AI. Full text:", rawText);
		return { isDev: false, isFit: false, reason: "Parsing error" };
	}

	return {
		isDev: !!parsed.isDev,
		isFit: !!parsed.isFit,
		reason: parsed.reason || "",
	};
}

const coverLetterTemplate = `
  February 18, 2025

  Demonware
  369 Terminal Ave, 
  Vancouver, BC V6A 4C4

  Re: Software Development Co-op - May 2025 - Demonware (Vancouver)

  Dear Hiring Manager,

  As a passionate Software Developer with a dream to work for and 
  learn from a company that powers some of the world’s biggest 
  gaming companies, I am thrilled to see this Software Development
  Co-op opportunity at Demonware. I am inspired by how Demonware 
  delivers scalable and cutting-edge online services, enabling 
  seamless multiplayer experiences for millions of players. With a 
  strong foundation in object-oriented design principles, data 
  structures, and skills in Python, C++, and JavaScript, I am c
  onfident that I would be a great fit at Demonware.

  Among my relevant technical projects, I have developed a 
  full-stack UNO card game system, using MySQL, Node.js, and 
  Express.js to manage players, memberships, game events, and 
  match data across multiple pages. This project followed the 
  MVC architecture and implemented a RESTful API, enabling 
  efficient backend logic while integrating cookies and local 
  storage for seamless authentication and session management. 
  Additionally, I designed a responsive UI using EJS templates, 
  incorporating comprehensive form validation, asynchronous data 
  fetching, and real-time user interactions to enhance the user 
  experience. On the backend, I structured SQL DDL and DML 
  templates to process complex user queries while implementing 
  sanitization techniques to mitigate security risks such as SQL 
  injection attacks. Through this experience, I strengthened my 
  ability to design scalable software architectures, troubleshoot 
  technical issues, and write maintainable code. 

  Beyond my technical background, my experience as a Badminton 
  Coach at Master Badminton has strengthened my communication, 
  critical thinking, and leadership skills. I collaborated with 
  two other coaches to train players in game techniques and 
  tactics, analyzed over 100 hours of match footage, and provided 
  personalized feedback to enhance their performance. These 
  experiences have enhanced my ability to work in a team oriented, 
  fast-paced environment, a skill that I believe is essential in 
  agile software development. 

  I would love the opportunity to bring my technical expertise 
  and teamwork skills to Demonware. Please contact me directly 
  at guyuchen999@gmail.com or through UBC at interviews@sciencecoop.ubc.ca 
  to arrange an interview. I am fully committed to delivering 
  high-quality work and contributing to your team’s success!!!

  Best regards,

  Yuchen Gu	
`;

export async function generateCoverLetter(companyName: string, jobDescription: string): Promise<string> {
	if (!jobDescription) {
		throw new Error("No job description provided");
	}

	const today = new Date();
	const formattedDate = today.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	});

	const completion = await openai.chat.completions.create({
		model: "google/gemini-2.0-flash-exp:free",
		messages: [
			{
				role: "system",
				content: `
          You are an expert AI assistant that revises cover letters according to a given template and new job details. 
          You only output the updated cover letter text—no extraneous comments, disclaimers, or markdown.

          Instructions:
            1. Use the user's original cover letter structure and wording as much as possible.
            2. Replace references to the old company name, and address with the new ones.
            3. Update the "Re:" line, the first paragraph, and the final paragraph to reflect the new company details and role.
            4. Insert today's date.
            5. If the job description does NOT provide a valid company address or postal code, perform a web search for the company's official address/zip/postal code.
              - If you find it, replace the address in the letter with the newly found information.
              - If no valid info is found, leave a placeholder or mention the address is unknown.
            6. Use simpler language where it improves clarity.
            7. Keep the tone confident but not overly formal.
            8. Absolutely do not include anything outside of the cover letter text (no code fences, no triple backticks, no disclaimers).
        `,
			},
			{
				role: "user",
				content: `
          Today's Date: ${formattedDate}
          Company Name: ${companyName}
          Original Cover Letter: ${coverLetterTemplate}
          Job Description:${jobDescription}

          Rewrite the cover letter to match these new details. 
          If there's no address in the job description, do a web search for the company's address and postal code. 
          Output only the revised cover letter text.
        `,
			},
		],
	});

	return completion.choices?.[0]?.message?.content?.trim() || "";
}

// async function main() {
// 	const completion = await openai.chat.completions.create({
// 		model: "google/gemini-2.0-flash-exp:free",
// 		messages: [
// 			{
// 				role: "user",
// 				content: [
// 					{
// 						type: "text",
// 						text: "Can you write a paragraph about university life",
// 					},
// 					// {
// 					// 	type: "image_url",
// 					// 	image_url: {
// 					// 		url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
// 					// 	},
// 					// },
// 				],
// 			},
// 		],
// 	});

// 	console.log(completion.choices[0].message);
// }

// main();
