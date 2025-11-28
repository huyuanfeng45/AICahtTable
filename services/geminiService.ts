import { GoogleGenAI } from "@google/genai";
import { Persona, Message, AppSettings, ProviderConfig } from "../types";

// Helper: Standard OpenAI-Compatible API Call
async function callOpenAICompatibleAPI(
  persona: Persona | null, // null for system tasks
  messages: { role: string; content: string }[],
  config: ProviderConfig,
  modelId: string
): Promise<string> {
  const { apiKey, baseUrl } = config;

  if (!apiKey) {
    throw new Error(`缺少 API Key (${config.baseUrl})`);
  }

  // Ensure baseUrl doesn't end with slash if we append /chat/completions
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelId, // Use the specific model ID from persona config
        messages: [
          // System prompt if provided (for Persona) or generic for tasks
          ...(persona ? [{ role: 'system', content: `你正在扮演一个叫 "${persona.name}" 的角色参与群聊。你的性格设定是: ${persona.systemInstruction}. 请用中文回复，字数控制在100字以内。` }] : []),
          ...messages
        ],
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API Error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '(无回复)';
  } catch (error) {
    console.error("OpenAI Compatible API Call Failed:", error);
    throw error;
  }
}

/**
 * Generates a response from a specific AI persona based on the conversation history.
 */
export const generatePersonaResponse = async (
  persona: Persona,
  currentPrompt: string,
  history: Message[],
  allPersonas: Persona[],
  settings: AppSettings
): Promise<string> => {
  
  // Determine which Provider and Model to use for this specific Persona
  // Fallback to global active provider/model if persona config is missing (backward compatibility)
  const providerId = persona.config?.provider || settings.activeProvider;
  const globalConfig = settings.providerConfigs[providerId];
  
  // For model, if persona has a specific one, use it. Otherwise use the default from that provider's config
  const modelId = persona.config?.modelId || globalConfig.selectedModel;

  // --- GOOGLE GEMINI NATIVE PATH ---
  if (providerId === 'gemini') {
    // Prefer settings API Key, then env
    const apiKey = globalConfig.apiKey || process.env.API_KEY || ''; 
    const ai = new GoogleGenAI({ apiKey });

    if (!apiKey) {
      return `Error: Gemini API Key is missing. Please check Settings > Model Access.`;
    }

    try {
      const historyText = history.map(msg => {
        const senderName = msg.isUser ? "用户(User)" : (allPersonas.find(p => p.id === msg.senderId)?.name || "Unknown AI");
        return `${senderName}: ${msg.content}`;
      }).join('\n');

      const promptContext = `
        这是一个多人聊天室的场景。
        
        历史聊天记录:
        ${historyText}
        
        用户刚才提问: "${currentPrompt}"
        
        轮到你发言了。
        请记住你的设定: ${persona.systemInstruction}
        
        请根据前文的讨论，以你的角色回复。不要重复别人的话，要有自己的观点。保持口语化，像在群聊一样。字数控制在100字以内。
      `;

      let thinkingConfig = undefined;
      
      // If thinking enabled globally AND it's a model that supports it (2.5 series typically)
      // Or if the specific model implies thinking. For now, rely on global flag + model name check
      if (settings.enableThinking && modelId.includes('2.5')) {
         thinkingConfig = { thinkingBudget: 2048 }; 
      }

      const response = await ai.models.generateContent({
        model: modelId,
        contents: promptContext, 
        config: {
          systemInstruction: `你正在扮演一个叫 "${persona.name}" 的角色参与群聊。你的性格设定是: ${persona.systemInstruction}`,
          temperature: 0.8,
          ...(thinkingConfig ? { thinkingConfig } : {})
        }
      });

      return response.text || '(沉默)';
    } catch (error) {
      console.error(`Gemini Error for ${persona.name}:`, error);
      return `(Gemini Error: ${error instanceof Error ? error.message : 'Unknown'})`;
    }
  } 
  
  // --- OPENAI COMPATIBLE PATH (DeepSeek, Qwen, OpenAI) ---
  else {
    const config = settings.providerConfigs[providerId];
    if (!config) return `Configuration for ${providerId} not found.`;
    
    // Construct messages for Chat Completion
    const messages = history.map(msg => {
       const sender = allPersonas.find(p => p.id === msg.senderId);
       const prefix = msg.isUser ? "User" : (sender?.name || "AI");
       
       return {
         role: msg.isUser ? 'user' : 'assistant', 
         content: `${prefix}: ${msg.content}`
       };
    });

    messages.push({ role: 'user', content: currentPrompt });

    try {
      return await callOpenAICompatibleAPI(persona, messages, config, modelId);
    } catch (error) {
      return `(${providerId} 错误: ${error instanceof Error ? error.message : 'Check Console'})`;
    }
  }
};

