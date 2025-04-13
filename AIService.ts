import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
const { OPEN_ROUTER_API_KEY } = process.env;
console.log(OPEN_ROUTER_API_KEY);

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPEN_ROUTER_API_KEY,
});
async function main() {
  const completion = await openai.chat.completions.create({
    model: "moonshotai/kimi-vl-a3b-thinking:free",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "What is in this image?",
          },
          {
            type: "image_url",
            image_url: {
              url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
            },
          },
        ],
      },
    ],
  });

  console.log(completion.choices[0].message);
}

main();
