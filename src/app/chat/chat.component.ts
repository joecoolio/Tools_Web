import { Component, OnDestroy, OnInit, signal, Signal, WritableSignal } from "@angular/core";
import { ChatService } from "../services/chat.service";
import { faComments, faRotate } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { ReactiveFormsModule } from "@angular/forms";
import { MatInputModule } from "@angular/material/input";
import { DataService, Neighbor } from "../services/data.service";
import { ChatThreadComponent } from "./chat-thread.component";
import { Observable, Subscription } from "rxjs";

export interface Message {
    id: string,
    sent_by_me: boolean,
    from_neighbor: Neighbor | undefined,
    send_ts: Date,
    message: string,
    read: boolean,
}
export interface Chat {
    id: string,
    started_ts: Date,
    latest_message_ts: Date,
    neighbor: Neighbor | undefined,
    messages: WritableSignal<Message[]>,
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
    faRotate = faRotate;

    chats: Chat[] = [];
    numNewMessages = 3;

    // Subscriptions
    private identifyCompletedSubscription?: Subscription;
    private getMessagesSubscription?: Subscription;
    
    ngOnInit(): void {
        this.chatService.connect();

        // This fires when identification completes.
        // Reload all my chats when this happens
        this.identifyCompletedSubscription = this.chatService.identifyCompleted$.subscribe(() => {
            console.log("Chat: identify success, reload all chats");
            this.chatService.sendMessage({ type: 'get_chats' });
        });

        // Process messages arriving from the chat service
        this.getMessagesSubscription = this.chatService.getMessages()?.subscribe({
            next: message => {
                let chat: Chat | undefined;
                switch (message['type']) {
                    case 'get_chats_result': {   // All chats involving me - overwrite the full list of chats
                        console.log("Chat: received the full list of chats, resetting the list");
                        // Replace the chats array and get the neighbor for each one
                        const chatArray = message['chats'] as any[];
                        const newChats: Chat[] = [];
                        chatArray.forEach(ca => {
                            chat = this.chats.find(c => c.id == ca['id']);
                            if (chat) {
                                chat = {
                                    ...chat,
                                    started_ts: new Date(ca['started_ts']),
                                    latest_message_ts: new Date(ca['latest_message_ts']),
                                };
                                chat?.messages.set([]);
                            } else {
                                chat = {
                                    id: ca['id'],
                                    started_ts: new Date(ca['started_ts']),
                                    latest_message_ts: new Date(ca['latest_message_ts']),
                                    neighbor: undefined,
                                    messages: signal([])
                                }
                            }
                            if (!chat.neighbor) {
                                // Get the neighbor
                                const c = chat;
                                this.dataService.getNeighbor(ca['other_members'][0]).subscribe(n => c.neighbor = n);
                            }

                            newChats.push(chat!);
                        })
                        // Sort the chats by latest message received first
                        this.chats = newChats.sort((a, b) => { return b.latest_message_ts.getTime() - a.latest_message_ts.getTime() });
                        break;
                    }
                    case 'get_chat_result': {     // A single chat involving me - add this to the list
                        console.log("Chat: received a single chat, adding it to the existing list");
                        const ca = message['chat'];
                        chat = this.chats.find(c => c.id == ca['id']);
                        if (chat) {
                            chat = {
                                ...chat,
                                started_ts: new Date(ca['started_ts']),
                                latest_message_ts: new Date(ca['latest_message_ts']),
                            };
                            chat?.messages.set([]);
                        } else {
                            chat = {
                                id: ca['id'],
                                started_ts: new Date(ca['started_ts']),
                                latest_message_ts: new Date(ca['latest_message_ts']),
                                neighbor: undefined,
                                messages: signal([])
                            }
                            this.chats = [
                                ... this.chats,
                                chat,
                            ];
                        }
                        if (!chat.neighbor) {
                            // Get the neighbor
                            const c = chat;
                            this.dataService.getNeighbor(ca['other_members'][0]).subscribe(n => c.neighbor = n);
                        }

                        this.chats = this.chats.sort((a, b) => { return b.latest_message_ts.getTime() - a.latest_message_ts.getTime() });
                        break;
                    }
                    case 'get_messages_result': { // Get all messages in a chat
                        console.log("Chat: received all messages for a chat, resetting the chat's list");
                        // Load the messages into the individual chats
                        const chat = this.chats.find(c => c.id == message['chat_id']);
                        if (chat) {
                            const msgArray = message['messages'] as any[];
                            const newMsgs: Message[] = [];
                            msgArray.forEach(msg => {
                                const newMsg: Message = {
                                    id: msg['id'],
                                    send_ts: new Date(msg['send_ts']),
                                    from_neighbor: undefined,
                                    message: msg['message'],
                                    sent_by_me: msg['sent_by_me'],
                                    read: msg['read'],
                                }
                                // Get the neighbor
                                this.dataService.getNeighbor(msg['from_neighbor']).subscribe(n => newMsg.from_neighbor = n);
                                newMsgs.push(newMsg);
                            })
                            // Sort the chats by latest message received first
                            chat.messages.set(newMsgs.sort((a, b) => { return b.send_ts.getTime() - a.send_ts.getTime() }));
                        }
                        break;
                    }
                    case 'new_message_result': {  // A new message was sent to one of my chats
                        console.log("Chat: received a new message...");
                        // Determine if we already have the chat
                        const chat = this.chats.find(c => c.id == message['chat_id']);
                        if (chat) {
                            console.log("Chat:   ... already have the chat, adding the message to the list.");
                            const msg = message['message'];
                            const newMsg: Message = {
                                id: msg['id'],
                                send_ts: new Date(msg['send_ts']),
                                from_neighbor: undefined,
                                message: msg['message'],
                                sent_by_me: msg['sent_by_me'],
                                read: msg['read'],
                            }
                            const newMsgs: Message[] = [
                                ...chat.messages(),
                                newMsg
                            ];
                            // Get the neighbor
                            this.dataService.getNeighbor(msg['from_neighbor']).subscribe(n => newMsg.from_neighbor = n);
                            // Sort the chats by latest message received first
                            chat.messages.set(newMsgs.sort((a, b) => { return b.send_ts.getTime() - a.send_ts.getTime() }));

                        } else {
                            // Request the chat (the messages will come later)
                            console.log("Chat:   ... do not have the chat, requesting it.");
                            this.getChat(message['chat_id']);
                        }
                        break;
                    }
                }
            },
            complete: () => console.log("ChatComponent: complete")
        });
    }

    ngOnDestroy(): void {
        this.getMessagesSubscription?.unsubscribe();
        this.identifyCompletedSubscription?.unsubscribe();
        this.chatService.disconnect();
    }

    reloadChats(): void {
        this.chatService.sendMessage({
            type: 'get_chats'
        });
    }

    // Ask the server for a chat
    getChat(chatId: string): void {
        this.chatService.sendMessage({ type: 'get_chat', chat_id: chatId });
    }

    // Ask the server for a chat's messages
    getMessagesForChat(chatId: string): void {
        this.chatService.sendMessage({ type: 'get_messages', chat_id: chatId });
    }
}
