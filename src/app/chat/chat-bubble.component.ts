import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Message } from './chat.component';
import { InViewportDirective } from '../shared/inviewport-directive';
import { ChatService } from '../services/chat.service';

@Component({
  selector: 'app-chat-bubble',
  templateUrl: './chat-bubble.component.html',
  styleUrls: ['./chat-bubble.component.scss'],
  imports: [
    CommonModule,
    DatePipe,
    InViewportDirective,
  ]
})
export class ChatBubbleComponent {
  @Input() message!: Message;

  constructor(
    public chatService: ChatService,
  ) {  }

  onVisibilityChanged(isVisible: boolean) {
    if (isVisible && !this.message.read) {
      this.chatService.sendMessage({ type: "mark_message_read", id: this.message.id })
    }
  }
}
