import { Injectable } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, forkJoin, interval, of, timer } from 'rxjs';
import { distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import { DataService, Neighbor } from './data.service';

// How often to poll for notifications
const POLL_INTERVAL = 30000;

// These are turned into form fields - you need to fill them in to close the message
export interface DataRequirement {
    name: string, // Name of the field
    label: string, // Label in the form when it's drawn
    default: string, // Default value in the form
    value: string, // The value the user entered
}

// These get turned into action buttons in the mailbox
export interface NotificationOption {
    buttonText: string, // The words on the button
    function: () => Observable<void>, // The function to run when the button is pushed
    successMessage?: string, // Shown to the user upon success, if not provided, nothing is shown
    failureMessage?: string, // Shown to the user upon failure, if not provided, nothing is shown
}

export interface NotificationMessage {
    id: number,
    from_neighbor?: Neighbor,
    type: string,
    header: string,
    subheader?: string,
    message: string,
    data: string,
    created_ts: Date,
    read: boolean,
    dataRequirements?: DataRequirement[],
    resolutionOptions?: NotificationOption[],
    loaded: boolean,
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
    constructor(private dataService: DataService) {
        this.notifications = [];
        this.notifications$ = new BehaviorSubject<NotificationMessage[]>([]);
        this.allLoaded$ = this.notifications$.pipe(
            map(items => items.every(item => item.loaded)),
            distinctUntilChanged(),
            filter(allLoaded => allLoaded)
        );
    }

    private notifications: NotificationMessage[];
    private notifications$: BehaviorSubject<NotificationMessage[]>;
    readonly allLoaded$: Observable<boolean>; // Fires when every notification is loaded

    // This is the main polling routine for notifications.
    // It gets notifications from the database and builds an array of NotificationMessage objects
    // to be shown in the mailbox.
    // These lazy load so monitor allLoaded$ before you load anything.
    pollNotifications(): Observable<NotificationMessage[]> {
        return timer(0, POLL_INTERVAL).pipe(
            switchMap(() => {
                // console.log("Polling for notifications");
                return this.dataService.getNotifications()
                .pipe(
                    map(rawNotifications => {
                        this.notifications = [];
                        rawNotifications.forEach(rawNotification => {
                            // This is the core of the message
                            const notificationMessage: NotificationMessage = {
                                ...rawNotification,
                                from_neighbor: undefined,
                                header: "",
                                loaded: false,
                            };

                            // Fill in the buttons & extra data based on the message type

                            // Friend requests
                            if (rawNotification.type == "friend_request") {
                                // Friend requests have accept & reject buttons
                                if (rawNotification.from_neighbor) {
                                    notificationMessage.resolutionOptions = [
                                        { buttonText: 'Accept', function: () => this.acceptFriendRequest(rawNotification.from_neighbor!, rawNotification.id) },
                                        { buttonText: 'Reject', function: () => this.rejectFriendRequest(rawNotification.from_neighbor!, rawNotification.id) },
                                    ]
                                }
                                // Once the neighbor is loaded, fill in these things
                                if (rawNotification.from_neighbor) {
                                    this.dataService.getNeighbor(rawNotification.from_neighbor).subscribe(neighbor => {
                                        notificationMessage.header = neighbor.name + " would like to be your friend!";
                                        notificationMessage.subheader = neighbor.home_address;

                                        // Setup info messages
                                        let accept = notificationMessage.resolutionOptions?.[0];
                                        if (accept) {
                                            accept.successMessage = "Accepted friendship request from " + neighbor.name + "!";
                                            accept.failureMessage = "Failed to accept friendship request from " + neighbor.name + "!";
                                        }

                                        notificationMessage.loaded = true;
                                        this.notifications$.next(this.notifications);
                                    });
                                } else {
                                    console.log("Cannot build friend_request message because neighbor ID is null!");
                                }
                            }

                            // Tool borrow requests
                            if (rawNotification.type == "borrow_request") {
                                // The tool ID is in the data json
                                if (rawNotification.data && rawNotification.data['tool_id']) {
                                    const toolId: number = rawNotification.data['tool_id'];

                                    // Borrow requests have accept & reject buttons
                                    if (rawNotification.from_neighbor) {
                                        notificationMessage.resolutionOptions = [
                                            { buttonText: 'Accept', function: () => this.acceptBorrowRequest(notificationMessage, toolId) },
                                            { buttonText: 'Reject', function: () => this.rejectBorrowRequest(notificationMessage, toolId) },
                                        ];
                                    }

                                    // Get a bunch of data and then load the rest of the notification
                                    if (rawNotification.from_neighbor) {
                                        // Need myInfo + the tool being requested
                                        forkJoin([
                                            this.dataService.getNeighbor(rawNotification.from_neighbor),
                                            this.dataService.getMyInfo(),
                                            this.dataService.getTool(toolId, false),
                                        ]).subscribe(([neighbor, sig, tool]) => {
                                            // Grab the requestor neighbor
                                            notificationMessage.from_neighbor = neighbor;

                                            // Build the form fields to collect a note to the borrower.
                                            const myinfo = sig();
                                            let msg: string = "Write a brief note telling the borrower how they can contact you... ";
                                            if (myinfo.phone_number && myinfo.email) {
                                                msg = "Contact me @ " + myinfo.phone_number + " or " + myinfo.email;
                                            } else if (myinfo.phone_number) {
                                                msg = "Call me @ " + myinfo.phone_number;
                                            } else if (myinfo.email) {
                                                msg = "Email me @ " + myinfo.email
                                            }
                                            notificationMessage.dataRequirements = [
                                                {
                                                    name: "message",
                                                    label: "How can the borrower contact you?",
                                                    default: msg,
                                                    value: ""
                                                }
                                            ]

                                            // Wait for the tool to load from the db (this stuff isn't reactive so wait)
                                            new BehaviorSubject<boolean>(tool.loaded)
                                                .pipe(filter(val => val === true))
                                                .subscribe(() => {
                                                    notificationMessage.header = neighbor.name + " would like to borrow your " + tool.short_name + "!";
                                                    // notificationMessage.subheader = neighbor.home_address;

                                                    // Setup info messages
                                                    let accept = notificationMessage.resolutionOptions?.[0];
                                                    if (accept) {
                                                        accept.successMessage = "You agreed to let " + neighbor.name + " borrow your " + tool.short_name + "!";
                                                        accept.failureMessage = neighbor.name + " cannot borrow your " + tool.short_name + "!";
                                                    }

                                                    // Only now is the notification ready for display
                                                    notificationMessage.loaded = true;
                                                    this.notifications$.next(this.notifications);
                                                });
                                        });
                                    } else {
                                        console.log("Cannot build borrow_request message because neighbor ID is null!");
                                    };
                                } else {
                                    console.error("NotificationService: cannot get tool_id from borrow request.");
                                }
                            }

                            // Tool borrow accepts
                            if (rawNotification.type == "borrow_accept") {
                                // The tool ID is in the data json
                                if (rawNotification.data && rawNotification.data['tool_id']) {
                                    const toolId: number = rawNotification.data['tool_id'];

                                    // Borrow requests have accept & reject buttons
                                    if (rawNotification.from_neighbor) {
                                        notificationMessage.resolutionOptions = [
                                            { buttonText: 'TODO', function: () => this.noop() },
                                        ];
                                    }

                                    // Get a bunch of data and then load the rest of the notification
                                    if (rawNotification.from_neighbor) {
                                        // Need myInfo + the tool being requested
                                        forkJoin([
                                            this.dataService.getNeighbor(rawNotification.from_neighbor),
                                            this.dataService.getMyInfo(),
                                            this.dataService.getTool(toolId, false),
                                        ]).subscribe(([neighbor, sig, tool]) => {
                                            // Grab the requestor neighbor
                                            notificationMessage.from_neighbor = neighbor;

                                            // Wait for the tool to load from the db (this stuff isn't reactive so wait)
                                            new BehaviorSubject<boolean>(tool.loaded)
                                                .pipe(filter(val => val === true))
                                                .subscribe(() => {
                                                    notificationMessage.header = neighbor.name + " agreed to let you borrow a " + tool.short_name + "!";
                                                    // notificationMessage.subheader = neighbor.home_address;

                                                    // Setup info messages
                                                    let todo = notificationMessage.resolutionOptions?.[0];
                                                    if (todo) {
                                                        todo.successMessage = "Groovy!";
                                                    }

                                                    // Only now is the notification ready for display
                                                    notificationMessage.loaded = true;
                                                    this.notifications$.next(this.notifications);
                                                });
                                        });
                                    } else {
                                        console.log("Cannot build borrow_request message because neighbor ID is null!");
                                    };
                                } else {
                                    console.error("NotificationService: cannot get tool_id from borrow request.");
                                }
                            }

                            // System messages
                            if (rawNotification.type == "system_message") {
                                // System messages only have discard button
                                notificationMessage.resolutionOptions = [
                                    { buttonText: 'Dismiss', function: () => this.noop() },
                                ];
                                notificationMessage.loaded = true;
                                this.notifications$.next(this.notifications);
                            }

                            this.notifications.push(notificationMessage);
                            this.notifications$.next(this.notifications);
                        });

                        // Return the list sorted oldest first
                        return this.notifications.sort((a, b) => { return a.created_ts.getTime() - b.created_ts.getTime() });
                    })
                );
            })
        );
    }

    // A noop function.
    // Use this for buttons where simply pushing the button will resolve the notification.
    noop(): Observable<void> {
        return EMPTY;
    }

    // Accept friend request
    acceptFriendRequest(neighborId: number, notificationId: number) : Observable<void> {
        return this.dataService.createFriendship(neighborId);
    }

    // Reject friend request
    rejectFriendRequest(neighborId: number, notificationId: number) : Observable<void> {
        console.log("REJECTED FRIEND REQUEST: " + neighborId + " - " + notificationId);
        return EMPTY;
    }

    // Accept borrow tool request
    acceptBorrowRequest(notification: NotificationMessage, toolId: number) : Observable<void> {
        if (notification.from_neighbor && notification.dataRequirements) {
            return this.dataService.acceptBorrowRequest(notification.from_neighbor.id, toolId, notification.id, notification.dataRequirements[0].value);
        } else {
            console.log("Cannot call acceptBorrowRequest because stuff is null: " + notification.id);
            return EMPTY;
        }
    }

    // Reject borrow tool request
    rejectBorrowRequest(notification: NotificationMessage, toolId: number) : Observable<void> {
        if (notification.from_neighbor && notification.dataRequirements) {
            return this.dataService.acceptBorrowRequest(notification.from_neighbor.id, toolId, notification.id, notification.dataRequirements[0].value);
        } else {
            console.log("Cannot call rejectBorrowRequest because stuff is null: " + notification.id);
            return EMPTY;
        }
    }

}