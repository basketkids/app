import { environment } from '../../../environments/environment';

export class DicebearUtil {
    /**
     * Generates the DiceBear avatar URL
     * @param seed - Unique seed for the avatar (e.g., playerId-date)
     * @param config - Avatar configuration object
     * @param teamJerseyColor - Team jersey color hex code
     * @returns The avatar URL
     */
    static getAvatarUrl(
        seed: string,
        config?: Record<string, string | number | boolean> | null,
        teamJerseyColor: string = '5199e4'
    ): string {
        const baseUrl = `${environment.dicebearApiUrl}?seed=${seed}`;
        const params: string[] = [];

        // Apply user config or defaults
        if (config) {
            // MAP snake_case to camelCase for compatibility with Supabase data
            const mappedConfig: Record<string, any> = {};
            Object.keys(config).forEach((key) => {
                let newKey = key;
                if (key === 'skin_color') newKey = 'skinColor';
                if (key === 'hair_color') newKey = 'hairColor';
                if (key === 'hat_color') newKey = 'hatColor';
                if (key === 'facial_hair_type') newKey = 'facialHair';
                if (key === 'facial_hair_color') newKey = 'facialHairColor';
                if (key === 'accessories_type') newKey = 'accessories';
                if (key === 'accessories_color') newKey = 'accessoriesColor';
                if (key === 'clothes_color') newKey = 'clothesColor';
                if (key === 'clothing_graphic') newKey = 'clothingGraphic';
                mappedConfig[newKey] = config[key];
            });

            Object.keys(mappedConfig).forEach((key) => {
                // Skip hasFacialHair and hasAccessories as they're handled separately
                if (
                    key === 'hasFacialHair' ||
                    key === 'hasAccessories' ||
                    key === 'id' ||
                    key === 'created_at'
                ) {
                    return;
                }

                const value = mappedConfig[key];
                if (
                    value === null ||
                    value === undefined ||
                    value === 'null' ||
                    value === 'none' ||
                    value === ''
                ) {
                    return;
                }

                params.push(`${key}=${encodeURIComponent(value.toString())}`);
            });

            // Handle facial hair
            if (
                mappedConfig['hasFacialHair'] ||
                (mappedConfig['facialHair'] &&
                    mappedConfig['facialHair'] !== 'none' &&
                    mappedConfig['facialHair'] !== 'null' &&
                    mappedConfig['facialHair'] !== '')
            ) {
                if (!mappedConfig['facialHair'] || mappedConfig['facialHair'] === 'none') {
                    params.push('facialHair=beardMajestic');
                }
                params.push('facialHairProbability=100');
            } else {
                params.push('facialHairProbability=0');
            }

            // Handle accessories
            if (
                mappedConfig['hasAccessories'] ||
                (mappedConfig['accessories'] &&
                    mappedConfig['accessories'] !== 'none' &&
                    mappedConfig['accessories'] !== 'null' &&
                    mappedConfig['accessories'] !== '')
            ) {
                if (!mappedConfig['accessories'] || mappedConfig['accessories'] === 'none') {
                    params.push('accessories=round');
                }
                params.push('accessoriesProbability=100');
            } else {
                params.push('accessoriesProbability=0');
            }
        } else {
            // Set default neutral values
            params.push('skinColor=ffdbb4'); // Piel clara
            params.push('top=shortFlat'); // Pelo corto plano
            params.push('hairColor=a55728'); // Castaño
            params.push('eyes=default');
            params.push('eyebrows=default');
            params.push('mouth=default');
            params.push('facialHairProbability=0');
            params.push('accessoriesProbability=0');
        }

        let hasClothing = false;
        let hasClothesColor = false;

        // Check if we already added them
        params.forEach((p) => {
            if (p.startsWith('clothing=')) hasClothing = true;
            if (p.startsWith('clothesColor=')) hasClothesColor = true;
        });

        if (!hasClothing) {
            params.push('clothing=shirtScoopNeck');
        }

        // Only add team jersey color if no custom clothesColor is provided in config
        if (!hasClothesColor) {
            params.push(`clothesColor=${teamJerseyColor.replace('#', '')}`);
        }

        // Ensure top (hair/hat) always appears with 100% probability for determinism
        params.push('topProbability=100');

        return params.length
            ? `${baseUrl}&${params.join('&')}`
            : baseUrl;
    }
}
