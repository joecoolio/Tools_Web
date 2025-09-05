import { Component, Input, OnInit, ViewContainerRef } from '@angular/core';
import { NotificationMessage, NotificationService } from '../services/notification.service';
import { MatIconModule } from "@angular/material/icon";
import { CommonModule } from '@angular/common';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { MatMenuModule } from "@angular/material/menu";
import { Observable } from 'rxjs';
import { DataService } from '../services/data.service';

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
    ) { }

    ngOnInit(): void {
        this.notificationService.pollNotifications().subscribe(notifications => {
            this.notifications = notifications;
        });
    }

    // Run one of the button functions.
    // If that function completes successfully, update the notification to resolved in db.
    // If it fails, show a message but leave the notification alive.
    runFunction(notificationId: number, func: () => Observable<void>): void {
        func().subscribe({
            error: (err) => console.error('Notification Inbox Error:', err),
            complete: () => this.resolveNotification(notificationId)
        });
    }

    // This resolves the notification in the db.
    resolveNotification(notificationId: number): void {
        this.dataService.resolveNotification(notificationId).subscribe({
            complete: () => {
                // Remove the notification from the list (the next poll will remove it also)
                this.notifications = this.notifications.filter(n => n.id != notificationId);
            }
        })
    }
}
