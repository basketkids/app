class Sanitizer {
    /**
     * Escapes special characters to prevent XSS.
     * Use this for plain text inputs like usernames, emails, etc.
     * @param {string} str - The string to escape.
     * @returns {string} - The escaped string.
     */
    static escape(str) {
        if (typeof str !== 'string') {
            return str;
        }
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Sanitizes HTML allowing only a specific set of tags.
     * Use this for rich text inputs like Chronicles.
     * Allowed tags: <b>, <strong>, <i>, <em>, <p>, <br>
     * @param {string} html - The HTML string to sanitize.
     * @returns {string} - The sanitized HTML.
     */
    static sanitizeHtml(html) {
        if (typeof html !== 'string') {
            return html;
        }

        // First, create a temporary DOM element to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Recursively clean the nodes
        this._cleanNode(tempDiv);

        return tempDiv.innerHTML;
    }

    static _cleanNode(node) {
        const allowedTags = ['B', 'STRONG', 'I', 'EM', 'P', 'BR'];
        const children = Array.from(node.childNodes);

        children.forEach(child => {
            if (child.nodeType === 1) { // Element node
                if (allowedTags.includes(child.tagName)) {
                    // Allowed tag, check attributes (we don't want any attributes like onclick)
                    // Remove all attributes for safety, or allow specific ones if needed (none needed for bold/italic)
                    while (child.attributes.length > 0) {
                        child.removeAttribute(child.attributes[0].name);
                    }
                    // Recurse
                    this._cleanNode(child);
                } else {
                    // Disallowed tag.
                    // Option 1: Remove tag but keep content (unwrap)
                    // Option 2: Encode tag (show it as text)
                    // Let's go with Option 1: Unwrap
                    const text = child.textContent;
                    const textNode = document.createTextNode(text);
                    node.replaceChild(textNode, child);
                    // No recursion needed for the replacement text node, but we might want to check if the content had malicious stuff?
                    // Text content is safe.
                }
            } else if (child.nodeType === 3) { // Text node
                // Text nodes are safe, they are rendered as text
            } else {
                // Comments, etc. - remove
                node.removeChild(child);
            }
        });
    }

    /**
     * Recursively sanitizes all string properties of an object.
     * @param {object} obj - The object to sanitize.
     * @returns {object} - The sanitized object.
     */
    static sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }

        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                if (typeof value === 'string') {
                    sanitized[key] = this.escape(value);
                } else if (typeof value === 'object') {
                    sanitized[key] = this.sanitizeObject(value);
                } else {
                    sanitized[key] = value;
                }
            }
        }
        return sanitized;
    }
}
