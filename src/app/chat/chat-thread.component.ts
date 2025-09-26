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
  @Input() loadFunction?: (id: string) => void;

  // Is this chat thread collapsed or not
  collapsed: boolean = true;

  // Are the messages loaded yet
  messagesLoaded: boolean = false;

  toggleCollapsed() {
    if (!this.messagesLoaded && this.chat) {
      // Request the individual messages for this chat
      if (this.loadFunction) {
        this.loadFunction(this.chat?.id);
        this.messagesLoaded = true;
      }
    }
    this.collapsed = !this.collapsed;
  }
}