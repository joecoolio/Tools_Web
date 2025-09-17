import { Component, effect, enableProdMode, OnDestroy, OnInit, Signal } from '@angular/core';
import { MatMenuModule } from "@angular/material/menu";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { Router, RouterModule } from '@angular/router';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MyInfoComponent } from './user/myinfo/myinfo.component';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { DataService, MyInfo } from './services/data.service';
import { NotificationInboxComponent } from "./inbox/notification-inbox.component";
import { NotifierModule } from 'gramli-angular-notifier';
import { NotifierService } from 'gramli-angular-notifier';
import { Subscription } from 'rxjs';
import { MessageService } from './services/message.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
    MatMenuModule,
    MatIconModule,
    MatDividerModule,
    NotificationInboxComponent,
    NotifierModule,
],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Tools_Web';

  constructor(
    private dialog: MatDialog,
    private authService: AuthService,
    private router: Router,
    private tokenService: TokenService,
    private dataService: DataService,
    private messageService: MessageService,
    private notifierService: NotifierService,
  ) {
    if (environment.production) {
      enableProdMode();
    }

    // Monitor the loggedIn signal.
    // When it is false, clear myinfo (including picture and whatnot).
    // When it is true, immediately call getMyInfo().
    effect(() => {
      if(this.tokenService.isLoggedIn()) { // Link the effect to the proper signal so it functions
        // console.log("App: running getMyInfo");
        this.dataService.getMyInfo().subscribe();
      } else {
        // console.log("App: expiring my info");
        this.dataService.expireMyInfo.set(true);
      }
    });
  }

  // Inbox
  showInbox: boolean = false;

  // Signals for the hamburger menu / user picture
  loggedIn!: Signal<boolean>;
  myInfo!: Signal<MyInfo>;

  // Subscription to get messages to send to the notifier service
  private messageSubscription = new Subscription();

  ngOnInit(): void {
    this.loggedIn = this.tokenService.isLoggedIn;
    this.myInfo = this.dataService.myInfoSignal;

    // Subscribe to messages
    this.messageSubscription = this.messageService.notify$.subscribe(msg => {
      this.notifierService.notify(msg.type, msg.message);
    });

  }

  ngOnDestroy(): void {
    this.messageSubscription.unsubscribe();
  }

  toggleInbox() {
    this.showInbox = !this.showInbox;
  }

  openMyInfoDialog() {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.autoFocus = true;

    this.dialog.open(MyInfoComponent, dialogConfig);
  }

  logout() {
    this.authService.logout();

    this.messageService.send('info', 'You have been logged out successfully!');

    this.router.navigate(['login']);
  }
}
