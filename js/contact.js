document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    const contactMessageAlert = document.getElementById('contactMessageAlert');
    const contactService = new ContactService(firebase.database());

    // Pre-fill form if user is logged in
    firebase.auth().onAuthStateChanged(async user => {
        if (user) {
            const emailInput = document.getElementById('contactEmail');
            const nameInput = document.getElementById('contactName');

            if (!emailInput.value) emailInput.value = user.email || '';

            try {
                const snapshot = await firebase.database().ref(`usuarios/${user.uid}/profile`).once('value');
                const profile = snapshot.val();
                if (profile && profile.nombre && !nameInput.value) {
                    nameInput.value = profile.nombre;
                } else if (user.displayName && !nameInput.value) {
                    nameInput.value = user.displayName;
                }
            } catch (error) {
                console.error('Error fetching user profile for contact form:', error);
            }
        }
    });

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
                name,
                email,
                phone,
                message
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
