import { Injectable } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, interval, of, timer } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { DataService, Neighbor } from './data.service';

// How often to poll for notifications
const POLL_INTERVAL = 30000;

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
    resolutionOptions?: NotificationOption[],
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
    constructor(private dataService: DataService) { }

    // This is the main polling routine for notifications.
    // It gets notifications from the database and builds an array of NotificationMessage objects
    // to be shown in the mailbox.
    pollNotifications(): Observable<NotificationMessage[]> {
        return timer(0, POLL_INTERVAL).pipe(
            switchMap(() => {
                // console.log("Polling for notifications");
                return this.dataService.getNotifications()
                .pipe(
                    map(notifications => {
                        const nms: NotificationMessage[] = [];
                        notifications.forEach(rawNotification => {
                            // This is the core of the message
                            const notificationMessage: NotificationMessage = {
                                ...rawNotification,
                                from_neighbor: undefined,
                                header: ""
                            };
                            
                            // You might need to fill stuff in after the neighbor loads below.
                            // If so, set this function to something
                            let afterNeighborLoadFunction: ((neighbor: Neighbor) => void) | undefined;

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
                                afterNeighborLoadFunction = (neighbor => {
                                    notificationMessage.header = neighbor.name + " would like to be your friend!";
                                    notificationMessage.subheader = neighbor.home_address;

                                    // Setup info messages
                                    let accept = notificationMessage.resolutionOptions?.[0];
                                    if (accept) {
                                        accept.successMessage = "Accepted friendship request from " + neighbor.name + "!";
                                        accept.failureMessage = "Failed to accept friendship request from " + neighbor.name + "!";
                                    }
                                });
                            }

                            // Tool borrow requests
                            if (rawNotification.type == "borrow_request") {
                                // The tool ID is in the data json
                                if (rawNotification.data && rawNotification.data['tool_id']) {
                                    const toolId: number = rawNotification.data['tool_id'];

                                    // Borrow requests have accept & reject buttons
                                    if (rawNotification.from_neighbor) {
                                        notificationMessage.resolutionOptions = [
                                            { buttonText: 'Accept', function: () => this.acceptBorrowRequest(rawNotification.from_neighbor!, toolId, rawNotification.id) },
                                            { buttonText: 'Reject', function: () => this.rejectBorrowRequest(rawNotification.from_neighbor!, toolId, rawNotification.id) },
                                        ]
                                    }
                                    // Once the neighbor is loaded, fill in these things
                                    afterNeighborLoadFunction = (neighbor => {
                                        // Need to get the tool that's being requested
                                        this.dataService.getTool(toolId, false).subscribe(tool => {
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
                                                });
                                        });
                                    });
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
                                afterNeighborLoadFunction = undefined;
                            }

                            // Then get the neighbor that sent this message
                            if (rawNotification.from_neighbor) {
                                this.dataService.getNeighbor(rawNotification.from_neighbor).subscribe(neighbor => {
                                    notificationMessage.from_neighbor = neighbor;
                                    // Wait for the neighbor to load from the db (this stuff isn't reactive so wait)
                                    new BehaviorSubject<boolean>(neighbor.loaded)
                                        .pipe(filter(val => val === true))
                                        .subscribe(() => {
                                            if (afterNeighborLoadFunction != undefined)
                                                afterNeighborLoadFunction(neighbor);
                                        })
                                });
                            }
                            nms.push(notificationMessage);
                        });

                        // Return the list sorted oldest first
                        return nms.sort((a, b) => { return a.created_ts.getTime() - b.created_ts.getTime() });
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
    acceptBorrowRequest(neighborId: number, toolId: number, notificationId: number) : Observable<void> {
        console.log("Accepted borrow request: " + toolId);
        return EMPTY;
        //TODO
    }

    // Reject borrow tool request
    rejectBorrowRequest(neighborId: number, toolId: number, notificationId: number) : Observable<void> {
        console.log("Rejected borrow request: " + toolId);
        return EMPTY;
        //TODO
    }

}