document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    const contactMessageAlert = document.getElementById('contactMessageAlert');
    const contactService = new ContactService(); // Uses window.supabaseClient internally
    const sb = window.supabaseClient;

    // Pre-fill form if user is logged in
    async function checkUser() {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
            const emailInput = document.getElementById('contactEmail');
            const nameInput = document.getElementById('contactName');

            if (!emailInput.value) emailInput.value = user.email || '';

            try {
                // Fetch profile
                const { data: profile } = await sb
                    .from('profiles')
                    .select('display_name')
                    .eq('id', user.id)
                    .single();

                if (profile && profile.display_name && !nameInput.value) {
                    nameInput.value = profile.display_name;
                } else if (!nameInput.value) {
                    nameInput.value = user.email ? user.email.split('@')[0] : '';
                }
            } catch (error) {
                console.error('Error fetching user profile for contact form:', error);
            }
        }
    }
    checkUser();

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('contactName').value.trim();
        const email = document.getElementById('contactEmail').value.trim();
        const phone = document.getElementById('contactPhone').value.trim();
        const message = document.getElementById('contactMessage').value.trim();

        if (!name || !email || !message) {
            showAlert('Por favor, rellena todos los campos obligatorios.', 'danger');
            return;
        }

        const submitBtn = contactForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        try {
            await contactService.saveMessage({
                name: Sanitizer.escape(name),
                email: Sanitizer.escape(email),
                phone: Sanitizer.escape(phone),
                message: Sanitizer.escape(message)
            });

            showAlert('Mensaje enviado correctamente. Nos pondremos en contacto contigo pronto.', 'success');
            contactForm.reset();
        } catch (error) {
            console.error('Error sending message:', error);
            showAlert('Error al enviar el mensaje. Por favor, inténtalo de nuevo más tarde.', 'danger');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Mensaje';
        }
    });

    function showAlert(message, type) {
        contactMessageAlert.textContent = message;
        contactMessageAlert.className = `alert alert-${type} mt-3`;
        contactMessageAlert.classList.remove('d-none');

        if (type === 'success') {
            setTimeout(() => {
                contactMessageAlert.classList.add('d-none');
            }, 5000);
        }
    }
});
