document.addEventListener('DOMContentLoaded', () => {
    const messagesTableBody = document.getElementById('messagesTableBody');
    const contactService = new ContactService(firebase.database());
    const btnInbox = document.getElementById('btnInbox');
    const btnArchived = document.getElementById('btnArchived');

    // Check admin status (reusing logic from admin.js or similar check)
    // Check if user is admin
    firebase.auth().onAuthStateChanged(async user => {
        if (user) {
            try {
                const profileSnap = await firebase.database().ref(`usuarios/${user.uid}/profile`).once('value');
                const profile = profileSnap.val();

                if (!profile || !profile.admin) {
                    // Not admin, redirect
                    window.location.href = 'index.html';
                    return;
                }

                // Is admin, load messages
                loadMessages();

            } catch (error) {
                console.error('Error checking admin status:', error);
                window.location.href = 'index.html';
            }
        } else {
            // Not logged in
            window.location.href = 'login.html';
        }
    });

    let allMessages = [];
    let currentFilter = 'inbox'; // 'inbox' or 'archived'
    let currentPage = 1;
    const itemsPerPage = 20;

    // Filter buttons
    btnInbox.addEventListener('click', () => {
        setFilter('inbox');
    });

    btnArchived.addEventListener('click', () => {
        setFilter('archived');
    });

    function setFilter(filter) {
        currentFilter = filter;
        currentPage = 1;

        if (filter === 'inbox') {
            btnInbox.classList.replace('btn-outline-primary', 'btn-primary');
            btnArchived.classList.replace('btn-primary', 'btn-outline-primary');
        } else {
            btnInbox.classList.replace('btn-primary', 'btn-outline-primary');
            btnArchived.classList.replace('btn-outline-primary', 'btn-primary');
        }
        renderMessages();
        renderPagination();
    }

    async function loadMessages() {
        try {
            const snapshot = await contactService.getMessages();
            messagesTableBody.innerHTML = '';

            if (!snapshot.exists()) {
                messagesTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No hay mensajes</td></tr>';
                renderPagination();
                return;
            }

            allMessages = [];
            snapshot.forEach(childSnapshot => {
                allMessages.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });

            // Sort by timestamp descending
            allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            renderMessages();
            renderPagination();

        } catch (error) {
            console.error('Error loading messages:', error);
            messagesTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Error al cargar mensajes</td></tr>';
        }
    }

    function renderMessages() {
        messagesTableBody.innerHTML = '';

        // Filter messages based on current view
        const filteredMessages = allMessages.filter(msg => {
            const isArchived = !!msg.archived;
            return currentFilter === 'inbox' ? !isArchived : isArchived;
        });

        if (filteredMessages.length === 0) {
            messagesTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No hay mensajes en ${currentFilter === 'inbox' ? 'el buzón de entrada' : 'archivados'}</td></tr>`;
            return;
        }

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageMessages = filteredMessages.slice(start, end);

        pageMessages.forEach(msg => {
            const date = new Date(msg.timestamp).toLocaleString();
            const tr = document.createElement('tr');

            // Style for unread messages
            if (!msg.read && !msg.archived) {
                tr.classList.add('fw-bold', 'table-active');
            }

            const fullMessage = escapeHtml(msg.message);
            const firstLine = fullMessage.split('\n')[0];
            const isLong = fullMessage.length > 50 || fullMessage.includes('\n');
            const truncatedMessage = isLong ? (firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine + '...') : fullMessage;

            tr.innerHTML = `
                <td>${date}</td>
                <td>${escapeHtml(msg.name)}</td>
                <td><a href="mailto:${escapeHtml(msg.email)}">${escapeHtml(msg.email)}</a></td>
                <td>${msg.phone ? escapeHtml(msg.phone) : '-'}</td>
                <td>
                    <div class="message-content">
                        <span class="message-text">${isLong ? truncatedMessage : fullMessage}</span>
                        ${isLong ? `<button class="btn btn-sm btn-link p-0 ms-1 toggle-msg" data-full="${fullMessage.replace(/"/g, '&quot;')}" data-truncated="${truncatedMessage.replace(/"/g, '&quot;')}"><i class="bi bi-chevron-down"></i></button>` : ''}
                    </div>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        ${!msg.read ? `<button class="btn btn-outline-success btn-read" title="Marcar como leído"><i class="bi bi-check2"></i></button>` : ''}
                        ${currentFilter === 'inbox'
                    ? `<button class="btn btn-outline-secondary btn-archive" title="Archivar"><i class="bi bi-archive"></i></button>`
                    : `<button class="btn btn-outline-primary btn-unarchive" title="Recuperar"><i class="bi bi-box-arrow-up"></i></button>`
                }
                    </div>
                </td>
            `;

            // Add event listeners for actions
            const btnRead = tr.querySelector('.btn-read');
            if (btnRead) {
                btnRead.onclick = () => markAsRead(msg.id);
            }

            const btnArchive = tr.querySelector('.btn-archive');
            if (btnArchive) {
                btnArchive.onclick = () => archiveMessage(msg.id);
            }

            const btnUnarchive = tr.querySelector('.btn-unarchive');
            if (btnUnarchive) {
                btnUnarchive.onclick = () => unarchiveMessage(msg.id);
            }

            messagesTableBody.appendChild(tr);
        });

        // Add event listeners for toggle buttons
        document.querySelectorAll('.toggle-msg').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.currentTarget;
                const span = button.previousElementSibling;
                const icon = button.querySelector('i');
                const isExpanded = icon.classList.contains('bi-chevron-up');

                if (isExpanded) {
                    span.innerHTML = button.dataset.truncated;
                    icon.classList.replace('bi-chevron-up', 'bi-chevron-down');
                } else {
                    span.innerHTML = button.dataset.full.replace(/\n/g, '<br>');
                    icon.classList.replace('bi-chevron-down', 'bi-chevron-up');
                }
            });
        });
    }

    async function markAsRead(id) {
        try {
            await contactService.markAsRead(id);
            // Update local state
            const msg = allMessages.find(m => m.id === id);
            if (msg) msg.read = true;
            renderMessages();
        } catch (error) {
            console.error('Error marking as read:', error);
            alert('Error al marcar como leído');
        }
    }

    async function archiveMessage(id) {
        if (!confirm('¿Estás seguro de que quieres archivar este mensaje?')) return;
        try {
            await contactService.archiveMessage(id);
            // Update local state
            const msg = allMessages.find(m => m.id === id);
            if (msg) msg.archived = true;
            renderMessages();
            renderPagination();
        } catch (error) {
            console.error('Error archiving message:', error);
            alert('Error al archivar mensaje');
        }
    }

    async function unarchiveMessage(id) {
        try {
            await contactService.unarchiveMessage(id);
            // Update local state
            const msg = allMessages.find(m => m.id === id);
            if (msg) msg.archived = false;
            renderMessages();
            renderPagination();
        } catch (error) {
            console.error('Error unarchiving message:', error);
            alert('Error al recuperar mensaje');
        }
    }

    function renderPagination() {
        const paginationControls = document.getElementById('paginationControls');
        paginationControls.innerHTML = '';

        const filteredMessages = allMessages.filter(msg => {
            const isArchived = !!msg.archived;
            return currentFilter === 'inbox' ? !isArchived : isArchived;
        });

        const totalPages = Math.ceil(filteredMessages.length / itemsPerPage);
        if (totalPages <= 1) return;

        // Previous
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#">Anterior</a>`;
        prevLi.onclick = (e) => {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                renderMessages();
                renderPagination();
            }
        };
        paginationControls.appendChild(prevLi);

        // Page Info
        const infoLi = document.createElement('li');
        infoLi.className = 'page-item disabled';
        infoLi.innerHTML = `<span class="page-link">Página ${currentPage} de ${totalPages}</span>`;
        paginationControls.appendChild(infoLi);

        // Next
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#">Siguiente</a>`;
        nextLi.onclick = (e) => {
            e.preventDefault();
            if (currentPage < totalPages) {
                currentPage++;
                renderMessages();
                renderPagination();
            }
        };
        paginationControls.appendChild(nextLi);
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
