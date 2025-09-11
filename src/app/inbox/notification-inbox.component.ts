import { Component, Input, OnInit, ViewContainerRef } from '@angular/core';
import { NotificationMessage, NotificationOption, NotificationService } from '../services/notification.service';
import { MatIconModule } from "@angular/material/icon";
import { CommonModule } from '@angular/common';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { MatMenuModule } from "@angular/material/menu";
import { DataService } from '../services/data.service';
import { NotifierService } from 'gramli-angular-notifier';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from "@angular/material/input";

@Component({
    selector: 'app-notification-inbox',
    templateUrl: './notification-inbox.component.html',
    styleUrls: ['./notification-inbox.component.scss'],
    imports: [
    MatIconModule,
    CommonModule,
    FaIconComponent,
    MatMenuModule,
    ReactiveFormsModule,
    MatInputModule
]
})
export class NotificationInboxComponent implements OnInit {
    @Input() buttonTarget!: ViewContainerRef;

    faEnvelope = faEnvelope;
    notifications: NotificationMessage[] = [];
    responsesVisible: boolean = false; // When this is true, the response options will be shown

    // This handle buttons that need extra inputs.
    // The resolution buttons aren't shown until you expand and fill in the form.
    showButtonsMap: Record<number, boolean> = {};
    formMap: Record<number, FormGroup<any> | undefined> = {}

    constructor(
        private notificationService: NotificationService,
        private dataService: DataService,
        private notifierService: NotifierService,
        private fb: FormBuilder,
    ) { }

    ngOnInit(): void {
        this.notificationService.pollNotifications().subscribe(notifications => {
            // Wait for all of the notifications to be fully built (after db calls or whatever)
            this.notificationService.allLoaded$.subscribe(() => {
                this.notifications = notifications;

                // Default each notification's showButton flag
                this.notifications.forEach(n => {
                    if (! (n.id in this.showButtonsMap)) this.showButtonsMap[n.id] = n.dataRequirements === undefined;

                    if (n.dataRequirements) {
                        const form = this.fb.group({});
                        n.dataRequirements.forEach(dr => {
                            const control = this.fb.control(dr.default);
                            form.addControl(dr.name, control);
                        });
                        if (! (n.id in this.formMap)) this.formMap[n.id] = form;
                    } else {
                        this.formMap[n.id] = undefined;
                    }
                })
            })
        });
    }

    // Toggle showing buttons for a given notification
    toggleShowButtons(id: number): void {
        this.showButtonsMap[id] = !this.showButtonsMap[id];
    }

    // Should buttons be visible for a given notification
    isButtonsVisible(id: number): boolean {
        return !!this.showButtonsMap[id];
    }


    // Run one of the button functions.
    // If that function completes successfully, update the notification to resolved in db.
    // If it fails, show a message but leave the notification alive.
    runFunction(opt: NotificationOption, notification: NotificationMessage): void {
        // Write the form field values back into the notification before calling the function
        notification.dataRequirements?.forEach(dr => {
            const control = this.formMap[notification.id]?.get(dr.name);
            if (control) {
                dr.value = control.value;
            }
        })

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
