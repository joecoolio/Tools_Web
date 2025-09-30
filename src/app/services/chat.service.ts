import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, catchError, delayWhen, EMPTY, filter, interval, map, max, Observable, retry, retryWhen, Subject, Subscription, take, tap, timer } from 'rxjs';
import { WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/webSocket';
import { environment } from '../../environments/environment'
import { TokenService } from './token.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
    private socket$?: WebSocketSubject<{ [key: string]: any }>; // The websocket, accepts (key, value) pairs
    private pingSubscription?: Subscription; // Heartbeat subscription
    private keepConnectionOpen?: boolean; // This is set to true when a client calls connect and false when they call disconnect.
    private readonly _connected = signal(false); // Signal indicating if the websocket is currently connected (doesn't include identification)
    private _identifyCompleted$ = new Subject<void>(); // Fires after successful identify (or re-identify) to server
    private readonly _messages$ = new Subject<{ [key: string]: any }>();

    // Public exposed signals & observables
    public readonly connected = this._connected.asReadonly(); // Signal indicating if the websocket is currently connected (doesn't include identification)
    public identifyCompleted$ = this._identifyCompleted$.asObservable(); // Fires after successful identify (or re-identify) to server
    // public messages$ = this._messages$.asObservable();

    // When you identify to the chat server, it tells you the last time it saw you.
    // This is stored so you can request chat messages and mark the new ones.
    private lastSeenDate?: Date; 

    constructor(
        private tokenService: TokenService,
    ) {  }

    // Open the websocket - actually start the connection process but whatevs.
    // Tell the caller when it's opened.
    // Setup a ping to keep it open.
    // Setup a monitor to reconnect if it closes.
    connect(): void {
        this.keepConnectionOpen = true; // Keep it open until the client asks to close it

        // Exponential backoff for connecting
        const minRetryDelay = 1000;
        const maxRetryDelay = 60000;
        let retryAttempt = 0; // Set to 0 initially and reset on successful connection

        const config: WebSocketSubjectConfig<{ [key: string]: any }> = {
            url: environment.websocketUrl,
            openObserver: {
                next: () => {
                    console.log('WebSocket connection opened!');
                    this._connected.set(true);
                    retryAttempt = 0; // Reset retry count

                    // Send identifying information and do whatever handshake needs to happen
                    // prior to exposing messages to clients
                    this.postConnect().subscribe(success => {
                        if (success) {
                            // Identification successful, messages will now flow.
                            console.log("Chat: identified to the chat server, messages will flow");
                            // Register to receive messages from the socket
                            this.socket$?.subscribe(msg => this._messages$.next(msg));
                        } else {
                            // Identification failed, do ... something?
                            console.log("Chat: failed to identify to the chat server");
                        }
                    });
                    // Send a ping over the socket periodically
                    if (this.pingSubscription) {
                        this.pingSubscription.unsubscribe();
                    }
                    this.pingSubscription = interval(environment.websocketHeartbeat).subscribe(() => {
                        if (this.socket$) {
                            this.socket$.next({ type: 'ping', timestamp: new Date().toISOString() });
                            // console.log('Ping sent');
                        }
                    });
                }
            },
            closeObserver: {
                next: () => {
                    this._connected.set(false);
                    this.socket$?.unsubscribe();

                    // If not initiatied by this.disconnect(), reconnect
                    console.log('WebSocket connection closed!');
                    if (this.pingSubscription) {
                        this.pingSubscription.unsubscribe();
                        console.log("Ping terminated");
                    }

                    // Run any processes needed after disconnect
                    this.postDisconnect();
                }
            }
        };

        // Routine to open the connection and reconnect as needed.
        const connect = () => {
            if (this.keepConnectionOpen) {
                this.socket$ = new WebSocketSubject(config);
                this.socket$.pipe(
                    tap({
                        error: err => console.error('WebSocket error:', err)
                    }),
                    catchError(() => {
                        const delay = Math.min(minRetryDelay * 2 ** retryAttempt, maxRetryDelay);
                        retryAttempt++;
                        console.log(`Retrying in ${delay}ms (attempt ${retryAttempt})`);
                        return timer(delay);
                    })
                )
                .subscribe({
                    next: msg => console.log('Received:', msg),
                    error: () => connect(),
                    complete: () => connect()
                });
            }
        }

        // Fire off the connection request.
        connect();
    }

    // Run some post connection work.
    // This will emit true when everything is done and false if it doesn't work.
    private postConnect(): Observable<boolean> {
        const subject$ = new Subject<boolean>();

        // Send identifying information to the server so it knows who I am.
        // This sends the registered access token which is a JWT containing my ids.
        this.sendMessage({
            type: "identify",
            token: this.tokenService.token,
        });
        console.log("Chat: send identification, waiting for response");

        // Wait for an answer on the identification.
        // Emit when it's complete with the result. 
        this.socket$?.pipe(
            filter(msg => msg["type"] === 'identify_result'),
            take(1),
        ).subscribe(msg => {
            console.log("Chat: identification response received: " + JSON.stringify(msg));
            if ('last_seen' in msg) {
                this.lastSeenDate = new Date(msg['last_seen']);
            } else {
                this.lastSeenDate = new Date('2000-01-01 00:00:00.000000-04');
            }
            console.log("Chat: last seen date: " + this.lastSeenDate);
            
            subject$.next(msg["result"]);
            subject$.complete();

            // Tell anybody that is listening that identification just completed
            this._identifyCompleted$.next();
        });

        return subject$;
    }

    private postDisconnect(): void {

    }

    // Disconnect the socket.
    disconnect(): void {
        this.keepConnectionOpen = false; // To avoid auto-reconnect

        if (this.socket$) {
            this.socket$.complete();
            console.log('Chat: Disconnected');
        }
    }

    // Get messages as they arrive.
    // Exclude "pong" messages from the keepalive.
    // Subscribe to this whenever, it will adjust to the socket.
    getMessages(): Observable<{ [key: string]: any }> {
        return this._messages$.asObservable().pipe(
            filter(message => message["type"] !== 'pong') //TODO this nukes if type isn't there (or the message isn't json)
        )
    }

    // Send a message
    sendMessage(message: { [key: string]: any }): void {
        if (message['message_uuid'] === undefined) {
            message['message_uuid'] = crypto.randomUUID();
        }
        // console.log("Chat send: " + JSON.stringify(message));
        if (this.socket$) {
            this.socket$.next(message);
        }
    }
}
