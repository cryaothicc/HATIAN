import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB base64
const ALLOWED = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const receiptSchema = z.object({
  isReceipt: z.boolean(),
  items: z.array(z.object({ label: z.string(), amount: z.number() })),
  tax: z.number().nullable(),
  serviceCharge: z.number().nullable(),
  total: z.number().nullable(),
});

const SYSTEM = `You read photos of shop and restaurant receipts (often from the Philippines, in PHP).
Extract every purchased line item with its final line price (quantity x unit price) as a plain number.
Use short readable labels (keep Filipino dish names). Exclude subtotal, total, cash, change and payment lines from items.
Report VAT (or other tax) and service charge separately as numbers if printed, otherwise null. Report the printed grand total or null.
If the image is not a receipt, set isReceipt false and return empty items.`;

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Receipt scanning is not configured." },
      { status: 500 },
    );
  }

  let image: unknown;
  try {
    ({ image } = await req.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (
    typeof image !== "string" ||
    image.length > MAX_IMAGE_CHARS ||
    !ALLOWED.test(image)
  ) {
    return Response.json(
      { error: "Please upload a JPG, PNG or WebP photo under 6 MB." },
      { status: 400 },
    );
  }

  try {
    const google = createGoogleGenerativeAI({ apiKey });

    const { object } = await generateObject({
      model: google("gemini-1.5-flash"),
      schema: receiptSchema,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the items, prices, tax and service charge from this receipt.",
            },
            {
              type: "image",
              image: image,
            },
          ],
        },
      ],
    });

    return Response.json(object);
  } catch (error) {
    const status = Number((error as { statusCode?: number })?.statusCode) || 500;
    console.error("scan-receipt failed:", (error as Error)?.message);
    if (status === 429)
      return Response.json(
        { error: "Too many requests — please wait a moment and try again." },
        { status: 429 },
      );
    if (status === 401 || status === 403)
      return Response.json(
        { error: "Invalid Google AI API key." },
        { status: 401 },
      );
    return Response.json(
      { error: "Couldn't read that receipt. Try a clearer, well-lit photo." },
      { status: 500 },
    );
  }
}
