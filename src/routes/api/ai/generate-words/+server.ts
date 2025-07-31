import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const POST: RequestHandler = async ({ request }) => {
  if (!OPENAI_API_KEY) {
    throw error(500, "OpenAI API key not configured");
  }

  try {
    const { topic } = await request.json();

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      throw error(400, "Topic is required and must be a non-empty string");
    }

    const prompt = `Generate exactly 50 unique and interesting bingo items for the topic: "${topic.trim()}"

Requirements:
- Each item should be 1-4 words maximum
- Items should be specific and observable/actionable things related to ${topic.trim()}
- Mix of things you might see, do, hear, or experience
- Make them engaging and fun for a bingo game
- No duplicates
- Return only the list items, one per line
- No numbers, bullets, or extra formatting
- Provide good variety so users can choose their favorites

Examples for "Cruise Ship":
- Buffet line
- Dolphin sighting
- Formal night
- Pool deck games
- Captain announcement

Generate 50 items for: ${topic.trim()}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a creative assistant that generates perfect bingo items. Always return exactly 50 items, one per line, with no extra formatting.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      throw error(500, "Failed to generate words from OpenAI");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw error(500, "No content received from OpenAI");
    }

    // Parse the response into an array of words/phrases
    const words = content
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => {
        // Remove any remaining bullets, numbers, or dashes
        return line.replace(/^[-•*\d+\.\)\s]+/, "").trim();
      })
      .filter((line: string) => line.length > 0)
      .slice(0, 50); // Ensure exactly 50 items

    // If we don't have enough items, add some generic ones
    while (words.length < 50) {
      words.push(`${topic.trim()} experience ${words.length + 1}`);
    }

    return json({
      success: true,
      topic: topic.trim(),
      words: words.slice(0, 50), // Ensure exactly 50
      count: words.length,
    });
  } catch (err) {
    console.error("Error generating words:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to generate bingo words");
  }
};
