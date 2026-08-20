import "server-only";
import OpenAI from "openai";
import { AI_CONFIG } from "./config";

export const aiClient = new OpenAI({
  baseURL: AI_CONFIG.baseURL,
  apiKey: AI_CONFIG.apiKey || "missing-key",
});
