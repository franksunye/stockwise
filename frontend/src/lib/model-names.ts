export function formatModelName(modelName: string | undefined | null): string {
    if (!modelName) return 'AI Model';

    const lower = modelName.toLowerCase();

    // DeepSeek
    if (lower.includes('deepseek')) {
        return 'DeepSeek V3'; // Assuming V3 is the current standard, or just 'DeepSeek'
    }

    // Gemini
    if (lower.includes('gemini')) {
        // If we want to distinguish Pro vs Flash later, we can add more logic
        return 'Gemini Pro';
    }

    // Hunyuan (Tencent)
    // Handle specific "lite" cases
    if ((lower.includes('hunyuan') || lower.includes('混元')) && lower.includes('lite')) {
        return 'Hunyuan Lite';
    }
    // Standard Hunyuan
    if (lower.includes('hunyuan') || lower.includes('混元')) {
        return 'Hunyuan Pro';
    }

    // GPT
    if (lower.includes('gpt-4')) return 'GPT-4';
    if (lower.includes('gpt-3.5') || lower.includes('gpt-3')) return 'GPT-3.5';

    // Fallback: If it's a known legacy name or just a raw string
    // Capitalize first letter if it looks like a single word
    if (!lower.includes(' ')) {
        return modelName.charAt(0).toUpperCase() + modelName.slice(1);
    }

    return modelName;
}
