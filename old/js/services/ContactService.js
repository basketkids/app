class ContactService {
    constructor() {
        this.supabase = window.supabaseClient;
    }

    async saveMessage(messageData) {
        const { error } = await this.supabase
            .from('contact_messages')
            .insert([messageData]);

        if (error) throw error;
    }

    async getMessages() {
        // Return promise resolving to data array, filtering by logic in JS if needed or using SQL
        // Admin page consumes this.
        const { data, error } = await this.supabase
            .from('contact_messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        // Old returned snapshot. Now returns array.
        // Need to check admin_messages.js to see how it consumes it.
        // It likely calls .forEach on result.
        // So we might need to wrap it or update admin_messages.js
        return data;
    }

    async markAsRead(messageId) {
        const { error } = await this.supabase
            .from('contact_messages')
            .update({ read: true })
            .eq('id', messageId);
        if (error) throw error;
    }

    async archiveMessage(messageId) {
        const { error } = await this.supabase
            .from('contact_messages')
            .update({ archived: true })
            .eq('id', messageId);
        if (error) throw error;
    }

    async unarchiveMessage(messageId) {
        const { error } = await this.supabase
            .from('contact_messages')
            .update({ archived: false })
            .eq('id', messageId);
        if (error) throw error;
    }

    async getUnreadCount() {
        const { count, error } = await this.supabase
            .from('contact_messages')
            .select('*', { count: 'exact', head: true })
            .eq('read', false)
            .eq('archived', false);

        if (error) throw error;
        return count;
    }
}
