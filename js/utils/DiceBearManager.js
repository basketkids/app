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

            // Check if this key exists in avatarOptions
            const options = this.avatarOptions[key];
            if (!options) {
                // Skip if no options defined (will be populated by createSelectGroup)
                return;
            }

            options.forEach(item => {
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



    getObjectFromEditor(selects, checkboxes) {
        const config = {};

        Object.keys(selects).forEach(key => {
            if (selects[key] && selects[key].value) {
                config[key] = selects[key].value;
            }
        });

        return config;
    }

    getImageForProfile(seed, config) {
        const baseUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
        const params = [];

        if (config) {
            Object.keys(config).forEach(key => {
                // Skip these as they're handled specially
                if (key === 'hasFacialHair' || key === 'hasAccessories' || key === 'facialHairType' || key === 'accessoriesType') return;
                params.push(`${key}=${config[key]}`);
            });

            // Handle facial hair
            if (config.facialHairType && config.facialHairType !== 'none') {
                params.push(`facialHair=${config.facialHairType}`);
                params.push('facialHairProbability=100');
            } else {
                params.push('facialHairProbability=0');
            }

            // Handle accessories
            if (config.accessoriesType && config.accessoriesType !== 'none') {
                params.push(`accessories=${config.accessoriesType}`);
                params.push('accessoriesProbability=100');
            } else {
                params.push('accessoriesProbability=0');
            }
        }

        // Always set probabilities to 100 for deterministic results
        //  params.push('topProbability=100');

        return params.length ? `${baseUrl}&${params.join('&')}` : baseUrl;
    }

    createSelectGroup(label, name, options) {
        const group = document.createElement('div');
        group.className = 'mb-3';

        const labelEl = document.createElement('label');
        labelEl.className = 'form-label';
        labelEl.textContent = label;
        labelEl.setAttribute('for', name);

        const select = document.createElement('select');
        select.className = 'form-select form-select-sm';
        select.id = name;

        // Populate options
        if (options && Array.isArray(options)) {
            options.forEach(item => {
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
        }

        group.appendChild(labelEl);
        group.appendChild(select);

        return group;
    }

    /**
     * Gets the config from the current editor state
     */
    getConfigFromEditor() {
        return this.getObject();
    }

    /**
     * Opens a simple editor UI in a container
     * @param {string} seed - Unique seed for the avatar
     * @param {object} config - Current avatar configuration
     * @param {string} teamJerseyColor - Team jersey color hex code
     * @param {HTMLElement} controlsContainer - Container for controls
     * @param {HTMLImageElement} previewImage - Image element for preview
     */
    openEditor(seed, config, teamJerseyColor, controlsContainer, previewImage) {
        controlsContainer.innerHTML = '';

        // Create select elements
        const selects = {};

        // Skin Color
        const skinColorGroup = this.createSelectGroup('Tono de Piel', 'skinColor', this.avatarOptions.skinColor);
        controlsContainer.appendChild(skinColorGroup);
        selects.skinColor = skinColorGroup.querySelector('select');

        // Hair/Top
        const topGroup = this.createSelectGroup('Peinado/Gorro', 'top', this.avatarOptions.top);
        controlsContainer.appendChild(topGroup);
        selects.top = topGroup.querySelector('select');

        // Hair Color
        const hairColorGroup = this.createSelectGroup('Color de Pelo', 'hairColor', this.avatarOptions.hairColor);
        controlsContainer.appendChild(hairColorGroup);
        selects.hairColor = hairColorGroup.querySelector('select');

        // Hat Color (for hats/turbans)
        const hatColorOptions = [
            { value: '262e33', name: 'Negro' },
            { value: '65c9ff', name: 'Azul Claro' },
            { value: '5199e4', name: 'Azul' },
            { value: '25557c', name: 'Azul Oscuro' },
            { value: 'e6e6e6', name: 'Gris Claro' },
            { value: '929598', name: 'Gris' },
            { value: '3c4f5c', name: 'Gris Oscuro' },
            { value: 'b1e2ff', name: 'Celeste' },
            { value: 'a7ffc4', name: 'Verde' },
            { value: 'ffafb9', name: 'Rosa' },
            { value: 'ffffb1', name: 'Amarillo' },
            { value: 'ff488e', name: 'Rosa Fuerte' },
            { value: 'ff5c5c', name: 'Rojo' },
            { value: 'ffffff', name: 'Blanco' }
        ];
        const hatColorGroup = this.createSelectGroup('Color de Gorro/Sombrero', 'hatColor', hatColorOptions);
        controlsContainer.appendChild(hatColorGroup);
        selects.hatColor = hatColorGroup.querySelector('select');

        // Facial Hair Type
        const facialHairTypes = [
            { value: 'none', name: 'Ninguno' },
            { value: 'beardLight', name: 'Barba Ligera' },
            { value: 'beardMajestic', name: 'Barba Majestuosa' },
            { value: 'beardMedium', name: 'Barba Media' },
            { value: 'moustacheFancy', name: 'Bigote Elegante' },
            { value: 'moustacheMagnum', name: 'Bigote Magnum' }
        ];
        const facialHairTypeGroup = this.createSelectGroup('Tipo de Barba/Bigote', 'facialHairType', facialHairTypes);
        controlsContainer.appendChild(facialHairTypeGroup);
        selects.facialHairType = facialHairTypeGroup.querySelector('select');

        // Facial Hair Color
        const facialHairColorGroup = this.createSelectGroup('Color de Barba', 'facialHairColor', this.avatarOptions.hairColor);
        controlsContainer.appendChild(facialHairColorGroup);
        selects.facialHairColor = facialHairColorGroup.querySelector('select');

        // Eyes
        const eyesGroup = this.createSelectGroup('Ojos', 'eyes', this.avatarOptions.eyes);
        controlsContainer.appendChild(eyesGroup);
        selects.eyes = eyesGroup.querySelector('select');

        // Eyebrows
        const eyebrowsGroup = this.createSelectGroup('Cejas', 'eyebrows', this.avatarOptions.eyebrows);
        controlsContainer.appendChild(eyebrowsGroup);
        selects.eyebrows = eyebrowsGroup.querySelector('select');

        // Mouth
        const mouthGroup = this.createSelectGroup('Boca', 'mouth', this.avatarOptions.mouth);
        controlsContainer.appendChild(mouthGroup);
        selects.mouth = mouthGroup.querySelector('select');

        // Accessories Type
        const accessoriesTypes = [
            { value: 'none', name: 'Ninguno' },
            { value: 'kurt', name: 'Kurt' },
            { value: 'prescription01', name: 'Prescripción 01' },
            { value: 'prescription02', name: 'Prescripción 02' },
            { value: 'round', name: 'Redondas' },
            { value: 'sunglasses', name: 'Gafas de Sol' },
            { value: 'wayfarers', name: 'Wayfarers' }
        ];
        const accessoriesTypeGroup = this.createSelectGroup('Tipo de Gafas', 'accessoriesType', accessoriesTypes);
        controlsContainer.appendChild(accessoriesTypeGroup);
        selects.accessoriesType = accessoriesTypeGroup.querySelector('select');

        // Accessories Color
        const accessoriesColorGroup = this.createSelectGroup('Color de Gafas', 'accessoriesColor', hatColorOptions);
        controlsContainer.appendChild(accessoriesColorGroup);
        selects.accessoriesColor = accessoriesColorGroup.querySelector('select');

        // Clothing
        const clothingOptions = ['blazerAndShirt', 'blazerAndSweater', 'collarAndSweater', 'graphicShirt', 'hoodie', 'overall', 'shirtCrewNeck', 'shirtScoopNeck', 'shirtVNeck'];
        const clothingGroup = this.createSelectGroup('Ropa', 'clothing', clothingOptions);
        controlsContainer.appendChild(clothingGroup);
        selects.clothing = clothingGroup.querySelector('select');

        // Clothing Color
        const clothingColorOptions = [
            { value: '262e33', name: 'Negro' },
            { value: '65c9ff', name: 'Azul Claro' },
            { value: '5199e4', name: 'Azul' },
            { value: '25557c', name: 'Azul Oscuro' },
            { value: 'e6e6e6', name: 'Gris Claro' },
            { value: '929598', name: 'Gris' },
            { value: '3c4f5c', name: 'Gris Oscuro' },
            { value: 'b1e2ff', name: 'Celeste' },
            { value: 'a7ffc4', name: 'Verde' },
            { value: 'ffafb9', name: 'Rosa' },
            { value: 'ffffb1', name: 'Amarillo' },
            { value: 'ff488e', name: 'Rosa Fuerte' },
            { value: 'ff5c5c', name: 'Rojo' },
            { value: 'ffffff', name: 'Blanco' }
        ];
        const clothingColorGroup = this.createSelectGroup('Color de Ropa', 'clothesColor', clothingColorOptions);
        controlsContainer.appendChild(clothingColorGroup);
        selects.clothesColor = clothingColorGroup.querySelector('select');

        // Clothing Graphics (for graphicShirt)
        const graphicsOptions = ['bat', 'bear', 'cumbia', 'deer', 'diamond', 'hola', 'pizza', 'resist', 'skull', 'skullOutline'];
        const graphicsGroup = this.createSelectGroup('Gráfico de Camiseta', 'clothingGraphic', graphicsOptions);
        controlsContainer.appendChild(graphicsGroup);
        selects.clothingGraphic = graphicsGroup.querySelector('select');

        // Store references
        this.currentSeed = seed;
        this.currentTeamColor = null;
        this.currentPreviewImage = previewImage;
        this.selects = selects; // IMPORTANT: Store selects for getObjectFromEditor

        // Initialize editor
        const updatePreview = () => {
            const currentConfig = this.getObjectFromEditor(selects, {});
            previewImage.src = this.getImageForProfile(seed, currentConfig);
        };

        // Add event listeners
        Object.values(selects).forEach(select => {
            select.addEventListener('change', updatePreview);
        });

        // Set initial values
        if (config) {
            Object.keys(config).forEach(key => {
                if (selects[key]) {
                    selects[key].value = config[key];
                }
            });

            // Handle special cases for none
            if (!config.facialHairType && selects.facialHairType) selects.facialHairType.value = 'none';
            if (!config.accessoriesType && selects.accessoriesType) selects.accessoriesType.value = 'none';
        }

        updatePreview();
    }
}
