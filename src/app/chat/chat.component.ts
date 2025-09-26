import { Component, OnDestroy, OnInit } from "@angular/core";
import { ChatService } from "../services/chat.service";
import { faComments } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { ReactiveFormsModule } from "@angular/forms";
import { MatInputModule } from "@angular/material/input";
import { DataService, Neighbor } from "../services/data.service";
import { ChatThreadComponent } from "./chat-thread.component";

export interface Message {
    id: string,
    sent_by_me: boolean,
    from_neighbor: Neighbor | undefined,
    send_ts: Date,
    message: string,
}
export interface Chat {
    id: string,
    started_ts: Date,
    neighbor: Neighbor | undefined,
    messages: Message[],
}

@Component({
    selector: 'app-chat',
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.scss'],
    imports: [
    MatIconModule,
    CommonModule,
    FaIconComponent,
    MatMenuModule,
    ReactiveFormsModule,
    MatInputModule,
    ChatThreadComponent
]
})
export class ChatComponent implements OnInit, OnDestroy {
    constructor(
        public chatService: ChatService,
        public dataService: DataService,
    ) {  }

    faComments = faComments;

    chats: Chat[] = [];
    numNewMessages = 3;

    ngOnInit(): void {
        this.chatService.connect();
        this.chatService.getMessages()?.subscribe({
            next: message => {
                switch (message['type']) {
                    case 'get_chats_result':
                        // Replace the chats array and get the neighbor for each one
                        const chatArray = message['chats'] as any[];
                        const newChats: Chat[] = [];
                        chatArray.forEach(ca => {
                            const newChat: Chat = {
                                id: ca['id'],
                                started_ts: ca['started_ts'],
                                neighbor: undefined,
                                messages: []
                            }
                            // Get the neighbor
                            this.dataService.getNeighbor(ca['other_members'][0]).subscribe(n => newChat.neighbor = n);
                            newChats.push(newChat);
                        })
                        this.chats = newChats;
                        // Request the individual messages for each chat
                        this.chats.forEach(chat => this.chatService.sendMessage({ type: 'get_messages', chat_id: chat.id }));
                        break;
                    case 'get_messages_result':
                        // Load the messages into the individual chats
                        const chat = this.chats.find(c => c.id == message['chat_id']);
                        if (chat) {
                            const msgArray = message['messages'] as any[];
                            const newMsgs: Message[] = [];
                            msgArray.forEach(msg => {
                                const newMsg: Message = {
                                    id: msg['id'],
                                    send_ts: msg['send_ts'],
                                    from_neighbor: undefined,
                                    message: msg['message'],
                                    sent_by_me: msg['sent_by_me'],
                                }
                                // Get the neighbor
                                this.dataService.getNeighbor(msg['from_neighbor']).subscribe(n => newMsg.from_neighbor = n);
                                newMsgs.push(newMsg);
                            })
                            chat.messages = newMsgs;
                        }
                        break;
                }
            },
            complete: () => console.log("ChatComponent: complete")
        });
    }

    ngOnDestroy(): void {
        this.chatService.disconnect();
    }

    send(): void {
        this.chatService.sendMessage({
            type: 'get_chats',
            // chat_id: "fffc6f47-b30a-4d2f-92a9-5bc7e15865ad",
        });
    }
}
