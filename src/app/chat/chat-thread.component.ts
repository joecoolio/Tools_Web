// chat-thread.component.ts
import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ChatBubbleComponent } from "./chat-bubble.component";
import { Chat } from './chat.component';

interface ChatMessage {
  text: string;
  timestamp: string;
  isMe: boolean;
}

@Component({
  selector: 'app-chat-thread',
  templateUrl: './chat-thread.component.html',
  styleUrls: ['./chat-thread.component.scss'],
  imports: [
    CommonModule,
    ChatBubbleComponent
]
})
export class ChatThreadComponent {
  @Input() chat?: Chat;

  // Is this chat thread collapsed or not
  collapsed: boolean = true;

  toggleCollapsed() {
    this.collapsed = !this.collapsed;
  }
}