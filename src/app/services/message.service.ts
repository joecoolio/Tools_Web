import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

export interface Message {
    type: string,
    message: string,
}

// A simple service that allows any component to send messasges to the user.
// This will be picked up by the main app component and shown.
@Injectable({ providedIn: 'root' })
export class MessageService {
    private notifySubject = new Subject<Message>();

    // The main component can monitor this.
    notify$ = this.notifySubject.asObservable();

    // Components can call this.
    send(type: string = 'info', message: string) {
        this.notifySubject.next({ type: type, message: message });
    }
}
