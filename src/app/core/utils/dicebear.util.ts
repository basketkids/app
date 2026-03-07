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
        const baseUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
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
                if (key === 'facial_hair_type') newKey = 'facialHairType';
                if (key === 'facial_hair_color') newKey = 'facialHairColor';
                if (key === 'accessories_type') newKey = 'accessoriesType';
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
                if (value === null || value === undefined || value === 'null') {
                    return;
                }

                params.push(`${key}=${encodeURIComponent(value.toString())}`);
            });

            // Handle facial hair
            if (
                mappedConfig['hasFacialHair'] ||
                (mappedConfig['facialHairType'] &&
                    mappedConfig['facialHairType'] !== 'none' &&
                    mappedConfig['facialHairType'] !== 'null')
            ) {
                if (!mappedConfig['facialHairType']) {
                    params.push('facialHairType=beardMajestic');
                }
                params.push('facialHairProbability=100');
            } else {
                params.push('facialHairProbability=0');
            }

            // Handle accessories
            if (
                mappedConfig['hasAccessories'] ||
                (mappedConfig['accessoriesType'] &&
                    mappedConfig['accessoriesType'] !== 'none' &&
                    mappedConfig['accessoriesType'] !== 'null')
            ) {
                if (!mappedConfig['accessoriesType']) {
                    params.push('accessoriesType=round');
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

        // Always force team jersey color unless explicitly handled differently
        // Usually team app implies team jersey.
        // Replace existing clothesColor if any.
        const filteredParams = params.filter((p) => !p.startsWith('clothesColor='));
        filteredParams.push(`clothesColor=${teamJerseyColor.replace('#', '')}`);

        // Ensure top (hair/hat) always appears with 100% probability for determinism
        filteredParams.push('topProbability=100');

        return filteredParams.length
            ? `${baseUrl}&${filteredParams.join('&')}`
            : baseUrl;
    }
}