/**
 * Generates a short name (3-10 chars) for the chat group based on history.
 */
export const generateChatName = async (
  history: Message[],
  allPersonas: Persona[],
  settings: AppSettings
): Promise<string> => {
  if (!history || history.length === 0) return "新群聊";

  const providerId = settings.activeProvider;
  const config = settings.providerConfigs[providerId];
  const modelId = config.selectedModel;

  // Use last 20 messages for context
  const recentHistory = history.slice(-20);
  const historyText = recentHistory.map(msg => {
     const senderName = msg.isUser ? "用户" : (allPersonas.find(p => p.id === msg.senderId)?.name || "AI");
     return `${senderName}: ${msg.content}`;
  }).join('\n');

  const prompt = `
    请阅读以下聊天记录，并生成一个简洁的群聊名称。
    
    要求：
    1. 必须精准反映聊天的主题。
    2. 字数严格限制在 3 到 10 个汉字之间。
    3. 只返回名称，不要包含任何标点符号、引号或解释性文字。
    
    聊天记录:
    ${historyText}
  `;

  // --- Gemini Path ---
  if (providerId === 'gemini') {
      const apiKey = config.apiKey || process.env.API_KEY || '';
      if (!apiKey) throw new Error("Missing Gemini API Key");
      
      const ai = new GoogleGenAI({ apiKey });
      try {
          const response = await ai.models.generateContent({
              model: modelId,
              contents: prompt
          });
          return response.text?.trim() || "AI 群聊";
      } catch (e) {
          console.error("Generate name failed", e);
          throw e;
      }
  } 
  // --- Other Providers ---
  else {
      const messages = [{ role: 'user', content: prompt }];
      return await callOpenAICompatibleAPI(null, messages, config, modelId);
  }
};

/**
 * Generates a visual description prompt for an avatar based on group name.
 */
export const generateImagePrompt = async (
  groupName: string,
  settings: AppSettings
): Promise<string> => {
  const providerId = settings.activeProvider;
  const config = settings.providerConfigs[providerId];
  const modelId = config.selectedModel;

  const prompt = `
    Based on the chat group name "${groupName}", describe a simple, clean, and modern icon or visual scene in English.
    
    Requirements:
    1. Return ONLY the English description phrase.
    2. Keep it under 10 words.
    3. No explanations, no "Here is...", just the visual description.
    
    Example: "futuristic blue robot circuit board" or "coffee cup on a wooden table"
  `;

  try {
      if (providerId === 'gemini') {
          const apiKey = config.apiKey || process.env.API_KEY || '';
          if (!apiKey) throw new Error("Missing API Key");
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({ model: modelId, contents: prompt });
          return response.text?.trim() || "abstract geometric shapes";
      } else {
          const messages = [{ role: 'user', content: prompt }];
          return await callOpenAICompatibleAPI(null, messages, config, modelId);
      }
  } catch (e) {
      console.error("Generate image prompt failed", e);
      return "abstract art";
  }
};
