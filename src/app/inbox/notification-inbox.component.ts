import { Component, Input, OnInit, ViewContainerRef } from '@angular/core';
import { NotificationMessage, NotificationOption, NotificationService } from '../services/notification.service';
import { MatIconModule } from "@angular/material/icon";
import { CommonModule } from '@angular/common';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { MatMenuModule } from "@angular/material/menu";
import { DataService } from '../services/data.service';
import { NotifierService } from 'gramli-angular-notifier';

@Component({
    selector: 'app-notification-inbox',
    templateUrl: './notification-inbox.component.html',
    styleUrls: ['./notification-inbox.component.scss'],
    imports: [
        MatIconModule,
        CommonModule,
        FaIconComponent,
        MatMenuModule,
    ]
})
export class NotificationInboxComponent implements OnInit {
    @Input() buttonTarget!: ViewContainerRef;

    faEnvelope = faEnvelope;
    notifications: NotificationMessage[] = [];

    constructor(
        private notificationService: NotificationService,
        private dataService: DataService,
        private notifierService: NotifierService,
    ) { }

    ngOnInit(): void {
        this.notificationService.pollNotifications().subscribe(notifications => {
            this.notifications = notifications;
        });
    }

    // Run one of the button functions.
    // If that function completes successfully, update the notification to resolved in db.
    // If it fails, show a message but leave the notification alive.
    runFunction(opt: NotificationOption, notification: NotificationMessage): void {
        opt.function().subscribe({
            error: (err) => console.error('Notification Inbox Error:', err),
            complete: () => this.resolveNotification(opt, notification)
        });
    }

    // This resolves the notification in the db.
    resolveNotification(opt: NotificationOption, notification: NotificationMessage): void {
        this.dataService.resolveNotification(notification.id).subscribe({
            complete: () => {
                // Remove the notification from the list (the next poll will remove it also)
                this.notifications = this.notifications.filter(n => n.id != notification.id);

                if (opt.successMessage) {
                    this.notifierService.notify('success', opt.successMessage);
                }
            },
            error: (err) => {
                const message = opt.failureMessage || err;
                this.notifierService.notify('error', message);
            }
        })
    }
}
