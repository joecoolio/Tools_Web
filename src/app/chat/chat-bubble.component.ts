import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Message } from './chat.component';

@Component({
  selector: 'app-chat-bubble',
  templateUrl: './chat-bubble.component.html',
  styleUrls: ['./chat-bubble.component.scss'],
  imports: [
    CommonModule,
    DatePipe,
  ]
})
export class ChatBubbleComponent {
  @Input() message!: Message;
}
