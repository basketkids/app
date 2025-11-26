class DiceBearManager {
    constructor() {
        this.avatarOptions = {
            skinColor: [
                { value: "614335", name: "Moreno Oscuro" },
                { value: "d08b5b", name: "Moreno" },
                { value: "ae5d29", name: "Moreno Claro" },
                { value: "edb98a", name: "Beige" },
                { value: "ffdbb4", name: "Claro" },
                { value: "fd9841", name: "Naranja" },
                { value: "f8d25c", name: "Amarillo" }
            ],
            top: ["hat", "hijab", "turban", "winterHat1", "winterHat02", "winterHat03", "winterHat04", "bob", "bun", "curly", "curvy", "dreads", "frida", "fro", "froBand", "longButNotTooLong", "miaWallace", "shavedSides", "straight02", "straight01", "straightAndStrand", "dreads01", "dreads02", "frizzle", "shaggy", "shaggyMullet", "shortCurly", "shortFlat", "shortRound", "shortWaved", "sides", "theCaesar", "theCaesarAndSidePart", "bigHair"],
            hairColor: [
                { value: "a55728", name: "Castaño" },
                { value: "2c1b18", name: "Negro" },
                { value: "b58143", name: "Castaño Claro" },
                { value: "d6b370", name: "Rubio Oscuro" },
                { value: "724133", name: "Marrón" },
                { value: "4a312c", name: "Marrón Oscuro" },
                { value: "f59797", name: "Rosa" },
                { value: "ecdcbf", name: "Platino" },
                { value: "c93305", name: "Pelirrojo" },
                { value: "e8e1e1", name: "Gris/Blanco" }
            ],
            eyes: ["closed", "cry", "default", "eyeRoll", "happy", "hearts", "side", "squint", "surprised", "winkWacky", "wink", "xDizzy"],
            eyebrows: ["angryNatural", "defaultNatural", "flatNatural", "frownNatural", "raisedExcitedNatural", "sadConcernedNatural", "unibrowNatural", "upDownNatural", "angry", "default", "raisedExcited", "sadConcerned", "upDown"],
            mouth: ["concerned", "default", "disbelief", "eating", "grimace", "sad", "screamOpen", "serious", "smile", "tongue", "twinkle", "vomit"]
        };

        this.selects = {};
        this.checkFacialHair = null;
        this.checkAccessories = null;
    }

    /**
     * Generates the DiceBear avatar URL
     * @param {string} seed - Unique seed for the avatar (e.g., playerId-date)
     * @param {object} config - Avatar configuration object
     * @param {string} teamJerseyColor - Team jersey color hex code
     * @returns {string} - The avatar URL
     */
    getImage(seed, config, teamJerseyColor = '5199e4') {
        const baseUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
        const params = [];

        // Apply user config or defaults
        if (config) {
            Object.keys(config).forEach(key => {
                // Skip hasFacialHair and hasAccessories as they're handled separately
                if (key === 'hasFacialHair' || key === 'hasAccessories') return;
                params.push(`${key}=${config[key]}`);
            });

            // Handle facial hair
            if (config.hasFacialHair) {
                params.push('facialHairType=beardMajestic'); // Default to light beard
                params.push('facialHairProbability=100');
            } else {
                params.push('facialHairProbability=0');
            }

            // Handle accessories
            if (config.hasAccessories) {
                params.push('accessoriesType=round');
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

        // Fixed clothing with team color
        params.push('clothing=shirtScoopNeck');
        params.push(`clothesColor=${teamJerseyColor}`);

        // Ensure top (hair/hat) always appears with 100% probability for determinism
        params.push('topProbability=100');

        return params.length ? `${baseUrl}&${params.join('&')}` : baseUrl;
    }

    /**
     * Initializes the editor elements and event listeners
     * @param {object} elements - Object containing references to DOM elements
     * @param {function} onChangeCallback - Callback function to execute when any value changes
     */
    initEditor(elements, onChangeCallback) {
        this.selects = elements.selects || {};
        this.checkFacialHair = elements.checkFacialHair;
        this.checkAccessories = elements.checkAccessories;

        Object.keys(this.selects).forEach(key => {
            const select = this.selects[key];
            if (!select) return;

            // Clear existing options first to avoid duplicates if called multiple times
            select.innerHTML = '';

            this.avatarOptions[key].forEach(item => {
                const option = document.createElement('option');

                // Check if item is an object with value and name, or just a string
                if (typeof item === 'object' && item.value) {
                    option.value = item.value;
                    option.textContent = item.name;
                } else {
                    option.value = item;
                    option.textContent = item;
                }

                select.appendChild(option);
            });

            select.addEventListener('change', () => onChangeCallback());
        });

        // Add event listener for facial hair checkbox
        if (this.checkFacialHair) {
            this.checkFacialHair.addEventListener('change', () => onChangeCallback());
        }

        // Add event listener for accessories checkbox
        if (this.checkAccessories) {
            this.checkAccessories.addEventListener('change', () => onChangeCallback());
        }
    }

    /**
     * Sets the character configuration in the form elements
     * @param {object} config - Avatar configuration object
     */
    setCharacter(config) {
        if (!config) {
            // Set defaults if no config provided
            config = {
                skinColor: 'ffdbb4',
                top: 'shortFlat',
                hairColor: 'a55728',
                eyes: 'default',
                eyebrows: 'default',
                mouth: 'default',
                hasFacialHair: false,
                hasAccessories: false
            };
        }

        Object.keys(config).forEach(key => {
            if (this.selects[key]) {
                this.selects[key].value = config[key];
            }
        });

        if (this.checkFacialHair) {
            this.checkFacialHair.checked = !!config.hasFacialHair;
        }

        if (this.checkAccessories) {
            this.checkAccessories.checked = !!config.hasAccessories;
        }
    }

    /**
     * Gets the current configuration object from the form elements
     * @returns {object} - Avatar configuration object
     */
    getObject() {
        const config = {};

        Object.keys(this.selects).forEach(key => {
            if (this.selects[key]) {
                config[key] = this.selects[key].value;
            }
        });

        if (this.checkFacialHair) {
            config.hasFacialHair = this.checkFacialHair.checked;
        } else {
            config.hasFacialHair = false;
        }

        if (this.checkAccessories) {
            config.hasAccessories = this.checkAccessories.checked;
        } else {
            config.hasAccessories = false;
        }

        return config;
    }
}
