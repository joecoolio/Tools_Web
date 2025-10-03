import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { NewsItem } from '../services/news.service';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { DataService } from '../services/data.service';
import { FriendCardComponent, FriendCardDialogData } from '../friend-card/friend-card.component';
import { MessageService } from '../services/message.service';
import { ChatService } from '../services/chat.service';
import { ToolCardComponent, ToolCardDialogData } from '../tool-card/tool-card.component';

@Component({
  selector: 'app-news-item',
  templateUrl: './news-item.component.html',
  styleUrls: ['./news-item.component.scss'],
  imports: [
    CommonModule,
    MatCardModule,
  ]
})
export class NewsItemComponent implements OnInit {
  @Input() newsItem?: NewsItem;

  constructor(
    private dataService: DataService,
    private dialog: MatDialog,
    private messageService: MessageService,
    private chatService: ChatService,
  ) {  }

  ngOnInit(): void {
    if ((! this.newsItem?.neighbor?.loaded) || (! this.newsItem?.neighbor?.imageLoaded)) {
      // If the neighbor or his picture isn't loaded, request that it's loaded
      this.dataService.getNeighbor(this.newsItem?.neighbor?.id!).subscribe();
    }
  }

  popupNeighbor() {
    const neighbor = this.newsItem!.neighbor;

    if (neighbor) {
        const dialogConfig = new MatDialogConfig();
        dialogConfig.autoFocus = true;
        const data: FriendCardDialogData = {
            neighbor: neighbor,
            fnRequestFriendship: this.requestFriendship.bind(this),
            fnCancelRequestFriendship: this.cancelFriendshipRequest.bind(this),
            fnDeleteFriendship: this.deleteFriendship.bind(this),
            fnChat: this.chat.bind(this),
        }
        dialogConfig.data = data;

        this.dialog.open(FriendCardComponent, dialogConfig);
    }
  }

  popupTool() {
    const tool = this.newsItem?.tool;

    if (tool) {
      const dialogConfig = new MatDialogConfig();
      dialogConfig.autoFocus = true;
      const data: ToolCardDialogData = {
          tool: tool,
          fnBorrow: this.borrow.bind(this),
          fnCancelBorrow: this.cancelBorrow.bind(this),
      }
      dialogConfig.data = data;

      this.dialog.open(ToolCardComponent, dialogConfig);
      
    }
  }

  // Create a new friendship with the provided friend
  public requestFriendship(id: number, message: string) {
      // console.log("Creating friendship with: " + id);
      this.dataService.requestFriendship(id, message).subscribe(() => {
        this.messageService.send('info', "Friendship requested with " + this.newsItem!.neighbor?.name + "!");
      });
  }

  // Create a new friendship with the provided friend
  public cancelFriendshipRequest(id: number) {
      this.dataService.cancelFriendshipRequest(id).subscribe(() => {
        this.messageService.send('info', "Friendship request with " + this.newsItem!.neighbor?.name + " cancelled!");
      });
  }

  // Remove an existing friendship with the provided friend
  public deleteFriendship(id: number) {
      this.dataService.removeFriendship(id).subscribe(() => {
        this.messageService.send('info', "Friendship with " + this.newsItem!.neighbor?.name + " terminated!");

        // Reload friends on the server
        this.dataService.expirefriends().subscribe(() => { });
      });
  }

  // Send a chat message to a neighbor
  public chat(id: number, message: string) {
      this.chatService.sendMessage({
          type: "send_message",
          to: id,
          message: message,
      });
      this.messageService.send('info', "Chat message sent to " + this.newsItem!.neighbor?.name + "!");
  }

  // Borrow a tool
  public borrow(id: number, message: string): void {
    console.log("Borrowing: " + id);
    this.dataService.borrowTool(id, message).subscribe(() => {
      this.messageService.send('info', "Borrow request sent to " + this.newsItem?.tool?.ownerName + "!");
    })
  }

  // Cancel a request to borrow a tool
  public cancelBorrow(id: number): void {
    console.log("Cancelling borrow: " + id);
    this.dataService.cancelBorrowRequest(id).subscribe(() => {
      this.messageService.send('info', "Cancelled request to borrow " + this.newsItem?.tool?.ownerName + "'s " + this.newsItem?.tool?.short_name);
    })
  }
}
