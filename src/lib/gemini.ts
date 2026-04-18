import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export const getGeminiChat = (systemInstruction: string) => {
  return ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config: {
      systemInstruction,
    }
  });
};
