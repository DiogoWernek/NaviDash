import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export async function POST(req: NextRequest) {
  const body = await req.json() as { brief?: string };
  const { brief } = body;

  if (!brief?.trim()) {
    return NextResponse.json({ error: "Brief é obrigatório" }, { status: 400 });
  }

  if (!anthropic) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `You are an expert at writing detailed image generation prompts for Gemini Imagen and similar AI image generators.
Given a brief about a Meta Ads campaign, generate a single highly detailed image prompt in English.

Rules:
- Write only in English
- No text overlays, no words, no readable signs or labels in the image
- Be very specific about: composition, lighting, mood, color palette, subjects, camera angle, photography style
- Professional advertisement photography quality
- Suitable for Meta Ads (Facebook/Instagram feed or stories)
- Output ONLY the prompt text — no explanations, no labels, no markdown, no quotes`,
      messages: [{ role: "user", content: `Ad campaign brief:\n${brief.trim()}` }],
    });

    const raw = message.content[0];
    if (raw.type !== "text") throw new Error("Resposta inesperada do Claude");

    return NextResponse.json({ prompt: raw.text.trim() });
  } catch (err) {
    console.error("[generate-image-prompt]", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
