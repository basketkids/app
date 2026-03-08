import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AvatarConfig } from '../../../core/models/data/avatar-config.repository';
import { Avatar } from '../avatar/avatar';

@Component({
    selector: 'app-avatar-editor',
    standalone: true,
    imports: [CommonModule, FormsModule, Avatar],
    templateUrl: './avatar-editor.html'
})
export class AvatarEditor implements OnInit {
    @Input() seed: string = 'default-seed';
    @Input() initialConfig: AvatarConfig | null = null;
    @Input() jerseyColor: string = '5199e4';
    @Input() allowClothingCustomization: boolean = false;
    @Output() configChange = new EventEmitter<AvatarConfig>();

    config: AvatarConfig = {};

    // Stable reference for the preview component to avoid re-renders of the editor UI
    previewConfig: Record<string, string | number> = {};

    // Legacy options
    options = {
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
        mouth: ["concerned", "default", "disbelief", "eating", "grimace", "sad", "screamOpen", "serious", "smile", "tongue", "twinkle", "vomit"],
        facialHairType: ["none", "beardMedium", "beardLight", "beardMajestic", "moustacheFancy", "moustacheMagnum"],
        accessoriesType: ["none", "kurt", "prescription01", "prescription02", "round", "sunglasses", "wayfarers"],
        clothing: ["blazerAndShirt", "blazerAndSweater", "collarAndSweater", "graphicShirt", "hoodie", "overall", "shirtCrewNeck", "shirtScoopNeck", "shirtVNeck"],
        clothesColor: [
            { value: "3c4f5e", name: "Azul Marino" },
            { value: "5199e4", name: "Azul Premium" },
            { value: "e15b64", name: "Rojo Corral" },
            { value: "f4a460", name: "Arena" },
            { value: "262626", name: "Negro Mate" },
            { value: "929598", name: "Gris" },
            { value: "556b2f", name: "Verde Olivo" },
            { value: "6a5acd", name: "Púrpura" },
            { value: "ffffff", name: "Blanco" }
        ]
    };

    // Computed method for internal preview
    updatePreview(): void {
        this.previewConfig = { ...this.config } as any;
    }

    ngOnInit(): void {
        if (this.initialConfig) {
            this.config = { ...this.initialConfig };
        } else {
            // Setup minimal working defaults so DicebearUtil has something to render nicely
            this.config = {
                skin_color: 'ffdbb4',
                top: 'shortFlat',
                hair_color: 'a55728',
                eyes: 'default',
                eyebrows: 'default',
                mouth: 'default'
            };
        }

        // Normalize empty strings/nulls for selects to ensure UI displays correct 'none'
        if (!this.config['facial_hair_type'] || this.config['facial_hair_type'] === 'null') {
            this.config['facial_hair_type'] = 'none';
        }
        if (!this.config['accessories_type'] || this.config['accessories_type'] === 'null') {
            this.config['accessories_type'] = 'none';
        }

        // Initialize clothing if missing
        if (!this.config['clothing']) {
            this.config['clothing'] = 'shirtScoopNeck';
        }
        if (!this.config['clothes_color']) {
            this.config['clothes_color'] = this.jerseyColor;
        }

        this.updatePreview();
    }

    onModelChange(): void {
        // Update ONLY the preview reference to trigger child change detection 
        // WITHOUT destroying/recreating the editor's own DOM or bindings
        this.updatePreview();

        // Create a copy to emit
        const configToEmit = { ...this.config };

        // Ensure we don't emit 'none' or 'null' strings that could break validation if used elsewhere
        if (configToEmit['facial_hair_type'] === 'none') delete configToEmit['facial_hair_type'];
        if (configToEmit['accessories_type'] === 'none') delete configToEmit['accessories_type'];

        this.configChange.emit(configToEmit);
    }
}
