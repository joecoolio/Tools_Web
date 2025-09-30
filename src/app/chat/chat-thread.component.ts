import { CommonModule } from '@angular/common';
import { Component, computed, effect, ElementRef, Input, ViewChild } from '@angular/core';
import { ChatBubbleComponent } from "./chat-bubble.component";
import { Chat } from './chat.component';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../services/chat.service';

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
    ChatBubbleComponent,
    FormsModule,
  ]
})
export class ChatThreadComponent {
  @Input() chat?: Chat;
  @Input() loadFunction?: (id: string) => void;
  @ViewChild('chatBody') chatBody!: ElementRef;


  // Are the messages for this chat loaded already
  isLoaded = computed(() => this.chat?.messages().length !== 0);

  constructor(
    public chatService: ChatService,
  ) {
    // If the chat is open and unloaded, load immediately
    effect(() => {
      if (!this.isLoaded() && !this.collapsed) {
        console.log("Chat: effect reloading messages for chat ID: " + this.chat!.id);
        this.loadFunction!(this.chat!.id);
      }
    });
  }
  
  // Reply text that they typed in
  replyText: string = "";

  // Is this chat thread collapsed or not
  collapsed: boolean = true;

  toggleCollapsed() {
    // If currently collapsed and we're about to open it, make sure data is loaded
    if (this.collapsed && !this.isLoaded()) {
      // Request the individual messages for this chat
      this.loadFunction!(this.chat!.id);
    }

    // Toggle
    this.collapsed = !this.collapsed;
  }

  // Send a reply on this chain
  sendReply() {
    this.chatService.sendMessage({ type: 'send_message', to: this.chat?.neighbor?.id, message: this.replyText });
    this.replyText = "";
    this.chatBody.nativeElement.scrollTop = 0;
  }
}
