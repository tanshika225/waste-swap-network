import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface WasteAnalysis {
  category: string;
  isBiodegradable: boolean;
  estimatedWeightKg: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'scrap';
  repairability: 'high' | 'medium' | 'low' | 'none';
  description: string;
  confidence: number;
}

export async function analyzeWaste(base64Image: string): Promise<WasteAnalysis> {
  const model = "gemini-3-flash-preview";
  const prompt = `Analyze this waste item from the image. Provide:
  1. Category: plastic, paper, metal, glass, organic, or other.
  2. Biodegradability: true if it's biodegradable, false otherwise.
  3. Estimated Weight: A realistic estimate of the weight in kilograms (kg) based on the item's size and material.
  4. Condition: excellent, good, fair, poor, or scrap.
  5. Repairability: high, medium, low, or none.
  6. Description: A short, professional description of the item.
  7. Confidence: A number between 0 and 1 representing your confidence in this analysis.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1] || base64Image
            }
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, description: "One of: plastic, paper, metal, glass, organic, other" },
          isBiodegradable: { type: Type.BOOLEAN },
          estimatedWeightKg: { type: Type.NUMBER },
          condition: { type: Type.STRING, description: "One of: excellent, good, fair, poor, scrap" },
          repairability: { type: Type.STRING, description: "One of: high, medium, low, none" },
          description: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        },
        required: ["category", "isBiodegradable", "estimatedWeightKg", "condition", "repairability", "description", "confidence"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text);
    return data;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return {
      category: "other",
      isBiodegradable: false,
      estimatedWeightKg: 0,
      condition: "scrap",
      repairability: "none",
      description: "Could not analyze the item clearly.",
      confidence: 0
    };
  }
}
