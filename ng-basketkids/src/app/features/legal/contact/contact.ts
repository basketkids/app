import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContactMessagesRepository } from '../../../core/models/data/contact-messages.repository';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.html',
  styles: ''
})
export class Contact {
  form = { name: '', email: '', phone: '', message: '' };
  sending = false;
  success = false;
  error = '';

  constructor(private contactRepo: ContactMessagesRepository) { }

  async send() {
    if (!this.form.name || !this.form.email || !this.form.message) {
      this.error = 'Por favor rellena todos los campos obligatorios.';
      return;
    }
    this.sending = true;
    this.error = '';
    try {
      await this.contactRepo.sendMessage({
        name: this.form.name,
        email: this.form.email,
        phone: this.form.phone || undefined,
        message: this.form.message
      });
      this.success = true;
      this.form = { name: '', email: '', phone: '', message: '' };
    } catch (e: any) {
      this.error = 'Error al enviar el mensaje: ' + e.message;
    } finally {
      this.sending = false;
    }
  }
}
