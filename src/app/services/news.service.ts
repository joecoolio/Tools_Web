import { Injectable } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, Subscription, forkJoin, interval, of, timer } from 'rxjs';
import { distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators';
import { DataService, Neighbor, Tool } from './data.service';

// How often to poll for notifications
const POLL_INTERVAL = 60000;

// These are turned into form fields - you need to fill them in to close the message
export interface NewsItem {
    id: number,
    type: string,
    occur_ts: Date,
    neighbor: Neighbor | undefined,
    tool: Tool | undefined,
    distance_m: number,
}

@Injectable({ providedIn: 'root' })
export class NewsService {
    constructor(private dataService: DataService) {  }

    public newsItems: NewsItem[] = [];

    private maxNewsId: number = 0; // The highest id we've seen (to avoid re-requesting)

    // This polls peridically for new news.
    // Each new item is loaded into the newsItems.
    pollNews(): Observable<NewsItem[]> {
        return timer(0, POLL_INTERVAL).pipe(
            switchMap(() => {
                // console.log("Polling for news > " + this.maxNewsId);
                return this.dataService.getNews(100 /* 100 mile radius TODO make it smaller */, this.maxNewsId)
                .pipe(
                    map(rawNewsArray => {
                        const newArray = [ ... this.newsItems ];

                        rawNewsArray.forEach(rawNewsItem => {
                            // This is the core of the message
                            const newsItem: NewsItem = {
                                id: rawNewsItem.id,
                                type: rawNewsItem.type,
                                occur_ts: new Date(rawNewsItem.occur_ts),
                                neighbor: undefined,
                                tool: undefined,
                                distance_m: rawNewsItem.distance_m,
                            };

                            // // Request the neighbor & tool objects
                            if (rawNewsItem.neighbor_id) this.dataService.getNeighbor(rawNewsItem.neighbor_id).subscribe(n => newsItem.neighbor = n);
                            if (rawNewsItem.tool_id) this.dataService.getTool(rawNewsItem.tool_id, false).subscribe(t => newsItem.tool = t);

                            newArray.push(newsItem);

                            this.maxNewsId = Math.max(this.maxNewsId, rawNewsItem.id);
                        });

                        this.newsItems = newArray.sort((a, b) => { return b.occur_ts.getTime() - a.occur_ts.getTime() });
                        return this.newsItems;
                    })
                );
            })
        );
    }
}